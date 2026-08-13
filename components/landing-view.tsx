import { Redirect } from 'expo-router';
import { SplashView } from '@/components/splash-view';
import { useAuthGate } from '@/hooks/use-auth-gate';

// Native has no landing page. Somebody who opened the app has already chosen
// it, so a page arguing that they should is a screen between them and signing
// in. landing-view.web.tsx is the marketing site and shares nothing with this.
export function LandingView() {
  const gate = useAuthGate();

  if (gate === 'loading') {
    return <SplashView />;
  }

  return <Redirect href="/sign-in" />;
}
