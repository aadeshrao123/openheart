import '@/global.css';
import '@/lib/i18n';

import { useEffect } from 'react';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppErrorView } from '@/components/app-error-view';
import { VersionGate } from '@/components/version-gate';
import { restoreLanguagePreference } from '@/hooks/use-language';
import { useSystemTheme } from '@/hooks/use-system-theme';

// expo-router finds a route's error UI through a named ErrorBoundary export.
// On the root layout that puts a single boundary over every screen in the app.
export { AppErrorView as ErrorBoundary };

// Outside the component so a re-render never discards the cache.
const queryClient = new QueryClient();

// react-navigation paints the scene background from its own JavaScript theme,
// which knows nothing about global.css. Its default is a light grey that sits
// underneath every Screen and shows through in dark mode and during
// transitions. Handing the job back to Screen's bg-bg keeps global.css the only
// place a colour is defined; "transparent" is the absence of a colour rather
// than a hardcoded one, so no token is being bypassed here.
const transparentNavigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: 'transparent' },
};

// Files under app/ are the one place this codebase uses a default export. The
// router requires one to identify a route component, so the named-exports-only
// rule in typescript-react.md cannot apply here.
export default function RootLayout() {
  useSystemTheme();

  // i18next resolves the device locale synchronously at import, so a stored
  // override can only be applied afterwards.
  useEffect(() => {
    void restoreLanguagePreference();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider value={transparentNavigationTheme}>
          <VersionGate>
            <Stack screenOptions={{ headerShown: false }} />
          </VersionGate>
        </ThemeProvider>

        {/* auto tracks the resolved theme, so the clock and battery stay
            readable when the system flips to dark. */}
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
