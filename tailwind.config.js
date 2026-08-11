// Maps token names onto the CSS variables declared in global.css. Nothing here
// holds a colour value: this file decides what the utility classes are called,
// global.css decides what they look like.

/** @type {import('tailwindcss').Config} */

const token = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

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

      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
      },

      fontSize: {
        display: ['34px', { lineHeight: '40px', fontWeight: '700' }],
        title: ['24px', { lineHeight: '30px', fontWeight: '700' }],
        heading: ['18px', { lineHeight: '24px', fontWeight: '600' }],
        body: ['16px', { lineHeight: '24px' }],
        label: ['14px', { lineHeight: '20px', fontWeight: '500' }],
        caption: ['12px', { lineHeight: '16px' }],
      },
    },
  },
  plugins: [],
};
