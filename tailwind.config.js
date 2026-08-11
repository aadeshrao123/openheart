// Maps token names onto the CSS variables declared in global.css. Nothing here
// holds a colour value: this file decides what the utility classes are called,
// global.css decides what they look like.

/** @type {import('tailwindcss').Config} */

const token = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

// Shared with lib/cn.ts, which needs these names so tailwind-merge can tell a
// font size from a text colour and can see two radii as conflicting. Editing
// them here alone would break className overrides silently. See tokens.js.
const tokens = require('./tokens');

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
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

        danger: {
          DEFAULT: token('--danger'),
          subtle: token('--danger-subtle'),
        },

        success: token('--success'),
        warning: token('--warning'),
        like: token('--like'),
        pass: token('--pass'),
      },

      borderRadius: tokens.borderRadius,

      fontSize: tokens.fontSize,
    },
  },
  plugins: [],
};
