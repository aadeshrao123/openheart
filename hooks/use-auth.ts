import { useMutation } from '@tanstack/react-query';
import type { Provider } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type VerifyInput = {
  email: string;
  code: string;
};

// Addresses are compared and stored lowercase by the auth server, so the code
// is requested and verified against the same normalisation. Without this,
// typing "Sam@x.com" then verifying "sam@x.com" fails on a valid code.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function useRequestEmailCode() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizeEmail(email),

        // Signing in and signing up are the same action here. There is no
        // password, so a separate registration step would ask the user to
        // remember which one they did last time.
        options: { shouldCreateUser: true },
      });

      if (error) {
        throw error;
      }
    },
  });
}

export function useVerifyEmailCode() {
  return useMutation({
    mutationFn: async ({ email, code }: VerifyInput) => {
      // type "email" is the typed-code flow. "magiclink" is the one that
      // arrives by clicking a link, and it rejects a code.
      const { error } = await supabase.auth.verifyOtp({
        email: normalizeEmail(email),
        token: code.trim(),
        type: 'email',
      });

      if (error) {
        throw error;
      }
    },

    // No cache work here. onAuthStateChange fires on success and useAuthSync
    // writes the new session, which is what moves the router off this screen.
  });
}

// Unused until a provider is added to OAUTH_PROVIDERS, and correct for all of
// them when one is: Supabase's OAuth entry point takes the provider as data.
export function useSignInWithProvider() {
  return useMutation({
    mutationFn: async (provider: Provider) => {
      const { error } = await supabase.auth.signInWithOAuth({ provider });

      if (error) {
        throw error;
      }
    },
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    },
  });
}
