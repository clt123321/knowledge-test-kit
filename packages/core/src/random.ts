/**
 * Fisher-Yates shuffle with an injectable RNG.
 *
 * Returns a new array; the input is not mutated.
 */
export function shuffle<T>(arr: readonly T[], rand: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Sample up to `n` unique items from `arr` (uniform, no replacement). */
export function sampleUnique<T>(
  arr: readonly T[],
  n: number,
  rand: () => number = Math.random,
): T[] {
  return shuffle(arr, rand).slice(0, Math.max(0, Math.min(n, arr.length)));
}

/**
 * Mulberry32 seeded PRNG. Useful for reproducible test paper generation.
 * Returns a function producing floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const crypto: { randomUUID?: () => string } | undefined =
  typeof globalThis !== 'undefined'
    ? (globalThis.crypto as { randomUUID?: () => string } | undefined)
    : undefined;

/** UUIDv4 (crypto.randomUUID with a fallback). */
export function uuid(): string {
  if (crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // https://stackoverflow.com/a/2117523 (RFC4122 v4)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
