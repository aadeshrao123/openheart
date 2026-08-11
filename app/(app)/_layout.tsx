import { Redirect, Stack } from 'expo-router';
import { SplashView } from '@/components/splash-view';
import { useAuthGate } from '@/hooks/use-auth-gate';
import { useLastActivePing } from '@/hooks/use-last-active';

// Everything behind sign-in sits under this layout, so a deep link to any of it
// is checked here rather than in each screen.
export default function AppLayout() {
  const gate = useAuthGate();

  // Inside the signed-in layout because it needs a profile row to update. It
  // ignores the call while signed out anyway, but mounting it here keeps the
  // write out of the auth and onboarding flows entirely.
  useLastActivePing();

  if (gate === 'loading') {
    return <SplashView />;
  }

  if (gate === 'signed-out') {
    return <Redirect href="/sign-in" />;
  }

  if (gate === 'onboarding') {
    return <Redirect href="/birthdate" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
