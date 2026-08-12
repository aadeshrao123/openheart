// The values the verification screen assembles translation keys from. Here
// rather than imported from the Edge Function, which is Deno and unreachable
// from the app, so lib/translation-keys.test.ts can expand every key the source
// can ask for and fail the build on one that does not resolve.
//
// These mirror supabase/functions/_shared/verification.ts and the enums in
// 0017. Adding a challenge or a reason means adding it in both places, and the
// test is what catches the half that was forgotten.

export const VERIFICATION_CHALLENGES = [
  'turn_left',
  'turn_right',
  'look_up',
  'look_down',
] as const;

export const VERIFICATION_RESULTS = ['passed', 'review', 'rejected'] as const;

export const VERIFICATION_REASONS = [
  'no_face',
  'multiple_faces',
  'pose_mismatch',
  'too_dark',
  'too_blurry',
  'eyes_closed',
  'sunglasses',
  'face_covered',
  'low_confidence',
  'no_match',
  'unsafe_image',
  'not_an_image',
] as const;

export type VerificationReason = (typeof VERIFICATION_REASONS)[number];
