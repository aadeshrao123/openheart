import { useTranslation } from 'react-i18next';

// The one place a script is bound to a font family.
//
// A component asks for a role - display, body, strong - and never for a file.
// Which family answers that role depends on what the reader's language is
// written in, because a font can only draw the scripts it has glyphs for and a
// missing glyph is filled in by the platform silently. In a language the brand
// face does not cover, the Latin characters in a line ("OpenHeart", a digit, an
// untranslated fragment) came out of the brand face while the rest of the same
// line came out of a system fallback: two sets of metrics, two weights, one
// line, no warning.
//
// React Native's fontFamily takes a single family string and not a CSS stack,
// so per-character fallback is not available here the way it is in a browser.
// The choice is therefore made per language, for the whole interface at once.

export type FontRole = 'display' | 'quote' | 'body' | 'emphasis' | 'strong';

// The classes that answer each role. Written out in full rather than built from
// the role at runtime, because Tailwind decides which utilities to generate by
// scanning source files for literal strings and generates nothing it never
// sees. tailwind.config.js scans lib/ for this reason.
export type Typeface = Readonly<Record<FontRole, string>>;

// Family only, and deliberately no weight or style class alongside it. These
// families already encode their weight and their slant, because React Native
// does not synthesize weights and each cut is shipped as its own file. Adding
// font-semibold next to font-display would put a second, independent weight
// request on a face that already has one: on Android that reaches
// Typeface.create(typeface, weight, italic) in ReactFontManager.TypefaceStyle,
// which is the call that fakes a weight the family does not contain. Same for
// italic next to font-quote, which is already the italic cut.
const BRAND: Typeface = {
  display: 'font-display',
  quote: 'font-quote',
  body: 'font-body',
  emphasis: 'font-emphasis',
  strong: 'font-strong',
};

// No family class, on purpose. There is no one family string meaning "whatever
// this device uses for this script": iOS understands "System", Android does
// not, and on web it has to be a stack. Leaving fontFamily unset is the single
// request that means the same thing on all three - React Native draws in the
// platform font, and react-native-web's own base style for Text and TextInput
// is `14px System`, which its compiler expands to the system stack. Measured on
// the real export: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
// Helvetica, Arial, sans-serif.
//
// The weight and the slant have to be asked for separately here, because the
// brand families carry them inside the family name and dropping the family
// dropped them with it. Without these five lines a non-Latin interface renders
// every role at 400 upright: a button label the same weight as body copy, a
// 40px product name with no more presence than a paragraph, and a pull quote
// that is no longer a quote. Losing the hierarchy is worse than the mixed
// metrics this file exists to fix.
//
// Each entry mirrors what its brand family encodes, and lib/typeface.test.ts
// derives the expected weight from the family name in tokens.js so the two
// cannot drift:
//
//   display   PlusJakartaSans_800ExtraBold    800
//   quote     PlusJakartaSans_500Medium_Ital  500 italic
//   body      PlusJakartaSans_400Regular      400
//   emphasis  PlusJakartaSans_500Medium       500
//   strong    PlusJakartaSans_600SemiBold     600
const PLATFORM_DEFAULT: Typeface = {
  display: 'font-extrabold',
  quote: 'font-medium italic',
  body: 'font-normal',
  emphasis: 'font-medium',
  strong: 'font-semibold',
};

type Script = 'arabic' | 'bengali' | 'devanagari' | 'han' | 'latin';

// Keyed by primary subtag, so pt-BR resolves like pt and zh-Hans like zh. A tag
// does not carry its script and none of this is derivable from the letters: ur
// and ar are both written in Arabic script, hi in Devanagari, bn in Bengali.
const SCRIPT_BY_LANGUAGE: Readonly<Partial<Record<string, Script>>> = {
  ar: 'arabic',
  bn: 'bengali',
  en: 'latin',
  es: 'latin',
  fr: 'latin',
  hi: 'devanagari',
  id: 'latin',
  pt: 'latin',
  ur: 'arabic',
  zh: 'han',
};

// Measured, not assumed: the cmap table of the bundled face carries 721
// codepoints and has no glyph for U+0627, U+0905, U+0985, U+4E00 or even
// U+0410. Latin is all it covers, so Latin is the only entry here and every
// other script gets the platform font for the whole interface. An off-brand
// line that is internally consistent beats a branded line that changes typeface
// halfway through.
//
// Bundling a Noto face for a script later is one entry here plus its family in
// tokens.js. No component changes.
const TYPEFACE_BY_SCRIPT: Readonly<Partial<Record<Script, Typeface>>> = {
  latin: BRAND,
};

// An unknown tag falls through to the platform font rather than to the brand
// one. Unknown tag means unknown script, and the platform font is the only one
// that can be trusted to draw a script nobody here has thought about.
export function typefaceForLanguage(language: string): Typeface {
  const [base] = language.toLowerCase().split('-');
  const script = SCRIPT_BY_LANGUAGE[base];

  if (script === undefined) {
    return PLATFORM_DEFAULT;
  }

  return TYPEFACE_BY_SCRIPT[script] ?? PLATFORM_DEFAULT;
}

// Language is switched in-app, so this has to re-render rather than be read
// once at launch. useTranslation is how every other language-dependent piece of
// UI already subscribes: react-i18next re-renders its callers on i18next's
// languageChanged event, which is exactly what hooks/use-language.ts fires.
export function useTypeface(): Typeface {
  const { i18n } = useTranslation();

  return typefaceForLanguage(i18n.language);
}
