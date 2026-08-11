import { detectImageFormat, MAX_UPLOAD_BYTES } from '../_shared/media.ts';
import { errorResponse, jsonResponse, readJsonObject, serveJson } from '../_shared/http.ts';
import { createR2Client, getObject } from '../_shared/r2.ts';
import {
  type ModerationVerdict,
  unconfiguredModerationProvider,
} from '../_shared/moderation.ts';
import {
  type AdminClient,
  authenticateRequest,
  createAdminClient,
  UNIQUE_VIOLATION,
} from '../_shared/supabase-admin.ts';

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
  const photoId = body?.photo_id;

  if (typeof photoId !== 'string') {
    return errorResponse('invalid_photo_id', 400);
  }

  // Scoped to the caller's own photos. Without the profile_id filter anyone
  // could drive the scanner over another account's pending uploads.
  const { data: photoRow, error: selectError } = await admin
    .from('photos')
    .select('r2_key, moderation_state')
    .eq('id', photoId)
    .eq('profile_id', userId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  // The generated row types live in a gitignored file the Deno bundler cannot
  // resolve, so the two columns read here are narrowed at the boundary instead.
  const photo: Record<string, unknown> | null = photoRow;

  if (!photo) {
    return errorResponse('photo_not_found', 404);
  }

  const r2Key = photo.r2_key;
  const moderationState = photo.moderation_state;

  if (typeof r2Key !== 'string' || typeof moderationState !== 'string') {
    throw new Error('photos row is missing r2_key or moderation_state');
  }

  // A verdict is final. Re-running the scan would let a caller retry until a
  // probabilistic classifier eventually returned the answer they wanted.
  if (moderationState !== 'pending') {
    return jsonResponse({ moderation_state: moderationState }, 200);
  }

  const object = await getObject(createR2Client(), r2Key);

  if (!object.ok) {
    return errorResponse('object_not_uploaded', 409);
  }

  const bytes = new Uint8Array(await object.arrayBuffer());
  const contentType = detectImageFormat(bytes);

  if (contentType === null || bytes.byteLength > MAX_UPLOAD_BYTES) {
    await rejectPhoto(admin, photoId, r2Key);
    return jsonResponse({ moderation_state: 'rejected' }, 200);
  }

  // Fail closed. An unconfigured or unreachable scanner leaves the row pending
  // and retryable, and never lets a photo through unscanned.
  let verdict: ModerationVerdict | null = null;

  try {
    verdict = await unconfiguredModerationProvider.scanImage(bytes, contentType);
  } catch (error) {
    console.error('image moderation failed', error);
  }

  if (verdict === null) {
    return errorResponse('moderation_unavailable', 503);
  }

  if (verdict === 'rejected') {
    await rejectPhoto(admin, photoId, r2Key);
    return jsonResponse({ moderation_state: 'rejected' }, 200);
  }

  const { error: approveError } = await admin
    .from('photos')
    .update({ moderation_state: 'approved' })
    .eq('id', photoId);

  if (approveError) {
    throw approveError;
  }

  return jsonResponse({ moderation_state: 'approved' }, 200);
});

async function rejectPhoto(
  admin: AdminClient,
  photoId: string,
  r2Key: string,
): Promise<void> {
  // Queued before the verdict is recorded. A crash between the two statements
  // then leaves a retryable pending row rather than an object in quarantine
  // that nothing will ever purge.
  const { error: queueError } = await admin
    .from('deleted_media')
    .insert({ r2_key: r2Key });

  if (queueError && queueError.code !== UNIQUE_VIOLATION) {
    throw queueError;
  }

  const { error: updateError } = await admin
    .from('photos')
    .update({ moderation_state: 'rejected' })
    .eq('id', photoId);

  if (updateError) {
    throw updateError;
  }
}
