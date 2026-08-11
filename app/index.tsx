import { Redirect } from 'expo-router';
import { GateErrorView } from '@/components/gate-error-view';
import { SplashView } from '@/components/splash-view';
import { useAuthGate } from '@/hooks/use-auth-gate';

// The only job of this route is to send the user to the right place. Each group
// layout guards itself as well, for deep links that arrive here.
export default function Index() {
  const gate = useAuthGate();

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

  return <Redirect href="/home" />;
}
