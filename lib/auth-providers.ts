import type { Provider } from '@supabase/supabase-js';

export type OAuthProvider = {
  // Supabase's own provider id. Microsoft is "azure", not "microsoft".
  id: Provider;
  labelKey: string;
};

// Empty because none is configured yet, not because the app cannot do it.
// signInWithOAuth is already generic over the provider and the sign-in screen
// renders this list, so adding one is an entry here plus credentials in
// Supabase. The label keys already exist:
//
//   { id: 'google', labelKey: 'auth.continue_with_google' }
//   { id: 'apple',  labelKey: 'auth.continue_with_apple'  }
//   { id: 'azure',  labelKey: 'auth.continue_with_microsoft' }
//
// Apple's guideline 4.8 requires Sign in with Apple as soon as any other
// third-party login exists, so apple ships with the first of them. And never
// merge accounts on a matching email: Hide My Email relay addresses mean one
// person can present two, and two people can share one.
export const OAUTH_PROVIDERS: readonly OAuthProvider[] = [];
