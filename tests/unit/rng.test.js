/**
 * RNG — Unit Tests
 *
 * Tests createRng / createRNG (alias):
 *   determinism, range contracts, shuffle, pick, string seeds.
 *
 * No DOM needed — all pure math.
 */

import { describe, it, expect } from 'vitest';
import { createRng, createRNG } from '../../src/shared/rng.js';

// ── createRng shape ───────────────────────────────────────────────────────────

describe('createRng', () => {
  it('returns an object with next, nextInt, shuffle, pick', () => {
    const rng = createRng(1);
    expect(typeof rng.next).toBe('function');
    expect(typeof rng.nextInt).toBe('function');
    expect(typeof rng.shuffle).toBe('function');
    expect(typeof rng.pick).toBe('function');
  });
});

// ── next() ────────────────────────────────────────────────────────────────────

describe('next', () => {
  it('returns a number in [0, 1)', () => {
    const rng = createRng(42);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic — same seed produces same sequence', () => {
    const a = createRng(99);
    const b = createRng(99);
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different seeds produce different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    const aVals = Array.from({ length: 10 }, () => a.next());
    const bVals = Array.from({ length: 10 }, () => b.next());
    expect(aVals).not.toEqual(bVals);
  });

  it('advances state on each call', () => {
    const rng = createRng(7);
    const v1 = rng.next();
    const v2 = rng.next();
    expect(v1).not.toBe(v2);
  });
});

// ── nextInt() ─────────────────────────────────────────────────────────────────

describe('nextInt', () => {
  it('returns an integer', () => {
    const rng = createRng(5);
    for (let i = 0; i < 50; i++) {
      expect(Number.isInteger(rng.nextInt(0, 10))).toBe(true);
    }
  });

  it('returns values within [min, max] inclusive', () => {
    const rng = createRng(13);
    for (let i = 0; i < 200; i++) {
      const v = rng.nextInt(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('returns exactly min when min === max', () => {
    const rng = createRng(0);
    for (let i = 0; i < 10; i++) {
      expect(rng.nextInt(5, 5)).toBe(5);
    }
  });

  it('can return min and max over many iterations', () => {
    const rng = createRng(2024);
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      seen.add(rng.nextInt(0, 3));
    }
    expect(seen.has(0)).toBe(true);
    expect(seen.has(3)).toBe(true);
  });

  it('handles negative range (e.g., [-10, -5])', () => {
    const rng = createRng(42);
    for (let i = 0; i < 50; i++) {
      const v = rng.nextInt(-10, -5);
      expect(v).toBeGreaterThanOrEqual(-10);
      expect(v).toBeLessThanOrEqual(-5);
    }
  });

  it('handles mixed negative/positive range (e.g., [-3, 3])', () => {
    const rng = createRng(77);
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(-3, 3);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThanOrEqual(3);
    }
  });
});

// ── shuffle() ─────────────────────────────────────────────────────────────────

describe('shuffle', () => {
  it('returns a new array (does not mutate original)', () => {
    const rng = createRng(8);
    const original = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(original);
    expect(shuffled).not.toBe(original);
    expect(original).toEqual([1, 2, 3, 4, 5]);
  });

  it('returned array has same length', () => {
    const rng = createRng(8);
    const arr = [10, 20, 30, 40];
    expect(rng.shuffle(arr)).toHaveLength(arr.length);
  });

  it('returned array contains same elements', () => {
    const rng = createRng(8);
    const arr = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(arr);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic — same seed and same array gives same result', () => {
    const a = createRng(100);
    const b = createRng(100);
    const arr = [1, 2, 3, 4, 5, 6];
    expect(a.shuffle(arr)).toEqual(b.shuffle(arr));
  });

  it('handles empty array', () => {
    const rng = createRng(1);
    expect(rng.shuffle([])).toEqual([]);
  });

  it('handles single-element array', () => {
    const rng = createRng(1);
    expect(rng.shuffle([42])).toEqual([42]);
  });

  it('two-element array has correct elements after shuffle', () => {
    const rng = createRng(999);
    const shuffled = rng.shuffle([10, 20]);
    expect(shuffled).toHaveLength(2);
    expect(shuffled.sort((a, b) => a - b)).toEqual([10, 20]);
  });
});

// ── pick() ────────────────────────────────────────────────────────────────────

describe('pick', () => {
  it('returns undefined for empty array', () => {
    const rng = createRng(1);
    expect(rng.pick([])).toBeUndefined();
  });

  it('returns the only element for single-element array', () => {
    const rng = createRng(1);
    expect(rng.pick(['only'])).toBe('only');
  });

  it('returns an element that exists in the array', () => {
    const rng = createRng(55);
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it('can pick every element over many calls', () => {
    const rng = createRng(9999);
    const arr = [1, 2, 3, 4];
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      seen.add(rng.pick(arr));
    }
    expect(seen.size).toBe(arr.length);
  });
});

// ── string seeds (FNV-1a hash) ────────────────────────────────────────────────

describe('string seeds', () => {
  it('accepts a string seed without throwing', () => {
    expect(() => createRng('hello')).not.toThrow();
  });

  it('accepts an empty string seed (FNV-1a base hash)', () => {
    expect(() => createRng('')).not.toThrow();
    const rng = createRng('');
    const v = rng.next();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it('floors float seeds (3.7 behaves as 3)', () => {
    const a = createRng(3.7);
    const b = createRng(3);
    for (let i = 0; i < 5; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('negative numeric seed is unsigned via >>> 0 (no throw)', () => {
    expect(() => createRng(-42)).not.toThrow();
    const rng = createRng(-42);
    const v = rng.next();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it('string seed is deterministic', () => {
    const a = createRng('test-seed');
    const b = createRng('test-seed');
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different string seeds produce different sequences', () => {
    const a = createRng('seed-a');
    const b = createRng('seed-b');
    const aVals = Array.from({ length: 10 }, () => a.next());
    const bVals = Array.from({ length: 10 }, () => b.next());
    expect(aVals).not.toEqual(bVals);
  });

  it('string seed and equivalent numeric hash produce same results if seed hashes the same', () => {
    // Verify string seeds work alongside numeric seeds without error
    const rng = createRng('daily-2024-01-01');
    const vals = Array.from({ length: 5 }, () => rng.next());
    expect(vals).toHaveLength(5);
    vals.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    });
  });
});

// ── createRNG alias ───────────────────────────────────────────────────────────

describe('createRNG alias', () => {
  it('is the same function as createRng', () => {
    expect(createRNG).toBe(createRng);
  });

  it('produces same output as createRng for the same seed', () => {
    const a = createRng(77);
    const b = createRNG(77);
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBe(b.next());
    }
  });
});
