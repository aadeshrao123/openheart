import { errorResponse, jsonResponse, readJsonObject, serveJson } from '../_shared/http.ts';
import { createR2Client, getObject } from '../_shared/r2.ts';
import { detectImageFormat } from '../_shared/media.ts';
import { createModerationProvider, type ModerationResult } from '../_shared/moderation.ts';
import {
  createRekognitionVerificationProvider,
  type VerificationChallenge,
  type VerificationOutcome,
} from '../_shared/verification.ts';
import {
  authenticateRequest,
  createAdminClient,
  UNIQUE_VIOLATION,
  type AdminClient,
} from '../_shared/supabase-admin.ts';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// Newest first, because the most recent photo is the one the person looks like
// now, and the comparison stops at the first match.
const COMPARISON_PHOTO_LIMIT = 3;

serveJson(async (request) => {
  if (request.method !== 'POST') {
    return errorResponse('method_not_allowed', 405);
  }

  const admin = createAdminClient();
  const userId = await authenticateRequest(request, admin);

  if (!userId) {
    return errorResponse('unauthorized', 401);
  }

  const body = await readJsonObject(request);
  const attemptId = body?.attempt_id;

  if (typeof attemptId !== 'string') {
    return errorResponse('invalid_attempt', 400);
  }

  const { data: attempt, error: attemptError } = await admin
    .from('verification_attempts')
    .select('id, profile_id, challenge, status, selfie_r2_key')
    .eq('id', attemptId)
    .maybeSingle();

  if (attemptError) {
    throw attemptError;
  }

  // One answer for "no such attempt" and for "not yours", so this cannot be
  // used to learn whether an id exists.
  if (!attempt || attempt.profile_id !== userId) {
    return errorResponse('attempt_not_found', 404);
  }

  // A verdict is final. Re-running would let a caller retry a probabilistic
  // check until it returned the answer they wanted, which is the whole reason
  // the attempt is a row rather than a request parameter.
  if (attempt.status !== 'pending') {
    return jsonResponse({ status: attempt.status }, 200);
  }

  const r2 = createR2Client();
  let selfie: Response;

  try {
    selfie = await getObject(r2, attempt.selfie_r2_key);
  } catch (error) {
    console.error('r2 fetch failed', error);
    return errorResponse('verification_unavailable', 503);
  }

  if (!selfie.ok) {
    return errorResponse('selfie_not_uploaded', 409);
  }

  const selfieBytes = new Uint8Array(await selfie.arrayBuffer());
  const selfieType = detectImageFormat(selfieBytes);

  if (selfieType === null || selfieBytes.byteLength > MAX_UPLOAD_BYTES) {
    return await finish(admin, attempt.id, attempt.selfie_r2_key, 'rejected', 'not_an_image');
  }

  // The selfie goes through the same scan every uploaded photo does. It is
  // never shown to anyone, but a moderator opens the failures, and "we only
  // look at it in the review queue" is not a reason to skip it.
  let moderation: ModerationResult;

  try {
    moderation = await createModerationProvider().scanImage(selfieBytes, selfieType);
  } catch (error) {
    console.error('selfie moderation failed', error);
    return errorResponse('verification_unavailable', 503);
  }

  if (moderation.verdict === 'rejected') {
    return await finish(admin, attempt.id, attempt.selfie_r2_key, 'rejected', 'unsafe_image');
  }

  const { data: photos, error: photosError } = await admin
    .from('photos')
    .select('r2_key')
    .eq('profile_id', userId)
    .eq('moderation_state', 'approved')
    .order('position')
    .limit(COMPARISON_PHOTO_LIMIT);

  if (photosError) {
    throw photosError;
  }

  if (!photos || photos.length === 0) {
    return errorResponse('no_approved_photos', 409);
  }

  const provider = createRekognitionVerificationProvider();
  let liveness: VerificationOutcome;
  let match: VerificationOutcome;

  try {
    liveness = await provider.checkLiveness(
      selfieBytes,
      attempt.challenge as VerificationChallenge,
    );

    // Only if the pose held. A failed pose already means a human is looking at
    // it, and the comparison is the expensive half.
    match = liveness.passed
      ? await provider.matchFace(selfieBytes, await readPhotos(r2, photos))
      : { passed: false, reason: 'not_checked' };
  } catch (error) {
    // The attempt stays pending and retryable. An outage must not verify
    // anyone, and must not spend one of their five daily tries either.
    console.error('verification failed', error);
    return errorResponse('verification_unavailable', 503);
  }

  if (liveness.passed && match.passed) {
    return await finish(admin, attempt.id, attempt.selfie_r2_key, 'passed', null);
  }

  // Not rejected. Face comparison is measurably less accurate on darker skin,
  // so a machine saying no is a reason for a person to look, not a verdict.
  const reason = liveness.passed ? match.reason : liveness.reason;

  return await finish(admin, attempt.id, attempt.selfie_r2_key, 'review', reason);
});

async function readPhotos(
  r2: ReturnType<typeof createR2Client>,
  photos: { r2_key: string }[],
): Promise<Uint8Array<ArrayBuffer>[]> {
  const bytes: Uint8Array<ArrayBuffer>[] = [];

  for (const photo of photos) {
    const object = await getObject(r2, photo.r2_key);

    if (object.ok) {
      bytes.push(new Uint8Array(await object.arrayBuffer()));
    }
  }

  return bytes;
}

async function finish(
  admin: AdminClient,
  attemptId: string,
  selfieKey: string,
  status: 'passed' | 'rejected' | 'review',
  reason: string | null,
): Promise<Response> {
  // Held until a moderator has looked at it. Every other outcome is final, so
  // the selfie has done its only job and goes.
  if (status !== 'review') {
    const { error: queueError } = await admin
      .from('deleted_media')
      .insert({ r2_key: selfieKey });

    if (queueError && queueError.code !== UNIQUE_VIOLATION) {
      throw queueError;
    }
  }

  const { error } = await admin.rpc('record_verification_result', {
    attempt: attemptId,
    verdict: status,
    reason,
  });

  if (error) {
    throw error;
  }

  return jsonResponse({ status, reason }, 200);
}
