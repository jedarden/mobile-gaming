/**
 * Makeover Run - Level Generator
 *
 * Generates procedural levels and validates them.
 * All levels are deterministic given the same seed.
 *
 * Each gate group (same z) has:
 *   - One positive station at x=-1 or x=1: upgrades a category tier
 *   - One negative station at the opposite x: downgrades a category
 *
 * Guarantees:
 *   - Optimal path (all positives) → 3 stars  (score ≥ 9 / maxScore 12)
 *   - Worst  path (all negatives)  → ≤ 1 star (score = 0 since start is 0)
 */

import { createRng } from '../../shared/rng.js';
import { CATEGORIES, simulatePath, optimalPath, worstPath, calculateStars } from './state.js';

// Difficulty parameters: numPairs is the number of station pairs (one +, one -)
const DIFFICULTY_CONFIG = {
  easy:   { courseLength: 260, speed: 2.0, numPairs: 6  },
  medium: { courseLength: 360, speed: 2.3, numPairs: 8  },
  hard:   { courseLength: 460, speed: 2.6, numPairs: 10 }
};

/**
 * Generate a single level deterministically from a seed.
 *
 * Strategy: place one upgrade:2 station per category (4 base pairs), then fill
 * remaining pairs with upgrade:3 stations. This guarantees optimal score ≥ 9.
 *
 * @param {number} seed
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {number} index - Level index (used in ID)
 * @returns {Object} Level object
 */
export function generateLevel(seed, difficulty = 'easy', index = 0) {
  const rng = createRng(seed);
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.easy;
  const { courseLength, speed, numPairs } = config;

  // Build positive station plan:
  //   Base (4 pairs): one upgrade:2 per category — ensures each cat reaches 2
  //   Extra (numPairs-4 pairs): upgrade:3 for random categories — bumps at least one to 3
  // Optimal score: ≥ 3 + 2 + 2 + 2 = 9 (one cat gets 3, rest 2)
  const shuffledCats = rng.shuffle([...CATEGORIES]);
  const positives = [];

  for (let i = 0; i < 4; i++) {
    positives.push({ type: shuffledCats[i], upgrade: 2 });
  }
  for (let i = 4; i < numPairs; i++) {
    positives.push({ type: rng.pick(CATEGORIES), upgrade: 3 });
  }

  // Shuffle assignment order
  const shuffledPos = rng.shuffle(positives);

  // Place station pairs at evenly-spaced z positions
  const spacing = (courseLength - 60) / numPairs;
  const stations = [];

  for (let i = 0; i < numPairs; i++) {
    const z    = Math.round(40 + spacing * i);
    const posX = rng.next() < 0.5 ? -1 : 1;
    const negX = -posX;
    const pos  = shuffledPos[i];
    const downgradeCat = rng.pick(CATEGORIES);

    stations.push({ z, x: posX, type: pos.type, upgrade: pos.upgrade, positive: true });
    stations.push({ z, x: negX, type: 'mud', downgrade: downgradeCat, amount: 1, positive: false });
  }

  return {
    id: `gen-${difficulty}-${index}-${seed}`,
    courseLength,
    speed,
    stations,
    difficulty
  };
}

/**
 * Validate a level:
 *   - Optimal path achieves 3 stars (score ≥ 9 out of 12)
 *   - Worst  path achieves ≤ 1 star (score < 4 out of 12)
 *
 * @param {Object} level
 * @returns {{ valid: boolean, reason: string }}
 */
export function validateLevel(level) {
  const opt   = simulatePath(level, optimalPath(level));
  const worst = simulatePath(level, worstPath(level));

  if (opt.stars < 3) {
    return { valid: false, reason: `Optimal score ${opt.score} → ${opt.stars} stars (need 3)` };
  }
  if (worst.stars > 1) {
    return { valid: false, reason: `Worst score ${worst.score} → ${worst.stars} stars (need ≤ 1)` };
  }
  return { valid: true, reason: 'OK' };
}

/**
 * Generate a batch of validated levels.
 * Skips seeds that fail validation (rare — the algorithm is designed to pass).
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
    const level      = generateLevel(seed, difficulty, levels.length);
    const validation = validateLevel(level);
    if (validation.valid) levels.push(level);
    seed += 1;
    attempts++;
  }

  return levels;
}

export default { generateLevel, validateLevel, generateBatch };
