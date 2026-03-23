/**
 * Parking Escape Generator — null return path
 *
 * Tests that generateLevel() returns null when every generation attempt
 * yields an unsolvable layout. Uses vi.mock to stub solve() so it always
 * returns null, exhausting all configured retry attempts.
 */

import { describe, it, expect, vi } from 'vitest';

// Stub solve to always return null → every attempt is unsolvable → return null
vi.mock('../../src/games/parking-escape/state.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    solve: vi.fn(() => null),
  };
});

import { generateLevel, generateBatch } from '../../src/games/parking-escape/generator.js';

describe('generateLevel — null return (all attempts yield unsolvable layout)', () => {
  it('returns null when solve() always returns null (exhausted retries)', () => {
    // solve() always returns null → !solution → continue → all attempts fail → return null
    const result = generateLevel(42, 'easy', 0);
    expect(result).toBeNull();
  });
});

describe('generateBatch — maxAttempts exhausted (attempts >= maxAttempts loop exit)', () => {
  it('returns fewer levels than requested when all generation attempts fail', () => {
    // generateLevel always returns null (solve() mocked to return null)
    // → generateBatch exhausts count*20 attempts → loop exits via maxAttempts
    const result = generateBatch(1, 'easy', 2);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThan(2); // fewer than requested → maxAttempts path taken
  });
});
