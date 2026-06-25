/**
 * Crowd Runner - Level Generator
 *
 * Generates procedural levels and validates them.
 * All levels are deterministic given the same seed.
 *
 * Algorithm:
 * 1. Place gates at regular z-intervals
 * 2. Each gate: one "good" op (positive) and one "bad" op (negative/weaker)
 * 3. Randomize which side is good/bad per gate
 * 4. Calculate optimal path crowd size → must exceed boss.size
 * 5. Set boss.size ≈ 80% of optimal crowd size
 */

import { createRng } from '../../shared/rng.js';
import { evaluateAllPaths } from './state.js';

// Difficulty parameters
const DIFFICULTY_CONFIG = {
  easy: {
    gateCount: [3, 4],
    courseLength: [350, 450],
    startingCrowd: [8, 12],
    speed: [1.4, 1.8],
    bossFraction: 0.75,  // boss = 75% of optimal
    badOpSeverity: 0.4   // how harsh bad ops are
  },
  medium: {
    gateCount: [5, 6],
    courseLength: [450, 600],
    startingCrowd: [10, 15],
    speed: [1.8, 2.2],
    bossFraction: 0.80,
    badOpSeverity: 0.5
  },
  hard: {
    gateCount: [7, 9],
    courseLength: [600, 800],
    startingCrowd: [10, 12],
    speed: [2.2, 2.8],
    bossFraction: 0.78,   // 1/0.78 ≈ 1.28×, safely above the 1.2× threshold
    badOpSeverity: 0.6
  }
};

/**
 * Good operations: increase crowd
 */
const GOOD_OPS = [
  (crowd, rng) => ({ op: '+', value: Math.round(rng.nextInt(8, 25)) }),
  (crowd, rng) => ({ op: '+', value: Math.round(rng.nextInt(15, 40)) }),
  (crowd, rng) => ({ op: '×', value: rng.nextInt(2, 3) })
];

/**
 * Bad operations: decrease crowd
 */
const BAD_OPS = [
  (crowd, rng) => ({ op: '−', value: Math.round(rng.nextInt(3, 12)) }),
  (crowd, rng) => ({ op: '÷', value: rng.nextInt(2, 3) }),
  (crowd, rng) => ({ op: '−', value: Math.round(rng.nextInt(5, 15)) })
];

/**
 * Generate a good (beneficial) gate operation
 */
function makeGoodOp(crowd, rng) {
  const opFn = GOOD_OPS[rng.nextInt(0, GOOD_OPS.length - 1)];
  return opFn(crowd, rng);
}

/**
 * Generate a bad (harmful) gate operation
 */
function makeBadOp(crowd, rng) {
  const opFn = BAD_OPS[rng.nextInt(0, BAD_OPS.length - 1)];
  return opFn(crowd, rng);
}

/**
 * Simulate optimal path (always pick the better operation)
 */
function simulateOptimal(startCrowd, gates) {
  let crowd = startCrowd;
  for (const gate of gates) {
    // Apply both ops and pick the better result
    const leftResult = applyOp(crowd, gate.left);
    const rightResult = applyOp(crowd, gate.right);
    crowd = Math.max(leftResult, rightResult);
  }
  return crowd;
}

/**
 * Apply operation (inline for generator use)
 */
function applyOp(crowd, op) {
  let result;
  switch (op.op) {
    case '+': result = crowd + op.value; break;
    case '−': result = crowd - op.value; break;
    case '×': result = crowd * op.value; break;
    case '÷': result = Math.floor(crowd / op.value); break;
    default:  result = crowd;
  }
  return Math.max(1, result);
}

/**
 * Generate a single level deterministically from a seed.
 *
 * @param {number} seed - PRNG seed
 * @param {'easy'|'medium'|'hard'} difficulty - Difficulty tier
 * @param {number} index - Level index (used in the ID)
 * @returns {Object} Level object
 */
export function generateLevel(seed, difficulty = 'medium', index = 0) {
  const rng = createRng(seed);
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;

  const gateCount = rng.nextInt(config.gateCount[0], config.gateCount[1]);
  const courseLength = rng.nextInt(config.courseLength[0], config.courseLength[1]);
  const startingCrowd = rng.nextInt(config.startingCrowd[0], config.startingCrowd[1]);
  const speed = config.speed[0] + rng.next() * (config.speed[1] - config.speed[0]);

  // Space gates evenly along the course (leave 15% margin at start and end)
  const gateStart = courseLength * 0.15;
  const gateEnd = courseLength * 0.85;
  const gateSpacing = (gateEnd - gateStart) / (gateCount + 1);

  const gates = [];
  for (let i = 0; i < gateCount; i++) {
    const z = Math.round(gateStart + gateSpacing * (i + 1));
    const goodOp = makeGoodOp(startingCrowd, rng);
    const badOp = makeBadOp(startingCrowd, rng);

    // Randomly assign good/bad to left/right
    const goodOnLeft = rng.next() < 0.5;
    gates.push({
      z,
      left:  goodOnLeft ? goodOp : badOp,
      right: goodOnLeft ? badOp  : goodOp
    });
  }

  // Compute optimal crowd size then set boss to bossFraction of it
  const optimalCrowd = simulateOptimal(startingCrowd, gates);
  const bossSize = Math.max(2, Math.round(optimalCrowd * config.bossFraction));

  const level = {
    id: `gen-${difficulty}-${index}-${seed}`,
    startingCrowd,
    courseLength,
    speed: Math.round(speed * 10) / 10,
    gates,
    boss: { size: bossSize },
    difficulty
  };

  return level;
}

/**
 * Validate a level:
 * - At least one path beats the boss
 * - Optimal path beats boss by ≥ 20%
 * - At least one path loses
 *
 * @param {Object} level - Level object
 * @returns {{ valid: boolean, reason: string }}
 */
export function validateLevel(level) {
  const { optimal, worst } = evaluateAllPaths(level);

  if (optimal <= level.boss.size) {
    return { valid: false, reason: `No winning path: optimal=${optimal}, boss=${level.boss.size}` };
  }

  const margin = optimal / level.boss.size;
  if (margin < 1.2) {
    return {
      valid: false,
      reason: `Optimal margin too small: ${margin.toFixed(2)}x (need 1.2x)`
    };
  }

  if (worst > level.boss.size) {
    return { valid: false, reason: `No losing path: worst=${worst}, boss=${level.boss.size}` };
  }

  return { valid: true, reason: 'OK' };
}

/**
 * Generate a batch of validated levels.
 *
 * @param {number} baseSeed - Starting seed
 * @param {'easy'|'medium'|'hard'} difficulty - Difficulty tier
 * @param {number} count - Number of levels to generate
 * @returns {Object[]} Array of valid levels
 */
export function generateBatch(baseSeed, difficulty, count) {
  const levels = [];
  let seed = baseSeed;
  let attempts = 0;
  const maxAttempts = count * 5;

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
 * Calculate playability metrics for a level.
 * Higher scores indicate better, more engaging levels.
 *
 * Metrics:
 * - Decision diversity: variety of gate operations (+, -, ×, ÷)
 * - Crowd variance: how much crowd size can fluctuate
 * - Balance margin: ratio between optimal and worst paths
 * - Gate spacing: variety of z-spacing between gates
 *
 * @param {Object} level - Level object
 * @returns {Object} Metrics object with overall score
 */
export function calculatePlayabilityMetrics(level) {
  const gates = level.gates || [];
  const startCrowd = level.startingCrowd || 10;

  // Metric 1: Decision diversity (0-30 points)
  const opTypes = new Set();
  for (const gate of gates) {
    opTypes.add(gate.left.op);
    opTypes.add(gate.right.op);
  }
  const diversityScore = Math.min(30, opTypes.size * 10);

  // Metric 2: Crowd variance (0-25 points)
  // Simulate crowd size changes through level
  const crowdSizes = [startCrowd];
  let currentCrowd = startCrowd;
  for (const gate of gates) {
    const leftResult = applyOp(currentCrowd, gate.left);
    const rightResult = applyOp(currentCrowd, gate.right);
    currentCrowd = Math.max(leftResult, rightResult);
    crowdSizes.push(currentCrowd);
  }
  const variance = Math.max(...crowdSizes) - Math.min(...crowdSizes);
  const varianceScore = Math.min(25, variance * 2);

  // Metric 3: Balance margin (0-25 points)
  const { optimal, worst } = evaluateAllPaths(level);
  const margin = optimal / Math.max(1, worst);
  // Ideal margin is 1.5-2.5 (not too easy, not impossible)
  const idealMargin = margin >= 1.5 && margin <= 2.5 ? 25 :
                      margin >= 1.3 && margin < 1.5 ? 15 :
                      margin > 2.5 && margin <= 3.0 ? 15 : 5;

  // Metric 4: Gate spacing variety (0-20 points)
  const spacings = [];
  for (let i = 1; i < gates.length; i++) {
    spacings.push(gates[i].z - gates[i - 1].z);
  }
  const spacingVariance = spacings.length > 1 ?
    Math.max(...spacings) - Math.min(...spacings) : 0;
  const spacingScore = Math.min(20, spacingVariance / 2);

  const totalScore = diversityScore + varianceScore + idealMargin + spacingScore;

  return {
    overall: totalScore,
    diversity: diversityScore,
    crowdVariance: varianceScore,
    balanceMargin: idealMargin,
    spacingVariety: spacingScore,
    details: {
      opTypeCount: opTypes.size,
      crowdVarianceValue: variance,
      optimalWorstRatio: margin,
      spacingVarianceValue: spacingVariance
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
