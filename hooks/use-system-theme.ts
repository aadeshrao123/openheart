// NativeWind already follows the device on native. Calling colorScheme.set()
// here would write an Appearance override and pin the theme to whatever it was
// at launch. The web build has the opposite problem and gets its own file.
export function useSystemTheme(): void {}
