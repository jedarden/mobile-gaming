/**
 * Tests for RNG.js - Seeded Pseudo-Random Number Generator
 */

import { describe, it, expect } from 'vitest';
import { mulberry32, createRNG } from '../../src/shared/rng.js';

describe('mulberry32', () => {
  it('should return a function', () => {
    const rng = mulberry32(12345);
    expect(typeof rng).toBe('function');
  });

  it('should produce deterministic results with same seed', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);

    expect(rng1()).toBe(rng2());
    expect(rng1()).toBe(rng2());
    expect(rng1()).toBe(rng2());
  });

  it('should produce different results with different seeds', () => {
    const rng1 = mulberry32(1);
    const rng2 = mulberry32(2);

    expect(rng1()).not.toBe(rng2());
  });

  it('should return values between 0 and 1', () => {
    const rng = mulberry32(99999);

    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('should produce varied output', () => {
    const rng = mulberry32(123);
    const values = new Set();

    for (let i = 0; i < 100; i++) {
      values.add(rng());
    }

    // All 100 values should be unique
    expect(values.size).toBe(100);
  });
});

describe('createRNG', () => {
  it('should create RNG with all utility methods', () => {
    const rng = createRNG(12345);

    expect(typeof rng.next).toBe('function');
    expect(typeof rng.int).toBe('function');
    expect(typeof rng.float).toBe('function');
    expect(typeof rng.bool).toBe('function');
    expect(typeof rng.pick).toBe('function');
    expect(typeof rng.shuffle).toBe('function');
  });

  describe('int', () => {
    it('should return integers within range [min, max]', () => {
      const rng = createRNG(42);

      for (let i = 0; i < 50; i++) {
        const value = rng.int(1, 10);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    });

    it('should handle min equals max', () => {
      const rng = createRNG(99);

      for (let i = 0; i < 10; i++) {
        expect(rng.int(5, 5)).toBe(5);
      }
    });

    it('should be deterministic with same seed', () => {
      const rng1 = createRNG(777);
      const rng2 = createRNG(777);

      expect(rng1.int(0, 100)).toBe(rng2.int(0, 100));
      expect(rng1.int(0, 100)).toBe(rng2.int(0, 100));
    });
  });

  describe('float', () => {
    it('should return floats within range [min, max)', () => {
      const rng = createRNG(123);

      for (let i = 0; i < 50; i++) {
        const value = rng.float(0, 100);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(100);
      }
    });

    it('should be deterministic with same seed', () => {
      const rng1 = createRNG(555);
      const rng2 = createRNG(555);

      expect(rng1.float(0, 1)).toBe(rng2.float(0, 1));
    });
  });

  describe('bool', () => {
    it('should return booleans', () => {
      const rng = createRNG(1);

      for (let i = 0; i < 10; i++) {
        expect(typeof rng.bool()).toBe('boolean');
      }
    });

    it('should respect probability', () => {
      const rng = createRNG(42);

      // With probability 1, should always return true
      for (let i = 0; i < 10; i++) {
        expect(rng.bool(1)).toBe(true);
      }

      // With probability 0, should always return false
      for (let i = 0; i < 10; i++) {
        expect(rng.bool(0)).toBe(false);
      }
    });
  });

  describe('pick', () => {
    it('should pick elements from array', () => {
      const rng = createRNG(7);
      const arr = ['a', 'b', 'c', 'd', 'e'];

      for (let i = 0; i < 20; i++) {
        const picked = rng.pick(arr);
        expect(arr).toContain(picked);
      }
    });

    it('should be deterministic with same seed', () => {
      const rng1 = createRNG(888);
      const rng2 = createRNG(888);
      const arr = [1, 2, 3, 4, 5];

      expect(rng1.pick(arr)).toBe(rng2.pick(arr));
      expect(rng1.pick(arr)).toBe(rng2.pick(arr));
    });

    it('should return undefined for empty array', () => {
      const rng = createRNG(1);

      expect(rng.pick([])).toBeUndefined();
    });
  });

  describe('shuffle', () => {
    it('should return the same array reference', () => {
      const rng = createRNG(1);
      const arr = [1, 2, 3, 4, 5];
      const result = rng.shuffle(arr);

      expect(result).toBe(arr);
    });

    it('should contain all original elements', () => {
      const rng = createRNG(42);
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const original = [...arr];

      rng.shuffle(arr);

      expect(arr.sort()).toEqual(original.sort());
    });

    it('should be deterministic with same seed', () => {
      const rng1 = createRNG(333);
      const rng2 = createRNG(333);
      const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const arr2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      rng1.shuffle(arr1);
      rng2.shuffle(arr2);

      expect(arr1).toEqual(arr2);
    });

    it('should produce different order (usually)', () => {
      const rng = createRNG(999);
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const original = [...arr];

      rng.shuffle(arr);

      // Very unlikely to stay in same order
      expect(arr).not.toEqual(original);
    });
  });
});
