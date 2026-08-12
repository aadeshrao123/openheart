import { errorResponse, jsonResponse, serveJson } from '../_shared/http.ts';
import { createR2Client, presignUpload } from '../_shared/r2.ts';
import { randomChallenge } from '../_shared/verification.ts';
import { authenticateRequest, createAdminClient } from '../_shared/supabase-admin.ts';

// Raised by the verification rate limit trigger. Same code the swipe and
// message limits use, so the client has one branch for all of them.
const RATE_LIMIT_SQLSTATE = '53400';

const UPLOAD_URL_TTL_SECONDS = 300;

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

  const challenge = randomChallenge();
  const selfieKey = `${VERIFICATION_PREFIX}${crypto.randomUUID()}`;

  const { data: attempt, error: insertError } = await admin
    .from('verification_attempts')
    .insert({ profile_id: userId, challenge, selfie_r2_key: selfieKey })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === RATE_LIMIT_SQLSTATE) {
      return errorResponse('rate_limited', 429);
    }

    throw insertError;
  }

  const uploadUrl = await presignUpload(createR2Client(), selfieKey, UPLOAD_URL_TTL_SECONDS);

  // The challenge goes back with the URL because the screen has to tell the
  // person which way to turn. Knowing it is not the secret; being unable to
  // choose it is.
  return jsonResponse(
    { attempt_id: attempt.id, challenge, upload_url: uploadUrl },
    201,
  );
});
