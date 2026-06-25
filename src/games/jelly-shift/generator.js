/**
 * Jelly Shift - Level Generator
 *
 * Generates walls with holes at decreasing intervals.
 * Verifies all holes are achievable within blob deformation range.
 * Ensures consecutive transitions are achievable given reshape speed.
 */

import { createRng } from '../../shared/rng.js';
import { MIN_WIDTH, MAX_WIDTH, RESHAPE_SPEED, BASE_SPEED } from './state.js';

// Hole templates
const TALL_HOLES = [
  { shape: 'tall', width: 0.4, height: 2.5 },
  { shape: 'tall', width: 0.5, height: 2.0 },
  { shape: 'tall', width: 0.6, height: 1.67 },
  { shape: 'tall', width: 0.7, height: 1.43 },
  { shape: 'tall', width: 0.8, height: 1.25 },
];

const WIDE_HOLES = [
  { shape: 'wide', width: 2.5, height: 0.4 },
  { shape: 'wide', width: 2.0, height: 0.5 },
  { shape: 'wide', width: 1.67, height: 0.6 },
  { shape: 'wide', width: 1.43, height: 0.7 },
  { shape: 'wide', width: 1.25, height: 0.8 },
];

const PLUS_HOLES = [
  { shape: 'plus', widthH: 0.5, heightH: 2.5, widthV: 2.5, heightV: 0.5 },
  { shape: 'plus', widthH: 0.6, heightH: 2.0, widthV: 2.0, heightV: 0.6 },
  { shape: 'plus', widthH: 0.7, heightH: 1.8, widthV: 1.8, heightV: 0.7 },
  { shape: 'plus', widthH: 0.8, heightH: 1.5, widthV: 1.5, heightV: 0.8 },
];

// Difficulty tiers
const DIFFICULTY_CONFIG = {
  easy:   { wallCount: [6,  8],  startInterval: 35, minInterval: 22, speed: 1.8, difficulty: 0.2, usePlusHoles: false },
  medium: { wallCount: [8,  12], startInterval: 30, minInterval: 15, speed: 2.0, difficulty: 0.4, usePlusHoles: false },
  hard:   { wallCount: [10, 15], startInterval: 25, minInterval: 12, speed: 2.2, difficulty: 0.6, usePlusHoles: true  }
};

/**
 * Compute valid width range for a given hole
 * For simple shapes: width must satisfy w <= holeW AND 1/w <= holeH
 * So w <= holeW AND w >= 1/holeH
 * For plus shapes: w must fit in either H or V rectangle
 */
export function getValidWidthRange(hole) {
  if (hole.shape === 'tall' || hole.shape === 'wide') {
    const minW = 1 / hole.height;
    const maxW = hole.width;
    return { min: Math.max(MIN_WIDTH, minW), max: Math.min(MAX_WIDTH, maxW) };
  }

  if (hole.shape === 'plus') {
    // Can fit in horizontal or vertical
    const hMinW = 1 / hole.heightH;
    const hMaxW = hole.widthH;
    const vMinW = 1 / hole.heightV;
    const vMaxW = hole.widthV;

    // Union of two ranges
    const hRange = { min: Math.max(MIN_WIDTH, hMinW), max: Math.min(MAX_WIDTH, hMaxW) };
    const vRange = { min: Math.max(MIN_WIDTH, vMinW), max: Math.min(MAX_WIDTH, vMaxW) };

    // Merge overlapping ranges
    const mergedMin = Math.min(hRange.min, vRange.min);
    const mergedMax = Math.max(hRange.max, vRange.max);

    // Check if ranges overlap
    if (hRange.max >= vRange.min || vRange.max >= hRange.min) {
      return { min: mergedMin, max: mergedMax };
    }

    // Two separate ranges - return the wider one for simplicity
    const hWidth = hRange.max - hRange.min;
    const vWidth = vRange.max - vRange.min;
    return hWidth >= vWidth ? hRange : vRange;
  }

  return { min: MIN_WIDTH, max: MAX_WIDTH };
}

/**
 * Check if a hole is achievable within [MIN_WIDTH, MAX_WIDTH]
 */
export function isHoleAchievable(hole) {
  const range = getValidWidthRange(hole);
  return range.min <= range.max;
}

/**
 * Check if transition between two holes is achievable
 * Given wall spacing and game speed, is there enough time to reshape?
 */
export function isTransitionAchievable(holeA, holeB, wallSpacing, speed) {
  const rangeA = getValidWidthRange(holeA);
  const rangeB = getValidWidthRange(holeB);

  if (rangeA.max >= rangeB.min && rangeB.max >= rangeA.min) {
    // Ranges overlap - no problem
    return true;
  }

  // Ranges don't overlap - need to check if reshape is possible
  const minTransitionDist = rangeA.max < rangeB.min
    ? rangeB.min - rangeA.max
    : rangeA.min - rangeB.max;

  // Time available = wallSpacing / (speed * 60)
  const timeAvailable = wallSpacing / (speed * 60);
  // Distance reshape can cover in that time
  const maxReshapeDist = RESHAPE_SPEED * timeAvailable;

  return minTransitionDist <= maxReshapeDist;
}

/**
 * Generate a single level deterministically from a seed.
 *
 * @param {number} seed - PRNG seed
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {number} index - Level index
 * @returns {Object} Level object
 */
export function generateLevel(seed, difficulty = 'medium', index = 0) {
  const rng = createRng(seed);
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;

  const wallCount = rng.nextInt(config.wallCount[0], config.wallCount[1]);
  const { startInterval, minInterval, speed, difficulty: diffFactor, usePlusHoles } = config;

  const walls = [];
  let currentZ = 30; // First wall distance
  let lastHole = null;
  let interval = startInterval;
  let shapeToggle = false;

  const allHoles = [...TALL_HOLES, ...WIDE_HOLES];
  if (usePlusHoles) {
    allHoles.push(...PLUS_HOLES);
  }

  for (let i = 0; i < wallCount; i++) {
    let hole;
    let attempts = 0;

    do {
      // Alternate between tall and wide shapes
      if (usePlusHoles && i > 0 && i % 3 === 0) {
        // Every 3rd wall is a plus shape at higher difficulty
        hole = { ...rng.pick(PLUS_HOLES) };
      } else {
        // Pick from tall or wide based on toggle
        const pool = shapeToggle ? TALL_HOLES : WIDE_HOLES;
        hole = { ...rng.pick(pool) };
      }
      shapeToggle = !shapeToggle;
      attempts++;
    } while (!isHoleAchievable(hole) && attempts < 20);

    // Verify transition from last hole
    if (lastHole && !isTransitionAchievable(lastHole, hole, interval, speed)) {
      // Adjust to a more permissive hole
      const fallback = shapeToggle
        ? { shape: 'tall', width: 1.0, height: 1.0 }
        : { shape: 'wide', width: 1.0, height: 1.0 };
      hole = fallback;
    }

    walls.push({ z: currentZ, hole });
    lastHole = hole;

    // Decrease interval for difficulty escalation
    const intervalDecrease = diffFactor * 0.5;
    interval = Math.max(minInterval, interval - intervalDecrease);
    currentZ += interval;
  }

  return {
    id: `js-gen-${difficulty}-${index}-${seed}`,
    walls,
    speed,
    difficulty: diffFactor
  };
}

/**
 * Validate a generated level
 */
export function validateLevel(level) {
  const errors = [];

  for (let i = 0; i < level.walls.length; i++) {
    const wall = level.walls[i];

    // Check hole is achievable
    if (!isHoleAchievable(wall.hole)) {
      errors.push(`Wall ${i} (z=${wall.z}): hole is not achievable within [${MIN_WIDTH}, ${MAX_WIDTH}]`);
    }

    // Check transition from previous wall
    if (i > 0) {
      const prevWall = level.walls[i - 1];
      const spacing = wall.z - prevWall.z;
      if (!isTransitionAchievable(prevWall.hole, wall.hole, spacing, level.speed || BASE_SPEED)) {
        errors.push(`Wall ${i}: transition from wall ${i - 1} is not achievable`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
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
  const maxAttempts = count * 5;

  while (levels.length < count && attempts < maxAttempts) {
    const level = generateLevel(seed, difficulty, levels.length);
    const { valid } = validateLevel(level);
    if (valid) {
      levels.push(level);
    }
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
 * - Shape diversity: mix of tall, wide, plus holes
 * - Transition variety: alternating tall/wide patterns
 * - Difficulty progression: intervals decrease smoothly
 * - Achievability margins: holes not too tight
 *
 * @param {Object} level - Level object
 * @returns {Object} Metrics object with overall score
 */
export function calculatePlayabilityMetrics(level) {
  const walls = level.walls || [];
  const speed = level.speed || 2.0;

  // Metric 1: Shape diversity (0-30 points)
  const shapes = new Set();
  for (const wall of walls) {
    shapes.add(wall.hole.shape);
  }
  const diversityScore = shapes.has('plus') ?
    (shapes.size * 10) : Math.min(30, shapes.size * 12);

  // Metric 2: Transition variety (0-25 points)
  const transitions = [];
  for (let i = 1; i < walls.length; i++) {
    const prevShape = walls[i - 1].hole.shape;
    const currShape = walls[i].hole.shape;
    transitions.push(prevShape !== currShape ? 1 : 0);
  }
  const alternationRate = transitions.length > 0 ?
    transitions.reduce((a, b) => a + b, 0) / transitions.length : 0;
  const transitionScore = alternationRate >= 0.5 ? 25 :
                         alternationRate >= 0.3 ? 20 : 15;

  // Metric 3: Difficulty progression (0-25 points)
  const intervals = [];
  for (let i = 1; i < walls.length; i++) {
    intervals.push(walls[i].z - walls[i - 1].z);
  }
  // Check if intervals generally decrease (ramp up difficulty)
  let decreases = 0;
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i] < intervals[i - 1]) decreases++;
  }
  const progressionRate = intervals.length > 1 ? decreases / (intervals.length - 1) : 0;
  const progressionScore = progressionRate >= 0.6 ? 25 :
                           progressionRate >= 0.4 ? 20 : 15;

  // Metric 4: Achievability margins (0-20 points)
  let tightHoles = 0;
  let comfortableHoles = 0;
  for (const wall of walls) {
    const range = getValidWidthRange(wall.hole);
    const margin = range.max - range.min;
    if (margin < 0.3) tightHoles++;
    else if (margin > 0.5) comfortableHoles++;
  }
  // Prefer balance - not too tight, not too loose
  const comfortRatio = walls.length > 0 ? comfortableHoles / walls.length : 0;
  const marginScore = comfortRatio >= 0.4 && comfortRatio <= 0.7 ? 20 :
                     comfortRatio >= 0.2 ? 15 : 10;

  const totalScore = diversityScore + transitionScore + progressionScore + marginScore;

  return {
    overall: totalScore,
    shapeDiversity: diversityScore,
    transitionVariety: transitionScore,
    difficultyProgression: progressionScore,
    achievabilityMargins: marginScore,
    details: {
      shapeTypes: Array.from(shapes),
      alternationRate: alternationRate,
      progressionRate: progressionRate,
      tightHoles: tightHoles,
      comfortableHoles: comfortableHoles,
      comfortRatio: comfortRatio
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

export default { generateLevel, generateBatch, validateLevel, getValidWidthRange, isHoleAchievable, isTransitionAchievable, calculatePlayabilityMetrics, rankLevels, curateBestLevels };
