/**
 * Merge Games Generator — null return paths
 *
 * Tests that generateLevel() returns null when:
 *   1. The first verifyGrid call fails AND the clean-grid retry also fails.
 *   2. generateBatch exhausts maxAttempts when all generations fail.
 *
 * Uses vi.mock to stub isSolvable so every grid is reported unsolvable,
 * exercising the `return null` branch at line 182 of generator.js.
 */

import { describe, it, expect, vi } from 'vitest';

// Stub isSolvable to always return false →
// verifyGrid(grid, task) returns false → distractor cleanup → verifyGrid(cleanGrid, task) also false → return null
vi.mock('../../src/games/merge-games/state.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    isSolvable: vi.fn(() => false),
  };
});

import { generateLevel, generateBatch } from '../../src/games/merge-games/generator.js';

describe('generateLevel — null return (both verifyGrid calls fail)', () => {
  it('returns null when isSolvable always returns false (cleanGrid retry also fails)', () => {
    // isSolvable mocked to false → verifyGrid returns false on both attempts → null
    const result = generateLevel(42, 'easy', 0);
    expect(result).toBeNull();
  });

  it('returns null for medium difficulty when isSolvable is always false', () => {
    const result = generateLevel(42, 'medium', 0);
    expect(result).toBeNull();
  });
});

describe('generateBatch — maxAttempts exhausted when all generations return null', () => {
  it('returns fewer levels than requested when generateLevel always returns null', () => {
    // generateLevel always returns null → generateBatch exhausts maxAttempts → empty array
    const result = generateBatch(1, 'easy', 2);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThan(2);
  });
});
