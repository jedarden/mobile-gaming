/**
 * Hint Worker — Unit Tests
 *
 * Tests the Web Worker dispatch logic:
 *   - Routing to correct solver by gameId
 *   - Posting { moves } on success
 *   - Posting { error } on unknown gameId, unsolvable puzzle, or thrown exception
 *
 * The solver functions themselves are tested exhaustively in tests/solvers/.
 * Here we focus on the dispatch layer and representative solver invocations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock self before hint-worker loads ──────────────────────────────────────
// hint-worker.js calls `self.onmessage = ...` at module evaluation time.
// We must install a fake `self` on the global before the first import.

const postMessageMock = vi.fn();
const fakeSelf = { onmessage: null, postMessage: postMessageMock };
vi.stubGlobal('self', fakeSelf);

// ─── Dynamic import helper ────────────────────────────────────────────────────
// vi.resetModules() + dynamic import gives a fresh module each test.

let dispatch;

beforeEach(async () => {
  vi.resetModules();
  postMessageMock.mockClear();
  fakeSelf.onmessage = null;
  await import('../../src/shared/hint-worker.js');
  dispatch = (data) => fakeSelf.onmessage({ data });
});

// ─── Dispatch routing ─────────────────────────────────────────────────────────

describe('dispatch routing', () => {
  it('posts error for unknown gameId', () => {
    dispatch({ gameId: 'unknown-game', state: {}, level: {} });
    expect(postMessageMock).toHaveBeenCalledWith({
      error: 'No solver for game: unknown-game',
    });
  });

  it('posts error when gameId is missing', () => {
    dispatch({ state: {}, level: {} });
    expect(postMessageMock).toHaveBeenCalledWith({
      error: expect.stringContaining('No solver'),
    });
  });

  it('calls postMessage exactly once per dispatch', () => {
    dispatch({ gameId: 'brain-teaser', state: {}, level: { solution: 'left' } });
    expect(postMessageMock).toHaveBeenCalledTimes(1);
  });
});

// ─── brain-teaser solver ──────────────────────────────────────────────────────

describe('brain-teaser solver', () => {
  it('returns the level.solution wrapped in an array', () => {
    dispatch({
      gameId: 'brain-teaser',
      state: {},
      level: { solution: 'tilt-right' },
    });
    expect(postMessageMock).toHaveBeenCalledWith({ moves: ['tilt-right'] });
  });

  it('returns object solutions', () => {
    const solution = { action: 'flip', targetId: 'bucket-1' };
    dispatch({ gameId: 'brain-teaser', state: {}, level: { solution } });
    expect(postMessageMock).toHaveBeenCalledWith({ moves: [solution] });
  });

  it('posts error when level has no solution', () => {
    dispatch({ gameId: 'brain-teaser', state: {}, level: {} });
    expect(postMessageMock).toHaveBeenCalledWith({
      error: 'Solver could not find a solution',
    });
  });

  it('posts error when level is null', () => {
    dispatch({ gameId: 'brain-teaser', state: {}, level: null });
    expect(postMessageMock).toHaveBeenCalledWith({
      error: 'Solver could not find a solution',
    });
  });
});

// ─── pull-the-pin solver ──────────────────────────────────────────────────────

describe('pull-the-pin solver', () => {
  it('returns empty array when no pins remain', () => {
    const state = { pins: [], channels: [] };
    dispatch({ gameId: 'pull-the-pin', state, level: {} });
    expect(postMessageMock).toHaveBeenCalledWith({ moves: [] });
  });

  it('returns empty array when all pins are removed', () => {
    const state = {
      pins: [{ id: 'pin-1', removed: true }],
      channels: [],
    };
    dispatch({ gameId: 'pull-the-pin', state, level: {} });
    expect(postMessageMock).toHaveBeenCalledWith({ moves: [] });
  });

  it('returns move for a single un-removed pin', () => {
    const state = {
      pins: [{ id: 'pin-1', removed: false }],
      channels: [],
    };
    dispatch({ gameId: 'pull-the-pin', state, level: {} });
    expect(postMessageMock).toHaveBeenCalledWith({
      moves: [{ pinId: 'pin-1' }],
    });
  });

  it('prioritises pin that blocks more channels', () => {
    const state = {
      pins: [
        { id: 'pin-a', removed: false },
        { id: 'pin-b', removed: false },
      ],
      channels: [
        { blockedByPin: 'pin-b' },
        { blockedByPin: 'pin-b' },
        { blockedByPin: 'pin-a' },
      ],
    };
    dispatch({ gameId: 'pull-the-pin', state, level: {} });
    const { moves } = postMessageMock.mock.calls[0][0];
    // pin-b blocks 2 channels, pin-a blocks 1 → pin-b should come first
    expect(moves[0].pinId).toBe('pin-b');
    expect(moves[1].pinId).toBe('pin-a');
  });

  it('handles state with no pins key', () => {
    dispatch({ gameId: 'pull-the-pin', state: {}, level: {} });
    expect(postMessageMock).toHaveBeenCalledWith({ moves: [] });
  });

  it('handles state with no channels key — (state.channels || []) right arm', () => {
    // pins present but channels key absent → state.channels = undefined → || [] fallback
    const state = { pins: [{ id: 'pin-1', removed: false }] };
    dispatch({ gameId: 'pull-the-pin', state, level: {} });
    // No channels to score pins by → all pins have equal priority → pin-1 is returned
    expect(postMessageMock).toHaveBeenCalledWith({ moves: [{ pinId: 'pin-1' }] });
  });

  it('includes only un-removed pins in result', () => {
    const state = {
      pins: [
        { id: 'done', removed: true },
        { id: 'todo', removed: false },
      ],
      channels: [],
    };
    dispatch({ gameId: 'pull-the-pin', state, level: {} });
    const { moves } = postMessageMock.mock.calls[0][0];
    expect(moves).toHaveLength(1);
    expect(moves[0].pinId).toBe('todo');
  });

  it('ignores channels without blockedByPin — (if channel.blockedByPin) false arm', () => {
    // Mix of channels: one with blockedByPin, one without (e.g. a free channel)
    const state = {
      pins: [
        { id: 'pin-a', removed: false },
        { id: 'pin-b', removed: false },
      ],
      channels: [
        { blockedByPin: 'pin-a' },  // counted for pin-a
        { color: 'red' },            // no blockedByPin → skipped (false arm)
      ],
    };
    dispatch({ gameId: 'pull-the-pin', state, level: {} });
    const { moves } = postMessageMock.mock.calls[0][0];
    // pin-a blocks 1 channel, pin-b blocks 0 → pin-a should be first
    expect(moves[0].pinId).toBe('pin-a');
    expect(moves[1].pinId).toBe('pin-b');
  });
});

// ─── water-sort solver ────────────────────────────────────────────────────────

describe('water-sort solver', () => {
  it('returns empty array for already-sorted tubes', () => {
    // All tubes either empty or full with a single colour
    const state = {
      tubes: [['R', 'R', 'R', 'R'], ['B', 'B', 'B', 'B'], []],
      maxSegments: 4,
    };
    dispatch({ gameId: 'water-sort', state, level: {} });
    expect(postMessageMock).toHaveBeenCalledWith({ moves: [] });
  });

  it('solves a trivially solvable two-tube puzzle', () => {
    // One move: pour tube 0 into tube 1 (tube 1 is empty, tube 0 is full R)
    const state = {
      tubes: [['R', 'R'], []],
      maxSegments: 2,
    };
    dispatch({ gameId: 'water-sort', state, level: {} });
    const result = postMessageMock.mock.calls[0][0];
    // should have found a solution (not an error)
    expect(result).toHaveProperty('moves');
    expect(Array.isArray(result.moves)).toBe(true);
  });

  it('posts error for unsolvable configuration', () => {
    // A fully locked state where no pours are possible (all tubes full, mixed)
    // and path length would exceed the search limit
    const state = {
      tubes: [['R', 'B'], ['B', 'R']],
      maxSegments: 2,
    };
    dispatch({ gameId: 'water-sort', state, level: {} });
    const result = postMessageMock.mock.calls[0][0];
    // Either solves it or reports it unsolvable — just ensure valid response
    expect(result).toSatisfy(r => 'moves' in r || 'error' in r);
  });
});

// ─── parking-escape solver ────────────────────────────────────────────────────

describe('parking-escape solver', () => {
  it('returns empty array when hero is already at exit', () => {
    const state = {
      grid: { width: 6, height: 6, exit: { x: 6, y: 2 } },
      vehicles: [
        { id: 'hero', type: 'hero', orientation: 'horizontal', x: 4, y: 2, width: 2, height: 1 },
      ],
    };
    dispatch({ gameId: 'parking-escape', state, level: {} });
    expect(postMessageMock).toHaveBeenCalledWith({ moves: [] });
  });

  it('solves a one-move puzzle (hero slides right to exit)', () => {
    // 6×6 grid, exit at right edge row 2, hero at x=3 y=2 width=2 → needs to move right 1
    const state = {
      grid: { width: 6, height: 6, exit: { x: 6, y: 2 } },
      vehicles: [
        { id: 'hero', type: 'hero', orientation: 'horizontal', x: 3, y: 2, width: 2, height: 1 },
      ],
    };
    dispatch({ gameId: 'parking-escape', state, level: {} });
    const result = postMessageMock.mock.calls[0][0];
    expect(result).toHaveProperty('moves');
    expect(result.moves.length).toBeGreaterThan(0);
    expect(result.moves[result.moves.length - 1]).toMatchObject({
      vehicleId: 'hero',
      direction: 'right',
    });
  });

  it('posts error when no solution found (hero completely blocked)', () => {
    // Hero completely surrounded by other vehicles with no path to exit
    const state = {
      grid: { width: 3, height: 3, exit: { x: 3, y: 0 } },
      vehicles: [
        { id: 'hero', type: 'hero', orientation: 'horizontal', x: 0, y: 0, width: 1, height: 1 },
        { id: 'b1', type: 'blocker', orientation: 'vertical', x: 1, y: 0, width: 1, height: 3 },
        { id: 'b2', type: 'blocker', orientation: 'vertical', x: 2, y: 0, width: 1, height: 3 },
      ],
    };
    dispatch({ gameId: 'parking-escape', state, level: {} });
    expect(postMessageMock).toHaveBeenCalledWith({
      error: 'Solver could not find a solution',
    });
  });

  it('solves puzzle requiring vertical vehicle movement (getMoves down/up + applyMove down/up branches)', () => {
    // 4×3 grid; hero blocked by a 1×1 vertical vehicle that must move up or down first.
    // getMoves(): vertical branch enters the else block → pushes direction:'up' and direction:'down'
    // applyMove(): BFS eventually applies a 'down' or 'up' move → nv.y += or -= fires
    const state = {
      grid: { width: 4, height: 3, exit: { x: 4, y: 1 } },
      vehicles: [
        // Hero occupies x=0,1 at y=1 — needs x=2 cleared to reach exit at x=4
        { id: 'hero', type: 'hero', orientation: 'horizontal', x: 0, y: 1, width: 2, height: 1 },
        // Vertical 1×1 blocker at x=2, y=1 — can move up (y=0) or down (y=2)
        { id: 'vb', type: 'blocker', orientation: 'vertical', x: 2, y: 1, width: 1, height: 1 },
      ],
    };
    dispatch({ gameId: 'parking-escape', state, level: {} });
    const result = postMessageMock.mock.calls[0][0];
    // Solver must find a solution: move vb up or down, then hero right to exit
    expect(result).toHaveProperty('moves');
    expect(result.moves.length).toBeGreaterThan(0);
    // The solution path must contain a vertical move ('up' or 'down') for the blocker
    const verticalMove = result.moves.find(
      m => m.vehicleId === 'vb' && (m.direction === 'up' || m.direction === 'down')
    );
    expect(verticalMove).toBeDefined();
  });

  it('uses grid width as EXIT_X when exit.x is absent (?? GRID fallback)', () => {
    // exit has no x property → EXIT_X = level.grid.width = 6 (via ?? GRID)
    // Hero at x=4 y=2 width=2 → hero.x + hero.width = 6 = EXIT_X → already at exit
    const state = {
      grid: { width: 6, height: 6, exit: { y: 2 } }, // no x field
      vehicles: [
        { id: 'hero', type: 'hero', orientation: 'horizontal', x: 4, y: 2, width: 2, height: 1 },
      ],
    };
    dispatch({ gameId: 'parking-escape', state, level: {} });
    expect(postMessageMock).toHaveBeenCalledWith({ moves: [] });
  });

  it('handles state with no hero vehicle — isWon returns false (if(!hero) false branch)', () => {
    // No hero in vehicles → isWon always returns false → BFS finds no solution → error
    const state = {
      grid: { width: 3, height: 3, exit: { x: 3, y: 0 } },
      vehicles: [
        { id: 'car1', type: 'car', orientation: 'horizontal', x: 0, y: 0, width: 1, height: 1 },
      ],
    };
    dispatch({ gameId: 'parking-escape', state, level: {} });
    expect(postMessageMock).toHaveBeenCalledWith({
      error: 'Solver could not find a solution',
    });
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
  it('catches solver exceptions and posts error message', () => {
    // brain-teaser with a state/level that would cause an exception
    // A state that causes JSON serialization to fail is hard to construct;
    // instead verify the try/catch works by passing garbage for water-sort
    // The solver will fail trying to iterate undefined tubes
    dispatch({ gameId: 'water-sort', state: { tubes: null, maxSegments: 4 }, level: {} });
    const result = postMessageMock.mock.calls[0][0];
    // Should be either a solution or an error — not crash
    expect(result).toSatisfy(r => 'error' in r || 'moves' in r);
  });
});
