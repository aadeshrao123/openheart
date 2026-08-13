import '@/global.css';
import '@/lib/i18n';

import { useEffect } from 'react';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Head from 'expo-router/head';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppErrorView } from '@/components/app-error-view';
import { VersionGate } from '@/components/version-gate';
import { restoreLanguagePreference } from '@/hooks/use-language';
import { restoreSoundPreference } from '@/hooks/use-sound-preference';
import { useAuthSync } from '@/hooks/use-session';
import { useSystemTheme } from '@/hooks/use-system-theme';
import { APP_NAME } from '@/lib/app';
import { appFonts } from '@/lib/fonts';
import { screenTransition } from '@/lib/screen-transitions';
import { useReducedMotion } from '@/lib/use-reduced-motion';

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

  const [fontsReady, fontError] = useFonts(appFonts);

  // Holding the first paint avoids the flash from system font to Fraunces.
  // A font that failed to load is not worth blocking on.
  if (!fontsReady && !fontError) {
    return null;
  }

  return (
    // Outermost, and required: without it a pan gesture is silently never
    // recognised on native, which looks exactly like a broken deck rather than
    // a missing provider.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <RootNavigator />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

// Split out so its hooks run underneath QueryClientProvider: a hook in the body
// of the component that renders a provider is above it, not inside it.
function RootNavigator() {
  useAuthSync();

  const reduceMotion = useReducedMotion();

  // i18next resolves the device locale synchronously at import, so a stored
  // override can only be applied afterwards.
  useEffect(() => {
    void restoreLanguagePreference();
    void restoreSoundPreference();
  }, []);

  return (
    <ThemeProvider value={transparentNavigationTheme}>
      {/* The only thing that can set the browser tab title. The static export
          prepends react-helmet's tags directly after <head>, ahead of anything
          app/+html.tsx renders, and helmet emits an empty <title> whether or
          not one was set. An empty first title is the one the browser uses, so
          without this the tab is blank however many titles follow it. */}
      <Head>
        <title>{APP_NAME}</title>
      </Head>

      <VersionGate>
        {/* The screens of this stack are the auth, onboarding and app groups,
            and a move between them is never something the user asked for
            directly: a gate decided, and a back gesture across that boundary
            would be redirected straight back. A cross fade says the ground
            changed without promising a way to reverse it. */}
        <Stack
          screenOptions={{ headerShown: false, ...screenTransition('switch', reduceMotion) }}
        />
      </VersionGate>

      {/* auto tracks the resolved theme, so the clock and battery stay
          readable when the system flips to dark. */}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
