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
