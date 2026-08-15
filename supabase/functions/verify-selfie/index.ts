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

type Capture = {
  key: string;
  challenge: VerificationChallenge;
  bytes: Uint8Array<ArrayBuffer>;
  format: string;
};

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
    .select('id, profile_id, challenge, challenge_two, status, selfie_r2_key, selfie_two_r2_key')
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

  // The row decides how many poses this attempt wants, not the request. An
  // attempt started before the second pose existed is still owed its verdict on
  // the terms it was issued under.
  const wanted: { key: string; challenge: VerificationChallenge }[] = [
    { key: attempt.selfie_r2_key, challenge: attempt.challenge as VerificationChallenge },
  ];

  if (attempt.selfie_two_r2_key && attempt.challenge_two) {
    wanted.push({
      key: attempt.selfie_two_r2_key,
      challenge: attempt.challenge_two as VerificationChallenge,
    });
  }

  const keys = wanted.map((capture) => capture.key);
  const r2 = createR2Client();
  const captures: Capture[] = [];

  for (const { key, challenge } of wanted) {
    let stored: Response;

    try {
      stored = await getObject(r2, key);
    } catch (error) {
      console.error('r2 fetch failed', error);
      return errorResponse('verification_unavailable', 503);
    }

    // Both or neither. Half an attempt is not a failed check, it is one that
    // never ran, and it must not spend a verdict or one of the daily tries.
    if (!stored.ok) {
      return errorResponse('selfie_not_uploaded', 409);
    }

    const bytes = new Uint8Array(await stored.arrayBuffer());
    const format = detectImageFormat(bytes);

    if (format === null || bytes.byteLength > MAX_UPLOAD_BYTES) {
      return await finish(admin, attempt.id, keys, 'rejected', 'not_an_image');
    }

    captures.push({ key, challenge, bytes, format });
  }

  // Every selfie goes through the same scan an uploaded photo does. None are
  // ever shown to anyone, but a moderator opens the failures, and "we only look
  // at it in the review queue" is not a reason to skip it.
  for (const capture of captures) {
    let moderation: ModerationResult;

    try {
      moderation = await createModerationProvider().scanImage(capture.bytes, capture.format);
    } catch (error) {
      console.error('selfie moderation failed', error);
      return errorResponse('verification_unavailable', 503);
    }

    if (moderation.verdict === 'rejected') {
      return await finish(admin, attempt.id, keys, 'rejected', 'unsafe_image');
    }
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
  let outcome: VerificationOutcome;

  try {
    outcome = await judge(provider, captures, await readPhotos(r2, photos));
  } catch (error) {
    // The attempt stays pending and retryable. An outage must not verify
    // anyone, and must not spend one of their five daily tries either.
    console.error('verification failed', error);
    return errorResponse('verification_unavailable', 503);
  }

  if (outcome.passed) {
    return await finish(admin, attempt.id, keys, 'passed', null);
  }

  // Not rejected. Face comparison is measurably less accurate on darker skin,
  // so a machine saying no is a reason for a person to look, not a verdict.
  return await finish(admin, attempt.id, keys, 'review', outcome.reason);
});

// The whole decision, in the order that spends the least money. Pose checks are
// one DetectFaces each and come first; the comparisons are the expensive half
// and never run behind a pose that did not hold.
async function judge(
  provider: ReturnType<typeof createRekognitionVerificationProvider>,
  captures: Capture[],
  photos: Uint8Array<ArrayBuffer>[],
): Promise<VerificationOutcome> {
  for (const capture of captures) {
    const liveness = await provider.checkLiveness(capture.bytes, capture.challenge);

    if (!liveness.passed) {
      return liveness;
    }
  }

  // The check that makes a second pose worth taking. Without it the poses can
  // come from two different faces: one prepared photo of the victim holding the
  // pose that was asked for, and the attacker's own live face for the other.
  // One comparison rather than running the profile photos twice, because the
  // faces only have to agree with each other and then with the profile once.
  if (captures.length > 1) {
    const sameFace = await provider.matchFace(captures[0].bytes, [captures[1].bytes]);

    if (!sameFace.passed) {
      return { passed: false, reason: 'different_person' };
    }
  }

  return await provider.matchFace(captures[0].bytes, photos);
}

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
  selfieKeys: string[],
  status: 'passed' | 'rejected' | 'review',
  reason: string | null,
): Promise<Response> {
  // Held until a moderator has looked at them. Every other outcome is final, so
  // the selfies have done their only job and go.
  if (status !== 'review') {
    for (const key of selfieKeys) {
      const { error: queueError } = await admin.from('deleted_media').insert({ r2_key: key });

      if (queueError && queueError.code !== UNIQUE_VIOLATION) {
        throw queueError;
      }
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
