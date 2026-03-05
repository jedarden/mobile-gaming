/**
 * Water Sort - Level Generator
 *
 * Procedural level generation using reverse-shuffle algorithm:
 * 1. Create solved state (each tube filled with one color)
 * 2. Make random valid reverse pours to shuffle
 * 3. Verify level is solvable using BFS solver
 */

import { createRNG } from '../../shared/rng.js';

// Standard colors for water sort
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'];

// Difficulty configurations
const DIFFICULTY_CONFIG = {
  easy: {
    colors: { min: 2, max: 3 },
    emptyTubes: 2,
    shuffleMoves: { min: 20, max: 40 },
    maxOptimal: 10
  },
  medium: {
    colors: { min: 3, max: 5 },
    emptyTubes: 2,
    shuffleMoves: { min: 30, max: 60 },
    maxOptimal: 20
  },
  hard: {
    colors: { min: 5, max: 7 },
    emptyTubes: 2,
    shuffleMoves: { min: 40, max: 80 },
    maxOptimal: 35
  },
  extreme: {
    colors: { min: 6, max: 8 },
    emptyTubes: 2,
    shuffleMoves: { min: 50, max: 100 },
    maxOptimal: 50
  }
};

/**
 * Generate a water sort level from seed
 * @param {number} seed - Random seed for reproducibility
 * @param {object} config - Configuration options
 * @returns {object} Generated level
 */
export function generateLevel(seed, config = {}) {
  const rng = createRNG(seed);
  const difficulty = config.difficulty || 'medium';
  const diffConfig = DIFFICULTY_CONFIG[difficulty];

  const numColors = config.numColors || rng.int(diffConfig.colors.min, diffConfig.colors.max);
  const emptyTubes = config.emptyTubes || diffConfig.emptyTubes;
  const capacity = config.capacity || 4;

  // Step 1: Create solved state
  const solved = [];
  const selectedColors = COLORS.slice(0, numColors);

  for (let c = 0; c < numColors; c++) {
    solved.push(Array(capacity).fill(selectedColors[c]));
  }

  for (let e = 0; e < emptyTubes; e++) {
    solved.push([]);
  }

  // Step 2: Reverse shuffle - make random valid pours from solved state
  let state = solved.map(tube => [...tube]);
  const shuffleMoves = rng.int(diffConfig.shuffleMoves.min, diffConfig.shuffleMoves.max);

  for (let i = 0; i < shuffleMoves; i++) {
    const moves = getValidReverseMoves(state, capacity);

    if (moves.length === 0) break;

    const move = rng.pick(moves);
    applyReverseMove(state, move, capacity);
  }

  // Step 3: Verify solvable
  const isSolvableResult = isSolvable(state, capacity, 100);
  const optimalMoves = isSolvableResult.moves;

  if (!isSolvableResult.solvable) {
    // Retry with incremented seed
    return generateLevel(seed + 1, config);
  }

  // Check if optimal is within acceptable range
  if (optimalMoves > diffConfig.maxOptimal) {
    return generateLevel(seed + 100, config);
  }

  return {
    id: `generated-${seed}`,
    tubes: state,
    seed,
    optimal: optimalMoves,
    difficulty: calculateDifficulty(state, optimalMoves, capacity),
    numColors,
    capacity
  };
}

/**
 * Get valid reverse moves (pouring from any tube to tube with same top color or empty)
 */
function getValidReverseMoves(tubes, capacity) {
  const moves = [];

  for (let from = 0; from < tubes.length; from++) {
    const fromTube = tubes[from];
    if (fromTube.length === 0) continue;

    const topColor = fromTube[fromTube.length - 1];
    const topCount = countTopColors(fromTube);

    for (let to = 0; to < tubes.length; to++) {
      if (from === to) continue;

      const toTube = tubes[to];

      // Skip if destination is full
      if (toTube.length >= capacity) continue;

      // In reverse mode, we can pour onto same color or empty
      const destTop = toTube.length > 0 ? toTube[toTube.length - 1] : null;

      if (destTop === null || destTop === topColor) {
        // Check if we have space
        const availableSpace = capacity - toTube.length;
        if (availableSpace > 0) {
          moves.push({
            from,
            to,
            amount: Math.min(topCount, availableSpace)
          });
        }
      }
    }
  }

  return moves;
}

/**
 * Apply a reverse move (pour liquid)
 */
function applyReverseMove(tubes, move, capacity) {
  const { from, to, amount } = move;
  const fromTube = tubes[from];
  const toTube = tubes[to];
  const color = fromTube[fromTube.length - 1];

  // Move liquid
  for (let i = 0; i < amount; i++) {
    if (fromTube.length > 0 && toTube.length < capacity) {
      fromTube.pop();
      toTube.push(color);
    }
  }
}

/**
 * Count consecutive top colors in a tube
 */
function countTopColors(tube) {
  if (tube.length === 0) return 0;

  const topColor = tube[tube.length - 1];
  let count = 0;

  for (let i = tube.length - 1; i >= 0; i--) {
    if (tube[i] === topColor) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

/**
 * BFS solver to check if level is solvable and find optimal moves
 */
export function isSolvable(tubes, capacity, maxMoves = 100) {
  const initialState = tubes.map(t => [...t]);
  const visited = new Set();
  const queue = [{ tubes: initialState, moves: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    const stateKey = JSON.stringify(current.tubes);

    if (visited.has(stateKey)) continue;
    visited.add(stateKey);

    // Check if solved
    if (isWinState(current.tubes, capacity)) {
      return { solvable: true, moves: current.moves };
    }

    // Limit search depth
    if (current.moves >= maxMoves) continue;

    // Generate all possible moves
    const moves = getValidMoves(current.tubes, capacity);

    for (const move of moves) {
      const newTubes = current.tubes.map(t => [...t]);
      applyMove(newTubes, move);

      const newKey = JSON.stringify(newTubes);
      if (!visited.has(newKey)) {
        queue.push({ tubes: newTubes, moves: current.moves + 1 });
      }
    }
  }

  return { solvable: false, moves: Infinity };
}

/**
 * Get valid forward moves
 */
function getValidMoves(tubes, capacity) {
  const moves = [];

  for (let from = 0; from < tubes.length; from++) {
    const fromTube = tubes[from];
    if (fromTube.length === 0) continue;

    const topColor = fromTube[fromTube.length - 1];
    const topCount = countTopColors(fromTube);

    for (let to = 0; to < tubes.length; to++) {
      if (from === to) continue;

      const toTube = tubes[to];

      // Skip if destination is full
      if (toTube.length >= capacity) continue;

      const destTop = toTube.length > 0 ? toTube[toTube.length - 1] : null;

      // Can pour to empty or same color
      if (destTop === null || destTop === topColor) {
        const availableSpace = capacity - toTube.length;
        const pourAmount = Math.min(topCount, availableSpace);

        if (pourAmount > 0) {
          moves.push({ from, to, amount: pourAmount, color: topColor });
        }
      }
    }
  }

  return moves;
}

/**
 * Apply a forward move
 */
function applyMove(tubes, move) {
  const { from, to, amount, color } = move;

  for (let i = 0; i < amount; i++) {
    tubes[from].pop();
    tubes[to].push(color);
  }
}

/**
 * Check if state is a win
 */
function isWinState(tubes, capacity) {
  return tubes.every(tube => {
    if (tube.length === 0) return true;
    if (tube.length !== capacity) return false;
    return tube.every(c => c === tube[0]);
  });
}

/**
 * Calculate difficulty rating for a level
 */
function calculateDifficulty(tubes, optimalMoves, capacity) {
  // Count non-empty tubes
  const nonEmptyTubes = tubes.filter(t => t.length > 0).length;

  // Count unique colors
  const colors = new Set();
  tubes.forEach(tube => tube.forEach(color => colors.add(color)));
  const numColors = colors.size;

  // Calculate fragmentation (how mixed up the colors are)
  let fragmentation = 0;
  tubes.forEach(tube => {
    for (let i = 1; i < tube.length; i++) {
      if (tube[i] !== tube[i - 1]) {
        fragmentation++;
      }
    }
  });

  // Normalize difficulty to 0-1 range
  const colorScore = (numColors - 2) / 6; // 2-8 colors
  const moveScore = Math.min(optimalMoves / 50, 1);
  const fragScore = Math.min(fragmentation / 20, 1);

  const difficulty = (colorScore * 0.3 + moveScore * 0.5 + fragScore * 0.2);

  return Math.round(difficulty * 100) / 100;
}

/**
 * Generate daily challenge level
 */
export function generateDailyLevel(dateString, gameId = 'water-sort') {
  // Create seed from date string
  let seed = 0;
  for (let i = 0; i < dateString.length; i++) {
    seed = ((seed << 5) - seed) + dateString.charCodeAt(i);
    seed |= 0;
  }
  seed = Math.abs(seed);

  return generateLevel(seed, { difficulty: 'medium' });
}

/**
 * Generate batch of levels for level pack
 */
export function generateLevelPack(startSeed, count, difficultyProgression = true) {
  const levels = [];

  for (let i = 0; i < count; i++) {
    let difficulty = 'easy';

    if (difficultyProgression) {
      const progress = i / count;
      if (progress < 0.2) difficulty = 'easy';
      else if (progress < 0.5) difficulty = 'medium';
      else if (progress < 0.8) difficulty = 'hard';
      else difficulty = 'extreme';
    }

    const level = generateLevel(startSeed + i, { difficulty });
    level.id = i + 1;
    levels.push(level);
  }

  return levels;
}

/**
 * Validate a level is properly formed
 */
export function validateLevel(level) {
  const errors = [];

  if (!level.tubes || !Array.isArray(level.tubes)) {
    errors.push('Level must have tubes array');
    return { valid: false, errors };
  }

  const capacity = level.capacity || 4;

  // Check each tube
  level.tubes.forEach((tube, index) => {
    if (!Array.isArray(tube)) {
      errors.push(`Tube ${index} must be an array`);
    } else if (tube.length > capacity) {
      errors.push(`Tube ${index} exceeds capacity ${capacity}`);
    }
  });

  // Count color segments
  const colorCounts = {};
  level.tubes.forEach(tube => {
    tube.forEach(color => {
      colorCounts[color] = (colorCounts[color] || 0) + 1;
    });
  });

  // Each color should have exactly 'capacity' segments
  Object.entries(colorCounts).forEach(([color, count]) => {
    if (count !== capacity) {
      errors.push(`Color ${color} has ${count} segments, expected ${capacity}`);
    }
  });

  // Check solvability
  if (errors.length === 0) {
    const result = isSolvable(level.tubes, capacity);
    if (!result.solvable) {
      errors.push('Level is not solvable');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    solvable: errors.length === 0 ? isSolvable(level.tubes, capacity).solvable : false
  };
}

export { COLORS, DIFFICULTY_CONFIG };
export default {
  generateLevel,
  generateDailyLevel,
  generateLevelPack,
  isSolvable,
  validateLevel,
  COLORS,
  DIFFICULTY_CONFIG
};
