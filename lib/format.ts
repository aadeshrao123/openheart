import { getLocales } from 'expo-localization';
import i18next from 'i18next';
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

// Which locale a date, a time or a distance is formatted in.
//
// Reading the device tag alone was wrong, and invisibly so: picking Arabic in
// Settings translated every string and left "3 minutes ago" in English next to
// them, because the formatters never heard about the choice.
//
// The reader's language wins, and the device's region is carried across when it
// has one. Those two answer different questions. Language is what you read;
// region is where you are, and it decides miles against kilometres, which
// weekday a week starts on, and how a date is ordered. Someone reading Arabic in
// Chicago wants Arabic words and miles, so the tag they get is ar-US.
export function resolveFormattingLocale(
  deviceTag: string | undefined,
  chosenLanguage: string | undefined,
): string {
  const device = usableLocale(deviceTag);

  if (chosenLanguage === undefined || chosenLanguage === '') {
    return device;
  }

  // Same language: the device tag is strictly more specific, so keep it whole
  // rather than throwing away a region or a script it already carries.
  if (chosenLanguage.split('-')[0] === device.split('-')[0]) {
    return device;
  }

  const region = regionOf(device);

  return usableLocale(region ? `${chosenLanguage}-${region}` : chosenLanguage);
}

// Remembers the last answer only. Both inputs change about as often as a person
// moves country or changes their mind about a language, and this runs once per
// formatted value, which on a conversation is once per message row.
let lastKey: string | undefined;
let lastLocale = FALLBACK_LOCALE;

function currentLocale(): string {
  const deviceTag = getLocales()[0]?.languageTag;

  // i18next, not lib/i18n: the singleton is the same object either way, and
  // importing our own module here would be a cycle.
  const chosenLanguage = i18next.language;
  const key = `${deviceTag ?? ''}|${chosenLanguage ?? ''}`;

  if (key !== lastKey) {
    lastKey = key;
    lastLocale = resolveFormattingLocale(deviceTag, chosenLanguage);
  }

  return lastLocale;
}

// Parsed rather than read from Intl.Locale, which does not exist in Hermes. A
// one character subtag opens the extension section, where "en-u-nu-latn" has a
// two letter subtag that is not a region.
export function regionOf(locale: string): string | undefined {
  const subtags = locale.split('-');

  for (const subtag of subtags.slice(1)) {
    if (subtag.length === 1) {
      return undefined;
    }

    if (/^[A-Za-z]{2}$/.test(subtag) || /^[0-9]{3}$/.test(subtag)) {
      return subtag.toUpperCase();
    }
  }

  return undefined;
}

// Intl.Locale.measurementSystem is not yet available everywhere, so the handful
// of imperial regions are listed explicitly. Everywhere else is metric.
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

export const KM_PER_MILE = 1.609344;

export function usesImperialUnits(locale = currentLocale()): boolean {
  const region = regionOf(locale);

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

const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

// Stored in centimetres and read in whatever the region uses. Feet and inches
// are assembled from two Intl unit formats rather than a template, because
// 5'11" is a Latin convention and not every locale writes it that way.
export function formatHeight(centimetres: number, locale = currentLocale()): string {
  if (!usesImperialUnits(locale)) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'centimeter',
      unitDisplay: 'short',
      maximumFractionDigits: 0,
    }).format(centimetres);
  }

  const totalInches = Math.round(centimetres / CM_PER_INCH);
  const unit = (value: number, name: 'foot' | 'inch') =>
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: name,
      unitDisplay: 'narrow',
      maximumFractionDigits: 0,
    }).format(value);

  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = totalInches % INCHES_PER_FOOT;

  return `${unit(feet, 'foot')} ${unit(inches, 'inch')}`;
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
