/**
 * Pull the Pin Generator — null return path
 *
 * Tests that generateLevel() returns null when all 10 generation attempts
 * fail solvability checks. Uses vi.mock to stub simulateToCompletion so
 * every simulated state is 'lost', making findSolution() always return null,
 * which makes isLevelSolvable() always return false, exhausting all retries.
 */

import { describe, it, expect, vi } from 'vitest';

// Stub simulateToCompletion to always produce a losing state →
// findSolution returns null → isLevelSolvable returns false for every attempt
vi.mock('../../src/games/pull-the-pin/state.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    simulateToCompletion: vi.fn(() => ({ status: 'lost', balls: [], cups: [], pins: [] })),
  };
});

import { generateLevel, generateBatch } from '../../src/games/pull-the-pin/generator.js';

describe('generateLevel — null return (all 10 attempts fail solvability)', () => {
  it('returns null when every attempt fails isLevelSolvable (exhausted retries)', () => {
    // simulateToCompletion always returns status:'lost' → findSolution returns null
    // → isLevelSolvable returns false → all 10 retries fail → return null
    const result = generateLevel(42, 'easy', 0);
    expect(result).toBeNull();
  });
});

describe('generateBatch — maxAttempts exhausted (attempts >= maxAttempts loop exit)', () => {
  it('returns fewer levels than requested when all generation attempts fail', () => {
    // generateLevel always returns null (simulateToCompletion mocked to 'lost')
    // → generateBatch exhausts count*20 attempts without producing any valid levels
    // → loop exits via attempts >= maxAttempts → returns empty array
    const result = generateBatch(100, 'easy', 3);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThan(3); // fewer than requested → maxAttempts path
  });
});
