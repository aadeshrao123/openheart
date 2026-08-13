import { Redirect } from 'expo-router';
import { SplashView } from '@/components/splash-view';
import { useAuthGate } from '@/hooks/use-auth-gate';

// Where a provider sends the browser back to. The route has to exist as a real
// page: Supabase redirects to it by URL, and an address that renders nothing is
// the same as a broken sign-in.
//
// Nothing is exchanged here. detectSessionInUrl is on for web, so supabase-js
// has already taken the code out of the query string and swapped it for a
// session by the time this renders. Native never reaches this file, because
// lib/oauth.ts does the exchange itself.
export default function AuthCallback() {
  const gate = useAuthGate();

  if (gate === 'loading') {
    return <SplashView />;
  }

  if (gate === 'signed-out') {
    return <Redirect href="/sign-in" />;
  }

  if (gate === 'onboarding') {
    return <Redirect href="/birthdate" />;
  }

  return <Redirect href="/home" />;
}
