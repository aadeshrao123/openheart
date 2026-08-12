// Token names shared by tailwind.config.js, which turns them into utilities, and
// lib/cn.ts, which needs them so tailwind-merge can tell a font size from a text
// colour and can see two radii as conflicting. Colours are absent: their class
// names are Tailwind's own groups and already resolve.

// React Native does not synthesize weights, so each one is its own family.
// Named by role rather than by weight: "medium" would collide with Tailwind's
// own font-medium weight utility.
//
// These five are the brand faces and they cover Latin only: their cmap tables
// carry 624 codepoints (Fraunces) and 343 (Instrument Sans), with no Arabic,
// Devanagari, Bengali or Han glyph in either. A component never names one of
// these directly - lib/typeface.ts decides whether the reader's script is one
// they can draw, and hands back the platform font when it is not. Adding a face
// for another script means a family here and one entry there.
const fontFamily = {
  display: ['Fraunces_600SemiBold'],
  quote: ['Fraunces_500Medium_Italic'],
  body: ['InstrumentSans_400Regular'],
  emphasis: ['InstrumentSans_500Medium'],
  strong: ['InstrumentSans_600SemiBold'],
};

const fontSize = {
  display: ['40px', { lineHeight: '44px', letterSpacing: '-1px' }],
  title: ['27px', { lineHeight: '32px', letterSpacing: '-0.5px' }],
  heading: ['19px', { lineHeight: '26px', letterSpacing: '-0.2px' }],
  body: ['16px', { lineHeight: '25px' }],
  label: ['14px', { lineHeight: '20px' }],
  caption: ['12.5px', { lineHeight: '18px' }],
  overline: ['11px', { lineHeight: '14px', letterSpacing: '1.2px' }],
  monogram: ['64px', { lineHeight: '68px' }],
};

const borderRadius = {
  card: 'var(--radius-card)',
  control: 'var(--radius-control)',
  bubble: 'var(--radius-bubble)',
  tail: 'var(--radius-tail)',
};

module.exports = { fontFamily, fontSize, borderRadius };
