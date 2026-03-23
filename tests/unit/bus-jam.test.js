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

  it('returns null when bus occupies the target cell itself', () => {
    const state = createInitialState(makeLevel());
    const bus = state.buses[0]; // at (1,1)
    // bus IS at (1,1) → getBusAt returns the bus → returns null
    expect(findPath(state, bus, 1, 1)).toBeNull();
  });

  it('path elements have x, y, and direction fields', () => {
    const state = createInitialState(makeLevel());
    const bus = state.buses[0]; // at (1,1)
    const path = findPath(state, bus, 3, 3);
    expect(path).not.toBeNull();
    for (const step of path) {
      expect(typeof step.x).toBe('number');
      expect(typeof step.y).toBe('number');
      expect(typeof step.direction).toBe('string');
    }
  });

  it('last step in path is at the target cell', () => {
    const state = createInitialState(makeLevel());
    const bus = state.buses[0]; // at (1,1)
    const path = findPath(state, bus, 3, 3);
    expect(path).not.toBeNull();
    const last = path[path.length - 1];
    expect(last.x).toBe(3);
    expect(last.y).toBe(3);
  });

  it('finds direct single-step path to adjacent road cell', () => {
    const state = createInitialState(makeLevel());
    const bus = state.buses[0]; // at (1,1); (1,2) is adjacent road
    const path = findPath(state, bus, 1, 2);
    expect(path).not.toBeNull();
    expect(path.length).toBe(1);
    // Path elements are the NEXT cells visited (not the starting position)
    expect(path[0].x).toBe(1);
    expect(path[0].y).toBe(2);
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

  it('returns null when adjacent stop has wrong color (stop.color !== bus.color branch)', () => {
    // Bus is blue, adjacent stop is red → color mismatch → condition fails → null
    const level = makeLevel({
      buses: [{ id: 'b1', x: 1, y: 1, color: 'blue', passengers: 0, capacity: 2, exited: false }],
      stops: [{ id: 's1', x: 1, y: 0, color: 'red', waiting: ['p1'] }],
    });
    const state = createInitialState(level);
    expect(canBoard(state, state.buses[0])).toBeNull();
  });

  it('returns null when adjacent matching-color stop has no waiting passengers (waiting.length === 0 branch)', () => {
    // Bus is red, adjacent stop is red but empty → length check fails → null
    const level = makeLevel({
      stops: [{ id: 's1', x: 1, y: 0, color: 'red', waiting: [] }],
    });
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

  it('returns { stop, passenger } with correct data', () => {
    const state = createInitialState(makeLevel());
    const bus = state.buses[0]; // red bus adjacent to red stop s1
    const result = boardPassenger(state, bus);
    expect(result).not.toBe(false);
    expect(result.stop).toBeDefined();
    expect(result.stop.id).toBe('s1');
    expect(result.passenger).toBe('p1'); // first waiting passenger
  });

  it('boarding all passengers empties the stop', () => {
    const state = createInitialState(makeLevel()); // stop has 2 waiting
    const bus = state.buses[0];
    boardPassenger(state, bus);  // board p1
    boardPassenger(state, bus);  // board p2 (bus now full)
    expect(state.stops[0].waiting).toHaveLength(0);
    expect(bus.passengers).toBe(2);
  });

  it('returns false when stop has no waiting passengers', () => {
    const level = makeLevel();
    level.stops[0].waiting = [];
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

  it('returns false for null bus', () => {
    const state = createInitialState(makeLevel());
    expect(canExit(state, null)).toBe(false);
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

  it('gives 2 stars when ratio is exactly 1.5 (boundary inclusive)', () => {
    expect(calculateStars(15, 10)).toBe(2); // 15/10 = 1.5
  });

  it('gives 2 stars when ratio is between 1.0 (exclusive) and 1.5 (exclusive)', () => {
    expect(calculateStars(6, 5)).toBe(2); // 6/5 = 1.2
    expect(calculateStars(7, 6)).toBe(2); // 7/6 ≈ 1.167
  });

  it('gives 1 star when moves exceed 1.5x optimal', () => {
    expect(calculateStars(10, 5)).toBe(1);
    expect(calculateStars(20, 5)).toBe(1);
  });

  it('gives 2 stars when ratio is just above 1.0 (exclusive upper bound of 3-star)', () => {
    expect(calculateStars(11, 10)).toBe(2); // 1.1 > 1.0 → not 3 stars
  });

  it('gives 1 star when ratio is just above 1.5 (exclusive upper bound of 2-star)', () => {
    expect(calculateStars(16, 10)).toBe(1); // 1.6 > 1.5 → not 2 stars
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

  it('skips exit hint when full bus is already at exit (path.length === 0, empty array is truthy but fails > 0)', () => {
    // Bus positioned exactly at the exit: findPath returns [] (empty path), not null
    // Condition: path && path.length > 0 → true && false → skipped
    const level = makeLevel({
      buses: [{ id: 'b1', x: 3, y: 3, color: 'red', passengers: 2, capacity: 2, exited: false }],
    });
    const state = createInitialState(level);
    const hint = getHint(state);
    // Bus is already at exit — priority 2 skips (path.length=0)
    // Falls through to priority 3 or 4 (or null if nothing else matches)
    expect(hint === null || hint.type !== 'exit').toBe(true);
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

  it('skips exit hint when exit is occupied by another bus (path===null, && short-circuits — Priority 2 false arm)', () => {
    // b1 is full, b2 sits at the exit (3,3) → findPath(b1, exit) returns null
    // Condition: path && path.length > 0 → null && ... → false (short-circuit, never checks length)
    // Priority 2 is skipped; Priority 3 fires because b1 can reach (1,1) adjacent to stop (1,0)
    const level = makeLevel({
      buses: [
        { id: 'b1', x: 1, y: 3, color: 'red', passengers: 2, capacity: 2, exited: false },
        { id: 'b2', x: 3, y: 3, color: 'blue', passengers: 0, capacity: 2, exited: false },
      ],
    });
    const state = createInitialState(level);
    const hint = getHint(state);
    // Priority 2 skipped (path null) → hint is not an exit hint
    expect(hint).not.toBeNull();
    expect(hint.type).not.toBe('exit');
  });

  it('returns null when all buses have exited', () => {
    const level = makeLevel({
      buses: [{ id: 'b1', x: 1, y: 1, color: 'red', passengers: 2, capacity: 2, exited: true }],
    });
    const state = createInitialState(level);
    expect(getHint(state)).toBeNull();
  });

  it('returns move hint (priority 3) when bus is not adjacent but can path to matching stop', () => {
    // Bus at (1,3): not adjacent to stop at (1,0), not full — priority 1 & 2 skip
    // Path exists from (1,3) → (1,1) which is adjacent to (1,0) — priority 3 fires
    const level = makeLevel({
      buses: [{ id: 'b1', x: 1, y: 3, color: 'red', passengers: 0, capacity: 2, exited: false }],
    });
    const state = createInitialState(level);
    const hint = getHint(state);
    expect(hint).not.toBeNull();
    expect(hint.type).toBe('move');
    expect(hint.stop).toBeDefined();
    expect(hint.stop.id).toBe('s1');
  });

  it('falls through to priority 4 when all paths to adjacent stop cells return null (if(path && ...) false arm)', () => {
    // Red bus at (3,3) — far from stop, not adjacent → Priority 1 skips
    // Not full → Priority 2 skips
    // Blue bus at (1,1) blocks the only road cell adjacent to stop (1,0)
    // All other cells adjacent to stop (1,0) are non-road → findPath returns null for each
    // → Priority 3 if(path && path.length > 0) is false for all directions → falls through
    // → Priority 4 fires because red bus at (3,3) has valid move to (2,3)
    const level = makeLevel({
      buses: [
        { id: 'b1', x: 3, y: 3, color: 'red', passengers: 0, capacity: 2, exited: false },
        { id: 'b2', x: 1, y: 1, color: 'blue', passengers: 0, capacity: 2, exited: false },
      ],
    });
    const state = createInitialState(level);
    const hint = getHint(state);
    // Priority 3 fell through; Priority 4 gives a generic move hint
    expect(hint).not.toBeNull();
    expect(hint.type).toBe('move');
    // The hint should NOT reference the stop (priority 3 did not fire)
    expect(hint.stop).toBeUndefined();
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

// ── getHint — priority 4 fallback ──────────────────────────────────────────

describe('getHint — priority 4 fallback (any valid move)', () => {
  it('returns generic move hint when priorities 1-3 all find nothing', () => {
    // Blue bus, only a red stop → color mismatch skips priorities 1 & 3
    // Bus not full → priority 2 skipped
    // Bus has valid road moves → priority 4 fires
    const state = createInitialState(makeLevel({
      buses: [{ id: 'b1', x: 1, y: 1, color: 'blue', passengers: 0, capacity: 2, exited: false }],
      stops: [{ id: 's1', x: 1, y: 0, color: 'red', waiting: ['p1'] }],
    }));
    const hint = getHint(state);
    expect(hint).not.toBeNull();
    expect(hint.type).toBe('move');
    expect(hint.message).toBe('Try moving the blue bus.');
    expect(Array.isArray(hint.path)).toBe(true);
    expect(hint.path).toHaveLength(1);
  });

  it('returns null when priority 4 bus has no valid moves (moves.length > 0 false branch)', () => {
    // Bus on an isolated road cell with no adjacent roads — getValidMoves returns []
    // Priorities 1-3: no matching stop → all skipped
    // Priority 4: moves.length === 0 → false branch → loop continues → returns null
    const state = createInitialState({
      grid: { width: 5, height: 5 },
      buses: [{ id: 'b1', x: 2, y: 2, color: 'blue', passengers: 0, capacity: 2, exited: false }],
      stops: [],
      exits: [],
      roads: [[2, 2]], // isolated single cell — no adjacent roads
    });
    expect(getHint(state)).toBeNull();
  });
});
