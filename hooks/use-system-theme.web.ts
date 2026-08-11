import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { colorScheme } from 'nativewind';

// Web does not follow the system on its own: with darkMode "class" NativeWind
// seeds from whether the dark class is already on <html>, which resolves to
// light when it is absent, so the system fallback never applies.
export function useSystemTheme(): void {
  const scheme = useColorScheme();

  // In an effect because static export runs this without a window, and
  // colorScheme.set() throws when there is no document to put the class on.
  useEffect(() => {
    colorScheme.set(scheme === 'dark' ? 'dark' : 'light');
  }, [scheme]);
}
