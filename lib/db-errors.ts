// SQLSTATEs raised deliberately by triggers and functions, and the sentinels
// the screens match on. Both rate limits use the same code so the client has
// one branch for swipes and messages.

export const RATE_LIMIT_SQLSTATE = '53400';
export const NOT_IN_STATE_SQLSTATE = '55000';

export const RATE_LIMITED = 'rate_limited';
export const ALREADY_READ = 'already_read';
