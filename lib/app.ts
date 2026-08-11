import Constants from 'expo-constants';

// app.json already holds the name the launcher and both stores display, so
// reading it here keeps a rename to one file instead of two. The fallback only
// matters in test environments where the manifest is not loaded.
export const APP_NAME = Constants.expoConfig?.name ?? 'OpenHeart';
