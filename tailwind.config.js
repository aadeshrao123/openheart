// Maps token names onto the CSS variables declared in global.css. Nothing here
// holds a colour value: this file decides what the utility classes are called,
// global.css decides what they look like.

/** @type {import('tailwindcss').Config} */

const token = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

const tokens = require('./tokens');

module.exports = {
  // lib/ is scanned because lib/typeface.ts is where the font-* classes are
  // now written. Tailwind generates only the utilities it finds as literal
  // strings in these files, so a class named nowhere else compiles to nothing
  // and the text silently falls back to the platform font.
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: token('--bg'),
        border: token('--border'),

        surface: {
          DEFAULT: token('--surface'),
          raised: token('--surface-raised'),
        },

        fg: {
          DEFAULT: token('--fg'),
          muted: token('--fg-muted'),
          subtle: token('--fg-subtle'),
          inverted: token('--fg-inverted'),
        },

        brand: {
          DEFAULT: token('--brand'),
          pressed: token('--brand-pressed'),
          subtle: token('--brand-subtle'),
        },

        accent: {
          DEFAULT: token('--accent'),
          subtle: token('--accent-subtle'),
        },

        danger: {
          DEFAULT: token('--danger'),
          subtle: token('--danger-subtle'),
        },

        success: token('--success'),
        warning: token('--warning'),
        like: token('--like'),
        pass: token('--pass'),
        'receipt-seen': token('--receipt-seen'),
        shadow: token('--shadow-ambient'),
      },

      borderRadius: tokens.borderRadius,
      fontFamily: tokens.fontFamily,
      fontSize: tokens.fontSize,

      aspectRatio: {
        card: '4 / 5',
      },

      spacing: {
        13: '52px',
        15: '60px',
      },

      // A readable measure on a wide monitor. Without it the app stretches to
      // whatever the window is and the eye has to travel the whole width.
      maxWidth: {
        content: '560px',
        deck: '460px',
        // A bubble never reaches the far edge, so the two sides of a
        // conversation stay visually distinct without needing a tail.
        bubble: '78%',
      },
    },
  },
  plugins: [],
};
