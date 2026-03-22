/**
 * Parking Escape - Level Generator
 *
 * Generates Rush Hour-style sliding-vehicle puzzles.
 *
 * Algorithm:
 * 1. Place hero vehicle on exit row with clear path to exit
 * 2. Iteratively add blocker vehicles at random valid positions
 * 3. After all vehicles placed, run BFS solver to verify difficulty range
 * 4. Accept if min-move-count is in target range; otherwise retry
 *
 * Difficulty ranges (move counts):
 *   easy:   4 –  8 moves
 *   medium: 9 – 16 moves
 *   hard:  17 – 30 moves
 */

import { createRng } from '../../shared/rng.js';
import { solve } from './state.js';

const GRID_SIZE = 6;
const EXIT_Y = 2; // hero always exits right from row 2

const DIFFICULTY_CONFIG = {
  easy:   { minMoves: 4,  maxMoves: 8,  vehicleCount: [4, 6],  attempts: 80 },
  medium: { minMoves: 9,  maxMoves: 16, vehicleCount: [6, 9],  attempts: 150 },
  hard:   { minMoves: 17, maxMoves: 30, vehicleCount: [8, 12], attempts: 300 }
};

const VEHICLE_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'];

/**
 * Check whether a vehicle placement overlaps any existing vehicle.
 *
 * @param {Array} vehicles - Existing vehicle list
 * @param {number} x - Top-left x of new vehicle
 * @param {number} y - Top-left y of new vehicle
 * @param {number} w - Width of new vehicle
 * @param {number} h - Height of new vehicle
 * @returns {boolean}
 */
function overlaps(vehicles, x, y, w, h) {
  for (const v of vehicles) {
    const vw = v.width;
    const vh = v.height;
    if (x < v.x + vw && x + w > v.x && y < v.y + vh && y + h > v.y) {
      return true;
    }
  }
  return false;
}

/**
 * Try to place a random vehicle on the grid without overlap.
 *
 * @param {Array} vehicles - Existing vehicles
 * @param {Object} rng - Seeded RNG
 * @param {number} id - Vehicle index for naming
 * @returns {Object|null} New vehicle or null if placement failed
 */
function tryPlaceVehicle(vehicles, rng, id) {
  const isHoriz = rng.next() < 0.5;
  const isTruck = rng.next() < 0.25;
  const len = isTruck ? 3 : 2;
  const type = isTruck ? 'truck' : 'car';

  for (let attempt = 0; attempt < 20; attempt++) {
    let x, y, w, h;
    if (isHoriz) {
      w = len; h = 1;
      x = rng.nextInt(0, GRID_SIZE - w);
      y = rng.nextInt(0, GRID_SIZE - 1);
      // Don't place a horizontal blocker on the exit row occupying exit path
      // (allow it — the solver will decide if it creates a valid puzzle)
    } else {
      w = 1; h = len;
      x = rng.nextInt(0, GRID_SIZE - 1);
      y = rng.nextInt(0, GRID_SIZE - h);
    }

    if (!overlaps(vehicles, x, y, w, h)) {
      return {
        id: `v${id}`,
        type,
        x, y, w: undefined, h: undefined,
        width: w,
        height: h,
        orientation: isHoriz ? 'horizontal' : 'vertical',
        color: VEHICLE_COLORS[id % VEHICLE_COLORS.length]
      };
    }
  }
  return null;
}

/**
 * Generate a single level deterministically from a seed.
 *
 * @param {number} seed - PRNG seed
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {number} index - Level index (used in ID)
 * @returns {Object|null} Level object or null if generation failed
 */
export function generateLevel(seed, difficulty = 'medium', index = 0) {
  const rng = createRng(seed);
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const targetVehicles = rng.nextInt(config.vehicleCount[0], config.vehicleCount[1]);

  for (let attempt = 0; attempt < config.attempts; attempt++) {
    const attemptSeed = seed * 1000 + attempt;
    const r = createRng(attemptSeed);

    // Hero: horizontal 2-cell, at row EXIT_Y, starting at x=0
    const hero = {
      id: 'hero',
      type: 'hero',
      x: 0,
      y: EXIT_Y,
      width: 2,
      height: 1,
      orientation: 'horizontal',
      color: '#E74C3C'
    };

    const vehicles = [hero];

    // Add random blockers
    for (let v = 0; v < targetVehicles - 1; v++) {
      const placed = tryPlaceVehicle(vehicles, r, v);
      if (placed) vehicles.push(placed);
    }

    // Build level object
    const level = {
      version: 1,
      id: `pe-gen-${difficulty}-${index}-${seed}`,
      title: `Generated Level ${index + 1}`,
      difficulty: difficulty === 'easy' ? 3 : difficulty === 'medium' ? 6 : 9,
      grid: {
        width: GRID_SIZE,
        height: GRID_SIZE,
        vehicles,
        exit: { x: GRID_SIZE, y: EXIT_Y, direction: 'right' }
      },
      targetMoves: 0,
      maxMoves: 50
    };

    // Solver verify
    const solution = solve(level);
    if (!solution) continue;

    const cost = solution.cost;
    if (cost >= config.minMoves && cost <= config.maxMoves) {
      level.targetMoves = cost;
      level.difficulty = difficulty === 'easy' ? 2 + Math.round(cost / 4)
                       : difficulty === 'medium' ? 5 + Math.round(cost / 8)
                       : 8 + Math.round(cost / 15);
      return level;
    }
  }

  return null;
}

/**
 * Validate a generated level using BFS.
 *
 * @param {Object} level
 * @returns {{ valid: boolean, reason: string }}
 */
export function validateLevel(level) {
  if (!level.grid.vehicles.some(v => v.type === 'hero')) {
    return { valid: false, reason: 'No hero vehicle' };
  }

  const solution = solve(level);
  if (!solution) {
    return { valid: false, reason: 'Level is unsolvable' };
  }

  return { valid: true, reason: `Solvable in ${solution.cost} moves` };
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
  const maxAttempts = count * 20;

  while (levels.length < count && attempts < maxAttempts) {
    const level = generateLevel(seed, difficulty, levels.length);
    if (level) {
      levels.push(level);
    }
    seed += 1;
    attempts++;
  }

  return levels;
}

export default { generateLevel, validateLevel, generateBatch };
