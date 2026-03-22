/**
 * Merge Games - Solver Tests
 *
 * Verifies hand-crafted levels are solvable via DFS (isSolvable) and greedy solver,
 * and that procedurally generated levels are also solvable end-to-end.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { createInitialState, applyMerge, getMerges, isComplete, isSolvable } from '../../src/games/merge-games/state.js';
import { generateBatch } from '../../src/games/merge-games/generator.js';

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

  it('isSolvable returns false for an unsolvable configuration', () => {
    // Two tier-1 items can only produce one tier-2; goal of tier-3 is unreachable
    const impossible = {
      width: 2, height: 1,
      grid: [[1, 1]],
      task: { targetTier: 3, targetCount: 1 }
    };
    expect(isSolvable(impossible)).toBe(false);
  });

  it('isSolvable respects the maxStates cutoff', () => {
    // With maxStates=1 the DFS loop never executes (visited starts at size 1);
    // any non-trivially-complete level must return false
    const level = levels[0]; // first level requires merges to solve
    expect(isSolvable(level, 1)).toBe(false);
  });

  it('isSolvable is deterministic — same level always returns same result', () => {
    for (const level of levels) {
      const first  = isSolvable(level);
      const second = isSolvable(level);
      expect(first).toBe(second);
    }
  });

  it('isSolvable returns true for a trivially complete initial state', () => {
    // Grid already has targetTier at targetCount — isComplete fires immediately
    const trivial = {
      width: 2, height: 1,
      grid: [[3, 0]],
      task: { targetTier: 3, targetCount: 1 }
    };
    expect(isSolvable(trivial)).toBe(true);
  });
});

// ── Generated level solvability ────────────────────────────────────────────────
//
// The merge-games generator calls isSolvable() internally, so generated levels
// are guaranteed solvable by construction. These tests verify the full pipeline:
// generateBatch → isSolvable → greedy solver.

describe('Merge Games — generated easy levels', () => {
  const GEN_LEVELS = generateBatch(50000, 'easy', 5);

  it('generates 5 easy levels', () => {
    expect(GEN_LEVELS.length).toBe(5);
  });

  it('every generated easy level has task and grid', () => {
    for (const level of GEN_LEVELS) {
      expect(level.task).toBeDefined();
      expect(level.task.targetTier).toBeGreaterThan(0);
      const items = level.grid.flat().filter(v => v > 0);
      expect(items.length).toBeGreaterThan(0);
    }
  });

  for (let i = 0; i < 5; i++) {
    it(`generated easy level ${i} passes isSolvable`, () => {
      const level = GEN_LEVELS[i];
      expect(isSolvable(level)).toBe(true);
    });

    it(`generated easy level ${i} greedy solver wins`, () => {
      const level = GEN_LEVELS[i];
      let state = createInitialState(level);
      let iterations = 0;
      while (!isComplete(state) && iterations < 200) {
        const merges = getMerges(state);
        if (merges.length === 0) break;
        const best = merges.reduce((a, b) =>
          state.grid[a.r1][a.c1] >= state.grid[b.r1][b.c1] ? a : b);
        state = applyMerge(state, best.r1, best.c1, best.r2, best.c2);
        iterations++;
      }
      expect(isComplete(state)).toBe(true);
    });
  }
});

describe('Merge Games — generated medium levels', () => {
  const GEN_LEVELS = generateBatch(60000, 'medium', 5);

  it('generates 5 medium levels', () => {
    expect(GEN_LEVELS.length).toBe(5);
  });

  for (let i = 0; i < 5; i++) {
    it(`generated medium level ${i} passes isSolvable`, () => {
      expect(isSolvable(GEN_LEVELS[i])).toBe(true);
    });
  }
});

describe('Merge Games — generated hard levels', () => {
  const GEN_LEVELS = generateBatch(70000, 'hard', 3);

  it('generates 3 hard levels', () => {
    expect(GEN_LEVELS.length).toBe(3);
  });

  for (let i = 0; i < 3; i++) {
    it(`generated hard level ${i} passes isSolvable`, () => {
      expect(isSolvable(GEN_LEVELS[i])).toBe(true);
    });
  }
});
