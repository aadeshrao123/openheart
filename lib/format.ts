import { getLocales } from 'expo-localization';

// Intl is built into Hermes and every browser, so formatting needs no library.
// Never hand-roll a date or number format: separators, ordering and unit names
// all differ by locale in ways that are invisible from an English keyboard.

function currentLocale(): string {
  return getLocales()[0]?.languageTag ?? 'en-US';
}

// Intl.Locale.measurementSystem is not yet available everywhere, so the handful
// of imperial regions are listed explicitly. Everywhere else is metric.
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

function usesImperial(locale: string): boolean {
  const region = new Intl.Locale(locale).region;

  return region !== undefined && IMPERIAL_REGIONS.has(region);
}

export function formatDistance(kilometres: number, locale = currentLocale()): string {
  const imperial = usesImperial(locale);
  const value = imperial ? kilometres * 0.621371 : kilometres;

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
