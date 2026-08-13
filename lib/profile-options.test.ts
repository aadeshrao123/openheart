import { describe, expect, it, vi } from 'vitest';

// format.ts imports expo-localization, which pulls in React Native's Flow
// source that Vitest cannot parse. Every assertion below passes an explicit
// locale, so the device locale never matters here.
vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

import { formatDistance } from './format';
import {
  CHILDREN_OPTIONS,
  DISTANCE_MAX_KM,
  DISTANCE_MIN_KM,
  EDUCATION_LEVELS,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  INTERESTS,
  INTERESTS_MAX,
  INTEREST_GROUPS,
  PROMPT_GROUPS,
  KM_PER_MILE_STEP,
  LIFESTYLE_FREQUENCIES,
  PROMPTS,
  PROMPTS_MAX,
  RELATIONSHIP_INTENTS,
  defaultDistanceKm,
} from './profile-options';

describe('defaultDistanceKm', () => {
  it('stays inside the column constraint', () => {
    for (const imperial of [true, false]) {
      expect(defaultDistanceKm(imperial)).toBeGreaterThanOrEqual(DISTANCE_MIN_KM);
      expect(defaultDistanceKm(imperial)).toBeLessThanOrEqual(DISTANCE_MAX_KM);
    }
  });

  it('reads as a round number in the unit the user gets', () => {
    expect(formatDistance(defaultDistanceKm(true), 'en-US')).toBe('25 mi');
    expect(formatDistance(defaultDistanceKm(false), 'de-DE')).toBe('25 km');
  });
});

// The slider stores kilometres, so an imperial reader dragging one notch has to
// land on a whole mile or the label jumps 16, 18, 19 and looks broken.
describe('KM_PER_MILE_STEP', () => {
  it('moves an imperial reader a whole mile at a time', () => {
    const start = defaultDistanceKm(true);

    for (let step = 1; step <= 5; step += 1) {
      expect(formatDistance(start + KM_PER_MILE_STEP * step, 'en-US')).toBe(`${25 + step} mi`);
    }
  });
});

// Each list mirrors a CHECK constraint in 0021. A duplicate or an empty value
// would be written to the column and refused by Postgres at the last moment.
describe('option lists', () => {
  const lists = {
    RELATIONSHIP_INTENTS,
    LIFESTYLE_FREQUENCIES,
    CHILDREN_OPTIONS,
    EDUCATION_LEVELS,
    INTERESTS,
    PROMPTS,
  };

  for (const [name, values] of Object.entries(lists)) {
    it(`${name} has no duplicate or empty value`, () => {
      expect(new Set(values).size).toBe(values.length);

      for (const value of values) {
        expect(value.trim()).toBe(value);
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }

  // The picker renders the groups and the column stores what the flat list
  // allows. One missing from either is an option nobody can choose, or one
  // that Postgres refuses after the user has typed an answer.
  it('groups cover the flat lists exactly', () => {
    const grouped = PROMPT_GROUPS.flatMap((group) => group.prompts);

    expect([...grouped].sort()).toEqual([...PROMPTS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);

    const interests = INTEREST_GROUPS.flatMap((group) => group.interests);

    expect([...interests].sort()).toEqual([...INTERESTS].sort());
    expect(new Set(interests).size).toBe(interests.length);
  });

  it('caps match what the schema will accept', () => {
    expect(INTERESTS_MAX).toBeLessThanOrEqual(INTERESTS.length);
    expect(PROMPTS_MAX).toBeLessThanOrEqual(PROMPTS.length);
    expect(HEIGHT_MIN_CM).toBeLessThan(HEIGHT_MAX_CM);
  });
});
