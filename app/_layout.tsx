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
import { useAuthSync } from '@/hooks/use-session';
import { useSystemTheme } from '@/hooks/use-system-theme';

// expo-router finds a route's error UI through a named ErrorBoundary export.
// On the root layout that puts a single boundary over every screen in the app.
export { AppErrorView as ErrorBoundary };

// Outside the component so a re-render never discards the cache.
const queryClient = new QueryClient();

// react-navigation paints from its own JavaScript theme, whose default light
// grey sat under every screen and showed through in dark mode. Transparent hands
// the job back to Screen, so global.css stays the only place a colour lives.
const transparentNavigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: 'transparent' },
};

// Files under app/ are the one place this codebase uses a default export: the
// router requires one to identify a route component.
export default function RootLayout() {
  // Touches no context. Anything needing the query client goes in RootNavigator.
  useSystemTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

// Split out so its hooks run underneath QueryClientProvider: a hook in the body
// of the component that renders a provider is above it, not inside it.
function RootNavigator() {
  useAuthSync();

  // i18next resolves the device locale synchronously at import, so a stored
  // override can only be applied afterwards.
  useEffect(() => {
    void restoreLanguagePreference();
  }, []);

  return (
    <ThemeProvider value={transparentNavigationTheme}>
      <VersionGate>
        <Stack screenOptions={{ headerShown: false }} />
      </VersionGate>

      {/* auto tracks the resolved theme, so the clock and battery stay
          readable when the system flips to dark. */}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
