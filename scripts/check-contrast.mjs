// Reads the token values out of global.css and checks the contrast of every
// foreground/background pair the app actually renders, in both themes.
//
// Not the cross product of every token. A pair is listed here because it occurs
// in a real component, and the file and line it occurs at is recorded next to
// it, so a pair that stops being used can be deleted and a new one has to be
// added deliberately.
//
// Thresholds are WCAG 2.2. 1.4.3 Contrast (Minimum) is 4.5:1 for normal text
// and 3:1 for large text, where large means at least 18pt, or 14pt bold, which
// at the 96dpi CSS reference is 24px and 18.66px. 1.4.11 Non-text Contrast is
// 3:1 for the visual boundary of a control.
// https://www.w3.org/TR/WCAG22/#contrast-minimum
// https://www.w3.org/TR/WCAG22/#non-text-contrast
//
// Bold is taken as weight 700 or more, so the 18.66px route is unavailable
// here: the heaviest family in tokens.js is 600. Only the 24px rule applies,
// which is the conservative reading.
//
// Usage: node scripts/check-contrast.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// Comments are stripped first, and the light selector needs the lookbehind:
// global.css explains the dark block in prose, so a plain indexOf for ":root"
// finds the ".dark:root" inside that comment and both themes end up parsing the
// same block. The symptom is two identical columns of results.
function parseTheme(css, pattern) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = source.match(pattern);

  if (!block) {
    throw new Error(`no rule matched ${pattern}`);
  }

  const body = block[1];
  const tokens = {};

  for (const line of body.split('\n')) {
    const match = line.match(/--([a-z-]+):\s*([0-9]+)\s+([0-9]+)\s+([0-9]+)\s*;/);

    if (match) {
      tokens[match[1]] = [Number(match[2]), Number(match[3]), Number(match[4])];
    }
  }

  return tokens;
}

// https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
function relativeLuminance([r, g, b]) {
  const channel = (value) => {
    const s = value / 255;

    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
function contrast(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));

  return (lighter + 0.05) / (darker + 0.05);
}

// A translucent foreground is composited over its background before it is read,
// so the ratio has to be computed against what the eye receives, not against
// the nominal token.
function composite(foreground, background, alpha) {
  return foreground.map((channel, index) =>
    Math.round(channel * alpha + background[index] * (1 - alpha)),
  );
}

// px is the rendered size from tokens.js. kind is 'text' or 'graphic', where a
// graphic is a control boundary or an icon carrying meaning.
const PAIRS = [
  { fg: 'fg', bg: 'bg', px: 16, kind: 'text', where: 'components/ui/text.tsx body on Screen' },
  { fg: 'fg', bg: 'bg', px: 27, kind: 'text', where: 'Text title on Screen' },
  { fg: 'fg', bg: 'bg', px: 40, kind: 'text', where: 'Text display, sign-in' },
  { fg: 'fg-muted', bg: 'bg', px: 16, kind: 'text', where: 'Text tone muted on Screen' },
  { fg: 'fg-subtle', bg: 'bg', px: 12.5, kind: 'text', where: 'Text caption subtle' },
  { fg: 'fg-subtle', bg: 'bg', px: 11, kind: 'text', where: 'Text overline subtle' },
  { fg: 'brand', bg: 'bg', px: 14, kind: 'text', where: 'deck distance, home prompt' },
  { fg: 'accent', bg: 'bg', px: 11, kind: 'text', where: 'sign-in promise overline' },
  { fg: 'danger', bg: 'bg', px: 12.5, kind: 'text', where: 'form error captions' },

  { fg: 'fg', bg: 'surface', px: 16, kind: 'text', where: 'Card elevation flat' },
  { fg: 'fg-muted', bg: 'surface', px: 16, kind: 'text', where: 'Card flat, muted body' },
  { fg: 'fg-subtle', bg: 'surface', px: 12.5, kind: 'text', where: 'report-card evidence' },
  { fg: 'fg-muted', bg: 'surface', px: 14, kind: 'text', where: 'avatar initial, third tint' },

  { fg: 'fg', bg: 'surface-raised', px: 16, kind: 'text', where: 'Card raised, Input text' },
  { fg: 'fg-muted', bg: 'surface-raised', px: 16, kind: 'text', where: 'Button secondary' },
  { fg: 'fg-subtle', bg: 'surface-raised', px: 16, kind: 'text', where: 'Input placeholder' },
  { fg: 'fg', bg: 'surface-raised', px: 16, kind: 'text', where: 'message bubble, theirs' },
  { fg: 'fg-subtle', bg: 'surface-raised', px: 12.5, kind: 'text', where: 'bubble timestamp' },
  { fg: 'brand', bg: 'surface-raised', px: 19, kind: 'text', where: 'stepper +/- glyph' },

  { fg: 'fg-inverted', bg: 'brand', px: 14, kind: 'text', where: 'Button primary label' },
  { fg: 'fg-inverted', bg: 'brand', px: 16, kind: 'text', where: 'message bubble, mine' },
  { fg: 'fg-inverted', bg: 'brand', px: 11, kind: 'text', where: 'thread-row unread badge' },
  { fg: 'receipt-seen', bg: 'brand', px: 14, kind: 'graphic', where: 'read receipt tick' },
  {
    fg: 'fg-inverted',
    bg: 'brand',
    px: 12.5,
    kind: 'text',
    alpha: 0.9,
    where: 'message-bubble timestamp, opacity-90 on a brand bubble',
  },

  { fg: 'brand', bg: 'brand-subtle', px: 14, kind: 'text', where: 'Chip selected label' },
  { fg: 'brand', bg: 'brand-subtle', px: 14, kind: 'text', where: 'avatar initial, first tint' },
  { fg: 'brand', bg: 'brand-subtle', px: 64, kind: 'text', where: 'profile-card monogram' },
  { fg: 'accent', bg: 'accent-subtle', px: 14, kind: 'text', where: 'avatar initial, second tint' },
  { fg: 'danger', bg: 'danger-subtle', px: 14, kind: 'text', where: 'Button danger label' },

  {
    fg: 'border',
    bg: 'bg',
    kind: 'graphic',
    where: 'card outline, chat header rule, day divider',
    accepted:
      'Decoration, not identification. Nothing here is the only way to find a control: ' +
      'the day divider sits beside its own date label and the card outline separates two ' +
      'surfaces that already differ. 1.4.11 covers what is needed to identify a component.',
  },
  {
    fg: 'border',
    bg: 'surface-raised',
    kind: 'graphic',
    where: 'Input and Chip boundary',
    accepted:
      'The Input primitive always renders a visible label above the field and a placeholder ' +
      'inside it, and a Chip carries its own text, so neither control depends on its ' +
      'boundary to be found. Taking this hairline to 3:1 needs mid grey, which replaces a ' +
      'warm editorial surface with an outlined form and is a design decision, not a fix.',
  },
  { fg: 'brand', bg: 'surface-raised', kind: 'graphic', where: 'Chip selected boundary' },
  { fg: 'danger', bg: 'surface-raised', kind: 'graphic', where: 'Input error boundary' },
  { fg: 'accent', bg: 'bg', kind: 'graphic', where: 'Rail accent rule' },
  { fg: 'brand', bg: 'bg', kind: 'graphic', where: 'section rule, h-px w-12 bg-brand' },
  { fg: 'success', bg: 'bg', kind: 'graphic', where: 'swipe-deck Like badge border' },
  { fg: 'danger', bg: 'bg', kind: 'graphic', where: 'swipe-deck Pass badge border' },
];

function required(pair) {
  if (pair.kind === 'graphic') {
    return 3;
  }

  return pair.px >= 24 ? 3 : 4.5;
}

const css = readFileSync(path.join(ROOT, 'global.css'), 'utf8');

const themes = {
  light: parseTheme(css, /(?<![\w.-]):root\s*\{([^}]*)\}/),
  dark: parseTheme(css, /\.dark:root\s*\{([^}]*)\}/),
};

let failures = 0;
let accepted = 0;

for (const [theme, tokens] of Object.entries(themes)) {
  for (const pair of PAIRS) {
    const background = tokens[pair.bg];
    const nominal = tokens[pair.fg];

    if (!background || !nominal) {
      process.stdout.write(`MISSING TOKEN ${theme}: ${pair.fg} on ${pair.bg}\n`);
      failures += 1;
      continue;
    }

    const foreground = pair.alpha ? composite(nominal, background, pair.alpha) : nominal;
    const ratio = contrast(foreground, background);
    const need = required(pair);

    if (ratio < need && pair.accepted) {
      accepted += 1;
      process.stdout.write(
        `BELOW ${theme.padEnd(5)} ${ratio.toFixed(2)}:1 (nominal ${need}:1)  ` +
          `${pair.fg} on ${pair.bg}  ${pair.where}\n        ${pair.accepted}\n`,
      );
      continue;
    }

    if (ratio < need) {
      failures += 1;
      process.stdout.write(
        `FAIL ${theme.padEnd(5)} ${ratio.toFixed(2)}:1 (needs ${need}:1)  ` +
          `${pair.fg} on ${pair.bg}  ${pair.px ? pair.px + 'px  ' : ''}${pair.where}\n`,
      );
    }
  }
}

// The browser paints themeColor around the page before any CSS loads, so it is
// the one colour that cannot live in global.css. Asserted rather than commented,
// because it had already drifted a shade behind --bg.
const themeColor = JSON.parse(readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo.web.themeColor;
const expected = `#${themes.light.bg.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;

const drifted = themeColor.toLowerCase() !== expected;

if (drifted) {
  process.stdout.write(`FAIL  app.json themeColor is ${themeColor}, --bg is ${expected}\n`);
}

const checked = PAIRS.length * 2;

if (failures > 0) {
  process.stdout.write(`\n${failures} of ${checked} pairs below the WCAG 2.2 minimum.\n`);
}

if (failures > 0 || drifted) {
  process.exit(1);
}

process.stdout.write(
  `${checked} token pairs checked in two themes. ` +
    `${checked - accepted} meet WCAG 2.2, ${accepted} are listed above with a reason.\n`,
);
