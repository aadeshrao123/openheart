import { describe, expect, it, vi } from 'vitest';

// expo-localization reaches react-native, which vitest cannot parse, and every
// assertion below passes a locale in explicitly anyway. The device tag is the
// one input that is not exercised here, and it is the one the app cannot
// control, which is why usableLocale is exported and tested on its own.
vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US' }],
}));

import {
  formatDate,
  formatDayLabel,
  formatDistance,
  formatRelativeTime,
  formatTime,
  resolveFormattingLocale,
  usableLocale,
  usesImperialUnits,
} from './format';
import languages from '@/locales/languages.json';

// This file exists because of a crash, not for coverage. Chromium in a POSIX
// environment reports navigator.language as en-US@posix, expo-localization
// passes it through, and new Intl.Locale('en-US@posix') throws a RangeError,
// which reached the root error boundary and replaced the whole deck with the
// error screen. Every formatter here took the same tag, so any one of them
// would have done it.

// Real shapes, not invented ones. The POSIX forms are what a Unix LANG looks
// like, and C is what it is on a machine with no locale configured at all.
const MALFORMED = [
  'en-US@posix',
  'en_US.UTF-8',
  'fr-FR@euro',
  'pt_BR',
  'C',
  '',
  'e',
  '-',
  'en--US',
];

describe('usableLocale', () => {
  it('keeps a tag that is already well formed', () => {
    for (const tag of ['en-US', 'fr', 'pt-BR', 'zh-Hans-CN', 'ar-EG']) {
      expect(usableLocale(tag)).toBe(tag);
    }
  });

  // The point of walking back subtags rather than giving up: a French speaker
  // with a POSIX locale should still be answered in French.
  it('salvages the longest well formed prefix', () => {
    expect(usableLocale('en-US@posix')).toBe('en-US');
    expect(usableLocale('en_US.UTF-8')).toBe('en-US');
    expect(usableLocale('fr-FR@euro')).toBe('fr-FR');
    expect(usableLocale('pt_BR')).toBe('pt-BR');
    expect(usableLocale('en-US-')).toBe('en-US');
  });

  // Not everything that looks like debris is. A private use subtag is a legal
  // part of a tag and Intl accepts it, so it survives: the rule is "the longest
  // prefix Intl will take", not "the shortest tag that works".
  it('does not truncate a tag that is unusual but valid', () => {
    expect(usableLocale('en-US-x-broken')).toBe('en-US-x-broken');
  });

  it('falls back to English when there is nothing to salvage', () => {
    expect(usableLocale('C')).toBe('en-US');
    expect(usableLocale('')).toBe('en-US');
    expect(usableLocale(undefined)).toBe('en-US');
  });

  // A tag nobody implements is still a legal tag. Intl answers it with its own
  // default data rather than throwing, and choosing a substitute here would be
  // this file overruling that.
  it('leaves a well formed but unimplemented tag alone', () => {
    expect(usableLocale('xx-YY')).toBe('xx-YY');
  });

  it('always returns something every Intl constructor accepts', () => {
    for (const tag of MALFORMED) {
      expect(() => Intl.getCanonicalLocales(usableLocale(tag))).not.toThrow();
    }
  });
});

// The regression itself: not that the tag is tidied up, but that nothing in
// this module can throw because of one. Every exported formatter, every shipped
// language, and every malformed shape above.
describe('every formatter survives a locale it did not expect', () => {
  const shipped = Object.keys(languages);
  const date = new Date('2026-08-12T09:30:00Z');
  const now = new Date('2026-08-12T18:00:00Z');

  it('covers all ten shipped languages', () => {
    expect(shipped.length).toBe(10);
  });

  for (const tag of [...MALFORMED, 'xx-YY']) {
    it(`does not throw for ${tag === '' ? '(empty string)' : tag}`, () => {
      const locale = usableLocale(tag);

      expect(() => usesImperialUnits(locale)).not.toThrow();
      expect(() => formatDistance(3.4, locale)).not.toThrow();
      expect(() => formatRelativeTime(date, locale)).not.toThrow();
      expect(() => formatDate(date, locale)).not.toThrow();
      expect(() => formatTime(date, locale)).not.toThrow();
      expect(() => formatDayLabel(date, now, locale)).not.toThrow();
    });
  }

  for (const tag of Object.keys(languages)) {
    it(`does not throw for the shipped language ${tag}`, () => {
      expect(() => formatDistance(3.4, tag)).not.toThrow();
      expect(() => formatRelativeTime(date, tag)).not.toThrow();
      expect(() => formatDayLabel(date, now, tag)).not.toThrow();
    });
  }
});

// Reading the device tag alone shipped an Arabic interface with "3 minutes ago"
// in English beside it, because the formatters never heard which language the
// reader had picked. Language and region answer different questions and both
// have to survive.
describe('resolveFormattingLocale', () => {
  it('follows the device when no language has been chosen', () => {
    expect(resolveFormattingLocale('fr-CA', undefined)).toBe('fr-CA');
    expect(resolveFormattingLocale('fr-CA', '')).toBe('fr-CA');
  });

  it('keeps the device tag whole when it is the same language', () => {
    expect(resolveFormattingLocale('pt-BR', 'pt')).toBe('pt-BR');
    expect(resolveFormattingLocale('en-GB', 'en')).toBe('en-GB');
  });

  it('takes the chosen language and keeps where the reader is', () => {
    expect(resolveFormattingLocale('en-US', 'ar')).toBe('ar-US');
    expect(resolveFormattingLocale('en-GB', 'hi')).toBe('hi-GB');
  });

  // The whole reason region is carried across: units follow where you are, not
  // what you read. Someone reading Arabic in Chicago still wants miles.
  it('leaves a reader in the United States on imperial units', () => {
    expect(usesImperialUnits(resolveFormattingLocale('en-US', 'ar'))).toBe(true);
    expect(usesImperialUnits(resolveFormattingLocale('en-GB', 'ar'))).toBe(false);
  });

  it('survives a device tag with no region', () => {
    expect(resolveFormattingLocale('en', 'ar')).toBe('ar');
  });

  it('survives a malformed device tag', () => {
    expect(resolveFormattingLocale('en-US@posix', 'ar')).toBe('ar-US');
    expect(resolveFormattingLocale('C', 'ar')).toBe('ar-US');
  });

  it('carries a script subtag through', () => {
    expect(resolveFormattingLocale('en-US', 'zh-Hans')).toBe('zh-Hans-US');
  });

  it('formats in the chosen language, which is the bug this exists for', () => {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const arabic = formatRelativeTime(threeMinutesAgo, resolveFormattingLocale('en-US', 'ar'));

    expect(arabic).not.toMatch(/minute/);
    expect(arabic).toMatch(/[\u0600-\u06FF]/);
  });
});
