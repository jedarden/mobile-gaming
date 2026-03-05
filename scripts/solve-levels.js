#!/usr/bin/env node
/**
 * Water Sort Level Solver & Generator
 * Uses BFS to find optimal solution for each level
 */

import { readFileSync, writeFileSync } from 'fs';

const TUBE_CAPACITY = 4;

/**
 * Create seeded random number generator (Mulberry32)
 */
function createRNG(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Deep clone tubes array
 */
function cloneTubes(tubes) {
  return tubes.map(tube => [...tube]);
}

/**
 * Get the top color of a tube
 */
function getTopColor(tube) {
  if (tube.length === 0) return null;
  return tube[tube.length - 1];
}

/**
 * Get count of same color segments at top of tube
 */
function getTopCount(tube) {
  if (tube.length === 0) return 0;
  const topColor = tube[tube.length - 1];
  let count = 0;
  for (let i = tube.length - 1; i >= 0; i--) {
    if (tube[i] === topColor) count++;
    else break;
  }
  return count;
}

/**
 * Check if a tube is complete (all same color and full)
 */
function isTubeComplete(tube) {
  if (tube.length !== TUBE_CAPACITY) return false;
  return tube.every(c => c === tube[0]);
}

/**
 * Check if a move is valid (for solving)
 */
function canMove(tubes, from, to) {
  const fromTube = tubes[from];
  const toTube = tubes[to];

  if (fromTube.length === 0) return false;
  if (toTube.length >= TUBE_CAPACITY) return false;
  if (isTubeComplete(fromTube)) return false;
  if (toTube.length === 0) return true;
  return getTopColor(fromTube) === getTopColor(toTube);
}

/**
 * Apply a move and return new tubes state
 */
function applyMove(tubes, from, to) {
  const newTubes = cloneTubes(tubes);
  const fromTube = newTubes[from];
  const toTube = newTubes[to];

  const topColor = getTopColor(fromTube);
  const topCount = getTopCount(fromTube);
  const availableSpace = TUBE_CAPACITY - toTube.length;
  const moveCount = Math.min(topCount, availableSpace);

  for (let i = 0; i < moveCount; i++) {
    fromTube.pop();
    toTube.push(topColor);
  }

  return newTubes;
}

/**
 * Convert tubes to a string key for visited set
 */
function tubesToKey(tubes) {
  return tubes.map(t => t.join(',')).join('|');
}

/**
 * Check if puzzle is solved
 */
function isSolved(tubes) {
  for (const tube of tubes) {
    if (tube.length === 0) continue;
    if (tube.length !== TUBE_CAPACITY) return false;
    const color = tube[0];
    if (!tube.every(c => c === color)) return false;
  }
  return true;
}

/**
 * Get all valid moves from current state
 */
function getValidMoves(tubes) {
  const moves = [];
  for (let from = 0; from < tubes.length; from++) {
    for (let to = 0; to < tubes.length; to++) {
      if (from !== to && canMove(tubes, from, to)) {
        moves.push({ from, to });
      }
    }
  }
  return moves;
}

/**
 * Solve level using BFS - returns minimum moves
 */
function solveLevel(tubes, maxMoves = 100) {
  const visited = new Set();
  const queue = [{ tubes: cloneTubes(tubes), moves: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    const key = tubesToKey(current.tubes);

    if (visited.has(key)) continue;
    visited.add(key);

    if (current.moves > maxMoves) continue;

    if (isSolved(current.tubes)) {
      return current.moves;
    }

    const validMoves = getValidMoves(current.tubes);
    for (const move of validMoves) {
      const newTubes = applyMove(current.tubes, move.from, move.to);
      const newKey = tubesToKey(newTubes);

      if (!visited.has(newKey)) {
        queue.push({ tubes: newTubes, moves: current.moves + 1 });
      }
    }
  }

  return -1;
}

/**
 * Generate a level by reverse solving
 * Start from solved state, then shuffle by doing reverse pours
 */
function generateLevel(seed, colorCount, emptyTubes) {
  const rng = createRNG(seed);
  const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
  const usedColors = colors.slice(0, colorCount);

  // Create solved state
  const tubes = [];
  for (let i = 0; i < colorCount; i++) {
    tubes.push(Array(TUBE_CAPACITY).fill(usedColors[i]));
  }
  for (let i = 0; i < emptyTubes; i++) {
    tubes.push([]);
  }

  // Shuffle by doing random reverse pours
  // A reverse pour takes from a tube and puts on another
  const shuffleMoves = 50 + Math.floor(rng() * 100);
  for (let i = 0; i < shuffleMoves; i++) {
    // Find non-empty tubes that aren't already complete
    const sources = [];
    for (let j = 0; j < tubes.length; j++) {
      if (tubes[j].length > 0) {
        sources.push(j);
      }
    }

    if (sources.length === 0) break;

    const fromIdx = sources[Math.floor(rng() * sources.length)];
    const fromTube = tubes[fromIdx];

    // Get the top color and count
    const topColor = fromTube[fromTube.length - 1];
    let topCount = 1;
    for (let j = fromTube.length - 2; j >= 0; j--) {
      if (fromTube[j] === topColor) topCount++;
      else break;
    }

    // Find valid destinations (not full, different tube)
    const dests = [];
    for (let j = 0; j < tubes.length; j++) {
      if (j !== fromIdx && tubes[j].length < TUBE_CAPACITY) {
        dests.push(j);
      }
    }

    if (dests.length === 0) break;

    const toIdx = dests[Math.floor(rng() * dests.length)];

    // Move some or all of the top segments
    const moveCount = Math.max(1, Math.min(topCount, Math.floor(rng() * 3) + 1));
    const actualMove = Math.min(moveCount, TUBE_CAPACITY - tubes[toIdx].length);

    for (let j = 0; j < actualMove; j++) {
      tubes[fromIdx].pop();
      tubes[toIdx].push(topColor);
    }
  }

  // Verify solvable
  const optimal = solveLevel(tubes);
  if (optimal === -1 || optimal < 3) {
    return generateLevel(seed + 1000, colorCount, emptyTubes);
  }

  return { tubes, optimal };
}

/**
 * Main verification and generation
 */
function main() {
  const levelsPath = new URL('../src/games/water-sort/levels.json', import.meta.url);
  const levels = JSON.parse(readFileSync(levelsPath, 'utf-8'));

  console.log(`Verifying ${levels.length} levels...\n`);

  const fixedLevels = [];
  let passed = 0;
  let fixed = 0;

  for (const level of levels) {
    const optimal = solveLevel(level.tubes);

    if (optimal === -1) {
      console.log(`Level ${level.id}: REGENERATING (was unsolvable)`);

      // Determine parameters based on difficulty/level number
      let colorCount, emptyTubes;
      if (level.id <= 10) {
        colorCount = 3;
        emptyTubes = 2;
      } else if (level.id <= 25) {
        colorCount = 4;
        emptyTubes = 2;
      } else if (level.id <= 40) {
        colorCount = 5;
        emptyTubes = 2;
      } else {
        colorCount = 5;
        emptyTubes = 2;
      }

      const generated = generateLevel(level.id * 1337, colorCount, emptyTubes);
      fixedLevels.push({
        id: level.id,
        difficulty: level.difficulty,
        optimal: generated.optimal,
        tubes: generated.tubes
      });
      fixed++;
      console.log(`  -> Fixed with optimal ${generated.optimal}`);
    } else if (optimal !== level.optimal) {
      console.log(`Level ${level.id}: Fixing optimal ${level.optimal} -> ${optimal}`);
      fixedLevels.push({
        ...level,
        optimal
      });
      passed++;
    } else {
      console.log(`Level ${level.id}: PASS (optimal ${optimal})`);
      fixedLevels.push(level);
      passed++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passed}/${levels.length}`);
  console.log(`Fixed: ${fixed}/${levels.length}`);

  // Write fixed levels
  fixedLevels.sort((a, b) => a.id - b.id);
  writeFileSync(levelsPath, JSON.stringify(fixedLevels, null, 2));
  console.log(`\nFixed levels written to ${levelsPath.pathname}`);
}

main();
