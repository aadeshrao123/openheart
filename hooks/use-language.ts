import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES, type Language } from '@/lib/i18n';

const STORAGE_KEY = 'openheart.language';

function isSupported(value: string): value is Language {
  return value in SUPPORTED_LANGUAGES;
}

// i18next initialises synchronously from the device locale, so a saved override
// has to be applied afterwards. Call this once during app startup.
export async function restoreLanguagePreference(): Promise<void> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);

  if (saved && isSupported(saved)) {
    const { i18next } = await import('@/lib/i18n');
    await i18next.changeLanguage(saved);
  }
}

export function useLanguage() {
  const { i18n } = useTranslation();

  const setLanguage = useCallback(
    async (language: Language) => {
      await i18n.changeLanguage(language);
      await AsyncStorage.setItem(STORAGE_KEY, language);
    },
    [i18n],
  );

  const current = isSupported(i18n.language) ? i18n.language : FALLBACK_LANGUAGE;

  return {
    current,
    available: SUPPORTED_LANGUAGES,
    setLanguage,
  };
}
