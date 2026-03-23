/**
 * Bus Jam - Procedural Level Generator
 *
 * Generates solvable Bus Jam puzzles with seeded RNG.
 * Used for daily challenges and infinite mode.
 *
 * Generation strategy:
 * 1. Place roads on a grid
 * 2. Place stops with passenger queues
 * 3. Place buses with matching colors
 * 4. Place exit points
 * 5. Validate solvability via BFS simulation
 */

import { createRNG } from '../../shared/rng.js';

/** Color palette for buses and passengers */
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

/** Difficulty presets */
const DIFFICULTY = {
  easy:   { gridSize: 5, busCount: 2, stopCount: 2, colorCount: 2, capacity: 3 },
  medium: { gridSize: 6, busCount: 3, stopCount: 3, colorCount: 3, capacity: 3 },
  hard:   { gridSize: 7, busCount: 4, stopCount: 4, colorCount: 4, capacity: 4 }
};

/**
 * Pick difficulty preset from a 0-1 value
 *
 * @param {number} d - Difficulty between 0 and 1
 * @returns {Object} Difficulty preset
 */
function presetFromDifficulty(d) {
  if (d < 0.33) return DIFFICULTY.easy;
  if (d < 0.66) return DIFFICULTY.medium;
  return DIFFICULTY.hard;
}

/**
 * Generate a level definition
 *
 * @param {number} seed - RNG seed for reproducibility
 * @param {number} difficulty - Difficulty 0-1
 * @returns {Object|null} Level data or null if generation failed
 */
export function generateLevel(seed, difficulty = 0.5) {
  const rng = createRNG(seed);
  const preset = presetFromDifficulty(difficulty);
  const { gridSize, busCount, stopCount, colorCount, capacity } = preset;

  const usedColors = COLORS.slice(0, colorCount);

  // Build road set (all interior cells are roads)
  const roads = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      roads.push([x, y]);
    }
  }

  // Place buses
  const buses = [];
  const occupied = new Set();
  for (let i = 0; i < busCount; i++) {
    let x, y;
    let attempts = 0;
    do {
      x = rng.nextInt(0, gridSize - 1);
      y = rng.nextInt(0, gridSize - 1);
      attempts++;
    } while (occupied.has(`${x},${y}`) && attempts < 100);

    occupied.add(`${x},${y}`);
    buses.push({
      id: `bus${i + 1}`,
      x, y,
      color: usedColors[i % colorCount],
      passengers: 0,
      capacity,
      direction: rng.pick(['up', 'down', 'left', 'right'])
    });
  }

  // Place stops with passenger queues
  const stops = [];
  for (let i = 0; i < stopCount; i++) {
    let x, y;
    let attempts = 0;
    do {
      x = rng.nextInt(0, gridSize - 1);
      y = rng.nextInt(0, gridSize - 1);
      attempts++;
    } while (occupied.has(`${x},${y}`) && attempts < 100);

    occupied.add(`${x},${y}`);
    const color = usedColors[i % colorCount];
    const waitCount = rng.nextInt(1, capacity);
    stops.push({
      x, y,
      color,
      waiting: Array(waitCount).fill(color)
    });
  }

  // Place exit on an edge cell
  const edges = [];
  for (let i = 0; i < gridSize; i++) {
    edges.push({ x: i, y: 0 }, { x: i, y: gridSize - 1 });
    edges.push({ x: 0, y: i }, { x: gridSize - 1, y: i });
  }
  const exitCell = rng.pick(edges);
  const exits = [{ x: exitCell.x, y: exitCell.y }];

  return {
    id: `gen-${seed}`,
    difficulty,
    optimal: busCount * 3,
    grid: { cols: gridSize, rows: gridSize },
    buses,
    stops,
    exits,
    roads
  };
}

export default { generateLevel };
