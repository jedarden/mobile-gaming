/**
 * Parking Escape - Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  buildOccupied,
  getVehicleMoves,
  getAllMoves,
  applyMove,
  checkWin,
  solve
} from '../../src/games/parking-escape/state.js';

const SIMPLE_LEVEL = {
  grid: {
    width: 6,
    height: 6,
    exit: { x: 6, y: 2, direction: 'right' },
    vehicles: [
      { id: 'hero', type: 'hero', x: 0, y: 2, width: 2, height: 1, orientation: 'horizontal', color: '#E74C3C' },
      { id: 'v1',   type: 'car',  x: 3, y: 2, width: 1, height: 2, orientation: 'vertical',   color: '#3498DB' }
    ]
  }
};

const BLOCKED_LEVEL = {
  grid: {
    width: 6,
    height: 6,
    exit: { x: 6, y: 2, direction: 'right' },
    vehicles: [
      { id: 'hero', type: 'hero', x: 0, y: 2, width: 2, height: 1, orientation: 'horizontal', color: '#E74C3C' },
      { id: 'v1',   type: 'car',  x: 3, y: 2, width: 1, height: 2, orientation: 'vertical',   color: '#3498DB' },
      { id: 'v2',   type: 'car',  x: 3, y: 0, width: 2, height: 1, orientation: 'horizontal', color: '#2ECC71' }
    ]
  }
};

describe('createInitialState', () => {
  it('creates state from level', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(state.vehicles).toHaveLength(2);
    expect(state.moves).toBe(0);
    expect(state.status).toBe('playing');
    expect(state.grid.width).toBe(6);
    expect(state.grid.height).toBe(6);
  });

  it('copies vehicles (no shared references)', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    state.vehicles[0].x = 99;
    expect(SIMPLE_LEVEL.grid.vehicles[0].x).toBe(0);
  });
});

describe('buildOccupied', () => {
  it('places horizontal vehicle correctly', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const occ = buildOccupied(state);
    expect(occ[2][0]).toBe('hero');
    expect(occ[2][1]).toBe('hero');
    expect(occ[2][2]).toBeNull();
  });

  it('places vertical vehicle correctly', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const occ = buildOccupied(state);
    expect(occ[2][3]).toBe('v1');
    expect(occ[3][3]).toBe('v1');
    expect(occ[4][3]).toBeNull();
  });

  it('empty cells are null', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const occ = buildOccupied(state);
    expect(occ[0][0]).toBeNull();
    expect(occ[5][5]).toBeNull();
  });
});

describe('getVehicleMoves', () => {
  it('hero can move right (path clear)', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const moves = getVehicleMoves(state, 'hero');
    const rights = moves.filter(m => m.direction === 'right');
    expect(rights.length).toBeGreaterThan(0);
    expect(rights.map(m => m.distance)).toContain(1);
  });

  it('hero blocked at column 1 by v1 at column 3 (width 2 → rightmost at col 1)', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const moves = getVehicleMoves(state, 'hero');
    // hero width=2, rightmost cell = x+1=1, v1 at col 3 → right by 1 allowed
    const rights = moves.filter(m => m.direction === 'right');
    expect(rights.map(m => m.distance)).toContain(1);
    // distance 2 would place right edge at col 3, blocked by v1
    expect(rights.map(m => m.distance)).not.toContain(2);
  });

  it('returns empty for unknown vehicle', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(getVehicleMoves(state, 'nonexistent')).toHaveLength(0);
  });

  it('vertical vehicle can move up and down', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const moves = getVehicleMoves(state, 'v1');
    expect(moves.some(m => m.direction === 'up')).toBe(true);
    expect(moves.some(m => m.direction === 'down')).toBe(true);
  });
});

describe('applyMove', () => {
  it('moves hero right by 1', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next = applyMove(state, 'hero', 'right', 1);
    const hero = next.vehicles.find(v => v.id === 'hero');
    expect(hero.x).toBe(1);
    expect(next.moves).toBe(1);
  });

  it('increments move count', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const s1 = applyMove(state, 'hero', 'right', 1);
    const s2 = applyMove(s1, 'hero', 'right', 0); // invalid but counter still increments
    // Actually applyMove doesn't validate — just moves
    expect(s1.moves).toBe(1);
  });

  it('does not mutate original state', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const origX = state.vehicles[0].x;
    applyMove(state, 'hero', 'right', 1);
    expect(state.vehicles[0].x).toBe(origX);
  });

  it('sets status won when hero reaches exit', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    // hero at (0,2), v1 at col 3. Move hero right by 1 to x=1, then the path to exit needs clearing
    // In SIMPLE_LEVEL, v1 is at y=2 col 3 blocking. Move v1 up first
    const s1 = applyMove(state, 'v1', 'up', 2);
    const s2 = applyMove(s1, 'hero', 'right', 4);
    expect(s2.status).toBe('won');
  });
});

describe('checkWin', () => {
  it('returns false for initial state (path blocked)', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(checkWin(state)).toBe(false);
  });

  it('returns true when hero has clear path to right exit', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    // Move v1 out of row 2
    const s1 = applyMove(state, 'v1', 'up', 2);
    expect(checkWin(s1)).toBe(true);
  });

  it('returns false if another vehicle is in path', () => {
    const state = createInitialState(BLOCKED_LEVEL);
    // hero at row 2, v1 at (3,2) blocks
    expect(checkWin(state)).toBe(false);
  });
});

describe('getAllMoves', () => {
  it('returns moves for all vehicles', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const moves = getAllMoves(state);
    const ids = new Set(moves.map(m => m.vehicleId));
    expect(ids.has('hero')).toBe(true);
    expect(ids.has('v1')).toBe(true);
  });

  it('each move has vehicleId, direction, distance', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const moves = getAllMoves(state);
    for (const m of moves) {
      expect(m.vehicleId).toBeTruthy();
      expect(['left','right','up','down']).toContain(m.direction);
      expect(m.distance).toBeGreaterThan(0);
    }
  });
});

describe('solve', () => {
  it('solves a trivially simple level', () => {
    // Hero can reach exit with no blockers
    const level = {
      grid: {
        width: 6,
        height: 6,
        exit: { x: 6, y: 2, direction: 'right' },
        vehicles: [
          { id: 'hero', type: 'hero', x: 0, y: 2, width: 2, height: 1, orientation: 'horizontal', color: '#E74C3C' }
        ]
      }
    };
    const result = solve(level);
    expect(result).not.toBeNull();
    expect(result.cost).toBeGreaterThanOrEqual(0);
  });

  it('solves SIMPLE_LEVEL with one blocker', () => {
    const result = solve(SIMPLE_LEVEL);
    expect(result).not.toBeNull();
    expect(result.cost).toBeGreaterThan(0);
    expect(result.path.length).toBe(result.cost);
  });

  it('returns null for unsolvable level', () => {
    // Hero completely surrounded on row with no escape
    const level = {
      grid: {
        width: 4,
        height: 4,
        exit: { x: 4, y: 1, direction: 'right' },
        vehicles: [
          { id: 'hero', type: 'hero', x: 1, y: 1, width: 2, height: 1, orientation: 'horizontal', color: '#E74C3C' },
          { id: 'b1', type: 'car', x: 0, y: 0, width: 1, height: 4, orientation: 'vertical', color: '#3498DB' },
          { id: 'b2', type: 'car', x: 3, y: 0, width: 1, height: 4, orientation: 'vertical', color: '#2ECC71' }
        ]
      }
    };
    const result = solve(level);
    expect(result).toBeNull();
  });

  it('path replay reaches won state', () => {
    const result = solve(SIMPLE_LEVEL);
    expect(result).not.toBeNull();
    let state = createInitialState(SIMPLE_LEVEL);
    for (const move of result.path) {
      state = applyMove(state, move.vehicleId, move.direction, move.distance);
    }
    expect(state.status).toBe('won');
  });
});
