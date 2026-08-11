// FNV-1a, 32 bit. Chosen because it is a dozen lines, has no dependencies, and
// spreads short strings that share long prefixes, which is exactly what UUIDs
// from one generator look like. Nothing here is security relevant: it decides a
// background tint and no more.
//
// Kept out of the Avatar component so the distribution can be tested. A hash
// that quietly favours one bucket looks fine on the four rows a developer has
// and wrong on a real thread list.
export function tintIndex(identity: string, buckets: number): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    // The FNV prime, as a shift-and-add because a plain multiply overflows the
    // 32 bit range JavaScript bitwise operators work in.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }

  return hash % buckets;
}
