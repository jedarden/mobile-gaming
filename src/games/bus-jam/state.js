/**
 * Bus Jam - State Management
 *
 * Manages game state including:
 * - Grid, buses, stops, roads
 * - Move validation and execution
 * - Win condition checking
 * - State cloning for undo/redo
 */

import { History } from '../../shared/history.js';

// Bus colors
export const BUS_COLORS = {
  red: '#FF6B6B',
  blue: '#4DABF7',
  green: '#69DB7C',
  yellow: '#FFD93D',
  purple: '#B197FC',
  orange: '#FFA94D'
};

// Direction vectors
const DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 }
};

/**
 * Create initial game state from level data
 */
export function createInitialState(level) {
  return {
    grid: { ...level.grid },
    buses: level.buses.map(b => ({ ...b })),
    stops: level.stops.map(s => ({ ...s, waiting: [...s.waiting] })),
    exits: level.exits.map(e => ({ ...e })),
    roads: new Set(level.roads.map(r => `${r[0]},${r[1]}`)),
    moves: 0,
    selectedBus: null,
    animating: false,
    won: false
  };
}

/**
 * Check if a cell is a road
 */
export function isRoad(state, x, y) {
  return state.roads.has(`${x},${y}`);
}

/**
 * Check if a cell is occupied by a bus
 */
export function getBusAt(state, x, y) {
  return state.buses.find(b => b.x === x && b.y === y && !b.exited);
}

/**
 * Check if a cell is a stop
 */
export function getStopAt(state, x, y) {
  return state.stops.find(s => s.x === x && s.y === y);
}

/**
 * Check if a cell is an exit
 */
export function isExit(state, x, y) {
  return state.exits.some(e => e.x === x && e.y === y);
}

/**
 * Get adjacent cells that are valid for movement
 */
export function getValidMoves(state, bus) {
  if (!bus || bus.exited) return [];

  const validMoves = [];

  for (const [dirName, dir] of Object.entries(DIRECTIONS)) {
    const newX = bus.x + dir.dx;
    const newY = bus.y + dir.dy;

    // Must be a road
    if (!isRoad(state, newX, newY)) continue;

    // Must not be occupied by another bus
    if (getBusAt(state, newX, newY)) continue;

    validMoves.push({ x: newX, y: newY, direction: dirName });
  }

  return validMoves;
}

/**
 * Find path from bus to target using BFS
 */
export function findPath(state, bus, targetX, targetY) {
  if (!isRoad(state, targetX, targetY)) return null;
  if (getBusAt(state, targetX, targetY)) return null;

  const start = { x: bus.x, y: bus.y };
  const queue = [{ ...start, path: [] }];
  const visited = new Set([`${start.x},${start.y}`]);

  while (queue.length > 0) {
    const current = queue.shift();

    // Check if we reached the target
    if (current.x === targetX && current.y === targetY) {
      return current.path;
    }

    // Explore neighbors
    for (const [dirName, dir] of Object.entries(DIRECTIONS)) {
      const nextX = current.x + dir.dx;
      const nextY = current.y + dir.dy;
      const key = `${nextX},${nextY}`;

      if (visited.has(key)) continue;
      if (!isRoad(state, nextX, nextY)) continue;
      if (getBusAt(state, nextX, nextY)) continue;

      visited.add(key);
      queue.push({
        x: nextX,
        y: nextY,
        path: [...current.path, { x: nextX, y: nextY, direction: dirName }]
      });
    }
  }

  return null;
}

/**
 * Check if bus can board passengers at current position
 */
export function canBoard(state, bus) {
  if (!bus || bus.exited || bus.passengers >= bus.capacity) return null;

  // Check adjacent cells for matching stop
  for (const dir of Object.values(DIRECTIONS)) {
    const stopX = bus.x + dir.dx;
    const stopY = bus.y + dir.dy;
    const stop = getStopAt(state, stopX, stopY);

    if (stop && stop.color === bus.color && stop.waiting.length > 0) {
      return stop;
    }
  }

  return null;
}

/**
 * Board one passenger onto bus
 */
export function boardPassenger(state, bus) {
  const stop = canBoard(state, bus);
  if (!stop) return false;

  const passenger = stop.waiting.shift();
  bus.passengers++;

  return { stop, passenger };
}

/**
 * Check if bus can exit
 */
export function canExit(state, bus) {
  if (!bus || bus.exited) return false;
  if (bus.passengers < bus.capacity) return false;

  // Check if bus is at an exit
  return isExit(state, bus.x, bus.y);
}

/**
 * Execute bus exit
 */
export function executeExit(state, bus) {
  if (!canExit(state, bus)) return false;

  bus.exited = true;
  return true;
}

/**
 * Check win condition
 */
export function checkWin(state) {
  // All buses must have exited
  const allBusesExited = state.buses.every(b => b.exited);

  // All stops must be empty
  const allStopsEmpty = state.stops.every(s => s.waiting.length === 0);

  return allBusesExited && allStopsEmpty;
}

/**
 * Count remaining passengers
 */
export function countRemainingPassengers(state) {
  return state.stops.reduce((sum, stop) => sum + stop.waiting.length, 0);
}

/**
 * Get hint - find a valid move
 */
export function getHint(state) {
  // Priority 1: Find a bus that can board passengers
  for (const bus of state.buses) {
    if (bus.exited) continue;

    const stop = canBoard(state, bus);
    if (stop) {
      return {
        type: 'board',
        bus,
        stop,
        message: `${bus.color} bus can pick up passengers!`
      };
    }
  }

  // Priority 2: Find a full bus that can reach exit
  for (const bus of state.buses) {
    if (bus.exited || bus.passengers < bus.capacity) continue;

    for (const exit of state.exits) {
      const path = findPath(state, bus, exit.x, exit.y);
      if (path && path.length > 0) {
        return {
          type: 'exit',
          bus,
          path,
          exit,
          message: `${bus.color} bus is full! Guide it to the exit.`
        };
      }
    }
  }

  // Priority 3: Find a bus that can reach a matching stop
  for (const bus of state.buses) {
    if (bus.exited) continue;

    for (const stop of state.stops) {
      if (stop.color !== bus.color || stop.waiting.length === 0) continue;

      // Find adjacent cells to stop
      for (const dir of Object.values(DIRECTIONS)) {
        const targetX = stop.x + dir.dx;
        const targetY = stop.y + dir.dy;

        const path = findPath(state, bus, targetX, targetY);
        if (path && path.length > 0) {
          return {
            type: 'move',
            bus,
            path,
            stop,
            message: `Move ${bus.color} bus to pick up passengers.`
          };
        }
      }
    }
  }

  // Priority 4: Any valid move
  for (const bus of state.buses) {
    if (bus.exited) continue;

    const moves = getValidMoves(state, bus);
    if (moves.length > 0) {
      return {
        type: 'move',
        bus,
        path: [moves[0]],
        message: `Try moving the ${bus.color} bus.`
      };
    }
  }

  return null;
}

/**
 * Clone state for history
 */
export function cloneState(state) {
  return {
    grid: { ...state.grid },
    buses: state.buses.map(b => ({ ...b })),
    stops: state.stops.map(s => ({ ...s, waiting: [...s.waiting] })),
    exits: state.exits.map(e => ({ ...e })),
    roads: new Set(state.roads),
    moves: state.moves,
    selectedBus: state.selectedBus,
    animating: state.animating,
    won: state.won
  };
}

/**
 * Create history manager
 */
export function createHistory(maxDepth = 50) {
  return new History(maxDepth);
}

/**
 * Calculate stars based on moves
 */
export function calculateStars(moves, optimal) {
  const ratio = moves / optimal;
  if (ratio <= 1) return 3;
  if (ratio <= 1.5) return 2;
  return 1;
}

export default {
  BUS_COLORS,
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
  getHint,
  cloneState,
  createHistory,
  calculateStars
};
