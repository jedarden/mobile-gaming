/**
 * RNG (Random Number Generator) — Unit Tests
 *
 * Tests the Mulberry32-based seeded RNG: determinism, range correctness,
 * shuffle permutation properties, pick selection, and the createRNG alias.
 */

import { describe, it, expect } from 'vitest';
import { createRng, createRNG } from '../../src/shared/rng.js';

// ─── createRng — API ───────────────────────────────────────────────────────────

describe('createRng — API', () => {
  it('returns object with next, nextInt, shuffle, pick', () => {
    const rng = createRng(1);
    expect(typeof rng.next).toBe('function');
    expect(typeof rng.nextInt).toBe('function');
    expect(typeof rng.shuffle).toBe('function');
    expect(typeof rng.pick).toBe('function');
  });

  it('accepts numeric seeds', () => {
    expect(() => createRng(0)).not.toThrow();
    expect(() => createRng(42)).not.toThrow();
    expect(() => createRng(0xFFFFFFFF)).not.toThrow();
  });

  it('accepts string seeds', () => {
    expect(() => createRng('hello')).not.toThrow();
    expect(() => createRng('')).not.toThrow();
    expect(() => createRng('2024-01-15')).not.toThrow();
  });
});

// ─── next() ────────────────────────────────────────────────────────────────────

describe('createRng — next()', () => {
  it('returns a number', () => {
    const rng = createRng(1);
    expect(typeof rng.next()).toBe('number');
  });

  it('returns values in [0, 1)', () => {
    const rng = createRng(100);
    for (let i = 0; i < 200; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('advances state on each call (different values)', () => {
    const rng = createRng(7);
    const a = rng.next();
    const b = rng.next();
    // Not guaranteed for every seed but overwhelmingly true
    expect(a).not.toBe(b);
  });
});

// ─── Determinism ───────────────────────────────────────────────────────────────

describe('createRng — determinism', () => {
  it('same numeric seed → identical sequence', () => {
    const a = createRng(123);
    const b = createRng(123);
    for (let i = 0; i < 30; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('same string seed → identical sequence', () => {
    const a = createRng('hello-world');
    const b = createRng('hello-world');
    for (let i = 0; i < 30; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different numeric seeds → different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('different string seeds → different sequences', () => {
    const a = createRng('abc');
    const b = createRng('xyz');
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('string "42" and numeric 42 are hashed differently', () => {
    // String seeds go through FNV-1a; numeric 42 is used directly
    const a = createRng(42);
    const b = createRng('42');
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('seed 0 produces a valid sequence', () => {
    const rng = createRng(0);
    for (let i = 0; i < 10; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// ─── nextInt() ─────────────────────────────────────────────────────────────────

describe('createRng — nextInt()', () => {
  it('returns an integer', () => {
    const rng = createRng(5);
    for (let i = 0; i < 50; i++) {
      expect(Number.isInteger(rng.nextInt(0, 10))).toBe(true);
    }
  });

  it('result is within [min, max] inclusive', () => {
    const rng = createRng(9);
    for (let i = 0; i < 300; i++) {
      const v = rng.nextInt(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it('returns exactly min when min === max', () => {
    const rng = createRng(1);
    for (let i = 0; i < 20; i++) {
      expect(rng.nextInt(7, 7)).toBe(7);
    }
  });

  it('can produce both endpoints over many calls', () => {
    const rng = createRng(0);
    const vals = new Set();
    for (let i = 0; i < 500; i++) {
      vals.add(rng.nextInt(0, 3));
    }
    expect(vals.has(0)).toBe(true);
    expect(vals.has(3)).toBe(true);
  });

  it('same seed produces same nextInt sequence', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 20; i++) {
      expect(a.nextInt(0, 100)).toBe(b.nextInt(0, 100));
    }
  });

  it('works with negative min', () => {
    const rng = createRng(77);
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

// ─── shuffle() ────────────────────────────────────────────────────────────────

describe('createRng — shuffle()', () => {
  it('returns a new array', () => {
    const rng = createRng(1);
    const arr = [1, 2, 3];
    const result = rng.shuffle(arr);
    expect(result).not.toBe(arr);
  });

  it('does not mutate the original', () => {
    const rng = createRng(1);
    const arr = [10, 20, 30, 40];
    const copy = [...arr];
    rng.shuffle(arr);
    expect(arr).toEqual(copy);
  });

  it('result has same length as input', () => {
    const rng = createRng(1);
    const arr = [1, 2, 3, 4, 5];
    expect(rng.shuffle(arr)).toHaveLength(5);
  });

  it('result contains same elements (same multiset)', () => {
    const rng = createRng(1);
    const arr = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(arr);
    expect([...shuffled].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('empty array shuffles to empty array', () => {
    const rng = createRng(1);
    expect(rng.shuffle([])).toEqual([]);
  });

  it('single-element array shuffles to identical array', () => {
    const rng = createRng(1);
    expect(rng.shuffle([42])).toEqual([42]);
  });

  it('same seed produces same shuffle order', () => {
    const arr = [1, 2, 3, 4, 5, 6];
    const a = createRng('seed');
    const b = createRng('seed');
    expect(a.shuffle(arr)).toEqual(b.shuffle(arr));
  });

  it('different seeds produce different shuffle orders (with high probability)', () => {
    // Use a long enough array that collision is astronomically unlikely
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = createRng('seedA');
    const b = createRng('seedB');
    expect(a.shuffle(arr)).not.toEqual(b.shuffle(arr));
  });

  it('works with non-numeric elements', () => {
    const rng = createRng(1);
    const arr = ['a', 'b', 'c', 'd'];
    const result = rng.shuffle(arr);
    expect([...result].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

// ─── pick() ───────────────────────────────────────────────────────────────────

describe('createRng — pick()', () => {
  it('returns an element from the array', () => {
    const rng = createRng(5);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it('returns undefined for empty array', () => {
    const rng = createRng(1);
    expect(rng.pick([])).toBeUndefined();
  });

  it('returns the only element for single-element array', () => {
    const rng = createRng(1);
    for (let i = 0; i < 10; i++) {
      expect(rng.pick([99])).toBe(99);
    }
  });

  it('same seed picks same element', () => {
    const arr = [10, 20, 30, 40, 50];
    const a = createRng('xyz');
    const b = createRng('xyz');
    expect(a.pick(arr)).toBe(b.pick(arr));
  });

  it('can pick all elements from array over many calls', () => {
    const rng = createRng(0);
    const arr = [1, 2, 3, 4, 5];
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      seen.add(rng.pick(arr));
    }
    expect(seen.size).toBe(5);
  });
});

// ─── createRNG backward-compat alias ─────────────────────────────────────────

describe('createRNG (alias)', () => {
  it('createRNG is exported', () => {
    expect(typeof createRNG).toBe('function');
  });

  it('createRNG(seed) produces same sequence as createRng(seed)', () => {
    const a = createRng(77);
    const b = createRNG(77);
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });
});
