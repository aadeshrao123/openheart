import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setSoundsMuted } from '@/lib/sounds';

const STORAGE_KEY = 'openheart.sounds_muted';

// Stored as the mute rather than the enable, so nothing stored and a value that
// does not parse both land on sounds being on.
export function isMutedValue(stored: string | null): boolean {
  return stored === 'true';
}

// Called once at startup, next to restoreLanguagePreference. The flag lives in
// lib/sounds.ts because playSound is called from places that are not components.
export async function restoreSoundPreference(): Promise<void> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);

  setSoundsMuted(isMutedValue(stored));
}

export function useSoundPreference() {
  const [muted, setMuted] = useState(false);

  // The startup restore writes the module flag, not React state, so without
  // this the switch renders as its default until touched.
  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      setMuted(isMutedValue(stored));
    });
  }, []);

  const toggle = useCallback(() => {
    setMuted((current) => {
      const next = !current;

      setSoundsMuted(next);
      void AsyncStorage.setItem(STORAGE_KEY, String(next));

      return next;
    });
  }, []);

  return { muted, toggle };
}
