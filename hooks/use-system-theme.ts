// Native needs no work. NativeWind's colorScheme observable starts undefined
// and falls back to the system observable, which is seeded from
// Appearance.getColorScheme() and updated by an Appearance change listener.
// The theme therefore already follows the device.
//
// Calling colorScheme.set() here would be actively wrong: on native it calls
// Appearance.setColorScheme(), which is an override. Once set, the OS theme no
// longer reaches the app and the theme is pinned to whatever it was at launch.
// Source: react-native-css-interop/dist/runtime/native/appearance-observables.js
//
// The web build has the opposite problem and gets its own file.
export function useSystemTheme(): void {}
