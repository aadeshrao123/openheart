import { describe, expect, it, vi } from 'vitest';

// format.ts imports expo-localization, which pulls in React Native's Flow
// source that Vitest cannot parse. Every assertion below passes an explicit
// locale, so the device locale never matters here.
vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

import { formatDistance } from './format';
import { defaultDistanceKm, distancePresetsKm } from './profile-options';
import { DISTANCE_MAX_KM, DISTANCE_MIN_KM } from './profile-options';

describe('distancePresetsKm', () => {
  it('renders as round numbers in the unit the user reads', () => {
    for (const kilometres of distancePresetsKm(true)) {
      expect(formatDistance(kilometres, 'en-US')).toMatch(/^\d+ mi$/);
    }

    for (const kilometres of distancePresetsKm(false)) {
      expect(formatDistance(kilometres, 'de-DE')).toMatch(/^\d+ km$/);
    }
  });

  // The imperial list is converted, so it is the one that could drift outside
  // the max_distance_km CHECK constraint without anyone noticing.
  it('stays inside the column constraint', () => {
    for (const imperial of [true, false]) {
      for (const kilometres of distancePresetsKm(imperial)) {
        expect(kilometres).toBeGreaterThanOrEqual(DISTANCE_MIN_KM);
        expect(kilometres).toBeLessThanOrEqual(DISTANCE_MAX_KM);
      }
    }
  });

  it('gives imperial readers the mile values they asked for', () => {
    const labels = distancePresetsKm(true).map((km) => formatDistance(km, 'en-US'));

    expect(labels).toEqual(['5 mi', '10 mi', '25 mi', '50 mi', '100 mi', '200 mi', '300 mi']);
  });
});

describe('defaultDistanceKm', () => {
  // Otherwise the first render shows no selected chip at all.
  it('is always one of the presets', () => {
    for (const imperial of [true, false]) {
      expect(distancePresetsKm(imperial)).toContain(defaultDistanceKm(imperial));
    }
  });
});
