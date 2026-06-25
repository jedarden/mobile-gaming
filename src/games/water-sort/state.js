/**
 * Water Sort - State Management
 *
 * Pure functions for game state including:
 * - Tube and segment management
 * - Pour validation and execution
 * - Win condition and deadlock detection
 * - State cloning for undo support
 */

import { createHistory } from '../../shared/history.js';

// Liquid colors for rendering
export const LIQUID_COLORS = {
  red: '#FF6B6B',
  blue: '#4DABF7',
  green: '#69DB7C',
  yellow: '#FFD93D',
  purple: '#B197FC',
  orange: '#FFA94D',
  cyan: '#66D9E8',
  pink: '#F783AC',
  teal: '#38D9A9',
  lime: '#A9E34B',
  indigo: '#748FFC',
  coral: '#FF8787'
};

/**
 * Create initial game state from level data
 *
 * @param {Object} level - Level definition
 * @param {string[][]} level.tubes - Array of tubes, each an array of color strings (bottom to top)
 * @param {number} level.maxSegments - Maximum segments per tube
 * @returns {Object} Game state
 */
export function createInitialState(level) {
  return {
    tubes: level.tubes.map((segments, i) => ({
      id: i,
      segments: [...segments]
    })),
    maxSegments: level.maxSegments,
    moves: 0,
    selectedTube: null,
    status: 'playing' // 'playing' | 'won' | 'stuck'
  };
}

/**
 * Get the top color of a tube
 *
 * @param {Object} tube - Tube object
 * @returns {string|null} Top color or null if empty
 */
export function topColor(tube) {
  if (tube.segments.length === 0) return null;
  return tube.segments[tube.segments.length - 1];
}

/**
 * Check if a pour is valid
 *
 * @param {Object} state - Game state
 * @param {number} fromIdx - Source tube index
 * @param {number} toIdx - Destination tube index
 * @returns {boolean} Whether the pour is valid
 */
export function canPour(state, fromIdx, toIdx) {
  if (fromIdx === toIdx) return false;
  if (fromIdx < 0 || fromIdx >= state.tubes.length) return false;
  if (toIdx < 0 || toIdx >= state.tubes.length) return false;

  const from = state.tubes[fromIdx];
  const to = state.tubes[toIdx];

  // Source must not be empty
  if (from.segments.length === 0) return false;

  // Destination must not be full
  if (to.segments.length >= state.maxSegments) return false;

  // Destination must be empty or top color must match source top color
  const fromTop = topColor(from);
  const toTop = topColor(to);

  if (toTop !== null && toTop !== fromTop) return false;

  // Don't allow pouring if source is already a complete tube (all same color, full)
  if (isTubeComplete(state, fromIdx)) return false;

  return true;
}

/**
 * Check if a tube is complete (full with single color)
 *
 * @param {Object} state - Game state
 * @param {number} idx - Tube index
 * @returns {boolean}
 */
export function isTubeComplete(state, idx) {
  const tube = state.tubes[idx];
  if (tube.segments.length !== state.maxSegments) return false;
  const color = tube.segments[0];
  return tube.segments.every(s => s === color);
}

/**
 * Count the top contiguous same-color group on a tube
 *
 * @param {Object} tube - Tube object
 * @returns {number} Count of contiguous top segments
 */
export function topGroupSize(tube) {
  if (tube.segments.length === 0) return 0;
  const color = tube.segments[tube.segments.length - 1];
  let count = 0;
  for (let i = tube.segments.length - 1; i >= 0; i--) {
    if (tube.segments[i] === color) count++;
    else break;
  }
  return count;
}

/**
 * Execute a pour from one tube to another
 * Returns a new state with the pour applied
 *
 * @param {Object} state - Game state
 * @param {number} fromIdx - Source tube index
 * @param {number} toIdx - Destination tube index
 * @returns {Object} New game state with pour applied
 */
export function pour(state, fromIdx, toIdx) {
  if (!canPour(state, fromIdx, toIdx)) return state;

  const from = state.tubes[fromIdx];
  const to = state.tubes[toIdx];

  // Calculate how many segments to transfer
  const groupSize = topGroupSize(from);
  const spaceAvailable = state.maxSegments - to.segments.length;
  const transferCount = Math.min(groupSize, spaceAvailable);

  // Create new state with cloned tubes
  const newTubes = state.tubes.map(t => ({
    id: t.id,
    segments: [...t.segments]
  }));

  const newFrom = newTubes[fromIdx];
  const newTo = newTubes[toIdx];

  // Transfer segments
  const transferred = newFrom.segments.splice(
    newFrom.segments.length - transferCount,
    transferCount
  );
  newTo.segments.push(...transferred);

  return {
    ...state,
    tubes: newTubes,
    moves: state.moves + 1,
    selectedTube: null,
    status: checkWin({ ...state, tubes: newTubes }) ? 'won' : 'playing'
  };
}

/**
 * Undo last move using history
 *
 * @param {Object} state - Current game state
 * @param {Object} history - History manager
 * @returns {Object|null} Previous state or null
 */
export function undo(state, history) {
  const prevState = history.undo();
  if (prevState) {
    return { ...prevState, selectedTube: null };
  }
  return null;
}

/**
 * Check win condition: all non-empty tubes contain a single color and are full
 *
 * @param {Object} state - Game state
 * @returns {boolean}
 */
export function checkWin(state) {
  for (const tube of state.tubes) {
    if (tube.segments.length === 0) continue;
    if (tube.segments.length !== state.maxSegments) return false;
    const color = tube.segments[0];
    if (!tube.segments.every(s => s === color)) return false;
  }
  return true;
}

/**
 * Get all valid moves for the current state
 *
 * @param {Object} state - Game state
 * @returns {Array<[number, number]>} Array of [fromIdx, toIdx] pairs
 */
export function getValidMoves(state) {
  const moves = [];
  for (let from = 0; from < state.tubes.length; from++) {
    for (let to = 0; to < state.tubes.length; to++) {
      if (canPour(state, from, to)) {
        moves.push([from, to]);
      }
    }
  }
  return moves;
}

/**
 * Check if the game is stuck (no valid moves, not won)
 *
 * @param {Object} state - Game state
 * @returns {boolean}
 */
export function isStuck(state) {
  return !checkWin(state) && getValidMoves(state).length === 0;
}

/**
 * Clone game state for history
 *
 * @param {Object} state - Game state
 * @returns {Object} Cloned state
 */
export function cloneState(state) {
  return {
    tubes: state.tubes.map(t => ({
      id: t.id,
      segments: [...t.segments]
    })),
    maxSegments: state.maxSegments,
    moves: state.moves,
    selectedTube: null,
    status: state.status
  };
}

/**
 * Create history manager for game
 *
 * @param {number} maxDepth - Maximum undo depth
 * @returns {Object} History manager
 */
export function createGameHistory(maxDepth = 100) {
  return createHistory(maxDepth);
}

/**
 * Calculate stars based on moves vs optimal
 *
 * @param {number} moves - Moves taken
 * @param {number} optimal - Optimal moves
 * @returns {number} Star count (1-3)
 */
export function calculateStars(moves, optimal) {
  const ratio = moves / optimal;
  if (ratio <= 1) return 3;
  if (ratio <= 1.5) return 2;
  return 1;
}

/**
 * Serialize tube state to string for visited set.
 * @param {Array} tubes - Array of tube objects
 * @returns {string} Serialized state
 */
function serializeTubes(tubes) {
  return tubes.map(t => t.segments.join(':')).join('|');
}

/**
 * BFS solver: find minimum moves to solve the level.
 * @param {Object} level - Level definition
 * @param {number} maxMoves - Maximum search depth (default 50)
 * @returns {{ cost: number, path: Array }|null} Solution or null if unsolvable
 */
export function solve(level, maxMoves = 50) {
  const initialState = createInitialState(level);
  const initKey = serializeTubes(initialState.tubes);

  if (checkWin(initialState)) {
    return { cost: 0, path: [] };
  }

  const visited = new Map([[initKey, null]]);
  const queue = [{ state: initialState, key: initKey }];
  const MAX_STATES = 1000000;

  while (queue.length > 0 && visited.size < MAX_STATES) {
    const { state, key: posKey } = queue.shift();

    if (state.moves >= maxMoves) continue;

    for (const [fromIdx, toIdx] of getValidMoves(state)) {
      const newState = pour(state, fromIdx, toIdx);
      const newKey = serializeTubes(newState.tubes);

      if (visited.has(newKey)) continue;

      visited.set(newKey, { parentKey: posKey, move: [fromIdx, toIdx] });

      if (checkWin(newState)) {
        const path = [];
        let cur = newKey;
        while (visited.get(cur) !== null) {
          const { parentKey, move: m } = visited.get(cur);
          path.unshift(m);
          cur = parentKey;
        }
        return { cost: path.length, path };
      }

      queue.push({ state: newState, key: newKey });
    }
  }

  return null;
}

export default {
  LIQUID_COLORS,
  createInitialState,
  topColor,
  canPour,
  isTubeComplete,
  topGroupSize,
  pour,
  undo,
  checkWin,
  getValidMoves,
  isStuck,
  cloneState,
  createGameHistory,
  calculateStars,
  solve
};
