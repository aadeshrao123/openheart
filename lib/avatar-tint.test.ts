import { describe, expect, it } from 'vitest';
import { tintIndex } from './avatar-tint';

// Deterministic stand-ins for real ids: seeded rather than random, so a failure
// reproduces, and version 4 shaped, because real UUIDs from one generator share
// their version and variant nibbles and a hash that only reads a few characters
// would pass on arbitrary strings and fail on the real thing.
//
// mulberry32 rather than arithmetic on the row number. The first version of
// this built ids from n and position directly and produced 240 distinct values
// out of 3000, so the distribution assertion below was measuring its own
// collisions and failing the hash for them.
function uuids(count: number): string[] {
  let state = 0x9e3779b9;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const hex = '0123456789abcdef';
  const ids: string[] = [];

  for (let n = 0; n < count; n += 1) {
    let body = '';

    for (let position = 0; position < 30; position += 1) {
      body += hex[Math.floor(next() * 16)];
    }

    ids.push(
      `${body.slice(0, 8)}-${body.slice(8, 12)}-4${body.slice(12, 15)}-` +
        `8${body.slice(15, 18)}-${body.slice(18, 30)}`,
    );
  }

  return ids;
}

describe('tintIndex', () => {
  it('gives the same person the same tint every time', () => {
    const id = 'a3f1c2d4-0000-4000-8000-1234567890ab';

    expect(tintIndex(id, 3)).toBe(tintIndex(id, 3));
  });

  it('stays inside the range it was given', () => {
    for (const id of uuids(500)) {
      const index = tintIndex(id, 3);

      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(3);
    }
  });

  // The whole point is that two people next to each other usually differ. A
  // hash that returned a constant would satisfy every assertion above.
  it('spreads real-shaped ids evenly enough to be worth doing', () => {
    for (const buckets of [3, 4, 5]) {
      const counts = new Array<number>(buckets).fill(0);

      for (const id of uuids(3000)) {
        counts[tintIndex(id, buckets)] += 1;
      }

      const expected = 3000 / buckets;

      for (const count of counts) {
        expect(count).toBeGreaterThan(expected * 0.75);
        expect(count).toBeLessThan(expected * 1.25);
      }
    }
  });

  it('does not collapse ids that differ only in the last characters', () => {
    const base = 'a3f1c2d4-0000-4000-8000-12345678900';
    const seen = new Set<number>();

    for (const suffix of '0123456789abcdef') {
      seen.add(tintIndex(base + suffix, 3));
    }

    expect(seen.size).toBeGreaterThan(1);
  });
});
