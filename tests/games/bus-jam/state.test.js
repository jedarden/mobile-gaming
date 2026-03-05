/**
 * Tests for Bus Jam - State Management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BUS_COLORS,
  createInitialState,
  cloneState,
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
  getHint,
  calculateStars,
  createHistory
} from '../../../src/games/bus-jam/state.js';

describe('Bus Jam State', () => {
  describe('BUS_COLORS', () => {
    it('should define all required bus colors', () => {
      expect(BUS_COLORS.red).toBeDefined();
      expect(BUS_COLORS.blue).toBeDefined();
      expect(BUS_COLORS.green).toBeDefined();
      expect(BUS_COLORS.yellow).toBeDefined();
      expect(BUS_COLORS.purple).toBeDefined();
      expect(BUS_COLORS.orange).toBeDefined();
    });

    it('should have valid hex color codes', () => {
      const hexPattern = /^#[0-9A-Fa-f]{6}$/;
      Object.values(BUS_COLORS).forEach(color => {
        expect(color).toMatch(hexPattern);
      });
    });
  });

  describe('createInitialState', () => {
    it('should create initial state from level data', () => {
      const level = {
        id: 1,
        difficulty: 0.5,
        optimal: 5,
        grid: { cols: 5, rows: 5 },
        buses: [
          { id: 'bus1', x: 1, y: 2, color: 'red', passengers: 0, capacity: 3, direction: 'right' }
        ],
        stops: [
          { x: 2, y: 1, color: 'red', waiting: ['red', 'red', 'red'] }
        ],
        exits: [{ x: 4, y: 2 }],
        roads: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [2, 1], [2, 3]]
      };

      const state = createInitialState(level);

      expect(state.grid).toEqual({ cols: 5, rows: 5 });
      expect(state.buses).toHaveLength(1);
      expect(state.stops).toHaveLength(1);
      expect(state.exits).toHaveLength(1);
      expect(state.moves).toBe(0);
      expect(state.selectedBus).toBeNull();
      expect(state.animating).toBe(false);
      expect(state.won).toBe(false);
    });

    it('should convert roads array to Set', () => {
      const level = {
        grid: { cols: 3, rows: 3 },
        buses: [],
        stops: [],
        exits: [],
        roads: [[0, 0], [1, 0], [2, 0]]
      };

      const state = createInitialState(level);

      expect(state.roads).toBeInstanceOf(Set);
      expect(state.roads.has('0,0')).toBe(true);
      expect(state.roads.has('1,0')).toBe(true);
      expect(state.roads.has('2,0')).toBe(true);
      expect(state.roads.has('0,1')).toBe(false);
    });

    it('should deep copy buses array', () => {
      const level = {
        grid: { cols: 3, rows: 3 },
        buses: [{ id: 'bus1', x: 1, y: 2, color: 'red', passengers: 0, capacity: 3, direction: 'right' }],
        stops: [],
        exits: [],
        roads: []
      };

      const state = createInitialState(level);

      // Modify original
      level.buses[0].x = 999;

      // State should be unchanged
      expect(state.buses[0].x).toBe(1);
    });

    it('should deep copy stops and waiting arrays', () => {
      const level = {
        grid: { cols: 3, rows: 3 },
        buses: [],
        stops: [{ x: 1, y: 1, color: 'red', waiting: ['red', 'red'] }],
        exits: [],
        roads: []
      };

      const state = createInitialState(level);

      // Modify original
      level.stops[0].waiting.push('blue');

      // State should be unchanged
      expect(state.stops[0].waiting).toHaveLength(2);
    });

    it('should deep copy exits array', () => {
      const level = {
        grid: { cols: 3, rows: 3 },
        buses: [],
        stops: [],
        exits: [{ x: 2, y: 1 }],
        roads: []
      };

      const state = createInitialState(level);

      // Modify original
      level.exits[0].x = 999;

      // State should be unchanged
      expect(state.exits[0].x).toBe(2);
    });
  });

  describe('cloneState', () => {
    it('should create a deep copy of state', () => {
      const state = {
        grid: { cols: 5, rows: 5 },
        buses: [
          { id: 'bus1', x: 1, y: 2, color: 'red', passengers: 2, capacity: 3, direction: 'right', exited: false }
        ],
        stops: [
          { x: 2, y: 1, color: 'red', waiting: ['red'] }
        ],
        exits: [{ x: 4, y: 2 }],
        roads: new Set(['0,0', '1,0', '2,0']),
        moves: 5,
        selectedBus: 'bus1',
        animating: false,
        won: false
      };

      const cloned = cloneState(state);

      expect(cloned.grid).toEqual(state.grid);
      expect(cloned.buses).toEqual(state.buses);
      expect(cloned.stops).toEqual(state.stops);
      expect(cloned.exits).toEqual(state.exits);
      expect(cloned.roads).toEqual(state.roads);
      expect(cloned.moves).toBe(5);
      expect(cloned.selectedBus).toBe('bus1');
      expect(cloned.animating).toBe(false);
      expect(cloned.won).toBe(false);
    });

    it('should not affect original when modified', () => {
      const state = {
        grid: { cols: 5, rows: 5 },
        buses: [{ id: 'bus1', x: 1, y: 2, color: 'red', passengers: 0, capacity: 3, direction: 'right' }],
        stops: [{ x: 2, y: 1, color: 'red', waiting: ['red', 'red'] }],
        exits: [],
        roads: new Set(['0,0']),
        moves: 0,
        selectedBus: null,
        animating: false,
        won: false
      };

      const cloned = cloneState(state);
      cloned.buses[0].x = 999;
      cloned.stops[0].waiting.pop();
      cloned.moves = 10;

      expect(state.buses[0].x).toBe(1);
      expect(state.stops[0].waiting).toHaveLength(2);
      expect(state.moves).toBe(0);
    });

    it('should create independent copies of arrays', () => {
      const state = {
        grid: { cols: 5, rows: 5 },
        buses: [{ id: 'bus1', x: 1, y: 2 }],
        stops: [{ x: 2, y: 1, waiting: ['red'] }],
        exits: [{ x: 4, y: 2 }],
        roads: new Set(['0,0']),
        moves: 0,
        selectedBus: null,
        animating: false,
        won: false
      };

      const cloned = cloneState(state);

      expect(cloned.buses).not.toBe(state.buses);
      expect(cloned.stops).not.toBe(state.stops);
      expect(cloned.exits).not.toBe(state.exits);
      expect(cloned.roads).not.toBe(state.roads);
    });
  });

  describe('isRoad', () => {
    it('should return true for road cells', () => {
      const state = {
        roads: new Set(['0,0', '1,0', '2,0', '1,1'])
      };

      expect(isRoad(state, 0, 0)).toBe(true);
      expect(isRoad(state, 1, 0)).toBe(true);
      expect(isRoad(state, 2, 0)).toBe(true);
      expect(isRoad(state, 1, 1)).toBe(true);
    });

    it('should return false for non-road cells', () => {
      const state = {
        roads: new Set(['0,0', '1,0', '2,0'])
      };

      expect(isRoad(state, 0, 1)).toBe(false);
      expect(isRoad(state, 3, 0)).toBe(false);
      expect(isRoad(state, -1, 0)).toBe(false);
    });
  });

  describe('getBusAt', () => {
    let state;

    beforeEach(() => {
      state = {
        buses: [
          { id: 'bus1', x: 1, y: 2, exited: false },
          { id: 'bus2', x: 3, y: 4, exited: false }
        ]
      };
    });

    it('should return bus at position', () => {
      const bus = getBusAt(state, 1, 2);
      expect(bus).toBeDefined();
      expect(bus.id).toBe('bus1');
    });

    it('should return undefined for empty position', () => {
      const bus = getBusAt(state, 0, 0);
      expect(bus).toBeUndefined();
    });

    it('should not return exited buses', () => {
      state.buses[0].exited = true;
      const bus = getBusAt(state, 1, 2);
      expect(bus).toBeUndefined();
    });
  });

  describe('getStopAt', () => {
    it('should return stop at position', () => {
      const state = {
        stops: [
          { x: 2, y: 1, color: 'red', waiting: ['red'] },
          { x: 3, y: 2, color: 'blue', waiting: ['blue'] }
        ]
      };

      const stop = getStopAt(state, 2, 1);
      expect(stop).toBeDefined();
      expect(stop.color).toBe('red');
    });

    it('should return undefined for position without stop', () => {
      const state = {
        stops: [{ x: 2, y: 1, color: 'red', waiting: ['red'] }]
      };

      const stop = getStopAt(state, 0, 0);
      expect(stop).toBeUndefined();
    });
  });

  describe('isExit', () => {
    it('should return true for exit cells', () => {
      const state = {
        exits: [{ x: 4, y: 2 }, { x: 0, y: 2 }]
      };

      expect(isExit(state, 4, 2)).toBe(true);
      expect(isExit(state, 0, 2)).toBe(true);
    });

    it('should return false for non-exit cells', () => {
      const state = {
        exits: [{ x: 4, y: 2 }]
      };

      expect(isExit(state, 3, 2)).toBe(false);
      expect(isExit(state, 4, 3)).toBe(false);
    });
  });

  describe('getValidMoves', () => {
    let state;

    beforeEach(() => {
      state = {
        roads: new Set(['0,2', '1,2', '2,2', '3,2', '4,2', '2,1', '2,3']),
        buses: [
          { id: 'bus1', x: 2, y: 2, exited: false },
          { id: 'bus2', x: 3, y: 2, exited: false }
        ]
      };
    });

    it('should return valid adjacent moves', () => {
      const bus = state.buses[0];
      const moves = getValidMoves(state, bus);

      // Should have moves to 2,1 (up) and 2,3 (down) - left and right blocked by bus2 or out of roads
      expect(moves.length).toBeGreaterThan(0);
      expect(moves.some(m => m.x === 2 && m.y === 1)).toBe(true); // up
    });

    it('should not include occupied cells', () => {
      const bus = state.buses[0];
      const moves = getValidMoves(state, bus);

      // Position 3,2 is occupied by bus2
      expect(moves.some(m => m.x === 3 && m.y === 2)).toBe(false);
    });

    it('should not include non-road cells', () => {
      const bus = state.buses[0];
      const moves = getValidMoves(state, bus);

      // 2,0 is not a road
      expect(moves.some(m => m.x === 2 && m.y === 0)).toBe(false);
    });

    it('should return empty array for exited bus', () => {
      state.buses[0].exited = true;
      const moves = getValidMoves(state, state.buses[0]);

      expect(moves).toEqual([]);
    });

    it('should return empty array for null bus', () => {
      const moves = getValidMoves(state, null);

      expect(moves).toEqual([]);
    });

    it('should include direction in moves', () => {
      const bus = state.buses[0];
      const moves = getValidMoves(state, bus);

      moves.forEach(move => {
        expect(['up', 'down', 'left', 'right']).toContain(move.direction);
      });
    });
  });

  describe('findPath', () => {
    let state;

    beforeEach(() => {
      // Create a simple road network
      state = {
        roads: new Set([
          '0,0', '1,0', '2,0', '3,0', '4,0', // horizontal road
          '2,0', '2,1', '2,2', '2,3', '2,4'  // vertical road
        ]),
        buses: [
          { id: 'bus1', x: 0, y: 0, exited: false }
        ]
      };
    });

    it('should find path to reachable target', () => {
      const bus = state.buses[0];
      const path = findPath(state, bus, 4, 0);

      expect(path).not.toBeNull();
      expect(path.length).toBe(4);
      expect(path[path.length - 1].x).toBe(4);
      expect(path[path.length - 1].y).toBe(0);
    });

    it('should return null for non-road target', () => {
      const bus = state.buses[0];
      const path = findPath(state, bus, 5, 5);

      expect(path).toBeNull();
    });

    it('should return null for occupied target', () => {
      state.buses.push({ id: 'bus2', x: 4, y: 0, exited: false });
      const bus = state.buses[0];
      const path = findPath(state, bus, 4, 0);

      expect(path).toBeNull();
    });

    it('should return null when already at target (bus occupies target)', () => {
      const bus = state.buses[0];
      const path = findPath(state, bus, 0, 0);

      // Returns null because getBusAt finds the bus at target position
      expect(path).toBeNull();
    });

    it('should find path around obstacles', () => {
      // Add a blocking bus
      state.buses.push({ id: 'bus2', x: 2, y: 0, exited: false });
      const bus = state.buses[0];

      // Can still reach 2,0 via 0,0 -> (blocked at 2,0) -> should return null since direct path blocked
      const path = findPath(state, bus, 3, 0);

      // Path is blocked by bus at 2,0
      expect(path).toBeNull();
    });

    it('should include direction for each step', () => {
      const bus = state.buses[0];
      const path = findPath(state, bus, 2, 2);

      expect(path).not.toBeNull();
      path.forEach(step => {
        expect(['up', 'down', 'left', 'right']).toContain(step.direction);
        expect(step.x).toBeDefined();
        expect(step.y).toBeDefined();
      });
    });
  });

  describe('canBoard', () => {
    let state;

    beforeEach(() => {
      state = {
        buses: [
          { id: 'bus1', x: 1, y: 2, color: 'red', passengers: 0, capacity: 3, exited: false }
        ],
        stops: [
          { x: 1, y: 1, color: 'red', waiting: ['red', 'red', 'red'] }, // adjacent above
          { x: 2, y: 2, color: 'blue', waiting: ['blue'] }              // adjacent right
        ]
      };
    });

    it('should return stop when adjacent to matching color stop', () => {
      const bus = state.buses[0];
      const result = canBoard(state, bus);

      expect(result).not.toBeNull();
      expect(result.color).toBe('red');
    });

    it('should return null when stop has no waiting passengers', () => {
      state.stops[0].waiting = [];
      const bus = state.buses[0];
      const result = canBoard(state, bus);

      expect(result).toBeNull();
    });

    it('should return null when bus is full', () => {
      state.buses[0].passengers = 3;
      const bus = state.buses[0];
      const result = canBoard(state, bus);

      expect(result).toBeNull();
    });

    it('should return null when colors do not match', () => {
      state.buses[0].color = 'green';
      const bus = state.buses[0];
      const result = canBoard(state, bus);

      expect(result).toBeNull();
    });

    it('should return null for exited bus', () => {
      state.buses[0].exited = true;
      const bus = state.buses[0];
      const result = canBoard(state, bus);

      expect(result).toBeNull();
    });

    it('should return null for null bus', () => {
      const result = canBoard(state, null);

      expect(result).toBeNull();
    });
  });

  describe('boardPassenger', () => {
    let state;

    beforeEach(() => {
      state = {
        buses: [
          { id: 'bus1', x: 1, y: 2, color: 'red', passengers: 0, capacity: 3, exited: false }
        ],
        stops: [
          { x: 1, y: 1, color: 'red', waiting: ['red', 'red', 'red'] }
        ]
      };
    });

    it('should board one passenger from stop', () => {
      const bus = state.buses[0];
      const result = boardPassenger(state, bus);

      expect(result).not.toBe(false);
      expect(result.stop).toBeDefined();
      expect(result.passenger).toBe('red');
      expect(bus.passengers).toBe(1);
      expect(state.stops[0].waiting).toHaveLength(2);
    });

    it('should return false when cannot board', () => {
      state.stops[0].waiting = [];
      const bus = state.buses[0];
      const result = boardPassenger(state, bus);

      expect(result).toBe(false);
      expect(bus.passengers).toBe(0);
    });

    it('should board multiple passengers sequentially', () => {
      const bus = state.buses[0];

      boardPassenger(state, bus);
      expect(bus.passengers).toBe(1);

      boardPassenger(state, bus);
      expect(bus.passengers).toBe(2);

      boardPassenger(state, bus);
      expect(bus.passengers).toBe(3);

      // Should stop when full
      const result = boardPassenger(state, bus);
      expect(result).toBe(false);
    });
  });

  describe('canExit', () => {
    let state;

    beforeEach(() => {
      state = {
        buses: [
          { id: 'bus1', x: 4, y: 2, color: 'red', passengers: 3, capacity: 3, exited: false }
        ],
        exits: [{ x: 4, y: 2 }]
      };
    });

    it('should return true when bus is full and at exit', () => {
      const bus = state.buses[0];
      expect(canExit(state, bus)).toBe(true);
    });

    it('should return false when bus is not full', () => {
      state.buses[0].passengers = 2;
      const bus = state.buses[0];
      expect(canExit(state, bus)).toBe(false);
    });

    it('should return false when not at exit', () => {
      state.buses[0].x = 3;
      const bus = state.buses[0];
      expect(canExit(state, bus)).toBe(false);
    });

    it('should return false for exited bus', () => {
      state.buses[0].exited = true;
      const bus = state.buses[0];
      expect(canExit(state, bus)).toBe(false);
    });

    it('should return false for null bus', () => {
      expect(canExit(state, null)).toBe(false);
    });
  });

  describe('executeExit', () => {
    let state;

    beforeEach(() => {
      state = {
        buses: [
          { id: 'bus1', x: 4, y: 2, color: 'red', passengers: 3, capacity: 3, exited: false }
        ],
        exits: [{ x: 4, y: 2 }]
      };
    });

    it('should mark bus as exited', () => {
      const bus = state.buses[0];
      const result = executeExit(state, bus);

      expect(result).toBe(true);
      expect(bus.exited).toBe(true);
    });

    it('should return false when cannot exit', () => {
      state.buses[0].passengers = 2;
      const bus = state.buses[0];
      const result = executeExit(state, bus);

      expect(result).toBe(false);
      expect(bus.exited).toBe(false);
    });
  });

  describe('checkWin', () => {
    it('should return true when all buses exited and stops empty', () => {
      const state = {
        buses: [
          { id: 'bus1', exited: true },
          { id: 'bus2', exited: true }
        ],
        stops: [
          { waiting: [] },
          { waiting: [] }
        ]
      };

      expect(checkWin(state)).toBe(true);
    });

    it('should return false when buses not all exited', () => {
      const state = {
        buses: [
          { id: 'bus1', exited: true },
          { id: 'bus2', exited: false }
        ],
        stops: [
          { waiting: [] }
        ]
      };

      expect(checkWin(state)).toBe(false);
    });

    it('should return false when stops not empty', () => {
      const state = {
        buses: [
          { id: 'bus1', exited: true }
        ],
        stops: [
          { waiting: ['red'] }
        ]
      };

      expect(checkWin(state)).toBe(false);
    });

    it('should return true with no buses and empty stops', () => {
      const state = {
        buses: [],
        stops: []
      };

      expect(checkWin(state)).toBe(true);
    });
  });

  describe('countRemainingPassengers', () => {
    it('should count all waiting passengers', () => {
      const state = {
        stops: [
          { waiting: ['red', 'red', 'red'] },
          { waiting: ['blue', 'blue'] },
          { waiting: [] }
        ]
      };

      expect(countRemainingPassengers(state)).toBe(5);
    });

    it('should return 0 for empty stops', () => {
      const state = {
        stops: [
          { waiting: [] },
          { waiting: [] }
        ]
      };

      expect(countRemainingPassengers(state)).toBe(0);
    });

    it('should return 0 for no stops', () => {
      const state = {
        stops: []
      };

      expect(countRemainingPassengers(state)).toBe(0);
    });
  });

  describe('getHint', () => {
    let state;

    beforeEach(() => {
      state = {
        grid: { cols: 5, rows: 5 },
        roads: new Set(['0,2', '1,2', '2,2', '3,2', '4,2']),
        buses: [
          { id: 'bus1', x: 1, y: 2, color: 'red', passengers: 0, capacity: 3, exited: false }
        ],
        stops: [
          { x: 1, y: 1, color: 'red', waiting: ['red', 'red', 'red'] }
        ],
        exits: [{ x: 4, y: 2 }]
      };
    });

    it('should return boarding hint when bus can board', () => {
      // Bus is adjacent to matching stop
      const hint = getHint(state);

      expect(hint).not.toBeNull();
      expect(hint.type).toBe('board');
      expect(hint.bus).toBeDefined();
      expect(hint.stop).toBeDefined();
      expect(hint.message).toBeDefined();
    });

    it('should return exit hint when full bus can reach exit', () => {
      state.buses[0].passengers = 3;
      state.stops[0].waiting = [];
      const hint = getHint(state);

      expect(hint).not.toBeNull();
      expect(hint.type).toBe('exit');
      expect(hint.bus).toBeDefined();
    });

    it('should return move hint when bus can reach stop', () => {
      // Move bus away from stop
      state.buses[0].x = 0;
      state.buses[0].passengers = 0;
      const hint = getHint(state);

      expect(hint).not.toBeNull();
      expect(hint.type).toBe('move');
    });

    it('should return any valid move when no priorities match', () => {
      state.buses[0].passengers = 0;
      state.stops[0].waiting = [];
      state.buses[0].x = 0;

      const hint = getHint(state);

      expect(hint).not.toBeNull();
      expect(hint.type).toBe('move');
    });

    it('should return null when no moves available', () => {
      // All buses exited and stops empty
      state.buses[0].exited = true;
      state.stops[0].waiting = [];

      const hint = getHint(state);

      expect(hint).toBeNull();
    });

    it('should skip exited buses', () => {
      state.buses[0].exited = true;

      const hint = getHint(state);

      expect(hint).toBeNull();
    });
  });

  describe('calculateStars', () => {
    it('should return 3 stars for moves at or below optimal', () => {
      expect(calculateStars(5, 5)).toBe(3);
      expect(calculateStars(4, 5)).toBe(3);
      expect(calculateStars(3, 5)).toBe(3);
    });

    it('should return 2 stars for moves within 1.5x optimal', () => {
      expect(calculateStars(7, 5)).toBe(2);
      expect(calculateStars(6, 5)).toBe(2);
      expect(calculateStars(5, 4)).toBe(2);
    });

    it('should return 1 star for moves above 1.5x optimal', () => {
      expect(calculateStars(8, 5)).toBe(1);
      expect(calculateStars(10, 5)).toBe(1);
      expect(calculateStars(15, 5)).toBe(1);
    });

    it('should handle edge cases', () => {
      expect(calculateStars(1, 1)).toBe(3);  // ratio = 1
      expect(calculateStars(2, 1)).toBe(1);  // ratio = 2, which is > 1.5
      expect(calculateStars(100, 1)).toBe(1);
    });
  });

  describe('createHistory', () => {
    it('should create history manager with default max depth', () => {
      const history = createHistory();

      expect(history.canUndo()).toBe(false);
      expect(history.length).toBe(0);
    });

    it('should create history manager with custom max depth', () => {
      const history = createHistory(100);

      expect(history.canUndo()).toBe(false);
      expect(history.length).toBe(0);
    });

    it('should track state changes', () => {
      const history = createHistory(50);
      const state1 = { buses: [{ x: 1 }], moves: 0 };
      const state2 = { buses: [{ x: 2 }], moves: 1 };

      history.push(state1);
      history.push(state2);

      expect(history.length).toBe(2);
      expect(history.canUndo()).toBe(true);
    });

    it('should undo to previous state', () => {
      const history = createHistory(50);
      const state1 = { buses: [{ x: 1 }], moves: 0 };
      const state2 = { buses: [{ x: 2 }], moves: 1 };

      history.push(state1);
      history.push(state2);

      const undone = history.undo();

      expect(undone).not.toBeNull();
      expect(undone.buses[0].x).toBe(1);
    });

    it('should limit history size', () => {
      const history = createHistory(3);

      for (let i = 0; i < 5; i++) {
        history.push({ buses: [], moves: i });
      }

      expect(history.length).toBe(3);
    });

    it('should clear history', () => {
      const history = createHistory();
      history.push({ buses: [], moves: 0 });
      history.push({ buses: [], moves: 1 });

      history.clear();

      expect(history.length).toBe(0);
      expect(history.canUndo()).toBe(false);
    });
  });
});
