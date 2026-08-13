import { detectImageFormat, MAX_UPLOAD_BYTES } from '../_shared/media.ts';
import { errorResponse, jsonResponse, readJsonObject, serveJson } from '../_shared/http.ts';
import { createR2Client, getObject } from '../_shared/r2.ts';
import {
  createModerationProvider,
  type ModerationResult,
} from '../_shared/moderation.ts';
import {
  type AdminClient,
  authenticateRequest,
  createAdminClient,
  UNIQUE_VIOLATION,
} from '../_shared/supabase-admin.ts';

// Shield's classifications for a hash match. Both are escalated to a person and
// recorded verbatim, because only a lawyer can say which carries a duty.
const KNOWN_MATERIAL: ReadonlySet<string> = new Set([
  'csam',
  'harmful-abusive-material',
]);

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

  // A missing object comes back as a 404 response, but an unreachable bucket
  // throws instead, so without this an R2 outage surfaced as internal_error 500
  // with nothing telling the client it was worth retrying. Either way the row
  // stays pending, so the retry is safe.
  let object: Response;

  try {
    object = await getObject(createR2Client(), r2Key);
  } catch (error) {
    console.error('r2 fetch failed', error);
    return errorResponse('moderation_unavailable', 503);
  }

  if (!object.ok) {
    return errorResponse('object_not_uploaded', 409);
  }

  const bytes = new Uint8Array(await object.arrayBuffer());
  const contentType = detectImageFormat(bytes);

  if (contentType === null || bytes.byteLength > MAX_UPLOAD_BYTES) {
    await rejectPhoto(admin, photoId, r2Key, 'not_an_image');
    return jsonResponse({ moderation_state: 'rejected' }, 200);
  }

  // Fail closed. An unconfigured or unreachable scanner leaves the row pending
  // and retryable, and never lets a photo through unscanned.
  let result: ModerationResult | null = null;

  try {
    // Built here rather than at module scope so a missing credential is a 503
    // on one request instead of a function that refuses to boot at all.
    result = await createModerationProvider().scanImage(bytes, contentType);
  } catch (error) {
    console.error('image moderation failed', error);
  }

  if (result === null) {
    return errorResponse('moderation_unavailable', 503);
  }

  if (result.verdict === 'rejected') {
    if (KNOWN_MATERIAL.has(result.detail)) {
      await recordKnownMaterial(admin, photoId, userId, r2Key, result.detail);
    }

    await rejectPhoto(admin, photoId, r2Key, result.detail);
    return jsonResponse({ moderation_state: 'rejected' }, 200);
  }

  const { error: approveError } = await admin
    .from('photos')
    .update({ moderation_state: 'approved', moderation_detail: result.detail })
    .eq('id', photoId);

  if (approveError) {
    throw approveError;
  }

  return jsonResponse({ moderation_state: 'approved' }, 200);
});

// Whether the object survives the rejection. Off unless explicitly enabled,
// because holding this material is only defensible once it has been reported,
// and reporting needs an NCMEC registration that does not exist yet.
//
// A switch rather than a constant so the answer, when a lawyer gives one, is a
// secret change rather than a redeploy under time pressure.
function preservesKnownMaterial(): boolean {
  return Deno.env.get('PRESERVE_CSAM_MATCHES') === 'true';
}

async function rejectPhoto(
  admin: AdminClient,
  photoId: string,
  r2Key: string,
  detail: string,
): Promise<void> {
  // Queued before the verdict is recorded. A crash between the two statements
  // then leaves a retryable pending row rather than an object in quarantine
  // that nothing will ever purge.
  const hold = KNOWN_MATERIAL.has(detail) && preservesKnownMaterial();

  if (!hold) {
    const { error: queueError } = await admin
      .from('deleted_media')
      .insert({ r2_key: r2Key });

    if (queueError && queueError.code !== UNIQUE_VIOLATION) {
      throw queueError;
    }
  }

  const { error: updateError } = await admin
    .from('photos')
    .update({ moderation_state: 'rejected', moderation_detail: detail })
    .eq('id', photoId);

  if (updateError) {
    throw updateError;
  }
}

// Written before the photo row is touched, so a crash leaves an incident with a
// still-pending photo rather than a rejected photo nobody was told about.
async function recordKnownMaterial(
  admin: AdminClient,
  photoId: string,
  profileId: string,
  r2Key: string,
  classification: string,
): Promise<void> {
  const { error: incidentError } = await admin.from('csam_incidents').insert({
    profile_id: profileId,
    photo_id: photoId,
    r2_key: r2Key,
    classification,
    object_preserved: preservesKnownMaterial(),
  });

  if (incidentError) {
    throw incidentError;
  }

  // Shield matches against known hashes rather than guessing, so a match is not
  // the probabilistic call that photo verification is. Suspended immediately
  // and a moderator decides, rather than the other way round.
  //
  // Through an RPC because service_role deliberately holds no privilege on
  // profiles, the same way 0017 keeps photo_verified out of its reach.
  const { error: suspendError } = await admin.rpc('suspend_for_known_material', {
    target: profileId,
    reason: classification,
  });

  if (suspendError) {
    throw suspendError;
  }
}
