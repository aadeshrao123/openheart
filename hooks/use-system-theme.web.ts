import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { colorScheme } from 'nativewind';

// Web does not follow the system on its own. With darkMode: "class",
// NativeWind's web runtime seeds its observable from whether the "dark" class
// is already on <html> at load, which resolves to "light" when it is absent,
// and that non-undefined value means the system fallback never applies. The
// class is only ever added by colorScheme.set(), so without this hook a user
// whose OS is dark gets the light theme.
// Source: react-native-css-interop/dist/runtime/web/color-scheme.js
//
// react-native-web implements Appearance over
// matchMedia('(prefers-color-scheme: dark)'), so useColorScheme() is a live
// subscription to the OS setting rather than a one-off read.
export function useSystemTheme(): void {
  const scheme = useColorScheme();

  // In an effect, not in render: static export runs this module without a
  // window, and colorScheme.set() throws when there is no document to put the
  // class on.
  useEffect(() => {
    // react-native-web only ever yields "light" or "dark", but React Native's
    // ColorSchemeName also admits "unspecified", which means "follow the
    // system" and is what the media query already resolved for us.
    colorScheme.set(scheme === 'dark' ? 'dark' : 'light');
  }, [scheme]);
}
