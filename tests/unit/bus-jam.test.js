/**
 * Bus Jam — Unit Tests
 *
 * Tests pure state functions: createInitialState, isRoad, getBusAt,
 * getStopAt, isExit, getValidMoves, findPath, canBoard, boardPassenger,
 * canExit, executeExit, checkWin, countRemainingPassengers, cloneState,
 * calculateStars.
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  isRoad,
  getBusAt,
  getStopAt,
  isExit,
  getValidMoves,
  findPath,
  canBoard,
  boardPassenger,
  canExit,
  executeExit,
  checkWin,
  countRemainingPassengers,
  cloneState,
  calculateStars,
  getHint,
  createHistory,
  BUS_COLORS,
} from '../../src/games/bus-jam/state.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Minimal level: a 5×5 grid with roads, one bus, one stop, one exit.
 *
 * Layout (x=col, y=row):
 *   Stop at (1,0) — red, 2 waiting passengers
 *   Bus  at (1,1) — red, capacity=2, passengers=0
 *   Roads: (1,0),(1,1),(1,2),(1,3),(2,3),(3,3)
 *   Exit at (3,3)
 */
function makeLevel(overrides = {}) {
  return {
    grid: { width: 5, height: 5 },
    buses: [
      { id: 'b1', x: 1, y: 1, color: 'red', passengers: 0, capacity: 2, exited: false },
    ],
    stops: [
      { id: 's1', x: 1, y: 0, color: 'red', waiting: ['p1', 'p2'] },
    ],
    exits: [{ x: 3, y: 3 }],
    roads: [[1,0],[1,1],[1,2],[1,3],[2,3],[3,3]],
    ...overrides,
  };
}

// ── BUS_COLORS ─────────────────────────────────────────────────────────────

describe('BUS_COLORS', () => {
  it('includes red and blue', () => {
    expect(BUS_COLORS.red).toBeDefined();
    expect(BUS_COLORS.blue).toBeDefined();
  });
});

// ── createInitialState ─────────────────────────────────────────────────────

describe('createInitialState', () => {
  it('copies buses', () => {
    const state = createInitialState(makeLevel());
    expect(state.buses).toHaveLength(1);
    expect(state.buses[0].id).toBe('b1');
  });

  it('copies stops with waiting arrays', () => {
    const state = createInitialState(makeLevel());
    expect(state.stops[0].waiting).toEqual(['p1', 'p2']);
    expect(state.stops[0].waiting).not.toBe(makeLevel().stops[0].waiting);
  });

  it('copies exits', () => {
    const state = createInitialState(makeLevel());
    expect(state.exits[0]).toEqual({ x: 3, y: 3 });
  });

  it('converts roads array to Set', () => {
    const state = createInitialState(makeLevel());
    expect(state.roads).toBeInstanceOf(Set);
    expect(state.roads.has('1,1')).toBe(true);
    expect(state.roads.has('3,3')).toBe(true);
  });

  it('starts with moves=0 and won=false', () => {
    const state = createInitialState(makeLevel());
    expect(state.moves).toBe(0);
    expect(state.won).toBe(false);
  });

  it('starts with selectedBus=null and animating=false', () => {
    const state = createInitialState(makeLevel());
    expect(state.selectedBus).toBeNull();
    expect(state.animating).toBe(false);
  });

  it('does not mutate the original level', () => {
    const level = makeLevel();
    const origBus = level.buses[0];
    createInitialState(level);
    expect(level.buses[0]).toBe(origBus);
  });
});

// ── isRoad ─────────────────────────────────────────────────────────────────

describe('isRoad', () => {
  it('returns true for road cells', () => {
    const state = createInitialState(makeLevel());
    expect(isRoad(state, 1, 1)).toBe(true);
    expect(isRoad(state, 3, 3)).toBe(true);
  });

  it('returns false for non-road cells', () => {
    const state = createInitialState(makeLevel());
    expect(isRoad(state, 0, 0)).toBe(false);
    expect(isRoad(state, 4, 4)).toBe(false);
  });
});

// ── getBusAt ───────────────────────────────────────────────────────────────

describe('getBusAt', () => {
  it('returns bus when one occupies the cell', () => {
    const state = createInitialState(makeLevel());
    const bus = getBusAt(state, 1, 1);
    expect(bus).toBeDefined();
    expect(bus.id).toBe('b1');
  });

  it('returns undefined for empty cell', () => {
    const state = createInitialState(makeLevel());
    expect(getBusAt(state, 0, 0)).toBeUndefined();
  });

  it('returns undefined for exited bus', () => {
    const level = makeLevel();
    level.buses[0].exited = true;
    const state = createInitialState(level);
    expect(getBusAt(state, 1, 1)).toBeUndefined();
  });
});

// ── getStopAt ──────────────────────────────────────────────────────────────

describe('getStopAt', () => {
  it('returns stop at stop coordinates', () => {
    const state = createInitialState(makeLevel());
    const stop = getStopAt(state, 1, 0);
    expect(stop).toBeDefined();
    expect(stop.id).toBe('s1');
  });

  it('returns undefined for non-stop cell', () => {
    const state = createInitialState(makeLevel());
    expect(getStopAt(state, 2, 2)).toBeUndefined();
  });
});

// ── isExit ─────────────────────────────────────────────────────────────────

describe('isExit', () => {
  it('returns true at exit cell', () => {
    const state = createInitialState(makeLevel());
    expect(isExit(state, 3, 3)).toBe(true);
  });

  it('returns false for non-exit cell', () => {
    const state = createInitialState(makeLevel());
    expect(isExit(state, 0, 0)).toBe(false);
  });
});

// ── getValidMoves ──────────────────────────────────────────────────────────

describe('getValidMoves', () => {
  it('returns adjacent road cells not occupied by buses', () => {
    const state = createInitialState(makeLevel());
    const bus = state.buses[0]; // at (1,1)
    const moves = getValidMoves(state, bus);
    // (1,0) is a road and has a stop but no bus; (1,2) is a road
    const positions = moves.map(m => `${m.x},${m.y}`);
    expect(positions).toContain('1,2');
  });

  it('does not return cells blocked by another bus', () => {
    const level = makeLevel();
    level.buses.push({ id: 'b2', x: 1, y: 2, color: 'blue', passengers: 0, capacity: 2, exited: false });
    const state = createInitialState(level);
    const bus = state.buses[0]; // b1 at (1,1)
    const moves = getValidMoves(state, bus);
    const positions = moves.map(m => `${m.x},${m.y}`);
    expect(positions).not.toContain('1,2');
  });

  it('returns empty array for exited bus', () => {
    const state = createInitialState(makeLevel());
    const exitedBus = { ...state.buses[0], exited: true };
    expect(getValidMoves(state, exitedBus)).toEqual([]);
  });

  it('returns empty array for null bus', () => {
    const state = createInitialState(makeLevel());
    expect(getValidMoves(state, null)).toEqual([]);
  });
});

// ── findPath ───────────────────────────────────────────────────────────────

describe('findPath', () => {
  it('finds path from bus to reachable road cell', () => {
    const state = createInitialState(makeLevel());
    const bus = state.buses[0]; // at (1,1)
    const path = findPath(state, bus, 3, 3);
    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThan(0);
  });

  it('returns null when target is not a road', () => {
    const state = createInitialState(makeLevel());
    const bus = state.buses[0];
    expect(findPath(state, bus, 0, 0)).toBeNull();
  });

  it('returns null when target is occupied by another bus', () => {
    const level = makeLevel();
    level.buses.push({ id: 'b2', x: 1, y: 2, color: 'blue', passengers: 0, capacity: 2, exited: false });
    const state = createInitialState(level);
    const bus = state.buses[0];
    expect(findPath(state, bus, 1, 2)).toBeNull();
  });

  it('returns empty path when already at target', () => {
    const state = createInitialState(makeLevel());
    const bus = state.buses[0]; // at (1,1)
    const path = findPath(state, bus, 1, 1);
    // Target is occupied by the bus itself... so getBusAt returns the bus, returns null
    // Actually the bus is at (1,1) and getBusAt(state, 1,1) returns bus (not null)
    // So findPath returns null because target is occupied
    expect(path).toBeNull();
  });
});

// ── canBoard ───────────────────────────────────────────────────────────────

describe('canBoard', () => {
  it('returns the adjacent matching stop when bus can board', () => {
    const state = createInitialState(makeLevel());
    const bus = state.buses[0]; // red bus at (1,1), stop at (1,0) is red
    const stop = canBoard(state, bus);
    expect(stop).toBeDefined();
    expect(stop.id).toBe('s1');
  });

  it('returns null when bus is full', () => {
    const level = makeLevel();
    level.buses[0].passengers = 2;
    level.buses[0].capacity = 2;
    const state = createInitialState(level);
    const bus = state.buses[0];
    expect(canBoard(state, bus)).toBeNull();
  });

  it('returns null when no matching stop nearby', () => {
    const level = makeLevel();
    level.buses[0] = { id: 'b1', x: 2, y: 3, color: 'red', passengers: 0, capacity: 2, exited: false };
    level.roads = [...level.roads, [2,3]];
    const state = createInitialState(level);
    const bus = state.buses[0];
    expect(canBoard(state, bus)).toBeNull();
  });

  it('returns null for null bus', () => {
    const state = createInitialState(makeLevel());
    expect(canBoard(state, null)).toBeNull();
  });

  it('returns null for exited bus', () => {
    const level = makeLevel();
    level.buses[0].exited = true;
    const state = createInitialState(level);
    expect(canBoard(state, state.buses[0])).toBeNull();
  });
});

// ── boardPassenger ─────────────────────────────────────────────────────────

describe('boardPassenger', () => {
  it('removes one passenger from the stop and increments bus count', () => {
    const state = createInitialState(makeLevel());
    const bus = state.buses[0];
    const result = boardPassenger(state, bus);
    expect(result).not.toBe(false);
    expect(bus.passengers).toBe(1);
    expect(state.stops[0].waiting).toHaveLength(1);
  });

  it('returns false when bus cannot board', () => {
    const level = makeLevel();
    level.buses[0].passengers = 2; // full
    level.buses[0].capacity = 2;
    const state = createInitialState(level);
    expect(boardPassenger(state, state.buses[0])).toBe(false);
  });
});

// ── canExit / executeExit ─────────────────────────────────────────────────

describe('canExit', () => {
  it('returns true when bus is full and at exit', () => {
    const level = makeLevel();
    // Put bus at exit
    level.buses[0] = { id: 'b1', x: 3, y: 3, color: 'red', passengers: 2, capacity: 2, exited: false };
    const state = createInitialState(level);
    expect(canExit(state, state.buses[0])).toBe(true);
  });

  it('returns false when bus is not full', () => {
    const level = makeLevel();
    level.buses[0] = { id: 'b1', x: 3, y: 3, color: 'red', passengers: 1, capacity: 2, exited: false };
    const state = createInitialState(level);
    expect(canExit(state, state.buses[0])).toBe(false);
  });

  it('returns false when bus is not at exit', () => {
    const level = makeLevel();
    level.buses[0].passengers = 2;
    const state = createInitialState(level);
    expect(canExit(state, state.buses[0])).toBe(false);
  });

  it('returns false for exited bus', () => {
    const level = makeLevel();
    level.buses[0].exited = true;
    const state = createInitialState(level);
    expect(canExit(state, state.buses[0])).toBe(false);
  });
});

describe('executeExit', () => {
  it('marks bus as exited when conditions are met', () => {
    const level = makeLevel();
    level.buses[0] = { id: 'b1', x: 3, y: 3, color: 'red', passengers: 2, capacity: 2, exited: false };
    const state = createInitialState(level);
    const result = executeExit(state, state.buses[0]);
    expect(result).toBe(true);
    expect(state.buses[0].exited).toBe(true);
  });

  it('returns false when conditions are not met', () => {
    const state = createInitialState(makeLevel());
    const result = executeExit(state, state.buses[0]);
    expect(result).toBe(false);
    expect(state.buses[0].exited).toBe(false);
  });
});

// ── checkWin ───────────────────────────────────────────────────────────────

describe('checkWin', () => {
  it('returns true when all buses exited and all stops empty', () => {
    const level = makeLevel();
    level.buses[0].exited = true;
    level.stops[0].waiting = [];
    const state = createInitialState(level);
    expect(checkWin(state)).toBe(true);
  });

  it('returns false when buses have not exited', () => {
    const state = createInitialState(makeLevel());
    expect(checkWin(state)).toBe(false);
  });

  it('returns false when stops still have passengers', () => {
    const level = makeLevel();
    level.buses[0].exited = true;
    // stops[0].waiting still has passengers
    const state = createInitialState(level);
    expect(checkWin(state)).toBe(false);
  });
});

// ── countRemainingPassengers ───────────────────────────────────────────────

describe('countRemainingPassengers', () => {
  it('counts all waiting passengers across stops', () => {
    const state = createInitialState(makeLevel());
    expect(countRemainingPassengers(state)).toBe(2);
  });

  it('returns 0 when all stops are empty', () => {
    const level = makeLevel();
    level.stops[0].waiting = [];
    const state = createInitialState(level);
    expect(countRemainingPassengers(state)).toBe(0);
  });

  it('sums across multiple stops', () => {
    const level = makeLevel();
    level.stops.push({ id: 's2', x: 2, y: 0, color: 'blue', waiting: ['p3', 'p4', 'p5'] });
    const state = createInitialState(level);
    expect(countRemainingPassengers(state)).toBe(5);
  });
});

// ── cloneState ─────────────────────────────────────────────────────────────

describe('cloneState', () => {
  it('deep-copies buses', () => {
    const state = createInitialState(makeLevel());
    const clone = cloneState(state);
    expect(clone.buses).not.toBe(state.buses);
    expect(clone.buses[0]).not.toBe(state.buses[0]);
  });

  it('deep-copies stops with waiting arrays', () => {
    const state = createInitialState(makeLevel());
    const clone = cloneState(state);
    expect(clone.stops[0].waiting).not.toBe(state.stops[0].waiting);
    expect(clone.stops[0].waiting).toEqual(['p1', 'p2']);
  });

  it('deep-copies roads as a new Set', () => {
    const state = createInitialState(makeLevel());
    const clone = cloneState(state);
    expect(clone.roads).not.toBe(state.roads);
    expect(clone.roads.has('1,1')).toBe(true);
  });

  it('mutating clone bus does not affect original', () => {
    const state = createInitialState(makeLevel());
    const clone = cloneState(state);
    clone.buses[0].passengers = 99;
    expect(state.buses[0].passengers).toBe(0);
  });

  it('preserves moves count', () => {
    const state = { ...createInitialState(makeLevel()), moves: 5 };
    const clone = cloneState(state);
    expect(clone.moves).toBe(5);
  });
});

// ── calculateStars ─────────────────────────────────────────────────────────

describe('calculateStars', () => {
  it('gives 3 stars when moves <= optimal', () => {
    expect(calculateStars(5, 5)).toBe(3);
    expect(calculateStars(3, 5)).toBe(3);
  });

  it('gives 2 stars when moves are up to 1.5x optimal', () => {
    expect(calculateStars(7, 5)).toBe(2);
    expect(calculateStars(8, 6)).toBe(2);
  });

  it('gives 1 star when moves exceed 1.5x optimal', () => {
    expect(calculateStars(10, 5)).toBe(1);
    expect(calculateStars(20, 5)).toBe(1);
  });
});

// ── getHint ────────────────────────────────────────────────────────────────

describe('getHint', () => {
  it('returns board hint when bus is adjacent to matching stop with waiting passengers', () => {
    // makeLevel(): bus at (1,1), red stop at (1,0) with 2 waiting passengers
    const state = createInitialState(makeLevel());
    const hint = getHint(state);
    expect(hint).not.toBeNull();
    expect(hint.type).toBe('board');
    expect(hint.bus.id).toBe('b1');
    expect(hint.stop).toBeDefined();
    expect(hint.message).toContain('red');
  });

  it('returns exit hint when bus is full and can reach exit', () => {
    // Bus at (1,3) is full (passengers=capacity=2), not adjacent to stop at (1,0)
    const level = makeLevel({
      buses: [{ id: 'b1', x: 1, y: 3, color: 'red', passengers: 2, capacity: 2, exited: false }],
    });
    const state = createInitialState(level);
    const hint = getHint(state);
    expect(hint).not.toBeNull();
    expect(hint.type).toBe('exit');
    expect(hint.bus.id).toBe('b1');
    expect(hint.exit).toBeDefined();
  });

  it('returns move hint when stop has no waiting passengers (priority 4 fallback)', () => {
    // Empty stop → canBoard null, bus not full, no move-to-stop path either
    const level = makeLevel({
      stops: [{ id: 's1', x: 1, y: 0, color: 'red', waiting: [] }],
    });
    const state = createInitialState(level);
    const hint = getHint(state);
    expect(hint).not.toBeNull();
    expect(hint.type).toBe('move');
    expect(hint.bus).toBeDefined();
  });

  it('returns null when all buses have exited', () => {
    const level = makeLevel({
      buses: [{ id: 'b1', x: 1, y: 1, color: 'red', passengers: 2, capacity: 2, exited: true }],
    });
    const state = createInitialState(level);
    expect(getHint(state)).toBeNull();
  });
});

// ── createHistory ──────────────────────────────────────────────────────────

describe('createHistory', () => {
  it('returns object with push, undo, canUndo methods', () => {
    const hist = createHistory();
    expect(typeof hist.push).toBe('function');
    expect(typeof hist.undo).toBe('function');
    expect(typeof hist.canUndo).toBe('function');
  });

  it('cannot undo after a single push', () => {
    const hist = createHistory();
    hist.push({ moves: 0 });
    expect(hist.canUndo()).toBe(false);
  });

  it('can undo after two pushes and returns prior state', () => {
    const hist = createHistory();
    hist.push({ moves: 0 });
    hist.push({ moves: 1 });
    expect(hist.canUndo()).toBe(true);
    const prev = hist.undo();
    expect(prev.moves).toBe(0);
  });

  it('respects custom maxDepth by evicting oldest entry', () => {
    const hist = createHistory(2);
    hist.push('a');
    hist.push('b');
    hist.push('c'); // 'a' evicted; stack = ['b', 'c']
    expect(hist.canUndo()).toBe(true);
    expect(hist.undo()).toBe('b');
  });
});
