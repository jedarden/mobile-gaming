/**
 * Bridge Race - Level Generator
 *
 * Generates procedural bridge race levels deterministically.
 * Validates that blue block supply >= total bridge cells * 1.2.
 */

import { createRng } from '../../shared/rng.js';

// Difficulty configurations
const DIFFICULTY_CONFIG = {
  easy: {
    bridgeCount: [2, 3],
    bridgeCells: [3, 3],
    finishZBase: 90,
    opponentCount: 1,
    opponentAi: ['random']
  },
  medium: {
    bridgeCount: [3, 4],
    bridgeCells: [3, 4],
    finishZBase: 140,
    opponentCount: 2,
    opponentAi: ['random', 'greedy']
  },
  hard: {
    bridgeCount: [4, 4],
    bridgeCells: [4, 5],
    finishZBase: 200,
    opponentCount: 2,
    opponentAi: ['greedy', 'greedy']
  }
};

const COLORS = ['red', 'green', 'yellow', 'purple'];

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

  const bridgeCount = rng.nextInt(config.bridgeCount[0], config.bridgeCount[1]);
  const cellsPerBridge = rng.nextInt(config.bridgeCells[0], config.bridgeCells[1]);
  const totalCellsNeeded = bridgeCount * cellsPerBridge;
  // Ensure 20% surplus of blue blocks
  const minBlueBlocks = Math.ceil(totalCellsNeeded * 1.2);

  const arenaWidth = 24;
  const finishZ = config.finishZBase + rng.nextInt(0, 30);

  // Spacing for bridges
  const bridgeSpacingZ = Math.floor((finishZ - 20) / (bridgeCount + 1));
  const bridges = [];
  for (let i = 0; i < bridgeCount; i++) {
    bridges.push({
      z: Math.round(bridgeSpacingZ * (i + 1)),
      required: cellsPerBridge
    });
  }

  // Place blue block piles - enough to cover all bridges with 20% surplus
  const blockPiles = [];
  let blueBlocksPlaced = 0;

  // Spread piles before and between bridges
  const pileZones = bridgeCount + 1;
  for (let zone = 0; zone < pileZones && blueBlocksPlaced < minBlueBlocks; zone++) {
    const zStart = zone === 0 ? 5 : bridges[zone - 1].z + 3;
    const zEnd = zone < bridges.length ? bridges[zone].z - 3 : finishZ - 10;
    if (zEnd <= zStart) continue;

    const zPos = Math.round(zStart + (zEnd - zStart) * 0.5);
    const pileCount = Math.min(cellsPerBridge + 1, minBlueBlocks - blueBlocksPlaced + 1);

    blockPiles.push({
      x: rng.nextInt(-9, -4),
      z: zPos,
      color: 'blue',
      count: pileCount
    });
    blueBlocksPlaced += pileCount;

    if (blueBlocksPlaced < minBlueBlocks) {
      const extraCount = Math.min(2, minBlueBlocks - blueBlocksPlaced);
      blockPiles.push({
        x: rng.nextInt(2, 8),
        z: zPos + rng.nextInt(2, 5),
        color: 'blue',
        count: extraCount
      });
      blueBlocksPlaced += extraCount;
    }
  }

  // Opponent piles
  const opponentColors = COLORS.slice(0, config.opponentCount);
  for (const color of opponentColors) {
    const zPos = rng.nextInt(5, Math.floor(finishZ / 3));
    blockPiles.push({
      x: rng.nextInt(-10, 10),
      z: zPos,
      color,
      count: totalCellsNeeded
    });
  }

  // Opponents
  const opponents = [];
  for (let i = 0; i < config.opponentCount; i++) {
    opponents.push({
      color: opponentColors[i],
      x: rng.nextInt(-8, 8),
      ai: config.opponentAi[i] || 'random'
    });
  }

  return {
    id: `gen-${difficulty}-${index}-${seed}`,
    arenaWidth,
    finishZ,
    playerColor: 'blue',
    opponents,
    bridges,
    blockPiles,
    difficulty
  };
}

/**
 * Validate a level.
 * Checks: total blue piles count >= bridge cells total * 1.2.
 *
 * @param {Object} level
 * @returns {{ valid: boolean, reason: string }}
 */
export function validateLevel(level) {
  if (!level.bridges || level.bridges.length === 0) {
    return { valid: false, reason: 'No bridges defined' };
  }

  const totalCells = level.bridges.reduce((sum, b) => sum + (b.required || 0), 0);
  const totalBlue = (level.blockPiles || [])
    .filter(p => p.color === (level.playerColor || 'blue'))
    .reduce((sum, p) => sum + p.count, 0);

  const required = totalCells * 1.2;
  if (totalBlue < required) {
    return {
      valid: false,
      reason: `Insufficient blue blocks: have ${totalBlue}, need ${required.toFixed(1)} (${totalCells} cells * 1.2)`
    };
  }

  // Bridges must be at increasing z, all < finishZ
  let lastZ = 0;
  for (const bridge of level.bridges) {
    if (bridge.z <= lastZ) {
      return { valid: false, reason: `Bridge z=${bridge.z} not strictly increasing` };
    }
    if (bridge.z >= level.finishZ) {
      return { valid: false, reason: `Bridge z=${bridge.z} >= finishZ=${level.finishZ}` };
    }
    lastZ = bridge.z;
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
 * - Block distribution: even spread of blue blocks
 * - Bridge variety: varied required cell counts
 * - Opponent balance: fair competition
 * - Strategic depth: multiple pile sizes to optimize
 *
 * @param {Object} level - Level object
 * @returns {Object} Metrics object with overall score
 */
export function calculatePlayabilityMetrics(level) {
  const bridges = level.bridges || [];
  const blockPiles = level.blockPiles || [];
  const opponents = level.opponents || [];
  const playerColor = level.playerColor || 'blue';

  // Metric 1: Block distribution (0-30 points)
  const bluePiles = blockPiles.filter(p => p.color === playerColor);
  const pileSizes = bluePiles.map(p => p.count);
  const avgPileSize = pileSizes.length > 0 ?
    pileSizes.reduce((a, b) => a + b, 0) / pileSizes.length : 0;
  const pileVariance = pileSizes.length > 1 ?
    Math.max(...pileSizes) - Math.min(...pileSizes) : 0;
  // Prefer some variance but not extreme
  const distributionScore = pileVariance > 0 && pileVariance < avgPileSize * 0.8 ? 30 :
                           pileVariance > 0 ? 20 : 10;

  // Metric 2: Bridge variety (0-25 points)
  const bridgeReqs = bridges.map(b => b.required);
  const bridgeVariance = bridgeReqs.length > 1 ?
    Math.max(...bridgeReqs) - Math.min(...bridgeReqs) : 0;
  // Some variance in bridge difficulty adds interest
  const bridgeScore = bridgeVariance > 0 ? 25 : 15;

  // Metric 3: Opponent balance (0-25 points)
  const opponentCount = opponents.length;
  // 1-2 opponents is ideal for challenge
  const opponentScore = opponentCount === 1 ? 25 :
                       opponentCount === 2 ? 20 :
                       opponentCount === 0 ? 10 : 15;

  // Metric 4: Strategic depth (0-20 points)
  // Check if there are multiple pile sizes (creating collection choices)
  const uniqueSizes = new Set(pileSizes);
  const strategicScore = uniqueSizes.size >= 3 ? 20 :
                        uniqueSizes.size === 2 ? 15 : 10;

  const totalScore = distributionScore + bridgeScore + opponentScore + strategicScore;

  return {
    overall: totalScore,
    blockDistribution: distributionScore,
    bridgeVariety: bridgeScore,
    opponentBalance: opponentScore,
    strategicDepth: strategicScore,
    details: {
      bluePileCount: bluePiles.length,
      avgPileSize: Math.round(avgPileSize),
      pileVariance: pileVariance,
      bridgeCount: bridges.length,
      bridgeVariance: bridgeVariance,
      opponentCount: opponentCount,
      uniquePileSizes: uniqueSizes.size
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
