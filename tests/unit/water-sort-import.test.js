/**
 * Water Sort — levels.json ↔ state integration tests
 *
 * Verifies that every hand-crafted level in levels.json creates a valid
 * initial state, and that game-rule invariants hold across the full
 * level catalog.  These tests complement water-sort.test.js (mechanics)
 * and water-sort-solver.test.js (solvability).
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  topColor,
  topGroupSize,
  getValidMoves,
  isStuck,
  checkWin,
} from '../../src/games/water-sort/state.js';
import levels from '../../src/games/water-sort/levels.json';

// ── Basic structural integrity ──────────────────────────────────────────────

describe('levels.json catalog', () => {
  it('contains at least 10 levels', () => {
    expect(levels.length).toBeGreaterThanOrEqual(10);
  });

  it('every level has a unique id', () => {
    const ids = levels.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every level has a tubes array', () => {
    for (const level of levels) {
      expect(Array.isArray(level.tubes), `level ${level.id}`).toBe(true);
    }
  });

  it('every level declares maxSegments', () => {
    for (const level of levels) {
      expect(typeof level.maxSegments, `level ${level.id}`).toBe('number');
      expect(level.maxSegments).toBeGreaterThan(0);
    }
  });
});

// ── createInitialState for every level ─────────────────────────────────────

describe('createInitialState — full catalog', () => {
  it('succeeds without throwing for all levels', () => {
    for (const level of levels) {
      expect(() => createInitialState(level), `level ${level.id}`).not.toThrow();
    }
  });

  it('initial status is always "playing"', () => {
    for (const level of levels) {
      const state = createInitialState(level);
      expect(state.status, `level ${level.id}`).toBe('playing');
    }
  });

  it('tube count matches the level definition', () => {
    for (const level of levels) {
      const state = createInitialState(level);
      expect(state.tubes.length, `level ${level.id}`).toBe(level.tubes.length);
    }
  });

  it('no tube exceeds maxSegments on load', () => {
    for (const level of levels) {
      const state = createInitialState(level);
      for (const tube of state.tubes) {
        expect(
          tube.segments.length,
          `level ${level.id}: tube has ${tube.segments.length} > ${state.maxSegments} segments`
        ).toBeLessThanOrEqual(state.maxSegments);
      }
    }
  });

  it('initial selectedTube is null for all levels', () => {
    for (const level of levels) {
      expect(createInitialState(level).selectedTube).toBeNull();
    }
  });

  it('initial moves counter is 0 for all levels', () => {
    for (const level of levels) {
      expect(createInitialState(level).moves).toBe(0);
    }
  });
});

// ── Color-count invariant ───────────────────────────────────────────────────

describe('color-count invariant', () => {
  it('each color appears exactly maxSegments times across all tubes', () => {
    for (const level of levels) {
      const state = createInitialState(level);
      const tally = {};
      for (const tube of state.tubes) {
        for (const seg of tube.segments) {
          tally[seg] = (tally[seg] ?? 0) + 1;
        }
      }
      for (const [color, count] of Object.entries(tally)) {
        expect(count, `level ${level.id}: color "${color}" appears ${count} times`).toBe(state.maxSegments);
      }
    }
  });
});

// ── No level starts already solved or stuck ─────────────────────────────────

describe('initial playability', () => {
  it('no level is already won at start', () => {
    for (const level of levels) {
      const state = createInitialState(level);
      expect(checkWin(state), `level ${level.id} is already won`).toBe(false);
    }
  });

  it('no level is stuck at start (always has valid moves)', () => {
    for (const level of levels) {
      const state = createInitialState(level);
      expect(isStuck(state), `level ${level.id} is immediately stuck`).toBe(false);
    }
  });

  it('every level has at least one valid move from the start', () => {
    for (const level of levels) {
      const state = createInitialState(level);
      const moves = getValidMoves(state);
      expect(moves.length, `level ${level.id} has no valid moves`).toBeGreaterThan(0);
    }
  });
});

// ── topColor / topGroupSize consistency ────────────────────────────────────

describe('tube helpers on initial state', () => {
  it('topColor matches last segment of non-empty tubes', () => {
    for (const level of levels) {
      const state = createInitialState(level);
      for (const tube of state.tubes) {
        if (tube.segments.length > 0) {
          const top = topColor(tube);
          expect(top).toBe(tube.segments[tube.segments.length - 1]);
        }
      }
    }
  });

  it('topGroupSize is at least 1 for non-empty tubes', () => {
    for (const level of levels) {
      const state = createInitialState(level);
      for (const tube of state.tubes) {
        if (tube.segments.length > 0) {
          expect(topGroupSize(tube)).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});
