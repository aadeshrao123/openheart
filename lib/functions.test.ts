import { describe, expect, it, vi } from 'vitest';

// The module imports the Supabase client, which reaches React Native source
// Vitest cannot parse. Nothing here calls a function.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { functionErrorCode } from '@/lib/functions';

describe('functionErrorCode', () => {
  it('reads the field errorResponse actually sends', () => {
    expect(functionErrorCode({ error: 'rate_limited' })).toBe('rate_limited');
  });

  it('does not accept the shape the client used to expect', () => {
    expect(functionErrorCode({ code: 'rate_limited' })).toBeNull();
  });

  it('treats a missing or empty body as no code', () => {
    expect(functionErrorCode(null)).toBeNull();
    expect(functionErrorCode({})).toBeNull();
    expect(functionErrorCode({ error: '' })).toBeNull();
    expect(functionErrorCode('rate_limited')).toBeNull();
  });
});
