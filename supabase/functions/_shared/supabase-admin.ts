import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import { requireEnv } from './env.ts';

export type AdminClient = SupabaseClient;

// https://www.postgresql.org/docs/current/errcodes-appendix.html
export const UNIQUE_VIOLATION = '23505';

// Bypasses RLS. It exists here and nowhere else in the codebase, and the key it
// reads is an Edge Function secret that is never shipped to a client.
export function createAdminClient(): AdminClient {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// getUser sends the token to the Auth server rather than decoding it locally,
// so the identity it returns is authentic and safe to authorize against.
// https://supabase.com/docs/reference/javascript/auth-getuser
export async function authenticateRequest(
  request: Request,
  admin: AdminClient,
): Promise<string | null> {
  const authorization = request.headers.get('Authorization');

  if (!authorization) {
    return null;
  }

  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data, error } = await admin.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

// The same claim public.is_moderator() reads in SQL. app_metadata is admin-only
// in GoTrue, and getUser verifies against the Auth server rather than decoding
// locally, so a client can neither set it nor forge it.
export async function authenticateModerator(
  request: Request,
  admin: AdminClient,
): Promise<string | null> {
  const authorization = request.headers.get('Authorization');

  if (!authorization) {
    return null;
  }

  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data, error } = await admin.auth.getUser(token);

  if (error || !data.user || data.user.app_metadata.moderator !== true) {
    return null;
  }

  return data.user.id;
}
