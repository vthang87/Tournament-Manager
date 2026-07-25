/**
 * Seeded PRNG helpers for draw randomization.
 * Algorithms must never call Math.random().
 */

/** Mulberry32 — fast 32-bit PRNG returning [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable uint32 hash for string seeds (FNV-1a inspired). */
export function hashSeedToUint32(seed: number | string): number {
  if (typeof seed === "number") {
    return seed >>> 0;
  }

  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: number | string): () => number {
  return mulberry32(hashSeedToUint32(seed));
}

/** Fisher–Yates shuffle using a seeded RNG. Mutates a copy. */
export function seededShuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const j = Math.floor(random() * (index + 1));
    const tmp = result[index]!;
    result[index] = result[j]!;
    result[j] = tmp;
  }
  return result;
}
