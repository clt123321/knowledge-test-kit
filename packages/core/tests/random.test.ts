import { describe, it, expect } from 'vitest';
import { shuffle, sampleUnique, mulberry32, uuid } from '../src/random.js';

describe('shuffle', () => {
  it('returns an array of the same length and same members', () => {
    const arr = [1, 2, 3, 4, 5];
    const out = shuffle(arr, mulberry32(42));
    expect(out).toHaveLength(arr.length);
    expect([...out].sort()).toEqual([...arr].sort());
  });
  it('does not mutate the input', () => {
    const arr = [1, 2, 3];
    shuffle(arr, mulberry32(1));
    expect(arr).toEqual([1, 2, 3]);
  });
  it('with the same seed produces the same permutation', () => {
    expect(shuffle([1, 2, 3, 4], mulberry32(7))).toEqual(shuffle([1, 2, 3, 4], mulberry32(7)));
  });
});

describe('sampleUnique', () => {
  it('returns min(n, len) items and no duplicates', () => {
    const out = sampleUnique([1, 2, 3, 4, 5], 3, mulberry32(11));
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
  });
  it('handles n > length', () => {
    const out = sampleUnique([1, 2], 10);
    expect(out).toHaveLength(2);
  });
  it('handles n <= 0', () => {
    expect(sampleUnique([1, 2, 3], 0)).toEqual([]);
    expect(sampleUnique([1, 2, 3], -3)).toEqual([]);
  });
});

describe('uuid', () => {
  it('returns 36 characters with dashes', () => {
    const id = uuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
