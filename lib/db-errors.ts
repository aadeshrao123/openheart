// SQLSTATEs raised deliberately by triggers and functions, and the sentinels
// the screens match on. Both rate limits use the same code so the client has
// one branch for swipes and messages.

export const RATE_LIMIT_SQLSTATE = '53400';
export const NOT_IN_STATE_SQLSTATE = '55000';
export const UNSAFE_TEXT_SQLSTATE = '22000';

export const RATE_LIMITED = 'rate_limited';
export const ALREADY_READ = 'already_read';
export const UNSAFE_TEXT = 'unsafe_text';

// The trigger raises `unsafe_text:<field>:<category>`. The category travels in
// the message rather than in a second SQLSTATE to keep in sync, so this is
// where it comes back out.
export function unsafeTextCategory(message: string): string | null {
  const parts = message.split(':');

  return parts[0] === UNSAFE_TEXT && parts.length === 3 ? parts[2] : null;
}
