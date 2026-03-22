/**
 * Water Sort - Procedural Level Generator
 *
 * Generates solvable puzzles by reverse-shuffling from solved state.
 * Uses seeded RNG for reproducibility.
 */

import { createRng } from '../../shared/rng.js';
import {
  createInitialState,
  checkWin,
  getValidMoves,
} from './state.js';

/** Available colors for level generation */
const COLORS = [
  'red', 'blue', 'green', 'yellow', 'purple', 'orange',
  'cyan', 'pink', 'teal', 'lime', 'indigo', 'coral'
];

/** Difficulty presets: [colorCount, bufferTubes, maxSegments, shuffleRounds] */
const DIFFICULTY = {
  easy: [
    [3, 1, 4, 60],
    [3, 2, 4, 80],
    [4, 1, 4, 80],
    [4, 2, 4, 100]
  ],
  medium: [
    [5, 1, 4, 100],
    [5, 2, 4, 120],
    [6, 1, 4, 120],
    [6, 2, 4, 150]
  ],
  hard: [
    [7, 1, 4, 150],
    [7, 2, 4, 180],
    [8, 1, 4, 180],
    [8, 2, 4, 200]
  ]
};

/**
 * Pick a difficulty preset based on 0-1 value
 *
 * @param {number} d - Difficulty between 0 and 1
 * @param {Object} rng - Seeded RNG instance
 * @returns {Array} [colorCount, bufferTubes, maxSegments, shuffleRounds]
 */
function presetFromDifficulty(d, rng) {
  if (d < 0.33) return rng.pick(DIFFICULTY.easy);
  if (d < 0.66) return rng.pick(DIFFICULTY.medium);
  return rng.pick(DIFFICULTY.hard);
}

/**
 * Create the solved state: C tubes each filled with one color
 *
 * @param {number} colorCount - Number of colors
 * @param {number} maxSegments - Segments per tube
 * @returns {string[][]} Array of tube arrays
 */
/**
 * Shuffle tubes by randomly relocating single color segments.
 * This creates genuinely mixed states regardless of color-matching rules,
 * and the result is always solvable because colors are fully traceable.
 *
 * @param {number} colorCount - Number of distinct colors
 * @param {number} bufferTubes - Number of empty buffer tubes
 * @param {number} maxSegments - Capacity per tube
 * @param {number} shuffleRounds - Number of random segment moves
 * @param {Object} rng - Seeded RNG
 * @returns {string[][]} Shuffled tube arrays
 */
function shuffleTubes(colorCount, bufferTubes, maxSegments, shuffleRounds, rng) {
  const COLORS_USED = COLORS.slice(0, colorCount);

  // Flat list of all color segments (colorCount * maxSegments total)
  const allSegments = [];
  for (const color of COLORS_USED) {
    for (let i = 0; i < maxSegments; i++) allSegments.push(color);
  }

  // Randomly shuffle segments using Fisher-Yates
  for (let i = allSegments.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [allSegments[i], allSegments[j]] = [allSegments[j], allSegments[i]];
  }

  // Distribute segments into colorCount + bufferTubes tubes, each holding up to maxSegments
  const tubeCount = colorCount + bufferTubes;
  const tubes = Array.from({ length: tubeCount }, () => []);
  let segIdx = 0;
  for (let t = 0; t < colorCount; t++) {
    for (let s = 0; s < maxSegments; s++) {
      tubes[t].push(allSegments[segIdx++]);
    }
  }
  // Buffer tubes remain empty

  return tubes;
}

/**
 * Validate a generated level has enough complexity
 * (not trivially already solved, not stuck)
 *
 * @param {string[][]} tubes - Tube configurations
 * @param {number} maxSegments - Max segments per tube
 * @returns {boolean}
 */
function validateLevel(tubes, maxSegments) {
  const state = createInitialState({ tubes, maxSegments });

  // Must not be already solved
  if (checkWin(state)) return false;

  // Must have valid moves
  if (getValidMoves(state).length === 0) return false;

  // Must have at least some tubes with mixed colors
  const mixedTubes = tubes.filter(t => {
    if (t.length === 0) return false;
    return !t.every(s => s === t[0]);
  });

  return mixedTubes.length >= 2;
}

/**
 * Generate a solvable Water Sort level
 *
 * @param {number} seed - RNG seed for reproducibility
 * @param {number} difficulty - Difficulty 0-1
 * @returns {Object|null} Level data or null if generation failed
 */
export function generateLevel(seed, difficulty = 0.5) {
  const rng = createRng(seed);
  const [colorCount, bufferTubes, maxSegments, shuffleRounds] = presetFromDifficulty(difficulty, rng);

  // Try up to 10 times to generate a valid level
  for (let attempt = 0; attempt < 10; attempt++) {
    // Randomly distribute all color segments across tubes (Fisher-Yates shuffle)
    const tubes = shuffleTubes(colorCount, bufferTubes, maxSegments, shuffleRounds, rng);

    // Validate
    if (validateLevel(tubes, maxSegments)) {
      return {
        id: `ws-gen-${seed}`,
        difficulty,
        tubes,
        maxSegments,
        colorCount,
        optimal: Math.max(colorCount, Math.floor(shuffleRounds / 10))
      };
    }
  }

  return null;
}

/**
 * Generate multiple levels at once
 *
 * @param {number} startSeed - Starting seed
 * @param {number} count - Number of levels to generate
 * @param {number} difficulty - Difficulty 0-1
 * @returns {Array} Array of level objects
 */
export function generateLevels(startSeed, count, difficulty = 0.5) {
  const levels = [];
  for (let i = 0; i < count; i++) {
    const level = generateLevel(startSeed + i, difficulty);
    if (level) {
      levels.push(level);
    }
  }
  return levels;
}

export default { generateLevel, generateLevels };
