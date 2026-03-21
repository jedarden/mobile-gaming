/**
 * Giant Runner - Level Generator
 *
 * Generates levels with:
 * - Matching-color collectibles placed along the course
 * - Wrong-color collectibles and obstacles interspersed
 * - Validates that best-case > boss + 30%
 * - Validates that average-case (70% collection) > boss
 */

import { MIN_SCALE, DEFAULT_START_SCALE, LANE_MIN, LANE_MAX } from './state.js';

// Lane positions for collectibles/obstacles
const LANES = [-2, -1, 0, 1, 2];

// Collectible value ranges
const MATCHING_VALUE_MIN = 0.08;
const MATCHING_VALUE_MAX = 0.15;
const WRONG_COLOR_VALUE = 0.05;

// Obstacle penalty
const OBSTACLE_PENALTY = 0.2;

/**
 * Random number between min and max
 */
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Pick a random element from array
 */
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

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
 * Monte Carlo simulation
 */
export function calculateAverageScale(level, startScale = DEFAULT_START_SCALE, runs = 100) {
  let totalScale = 0;

  for (let run = 0; run < runs; run++) {
    let scale = startScale;

    for (const collectible of level.collectibles) {
      // 70% chance to collect matching, 30% chance to hit wrong-color
      if (collectible.color === level.playerColor) {
        if (Math.random() < 0.7) {
          scale += collectible.value;
        }
        // Otherwise, missed the matching orb
      } else {
        // Wrong color - 30% chance of accidentally hitting it
        if (Math.random() < 0.3) {
          scale = Math.max(MIN_SCALE, scale - collectible.value);
        }
      }
    }

    // 20% chance to hit each obstacle
    for (const obstacle of (level.obstacles || [])) {
      if (Math.random() < 0.2) {
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

  // Optimal must exceed boss by 30%
  const optimalThreshold = bossScale * 1.3;
  if (optimalScale < optimalThreshold) {
    errors.push(`Optimal scale ${optimalScale.toFixed(2)} does not exceed boss ${bossScale} by 30% (need ${optimalThreshold.toFixed(2)})`);
  }

  // Average must beat boss (80% win rate threshold)
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
 * Generate a level
 */
export function generateLevel(config = {}) {
  const {
    id = 1,
    courseLength = 400,
    startScale = DEFAULT_START_SCALE,
    playerColor = 'blue',
    speed = 3,
    difficulty = 0.3,
    bossScale = 3.0
  } = config;

  const collectibles = [];
  const obstacles = [];

  // Calculate how many matching orbs we need to beat the boss
  // Need to achieve at least bossScale * 1.3 + some buffer
  const targetScale = bossScale * 1.35;
  const scaleNeeded = targetScale - startScale;

  // Average value per matching orb
  const avgValue = (MATCHING_VALUE_MIN + MATCHING_VALUE_MAX) / 2;
  const matchingOrbCount = Math.ceil(scaleNeeded / avgValue);

  // Space orbs along the course
  const spacing = courseLength / (matchingOrbCount + 2);

  // Generate matching color collectibles
  for (let i = 0; i < matchingOrbCount; i++) {
    const z = spacing * (i + 1);
    const x = randomPick(LANES);
    const value = randomBetween(MATCHING_VALUE_MIN, MATCHING_VALUE_MAX);

    collectibles.push({
      x,
      z: Math.round(z),
      color: playerColor,
      value: Math.round(value * 100) / 100
    });
  }

  // Add wrong-color collectibles (20-30% of matching count)
  const wrongColorCount = Math.floor(matchingOrbCount * (0.2 + difficulty * 0.1));
  const wrongColors = ['red', 'green', 'yellow', 'purple', 'orange'].filter(c => c !== playerColor);

  for (let i = 0; i < wrongColorCount; i++) {
    const matchingIdx = Math.floor(Math.random() * collectibles.length);
    const baseCollectible = collectibles[matchingIdx];

    // Place wrong-color near matching, but offset
    collectibles.push({
      x: randomPick(LANES.filter(l => l !== baseCollectible.x)),
      z: baseCollectible.z + randomBetween(-5, 5),
      color: randomPick(wrongColors),
      value: WRONG_COLOR_VALUE
    });
  }

  // Add obstacles (10-20% of matching count)
  const obstacleCount = Math.floor(matchingOrbCount * (0.1 + difficulty * 0.1));

  for (let i = 0; i < obstacleCount; i++) {
    const z = spacing * (0.5 + i * (matchingOrbCount / obstacleCount));
    const x = randomPick(LANES);

    obstacles.push({
      x,
      z: Math.round(z),
      width: 1.5
    });
  }

  // Sort by z position
  collectibles.sort((a, b) => a.z - b.z);
  obstacles.sort((a, b) => a.z - b.z);

  const level = {
    id,
    courseLength,
    startScale,
    playerColor,
    speed,
    collectibles,
    obstacles,
    boss: {
      z: courseLength,
      scale: bossScale
    },
    difficulty
  };

  // Validate and adjust if needed
  const validation = validateLevel(level);
  if (!validation.valid) {
    console.warn(`Level ${id} validation issues:`, validation.errors);
  }

  return level;
}

/**
 * Generate a set of levels with increasing difficulty
 */
export function generateLevels(count = 20) {
  const levels = [];

  // Difficulty tiers
  const tiers = [
    { levels: 5, difficulty: [0.1, 0.2], bossScale: [1.5, 2.5], courseLength: [200, 300] },
    { levels: 5, difficulty: [0.2, 0.4], bossScale: [2.5, 4.0], courseLength: [300, 400] },
    { levels: 5, difficulty: [0.3, 0.5], bossScale: [4.0, 6.0], courseLength: [400, 500] },
    { levels: 5, difficulty: [0.4, 0.6], bossScale: [6.0, 8.0], courseLength: [500, 600] }
  ];

  let levelId = 1;
  const playerColors = ['blue', 'red', 'green', 'yellow', 'purple', 'orange'];

  for (const tier of tiers) {
    for (let i = 0; i < tier.levels; i++) {
      const progress = i / (tier.levels - 1);

      const difficulty = tier.difficulty[0] + progress * (tier.difficulty[1] - tier.difficulty[0]);
      const bossScale = tier.bossScale[0] + progress * (tier.bossScale[1] - tier.bossScale[0]);
      const courseLength = Math.round(tier.courseLength[0] + progress * (tier.courseLength[1] - tier.courseLength[0]));

      // Regenerate until valid
      let level;
      let attempts = 0;
      do {
        level = generateLevel({
          id: levelId,
          courseLength,
          bossScale,
          difficulty,
          playerColor: playerColors[levelId % playerColors.length],
          speed: 3 + (levelId - 1) * 0.1
        });
        attempts++;
      } while (!validateLevel(level).valid && attempts < 10);

      levels.push(level);
      levelId++;
    }
  }

  return levels;
}

export default {
  generateLevel,
  generateLevels,
  validateLevel,
  calculateOptimalScale,
  calculateAverageScale
};
