import { useMyProfile } from '@/hooks/use-my-profile';
import { useSession } from '@/hooks/use-session';

export type AuthGate = 'loading' | 'signed-out' | 'onboarding' | 'ready';

// One place decides where a user belongs, so the entry point and the group
// layouts cannot disagree and bounce between each other.
//
// isLoading, not isPending: a query disabled by `enabled` stays pending forever
// and would hang the splash for anyone signed out.
export function useAuthGate(): AuthGate {
  const session = useSession();
  const profile = useMyProfile();

  if (session.isLoading) {
    return 'loading';
  }

  if (!session.data) {
    return 'signed-out';
  }

  if (profile.isLoading) {
    return 'loading';
  }

  // No row yet is the normal state between verifying a code and finishing
  // signup, including for someone who quit halfway and came back.
  if (!profile.data) {
    return 'onboarding';
  }

  return 'ready';
}
