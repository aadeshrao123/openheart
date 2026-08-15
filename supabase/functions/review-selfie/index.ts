import { errorResponse, jsonResponse, readJsonObject, serveJson } from '../_shared/http.ts';
import { createR2Client, presignDownload } from '../_shared/r2.ts';
import { authenticateModerator, createAdminClient } from '../_shared/supabase-admin.ts';

const VIEW_URL_TTL_SECONDS = 300;
const COMPARISON_PHOTO_LIMIT = 3;

serveJson(async (request) => {
  if (request.method !== 'POST') {
    return errorResponse('method_not_allowed', 405);
  }

  const admin = createAdminClient();
  const moderatorId = await authenticateModerator(request, admin);

  if (!moderatorId) {
    return errorResponse('unauthorized', 401);
  }

  const body = await readJsonObject(request);
  const attemptId = body?.attempt_id;

  if (typeof attemptId !== 'string') {
    return errorResponse('invalid_attempt', 400);
  }

  const { data: attempt, error: attemptError } = await admin
    .from('verification_attempts')
    .select('id, profile_id, status, challenge, challenge_two, selfie_r2_key, selfie_two_r2_key')
    .eq('id', attemptId)
    .maybeSingle();

  if (attemptError) {
    throw attemptError;
  }

  // Every other status has queued its selfie for purge, so serving one would
  // hand out a URL to an object the person was told had been deleted.
  if (!attempt || attempt.status !== 'review') {
    return errorResponse('attempt_not_found', 404);
  }

  const { data: photos, error: photosError } = await admin
    .from('photos')
    .select('r2_key')
    .eq('profile_id', attempt.profile_id)
    .eq('moderation_state', 'approved')
    .order('position')
    .limit(COMPARISON_PHOTO_LIMIT);

  if (photosError) {
    throw photosError;
  }

  const r2 = createR2Client();

  // Every pose the attempt actually holds. A moderator shown one of two, or not
  // told there was a second, approves on half the evidence.
  const poses = [{ challenge: attempt.challenge, key: attempt.selfie_r2_key }];

  if (attempt.selfie_two_r2_key && attempt.challenge_two) {
    poses.push({ challenge: attempt.challenge_two, key: attempt.selfie_two_r2_key });
  }

  const [selfies, photoUrls] = await Promise.all([
    Promise.all(
      poses.map(async (pose) => ({
        challenge: pose.challenge,
        url: await presignDownload(r2, pose.key, VIEW_URL_TTL_SECONDS),
      })),
    ),
    Promise.all(
      (photos ?? []).map((photo) => presignDownload(r2, photo.r2_key, VIEW_URL_TTL_SECONDS)),
    ),
  ]);

  return jsonResponse({ selfies, photo_urls: photoUrls }, 200);
});
