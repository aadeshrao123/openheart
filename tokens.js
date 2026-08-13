// Token names shared by tailwind.config.js, which turns them into utilities, and
// lib/cn.ts, which needs them so tailwind-merge can tell a font size from a text
// colour and can see two radii as conflicting. Colours are absent: their class
// names are Tailwind's own groups and already resolve.

// React Native does not synthesize weights, so each one is its own family.
// Named by role rather than by weight: "medium" would collide with Tailwind's
// own font-medium weight utility.
//
// One family across all five roles, and that is the point. This was a Fraunces
// and Instrument Sans pairing: a display serif with a deliberate wobble in its
// outlines over a narrow grotesque set at a tight line height. Two voices, both
// with opinions, and long body copy underneath them was tiring to read rather
// than characterful. Plus Jakarta Sans has open apertures and a tall x-height,
// and the weight range from 400 to 800 carries the whole hierarchy on its own.
//
// It covers Latin only: 721 codepoints, with no Arabic, Devanagari, Bengali,
// Han or even Cyrillic glyph, measured off the cmap table rather than assumed.
// A component never names one of these directly - lib/typeface.ts decides
// whether the reader's script is one it can draw and hands back the platform
// font when it is not. Adding a face for another script means a family here and
// one entry there.
const fontFamily = {
  display: ['PlusJakartaSans_800ExtraBold'],
  quote: ['PlusJakartaSans_500Medium_Italic'],
  body: ['PlusJakartaSans_400Regular'],
  emphasis: ['PlusJakartaSans_500Medium'],
  strong: ['PlusJakartaSans_600SemiBold'],
};

// Tracking tightens as the size grows, which is the normal correction: letter
// spacing that reads as generous at 16px reads as loose at 64px.
const fontSize = {
  // The landing page headline on a wide window, and nowhere else. Display is
  // what it falls back to below that breakpoint.
  hero: ['64px', { lineHeight: '66px', letterSpacing: '-2.6px' }],
  display: ['40px', { lineHeight: '44px', letterSpacing: '-1.4px' }],
  title: ['27px', { lineHeight: '34px', letterSpacing: '-0.7px' }],
  heading: ['19px', { lineHeight: '26px', letterSpacing: '-0.3px' }],
  // 26, not 25. Body copy is the thing being read for longest and the extra
  // leading is the cheapest comfort available.
  body: ['16px', { lineHeight: '26px' }],
  label: ['14px', { lineHeight: '20px' }],
  caption: ['12.5px', { lineHeight: '18px' }],
  overline: ['11px', { lineHeight: '14px', letterSpacing: '1.1px' }],
  monogram: ['64px', { lineHeight: '68px' }],
};

const borderRadius = {
  card: 'var(--radius-card)',
  control: 'var(--radius-control)',
  bubble: 'var(--radius-bubble)',
  tail: 'var(--radius-tail)',
};

const keyframes = {
  'fade-up': {
    from: { opacity: '0', transform: 'translateY(18px)' },
    to: { opacity: '1', transform: 'translateY(0)' },
  },
  'fade-in': {
    from: { opacity: '0' },
    to: { opacity: '1' },
  },
  drift: {
    '0%, 100%': { transform: 'translateY(0px)' },
    '50%': { transform: 'translateY(-12px)' },
  },
  // The opacity here is the value, not a multiplier on the class beside it: an
  // animated property overrides the static one for as long as it runs, so
  // opacity-20 on the element only ever applies under reduced motion, where
  // this animation is not attached at all. Written low for that reason.
  breathe: {
    '0%, 100%': { opacity: '0.15', transform: 'scale(1)' },
    '50%': { opacity: '0.3', transform: 'scale(1.12)' },
  },
  beat: {
    '0%, 100%': { transform: 'scale(1)' },
    '15%': { transform: 'scale(1.14)' },
    '30%': { transform: 'scale(1)' },
    '45%': { transform: 'scale(1.09)' },
  },
};

// A slow ease-out with a long tail. Content should arrive settled rather than
// snap into place, which is the difference between motion and a flicker.
const ARRIVE = '620ms cubic-bezier(0.22, 1, 0.36, 1) both';

// The delay is in the name. Five steps is the most any one view uses, and a
// sixth element should join an existing step rather than extend the sequence,
// because past about half a second the last item reads as broken rather than
// choreographed.
const animation = {
  'fade-up': `fade-up ${ARRIVE}`,
  'fade-up-1': `fade-up ${ARRIVE} 80ms`,
  'fade-up-2': `fade-up ${ARRIVE} 160ms`,
  'fade-up-3': `fade-up ${ARRIVE} 240ms`,
  'fade-up-4': `fade-up ${ARRIVE} 320ms`,
  'fade-up-5': `fade-up ${ARRIVE} 400ms`,
  'fade-in': 'fade-in 900ms ease-out both',
  'fade-in-slow': 'fade-in 1400ms ease-out both',
  drift: 'drift 7s ease-in-out infinite',
  'drift-slow': 'drift 9s ease-in-out infinite',
  breathe: 'breathe 11s ease-in-out infinite',
  beat: 'beat 2.6s ease-in-out infinite',
};

module.exports = { fontFamily, fontSize, borderRadius, keyframes, animation };
