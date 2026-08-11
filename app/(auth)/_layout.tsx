import { Redirect, Stack } from 'expo-router';
import { SplashView } from '@/components/splash-view';
import { useAuthGate } from '@/hooks/use-auth-gate';

// Guards the other way from the rest of the app: someone already signed in has
// no business on the sign-in screen, and leaving it reachable means the back
// gesture after signing in returns to it.
export default function AuthLayout() {
  const gate = useAuthGate();

  if (gate === 'loading') {
    return <SplashView />;
  }

  if (gate === 'onboarding') {
    return <Redirect href="/birthdate" />;
  }

  // Every state except signed-out belongs inside the app, written this way
  // round on purpose. Listing the states that leave was how a suspended
  // account ended up stuck here: it matched none of them, fell through, and
  // was shown the sign-in screen it had just used, with no explanation.
  if (gate !== 'signed-out') {
    return <Redirect href="/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
