import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';

// Adding a language: drop the JSON in locales/, add it to both maps below.
// Nothing else in the codebase changes.
export const SUPPORTED_LANGUAGES = {
  en: 'English',
} as const;

export type Language = keyof typeof SUPPORTED_LANGUAGES;

export const FALLBACK_LANGUAGE: Language = 'en';

const resources = {
  en: { translation: en },
} as const;

function isSupported(tag: string): tag is Language {
  return tag in SUPPORTED_LANGUAGES;
}

// getLocales() is ordered by user preference, so the first supported entry is
// the best available match. Tags arrive as "pt-BR", and we match on the base
// language until a region-specific bundle actually exists.
function resolveDeviceLanguage(): Language {
  for (const locale of getLocales()) {
    const base = locale.languageCode ?? '';

    if (isSupported(base)) {
      return base;
    }
  }

  return FALLBACK_LANGUAGE;
}

void i18next.use(initReactI18next).init({
  resources,
  lng: resolveDeviceLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  returnNull: false,

  // React Native has no innerHTML, so i18next's HTML escaping only corrupts
  // legitimate characters in interpolated user names.
  interpolation: { escapeValue: false },
});

export { i18next };
