import { useMyProfile } from '@/hooks/use-my-profile';
import { useSession } from '@/hooks/use-session';

export type AuthGate = 'loading' | 'signed-out' | 'onboarding' | 'error' | 'suspended' | 'ready';

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

  // Before the onboarding check, and the reason this state exists. maybeSingle
  // returns null for no row and the query throws for a failed read, so both
  // arrive as a falsy `data`. Treating them alike sent an existing user whose
  // profile request failed into signup, where the insert can only fail on the
  // primary key, leaving them unable to reach an account they already have.
  if (profile.isError) {
    return 'error';
  }

  // No row yet is the normal state between verifying a code and finishing
  // signup, including for someone who quit halfway and came back.
  if (profile.data === null || profile.data === undefined) {
    return 'onboarding';
  }

  // Before 'ready', so a suspended account cannot reach a screen that writes.
  // The database refuses those writes anyway; this is what makes the refusal
  // legible instead of a screen full of errors.
  if (profile.data.suspended_at !== null) {
    return 'suspended';
  }

  return 'ready';
}
