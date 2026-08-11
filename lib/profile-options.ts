import { KM_PER_MILE } from '@/lib/format';

// The values written to profiles.gender and profiles.seeking. Both columns are
// free text in the schema, so this list is the only thing keeping them to a
// known set, and Phase 4 matching joins seeking against gender using exactly
// these strings.
//
// Stored values are stable identifiers and never shown to anyone. The label is
// always looked up through i18n, so translating one cannot change what is in
// the database.
export const GENDERS = ['woman', 'man', 'nonbinary'] as const;

export type Gender = (typeof GENDERS)[number];

export function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
}

// Mirrors the CHECK constraints in 0001_init.sql. Keeping the client in step
// means a user is told what is wrong while they type instead of getting a
// constraint violation back from Postgres.
export const DISPLAY_NAME_MAX = 40;
export const BIO_MAX = 500;

export const AGE_FLOOR = 18;
export const AGE_CEILING = 120;

export const DISTANCE_MIN_KM = 1;
export const DISTANCE_MAX_KM = 500;

// Presets rather than a slider, which takes its colours as JavaScript props and
// would put a colour outside global.css.
//
// Two lists because the column stores kilometres but the label is rendered in
// the reader's unit: round kilometres come out as 3, 6, 16, 31 miles, which
// reads like a rounding bug rather than a set of choices.
const PRESETS_KM = [5, 10, 25, 50, 100, 250, 500];
const PRESETS_MI = [5, 10, 25, 50, 100, 200, 300];

export function distancePresetsKm(imperial: boolean): number[] {
  if (!imperial) {
    return PRESETS_KM;
  }

  return PRESETS_MI.map((miles) => Math.round(miles * KM_PER_MILE));
}

// Must be one of the presets, or nothing looks selected on first render.
export function defaultDistanceKm(imperial: boolean): number {
  return distancePresetsKm(imperial)[3];
}
