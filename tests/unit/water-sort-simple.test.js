/**
 * Water Sort - Additional State Tests
 *
 * Edge cases and supplemental coverage for LIQUID_COLORS,
 * createInitialState, calculateStars, and createGameHistory
 * not deeply exercised in water-sort.test.js.
 */

import { describe, it, expect } from 'vitest';
import {
  LIQUID_COLORS,
  createInitialState,
  calculateStars,
  createGameHistory,
  pour,
  cloneState
} from '../../src/games/water-sort/state.js';

describe('LIQUID_COLORS', () => {
  it('defines at least 8 named colors', () => {
    expect(Object.keys(LIQUID_COLORS).length).toBeGreaterThanOrEqual(8);
  });

  it('every color value is a valid hex string', () => {
    for (const [name, hex] of Object.entries(LIQUID_COLORS)) {
      expect(hex, `${name} should be a hex color`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('contains core game colors (red, blue, green, yellow)', () => {
    expect(LIQUID_COLORS).toHaveProperty('red');
    expect(LIQUID_COLORS).toHaveProperty('blue');
    expect(LIQUID_COLORS).toHaveProperty('green');
    expect(LIQUID_COLORS).toHaveProperty('yellow');
  });

  it('all color values are unique', () => {
    const values = Object.values(LIQUID_COLORS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

describe('createInitialState — edge cases', () => {
  it('handles single tube', () => {
    const state = createInitialState({ tubes: [['red']], maxSegments: 4 });
    expect(state.tubes).toHaveLength(1);
    expect(state.tubes[0].segments).toEqual(['red']);
  });

  it('handles all-empty tubes', () => {
    const state = createInitialState({ tubes: [[], [], []], maxSegments: 4 });
    expect(state.tubes).toHaveLength(3);
    state.tubes.forEach(t => expect(t.segments).toHaveLength(0));
  });

  it('assigns sequential ids to tubes', () => {
    const state = createInitialState({ tubes: [['red'], ['blue'], []], maxSegments: 4 });
    expect(state.tubes[0].id).toBe(0);
    expect(state.tubes[1].id).toBe(1);
    expect(state.tubes[2].id).toBe(2);
  });

  it('initializes selectedTube as null', () => {
    const state = createInitialState({ tubes: [['red'], []], maxSegments: 4 });
    expect(state.selectedTube).toBeNull();
  });

  it('does not share segment arrays with input', () => {
    const input = [['red', 'blue']];
    const state = createInitialState({ tubes: input, maxSegments: 4 });
    input[0].push('green');
    expect(state.tubes[0].segments).toHaveLength(2);
  });
});

describe('calculateStars — boundary conditions', () => {
  it('returns 3 for exactly optimal moves', () => {
    expect(calculateStars(10, 10)).toBe(3);
  });

  it('returns 3 when fewer moves than optimal', () => {
    // ratio < 1
    expect(calculateStars(4, 10)).toBe(3);
  });

  it('returns 2 at exactly 1.5x optimal', () => {
    expect(calculateStars(15, 10)).toBe(2);
  });

  it('returns 2 just above 1x optimal', () => {
    expect(calculateStars(11, 10)).toBe(2);
  });

  it('returns 1 at 2x optimal', () => {
    expect(calculateStars(20, 10)).toBe(1);
  });

  it('returns 1 for very high move count', () => {
    expect(calculateStars(1000, 5)).toBe(1);
  });
});

describe('createGameHistory', () => {
  it('returns a history object with push and undo', () => {
    const h = createGameHistory(10);
    expect(typeof h.push).toBe('function');
    expect(typeof h.undo).toBe('function');
    expect(typeof h.canUndo).toBe('function');
  });

  it('canUndo returns false on empty history', () => {
    const h = createGameHistory(5);
    expect(h.canUndo()).toBe(false);
  });

  it('undo returns null on empty history', () => {
    const h = createGameHistory(5);
    expect(h.undo()).toBeNull();
  });

  it('push and undo round-trips a state', () => {
    const h = createGameHistory(10);
    const state = createInitialState({ tubes: [['red'], []], maxSegments: 4 });
    h.push(cloneState(state));
    h.push(cloneState(state)); // push a second so undo returns to first
    const restored = h.undo();
    expect(restored.tubes[0].segments).toEqual(['red']);
  });

  it('canUndo returns true after push', () => {
    const h = createGameHistory(10);
    const state = createInitialState({ tubes: [['red'], []], maxSegments: 4 });
    h.push(cloneState(state));
    h.push(cloneState(state));
    expect(h.canUndo()).toBe(true);
  });
});

describe('pour — additional edge cases', () => {
  it('does not mutate source state', () => {
    const state = createInitialState({
      tubes: [['red', 'red'], ['red'], []],
      maxSegments: 4
    });
    const segsBefore = [...state.tubes[0].segments];
    pour(state, 0, 1);
    expect(state.tubes[0].segments).toEqual(segsBefore);
  });

  it('increments moves counter on each valid pour', () => {
    const state = createInitialState({
      tubes: [['red', 'blue'], ['blue'], []],
      maxSegments: 4
    });
    const s1 = pour(state, 0, 2); // pour blue from tube 0 to empty tube 2
    // tube 0 top is blue (1 segment), tube 2 is empty
    expect(s1.moves).toBe(1);
  });

  it('pour into empty tube respects maxSegments capacity', () => {
    const state = createInitialState({
      tubes: [['red', 'red', 'red', 'red'], []],
      maxSegments: 4
    });
    // All 4 red segments should not pour into an empty tube if source is complete
    // complete tube (all same color) should not allow pour
    const s1 = pour(state, 0, 1);
    expect(s1).toBe(state); // complete tubes cannot pour
  });
});
