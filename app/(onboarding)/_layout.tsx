import { Redirect, Stack } from 'expo-router';
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

  // The profile row appears the moment the last step succeeds, which flips the
  // gate to ready and is what carries the user out of the flow.
  if (gate === 'ready') {
    return <Redirect href="/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
