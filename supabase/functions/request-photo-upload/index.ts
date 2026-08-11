import { errorResponse, jsonResponse, readJsonObject, serveJson } from '../_shared/http.ts';
import { createR2Client, presignUpload, quarantineKey } from '../_shared/r2.ts';
import {
  authenticateRequest,
  createAdminClient,
  UNIQUE_VIOLATION,
} from '../_shared/supabase-admin.ts';

// Both numbers restate one constraint: `check (position between 0 and 5)` plus
// `unique (profile_id, position)` in 0001_init.sql. Change them together.
const MAX_PHOTOS_PER_PROFILE = 6;
const HIGHEST_POSITION = MAX_PHOTOS_PER_PROFILE - 1;

// Long enough for a slow mobile connection to finish one resized photo, short
// enough that a leaked URL is worthless by the time it is found.
const UPLOAD_URL_TTL_SECONDS = 300;

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
  const position = body?.position;

  if (typeof position !== 'number' || !Number.isInteger(position)) {
    return errorResponse('invalid_position', 400);
  }

  if (position < 0 || position > HIGHEST_POSITION) {
    return errorResponse('invalid_position', 400);
  }

  const { count, error: countError } = await admin
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', userId);

  if (countError) {
    throw countError;
  }

  if ((count ?? 0) >= MAX_PHOTOS_PER_PROFILE) {
    return errorResponse('photo_limit_reached', 409);
  }

  const r2Key = quarantineKey();

  // The row is written before the URL is signed so the unique (profile_id,
  // position) constraint settles two concurrent requests for the same slot.
  // The count above races and is only there to produce a specific error.
  const { data: insertedRow, error: insertError } = await admin
    .from('photos')
    .insert({
      profile_id: userId,
      r2_key: r2Key,
      position,
      moderation_state: 'pending',
    })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) {
      return errorResponse('position_taken', 409);
    }

    throw insertError;
  }

  // The generated row types live in a gitignored file the Deno bundler cannot
  // resolve, so the one column read here is narrowed at the boundary instead.
  const inserted: Record<string, unknown> | null = insertedRow;
  const photoId = inserted?.id;

  if (typeof photoId !== 'string') {
    throw new Error('photos insert returned no id');
  }

  const uploadUrl = await presignUpload(createR2Client(), r2Key, UPLOAD_URL_TTL_SECONDS);

  return jsonResponse(
    {
      photo_id: photoId,
      r2_key: r2Key,
      upload_url: uploadUrl,
      expires_in: UPLOAD_URL_TTL_SECONDS,
    },
    201,
  );
});
