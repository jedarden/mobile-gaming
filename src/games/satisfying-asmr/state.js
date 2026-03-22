/**
 * Satisfying ASMR - State Management
 *
 * Pure functions for game state. No DOM or rendering imports.
 *
 * Mechanic: the player swipes across a dirty surface to clean it.
 * Cells transition from dirty (1) to clean (0) as the player's path crosses them.
 * Win condition: >= WIN_THRESHOLD fraction of total dirt cleaned.
 *
 * State model:
 * {
 *   cells: number[],     // flat array width*height, 1 = dirty, 0 = clean
 *   width: number,
 *   height: number,
 *   totalDirt: number,
 *   cleanedCount: number,
 *   patternType: string, // 'full' | 'splatter' | 'stripes' | 'checkerboard'
 *   status: 'playing' | 'won'
 * }
 */

/** Fraction of dirt that must be cleaned to win */
export const WIN_THRESHOLD = 0.95;

/**
 * Create initial game state from level data.
 *
 * @param {Object} level
 * @returns {Object} Game state
 */
export function createInitialState(level) {
  const cells = [...level.cells];
  const totalDirt = cells.filter(v => v === 1).length;
  return {
    cells,
    width: level.width,
    height: level.height,
    totalDirt,
    cleanedCount: 0,
    patternType: level.patternType || 'full',
    status: 'playing'
  };
}

/**
 * Clean a single cell by coordinates.
 *
 * @param {Object} state
 * @param {number} x - Column (0-indexed)
 * @param {number} y - Row (0-indexed)
 * @returns {Object} New state
 */
export function clean(state, x, y) {
  if (state.status !== 'playing') return state;
  if (x < 0 || x >= state.width || y < 0 || y >= state.height) return state;

  const idx = y * state.width + x;
  if (!state.cells[idx]) return state; // already clean

  const cells = [...state.cells];
  cells[idx] = 0;
  const cleanedCount = state.cleanedCount + 1;
  const won = cleanedCount / state.totalDirt >= WIN_THRESHOLD;

  return {
    ...state,
    cells,
    cleanedCount,
    status: won ? 'won' : 'playing'
  };
}

/**
 * Clean a circular area centered at (cx, cy) with given radius (in cells).
 *
 * @param {Object} state
 * @param {number} cx - Center column
 * @param {number} cy - Center row
 * @param {number} radius - Radius in cells
 * @returns {Object} New state
 */
export function cleanArea(state, cx, cy, radius) {
  if (state.status !== 'playing') return state;

  const cells = [...state.cells];
  let delta = 0;

  const r = Math.ceil(radius);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || x >= state.width || y < 0 || y >= state.height) continue;
      const idx = y * state.width + x;
      if (cells[idx] === 1) {
        cells[idx] = 0;
        delta++;
      }
    }
  }

  if (delta === 0) return state;

  const cleanedCount = state.cleanedCount + delta;
  const won = cleanedCount / state.totalDirt >= WIN_THRESHOLD;

  return {
    ...state,
    cells,
    cleanedCount,
    status: won ? 'won' : 'playing'
  };
}

/**
 * Get cleaning progress as 0–1.
 *
 * @param {Object} state
 * @returns {number}
 */
export function getProgress(state) {
  if (state.totalDirt === 0) return 1;
  return state.cleanedCount / state.totalDirt;
}

/**
 * Check if the level is complete.
 *
 * @param {Object} state
 * @returns {boolean}
 */
export function isComplete(state) {
  return state.status === 'won';
}

export default {
  WIN_THRESHOLD,
  createInitialState,
  clean,
  cleanArea,
  getProgress,
  isComplete
};
