/// <reference types="node" />

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import languageNames from '@/locales/languages.json';

// A key missing from a bundle does not fail. i18next falls back to English and
// the screen shows one English sentence in the middle of nine translated ones,
// which nobody notices until a reader does. The same is true of a plural form:
// i18next asks for the suffix its CLDR rules name, and a bundle that does not
// have that exact set silently renders the raw key or the wrong form.

const ROOT = path.resolve(import.meta.dirname, '..');
const LOCALES = path.join(ROOT, 'locales');

const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

// En dash, em dash, the four curly quotes and the ellipsis: typography no
// language needs and that CI rejects across every bundle. Then the
// bidirectional controls, which are worse than they look. One embedded in a
// string escapes the element it was meant for and reorders text elsewhere on
// the screen, and it is invisible in every editor.
//
// Written as escapes because this file is held to the same ASCII rule.
const BANNED_TYPOGRAPHY = /[\u2013\u2014\u2018\u2019\u201c\u201d\u2026]/;
const BIDI_CONTROLS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/;

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

type Bundle = { [key: string]: string | Bundle };

function flatten(bundle: Bundle, prefix = ''): Map<string, string> {
  const flat = new Map<string, string>();

  for (const [key, value] of Object.entries(bundle)) {
    const full = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      flat.set(full, value);
      continue;
    }

    for (const [nested, nestedValue] of flatten(value, full)) {
      flat.set(nested, nestedValue);
    }
  }

  return flat;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(PLACEHOLDER)].map((match) => match[1]).sort();
}

const english = flatten(en);

// A plural base is a key with both an _one and an _other form in English. Any
// other key that happens to end in a category word is left alone.
const PLURAL_BASES = [...english.keys()]
  .filter((key) => key.endsWith('_one') && english.has(`${key.slice(0, -4)}_other`))
  .map((key) => key.slice(0, -4));

const SINGULAR_KEYS = [...english.keys()].filter(
  (key) => !PLURAL_BASES.some((base) => PLURAL_CATEGORIES.some((c) => key === `${base}_${c}`)),
);

const TAGS = readdirSync(LOCALES)
  .filter((file) => file.endsWith('.json') && file !== 'languages.json')
  .map((file) => file.slice(0, -'.json'.length))
  .sort();

function load(tag: string): Map<string, string> {
  return flatten(JSON.parse(readFileSync(path.join(LOCALES, `${tag}.json`), 'utf8')) as Bundle);
}

// What i18next will actually ask for, from the same Intl.PluralRules it uses.
function categoriesFor(tag: string): string[] {
  return [...new Intl.PluralRules(tag).resolvedOptions().pluralCategories].sort();
}

describe('locale bundles', () => {
  it('ships the languages the picker names, and no others', () => {
    expect(TAGS).toEqual(Object.keys(languageNames).sort());
  });

  it('found the plural keys it is about to check', () => {
    expect(PLURAL_BASES.length).toBeGreaterThan(0);
    expect(SINGULAR_KEYS.length).toBeGreaterThan(150);
  });

  describe.each(TAGS)('%s', (tag) => {
    const bundle = load(tag);
    const categories = categoriesFor(tag);

    const expected = [
      ...SINGULAR_KEYS,
      ...PLURAL_BASES.flatMap((base) => categories.map((category) => `${base}_${category}`)),
    ].sort();

    it('has exactly the keys English has, in this language plural forms', () => {
      expect([...bundle.keys()].sort()).toEqual(expected);
    });

    // A placeholder the source does not have renders as literal braces on
    // screen, and a dropped one loses whatever it carried. Both are checked,
    // but plural forms need the looser rule: English says "The last message in
    // this conversation is attached" for one and "The last {{count}} messages"
    // for the rest, so a singular form legitimately has no count in it.
    it('carries the same interpolation variables as English', () => {
      const mismatched: string[] = [];

      for (const [key, value] of bundle) {
        const base = PLURAL_BASES.find((candidate) =>
          PLURAL_CATEGORIES.some((category) => key === `${candidate}_${category}`),
        );

        const source = base ? english.get(`${base}_other`) : english.get(key);

        if (source === undefined) {
          continue;
        }

        const allowed = placeholders(source);
        const used = placeholders(value);
        const invented = used.filter((name) => !allowed.includes(name));
        const required = base ? allowed.filter((name) => name !== 'count') : allowed;
        const dropped = required.filter((name) => !used.includes(name));

        if (invented.length > 0 || dropped.length > 0) {
          mismatched.push(`${key}: invented ${invented}, dropped ${dropped}`);
        }
      }

      expect(mismatched).toEqual([]);
    });

    it('uses no dash, curly quote or ellipsis character', () => {
      const offending = [...bundle]
        .filter(([, value]) => BANNED_TYPOGRAPHY.test(value))
        .map(([key]) => key);

      expect(offending).toEqual([]);
    });

    it('embeds no bidirectional control characters', () => {
      const offending = [...bundle]
        .filter(([, value]) => BIDI_CONTROLS.test(value))
        .map(([key]) => key);

      expect(offending).toEqual([]);
    });

    it('leaves the product name untranslated', () => {
      const missing = [...bundle]
        .filter(([key]) => english.get(key)?.includes('OpenHeart'))
        .filter(([, value]) => !value.includes('OpenHeart'))
        .map(([key]) => key);

      expect(missing).toEqual([]);
    });
  });
});

// The bundles above are only correct if the engine agrees with CLDR about which
// forms exist. Hermes ships no Intl.PluralRules at all, and i18next's fallback
// for that is a silent two-form rule, so the polyfill is what makes every
// category above reachable on a phone. Asserting the import exists is the only
// way to catch its removal: Node has full ICU, so every other test in this file
// passes with or without it.
describe('plural rule support', () => {
  const source = readFileSync(path.join(ROOT, 'lib', 'i18n.ts'), 'utf8');

  it('polyfills Intl.PluralRules before importing i18next', () => {
    const polyfill = source.indexOf('@formatjs/intl-pluralrules/polyfill.js');
    const i18next = source.indexOf("from 'i18next'");

    expect(polyfill).toBeGreaterThan(-1);
    expect(polyfill).toBeLessThan(i18next);
  });

  it('loads plural data for every language it ships', () => {
    const missing = Object.keys(languageNames)
      // There is no zh-Hans data file; the matcher resolves it to zh.
      .map((tag) => (tag === 'zh-Hans' ? 'zh' : tag))
      .filter((tag) => !source.includes(`intl-pluralrules/locale-data/${tag}.js`));

    expect(missing).toEqual([]);
  });
});
