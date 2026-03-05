/**
 * Tests for Water Sort - State Management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState,
  cloneState,
  getTopColor,
  countTopColors,
  canPour,
  getPourAmount,
  executePour,
  isTubeComplete,
  checkWin,
  countCompletedTubes,
  countNonEmptyTubes,
  getHint,
  calculateStars,
  createHistory
} from '../../../src/games/water-sort/state.js';

describe('Water Sort State', () => {
  describe('createInitialState', () => {
    it('should create initial state from level data', () => {
      const level = {
        id: 1,
        optimal: 5,
        tubes: [
          ['red', 'blue', 'red', 'blue'],
          ['blue', 'red', 'blue', 'red'],
          [],
          []
        ]
      };

      const state = createInitialState(level);

      expect(state.levelId).toBe(1);
      expect(state.optimal).toBe(5);
      expect(state.moves).toBe(0);
      expect(state.won).toBe(false);
      expect(state.capacity).toBe(4);
      expect(state.selectedTube).toBeNull();
      expect(state.pourPreview).toBeNull();
      expect(state.tubes).toHaveLength(4);
    });

    it('should deep copy tubes array', () => {
      const level = {
        id: 1,
        tubes: [['red', 'blue'], ['green']]
      };

      const state = createInitialState(level);

      // Modify original
      level.tubes[0][0] = 'yellow';

      // State should be unchanged
      expect(state.tubes[0][0]).toBe('red');
    });
  });

  describe('cloneState', () => {
    it('should create a deep copy of state', () => {
      const state = {
        tubes: [['red', 'blue'], ['green', 'yellow'], [], []],
        moves: 5,
        won: false,
        capacity: 4,
        selectedTube: 0,
        pourPreview: { from: 0, to: 2 }
      };

      const cloned = cloneState(state);

      expect(cloned.tubes).toEqual(state.tubes);
      expect(cloned.tubes).not.toBe(state.tubes);
      expect(cloned.moves).toBe(5);
      expect(cloned.selectedTube).toBeNull();
      expect(cloned.pourPreview).toBeNull();
    });
  });

  describe('getTopColor', () => {
    it('should return top color of non-empty tube', () => {
      expect(getTopColor(['red', 'blue', 'green'])).toBe('green');
      expect(getTopColor(['red'])).toBe('red');
    });

    it('should return null for empty tube', () => {
      expect(getTopColor([])).toBeNull();
    });
  });

  describe('countTopColors', () => {
    it('should count consecutive same colors from top', () => {
      expect(countTopColors(['red', 'blue', 'blue', 'blue'])).toBe(3);
      expect(countTopColors(['red', 'red', 'red', 'red'])).toBe(4);
      expect(countTopColors(['red', 'blue', 'green', 'blue'])).toBe(1);
    });

    it('should return 0 for empty tube', () => {
      expect(countTopColors([])).toBe(0);
    });
  });

  describe('canPour', () => {
    const state = {
      tubes: [
        ['red', 'blue', 'blue'], // Tube 0 - top is blue
        ['green', 'blue'],       // Tube 1 - top is blue
        [],                       // Tube 2 (empty)
        ['green', 'green', 'green', 'green'] // Tube 3 (full)
      ],
      capacity: 4
    };

    it('should allow pouring to empty tube', () => {
      expect(canPour(state, 0, 2)).toBe(true);
    });

    it('should allow pouring to tube with same top color', () => {
      expect(canPour(state, 0, 1)).toBe(true); // blue from 0 onto blue in 1
    });

    it('should not allow pouring to tube with different top color', () => {
      expect(canPour(state, 1, 3)).toBe(false); // blue from 1 onto green in 3 - also full
    });

    it('should not allow pouring to full tube', () => {
      expect(canPour(state, 0, 3)).toBe(false);
    });

    it('should not allow pouring from empty tube', () => {
      expect(canPour(state, 2, 0)).toBe(false);
    });

    it('should not allow pouring to same tube', () => {
      expect(canPour(state, 0, 0)).toBe(false);
    });
  });

  describe('getPourAmount', () => {
    it('should return correct amount when space available', () => {
      const state = {
        tubes: [
          ['red', 'blue', 'blue', 'blue'], // 3 blues on top
          ['blue'],                         // 1 blue, space for 3 more
          []
        ],
        capacity: 4
      };

      expect(getPourAmount(state, 0, 1)).toBe(3);
    });

    it('should be limited by available space', () => {
      const state = {
        tubes: [
          ['red', 'blue', 'blue', 'blue'], // 3 blues on top
          ['red', 'red', 'blue'],          // 1 blue, space for 1 more
          []
        ],
        capacity: 4
      };

      expect(getPourAmount(state, 0, 1)).toBe(1);
    });

    it('should return 0 for invalid pour', () => {
      const state = {
        tubes: [
          ['red', 'red'],
          ['blue', 'blue']
        ],
        capacity: 4
      };

      expect(getPourAmount(state, 0, 1)).toBe(0);
    });
  });

  describe('executePour', () => {
    it('should execute valid pour and increment moves', () => {
      const state = {
        tubes: [
          ['red', 'blue', 'blue'],
          [],
          []
        ],
        capacity: 4,
        moves: 0,
        selectedTube: 0,
        pourPreview: null
      };

      const result = executePour(state, 0, 1);

      expect(result).toBe(true);
      expect(state.tubes[0]).toEqual(['red']);
      expect(state.tubes[1]).toEqual(['blue', 'blue']);
      expect(state.moves).toBe(1);
      expect(state.selectedTube).toBeNull();
    });

    it('should return false for invalid pour', () => {
      const state = {
        tubes: [
          ['red'],
          ['blue', 'blue', 'blue', 'blue'] // full
        ],
        capacity: 4,
        moves: 0
      };

      const result = executePour(state, 0, 1);

      expect(result).toBe(false);
      expect(state.moves).toBe(0);
    });
  });

  describe('isTubeComplete', () => {
    const capacity = 4;

    it('should return true for empty tube', () => {
      expect(isTubeComplete([], capacity)).toBe(true);
    });

    it('should return true for tube with all same color', () => {
      expect(isTubeComplete(['red', 'red', 'red', 'red'], capacity)).toBe(true);
    });

    it('should return false for partially filled tube', () => {
      expect(isTubeComplete(['red', 'red'], capacity)).toBe(false);
    });

    it('should return false for mixed colors', () => {
      expect(isTubeComplete(['red', 'blue', 'red', 'blue'], capacity)).toBe(false);
    });
  });

  describe('checkWin', () => {
    it('should return true when all tubes are complete', () => {
      const state = {
        tubes: [
          ['red', 'red', 'red', 'red'],
          ['blue', 'blue', 'blue', 'blue'],
          [], // empty is complete
          []  // empty is complete
        ],
        capacity: 4
      };

      expect(checkWin(state)).toBe(true);
    });

    it('should return false when tubes are not complete', () => {
      const state = {
        tubes: [
          ['red', 'blue', 'red', 'blue'],
          ['blue', 'red', 'blue', 'red'],
          [],
          []
        ],
        capacity: 4
      };

      expect(checkWin(state)).toBe(false);
    });
  });

  describe('countCompletedTubes', () => {
    it('should count completed tubes correctly', () => {
      const state = {
        tubes: [
          ['red', 'red', 'red', 'red'], // complete
          ['blue', 'blue', 'blue'],     // incomplete
          [],                            // complete (empty)
          ['green']                      // incomplete
        ],
        capacity: 4
      };

      expect(countCompletedTubes(state)).toBe(2);
    });
  });

  describe('countNonEmptyTubes', () => {
    it('should count non-empty tubes', () => {
      const state = {
        tubes: [
          ['red'],
          [],
          ['blue', 'green'],
          []
        ]
      };

      expect(countNonEmptyTubes(state)).toBe(2);
    });
  });

  describe('getHint', () => {
    it('should return a valid hint when available', () => {
      const state = {
        tubes: [
          ['red', 'red', 'blue', 'blue'],
          ['blue', 'blue', 'red', 'red'],
          [],
          []
        ],
        capacity: 4
      };

      const hint = getHint(state);

      expect(hint).not.toBeNull();
      expect(hint.from).toBeDefined();
      expect(hint.to).toBeDefined();
      expect(hint.message).toBeDefined();
    });

    it('should return null when game is won', () => {
      const state = {
        tubes: [
          ['red', 'red', 'red', 'red'],
          ['blue', 'blue', 'blue', 'blue'],
          [],
          []
        ],
        capacity: 4
      };

      // Already won - no hints needed
      const hint = getHint(state);
      // When game is won, hint returns null (no moves needed)
      expect(hint).toBeNull();
    });
  });

  describe('calculateStars', () => {
    it('should return 3 stars for optimal moves', () => {
      expect(calculateStars(5, 5)).toBe(3);
      expect(calculateStars(4, 5)).toBe(3);
    });

    it('should return 2 stars for moves within 1.5x optimal', () => {
      expect(calculateStars(7, 5)).toBe(2);
      expect(calculateStars(6, 5)).toBe(2);
    });

    it('should return 1 star for moves within 2x optimal', () => {
      expect(calculateStars(10, 5)).toBe(1);
      expect(calculateStars(9, 5)).toBe(1);
    });

    it('should return 0 stars for excessive moves', () => {
      expect(calculateStars(11, 5)).toBe(0);
      expect(calculateStars(20, 5)).toBe(0);
    });
  });

  describe('createHistory', () => {
    it('should create history manager', () => {
      const history = createHistory();

      expect(history.canUndo()).toBe(false);
      expect(history.size).toBe(0);
    });

    it('should track state changes', () => {
      const history = createHistory(50);
      const state1 = { tubes: [['red'], []], moves: 0 };
      const state2 = { tubes: [[], ['red']], moves: 1 };

      history.push(state1);
      history.push(state2);

      expect(history.size).toBe(2);
      expect(history.canUndo()).toBe(true);
    });

    it('should undo to previous state', () => {
      const history = createHistory(50);
      const state1 = { tubes: [['red'], []], moves: 0 };
      const state2 = { tubes: [[], ['red']], moves: 1 };

      history.push(state1);
      history.push(state2);

      const undone = history.undo();

      expect(undone).not.toBeNull();
      expect(undone.tubes).toEqual([['red'], []]);
    });

    it('should limit history size', () => {
      const history = createHistory(3);

      for (let i = 0; i < 5; i++) {
        history.push({ tubes: [], moves: i });
      }

      expect(history.size).toBe(3);
    });

    it('should clear history', () => {
      const history = createHistory();
      history.push({ tubes: [], moves: 0 });
      history.push({ tubes: [], moves: 1 });

      history.clear();

      expect(history.size).toBe(0);
      expect(history.canUndo()).toBe(false);
    });
  });
});
