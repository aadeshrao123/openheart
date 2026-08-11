// Token names that two consumers need in different forms, defined once so they
// cannot drift apart.
//
// tailwind.config.js turns these into the utility classes components use.
// lib/cn.ts needs only the names, because tailwind-merge recognises Tailwind's
// own scales and nothing else. An unfamiliar text-* or rounded-* class is
// either filed under the wrong group or under no group at all, and in both
// cases cn() silently produces the wrong answer.
//
// Colours are deliberately absent. Their names are Tailwind's own groups, which
// tailwind-merge already resolves correctly, and their values belong in
// global.css and nowhere else.
//
// CommonJS because tailwind.config.js is loaded by the Tailwind CLI, which does
// not accept ESM at this path.

// Sizes and weights, since Tailwind has no variable indirection for them.
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
