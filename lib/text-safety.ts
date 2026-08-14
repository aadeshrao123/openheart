export type SafetyCategory = 'contact' | 'solicitation' | 'slur' | 'sexual';

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

// `loose` keeps every separator but collapses repeats, and terms are matched
// against it as gap patterns: dick becomes d[^a-z0-9]*i[^a-z0-9]*c[^a-z0-9]*k.
// That catches dick, d i c k, d.i.c.k and reeetard in one pass while word
// boundaries keep Dickens, class and "open issue" clear.
//
// `squashed` drops separators entirely and is used only for long unambiguous
// terms, where a chance collision is implausible.
export function normalise(input: string): {
  loose: string;
  squashed: string;
} {
  const folded = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[0134578@$!|]/g, (character) => LOOKALIKES[character] ?? character);

  // Repeats collapse after the separators are gone, not before, or f.u.u.c.k
  // keeps its double letter and never reaches fuck.
  const collapse = (value: string) => value.replace(/(.)\1+/g, '$1');

  return {
    loose: collapse(folded),
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
// Terms of five characters or more are also matched against `squashed`.
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

// Explicit, not merely rude. Mild swearing is somebody's voice and blocking it
// makes the app feel broken rather than safe, so shit, damn and hell all pass.
//
// Matched on word boundaries only, never squashed. Anatomy words collide with
// ordinary writing once the separators are gone: "open issue" squashes to
// openisue, which contains penis.
const SEXUAL_TERMS: string[] = [
  'sex',
  'dick',
  'cock',
  'penis',
  'vagina',
  'pussy',
  'anus',
  'anal',
  'blowjob',
  'handjob',
  'cum',
  'horny',
  'nude',
  'nudes',
  'boobs',
  'tits',
];

const SQUASH_MIN_LENGTH = 5;

export function gapPattern(term: string): string {
  return `\\b${term.split('').join('[^a-z0-9]*')}\\b`;
}

function matchLoose(text: string, terms: string[]): string | null {
  return terms.find((term) => new RegExp(gapPattern(term)).test(text)) ?? null;
}

function matchSquashed(text: string, terms: string[]): string | null {
  return terms.find((term) => term.length >= SQUASH_MIN_LENGTH && text.includes(term)) ?? null;
}

export function checkText(input: string): Violation | null {
  if (!input.trim()) {
    return null;
  }

  const { loose, squashed } = normalise(input);

  const slur = matchLoose(loose, SLUR_TERMS) ?? matchSquashed(squashed, SLUR_TERMS);

  if (slur) {
    return { category: 'slur', matched: slur };
  }

  const sexual = matchLoose(loose, SEXUAL_TERMS);

  if (sexual) {
    return { category: 'sexual', matched: sexual };
  }

  // Against the raw text as well as the normalised form. Collapsing repeats
  // turns cashapp into cashap, so a pattern written the way a person writes it
  // only survives against the original.
  const raw = input.toLowerCase();

  for (const pattern of CONTACT_PATTERNS) {
    if (pattern.test(raw) || pattern.test(loose)) {
      return { category: 'contact', matched: pattern.source };
    }
  }

  for (const pattern of SOLICITATION_PATTERNS) {
    if (pattern.test(raw) || pattern.test(loose)) {
      return { category: 'solicitation', matched: pattern.source };
    }
  }

  return null;
}
