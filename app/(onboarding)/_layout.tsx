import { Redirect, Stack } from 'expo-router';
import { GateErrorView } from '@/components/gate-error-view';
import { SplashView } from '@/components/splash-view';
import { useAuthGate } from '@/hooks/use-auth-gate';
import { screenTransition } from '@/lib/screen-transitions';
import { useReducedMotion } from '@/lib/use-reduced-motion';

export default function OnboardingLayout() {
  const gate = useAuthGate();

  // Above the redirects, because a hook cannot be called after one.
  const reduceMotion = useReducedMotion();

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

  // Birthdate, about you, preferences. Three steps in a fixed order, the same
  // shape as the auth flow and given the same transition on purpose.
  return (
    <Stack screenOptions={{ headerShown: false, ...screenTransition('step', reduceMotion) }} />
  );
}
