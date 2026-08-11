// The polyfill has to be imported before i18next, and it is not optional.
//
// i18next resolves plural categories only through Intl.PluralRules. Hermes,
// which is the engine on both iOS and Android, ships Intl with exactly three
// constructors: Collator, DateTimeFormat and NumberFormat. Verified against the
// binaries React Native 0.86 actually downloads: zero occurrences of "plural"
// in the shipped iOS framework, zero PluralRules symbols in an unstripped
// libhermesvm.so, and no PluralRules class in the Android bridge.
//
// i18next's own fallback for that case is silent. Its catch block only logs
// when Intl is entirely absent, and Intl is present here, so a bare code like
// "ar" falls through to a dummy rule that knows only one and other. Arabic
// loses four of its six forms and Russian two, on device, with no warning, in a
// build that behaves perfectly in a browser because browsers have the real
// thing. Locale data is per language and omitting one fails the same silent
// way, so every shipped language is listed. The .js extension is required: the
// package exports map has no extensionless entry.
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/ar.js';
import '@formatjs/intl-pluralrules/locale-data/bn.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/es.js';
import '@formatjs/intl-pluralrules/locale-data/fr.js';
import '@formatjs/intl-pluralrules/locale-data/hi.js';
import '@formatjs/intl-pluralrules/locale-data/id.js';
import '@formatjs/intl-pluralrules/locale-data/pt.js';
import '@formatjs/intl-pluralrules/locale-data/ur.js';
// There is no zh-Hans data file. zh covers it: the matcher resolves zh-Hans to
// zh, and Chinese has one plural category either way.
import '@formatjs/intl-pluralrules/locale-data/zh.js';

import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import languageNames from '@/locales/languages.json';
import ar from '@/locales/ar.json';
import bn from '@/locales/bn.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import hi from '@/locales/hi.json';
import id from '@/locales/id.json';
import pt from '@/locales/pt.json';
import ur from '@/locales/ur.json';
import zhHans from '@/locales/zh-Hans.json';

// Adding a language: drop the JSON in locales/, add its endonym to
// locales/languages.json, and add it to resources below. Nothing else in the
// codebase changes.
//
// The names live in locales/languages.json rather than here because each is
// written in its own script, and every file outside locales/ is ASCII only. A
// picker has to show all of them at once, so they cannot come from the active
// bundle either.
export const SUPPORTED_LANGUAGES = languageNames;

export type Language = keyof typeof SUPPORTED_LANGUAGES;

export const FALLBACK_LANGUAGE: Language = 'en';

const resources = {
  ar: { translation: ar },
  bn: { translation: bn },
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  hi: { translation: hi },
  id: { translation: id },
  pt: { translation: pt },
  ur: { translation: ur },
  'zh-Hans': { translation: zhHans },
} satisfies Record<Language, { translation: unknown }>;

const RTL_LANGUAGES: ReadonlySet<string> = new Set(['ar', 'ur']);

export function isRtlLanguage(language: string): boolean {
  return RTL_LANGUAGES.has(language);
}

export function isSupportedLanguage(tag: string): tag is Language {
  return tag in SUPPORTED_LANGUAGES;
}

// zh is the one tag in this set with no Suppress-Script in the IANA registry,
// because Simplified and Traditional are a real distinction rather than a
// spelling of the same thing. Shipping the bundle as zh-Hans rather than zh
// means adding Traditional later is a new file instead of a rename, and a
// rename would invalidate every language preference already stored on a device.
//
// Only Simplified exists today, so a Traditional reader is given it. That is a
// compromise rather than a correct answer, and the fix is a zh-Hant bundle.
const BASE_LANGUAGE_TAGS: Record<string, Language> = { zh: 'zh-Hans' };

function matchLanguage(languageTag: string, base: string | null, script: string | null) {
  if (isSupportedLanguage(languageTag)) {
    return languageTag;
  }

  if (base !== null && script !== null && isSupportedLanguage(`${base}-${script}`)) {
    return `${base}-${script}` as Language;
  }

  if (base !== null && isSupportedLanguage(base)) {
    return base;
  }

  return base !== null ? BASE_LANGUAGE_TAGS[base] : undefined;
}

// getLocales() is ordered by user preference, so the first entry that matches
// anything shipped is the best available answer.
function resolveDeviceLanguage(): Language {
  for (const locale of getLocales()) {
    const matched = matchLanguage(
      locale.languageTag,
      locale.languageCode,
      locale.languageScriptCode,
    );

    if (matched !== undefined) {
      return matched;
    }
  }

  return FALLBACK_LANGUAGE;
}

void i18next.use(initReactI18next).init({
  resources,
  lng: resolveDeviceLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  returnNull: false,

  // React Native has no innerHTML, so i18next's HTML escaping only corrupts
  // legitimate characters in interpolated user names.
  interpolation: { escapeValue: false },
});

export { i18next };
