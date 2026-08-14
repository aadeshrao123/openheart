import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import type { Provider } from '@supabase/supabase-js';

// Raised when someone closes the browser without finishing. Not an error worth
// showing: they know they cancelled.
export const OAUTH_CANCELLED = 'oauth_cancelled';

// Native. signInWithOAuth alone only builds the URL here, because there is no
// page to navigate away from, so the browser and the return trip are ours.
export async function signInWithProvider(provider: Provider): Promise<void> {
  // No leading slash, and it matters. createURL builds
  // `${scheme}:/${hostUri}${path}` with hostUri forced to "/" in a build that
  // has its own scheme, so a path of "/auth/callback" produces
  // openheart:///auth/callback with three slashes. Supabase compares redirects
  // as exact strings, does not match the two slash form on the allow-list, and
  // silently falls back to Site URL rather than refusing. That is why this
  // failed on a device while the web flow, which never goes through createURL,
  // worked perfectly.
  const redirectTo = Linking.createURL('auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error('oauth_no_url');
  }

  // openAuthSessionAsync, not openBrowserAsync: it uses the system component
  // that shares cookies with the real browser, so somebody already signed in to
  // Google is not asked to type a password into a window we control.
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') {
    throw new Error(OAUTH_CANCELLED);
  }

  // PKCE, so the redirect carries a code rather than a token, and the exchange
  // needs the verifier the client stored when the URL was built.
  const code = new URL(result.url).searchParams.get('code');

  if (!code) {
    throw new Error('oauth_no_code');
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    throw exchangeError;
  }
}
