import { describe, expect, it, vi } from 'vitest';

// Reaches expo-audio through lib/sounds, which pulls in React Native source
// Vitest cannot parse. Nothing here plays anything.
vi.mock('@/lib/sounds', () => ({ setSoundsMuted: () => {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));

import { isMutedValue } from '@/hooks/use-sound-preference';

describe('isMutedValue', () => {
  it('mutes only on the exact stored true', () => {
    expect(isMutedValue('true')).toBe(true);
  });

  it('leaves sound on for anything else, including nothing stored', () => {
    expect(isMutedValue(null)).toBe(false);
    expect(isMutedValue('false')).toBe(false);
    expect(isMutedValue('')).toBe(false);
    expect(isMutedValue('True')).toBe(false);
    expect(isMutedValue('1')).toBe(false);
  });
});
