/**
 * Merge Games - Solver Tests
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { createInitialState, applyMerge, getMerges, isComplete, isSolvable } from '../../src/games/merge-games/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const levels = JSON.parse(
  readFileSync(join(__dirname, '../../src/games/merge-games/levels.json'), 'utf8')
);

/**
 * Greedy solver: always merge the highest-tier pair first.
 * Returns final state or null if stuck.
 */
function greedySolve(level, maxMerges = 200) {
  let state = createInitialState(level);
  let iterations = 0;
  while (!isComplete(state) && iterations < maxMerges) {
    const merges = getMerges(state);
    if (merges.length === 0) return null;
    // Pick highest tier pair
    const best = merges.reduce((a, b) => {
      const ta = state.grid[a.r1][a.c1];
      const tb = state.grid[b.r1][b.c1];
      return ta >= tb ? a : b;
    });
    state = applyMerge(state, best.r1, best.c1, best.r2, best.c2);
    iterations++;
  }
  return isComplete(state) ? state : null;
}

describe('Merge Games Solver', () => {
  it('has at least 10 levels', () => {
    expect(levels.length).toBeGreaterThanOrEqual(10);
  });

  it('every level has a task', () => {
    for (const level of levels) {
      expect(level.task).toBeDefined();
      expect(level.task.targetTier).toBeGreaterThan(0);
      expect(level.task.targetCount).toBeGreaterThan(0);
    }
  });

  it('every level has a non-empty grid', () => {
    for (const level of levels) {
      const items = level.grid.flat().filter(v => v > 0);
      expect(items.length).toBeGreaterThan(0);
    }
  });

  for (const level of levels) {
    it(`level ${level.id} is solvable (DFS)`, () => {
      expect(isSolvable(level)).toBe(true);
    });

    it(`level ${level.id} greedy solver wins`, () => {
      const result = greedySolve(level);
      expect(result).not.toBeNull();
      expect(result.status).toBe('won');
    });
  }

  it('greedy solver completes all levels within 200 merges', () => {
    for (const level of levels) {
      const result = greedySolve(level, 200);
      expect(result).not.toBeNull();
    }
  });
});
