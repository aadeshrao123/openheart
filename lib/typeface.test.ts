import { describe, expect, it } from 'vitest';
import { typefaceForLanguage } from './typeface';
import languageNames from '@/locales/languages.json';
import tokens from '@/tokens';

// The bug this guards against is invisible in review and in English. A language
// whose script the brand faces cannot draw gets the brand face anyway for the
// Latin characters in a line and a platform fallback for the rest, and only a
// reader of that language sees it.

const ROLES = ['display', 'quote', 'body', 'emphasis', 'strong'] as const;

// Every language that ships a bundle, and what it is written in.
const BRAND_LANGUAGES = ['en', 'es', 'fr', 'pt', 'id'];
const PLATFORM_LANGUAGES = ['zh-Hans', 'hi', 'bn', 'ar', 'ur'];

// font-display and friends name a family, font-semibold and italic do not.
const FAMILY_CLASS = new RegExp(`font-(${Object.keys(tokens.fontFamily).join('|')})\\b`);
const WEIGHT_OR_STYLE_CLASS = /font-(normal|medium|semibold|bold|extrabold)\b|\bitalic\b/;

// What the family names in tokens.js say about weight and slant. React Native
// does not synthesize weights, so a brand face spells both out:
// PlusJakartaSans_800ExtraBold, PlusJakartaSans_500Medium_Italic.
const WEIGHT_CLASSES: Readonly<Partial<Record<string, string>>> = {
  '400': 'font-normal',
  '500': 'font-medium',
  '600': 'font-semibold',
  '700': 'font-bold',
  '800': 'font-extrabold',
};

function expectedPlatformClasses(role: (typeof ROLES)[number]): string {
  const families: Readonly<Partial<Record<string, string[]>>> = tokens.fontFamily;
  const family = families[role]?.[0] ?? '';
  const weight = WEIGHT_CLASSES[family.match(/_(\d{3})/)?.[1] ?? ''];

  expect(weight).toBeDefined();

  return family.endsWith('_Italic') ? `${weight} italic` : `${weight}`;
}

describe('typefaceForLanguage', () => {
  it('covers exactly the languages the app ships', () => {
    expect([...BRAND_LANGUAGES, ...PLATFORM_LANGUAGES].sort()).toEqual(
      Object.keys(languageNames).sort(),
    );
  });

  it('sets a Latin script language in the brand faces', () => {
    for (const language of BRAND_LANGUAGES) {
      expect(typefaceForLanguage(language)).toEqual({
        display: 'font-display',
        quote: 'font-quote',
        body: 'font-body',
        emphasis: 'font-emphasis',
        strong: 'font-strong',
      });
    }
  });

  // Not "some other family": no family at all. Naming one would be naming a
  // font file the app does not bundle.
  it('names no family for a script the brand faces cannot draw', () => {
    for (const language of PLATFORM_LANGUAGES) {
      for (const role of ROLES) {
        expect(typefaceForLanguage(language)[role]).not.toMatch(FAMILY_CLASS);
      }
    }
  });

  // The regression this pins: a brand family carries its weight and its slant
  // inside the family name, so dropping the family dropped the hierarchy with
  // it and every role rendered at 400 upright. The expected weight is derived
  // from the family in tokens.js rather than written out, so swapping a brand
  // face for a different cut fails here instead of silently flattening five of
  // ten languages.
  it('keeps the weight and the slant the brand family encodes', () => {
    for (const language of PLATFORM_LANGUAGES) {
      for (const role of ROLES) {
        expect(typefaceForLanguage(language)[role]).toBe(expectedPlatformClasses(role));
      }
    }
  });

  // Whole interface or nothing. A mixed set would put two typefaces on one
  // screen, which is the milder version of the same bug.
  it('answers every role from one set', () => {
    for (const language of [...BRAND_LANGUAGES, ...PLATFORM_LANGUAGES]) {
      const typeface = typefaceForLanguage(language);
      const families = ROLES.filter((role) => FAMILY_CLASS.test(typeface[role]));

      expect(families.length === 0 || families.length === ROLES.length).toBe(true);
    }
  });

  // A weight utility next to a family that already encodes one is a second,
  // independent weight request on that face. tailwind-merge files the two in
  // different groups and will not strip either, so it has to not be written.
  it('never pairs a weight with a brand family', () => {
    for (const language of BRAND_LANGUAGES) {
      for (const role of ROLES) {
        expect(typefaceForLanguage(language)[role]).not.toMatch(WEIGHT_OR_STYLE_CLASS);
      }
    }
  });

  // An unknown tag is an unknown script, and the platform font is the only one
  // that can be relied on to draw it.
  it('falls back to the platform font for a tag it does not know', () => {
    for (const language of ['ja', 'ko', 'ru', 'th', 'xx-YY', '']) {
      expect(typefaceForLanguage(language)).toEqual(typefaceForLanguage('ar'));
    }
  });

  // i18next reports whatever tag it was given, and a device can offer a
  // regional or script-qualified one.
  it('resolves a regional tag like its base language', () => {
    expect(typefaceForLanguage('pt-BR')).toEqual(typefaceForLanguage('pt'));
    expect(typefaceForLanguage('en-US')).toEqual(typefaceForLanguage('en'));
    expect(typefaceForLanguage('zh-Hant')).toEqual(typefaceForLanguage('zh-Hans'));
    expect(typefaceForLanguage('AR')).toEqual(typefaceForLanguage('ar'));
  });

  // The class names are literals so Tailwind's scanner can see them, which
  // means nothing keeps them in step with the token names except this.
  it('names only classes the token layer defines', () => {
    const roles = Object.keys(tokens.fontFamily);

    expect([...ROLES].sort()).toEqual(roles.sort());

    for (const role of ROLES) {
      expect(typefaceForLanguage('en')[role]).toBe(`font-${role}`);
    }
  });
});
