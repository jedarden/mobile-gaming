/**
 * Merge Games - Level Generator
 *
 * Generates merge puzzle levels with guaranteed-reachable goals.
 *
 * Strategy:
 * 1. Construct a "merge tree" of depth = targetTier, ensuring adjacency at each level.
 * 2. Place seed items using a spiral/snake layout that guarantees the merge chain works.
 * 3. Optionally scatter distractor items of lower tiers.
 * 4. Verify reachability via DFS solver.
 *
 * Tier system: merge two adjacent items of tier N → one item of tier N+1.
 * Goal: produce `taskCount` items of `taskTier`.
 */

import { createRng } from '../../shared/rng.js';
import { isSolvable } from './state.js';

const GRID_W = 5;
const GRID_H = 5;

const DIFFICULTY_CONFIG = {
  easy: {
    targetTier: 3,
    targetCount: 1,
    distractors: [0, 2],   // [min, max] number of distractor items
    seedTier: 1            // tier1 seeds in 2×2 → tier3
  },
  medium: {
    targetTier: 4,
    targetCount: 1,
    distractors: [1, 3],
    seedTier: 2            // tier2 seeds in 2×2 → tier4
  },
  hard: {
    targetTier: 4,
    targetCount: 2,
    distractors: [2, 4],
    seedTier: 2            // two 2×2 blocks of tier2 → two tier4 items
  }
};

/**
 * Build a guaranteed-solvable seed arrangement for a single `targetTier` item.
 *
 * The construction uses a 2-column snake pattern that always produces adjacent
 * pairs for the merge chain to climb from tier 1 → targetTier.
 *
 * For targetTier T starting from seedTier S, we need 2^(T-S) seed items.
 * They are arranged in a snake (pairs per row) so that:
 *   - Each horizontal pair produces tier S+1
 *   - Adjacent rows of tier S+1 items produce tier S+2
 *   - ... continuing until tier T is reached
 *
 * @param {number} targetTier - Goal tier (2-5)
 * @param {number} seedTier   - Starting item tier (1-4)
 * @param {number} startRow   - Top row of the block in the grid
 * @param {number} startCol   - Left column of the block in the grid
 * @returns {{ cells: Array<{r,c,tier}>, rows: number, cols: number }}
 */
function buildSeedBlock(targetTier, seedTier, startRow, startCol) {
  const depth = targetTier - seedTier; // merges needed: 0 for trivial
  if (depth <= 0) {
    return { cells: [{ r: startRow, c: startCol, tier: seedTier }], rows: 1, cols: 1 };
  }

  // Number of seed items needed: 2^depth
  const count = 1 << depth; // 2^depth

  // Layout: arrange items in 2 columns, `count/2` rows each pair
  // For depth=1: 2 items in one row (cols 0,1)
  // For depth=2: 4 items in 2 rows × 2 cols
  // For depth=3: 8 items in 4 rows × 2 cols
  // etc.

  const cells = [];
  const numRows = count / 2;

  for (let row = 0; row < numRows; row++) {
    cells.push({ r: startRow + row, c: startCol,     tier: seedTier });
    cells.push({ r: startRow + row, c: startCol + 1, tier: seedTier });
  }

  return { cells, rows: numRows, cols: 2 };
}

/**
 * Verify the merge sequence works for the snake layout.
 * For a 2-column snake of 2^depth items, merges happen:
 *   1. Horizontal pairs in each row → tier S+1 at leftmost col
 *   2. Adjacent rows merge from bottom group up
 *
 * This is verifiable by the DFS solver (isSolvable), so we just construct
 * the grid and confirm.
 *
 * @param {number[][]} grid
 * @param {Object} task
 * @returns {boolean}
 */
function verifyGrid(grid, task) {
  const level = {
    grid,
    width: GRID_W,
    height: GRID_H,
    task
  };
  return isSolvable(level);
}

/**
 * Generate a single level deterministically from a seed.
 *
 * @param {number} seed - PRNG seed
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {number} index - Level index
 * @returns {Object|null} Level object or null if generation failed
 */
export function generateLevel(seed, difficulty = 'medium', index = 0) {
  const rng = createRng(seed);
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;

  // Build grid
  const grid = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(0));

  // Place seed blocks for taskCount target items
  const task = { targetTier: config.targetTier, targetCount: config.targetCount };
  const blockCols = 2;

  let placed = true;
  for (let t = 0; t < config.targetCount; t++) {
    // Place each block starting at a different column pair
    const startCol = t * blockCols;
    if (startCol + blockCols > GRID_W) {
      // Not enough columns - use higher seedTier to save space
      // Fall back: use tier-2 seeds instead of tier-1 for second block
      const seedTier2 = config.seedTier + 1;
      const block = buildSeedBlock(config.targetTier, seedTier2, 0, startCol > 0 ? startCol : 0);
      // Place in remaining columns
      for (const { r, c, tier } of block.cells) {
        if (r < GRID_H && c < GRID_W) grid[r][c] = tier;
      }
    } else {
      const block = buildSeedBlock(config.targetTier, config.seedTier, 0, startCol);
      for (const { r, c, tier } of block.cells) {
        if (r < GRID_H && c < GRID_W) grid[r][c] = tier;
      }
    }
  }

  if (!placed) return null;

  // Add distractor items in empty cells
  const distractorCount = rng.nextInt(config.distractors[0], config.distractors[1]);
  const emptyCells = [];
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      if (!grid[r][c]) emptyCells.push({ r, c });
    }
  }
  const shuffledEmpty = rng.shuffle(emptyCells);
  for (let i = 0; i < Math.min(distractorCount, shuffledEmpty.length); i++) {
    const { r, c } = shuffledEmpty[i];
    // Distractors are tier 1 items that don't contribute to the merge chain
    grid[r][c] = 1;
  }

  // Verify solvability
  if (!verifyGrid(grid, task)) {
    // Remove distractors that might have blocked the path and retry without them
    const cleanGrid = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(0));
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        // Only keep seed items (non-distractor)
        const isSeed = grid[r][c] >= config.seedTier &&
          (c < config.targetCount * blockCols);
        cleanGrid[r][c] = isSeed ? grid[r][c] : 0;
      }
    }
    if (!verifyGrid(cleanGrid, task)) return null;
    // Use the clean grid
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        grid[r][c] = cleanGrid[r][c];
      }
    }
  }

  return {
    id: `mg-gen-${difficulty}-${index}-${seed}`,
    width: GRID_W,
    height: GRID_H,
    grid,
    task,
    // Emit the numeric rating, not the tier name: the schema and the static
    // mg-*.json levels both use integers (same easy/medium/hard -> 1/2/3
    // mapping as pull-the-pin and scripts/gen-new-game-levels.js).
    difficulty: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3
  };
}

/**
 * Validate a generated level.
 *
 * @param {Object} level
 * @returns {{ valid: boolean, reason: string }}
 */
export function validateLevel(level) {
  if (!level.task || !level.task.targetTier) {
    return { valid: false, reason: 'Missing task definition' };
  }
  if (!level.grid || !level.grid.length) {
    return { valid: false, reason: 'Missing grid' };
  }

  const totalItems = level.grid.flat().filter(v => v > 0).length;
  if (totalItems === 0) {
    return { valid: false, reason: 'Grid is empty' };
  }

  const solvable = isSolvable(level);
  if (!solvable) {
    return { valid: false, reason: 'Goal is not reachable' };
  }

  return { valid: true, reason: 'OK' };
}

/**
 * Generate a batch of validated levels.
 *
 * @param {number} baseSeed
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {number} count
 * @returns {Object[]}
 */
export function generateBatch(baseSeed, difficulty, count) {
  const levels = [];
  let seed = baseSeed;
  let attempts = 0;
  const maxAttempts = count * 10;

  while (levels.length < count && attempts < maxAttempts) {
    const level = generateLevel(seed, difficulty, levels.length);
    if (level) {
      const { valid } = validateLevel(level);
      if (valid) levels.push(level);
    }
    seed += 1;
    attempts++;
  }

  return levels;
}

export default { generateLevel, validateLevel, generateBatch };
