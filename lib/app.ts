import Constants from 'expo-constants';

// app.json already holds the name the launcher and both stores display, so
// reading it here keeps a rename to one file instead of two. The fallback only
// matters in test environments where the manifest is not loaded.
export const APP_NAME = Constants.expoConfig?.name ?? 'OpenHeart';

// Apple's guideline 1.2 requires published contact information for any app with
// user-generated content, alongside filtering, reporting and blocking. Here
// rather than in the translations, so it is one line to change and cannot drift
// between ten language files.
export const SUPPORT_EMAIL = 'support@openheartapp.org';

// Tracked in docs/legal/, so the site and the repository cannot disagree.
// Untranslated on purpose: a machine-drafted legal document reads as
// authoritative and is not.
export const PRIVACY_POLICY_URL = 'https://openheartapp.org/privacy';
export const TERMS_URL = 'https://openheartapp.org/terms';
