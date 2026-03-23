import { describe, it, expect, beforeEach } from 'vitest';
import {
  LIQUID_COLORS,
  createInitialState,
  canPour,
  pour,
  topColor,
  topGroupSize,
  isTubeComplete,
  checkWin,
  getValidMoves,
  isStuck,
  undo,
  cloneState,
  createGameHistory,
  calculateStars
} from '../../src/games/water-sort/state.js';

describe('Water Sort State', () => {
  describe('createInitialState', () => {
    it('creates state from level definition', () => {
      const level = {
        tubes: [['red', 'blue', 'red', 'blue'], ['blue', 'red', 'blue', 'red'], []],
        maxSegments: 4
      };
      const state = createInitialState(level);

      expect(state.tubes).toHaveLength(3);
      expect(state.tubes[0].segments).toEqual(['red', 'blue', 'red', 'blue']);
      expect(state.tubes[2].segments).toEqual([]);
      expect(state.maxSegments).toBe(4);
      expect(state.moves).toBe(0);
      expect(state.status).toBe('playing');
    });
  });

  describe('topColor', () => {
    it('returns the top color of a tube', () => {
      expect(topColor({ segments: ['red', 'blue', 'green'] })).toBe('green');
      expect(topColor({ segments: ['red'] })).toBe('red');
      expect(topColor({ segments: [] })).toBeNull();
    });
  });

  describe('topGroupSize', () => {
    it('counts contiguous top segments', () => {
      expect(topGroupSize({ segments: ['red', 'blue', 'blue'] })).toBe(2);
      expect(topGroupSize({ segments: ['red', 'red', 'red'] })).toBe(3);
      expect(topGroupSize({ segments: ['red', 'blue', 'green'] })).toBe(1);
      expect(topGroupSize({ segments: [] })).toBe(0);
    });
  });

  describe('canPour', () => {
    let state;

    beforeEach(() => {
      state = createInitialState({
        tubes: [['red', 'blue', 'red'], ['blue', 'red', 'blue'], [], ['green', 'green', 'green']],
        maxSegments: 4
      });
    });

    it('returns false for same source and destination', () => {
      expect(canPour(state, 0, 0)).toBe(false);
    });

    it('returns false for empty source', () => {
      expect(canPour(state, 2, 0)).toBe(false);
    });

    it('returns false for full destination', () => {
      const fullState = createInitialState({
        tubes: [['red', 'blue', 'red'], ['blue', 'red', 'blue', 'green'], []],
        maxSegments: 4
      });
      expect(canPour(fullState, 0, 1)).toBe(false);
    });

    it('returns false for color mismatch', () => {
      expect(canPour(state, 0, 3)).toBe(false); // red top vs green top
    });

    it('returns true for empty destination', () => {
      expect(canPour(state, 0, 2)).toBe(true);
    });

    it('returns false for color mismatch on non-empty tubes', () => {
      // tube 0 top = red, tube 1 top = blue - no match
      expect(canPour(state, 0, 1)).toBe(false);
    });

    it('returns true for matching top colors', () => {
      // tube 0 top = red; tube 0->2 (empty) should work
      // Create a state where tops match
      const matchState = createInitialState({
        tubes: [['red', 'blue', 'red'], ['blue', 'blue', 'red'], []],
        maxSegments: 4
      });
      // tube 0 top = red, tube 1 top = red - match
      expect(canPour(matchState, 0, 1)).toBe(true);
    });

    it('returns false for complete source tube', () => {
      // Tube with maxSegments=3 and all green
      const completeState = createInitialState({
        tubes: [['red', 'blue', 'red'], ['blue', 'red', 'blue'], [], ['green', 'green', 'green']],
        maxSegments: 3
      });
      expect(canPour(completeState, 3, 2)).toBe(false);
    });

    it('returns true when destination is empty and source is incomplete', () => {
      expect(canPour(state, 0, 2)).toBe(true);
    });
  });

  describe('pour', () => {
    it('transfers correct number of segments', () => {
      const state = createInitialState({
        tubes: [['red', 'red', 'blue'], ['blue', 'blue'], []],
        maxSegments: 4
      });

      const newState = pour(state, 0, 1);

      // Top of tube 0 is blue (1 segment), tube 1 top is blue (2 segments)
      // Transfer 1 blue from tube 0 to tube 1
      expect(newState.tubes[0].segments).toEqual(['red', 'red']);
      expect(newState.tubes[1].segments).toEqual(['blue', 'blue', 'blue']);
      expect(newState.moves).toBe(1);
    });

    it('transfers full contiguous group', () => {
      const state = createInitialState({
        tubes: [['red', 'blue', 'blue'], ['blue'], []],
        maxSegments: 4
      });

      const newState = pour(state, 0, 2);

      // Top group on tube 0 is 'blue','blue' (2 segments)
      expect(newState.tubes[0].segments).toEqual(['red']);
      expect(newState.tubes[2].segments).toEqual(['blue', 'blue']);
    });

    it('respects destination capacity', () => {
      const state = createInitialState({
        tubes: [['red', 'red', 'red'], ['red', 'red'], []],
        maxSegments: 4
      });

      const newState = pour(state, 0, 1);

      // Transfer min(3, 2) = 2 red segments
      expect(newState.tubes[0].segments).toEqual(['red']);
      expect(newState.tubes[1].segments).toEqual(['red', 'red', 'red', 'red']);
    });

    it('returns same state if pour is invalid', () => {
      const state = createInitialState({
        tubes: [['red'], ['blue'], []],
        maxSegments: 4
      });

      const newState = pour(state, 0, 1); // color mismatch
      expect(newState).toBe(state);
    });
  });

  describe('checkWin', () => {
    it('returns true when all tubes are sorted', () => {
      const state = createInitialState({
        tubes: [['red', 'red', 'red', 'red'], ['blue', 'blue', 'blue', 'blue'], [], []],
        maxSegments: 4
      });
      expect(checkWin(state)).toBe(true);
    });

    it('returns false when tubes are mixed', () => {
      const state = createInitialState({
        tubes: [['red', 'blue', 'red', 'blue'], ['blue', 'red', 'blue', 'red'], []],
        maxSegments: 4
      });
      expect(checkWin(state)).toBe(false);
    });

    it('returns false when tube is not full', () => {
      const state = createInitialState({
        tubes: [['red', 'red', 'red'], ['blue', 'blue', 'blue', 'blue'], []],
        maxSegments: 4
      });
      expect(checkWin(state)).toBe(false);
    });

    it('returns true with only empty buffer tubes', () => {
      const state = createInitialState({
        tubes: [['red', 'red', 'red', 'red'], [], []],
        maxSegments: 4
      });
      expect(checkWin(state)).toBe(true);
    });
  });

  describe('isTubeComplete', () => {
    it('returns true for full single-color tube', () => {
      const state = createInitialState({
        tubes: [['red', 'red', 'red', 'red'], ['blue', 'red'], []],
        maxSegments: 4
      });
      expect(isTubeComplete(state, 0)).toBe(true);
    });

    it('returns false for mixed tube', () => {
      const state = createInitialState({
        tubes: [['red', 'blue', 'red'], []],
        maxSegments: 4
      });
      expect(isTubeComplete(state, 0)).toBe(false);
    });

    it('returns false for empty tube', () => {
      const state = createInitialState({
        tubes: [[]],
        maxSegments: 4
      });
      expect(isTubeComplete(state, 0)).toBe(false);
    });

    it('returns false for tube with maxSegments-1 same-color segments (not full)', () => {
      const state = createInitialState({
        tubes: [['red', 'red', 'red'], []],
        maxSegments: 4
      });
      expect(isTubeComplete(state, 0)).toBe(false);
    });
  });

  describe('getValidMoves', () => {
    it('returns empty for stuck state', () => {
      const state = createInitialState({
        tubes: [['red', 'blue', 'red', 'blue'], ['blue', 'red', 'blue', 'red']],
        maxSegments: 4
      });
      // No empty buffer tubes, and no matching top colors
      const moves = getValidMoves(state);
      expect(moves).toEqual([]);
    });

    it('returns valid moves when available', () => {
      const state = createInitialState({
        tubes: [['red', 'blue', 'red'], ['blue', 'red', 'blue'], []],
        maxSegments: 4
      });
      const moves = getValidMoves(state);
      expect(moves.length).toBeGreaterThan(0);
    });

    it('excludes moves from complete tubes', () => {
      const state = createInitialState({
        tubes: [['red', 'red', 'red', 'red'], ['blue', 'red'], []],
        maxSegments: 4
      });
      const moves = getValidMoves(state);
      const fromComplete = moves.some(([from]) => from === 0);
      expect(fromComplete).toBe(false);
    });
  });

  describe('isStuck', () => {
    it('detects deadlocked state', () => {
      const state = createInitialState({
        tubes: [['red', 'blue', 'red', 'blue'], ['blue', 'red', 'blue', 'red']],
        maxSegments: 4
      });
      expect(isStuck(state)).toBe(true);
    });

    it('returns false when moves available', () => {
      const state = createInitialState({
        tubes: [['red', 'blue', 'red'], ['blue', 'red', 'blue'], []],
        maxSegments: 4
      });
      expect(isStuck(state)).toBe(false);
    });

    it('returns false when won', () => {
      const state = createInitialState({
        tubes: [['red', 'red', 'red', 'red'], ['blue', 'blue', 'blue', 'blue'], []],
        maxSegments: 4
      });
      expect(isStuck(state)).toBe(false);
    });
  });

  describe('undo', () => {
    it('reverses a pour operation', () => {
      const state = createInitialState({
        tubes: [['red', 'blue', 'blue'], ['blue'], []],
        maxSegments: 4
      });
      const history = createGameHistory(100);
      history.push(cloneState(state));

      const poured = pour(state, 0, 2);
      expect(poured.tubes[0].segments).toEqual(['red']);
      expect(poured.tubes[2].segments).toEqual(['blue', 'blue']);

      // Push the poured state so we can undo back to initial
      history.push(cloneState(poured));
      const undone = undo(poured, history);
      expect(undone.tubes[0].segments).toEqual(['red', 'blue', 'blue']);
      expect(undone.tubes[2].segments).toEqual([]);
    });

    it('always resets selectedTube to null even when prev state had one selected', () => {
      // Store a state with selectedTube=2 in history, then undo back to it
      const base = createInitialState({ tubes: [['red', 'blue'], ['blue'], []], maxSegments: 4 });
      const withSelected = { ...base, selectedTube: 2 };
      const history = createGameHistory(100);
      history.push(withSelected); // pointer=0: state with selectedTube=2
      history.push(cloneState(pour(base, 0, 2))); // pointer=1: poured state
      const undone = undo(base, history);
      expect(undone).not.toBeNull();
      expect(undone.selectedTube).toBeNull(); // Override: selectedTube always reset
    });
  });

  describe('cloneState', () => {
    it('creates independent copy', () => {
      const state = createInitialState({
        tubes: [['red', 'blue'], ['green']],
        maxSegments: 4
      });
      const cloned = cloneState(state);

      cloned.tubes[0].segments[0] = 'yellow';
      expect(state.tubes[0].segments[0]).toBe('red');
    });

    it('always resets selectedTube to null', () => {
      const state = createInitialState({
        tubes: [['red'], []],
        maxSegments: 4
      });
      state.selectedTube = 0;
      const cloned = cloneState(state);
      expect(cloned.selectedTube).toBeNull();
    });
  });

  describe('calculateStars', () => {
    it('returns 3 stars at optimal', () => {
      expect(calculateStars(5, 5)).toBe(3);
    });

    it('returns 2 stars at 1.5x optimal', () => {
      expect(calculateStars(7, 5)).toBe(2);
    });

    it('returns 2 stars when ratio is exactly 1.5 (boundary inclusive)', () => {
      expect(calculateStars(15, 10)).toBe(2); // 15/10 = 1.5
    });

    it('returns 1 star at 2x optimal', () => {
      expect(calculateStars(12, 5)).toBe(1);
    });

    it('returns 1 star when ratio is just above 1.5 (1.5 is 2-star upper bound, exclusive)', () => {
      expect(calculateStars(151, 100)).toBe(1); // 1.51 > 1.5 → not 2 stars
    });
  });

  describe('pour — win condition', () => {
    it('sets status to "won" when the winning pour completes the puzzle', () => {
      // Simple 1-color puzzle: one sorted tube + one buffer
      const state = createInitialState({
        tubes: [['red', 'red', 'red'], ['red'], []],
        maxSegments: 4
      });
      // Pour red from tube 1 (top=red) to tube 0 (top=red, has room for 1 more)
      const next = pour(state, 1, 0);
      // tube 0 now has 4 reds (complete) and tube 1 is empty → win
      expect(next.status).toBe('won');
    });

    it('keeps status "playing" after a valid non-winning pour', () => {
      // Multiple colors — pouring one segment does not complete the puzzle
      const state = createInitialState({
        tubes: [['red', 'blue', 'blue'], ['blue'], []],
        maxSegments: 4
      });
      // Pour blue from tube 1 to empty tube 2 — valid but not a win
      const next = pour(state, 1, 2);
      expect(next.status).toBe('playing');
    });
  });

  describe('getValidMoves — format', () => {
    it('each valid move is a [from, to] pair', () => {
      const state = createInitialState({
        tubes: [['red', 'blue', 'red'], ['blue', 'red', 'blue'], []],
        maxSegments: 4
      });
      const moves = getValidMoves(state);
      expect(moves.length).toBeGreaterThan(0);
      for (const move of moves) {
        expect(Array.isArray(move)).toBe(true);
        expect(move.length).toBe(2);
        const [from, to] = move;
        expect(typeof from).toBe('number');
        expect(typeof to).toBe('number');
      }
    });
  });

  describe('integration: solve simple puzzle', () => {
    it('can solve a 3-color puzzle', () => {
      const state = createInitialState({
        tubes: [['red', 'blue', 'red'], ['blue', 'red', 'blue'], [], ['green', 'green', 'green']],
        maxSegments: 4
      });

      // Pour red from tube 0 (top=red) to empty tube 2
      let s = pour(state, 0, 2);
      expect(s.tubes[0].segments).toEqual(['red', 'blue']);
      expect(s.tubes[2].segments).toEqual(['red']);
      expect(s.moves).toBe(1);

      // Pour red from tube 1 (top=blue) - no, top is blue
      // Pour blue from tube 0 (top=blue) to tube 1 (top=blue) - match
      s = pour(s, 0, 1);
      expect(s.tubes[0].segments).toEqual(['red']);
      expect(s.tubes[1].segments).toEqual(['blue', 'red', 'blue', 'blue']);
      expect(s.moves).toBe(2);

      // Pour red from tube 0 (top=red) to tube 2 (top=red) - match
      s = pour(s, 0, 2);
      expect(s.tubes[0].segments).toEqual([]);
      expect(s.tubes[2].segments).toEqual(['red', 'red']);
      expect(s.moves).toBe(3);
    });
  });
});

describe('LIQUID_COLORS', () => {
  it('is an object mapping color names to hex strings', () => {
    expect(typeof LIQUID_COLORS).toBe('object');
    const keys = Object.keys(LIQUID_COLORS);
    expect(keys.length).toBeGreaterThan(0);
    for (const hex of Object.values(LIQUID_COLORS)) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('includes red and blue', () => {
    expect(LIQUID_COLORS).toHaveProperty('red');
    expect(LIQUID_COLORS).toHaveProperty('blue');
  });
});

describe('canPour — out-of-bounds indices', () => {
  it('returns false for negative fromIdx', () => {
    const state = createInitialState({
      tubes: [['red'], []],
      maxSegments: 4
    });
    expect(canPour(state, -1, 1)).toBe(false);
  });

  it('returns false for fromIdx >= tubes.length', () => {
    const state = createInitialState({
      tubes: [['red'], []],
      maxSegments: 4
    });
    expect(canPour(state, 2, 1)).toBe(false);
  });

  it('returns false for negative toIdx', () => {
    const state = createInitialState({
      tubes: [['red'], []],
      maxSegments: 4
    });
    expect(canPour(state, 0, -1)).toBe(false);
  });

  it('returns false for toIdx >= tubes.length', () => {
    const state = createInitialState({
      tubes: [['red'], []],
      maxSegments: 4
    });
    expect(canPour(state, 0, 2)).toBe(false);
  });
});

describe('undo — null when cannot undo', () => {
  it('returns null when only one state has been pushed (nothing to go back to)', () => {
    const state = createInitialState({
      tubes: [['red', 'blue'], ['green']],
      maxSegments: 4
    });
    const history = createGameHistory(100);
    history.push(cloneState(state)); // pointer=0, canUndo()=false
    expect(undo(state, history)).toBeNull();
  });

  it('returns null with an empty history', () => {
    const state = createInitialState({
      tubes: [['red'], []],
      maxSegments: 4
    });
    const history = createGameHistory(100);
    // No states pushed — pointer=-1
    expect(undo(state, history)).toBeNull();
  });

  it('returns null on second undo (already at first state)', () => {
    const state = createInitialState({
      tubes: [['red', 'blue', 'blue'], ['blue'], []],
      maxSegments: 4
    });
    const history = createGameHistory(100);
    history.push(cloneState(state));
    const poured = pour(state, 0, 2);
    history.push(cloneState(poured));
    // First undo: succeeds
    const undone = undo(poured, history);
    expect(undone).not.toBeNull();
    // Second undo: pointer back to 0, canUndo()=false → null
    expect(undo(undone, history)).toBeNull();
  });
});
