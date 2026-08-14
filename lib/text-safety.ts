export type SafetyCategory = 'contact' | 'solicitation' | 'slur';

export type Violation = { category: SafetyCategory; matched: string };

// Substitutions people reach for first. Digits and symbols that read as letters,
// applied before anything else so f4ke and f@ke normalise to the same thing.
const LOOKALIKES: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'i',
};

// Two normal forms, because one cannot do both jobs. `spaced` keeps word
// boundaries, so short terms can be matched without "class" tripping on "ass".
// `squashed` removes every separator, so f.u.c.k and f u c k collapse, and only
// long terms are matched against it where a chance collision is implausible.
export function normalise(input: string): { spaced: string; squashed: string } {
  const folded = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[0134578@$!|]/g, (character) => LOOKALIKES[character] ?? character);

  // Repeats collapse after the separators are gone, not before, or f.u.u.c.k
  // keeps its double letter and never reaches fuck.
  const collapse = (value: string) => value.replace(/(.)\1+/g, '$1');

  return {
    spaced: collapse(folded.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()),
    squashed: collapse(folded.replace(/[^a-z0-9]/g, '')),
  };
}

// Moving someone off the app before either person can report anything is the
// most common opening move in this category, so it is treated as seriously as
// the words are.
const CONTACT_PATTERNS: RegExp[] = [
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/,
  /\b(?:\+?\d[\s-]?){9,}\b/,
  /\b(?:wa\.?me|t\.?me|whatsapp|telegram|snapchat|snap ?chat|kik|discord)\b/,
  /\b(?:insta(?:gram)?|ig|snap|tiktok)\s*[:@-]\s*[a-z0-9._]{3,}/,
  /(?:^|\s)@[a-z0-9._]{4,}(?:\s|$)/,
];

const SOLICITATION_PATTERNS: RegExp[] = [
  /\b(?:onlyfans|only ?fans|cashapp|cash ?app|venmo|paypal|bitcoin|crypto)\b/,
  /\b(?:my rates?|full service|incall|outcall|generous|sugar (?:daddy|baby|mommy))\b/,
  /\b(?:escort|hookup for money|pay for my)\b/,
];

// Deliberately short. It holds terms that are abusive in every context, not
// words that are merely rude: a bio saying "shit at tennis" is not a safety
// problem, and blocking it teaches people the app is broken rather than safe.
// Anything longer than seven characters is also matched against `squashed`.
const SLUR_TERMS: string[] = [
  'nigger',
  'nigga',
  'faggot',
  'tranny',
  'retard',
  'kike',
  'chink',
  'spic',
  'paki',
  'coon',
];

const SQUASH_MIN_LENGTH = 5;

function matchTerms(text: string, terms: string[], boundaries: boolean): string | null {
  for (const term of terms) {
    const needle = normalise(term)[boundaries ? 'spaced' : 'squashed'];
    const pattern = boundaries ? new RegExp(`\\b${needle}\\b`) : null;

    if (pattern ? pattern.test(text) : text.includes(needle)) {
      return term;
    }
  }

  return null;
}

export function checkText(input: string): Violation | null {
  if (!input.trim()) {
    return null;
  }

  const { spaced, squashed } = normalise(input);

  const slur =
    matchTerms(spaced, SLUR_TERMS, true) ??
    matchTerms(squashed, SLUR_TERMS.filter((term) => term.length >= SQUASH_MIN_LENGTH), false);

  if (slur) {
    return { category: 'slur', matched: slur };
  }

  // Against the raw text as well as the normalised form. Collapsing repeats
  // turns cashapp into cashap, so a pattern written the way a person writes it
  // only survives against the original.
  const raw = input.toLowerCase();

  for (const pattern of CONTACT_PATTERNS) {
    if (pattern.test(raw) || pattern.test(spaced)) {
      return { category: 'contact', matched: pattern.source };
    }
  }

  for (const pattern of SOLICITATION_PATTERNS) {
    if (pattern.test(raw) || pattern.test(spaced)) {
      return { category: 'solicitation', matched: pattern.source };
    }
  }

  return null;
}
