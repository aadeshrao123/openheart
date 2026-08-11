import { I18nManager } from 'react-native';

export type DirectionChange = 'unchanged' | 'needs-restart';

// Native layout direction is a native-side flag, not a style. React Native
// reads it once while laying out, so flipping it takes effect on the next
// launch and there is no API here that can force one: expo-updates is not
// installed, and DevSettings.reload only exists in development. The caller has
// to tell the user, which is why this reports back rather than returning void.
//
// The language argument is unused here and carried for the web build, where it
// becomes the lang attribute.
export function applyLanguageDirection(language: string, rtl: boolean): DirectionChange {
  void language;

  I18nManager.allowRTL(true);

  if (I18nManager.isRTL === rtl) {
    return 'unchanged';
  }

  I18nManager.forceRTL(rtl);

  return 'needs-restart';
}
