/**
 * Giant Runner - Level Generator
 *
 * Generates levels with:
 * - Matching-color collectibles placed along the course
 * - Wrong-color collectibles and obstacles interspersed
 * - Validates that best-case > boss + 30%
 * - Validates that average-case (70% collection) > boss
 */

import { createRng } from '../../shared/rng.js';
import { MIN_SCALE, DEFAULT_START_SCALE } from './state.js';

// Lane positions for collectibles/obstacles
const LANES = [-2, -1, 0, 1, 2];

// Collectible value ranges
const MATCHING_VALUE_MIN = 0.08;
const MATCHING_VALUE_MAX = 0.15;
const WRONG_COLOR_VALUE = 0.05;

// Obstacle penalty
const OBSTACLE_PENALTY = 0.2;

// Difficulty tiers
const DIFFICULTY_CONFIG = {
  easy:   { courseLength: [200, 300], bossScale: [1.5, 3.0],  diffFactor: [0.1, 0.25], speed: [2.5, 3.0] },
  medium: { courseLength: [300, 450], bossScale: [3.0, 5.0],  diffFactor: [0.25, 0.4], speed: [3.0, 3.5] },
  hard:   { courseLength: [450, 600], bossScale: [5.0, 8.0],  diffFactor: [0.4, 0.6],  speed: [3.5, 4.0] }
};

const PLAYER_COLORS = ['blue', 'red', 'green', 'yellow', 'purple', 'orange'];

/**
 * Calculate the maximum possible scale from a level
 * (collecting all matching orbs, avoiding all wrong-color and obstacles)
 */
export function calculateOptimalScale(level, startScale = DEFAULT_START_SCALE) {
  let scale = startScale;

  for (const collectible of level.collectibles) {
    if (collectible.color === level.playerColor) {
      scale += collectible.value;
    }
  }

  return scale;
}

/**
 * Calculate average scale with 70% collection rate
 * Monte Carlo simulation (intentionally uses Math.random — statistical estimate)
 */
export function calculateAverageScale(level, startScale = DEFAULT_START_SCALE, runs = 100) {
  let totalScale = 0;
  // Use a deterministic LCG for repeatable averages (not crypto-quality, but consistent)
  let lcg = 42;
  const nextRandom = () => {
    lcg = (lcg * 1664525 + 1013904223) & 0xffffffff;
    return (lcg >>> 0) / 0x100000000;
  };

  for (let run = 0; run < runs; run++) {
    let scale = startScale;

    for (const collectible of level.collectibles) {
      if (collectible.color === level.playerColor) {
        if (nextRandom() < 0.7) {
          scale += collectible.value;
        }
      } else {
        if (nextRandom() < 0.3) {
          scale = Math.max(MIN_SCALE, scale - collectible.value);
        }
      }
    }

    for (const _obstacle of (level.obstacles || [])) {
      if (nextRandom() < 0.2) {
        scale = Math.max(MIN_SCALE, scale - OBSTACLE_PENALTY);
      }
    }

    totalScale += scale;
  }

  return totalScale / runs;
}

/**
 * Validate a level
 * - Optimal path must beat boss by >= 30%
 * - Average case (70% collection) must beat boss
 */
export function validateLevel(level) {
  const errors = [];

  const optimalScale = calculateOptimalScale(level);
  const averageScale = calculateAverageScale(level);
  const bossScale = level.boss.scale;

  const optimalThreshold = bossScale * 1.3;
  if (optimalScale < optimalThreshold) {
    errors.push(`Optimal scale ${optimalScale.toFixed(2)} does not exceed boss ${bossScale} by 30% (need ${optimalThreshold.toFixed(2)})`);
  }

  if (averageScale <= bossScale) {
    errors.push(`Average scale ${averageScale.toFixed(2)} does not beat boss ${bossScale}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    optimalScale,
    averageScale,
    bossScale
  };
}

/**
 * Generate a level deterministically from a seed.
 *
 * @param {number} seed - PRNG seed
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {number} index - Level index
 * @returns {Object} Level object
 */
export function generateLevel(seed, difficulty = 'medium', index = 0) {
  const rng = createRng(seed);
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;

  const courseLength = rng.nextInt(config.courseLength[0], config.courseLength[1]);
  const bossScale = config.bossScale[0] + rng.next() * (config.bossScale[1] - config.bossScale[0]);
  const diffFactor = config.diffFactor[0] + rng.next() * (config.diffFactor[1] - config.diffFactor[0]);
  const speed = config.speed[0] + rng.next() * (config.speed[1] - config.speed[0]);
  const playerColor = rng.pick(PLAYER_COLORS);

  const startScale = DEFAULT_START_SCALE;
  const collectibles = [];
  const obstacles = [];

  // Calculate how many matching orbs we need to beat the boss
  // Use a higher multiplier for hard difficulty to account for 70% collection simulation
  const difficultyMultiplier = difficulty === 'hard' ? 1.55 : 1.35;
  const targetScale = bossScale * difficultyMultiplier;
  const scaleNeeded = targetScale - startScale;

  const avgValue = (MATCHING_VALUE_MIN + MATCHING_VALUE_MAX) / 2;
  const matchingOrbCount = Math.ceil(scaleNeeded / avgValue);

  // Space orbs along the course
  const spacing = courseLength / (matchingOrbCount + 2);

  // Generate matching color collectibles
  for (let i = 0; i < matchingOrbCount; i++) {
    const z = spacing * (i + 1);
    const x = rng.pick(LANES);
    const value = MATCHING_VALUE_MIN + rng.next() * (MATCHING_VALUE_MAX - MATCHING_VALUE_MIN);

    collectibles.push({
      x,
      z: Math.round(z),
      color: playerColor,
      value: Math.round(value * 100) / 100
    });
  }

  // Add wrong-color collectibles (20-30% of matching count)
  const wrongColors = PLAYER_COLORS.filter(c => c !== playerColor);
  const wrongColorCount = Math.floor(matchingOrbCount * (0.2 + diffFactor * 0.1));

  for (let i = 0; i < wrongColorCount; i++) {
    const matchingIdx = rng.nextInt(0, collectibles.length - 1);
    const baseCollectible = collectibles[matchingIdx];

    const availableLanes = LANES.filter(l => l !== baseCollectible.x);
    collectibles.push({
      x: rng.pick(availableLanes),
      z: baseCollectible.z + Math.round((rng.next() - 0.5) * 10),
      color: rng.pick(wrongColors),
      value: WRONG_COLOR_VALUE
    });
  }

  // Add obstacles (10-20% of matching count)
  const obstacleCount = Math.floor(matchingOrbCount * (0.1 + diffFactor * 0.1));

  for (let i = 0; i < obstacleCount; i++) {
    const z = spacing * (0.5 + i * (matchingOrbCount / Math.max(1, obstacleCount)));
    const x = rng.pick(LANES);

    obstacles.push({
      x,
      z: Math.round(z),
      width: 1.5
    });
  }

  // Sort by z position
  collectibles.sort((a, b) => a.z - b.z);
  obstacles.sort((a, b) => a.z - b.z);

  return {
    id: `gr-gen-${difficulty}-${index}-${seed}`,
    courseLength,
    startScale,
    playerColor,
    speed: Math.round(speed * 10) / 10,
    collectibles,
    obstacles,
    boss: {
      z: courseLength,
      scale: Math.round(bossScale * 10) / 10
    },
    difficulty
  };
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
    const validation = validateLevel(level);
    if (validation.valid) {
      levels.push(level);
    }
    seed += 1;
    attempts++;
  }

  return levels;
}

/**
 * Generate a set of levels with increasing difficulty (legacy interface).
 */
export function generateLevels(count = 20) {
  const levels = [];
  const tiers = [
    { difficulty: 'easy',   levelCount: Math.ceil(count / 4) },
    { difficulty: 'medium', levelCount: Math.ceil(count / 4) },
    { difficulty: 'medium', levelCount: Math.ceil(count / 4) },
    { difficulty: 'hard',   levelCount: Math.floor(count / 4) }
  ];

  let seed = 1;
  for (const tier of tiers) {
    for (let i = 0; i < tier.levelCount && levels.length < count; i++) {
      levels.push(generateLevel(seed, tier.difficulty, levels.length));
      seed++;
    }
  }

  return levels;
}

/**
 * Calculate playability metrics for a level.
 * Higher scores indicate better, more engaging levels.
 *
 * Metrics:
 * - Collectible spacing: even distribution vs clumped
 * - Wrong-color challenge: not too many, not too few
 * - Obstacle density: balanced difficulty
 * - Scale growth curve: smooth progression
 *
 * @param {Object} level - Level object
 * @returns {Object} Metrics object with overall score
 */
export function calculatePlayabilityMetrics(level) {
  const collectibles = level.collectibles || [];
  const obstacles = level.obstacles || [];
  const playerColor = level.playerColor || 'blue';
  const courseLength = level.courseLength || 300;

  // Metric 1: Collectible spacing (0-30 points)
  const matching = collectibles.filter(c => c.color === playerColor);
  const spacings = [];
  for (let i = 1; i < matching.length; i++) {
    spacings.push(matching[i].z - matching[i - 1].z);
  }
  const avgSpacing = spacings.length > 0 ?
    spacings.reduce((a, b) => a + b, 0) / spacings.length : 0;
  const spacingVariance = spacings.length > 1 ?
    Math.max(...spacings) - Math.min(...spacings) : 0;
  // Prefer moderate variance - not too uniform, not too clumped
  const spacingScore = spacingVariance > 0 && spacingVariance < avgSpacing * 0.5 ? 30 :
                       spacingVariance > 0 ? 20 : 10;

  // Metric 2: Wrong-color ratio (0-25 points)
  const wrongColor = collectibles.filter(c => c.color !== playerColor);
  const wrongColorRatio = matching.length > 0 ? wrongColor.length / matching.length : 0;
  // Ideal ratio: 20-35%
  const wrongColorScore = wrongColorRatio >= 0.2 && wrongColorRatio <= 0.35 ? 25 :
                          wrongColorRatio >= 0.15 && wrongColorRatio < 0.2 ? 15 :
                          wrongColorRatio > 0.35 && wrongColorRatio <= 0.5 ? 15 : 5;

  // Metric 3: Obstacle density (0-25 points)
  const obstacleDensity = obstacles.length / Math.max(1, matching.length);
  // Ideal: 10-20% of matching collectible count
  const obstacleScore = obstacleDensity >= 0.1 && obstacleDensity <= 0.2 ? 25 :
                       obstacleDensity >= 0.05 && obstacleDensity < 0.1 ? 15 :
                       obstacleDensity > 0.2 && obstacleDensity <= 0.3 ? 15 : 5;

  // Metric 4: Scale growth curve (0-20 points)
  const optimalScale = calculateOptimalScale(level);
  const averageScale = calculateAverageScale(level);
  const bossScale = level.boss.scale || 5;
  // Check if there's room for growth
  const growthRoom = optimalScale - bossScale;
  const growthScore = growthRoom > 0.5 && growthRoom < 2.0 ? 20 :
                      growthRoom >= 0.2 && growthRoom <= 0.5 ? 10 : 5;

  const totalScore = spacingScore + wrongColorScore + obstacleScore + growthScore;

  return {
    overall: totalScore,
    collectibleSpacing: spacingScore,
    wrongColorBalance: wrongColorScore,
    obstacleDensity: obstacleScore,
    growthCurve: growthScore,
    details: {
      matchingCount: matching.length,
      wrongColorCount: wrongColor.length,
      wrongColorRatio: wrongColorRatio,
      obstacleCount: obstacles.length,
      obstacleDensity: obstacleDensity,
      optimalScale: optimalScale,
      averageScale: averageScale,
      growthRoom: growthRoom
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

export default {
  generateLevel,
  generateLevels,
  generateBatch,
  validateLevel,
  calculateOptimalScale,
  calculateAverageScale,
  calculatePlayabilityMetrics,
  rankLevels,
  curateBestLevels
};
