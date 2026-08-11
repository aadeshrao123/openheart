import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  isRtlLanguage,
  isSupportedLanguage,
  type Language,
} from '@/lib/i18n';
import { applyLanguageDirection } from '@/lib/text-direction';

const STORAGE_KEY = 'openheart.language';

// i18next initialises synchronously from the device locale, so a saved override
// has to be applied afterwards. Call this once during app startup.
//
// The direction is applied whether or not an override was saved, because the
// device language can be an RTL one on a first run with nothing stored.
export async function restoreLanguagePreference(): Promise<void> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  const { i18next } = await import('@/lib/i18n');

  if (saved && isSupportedLanguage(saved)) {
    await i18next.changeLanguage(saved);
  }

  const language = i18next.language;

  applyLanguageDirection(language, isRtlLanguage(language));
}

export function useLanguage() {
  const { i18n } = useTranslation();

  // Only ever true on native, where the layout direction is a native flag read
  // once at launch. On web the browser re-mirrors immediately and this stays
  // false.
  const [needsRestart, setNeedsRestart] = useState(false);

  const setLanguage = useCallback(
    async (language: Language) => {
      await i18n.changeLanguage(language);
      await AsyncStorage.setItem(STORAGE_KEY, language);

      const change = applyLanguageDirection(language, isRtlLanguage(language));

      setNeedsRestart(change === 'needs-restart');
    },
    [i18n],
  );

  const current = isSupportedLanguage(i18n.language) ? i18n.language : FALLBACK_LANGUAGE;

  return {
    current,
    available: SUPPORTED_LANGUAGES,
    needsRestart,
    setLanguage,
  };
}
