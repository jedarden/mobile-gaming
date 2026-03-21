/**
 * Water Sort - BFS Solver
 *
 * Solves Water Sort puzzles using BFS over game states.
 * Uses canonical state keys for deduplication.
 * Memory bound: caps visited set at 500K states.
 */

import {
  createInitialState,
  canPour,
  pour,
  checkWin,
  getValidMoves,
  cloneState
} from '../../src/games/water-sort/state.js';

const MAX_VISITED = 500000;

/**
 * Create a canonical state key for deduplication
 * Sorts tubes by their contents (ignoring empty tubes at the end)
 *
 * @param {Object} state - Game state
 * @returns {string} Canonical state key
 */
function stateKey(state) {
  const nonEmpty = state.tubes
    .filter(t => t.segments.length > 0)
    .map(t => t.segments.join(','))
    .sort();

  const emptyCount = state.tubes.filter(t => t.segments.length === 0).length;

  return nonEmpty.join('|') + `|empty:${emptyCount}`;
}

/**
 * Solve a Water Sort puzzle using BFS
 *
 * @param {Object} level - Level definition
 * @returns {Array<[number, number]>|null} Move sequence or null if unsolvable
 */
export function solve(level) {
  const initialState = createInitialState(level);

  if (checkWin(initialState)) return [];

  const visited = new Set();
  visited.add(stateKey(initialState));

  // Queue entries: { state, moves }
  const queue = [{ state: initialState, moves: [] }];
  let head = 0;

  while (head < queue.length) {
    const { state, moves } = queue[head++];

    // Memory bound check
    if (visited.size > MAX_VISITED) {
      console.warn('Solver: visited set exceeded 500K, switching to iterative deepening');
      return solveIDS(level, 30);
    }

    const validMoves = getValidMoves(state);

    for (const [fromIdx, toIdx] of validMoves) {
      const newState = pour(state, fromIdx, toIdx);

      if (checkWin(newState)) {
        return [...moves, [fromIdx, toIdx]];
      }

      const key = stateKey(newState);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({
          state: newState,
          moves: [...moves, [fromIdx, toIdx]]
        });
      }
    }
  }

  return null; // No solution found
}

/**
 * Iterative Deepening DFS solver (fallback when BFS exceeds memory)
 *
 * @param {Object} level - Level definition
 * @param {number} maxDepth - Maximum search depth
 * @returns {Array<[number, number]>|null} Move sequence or null
 */
function solveIDS(level, maxDepth) {
  for (let depth = 1; depth <= maxDepth; depth++) {
    const result = solveDFS(level, depth);
    if (result !== null) return result;
  }
  return null;
}

/**
 * Depth-limited DFS solver
 *
 * @param {Object} level - Level definition
 * @param {number} maxDepth - Maximum depth
 * @returns {Array<[number, number]>|null} Move sequence or null
 */
function solveDFS(level, maxDepth) {
  const initialState = createInitialState(level);
  const visited = new Set();

  function dfs(state, depth, moves, path) {
    if (checkWin(state)) return moves;

    if (depth <= 0) return null;

    const key = stateKey(state);
    if (visited.has(key)) return null;
    visited.add(key);

    if (visited.size > MAX_VISITED) return null;

    const validMoves = getValidMoves(state);

    for (const [fromIdx, toIdx] of validMoves) {
      const newState = pour(state, fromIdx, toIdx);
      const result = dfs(newState, depth - 1, [...moves, [fromIdx, toIdx]], [...path, `${fromIdx}->${toIdx}`]);
      if (result !== null) return result;
    }

    visited.delete(key);
    return null;
  }

  return dfs(initialState, maxDepth, [], []);
}

/**
 * Validate that a solution is correct
 *
 * @param {Object} level - Level definition
 * @param {Array<[number, number]>} solution - Move sequence
 * @returns {{ valid: boolean, message: string }}
 */
export function validateSolution(level, solution) {
  let state = createInitialState(level);

  for (let i = 0; i < solution.length; i++) {
    const [from, to] = solution[i];

    if (!canPour(state, from, to)) {
      return { valid: false, message: `Move ${i + 1}: cannot pour from ${from} to ${to}` };
    }

    state = pour(state, from, to);
  }

  if (!checkWin(state)) {
    return { valid: false, message: 'Solution does not reach win state' };
  }

  return { valid: true, message: `Valid solution in ${solution.length} moves` };
}

export default { solve, validateSolution };
