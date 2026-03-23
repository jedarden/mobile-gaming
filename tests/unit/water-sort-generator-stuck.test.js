/**
 * Water Sort Generator — stuck state validation branch
 *
 * Tests that generateLevel() returns null when all generation attempts
 * produce states with no valid moves. Uses vi.mock to stub getValidMoves
 * so every generated arrangement is treated as "stuck" (no valid pours),
 * exercising the `if (getValidMoves(state).length === 0) return false`
 * branch inside validateLevelInternal (state.js line 119).
 */

import { describe, it, expect, vi } from 'vitest';

// Stub getValidMoves to always return [] (stuck — no valid pours exist),
// while checkWin always returns false so the stuck check is reached.
vi.mock('../../src/games/water-sort/state.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    checkWin: vi.fn(() => false),     // Not already solved
    getValidMoves: vi.fn(() => []),   // But completely stuck → fails check 2
  };
});

import { generateLevel, generateLevels } from '../../src/games/water-sort/generator.js';

describe('generateLevel — null return (stuck-state validation branch)', () => {
  it('returns null when every attempt is stuck (getValidMoves === 0 branch)', () => {
    // validateLevelInternal line 119: if (getValidMoves(state).length === 0) return false
    // All 50 retries fail this check → generateLevel exhausts and returns null
    const result = generateLevel(1, 0.5);
    expect(result).toBeNull();
  });
});

describe('generateLevels — if (level) false when stuck', () => {
  it('returns empty array when all levels are stuck (null excluded by if(level) check)', () => {
    const result = generateLevels(0, 3, 0.5);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});
