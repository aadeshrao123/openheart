import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.',
  );
}

// The anon key ships inside the client bundle and is safe there only because
// RLS is enforced server-side. The service role key must never appear outside
// supabase/functions/.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // On web the SDK manages its own browser storage and reads the session out
    // of the callback URL.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    detectSessionInUrl: Platform.OS === 'web',
    autoRefreshToken: true,
    persistSession: true,

    // auth-js defaults to implicit, which returns the access token in the
    // redirect URL. On a phone any app can claim the openheart:// scheme, so
    // that hands the session to whatever answers first. PKCE returns a code
    // that is worthless without the verifier held here.
    //
    // The six digit email sign-in is unaffected: verifyOtp does not use this.
    flowType: 'pkce',
  },
});
