import { supabase } from '@/lib/supabase';
import type { Provider } from '@supabase/supabase-js';

export const OAUTH_CANCELLED = 'oauth_cancelled';

// Web. The page navigates away to the provider and comes back with a code in
// the query string, which detectSessionInUrl exchanges on load. So this never
// resolves in the usual sense, and there is nothing after it to run.
export async function signInWithProvider(provider: Provider): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });

  if (error) {
    throw error;
  }
}
