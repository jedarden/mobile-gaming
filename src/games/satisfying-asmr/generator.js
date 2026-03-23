/**
 * Satisfying ASMR - Level Generator
 *
 * Generates procedural dirt patterns for the cleaning game.
 * All generated levels are trivially solvable by construction
 * (any level with dirt can be won by cleaning it all).
 *
 * Pattern types:
 *   full         - entire surface covered in dirt (classic)
 *   splatter     - random blob clusters of dirt (medium density)
 *   stripes      - alternating horizontal or diagonal bands
 *   checkerboard - alternating cells in a checker pattern
 */

import { createRng } from '../../shared/rng.js';

const GRID_W = 16;
const GRID_H = 16;

const DIFFICULTY_CONFIG = {
  easy:   { patternTypes: ['full', 'stripes'],             coverageFraction: [0.85, 1.0]  },
  medium: { patternTypes: ['splatter', 'checkerboard'],    coverageFraction: [0.50, 0.75] },
  hard:   { patternTypes: ['splatter', 'stripes'],         coverageFraction: [0.35, 0.55] }
};

/**
 * Generate a full-coverage pattern (all cells dirty).
 *
 * @returns {number[]} Flat cells array
 */
function patternFull() {
  return Array(GRID_W * GRID_H).fill(1);
}

/**
 * Generate a striped pattern.
 *
 * @param {Object} rng - Seeded RNG
 * @param {number} stripeWidth - Width of each stripe (cells)
 * @param {boolean} diagonal - Use diagonal stripes
 * @returns {number[]} Flat cells array
 */
function patternStripes(rng, stripeWidth = 2, diagonal = false) {
  const cells = [];
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      const idx = diagonal ? (r + c) : r;
      cells.push(Math.floor(idx / stripeWidth) % 2 === 0 ? 1 : 0);
    }
  }
  return cells;
}

/**
 * Generate a checkerboard pattern.
 *
 * @param {number} cellSize - Size of each checker square in cells
 * @returns {number[]} Flat cells array
 */
function patternCheckerboard(cellSize = 2) {
  const cells = [];
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      const br = Math.floor(r / cellSize);
      const bc = Math.floor(c / cellSize);
      cells.push((br + bc) % 2 === 0 ? 1 : 0);
    }
  }
  return cells;
}

/**
 * Generate a splatter pattern: Gaussian blobs of dirt.
 *
 * @param {Object} rng - Seeded RNG
 * @param {number} blobCount - Number of dirt blobs
 * @param {number} blobRadius - Average blob radius in cells
 * @param {number} coverageFraction - Target fraction of dirty cells
 * @returns {number[]} Flat cells array
 */
function patternSplatter(rng, blobCount, blobRadius, coverageFraction) {
  const cells = Array(GRID_W * GRID_H).fill(0);
  const targetDirty = Math.round(GRID_W * GRID_H * coverageFraction);

  for (let b = 0; b < blobCount; b++) {
    const cx = rng.nextInt(0, GRID_W - 1);
    const cy = rng.nextInt(0, GRID_H - 1);
    const r = blobRadius * (0.5 + rng.next());

    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
          cells[y * GRID_W + x] = 1;
        }
      }
    }
  }

  // If coverage is too low, add extra dirt
  const dirtyCount = cells.filter(v => v).length;
  if (dirtyCount < targetDirty) {
    const cleanIdxs = cells
      .map((v, i) => v === 0 ? i : -1)
      .filter(i => i >= 0);
    const shuffled = rng.shuffle(cleanIdxs);
    for (let i = 0; i < Math.min(targetDirty - dirtyCount, shuffled.length); i++) {
      cells[shuffled[i]] = 1;
    }
  }

  return cells;
}

/**
 * Generate a single level deterministically from a seed.
 *
 * @param {number} seed - PRNG seed
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {number} index - Level index
 * @returns {Object} Level object (always valid – patterns are trivially solvable)
 */
export function generateLevel(seed, difficulty = 'medium', index = 0) {
  const rng = createRng(seed);
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;

  const patternType = rng.pick(config.patternTypes);
  const coverageFraction = config.coverageFraction[0] +
    rng.next() * (config.coverageFraction[1] - config.coverageFraction[0]);

  let cells;

  switch (patternType) {
    case 'full':
      cells = patternFull();
      break;

    case 'stripes': {
      const stripeWidth = rng.nextInt(2, 4);
      const diagonal = rng.next() < 0.4;
      cells = patternStripes(rng, stripeWidth, diagonal);
      break;
    }

    case 'checkerboard': {
      const cellSize = rng.nextInt(2, 3);
      cells = patternCheckerboard(cellSize);
      break;
    }

    case 'splatter':
    default: {
      const blobCount = rng.nextInt(6, 14);
      const blobRadius = rng.nextInt(2, 4);
      cells = patternSplatter(rng, blobCount, blobRadius, coverageFraction);
      break;
    }
  }

  const totalDirt = cells.filter(v => v).length;

  // Ensure level has enough dirt to be interesting (at least 20% coverage)
  if (totalDirt < Math.floor(GRID_W * GRID_H * 0.2)) {
    // Fall back to stripes
    cells = patternStripes(rng, 2, false);
  }

  return {
    id: `asmr-gen-${difficulty}-${index}-${seed}`,
    width: GRID_W,
    height: GRID_H,
    cells,
    patternType,
    totalDirt: cells.filter(v => v).length,
    difficulty
  };
}

/**
 * Validate a generated level.
 * All ASMR levels are solvable by construction; just verify non-trivial dirt.
 *
 * @param {Object} level
 * @returns {{ valid: boolean, reason: string }}
 */
export function validateLevel(level) {
  const dirty = level.cells.filter(v => v === 1).length;
  const total = level.width * level.height;

  if (dirty === 0) {
    return { valid: false, reason: 'No dirt in level' };
  }
  if (dirty / total < 0.1) {
    return { valid: false, reason: `Coverage too low: ${(dirty / total * 100).toFixed(1)}%` };
  }

  return { valid: true, reason: `${(dirty / total * 100).toFixed(1)}% coverage (${dirty} cells)` };
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
  for (let i = 0; i < count; i++) {
    const level = generateLevel(baseSeed + i, difficulty, i);
    const { valid } = validateLevel(level);
    if (valid) levels.push(level);
  }
  return levels;
}

export default { generateLevel, validateLevel, generateBatch };
