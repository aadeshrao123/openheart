export type DirectionChange = 'unchanged' | 'needs-restart';

// react-native-web's I18nManager is a stub. allowRTL and forceRTL have empty
// bodies and getConstants always reports isRTL false, so the native path cannot
// flip anything here. Verified in
// node_modules/react-native-web/dist/exports/I18nManager/index.js.
//
// What does work is the dir attribute. NativeWind compiles ps- pe- ms- me-
// border-s- and the rest to CSS logical properties, and flex-row follows the
// inline axis, so the browser mirrors the layout itself the moment dir changes.
// Measured on the real export: border-s-2 moved from border-left 2px to
// border-right 2px, and ps-5 from padding-left to padding-right, with no
// reload. That is why this returns unchanged rather than needs-restart.
//
// lang is set alongside it because a screen reader picks its voice from that
// attribute, and the browser picks a font for a script it has no glyphs for the
// same way.
export function applyLanguageDirection(language: string, rtl: boolean): DirectionChange {
  // Absent during the static export, which renders in Node.
  if (typeof document === 'undefined') {
    return 'unchanged';
  }

  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  document.documentElement.lang = language;

  return 'unchanged';
}
