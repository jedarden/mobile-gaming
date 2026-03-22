/**
 * Water Sort — Solver Tests
 *
 * Verifies that all 30 hand-crafted levels are solvable using the BFS solver
 * in tests/solvers/water-sort-solver.js, and that each solution produced is valid.
 *
 * Also tests the solver and validateSolution utilities directly.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { solve, validateSolution } from './water-sort-solver.js';
import { createInitialState, checkWin, pour } from '../../src/games/water-sort/state.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const LEVELS = JSON.parse(
  readFileSync(join(__dir, '../../src/games/water-sort/levels.json'), 'utf8')
);

// ── Structural checks ─────────────────────────────────────────────────────────

describe('Water Sort Levels', () => {
  it('has 30 levels', () => {
    expect(LEVELS.length).toBe(30);
  });

  it('every level has required fields', () => {
    for (const level of LEVELS) {
      expect(level).toHaveProperty('id');
      expect(level).toHaveProperty('tubes');
      expect(level).toHaveProperty('maxSegments');
      expect(level).toHaveProperty('difficulty');
      expect(level).toHaveProperty('optimal');
    }
  });

  it('every level has valid color counts (each color appears exactly maxSegments times)', () => {
    for (const level of LEVELS) {
      const counts = {};
      for (const tube of level.tubes) {
        for (const color of tube) {
          counts[color] = (counts[color] || 0) + 1;
        }
      }
      const invalid = Object.entries(counts).filter(([, n]) => n !== level.maxSegments);
      expect(invalid, `${level.id}: ${invalid.map(([c, n]) => `${c}=${n}`).join(', ')}`).toHaveLength(0);
    }
  });

  it('every level starts in a non-won state', () => {
    for (const level of LEVELS) {
      const state = createInitialState(level);
      expect(checkWin(state), `${level.id} is already solved`).toBe(false);
    }
  });

  it('all levels have difficulty in [0, 1]', () => {
    for (const level of LEVELS) {
      expect(level.difficulty).toBeGreaterThanOrEqual(0);
      expect(level.difficulty).toBeLessThanOrEqual(1);
    }
  });
});

// ── Solvability — one test per level ─────────────────────────────────────────

describe('Water Sort Solver — all levels solvable', () => {
  for (const level of LEVELS) {
    it(`${level.id} (diff=${level.difficulty}) is solvable`, () => {
      const solution = solve(level);
      expect(solution, `${level.id}: BFS returned null`).not.toBeNull();
      expect(solution.length, `${level.id}: solution is empty`).toBeGreaterThan(0);
    });
  }
});

// ── Solution validity — one test per level ────────────────────────────────────

describe('Water Sort Solver — solutions are valid', () => {
  for (const level of LEVELS) {
    it(`${level.id} solution passes validateSolution`, () => {
      const solution = solve(level);
      if (!solution) return; // already caught above
      const result = validateSolution(level, solution);
      expect(result.valid, `${level.id}: ${result.message}`).toBe(true);
    });
  }
});

// ── validateSolution unit tests ───────────────────────────────────────────────

describe('validateSolution', () => {
  const SIMPLE_LEVEL = {
    id: 'test-simple',
    tubes: [
      ['red', 'blue', 'red', 'blue'],
      ['blue', 'red', 'blue', 'red'],
      []
    ],
    maxSegments: 4
  };

  it('rejects an empty solution for an unsolved puzzle', () => {
    const result = validateSolution(SIMPLE_LEVEL, []);
    expect(result.valid).toBe(false);
  });

  it('accepts a correct solution', () => {
    const solution = solve(SIMPLE_LEVEL);
    expect(solution).not.toBeNull();
    const result = validateSolution(SIMPLE_LEVEL, solution);
    expect(result.valid).toBe(true);
  });

  it('rejects a solution with an illegal pour', () => {
    // Pour from tube 2 (empty) — illegal
    const result = validateSolution(SIMPLE_LEVEL, [[2, 0]]);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/cannot pour/i);
  });

  it('rejects a solution that does not reach the win state', () => {
    // A single valid pour that does not complete the puzzle
    const state = createInitialState(SIMPLE_LEVEL);
    const solution = solve(SIMPLE_LEVEL);
    // Use all but the last move — puzzle won't be complete
    if (solution && solution.length > 1) {
      const partial = solution.slice(0, -1);
      const result = validateSolution(SIMPLE_LEVEL, partial);
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/does not reach win state/i);
    }
  });

  it('message reports move count for valid solution', () => {
    const solution = solve(SIMPLE_LEVEL);
    if (solution) {
      const result = validateSolution(SIMPLE_LEVEL, solution);
      expect(result.message).toContain(String(solution.length));
    }
  });
});

// ── solve() edge cases ────────────────────────────────────────────────────────

describe('solve', () => {
  it('returns empty array for an already-won puzzle', () => {
    const wonLevel = {
      id: 'test-won',
      tubes: [
        ['red', 'red', 'red', 'red'],
        ['blue', 'blue', 'blue', 'blue'],
        []
      ],
      maxSegments: 4
    };
    const solution = solve(wonLevel);
    expect(solution).toEqual([]);
  });

  it('returns null for a deadlocked puzzle', () => {
    // Two full tubes of different interlocked colors, no buffer
    // (completely deadlocked — no valid moves)
    const stuckLevel = {
      id: 'test-stuck',
      tubes: [
        ['red', 'blue', 'red', 'blue'],
        ['blue', 'red', 'blue', 'red']
      ],
      maxSegments: 4
    };
    const solution = solve(stuckLevel);
    expect(solution).toBeNull();
  });

  it('returns a solution array of [fromIdx, toIdx] pairs', () => {
    const solution = solve(LEVELS[0]);
    expect(Array.isArray(solution)).toBe(true);
    for (const move of solution) {
      expect(Array.isArray(move)).toBe(true);
      expect(move).toHaveLength(2);
      expect(typeof move[0]).toBe('number');
      expect(typeof move[1]).toBe('number');
    }
  });

  it('solution length is reasonable (at most 100 moves for first 10 levels)', () => {
    for (const level of LEVELS.slice(0, 10)) {
      const solution = solve(level);
      if (solution) {
        expect(solution.length).toBeLessThanOrEqual(100);
      }
    }
  });
});
