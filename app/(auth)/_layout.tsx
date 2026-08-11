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

  if (gate === 'ready') {
    return <Redirect href="/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
