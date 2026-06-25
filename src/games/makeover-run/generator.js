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
import { CATEGORIES, simulatePath, optimalPath, worstPath } from './state.js';

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

/**
 * Calculate playability metrics for a level.
 * Higher scores indicate better, more engaging levels.
 *
 * Metrics:
 * - Category balance: all 4 categories get upgrades
 * - Upgrade variety: mix of upgrade:2 and upgrade:3
 * - Station spacing: even distribution
 * - Strategic depth: clear positive vs negative choices
 *
 * @param {Object} level - Level object
 * @returns {Object} Metrics object with overall score
 */
export function calculatePlayabilityMetrics(level) {
  const stations = level.stations || [];
  const positives = stations.filter(s => s.positive);
  const negatives = stations.filter(s => !s.positive);

  // Metric 1: Category balance (0-30 points)
  const upgradedCategories = new Set();
  for (const station of positives) {
    upgradedCategories.add(station.type);
  }
  const balanceScore = upgradedCategories.size >= 4 ? 30 :
                      upgradedCategories.size >= 3 ? 20 : 10;

  // Metric 2: Upgrade variety (0-25 points)
  const upgrade2Count = positives.filter(s => s.upgrade === 2).length;
  const upgrade3Count = positives.filter(s => s.upgrade === 3).length;
  const hasMix = upgrade2Count > 0 && upgrade3Count > 0;
  const varietyScore = hasMix ? 25 : 15;

  // Metric 3: Station spacing (0-25 points)
  const zPositions = positives.map(s => s.z).sort((a, b) => a - b);
  const spacings = [];
  for (let i = 1; i < zPositions.length; i++) {
    spacings.push(zPositions[i] - zPositions[i - 1]);
  }
  const avgSpacing = spacings.length > 0 ?
    spacings.reduce((a, b) => a + b, 0) / spacings.length : 0;
  const spacingVariance = spacings.length > 1 ?
    Math.max(...spacings) - Math.min(...spacings) : 0;
  // Prefer consistent spacing
  const spacingScore = spacingVariance < avgSpacing * 0.3 ? 25 :
                      spacingVariance < avgSpacing * 0.5 ? 20 : 15;

  // Metric 4: Strategic depth (0-20 points)
  const positiveCount = positives.length;
  const totalPairs = Math.min(positives.length, negatives.length);
  // More pairs = more strategic decisions
  const strategicScore = totalPairs >= 8 ? 20 :
                       totalPairs >= 6 ? 15 : 10;

  const totalScore = balanceScore + varietyScore + spacingScore + strategicScore;

  return {
    overall: totalScore,
    categoryBalance: balanceScore,
    upgradeVariety: varietyScore,
    stationSpacing: spacingScore,
    strategicDepth: strategicScore,
    details: {
      categoriesCovered: upgradedCategories.size,
      upgrade2Count: upgrade2Count,
      upgrade3Count: upgrade3Count,
      stationPairs: totalPairs,
      avgSpacing: Math.round(avgSpacing),
      spacingVariance: Math.round(spacingVariance)
    }
  };
}

/**
 * Rank a list of levels by playability.
 * Returns levels sorted by score (highest first).
 *
 * @param {Object[]} levels - Array of level objects
 * @returns {Object[]} Sorted levels with metrics attached
 */
export function rankLevels(levels) {
  const levelsWithMetrics = levels.map(level => ({
    ...level,
    metrics: calculatePlayabilityMetrics(level)
  }));

  return levelsWithMetrics.sort((a, b) =>
    b.metrics.overall - a.metrics.overall
  );
}

/**
 * Curate the best N levels from a ranked list.
 *
 * @param {Object[]} rankedLevels - Sorted levels (from rankLevels)
 * @param {number} count - Number of levels to select
 * @returns {Object[]} Curated levels
 */
export function curateBestLevels(rankedLevels, count) {
  return rankedLevels.slice(0, Math.min(count, rankedLevels.length));
}

export default { generateLevel, validateLevel, generateBatch, calculatePlayabilityMetrics, rankLevels, curateBestLevels };
