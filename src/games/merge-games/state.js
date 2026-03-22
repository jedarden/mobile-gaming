/**
 * Merge Games - State Management
 *
 * Pure functions for game state. No DOM or rendering imports.
 *
 * Mechanic: drag one item onto an adjacent same-tier item to merge them into
 * a single item of tier+1. Goal: produce `taskCount` items of `taskTier`.
 *
 * State model:
 * {
 *   grid: number[][],     // 2D array, 0 = empty, 1-6 = item tier
 *   width: number,
 *   height: number,
 *   task: { targetTier: number, targetCount: number },
 *   moves: number,
 *   status: 'playing' | 'won'
 * }
 */

/**
 * Create initial game state from level data.
 *
 * @param {Object} level
 * @returns {Object} Game state
 */
export function createInitialState(level) {
  return {
    grid: level.grid.map(row => [...row]),
    width: level.width,
    height: level.height,
    task: { ...level.task },
    moves: 0,
    status: 'playing'
  };
}

/**
 * Find all adjacent same-tier pairs that can be merged.
 *
 * @param {Object} state
 * @returns {Array} [{r1,c1,r2,c2}] pairs
 */
export function getMerges(state) {
  const { grid, width, height } = state;
  const pairs = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!grid[r][c]) continue;
      // Right neighbor
      if (c + 1 < width && grid[r][c + 1] === grid[r][c]) {
        pairs.push({ r1: r, c1: c, r2: r, c2: c + 1 });
      }
      // Down neighbor
      if (r + 1 < height && grid[r + 1][c] === grid[r][c]) {
        pairs.push({ r1: r, c1: c, r2: r + 1, c2: c });
      }
    }
  }
  return pairs;
}

/**
 * Apply a merge: combine cell (r1,c1) and adjacent (r2,c2) into tier+1 at (r1,c1).
 * (r2,c2) becomes empty. The two cells must be adjacent and same tier.
 *
 * @param {Object} state
 * @param {number} r1
 * @param {number} c1
 * @param {number} r2
 * @param {number} c2
 * @returns {Object} New state
 */
export function applyMerge(state, r1, c1, r2, c2) {
  if (state.status !== 'playing') return state;
  const { grid } = state;
  if (!grid[r1][c1] || grid[r1][c1] !== grid[r2][c2]) return state;
  // Check adjacency
  const dr = Math.abs(r1 - r2);
  const dc = Math.abs(c1 - c2);
  if (dr + dc !== 1) return state;

  const newGrid = grid.map(row => [...row]);
  newGrid[r1][c1] = grid[r1][c1] + 1;
  newGrid[r2][c2] = 0;

  const next = { ...state, grid: newGrid, moves: state.moves + 1 };
  return isComplete(next) ? { ...next, status: 'won' } : next;
}

/**
 * Count items of a given tier in the grid.
 *
 * @param {Object} state
 * @param {number} tier
 * @returns {number}
 */
export function countTier(state, tier) {
  return state.grid.flat().filter(v => v === tier).length;
}

/**
 * Check whether the task is complete.
 *
 * @param {Object} state
 * @returns {boolean}
 */
export function isComplete(state) {
  return countTier(state, state.task.targetTier) >= state.task.targetCount;
}

/**
 * Encode grid as a compact string for memoization.
 *
 * @param {number[][]} grid
 * @returns {string}
 */
export function encodeGrid(grid) {
  return grid.map(row => row.join('')).join('|');
}

/**
 * DFS solver: verify the task can be completed from the current state.
 * Returns true if the goal is reachable, false otherwise.
 * Limited to maxStates explored states to stay within time budget.
 *
 * @param {Object} level - Level definition
 * @param {number} maxStates - State limit (default 30000)
 * @returns {boolean}
 */
export function isSolvable(level, maxStates = 30000) {
  const initial = createInitialState(level);
  if (isComplete(initial)) return true;

  const visited = new Set();
  const stack = [initial.grid];
  visited.add(encodeGrid(initial.grid));

  while (stack.length > 0 && visited.size < maxStates) {
    const grid = stack.pop();
    const tempState = { ...initial, grid };

    for (const { r1, c1, r2, c2 } of getMerges(tempState)) {
      const next = applyMerge(tempState, r1, c1, r2, c2);
      if (next.status === 'won') return true;

      const key = encodeGrid(next.grid);
      if (!visited.has(key)) {
        visited.add(key);
        stack.push(next.grid);
      }
    }
  }

  return false;
}

export default {
  createInitialState,
  getMerges,
  applyMerge,
  countTier,
  isComplete,
  encodeGrid,
  isSolvable
};
