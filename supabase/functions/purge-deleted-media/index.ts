import { errorResponse, jsonResponse, serveJson } from '../_shared/http.ts';
import { createR2Client, deleteObject } from '../_shared/r2.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';
import { requireEnv } from '../_shared/env.ts';

// Small enough that one invocation finishes inside the function timeout even
// when every delete is slow, and a scheduled run just picks up the rest.
const BATCH_SIZE = 50;

serveJson(async (request) => {
  if (request.method !== 'POST') {
    return errorResponse('method_not_allowed', 405);
  }

  // No user JWT here: nothing about this is per user, and it must not be
  // callable by whoever happens to be signed in. A shared secret in a header is
  // the check, compared at full length so the comparison cannot be timed.
  const provided = request.headers.get('X-Purge-Token') ?? '';
  const expected = requireEnv('PURGE_TOKEN');

  if (!timingSafeEqual(provided, expected)) {
    return errorResponse('unauthorized', 401);
  }

  const admin = createAdminClient();

  const { data: rows, error: selectError } = await admin
    .from('deleted_media')
    .select('r2_key')
    .is('purged_at', null)
    .order('queued_at')
    .limit(BATCH_SIZE);

  if (selectError) {
    throw selectError;
  }

  const queued: Record<string, unknown>[] = rows ?? [];
  const r2 = createR2Client();

  let purged = 0;
  let failed = 0;

  for (const row of queued) {
    const key = row.r2_key;

    if (typeof key !== 'string') {
      continue;
    }

    // Stamped only after the object is actually gone. A crash in between leaves
    // the row unstamped and the next run retries it, which is the safe
    // direction: purging twice is free, forgetting is a photo that stays
    // fetchable by anyone holding the URL.
    const removed = await purgeOne(r2, key);

    if (!removed) {
      failed += 1;
      continue;
    }

    const { error: stampError } = await admin
      .from('deleted_media')
      .update({ purged_at: new Date().toISOString() })
      .eq('r2_key', key);

    if (stampError) {
      throw stampError;
    }

    purged += 1;
  }

  return jsonResponse({ purged, failed, remaining: queued.length - purged - failed }, 200);
});

async function purgeOne(r2: ReturnType<typeof createR2Client>, key: string): Promise<boolean> {
  try {
    const response = await deleteObject(r2, key);

    // R2 answers 204 for a delete and also for a key that was never there, so
    // an already-absent object counts as purged rather than retrying forever.
    return response.ok || response.status === 404;
  } catch (error) {
    console.error('r2 delete failed', key, error);
    return false;
  }
}

// The token is a fixed-length secret, so comparing every byte is enough to keep
// the duration independent of how much of it a caller got right.
function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}
