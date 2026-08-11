import { isAuthError } from '@supabase/supabase-js';

// Auth server messages are developer text and English-only, so they are never
// shown. Codes verified against the local server: otp_expired covers a wrong
// code AND an expired one, since saying which would help someone guessing.
const KEYS_BY_CODE: Record<string, string> = {
  otp_expired: 'auth.code_invalid',
  over_email_send_rate_limit: 'auth.too_many_requests',
  over_request_rate_limit: 'auth.too_many_requests',
  validation_failed: 'auth.email_invalid',
  email_address_invalid: 'auth.email_invalid',
};

export function authErrorKey(error: unknown): string {
  if (isAuthError(error) && error.code && error.code in KEYS_BY_CODE) {
    return KEYS_BY_CODE[error.code];
  }

  return 'common.error_generic';
}
