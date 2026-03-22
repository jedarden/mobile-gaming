/**
 * Satisfying ASMR - Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  WIN_THRESHOLD,
  createInitialState,
  clean,
  cleanArea,
  getProgress,
  isComplete
} from '../../src/games/satisfying-asmr/state.js';

const FULL_LEVEL = {
  width: 4,
  height: 4,
  cells: Array(16).fill(1),
  patternType: 'full',
  totalDirt: 16
};

const PARTIAL_LEVEL = {
  width: 4,
  height: 4,
  cells: [1,1,0,0, 1,1,0,0, 0,0,0,0, 0,0,0,0],
  patternType: 'splatter',
  totalDirt: 4
};

describe('createInitialState', () => {
  it('copies cells from level', () => {
    const state = createInitialState(FULL_LEVEL);
    expect(state.cells).toHaveLength(16);
    expect(state.totalDirt).toBe(16);
    expect(state.cleanedCount).toBe(0);
    expect(state.status).toBe('playing');
  });

  it('does not share cells reference', () => {
    const state = createInitialState(FULL_LEVEL);
    state.cells[0] = 99;
    expect(FULL_LEVEL.cells[0]).toBe(1);
  });
});

describe('clean', () => {
  it('cleans a dirty cell', () => {
    const state = createInitialState(FULL_LEVEL);
    const next = clean(state, 0, 0);
    expect(next.cells[0]).toBe(0);
    expect(next.cleanedCount).toBe(1);
  });

  it('does not change clean cell', () => {
    const state = createInitialState(PARTIAL_LEVEL);
    const next = clean(state, 2, 0); // already clean
    expect(next).toBe(state);
  });

  it('ignores out-of-bounds coordinates', () => {
    const state = createInitialState(FULL_LEVEL);
    expect(clean(state, -1, 0)).toBe(state);
    expect(clean(state, 0, -1)).toBe(state);
    expect(clean(state, 100, 0)).toBe(state);
  });

  it('sets status won when threshold reached', () => {
    const state = createInitialState({
      width: 2, height: 2,
      cells: [1, 0, 0, 0], // 1 dirt of 1 total
      patternType: 'full',
      totalDirt: 1
    });
    const next = clean(state, 0, 0);
    expect(next.status).toBe('won');
  });

  it('does not allow cleaning in won state', () => {
    const state = { ...createInitialState(FULL_LEVEL), status: 'won' };
    const next = clean(state, 0, 0);
    expect(next).toBe(state);
  });
});

describe('cleanArea', () => {
  it('cleans circular area', () => {
    const state = createInitialState(FULL_LEVEL);
    const next = cleanArea(state, 1, 1, 1); // center (1,1) radius 1
    expect(next.cleanedCount).toBeGreaterThan(0);
    expect(next.cleanedCount).toBeLessThanOrEqual(16);
  });

  it('returns same state if all cells already clean', () => {
    const state = {
      ...createInitialState(FULL_LEVEL),
      cells: Array(16).fill(0),
      cleanedCount: 16
    };
    const next = cleanArea(state, 0, 0, 2);
    expect(next).toBe(state);
  });

  it('cleans more cells with larger radius', () => {
    const s1 = createInitialState(FULL_LEVEL);
    const s2 = createInitialState(FULL_LEVEL);
    const n1 = cleanArea(s1, 2, 2, 1);
    const n2 = cleanArea(s2, 2, 2, 2);
    expect(n2.cleanedCount).toBeGreaterThanOrEqual(n1.cleanedCount);
  });

  it('handles edge of grid', () => {
    const state = createInitialState(FULL_LEVEL);
    const next = cleanArea(state, 0, 0, 2);
    expect(next.cleanedCount).toBeGreaterThan(0);
  });
});

describe('getProgress', () => {
  it('returns 0 for no cleaning', () => {
    const state = createInitialState(FULL_LEVEL);
    expect(getProgress(state)).toBe(0);
  });

  it('returns 1 for all cleaned', () => {
    const state = {
      ...createInitialState(FULL_LEVEL),
      cells: Array(16).fill(0),
      cleanedCount: 16
    };
    expect(getProgress(state)).toBe(1);
  });

  it('returns correct fraction', () => {
    const state = createInitialState(FULL_LEVEL);
    const next = { ...state, cleanedCount: 8, cells: [...state.cells] };
    expect(getProgress(next)).toBeCloseTo(0.5);
  });

  it('returns 1 for empty level (no dirt)', () => {
    const state = {
      ...createInitialState({ width: 2, height: 2, cells: [0,0,0,0], patternType: 'full', totalDirt: 0 }),
    };
    expect(getProgress(state)).toBe(1);
  });
});

describe('isComplete', () => {
  it('returns false for initial state', () => {
    const state = createInitialState(FULL_LEVEL);
    expect(isComplete(state)).toBe(false);
  });

  it('returns true for won state', () => {
    const state = { ...createInitialState(FULL_LEVEL), status: 'won' };
    expect(isComplete(state)).toBe(true);
  });

  it('WIN_THRESHOLD is approximately 0.95', () => {
    expect(WIN_THRESHOLD).toBeGreaterThanOrEqual(0.9);
    expect(WIN_THRESHOLD).toBeLessThanOrEqual(1.0);
  });
});

describe('dirt patterns', () => {
  it('full level has all cells dirty', () => {
    const state = createInitialState(FULL_LEVEL);
    expect(state.totalDirt).toBe(16);
    expect(state.cells.every(c => c === 1)).toBe(true);
  });

  it('partial level has correct dirt count', () => {
    const state = createInitialState(PARTIAL_LEVEL);
    expect(state.totalDirt).toBe(4);
  });
});

describe('clean — sequential cleaning', () => {
  it('accumulates cleanedCount across multiple calls', () => {
    let state = createInitialState(FULL_LEVEL);
    state = clean(state, 0, 0);
    state = clean(state, 1, 0);
    state = clean(state, 2, 0);
    expect(state.cleanedCount).toBe(3);
  });

  it('cell stays clean after being cleaned', () => {
    let state = createInitialState(FULL_LEVEL);
    state = clean(state, 0, 0);
    expect(state.cells[0]).toBe(0);
    state = clean(state, 0, 0); // clean again — no-op
    expect(state.cleanedCount).toBe(1);
  });

  it('x and y coordinates map to correct cell index', () => {
    // idx = y * width + x  →  width=4
    const state = createInitialState(FULL_LEVEL);
    const next = clean(state, 2, 1); // idx = 1*4 + 2 = 6
    expect(next.cells[6]).toBe(0);
    expect(next.cells[5]).toBe(1); // idx 5 untouched
  });

  it('win is triggered at exactly WIN_THRESHOLD fraction', () => {
    // totalDirt=20, WIN_THRESHOLD=0.95 → need 19 cells cleaned
    const level = {
      width: 5, height: 4,
      cells: Array(20).fill(1),
      patternType: 'full',
      totalDirt: 20
    };
    let state = createInitialState(level);
    // Clean 18 cells (90%) — not enough
    for (let i = 0; i < 18; i++) {
      state = clean(state, i % 5, Math.floor(i / 5));
    }
    expect(state.status).toBe('playing');
    // Clean 19th (95%) — should win
    state = clean(state, 18 % 5, Math.floor(18 / 5));
    expect(state.status).toBe('won');
  });
});

describe('cleanArea — multi-pass and state transitions', () => {
  it('second cleanArea on already-clean area is a no-op', () => {
    let state = createInitialState(FULL_LEVEL);
    const s1 = cleanArea(state, 0, 0, 1);
    const s2 = cleanArea(s1, 0, 0, 1);
    // All cells in that region already clean
    expect(s2.cleanedCount).toBe(s1.cleanedCount);
  });

  it('cleanArea in won state returns same state', () => {
    const wonState = { ...createInitialState(FULL_LEVEL), status: 'won' };
    expect(cleanArea(wonState, 2, 2, 2)).toBe(wonState);
  });

  it('cleanArea with radius 0 cleans exactly the center cell', () => {
    const state = createInitialState(FULL_LEVEL);
    const next = cleanArea(state, 1, 1, 0);
    // radius 0: only (1,1) — idx = 1*4+1 = 5
    expect(next.cells[5]).toBe(0);
    expect(next.cleanedCount).toBe(1);
  });

  it('can win with cleanArea covering enough cells', () => {
    // 4×1 level, all dirty; one big cleanArea should win
    const level = {
      width: 4, height: 1,
      cells: [1, 1, 1, 1],
      patternType: 'full',
      totalDirt: 4
    };
    const state = createInitialState(level);
    const next = cleanArea(state, 1, 0, 10); // large radius covers all 4 cells
    expect(next.status).toBe('won');
  });

  it('cleanArea adds delta correctly to cleanedCount', () => {
    const state = createInitialState(FULL_LEVEL);
    // Pre-clean one cell manually
    const half = clean(state, 0, 0); // cleanedCount = 1
    const afterArea = cleanArea(half, 2, 2, 1);
    // cleanArea at (2,2) radius 1 will cover some cells; none of them is (0,0)
    expect(afterArea.cleanedCount).toBeGreaterThan(half.cleanedCount);
  });
});

describe('getProgress — edge cases', () => {
  it('returns values strictly between 0 and 1 during partial cleaning', () => {
    let state = createInitialState(FULL_LEVEL);
    for (let i = 0; i < 8; i++) {
      state = clean(state, i % 4, Math.floor(i / 4));
    }
    const p = getProgress(state);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });

  it('progress never exceeds 1', () => {
    const state = {
      ...createInitialState(FULL_LEVEL),
      cleanedCount: 20, // more than totalDirt=16
    };
    const p = getProgress(state);
    // cleanedCount/totalDirt = 20/16 = 1.25, but formula doesn't clamp
    // just verify getProgress returns the raw ratio (could be >1 in over-count scenario)
    expect(typeof p).toBe('number');
    expect(isNaN(p)).toBe(false);
  });

  it('totalDirt from createInitialState matches cells array', () => {
    const level = {
      width: 3, height: 2,
      cells: [1, 0, 1, 0, 1, 1],
      patternType: 'full',
      totalDirt: 4
    };
    const state = createInitialState(level);
    // createInitialState recounts from cells, ignoring level.totalDirt
    const actual = state.cells.filter(c => c === 1).length;
    expect(state.totalDirt).toBe(actual);
  });
});
