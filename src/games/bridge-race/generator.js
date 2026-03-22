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

export default { generateLevel, validateLevel, generateBatch };
