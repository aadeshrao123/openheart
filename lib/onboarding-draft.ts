import { create } from 'zustand';
import { usesImperialUnits } from '@/lib/format';
import { AGE_FLOOR, defaultDistanceKm, type Gender } from '@/lib/profile-options';

export type OnboardingDraft = {
  // yyyy-mm-dd. Collected first because it is the age gate, and because it is
  // the one field that can never be changed afterwards.
  birthdate: string | null;
  displayName: string;
  gender: Gender | null;
  seeking: Gender[];
  bio: string;
  maxDistanceKm: number;
  ageMin: number;
  ageMax: number;
};

type OnboardingStore = OnboardingDraft & {
  update: (patch: Partial<OnboardingDraft>) => void;
  reset: () => void;
};

// Defaults match the column defaults in 0001_init.sql, so a user who changes
// nothing produces the same row the database would have.
const EMPTY: OnboardingDraft = {
  birthdate: null,
  displayName: '',
  gender: null,
  seeking: [],
  bio: '',
  // Locale-dependent so the default is one of the presets the user is shown. A
  // flat 50km leaves an imperial user with nothing selected.
  maxDistanceKm: defaultDistanceKm(usesImperialUnits()),
  ageMin: AGE_FLOOR,
  ageMax: 99,
};

// An unsaved form spread over three screens is client state, not server data.
// The row is written once at the end, so an abandoned signup leaves nothing.
// Not persisted: the draft holds a birthdate.
export const useOnboardingDraft = create<OnboardingStore>((set) => ({
  ...EMPTY,
  update: (patch) => set(patch),
  reset: () => set(EMPTY),
}));
