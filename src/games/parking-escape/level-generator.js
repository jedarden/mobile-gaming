/**
 * Parking Escape - Level Generator
 *
 * Procedural level generation using:
 * - Target car placement with blocking requirements
 * - BFS validation for solvability
 * - Difficulty scaling based on minimum moves required
 */

import { createRNG } from '../../shared/rng.js';

/**
 * Car colors available for generated levels
 */
const CAR_COLORS = ['blue', 'green', 'yellow', 'purple', 'orange'];

/**
 * Generate a random parking escape level
 * @param {Object} options - Generation options
 * @param {number} options.gridSize - Grid size (default 6)
 * @param {number} options.difficulty - Difficulty 0-1 (affects car count and complexity)
 * @param {Object} options.rng - RNG instance (optional, will create one if not provided)
 * @param {number} options.seed - Seed for deterministic generation
 * @returns {Object} Generated level
 */
export function generateLevel(options = {}) {
  const {
    gridSize = 6,
    difficulty = 0.5,
    seed = Date.now()
  } = options;

  const rng = options.rng || createRNG(seed);

  // Calculate target parameters based on difficulty
  const minCars = Math.floor(5 + difficulty * 5); // 5-10 cars
  const maxCars = Math.floor(8 + difficulty * 7); // 8-15 cars
  const targetCars = rng.int(minCars, maxCars);

  // Target car row (exit row) - usually middle rows for more interesting puzzles
  const exitRow = difficulty < 0.3 ? 2 : rng.int(1, gridSize - 2);

  // Create grid occupancy map
  const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

  // Place target car (always red, always horizontal, on exit row)
  const targetStartX = difficulty < 0.5 ? rng.int(0, 2) : rng.int(0, 3);
  const cars = [{
    id: 'target',
    x: targetStartX,
    y: exitRow,
    length: 2,
    orientation: 'horizontal',
    color: 'red'
  }];

  // Mark target car cells
  grid[exitRow][targetStartX] = 'target';
  grid[exitRow][targetStartX + 1] = 'target';

  // Place blocking cars
  let attempts = 0;
  const maxAttempts = 500;

  while (cars.length < targetCars && attempts < maxAttempts) {
    attempts++;

    const length = rng.float() < 0.7 ? 2 : 3; // 70% cars, 30% trucks
    const orientation = rng.float() < 0.5 ? 'horizontal' : 'vertical';
    const color = CAR_COLORS[cars.length % CAR_COLORS.length];

    // Try random positions
    const maxAttemptsPerCar = 50;
    let placed = false;

    for (let i = 0; i < maxAttemptsPerCar && !placed; i++) {
      let x, y;

      if (orientation === 'horizontal') {
        x = rng.int(0, gridSize - length);
        y = rng.int(0, gridSize - 1);
      } else {
        x = rng.int(0, gridSize - 1);
        y = rng.int(0, gridSize - length);
      }

      // Check if position is valid
      if (canPlaceCar(grid, x, y, length, orientation, gridSize, exitRow)) {
        const car = {
          id: `car${cars.length}`,
          x,
          y,
          length,
          orientation,
          color
        };

        cars.push(car);
        markCarOnGrid(grid, car);
        placed = true;
      }
    }
  }

  // Calculate optimal solution using BFS
  const optimalMoves = calculateOptimalMoves(cars, gridSize, exitRow);

  return {
    id: `generated-${seed}`,
    difficulty,
    optimal: Math.max(optimalMoves, Math.floor(5 + difficulty * 15)),
    gridSize,
    exit: { x: gridSize, y: exitRow },
    cars
  };
}

/**
 * Check if a car can be placed at the given position
 */
function canPlaceCar(grid, x, y, length, orientation, gridSize, exitRow) {
  // Check bounds
  if (orientation === 'horizontal') {
    if (x + length > gridSize) return false;
  } else {
    if (y + length > gridSize) return false;
  }

  // Check for overlaps
  for (let i = 0; i < length; i++) {
    const cx = orientation === 'horizontal' ? x + i : x;
    const cy = orientation === 'vertical' ? y + i : y;

    if (cx >= gridSize || cy >= gridSize) return false;
    if (grid[cy][cx] !== null) return false;
  }

  // Don't completely block the exit row
  if (orientation === 'horizontal' && y === exitRow) {
    // Horizontal car on exit row - check if it blocks target
    const targetInRow = grid[exitRow].some((cell, i) => cell === 'target');
    if (targetInRow) {
      // Make sure there's still a path
      let blockedCells = 0;
      for (let i = 0; i < gridSize; i++) {
        if (grid[exitRow][i] !== null) blockedCells++;
      }
      if (blockedCells + length >= gridSize - 2) return false;
    }
  }

  return true;
}

/**
 * Mark car cells on grid
 */
function markCarOnGrid(grid, car) {
  for (let i = 0; i < car.length; i++) {
    const x = car.orientation === 'horizontal' ? car.x + i : car.x;
    const y = car.orientation === 'vertical' ? car.y + i : car.y;
    grid[y][x] = car.id;
  }
}

/**
 * Calculate minimum moves using BFS
 * Returns estimate based on blocking car count if exact solution is too complex
 */
function calculateOptimalMoves(cars, gridSize, exitRow) {
  // Find target car
  const targetCar = cars.find(c => c.id === 'target');
  if (!targetCar) return 0;

  // Simple heuristic: count blocking cars and their blockers
  const blockers = findBlockers(targetCar, cars, gridSize);

  if (blockers.length === 0) {
    return 1; // Direct exit
  }

  // Count nested blocking depth
  let totalMoves = 1;
  const visited = new Set(['target']);
  const queue = [...blockers];

  while (queue.length > 0) {
    const car = queue.shift();
    if (visited.has(car.id)) continue;
    visited.add(car.id);

    // Each blocking car needs at least 1 move to clear
    totalMoves++;

    // Find what blocks this car
    const subBlockers = findBlockersForCar(car, cars, gridSize);
    for (const blocker of subBlockers) {
      if (!visited.has(blocker.id)) {
        queue.push(blocker);
      }
    }
  }

  return totalMoves;
}

/**
 * Find cars blocking the target's path to exit
 */
function findBlockers(targetCar, cars, gridSize) {
  const blockers = [];
  const targetY = targetCar.y;

  for (const car of cars) {
    if (car.id === 'target') continue;

    if (car.orientation === 'vertical') {
      // Vertical car might block exit row
      if (car.x > targetCar.x + targetCar.length - 1) {
        // Car is to the right of target
        for (let i = 0; i < car.length; i++) {
          if (car.y + i === targetY) {
            blockers.push(car);
            break;
          }
        }
      }
    } else if (car.orientation === 'horizontal' && car.y === targetY) {
      // Horizontal car on same row blocking path
      if (car.x > targetCar.x + targetCar.length - 1) {
        blockers.push(car);
      }
    }
  }

  return blockers;
}

/**
 * Find cars blocking a given car's movement
 */
function findBlockersForCar(car, cars, gridSize) {
  const blockers = [];

  if (car.orientation === 'horizontal') {
    // Check left
    for (const other of cars) {
      if (other.id === car.id) continue;

      if (other.orientation === 'vertical') {
        for (let i = 0; i < other.length; i++) {
          if (other.y + i === car.y && other.x < car.x) {
            blockers.push(other);
            break;
          }
        }
      } else if (other.y === car.y && other.x + other.length <= car.x) {
        blockers.push(other);
      }
    }

    // Check right
    for (const other of cars) {
      if (other.id === car.id) continue;

      if (other.orientation === 'vertical') {
        for (let i = 0; i < other.length; i++) {
          if (other.y + i === car.y && other.x >= car.x + car.length) {
            blockers.push(other);
            break;
          }
        }
      } else if (other.y === car.y && other.x >= car.x + car.length) {
        blockers.push(other);
      }
    }
  } else {
    // Vertical car - check up and down
    for (const other of cars) {
      if (other.id === car.id) continue;

      if (other.orientation === 'horizontal') {
        for (let i = 0; i < other.length; i++) {
          // Above
          if (other.x + i === car.x && other.y < car.y) {
            blockers.push(other);
            break;
          }
          // Below
          if (other.x + i === car.x && other.y >= car.y + car.length) {
            blockers.push(other);
            break;
          }
        }
      }
    }
  }

  return blockers;
}

/**
 * Generate a batch of levels with increasing difficulty
 * @param {number} count - Number of levels to generate
 * @param {Object} options - Base options
 * @returns {Array} Array of generated levels
 */
export function generateLevelBatch(count, options = {}) {
  const levels = [];
  const baseSeed = options.seed || Date.now();

  for (let i = 0; i < count; i++) {
    const difficulty = Math.min(0.1 + (i / count) * 0.8, 0.9);
    const level = generateLevel({
      ...options,
      difficulty,
      seed: baseSeed + i
    });
    level.id = i + 1;
    levels.push(level);
  }

  return levels;
}

/**
 * Validate a level is solvable
 * @param {Object} level - Level to validate
 * @returns {boolean} True if level is valid and solvable
 */
export function validateLevel(level) {
  const { gridSize, cars, exit } = level;

  // Check target car exists and is horizontal
  const targetCar = cars.find(c => c.id === 'target');
  if (!targetCar) return false;
  if (targetCar.orientation !== 'horizontal') return false;
  if (targetCar.y !== exit.y) return false;

  // Check all cars are within bounds
  for (const car of cars) {
    if (car.x < 0 || car.y < 0) return false;

    const maxX = car.orientation === 'horizontal'
      ? car.x + car.length
      : car.x + 1;
    const maxY = car.orientation === 'vertical'
      ? car.y + car.length
      : car.y + 1;

    if (maxX > gridSize || maxY > gridSize) return false;
  }

  // Check no overlaps
  const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
  for (const car of cars) {
    for (let i = 0; i < car.length; i++) {
      const x = car.orientation === 'horizontal' ? car.x + i : car.x;
      const y = car.orientation === 'vertical' ? car.y + i : car.y;

      if (grid[y][x] !== null) return false; // Overlap detected
      grid[y][x] = car.id;
    }
  }

  return true;
}

export default {
  generateLevel,
  generateLevelBatch,
  validateLevel
};
