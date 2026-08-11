export const REACTION_CODES = ['love', 'laugh', 'wow', 'sad', 'fire', 'thumbs_up'] as const;

export type ReactionCode = (typeof REACTION_CODES)[number];

// Escaped so this file stays ASCII, named in comments because escapes are not
// readable. The heart needs its variation selector or some platforms draw the
// monochrome dingbat instead.
const GLYPHS: Record<ReactionCode, string> = {
  love: '\u2764\ufe0f', // red heart
  laugh: '\u{1f602}', // face with tears of joy
  wow: '\u{1f62e}', // face with open mouth
  sad: '\u{1f622}', // crying face
  fire: '\u{1f525}', // fire
  thumbs_up: '\u{1f44d}', // thumbs up
};

// A code added in a later release reaches an older client as an unknown
// string, so this returns undefined instead of rendering a blank box.
export function reactionGlyph(code: string | null): string | undefined {
  if (code === null) {
    return undefined;
  }

  return GLYPHS[code as ReactionCode];
}

export function isReactionCode(value: string | null): value is ReactionCode {
  return value !== null && value in GLYPHS;
}
