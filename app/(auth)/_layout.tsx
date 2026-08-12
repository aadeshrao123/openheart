import { Redirect, Stack } from 'expo-router';
import { SplashView } from '@/components/splash-view';
import { useAuthGate } from '@/hooks/use-auth-gate';
import { screenTransition } from '@/lib/screen-transitions';
import { useReducedMotion } from '@/lib/use-reduced-motion';

// Guards the other way from the rest of the app: someone already signed in has
// no business on the sign-in screen, and leaving it reachable means the back
// gesture after signing in returns to it.
export default function AuthLayout() {
  const gate = useAuthGate();

  // Above the redirects, because a hook cannot be called after one.
  const reduceMotion = useReducedMotion();

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

  // Email address then the six digit code: a sequence with an order, and the
  // code screen only makes sense after the screen before it.
  return (
    <Stack screenOptions={{ headerShown: false, ...screenTransition('step', reduceMotion) }} />
  );
}
