import type { Provider } from '@supabase/supabase-js';
import type { BrandName } from '@/components/ui';

export type OAuthProvider = {
  // Supabase's own provider id. Microsoft is "azure", not "microsoft".
  id: Provider;
  labelKey: string;
  mark: BrandName;
};

// Apple's guideline 4.8 requires Sign in with Apple as soon as any other
// third-party login exists. It is absent here because it needs an Apple
// Developer account that does not exist yet, which makes this list an iOS
// rejection until it is added.
//
// That is deliberate and it is safe only while iOS is not being submitted: web
// and Play have no equivalent rule. Add
//
//   { id: 'apple', labelKey: 'auth.continue_with_apple', mark: 'apple' }
//
// in the same change that first uploads a build to App Store Connect.
//
// Supabase links a new provider identity onto an existing user when the email
// matches and that email is already verified, so signing in with Google after
// signing in by code lands on the same account rather than a second one. It
// refuses to link to an unverified email, which is the pre-account-takeover
// case. Never write merging by email string on top of that: Apple's Hide My
// Email gives one person a different relay address per app.
export const OAUTH_PROVIDERS: readonly OAuthProvider[] = [
  { id: 'google', labelKey: 'auth.continue_with_google', mark: 'google' },
  { id: 'twitter', labelKey: 'auth.continue_with_x', mark: 'x' },
];
