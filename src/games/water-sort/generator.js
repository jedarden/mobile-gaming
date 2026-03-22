/**
 * Water Sort - Procedural Level Generator
 *
 * Generates solvable puzzles by reverse-shuffling from solved state.
 * Uses seeded RNG for reproducibility.
 */

import { createRng } from '../../shared/rng.js';
import {
  createInitialState,
  canPour,
  pour,
  checkWin,
  getValidMoves,
  isTubeComplete,
  topColor,
  topGroupSize
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
function createSolvedTubes(colorCount, maxSegments) {
  const tubes = [];
  for (let i = 0; i < colorCount; i++) {
    tubes.push(Array(maxSegments).fill(COLORS[i]));
  }
  return tubes;
}

/**
 * Shuffle-specific canPour that allows pouring from complete tubes
 * (needed to un-shuffle from solved state)
 */
function canPourShuffle(state, fromIdx, toIdx) {
  if (fromIdx === toIdx) return false;
  if (fromIdx < 0 || fromIdx >= state.tubes.length) return false;
  if (toIdx < 0 || toIdx >= state.tubes.length) return false;

  const from = state.tubes[fromIdx];
  const to = state.tubes[toIdx];

  if (from.segments.length === 0) return false;
  if (to.segments.length >= state.maxSegments) return false;

  const fromTop = topColor(from);
  const toTop = topColor(to);
  if (toTop !== null && toTop !== fromTop) return false;

  return true;
}

/**
 * Get all valid shuffle moves (including from complete tubes)
 */
function getShuffleMoves(state) {
  const moves = [];
  for (let from = 0; from < state.tubes.length; from++) {
    for (let to = 0; to < state.tubes.length; to++) {
      if (canPourShuffle(state, from, to)) {
        moves.push([from, to]);
      }
    }
  }
  return moves;
}

/**
 * Shuffle a solved state by performing random valid pours
 * This guarantees solvability by reversibility
 *
 * @param {Object} state - Game state (starting from solved)
 * @param {number} rounds - Number of shuffle iterations
 * @param {Object} rng - RNG instance
 * @returns {Object} Shuffled state
 */
function shuffleState(state, rounds, rng) {
  let current = state;
  let lastFrom = -1;
  let lastTo = -1;

  for (let r = 0; r < rounds; r++) {
    const moves = getShuffleMoves(current);

    // Filter out trivial reverse moves
    const filtered = moves.filter(([f, t]) => {
      if (f === lastTo && t === lastFrom) return false;
      return true;
    });

    const pool = filtered.length > 0 ? filtered : moves;
    if (pool.length === 0) break;

    const [fromIdx, toIdx] = rng.pick(pool);
    lastFrom = fromIdx;
    lastTo = toIdx;
    current = pour(current, fromIdx, toIdx);
  }

  return current;
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

  const usedColors = COLORS.slice(0, colorCount);

  // Try up to 10 times to generate a valid level
  for (let attempt = 0; attempt < 10; attempt++) {
    // Create solved state
    const solvedTubes = createSolvedTubes(colorCount, maxSegments);
    const solvedState = createInitialState({
      tubes: solvedTubes,
      maxSegments
    });

    // Shuffle by reverse-pouring
    const shuffled = shuffleState(solvedState, shuffleRounds, rng);

    // Add buffer tubes
    const tubes = shuffled.tubes.map(t => t.segments);
    for (let i = 0; i < bufferTubes; i++) {
      tubes.push([]);
    }

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
