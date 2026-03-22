/**
 * Merge Games - Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  getMerges,
  applyMerge,
  countTier,
  isComplete,
  encodeGrid,
  isSolvable
} from '../../src/games/merge-games/state.js';

const SIMPLE_LEVEL = {
  width: 3,
  height: 3,
  grid: [
    [1, 1, 0],
    [0, 0, 0],
    [0, 0, 0]
  ],
  task: { targetTier: 2, targetCount: 1 }
};

const MULTI_LEVEL = {
  width: 4,
  height: 2,
  grid: [
    [2, 2, 0, 0],
    [0, 0, 2, 2]
  ],
  task: { targetTier: 3, targetCount: 2 }
};

describe('createInitialState', () => {
  it('copies grid from level', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(state.grid).toHaveLength(3);
    expect(state.grid[0]).toEqual([1, 1, 0]);
    expect(state.moves).toBe(0);
    expect(state.status).toBe('playing');
  });

  it('does not share grid reference', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    state.grid[0][0] = 99;
    expect(SIMPLE_LEVEL.grid[0][0]).toBe(1);
  });

  it('has task from level', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(state.task.targetTier).toBe(2);
    expect(state.task.targetCount).toBe(1);
  });
});

describe('getMerges', () => {
  it('finds horizontal adjacent pair', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const merges = getMerges(state);
    expect(merges.length).toBeGreaterThan(0);
    expect(merges[0]).toMatchObject({ r1: 0, c1: 0, r2: 0, c2: 1 });
  });

  it('finds vertical adjacent pair', () => {
    const state = createInitialState({
      width: 2, height: 2,
      grid: [[1, 0], [1, 0]],
      task: { targetTier: 2, targetCount: 1 }
    });
    const merges = getMerges(state);
    expect(merges.some(m => m.r1 === 0 && m.c1 === 0 && m.r2 === 1 && m.c2 === 0)).toBe(true);
  });

  it('does not find pairs of different tiers', () => {
    const state = createInitialState({
      width: 2, height: 1,
      grid: [[1, 2]],
      task: { targetTier: 3, targetCount: 1 }
    });
    expect(getMerges(state)).toHaveLength(0);
  });

  it('returns empty when no pairs', () => {
    const state = createInitialState({
      width: 2, height: 2,
      grid: [[0, 0], [0, 1]],
      task: { targetTier: 2, targetCount: 1 }
    });
    expect(getMerges(state)).toHaveLength(0);
  });
});

describe('applyMerge', () => {
  it('merges two tier-1 cells into tier-2', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next = applyMerge(state, 0, 0, 0, 1);
    expect(next.grid[0][0]).toBe(2);
    expect(next.grid[0][1]).toBe(0);
    expect(next.moves).toBe(1);
  });

  it('returns same state for mismatched tiers', () => {
    const state = createInitialState({
      width: 2, height: 1,
      grid: [[1, 2]],
      task: { targetTier: 3, targetCount: 1 }
    });
    const next = applyMerge(state, 0, 0, 0, 1);
    expect(next).toBe(state);
  });

  it('returns same state for non-adjacent cells', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next = applyMerge(state, 0, 0, 2, 2);
    expect(next).toBe(state);
  });

  it('sets status to won when task complete', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next = applyMerge(state, 0, 0, 0, 1);
    expect(next.status).toBe('won');
  });

  it('increments moves on valid merge', () => {
    const state = createInitialState(MULTI_LEVEL);
    const next = applyMerge(state, 0, 0, 0, 1);
    expect(next.moves).toBe(1);
  });

  it('does not merge in won state', () => {
    const state = { ...createInitialState(SIMPLE_LEVEL), status: 'won' };
    const next = applyMerge(state, 0, 0, 0, 1);
    expect(next).toBe(state);
  });
});

describe('countTier', () => {
  it('counts items of specific tier', () => {
    const state = createInitialState(MULTI_LEVEL);
    expect(countTier(state, 2)).toBe(4);
    expect(countTier(state, 1)).toBe(0);
    expect(countTier(state, 0)).toBe(4);
  });

  it('counts zero when none present', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(countTier(state, 5)).toBe(0);
  });
});

describe('isComplete', () => {
  it('returns false for initial state', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(isComplete(state)).toBe(false);
  });

  it('returns true after winning merge', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next = applyMerge(state, 0, 0, 0, 1);
    expect(isComplete(next)).toBe(true);
  });

  it('returns false if count not met', () => {
    const state = createInitialState(MULTI_LEVEL);
    const next = applyMerge(state, 0, 0, 0, 1); // produces one tier-3
    expect(isComplete(next)).toBe(false); // need 2
  });
});

describe('encodeGrid', () => {
  it('returns consistent string for same grid', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const k1 = encodeGrid(state.grid);
    const k2 = encodeGrid(state.grid);
    expect(k1).toBe(k2);
  });

  it('returns different string for different grids', () => {
    const s1 = createInitialState(SIMPLE_LEVEL);
    const s2 = applyMerge(s1, 0, 0, 0, 1);
    expect(encodeGrid(s1.grid)).not.toBe(encodeGrid(s2.grid));
  });
});

describe('isSolvable', () => {
  it('returns true for simple level', () => {
    expect(isSolvable(SIMPLE_LEVEL)).toBe(true);
  });

  it('returns false for impossible level', () => {
    const impossible = {
      width: 2, height: 2,
      grid: [[1, 0], [2, 0]],
      task: { targetTier: 3, targetCount: 1 }
    };
    expect(isSolvable(impossible)).toBe(false);
  });

  it('returns true when goal already met', () => {
    const done = {
      width: 2, height: 1,
      grid: [[3, 0]],
      task: { targetTier: 3, targetCount: 1 }
    };
    expect(isSolvable(done)).toBe(true);
  });

  it('returns false when maxStates is 1 (explores nothing)', () => {
    // With maxStates=1, DFS immediately stops — only catches already-complete states
    const unsolved = {
      width: 2, height: 1,
      grid: [[1, 1]],
      task: { targetTier: 2, targetCount: 1 }
    };
    // maxStates=1: visited set fills after first entry, loop never runs second iteration
    expect(isSolvable(unsolved, 1)).toBe(false);
  });

  it('solves chain merge (1→2→3) on a 2D grid', () => {
    // 2x2 grid of tier-1s: merge row-wise then vertically to reach tier-3
    const chain = {
      width: 2, height: 2,
      grid: [[1, 1], [1, 1]],
      task: { targetTier: 3, targetCount: 1 }
    };
    expect(isSolvable(chain)).toBe(true);
  });
});

describe('applyMerge — chain scenarios', () => {
  it('produces tier-3 after two merges', () => {
    const level = {
      width: 4, height: 1,
      grid: [[1, 1, 1, 1]],
      task: { targetTier: 3, targetCount: 1 }
    };
    const s1 = createInitialState(level);
    const s2 = applyMerge(s1, 0, 0, 0, 1); // [2,0,1,1]
    expect(s2.grid[0][0]).toBe(2);
    const s3 = applyMerge(s2, 0, 2, 0, 3); // [2,0,2,0]
    expect(s3.grid[0][2]).toBe(2);
    const s4 = applyMerge(s3, 0, 0, 0, 2); // non-adjacent — should fail
    expect(s4).toBe(s3);
    // move tier-2 pieces adjacent
    const level2 = {
      width: 2, height: 1,
      grid: [[2, 2]],
      task: { targetTier: 3, targetCount: 1 }
    };
    const s5 = createInitialState(level2);
    const s6 = applyMerge(s5, 0, 0, 0, 1);
    expect(s6.grid[0][0]).toBe(3);
    expect(s6.status).toBe('won');
  });

  it('merges down (vertical neighbor)', () => {
    const level = {
      width: 1, height: 2,
      grid: [[2], [2]],
      task: { targetTier: 3, targetCount: 1 }
    };
    const state = createInitialState(level);
    const next = applyMerge(state, 0, 0, 1, 0);
    expect(next.grid[0][0]).toBe(3);
    expect(next.grid[1][0]).toBe(0);
    expect(next.status).toBe('won');
  });
});

describe('getMerges — larger grids', () => {
  it('finds all pairs in a full row', () => {
    const level = {
      width: 4, height: 1,
      grid: [[2, 2, 2, 2]],
      task: { targetTier: 3, targetCount: 1 }
    };
    const state = createInitialState(level);
    const merges = getMerges(state);
    // Horizontal pairs: (0,0)-(0,1), (0,1)-(0,2), (0,2)-(0,3) = 3 pairs
    expect(merges).toHaveLength(3);
  });

  it('ignores empty cells', () => {
    const level = {
      width: 3, height: 1,
      grid: [[1, 0, 1]],
      task: { targetTier: 2, targetCount: 1 }
    };
    const state = createInitialState(level);
    expect(getMerges(state)).toHaveLength(0);
  });
});

describe('countTier — all tiers', () => {
  it('counts each tier independently', () => {
    const level = {
      width: 4, height: 1,
      grid: [[1, 2, 3, 2]],
      task: { targetTier: 3, targetCount: 1 }
    };
    const state = createInitialState(level);
    expect(countTier(state, 1)).toBe(1);
    expect(countTier(state, 2)).toBe(2);
    expect(countTier(state, 3)).toBe(1);
    expect(countTier(state, 4)).toBe(0);
  });
});

describe('encodeGrid — canonical form', () => {
  it('same grid always produces same key', () => {
    const g = [[1, 2], [3, 0]];
    expect(encodeGrid(g)).toBe(encodeGrid([[1, 2], [3, 0]]));
  });

  it('different grids produce different keys', () => {
    const g1 = [[1, 2]];
    const g2 = [[2, 1]];
    expect(encodeGrid(g1)).not.toBe(encodeGrid(g2));
  });

  it('uses | as row separator', () => {
    const g = [[1, 2], [3, 4]];
    expect(encodeGrid(g)).toContain('|');
  });
});
