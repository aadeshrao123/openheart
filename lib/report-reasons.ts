// Beside lib/reactions.ts and the gender list in lib/profile-options.ts rather
// than in hooks/use-safety.ts, where it used to live: hooks/ reaches the
// Supabase client, which throws at import without EXPO_PUBLIC_SUPABASE_URL, so
// anything importing the constant had to boot the whole client to read five
// strings. Same split, and the same reason, as lib/calendar.ts and lib/format.ts.
//
// These are stored identifiers written to reports.reason. The label is always
// looked up as safety.reason_<code>, so translating one cannot change what is
// in the database.
export const REPORT_REASONS = [
  'harassment',
  'spam',
  'fake',
  'underage',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];
