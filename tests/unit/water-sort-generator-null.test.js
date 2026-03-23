/**
 * Water Sort Generator — null return path
 *
 * Tests that generateLevel() returns null when all 10 generation attempts
 * fail validation. Uses vi.mock to stub checkWin so that every generated
 * tube arrangement is treated as "already solved", forcing all attempts to
 * fail and exercising the `return null` branch at the end of generateLevel.
 */

import { describe, it, expect, vi } from 'vitest';

// Stub checkWin (imported by generator) to always return true →
// validateLevel short-circuits at "Must not be already solved" for every attempt
vi.mock('../../src/games/water-sort/state.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    checkWin: vi.fn(() => true),
  };
});

import { generateLevel, generateLevels } from '../../src/games/water-sort/generator.js';

describe('generateLevel — null return (all attempts fail validation)', () => {
  it('returns null when every generation attempt fails validation (checkWin always true)', () => {
    // checkWin is mocked to always return true → validateLevel returns false
    // for all 10 attempts → generateLevel exhausts the loop and returns null
    const result = generateLevel(42, 0.5);
    expect(result).toBeNull();
  });
});

describe('generateLevels — if (level) false branch (null levels excluded)', () => {
  it('returns fewer levels than requested when generateLevel returns null for every seed', () => {
    // generateLevel always returns null (checkWin mocked) → if (level) is false
    // for every iteration → no levels pushed → empty array returned
    const result = generateLevels(0, 3, 0.5);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThan(3); // fewer than requested
  });
});
