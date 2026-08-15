import { errorResponse, jsonResponse, serveJson } from '../_shared/http.ts';
import { createR2Client, presignUpload } from '../_shared/r2.ts';
import { randomChallengePair } from '../_shared/verification.ts';
import { authenticateRequest, createAdminClient } from '../_shared/supabase-admin.ts';

// Raised by the verification rate limit trigger. Same code the swipe and
// message limits use, so the client has one branch for all of them.
const RATE_LIMIT_SQLSTATE = '53400';

// Both URLs are signed now and expire together, which is what stops the two
// poses being captured in separate sittings by separate people. Longer than the
// one pose version was, because there are now two captures to get through.
const UPLOAD_URL_TTL_SECONDS = 600;

// Its own prefix rather than quarantine/. A selfie is evidence for one decision
// and is queued for deletion the moment that decision is final, where a photo
// in quarantine is waiting to become visible. Nothing ever promotes out of here.
const VERIFICATION_PREFIX = 'verification/';

serveJson(async (request) => {
  if (request.method !== 'POST') {
    return errorResponse('method_not_allowed', 405);
  }

  const admin = createAdminClient();
  const userId = await authenticateRequest(request, admin);

  if (!userId) {
    return errorResponse('unauthorized', 401);
  }

  // Comparing a selfie against nothing cannot succeed, and the attempt would
  // still cost a DetectFaces call and one of the day's five tries.
  const { count, error: countError } = await admin
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', userId)
    .eq('moderation_state', 'approved');

  if (countError) {
    throw countError;
  }

  if ((count ?? 0) === 0) {
    return errorResponse('no_approved_photos', 409);
  }

  const [challenge, challengeTwo] = randomChallengePair();
  const selfieKey = `${VERIFICATION_PREFIX}${crypto.randomUUID()}`;
  const selfieTwoKey = `${VERIFICATION_PREFIX}${crypto.randomUUID()}`;

  const { data: attempt, error: insertError } = await admin
    .from('verification_attempts')
    .insert({
      profile_id: userId,
      challenge,
      challenge_two: challengeTwo,
      selfie_r2_key: selfieKey,
      selfie_two_r2_key: selfieTwoKey,
    })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === RATE_LIMIT_SQLSTATE) {
      return errorResponse('rate_limited', 429);
    }

    throw insertError;
  }

  const r2 = createR2Client();

  const [uploadUrl, uploadTwoUrl] = await Promise.all([
    presignUpload(r2, selfieKey, UPLOAD_URL_TTL_SECONDS),
    presignUpload(r2, selfieTwoKey, UPLOAD_URL_TTL_SECONDS),
  ]);

  // Both challenges go back with both URLs because the screen has to tell the
  // person which way to turn, twice. Knowing them is not the secret; being
  // unable to choose them, and having to hold both inside one attempt, is.
  return jsonResponse(
    {
      attempt_id: attempt.id,
      challenge,
      upload_url: uploadUrl,
      challenge_two: challengeTwo,
      upload_url_two: uploadTwoUrl,
    },
    201,
  );
});
