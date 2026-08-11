import { Redirect, Stack } from 'expo-router';
import { GateErrorView } from '@/components/gate-error-view';
import { SplashView } from '@/components/splash-view';
import { useAuthGate } from '@/hooks/use-auth-gate';

export default function OnboardingLayout() {
  const gate = useAuthGate();

  if (gate === 'loading') {
    return <SplashView />;
  }

  if (gate === 'signed-out') {
    return <Redirect href="/sign-in" />;
  }

  // A failed read must not land here. Onboarding would try to insert a profile
  // for an account that already has one, which can only fail on the primary key.
  if (gate === 'error') {
    return <GateErrorView />;
  }

  // The profile row appears the moment the last step succeeds, which flips the
  // gate to ready and is what carries the user out of the flow.
  if (gate === 'ready') {
    return <Redirect href="/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
