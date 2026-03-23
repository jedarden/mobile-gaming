/**
 * Pull the Pin - Level Generator
 *
 * Generates solvable pin-removal puzzle levels:
 * 1. Place cups at bottom with colors
 * 2. Place balls at top with matching colors
 * 3. Generate channel paths
 * 4. Place pins at intersections
 * 5. Verify solvability with solver
 */

import { createRng } from '../../shared/rng.js';
import { createInitialState, simulateToCompletion, checkWin, removePin } from './state.js';

// Generation parameters
const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 480;
const BALL_COLORS = ['red', 'blue', 'green', 'yellow'];

const DIFFICULTY_CONFIG = {
  easy:   { numColors: 2, numPins: 2 },
  medium: { numColors: 3, numPins: 3 },
  hard:   { numColors: 4, numPins: 4 }
};

/**
 * Generate a level with specified difficulty
 *
 * @param {number} seed - RNG seed for reproducibility
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {number} index - Level index (used in ID)
 * @returns {Object|null} Level definition or null if generation failed
 */
export function generateLevel(seed, difficulty = 'medium', index = 0) {
  const rng = createRng(seed);
  const difficultyNum = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;

  for (let i = 0; i < 10; i++) {
    const level = tryGenerateLevel(difficultyNum, rng, seed, index);
    if (level && isLevelSolvable(level)) {
      return level;
    }
  }

  return null;
}

/**
 * Attempt to generate a level
 */
function tryGenerateLevel(difficulty, rng, seed, index) {
  const numColors = Math.min(2 + difficulty, 4);
  const numPins = 2 + difficulty;

  // Select colors for this level
  const colors = shuffle([...BALL_COLORS], rng).slice(0, numColors);

  // Create cups at bottom
  const cupWidth = 50;
  const cupSpacing = CANVAS_WIDTH / (numColors + 1);
  const cups = colors.map((color, i) => ({
    id: `cup-${i}`,
    x: cupSpacing * (i + 1) - cupWidth / 2,
    y: CANVAS_HEIGHT - 80,
    width: cupWidth,
    height: 60,
    acceptColor: color
  }));

  // Create balls at top
  const balls = [];
  const ballSpacing = CANVAS_WIDTH / (numColors + 1);
  colors.forEach((color, i) => {
    balls.push({
      id: `ball-${i}`,
      x: ballSpacing * (i + 1),
      y: 30 + rng.next() * 30,
      color: color
    });
  });

  // Generate channel paths from balls to cups
  const channels = [];
  const pinPositions = [];

  for (let i = 0; i < colors.length; i++) {
    const ball = balls[i];
    const cup = cups[i];
    const channel = generateChannelPath(ball, cup, rng, i);

    // Mark intersection points for potential pin placement
    if (i > 0) {
      pinPositions.push(...findIntersections(channels, channel));
    }

    channels.push(channel);
  }

  // Place pins at strategic positions
  const pins = [];
  const selectedPins = selectPinPositions(pinPositions, numPins, rng);

  selectedPins.forEach((pos, i) => {
    const pinId = `pin-${i}`;
    pins.push({
      id: pinId,
      x: pos.x,
      y: pos.y
    });

    // Assign pin to block the nearest channel
    const nearestChannel = findNearestChannel(channels, pos);
    if (nearestChannel !== null) {
      channels[nearestChannel].blockedByPin = pinId;
    }
  });

  return {
    id: `ptp-gen-${seed}-${index}`,
    pins,
    balls,
    cups,
    channels,
    difficulty
  };
}

/**
 * Generate a channel path from ball to cup
 */
function generateChannelPath(ball, cup, rng, index) {
  const segments = [];

  // Start from ball position
  let x = ball.x;
  let y = ball.y;

  // Create waypoints
  const numWaypoints = 2 + Math.floor(rng.next() * 2);
  const stepY = (cup.y - ball.y) / (numWaypoints + 1);

  // Add horizontal offset based on index to create crossings
  const baseOffset = (index % 2 === 0 ? -1 : 1) * (30 + rng.next() * 40);

  for (let i = 1; i <= numWaypoints; i++) {
    const nextY = ball.y + stepY * i;
    const nextX = x + (i === 1 ? baseOffset : (rng.next() - 0.5) * 60);

    segments.push([x, y, nextX, nextY]);
    x = nextX;
    y = nextY;
  }

  // Final segment to cup
  segments.push([x, y, cup.x + cup.width / 2, cup.y]);

  return {
    segments,
    blockedByPin: null
  };
}

/**
 * Find intersection points between existing channels and new channel
 */
function findIntersections(existingChannels, newChannel) {
  const intersections = [];

  for (const existing of existingChannels) {
    for (const seg1 of existing.segments) {
      for (const seg2 of newChannel.segments) {
        const point = lineIntersection(
          seg1[0], seg1[1], seg1[2], seg1[3],
          seg2[0], seg2[1], seg2[2], seg2[3]
        );
        if (point) {
          intersections.push(point);
        }
      }
    }
  }

  return intersections;
}

/**
 * Calculate intersection point of two line segments
 */
function lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.001) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }

  return null;
}

/**
 * Select pin positions from candidate points
 */
function selectPinPositions(candidates, count, rng) {
  if (candidates.length === 0) {
    // Generate random pin positions if no intersections
    const pins = [];
    for (let i = 0; i < count; i++) {
      pins.push({
        x: 80 + rng.next() * (CANVAS_WIDTH - 160),
        y: 100 + rng.next() * 200
      });
    }
    return pins;
  }

  // Shuffle and select
  const shuffled = shuffle([...candidates], rng);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Find the channel nearest to a position
 */
function findNearestChannel(channels, pos) {
  let minDist = Infinity;
  let nearestIdx = 0;

  channels.forEach((channel, idx) => {
    for (const seg of channel.segments) {
      const midX = (seg[0] + seg[2]) / 2;
      const midY = (seg[1] + seg[3]) / 2;
      const dist = Math.sqrt((pos.x - midX) ** 2 + (pos.y - midY) ** 2);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = idx;
      }
    }
  });

  return nearestIdx;
}

/**
 * Check if a level is solvable
 * Uses BFS over pin-removal permutations
 */
export function isLevelSolvable(level) {
  const solution = findSolution(level);
  return solution !== null;
}

/**
 * Find a solution (pin removal order) for a level
 *
 * @param {Object} level - Level definition
 * @returns {string[]|null} Pin IDs in removal order, or null if unsolvable
 */
export function findSolution(level) {
  const initialState = createInitialState(level);
  const pins = initialState.pins.filter(p => !p.removed).map(p => p.id);

  if (pins.length === 0) {
    // No pins - check if level completes successfully
    const finalState = simulateToCompletion(initialState);
    return finalState.status === 'won' ? [] : null;
  }

  // BFS over pin-removal permutations
  const queue = [{ state: initialState, removed: [] }];
  const visited = new Set();

  while (queue.length > 0) {
    const { state: current, removed } = queue.shift();

    // Get remaining pins
    const remaining = current.pins.filter(p => !p.removed).map(p => p.id);

    if (remaining.length === 0) {
      // All pins removed - simulate to completion
      const finalState = simulateToCompletion(current);
      if (finalState.status === 'won') {
        return removed;
      }
      continue;
    }

    // Try removing each remaining pin
    for (const pinId of remaining) {
      const key = [...removed, pinId].sort().join(',');
      if (visited.has(key)) continue;
      visited.add(key);

      // Remove pin and simulate
      const afterRemove = removePin(current, pinId);
      const finalState = simulateToCompletion(afterRemove);

      // Prune: if this causes a loss, skip this branch
      if (finalState.status === 'lost') {
        continue;
      }

      // If won, we found a solution
      if (finalState.status === 'won') {
        return [...removed, pinId];
      }

      // Otherwise, continue exploring
      // Reset state to before simulation for further exploration
      queue.push({
        state: afterRemove,
        removed: [...removed, pinId]
      });
    }
  }

  return null;
}

/**
 * Validate a generated level
 *
 * @param {Object} level
 * @returns {{ valid: boolean, reason: string }}
 */
export function validateLevel(level) {
  if (!level.pins || !level.balls || !level.cups) {
    return { valid: false, reason: 'Missing required fields' };
  }
  const solvable = isLevelSolvable(level);
  if (!solvable) {
    return { valid: false, reason: 'Level is unsolvable' };
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
  const maxAttempts = count * 20;

  while (levels.length < count && attempts < maxAttempts) {
    const level = generateLevel(seed, difficulty, levels.length);
    if (level) {
      levels.push(level);
    }
    seed += 1;
    attempts++;
  }

  return levels;
}

/**
 * Shuffle an array using Fisher-Yates (uses seeded rng)
 */
function shuffle(array, rng) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default {
  generateLevel,
  generateBatch,
  validateLevel,
  isLevelSolvable,
  findSolution
};
