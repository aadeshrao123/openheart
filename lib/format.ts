import { getLocales } from 'expo-localization';
import { calendarDayOffset } from './calendar';

// Intl is built into Hermes and every browser, so formatting needs no library.
// Never hand-roll a date or number format: separators, ordering and unit names
// all differ by locale in ways that are invisible from an English keyboard.

const FALLBACK_LOCALE = 'en-US';

// The platform reports whatever the operating system or the browser says, and
// that is not guaranteed to be a well formed BCP 47 tag. Chromium on a POSIX
// system reports en-US@posix, and every constructor in this file rejects it
// with a RangeError. Since each of them takes the same tag, one malformed
// string from outside took the whole screen down through the root error
// boundary. Formatting is the last thing that should be able to do that.
//
// POSIX writes a locale as language_TERRITORY.codeset@modifier, and none of the
// three separators after the tag itself is BCP 47, so the underscore is
// rewritten and anything from the first dot or at sign is dropped. Then subtags
// are removed from the end one at a time, because fr-FR@euro is worth salvaging
// as fr-FR rather than answering in English.
//
// Intl.getCanonicalLocales is the test rather than a regular expression: it is
// the same structural check the constructors make, so it cannot disagree with
// them. It rejects only malformed tags, not unavailable ones, which is correct
// here. A structurally valid tag nobody implements, xx-YY, falls back to the
// default formatting inside Intl instead of throwing, and that is Intl's call
// to make rather than this file's.
export function usableLocale(tag: string | undefined): string {
  if (tag === undefined) {
    return FALLBACK_LOCALE;
  }

  const [cleaned] = tag.replace(/_/g, '-').split(/[@.]/);
  const subtags = cleaned.split('-');

  for (let length = subtags.length; length > 0; length -= 1) {
    const candidate = subtags.slice(0, length).join('-');

    try {
      Intl.getCanonicalLocales(candidate);

      return candidate;
    } catch {
      // Malformed at this length. Drop the last subtag and try again.
    }
  }

  return FALLBACK_LOCALE;
}

// Remembers the last answer only. The device locale changes about as often as a
// person moves country, and this runs once per formatted value, which on a
// conversation is once per message row.
let lastTag: string | undefined;
let lastLocale = FALLBACK_LOCALE;

function currentLocale(): string {
  const tag = getLocales()[0]?.languageTag;

  if (tag !== lastTag) {
    lastTag = tag;
    lastLocale = usableLocale(tag);
  }

  return lastLocale;
}

// Intl.Locale.measurementSystem is not yet available everywhere, so the handful
// of imperial regions are listed explicitly. Everywhere else is metric.
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

export const KM_PER_MILE = 1.609344;

export function usesImperialUnits(locale = currentLocale()): boolean {
  const region = new Intl.Locale(locale).region;

  return region !== undefined && IMPERIAL_REGIONS.has(region);
}

export function formatDistance(kilometres: number, locale = currentLocale()): string {
  const imperial = usesImperialUnits(locale);
  const value = imperial ? kilometres / KM_PER_MILE : kilometres;

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: imperial ? 'mile' : 'kilometer',
    unitDisplay: 'short',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRelativeTime(date: Date, locale = currentLocale()): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const elapsedMs = date.getTime() - Date.now();

  // Annotated rather than `as const`: the const assertion narrows each entry to
  // its own literal type, so `chosen` is typed as the seconds entry alone and
  // reassigning it to any other unit does not compile.
  const divisions: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
    { unit: 'second', ms: 1000 },
    { unit: 'minute', ms: 1000 * 60 },
    { unit: 'hour', ms: 1000 * 60 * 60 },
    { unit: 'day', ms: 1000 * 60 * 60 * 24 },
    { unit: 'month', ms: 1000 * 60 * 60 * 24 * 30 },
    { unit: 'year', ms: 1000 * 60 * 60 * 24 * 365 },
  ];

  let chosen = divisions[0];

  for (const division of divisions) {
    if (Math.abs(elapsedMs) >= division.ms) {
      chosen = division;
    }
  }

  return formatter.format(Math.round(elapsedMs / chosen.ms), chosen.unit);
}

export function formatDate(date: Date, locale = currentLocale()): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

export function formatTime(date: Date, locale = currentLocale()): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date);
}

// numeric: 'auto' is what produces "yesterday" rather than "1 day ago", in
// every language that has a word for it.
export function formatDayLabel(date: Date, now = new Date(), locale = currentLocale()): string {
  const offset = calendarDayOffset(date, now);

  if (offset > -2) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(offset, 'day');
  }

  if (offset > -7) {
    return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
  }

  return formatDate(date, locale);
}
