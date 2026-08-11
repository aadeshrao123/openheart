// Token names shared by tailwind.config.js, which turns them into utilities, and
// lib/cn.ts, which needs them so tailwind-merge can tell a font size from a text
// colour and can see two radii as conflicting. Defining them twice is what makes
// cn() silently wrong.
//
// Colours are absent on purpose: their class names are Tailwind's own groups,
// and their values belong in global.css.
//
// CommonJS because the Tailwind CLI loads tailwind.config.js.

const fontSize = {
  display: ['34px', { lineHeight: '40px', fontWeight: '700' }],
  title: ['24px', { lineHeight: '30px', fontWeight: '700' }],
  heading: ['18px', { lineHeight: '24px', fontWeight: '600' }],
  body: ['16px', { lineHeight: '24px' }],
  label: ['14px', { lineHeight: '20px', fontWeight: '500' }],
  caption: ['12px', { lineHeight: '16px' }],
};

// Names only. The lengths live in global.css with everything else visual.
const borderRadius = {
  card: 'var(--radius-card)',
  control: 'var(--radius-control)',
};

module.exports = { fontSize, borderRadius };
