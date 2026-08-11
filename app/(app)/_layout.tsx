import { Redirect, Stack } from 'expo-router';
import { GateErrorView } from '@/components/gate-error-view';
import { SplashView } from '@/components/splash-view';
import { SuspendedView } from '@/components/suspended-view';
import { useAuthGate } from '@/hooks/use-auth-gate';
import { useLastActivePing } from '@/hooks/use-last-active';
import { useMyProfile } from '@/hooks/use-my-profile';

// Everything behind sign-in sits under this layout, so a deep link to any of it
// is checked here rather than in each screen.
export default function AppLayout() {
  const gate = useAuthGate();
  const { data: profile } = useMyProfile();

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

  if (gate === 'error') {
    return <GateErrorView />;
  }

  if (gate === 'onboarding') {
    return <Redirect href="/birthdate" />;
  }

  if (gate === 'suspended') {
    return <SuspendedView reason={profile?.suspended_reason ?? null} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
