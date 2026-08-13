import { Redirect } from 'expo-router';
import { GateErrorView } from '@/components/gate-error-view';
import { LandingView } from '@/components/landing-view';
import { useAuthGate } from '@/hooks/use-auth-gate';

// The only job of this route is to send the user to the right place. Each group
// layout guards itself as well, for deep links that arrive here.
export default function Index() {
  const gate = useAuthGate();

  // Both states, and not only signed-out, because the web export renders this
  // route to static HTML with the gate still loading. Handing that render a
  // splash makes the splash the entire site to anything that does not run
  // JavaScript, which is most of the crawlers worth reaching. LandingView is
  // the marketing page on web and the splash then sign-in on native.
  if (gate === 'loading' || gate === 'signed-out') {
    return <LandingView />;
  }

  if (gate === 'error') {
    return <GateErrorView />;
  }

  if (gate === 'onboarding') {
    return <Redirect href="/birthdate" />;
  }

  return <Redirect href="/home" />;
}
