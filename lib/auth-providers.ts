import type { Provider } from '@supabase/supabase-js';

export type OAuthProvider = {
  // Supabase's own provider id. Microsoft is "azure", not "microsoft".
  id: Provider;
  labelKey: string;
};

// Apple's guideline 4.8 requires Sign in with Apple as soon as any other
// third-party login exists. It is absent here because it needs an Apple
// Developer account that does not exist yet, which makes this list an iOS
// rejection until it is added.
//
// That is deliberate and it is safe only while iOS is not being submitted: web
// and Play have no equivalent rule. Add
//
//   { id: 'apple', labelKey: 'auth.continue_with_apple' }
//
// in the same change that first uploads a build to App Store Connect.
//
// And never merge accounts on a matching email: Hide My Email relay addresses
// mean one person can present two, and two people can share one.
export const OAUTH_PROVIDERS: readonly OAuthProvider[] = [
  { id: 'google', labelKey: 'auth.continue_with_google' },
  { id: 'twitter', labelKey: 'auth.continue_with_x' },
];
