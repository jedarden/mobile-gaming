#!/usr/bin/env node
/**
 * Level Curation Pipeline
 *
 * Creates individual level files in levels/<game>/ from existing and new levels.
 * Also updates src/games/<game>/levels.json to include all curated levels.
 *
 * Run: node scripts/curate-levels.js
 */

import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateBatch as generateMergeBatch } from '../src/games/merge-games/generator.js';
import { generateBatch as generateAsmrBatch } from '../src/games/satisfying-asmr/generator.js';
import { generateLevel as generateWaterSortLevel } from '../src/games/water-sort/generator.js';
import { solve as solveWaterSort, createInitialState as createWaterSortState, pour as pourWaterSort, checkWin as checkWaterSortWin } from '../src/games/water-sort/state.js';
import { generateBatch as generateParkingBatch } from '../src/games/parking-escape/generator.js';
import { solve as solveParking, createInitialState as createParkingState, applyMove as applyParkingMove, checkWin as checkParkingWin } from '../src/games/parking-escape/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LEVELS_DIR = join(ROOT, 'levels');
const SRC_GAMES = join(ROOT, 'src/games');

function ensure(dir) { mkdirSync(dir, { recursive: true }); }
function writeJSON(path, data) { writeFileSync(path, JSON.stringify(data, null, 2) + '\n'); }
function readLevels(game) {
  return JSON.parse(readFileSync(join(SRC_GAMES, game, 'levels.json'), 'utf-8'));
}

/**
 * Serialize water-sort tube state to canonical string for deduplication.
 * Tubes are sorted by content to ensure equivalent states have same key.
 *
 * @param {Array} tubes - Array of tube objects (from state) or string arrays (from level)
 * @returns {string} Canonical serialized state
 */
function serializeWaterSortState(tubes) {
  // Handle both tube objects (from state) and plain arrays (from level data)
  const normalized = tubes.map(t => {
    if (Array.isArray(t)) {
      return t.join(':');
    }
    return t.segments.join(':');
  });
  normalized.sort();
  return normalized.join('|');
}

/**
 * Serialize parking-escape vehicle positions to canonical string.
 *
 * @param {Array} vehicles - Array of vehicle objects
 * @returns {string} Canonical serialized state
 */
function serializeParkingState(vehicles) {
  // Sort by ID to ensure equivalent states have same key
  const normalized = vehicles.map(v => `${v.id}:${v.x},${v.y}`);
  normalized.sort();
  return normalized.join('|');
}

/**
 * Calculate intermediate state diversity for Water Sort.
 * Simulates the solution path and counts unique states visited.
 */
function calculateWaterSortDiversity(level, solution) {
  if (!solution || !solution.path || solution.path.length === 0) return 0;

  const state = createWaterSortState(level);
  const uniqueStates = new Set();
  uniqueStates.add(serializeWaterSortState(state.tubes));

  let currentState = state;
  for (const [fromIdx, toIdx] of solution.path) {
    currentState = pourWaterSort(currentState, fromIdx, toIdx);
    uniqueStates.add(serializeWaterSortState(currentState.tubes));
    if (checkWaterSortWin(currentState)) break;
  }

  return uniqueStates.size;
}

/**
 * Calculate intermediate state diversity for Parking Escape.
 * Simulates the solution path and counts unique vehicle configurations.
 */
function calculateParkingDiversity(level, solution) {
  if (!solution || !solution.path || solution.path.length === 0) return 0;

  const state = createParkingState(level);
  const uniqueStates = new Set();
  uniqueStates.add(serializeParkingState(state.vehicles));

  let currentState = state;
  for (const move of solution.path) {
    currentState = applyParkingMove(currentState, move.vehicleId, move.direction, move.distance);
    uniqueStates.add(serializeParkingState(currentState.vehicles));
    if (checkParkingWin(currentState)) break;
  }

  return uniqueStates.size;
}

/**
 * Generate and rank levels for Water Sort.
 * Pipeline: generate 200 per tier → solve → rank by (move count, diversity) → pick top 30 across all tiers
 *
 * This is the plan-required "Generate-200-and-Rank" pipeline.
 */
function generateAndRankWaterSort() {
  console.log('\n── Water Sort: Generate-200-and-Rank Pipeline ──');

  const tiers = [
    { name: 'easy',   difficulty: 0.2, count: 200, maxMoves: 50 },
    { name: 'medium', difficulty: 0.5, count: 200, maxMoves: 80 },
    { name: 'hard',   difficulty: 0.8, count: 200, maxMoves: 120 }
  ];

  const allCandidates = [];
  let globalIndex = 1;

  for (const tier of tiers) {
    console.log(`  Generating ${tier.count} ${tier.name} levels (maxMoves=${tier.maxMoves})...`);
    const candidates = [];
    let seed = 1000;
    let solved = 0;
    let unsolved = 0;
    let invalid = 0;

    for (let i = 0; i < tier.count; i++) {
      const level = generateWaterSortLevel(seed, tier.difficulty);
      if (!level) {
        invalid++;
        seed++;
        continue;
      }

      const solution = solveWaterSort(level, tier.maxMoves);
      if (!solution) {
        unsolved++;
        seed++;
        continue;
      }

      solved++;
      const optimalMoves = solution.cost;
      const diversity = calculateWaterSortDiversity(level, solution);

      candidates.push({
        level: {
          ...level,
          id: `ws-${String(globalIndex).padStart(3, '0')}`,
          optimal: optimalMoves,
          difficulty: tier.difficulty
        },
        optimalMoves,
        diversity,
        tier: tier.name
      });

      seed++;
      globalIndex++;

      // Progress logging every 10 levels
      if ((i + 1) % 10 === 0) {
        console.log(`    Progress: ${i + 1}/${tier.count} (solved: ${solved}, unsolved: ${unsolved}, invalid: ${invalid})`);
      }
    }

    console.log(`    Tier complete: ${solved} solved, ${unsolved} unsolved (>${tier.maxMoves} moves), ${invalid} invalid`);
    console.log(`    Generated ${candidates.length} valid ${tier.name} levels`);

    // Sort by optimal moves (ascending) then by diversity (descending)
    candidates.sort((a, b) => {
      if (a.optimalMoves !== b.optimalMoves) {
        return a.optimalMoves - b.optimalMoves;
      }
      return b.diversity - a.diversity;
    });

    console.log(`    Tier ${tier.name} candidates (moves: ${candidates[0]?.optimalMoves}-${candidates[candidates.length-1]?.optimalMoves}, diversity: ${candidates[0]?.diversity}-${candidates[candidates.length-1]?.diversity})`);
    allCandidates.push(...candidates);
  }

  // Sort all candidates across tiers by optimal moves (ascending) then by diversity (descending)
  allCandidates.sort((a, b) => {
    if (a.optimalMoves !== b.optimalMoves) {
      return a.optimalMoves - b.optimalMoves;
    }
    return b.diversity - a.diversity;
  });

  // Pick top 30 across all tiers
  const selected = allCandidates.slice(0, 30);
  console.log(`    Selected top ${selected.length} levels across all tiers (moves: ${selected[0]?.optimalMoves}-${selected[selected.length-1]?.optimalMoves}, diversity: ${selected[0]?.diversity}-${selected[selected.length-1]?.diversity})`);

  return selected.map(c => c.level);
}

/**
 * Generate and rank levels for Parking Escape.
 * Pipeline: generate 200 per tier → solve → rank by (move count, diversity) → pick top 30 across all tiers
 *
 * This is the plan-required "Generate-200-and-Rank" pipeline. Parking escape solver
 * is faster than water-sort, so we can use higher limits.
 */
function generateAndRankParkingEscape() {
  console.log('\n── Parking Escape: Generate-200-and-Rank Pipeline ──');

  const tiers = [
    { name: 'easy',   difficulty: 'easy',   count: 200, maxMoves: 50 },
    { name: 'medium', difficulty: 'medium', count: 200, maxMoves: 100 },
    { name: 'hard',   difficulty: 'hard',   count: 200, maxMoves: 150 }
  ];

  const allCandidates = [];
  let globalIndex = 1;

  for (const tier of tiers) {
    console.log(`  Generating ${tier.count} ${tier.name} levels (maxMoves=${tier.maxMoves})...`);

    // Use generateBatch from parking-escape generator
    const levels = generateParkingBatch(5000, tier.difficulty, tier.count);

    const candidates = [];
    let solved = 0;
    let unsolved = 0;
    let invalid = 0;

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      if (!level || !level.targetMoves) {
        invalid++;
        continue;
      }

      // generateBatch already runs the solver, so targetMoves is the optimal move count
      // Run solver again to get path for diversity calculation
      const solution = solveParking(level, tier.maxMoves);
      if (!solution) {
        unsolved++;
        continue;
      }

      solved++;
      const optimalMoves = solution.cost;
      const diversity = calculateParkingDiversity(level, solution);

      candidates.push({
        level: {
          ...level,
          id: `pe-${String(globalIndex).padStart(3, '0')}`
        },
        optimalMoves,
        diversity,
        tier: tier.name
      });

      globalIndex++;

      // Progress logging every 10 levels
      if ((i + 1) % 10 === 0) {
        console.log(`    Progress: ${i + 1}/${levels.length} (solved: ${solved}, unsolved: ${unsolved}, invalid: ${invalid})`);
      }
    }

    console.log(`    Tier complete: ${solved} solved, ${unsolved} unsolved (>${tier.maxMoves} moves), ${invalid} invalid`);
    console.log(`    Generated ${candidates.length} valid ${tier.name} levels`);

    // Sort by optimal moves (ascending) then by diversity (descending)
    candidates.sort((a, b) => {
      if (a.optimalMoves !== b.optimalMoves) {
        return a.optimalMoves - b.optimalMoves;
      }
      return b.diversity - a.diversity;
    });

    console.log(`    Tier ${tier.name} candidates (moves: ${candidates[0]?.optimalMoves}-${candidates[candidates.length-1]?.optimalMoves}, diversity: ${candidates[0]?.diversity}-${candidates[candidates.length-1]?.diversity})`);
    allCandidates.push(...candidates);
  }

  // Sort all candidates across tiers by optimal moves (ascending) then by diversity (descending)
  allCandidates.sort((a, b) => {
    if (a.optimalMoves !== b.optimalMoves) {
      return a.optimalMoves - b.optimalMoves;
    }
    return b.diversity - a.diversity;
  });

  // Pick top 30 across all tiers
  const selected = allCandidates.slice(0, 30);
  console.log(`    Selected top ${selected.length} levels across all tiers (moves: ${selected[0]?.optimalMoves}-${selected[selected.length-1]?.optimalMoves}, diversity: ${selected[0]?.diversity}-${selected[selected.length-1]?.diversity})`);

  return selected.map(c => c.level);
}

/**
 * Write individual level files to levels/<game>/ and update src/games/<game>/levels.json
 */
function commitLevels(game, levels) {
  const dir = join(LEVELS_DIR, game);
  ensure(dir);
  for (const level of levels) {
    const id = level.id ?? String(level.id);
    writeJSON(join(dir, `${id}.json`), level);
  }
  writeJSON(join(SRC_GAMES, game, 'levels.json'), levels);
  console.log(`${game}: ${levels.length} levels written`);
}

// ─── WATER SORT ──────────────────────────────────────────────────────────────
// Generate-200-and-Rank Pipeline: generate 200 per tier, solve, rank, pick top 30 across all tiers

const wsLevels = generateAndRankWaterSort();
commitLevels('water-sort', wsLevels);

// ─── PULL THE PIN ─────────────────────────────────────────────────────────────
// Current: 5 levels (ptp-001..ptp-005). Target: 20.
// Adding 15 more levels of increasing complexity.

const ptpNewLevels = [
  {
    "id": "ptp-006",
    "pins": [
      { "id": "p1", "x": 80, "y": 180 },
      { "id": "p2", "x": 240, "y": 180 }
    ],
    "balls": [
      { "id": "b1", "x": 80, "y": 40, "color": "red" },
      { "id": "b2", "x": 240, "y": 40, "color": "blue" }
    ],
    "cups": [
      { "id": "c1", "x": 210, "y": 400, "width": 60, "height": 60, "acceptColor": "red" },
      { "id": "c2", "x": 50, "y": 400, "width": 60, "height": 60, "acceptColor": "blue" }
    ],
    "channels": [
      { "segments": [[80, 60, 80, 180], [80, 180, 240, 400]], "blockedByPin": "p1" },
      { "segments": [[240, 60, 240, 180], [240, 180, 80, 400]], "blockedByPin": "p2" }
    ],
    "difficulty": 2
  },
  {
    "id": "ptp-007",
    "pins": [
      { "id": "p1", "x": 160, "y": 160 },
      { "id": "p2", "x": 80, "y": 300 },
      { "id": "p3", "x": 240, "y": 300 }
    ],
    "balls": [
      { "id": "b1", "x": 160, "y": 40, "color": "green" }
    ],
    "cups": [
      { "id": "c1", "x": 130, "y": 400, "width": 60, "height": 60, "acceptColor": "green" }
    ],
    "channels": [
      { "segments": [[160, 60, 160, 160], [160, 160, 160, 400]], "blockedByPin": "p1" }
    ],
    "difficulty": 2
  },
  {
    "id": "ptp-008",
    "pins": [
      { "id": "p1", "x": 80, "y": 150 },
      { "id": "p2", "x": 160, "y": 200 },
      { "id": "p3", "x": 240, "y": 150 }
    ],
    "balls": [
      { "id": "b1", "x": 80, "y": 40, "color": "red" },
      { "id": "b2", "x": 160, "y": 40, "color": "green" },
      { "id": "b3", "x": 240, "y": 40, "color": "blue" }
    ],
    "cups": [
      { "id": "c1", "x": 50, "y": 400, "width": 50, "height": 60, "acceptColor": "red" },
      { "id": "c2", "x": 130, "y": 400, "width": 50, "height": 60, "acceptColor": "green" },
      { "id": "c3", "x": 220, "y": 400, "width": 50, "height": 60, "acceptColor": "blue" }
    ],
    "channels": [
      { "segments": [[80, 60, 80, 150], [80, 150, 80, 400]], "blockedByPin": "p1" },
      { "segments": [[160, 60, 160, 200], [160, 200, 160, 400]], "blockedByPin": "p2" },
      { "segments": [[240, 60, 240, 150], [240, 150, 240, 400]], "blockedByPin": "p3" }
    ],
    "difficulty": 2
  },
  {
    "id": "ptp-009",
    "pins": [
      { "id": "p1", "x": 120, "y": 130 },
      { "id": "p2", "x": 200, "y": 260 }
    ],
    "balls": [
      { "id": "b1", "x": 80, "y": 40, "color": "red" },
      { "id": "b2", "x": 240, "y": 40, "color": "red" }
    ],
    "cups": [
      { "id": "c1", "x": 130, "y": 400, "width": 60, "height": 60, "acceptColor": "red" }
    ],
    "channels": [
      { "segments": [[80, 60, 80, 130], [80, 130, 160, 260]], "blockedByPin": "p1" },
      { "segments": [[240, 60, 240, 260], [240, 260, 160, 400]], "blockedByPin": "p2" },
      { "segments": [[160, 260, 160, 400]], "blockedByPin": "p2" }
    ],
    "difficulty": 3
  },
  {
    "id": "ptp-010",
    "pins": [
      { "id": "p1", "x": 100, "y": 120 },
      { "id": "p2", "x": 220, "y": 120 },
      { "id": "p3", "x": 160, "y": 250 },
      { "id": "p4", "x": 50, "y": 250 }
    ],
    "balls": [
      { "id": "b1", "x": 100, "y": 40, "color": "red" },
      { "id": "b2", "x": 220, "y": 40, "color": "blue" }
    ],
    "cups": [
      { "id": "c1", "x": 70, "y": 400, "width": 55, "height": 60, "acceptColor": "red" },
      { "id": "c2", "x": 195, "y": 400, "width": 55, "height": 60, "acceptColor": "blue" }
    ],
    "channels": [
      { "segments": [[100, 60, 100, 120], [100, 120, 100, 400]], "blockedByPin": "p1" },
      { "segments": [[220, 60, 220, 120], [220, 120, 220, 400]], "blockedByPin": "p2" }
    ],
    "difficulty": 3
  },
  {
    "id": "ptp-011",
    "pins": [
      { "id": "p1", "x": 80, "y": 140 },
      { "id": "p2", "x": 200, "y": 140 },
      { "id": "p3", "x": 140, "y": 280 }
    ],
    "balls": [
      { "id": "b1", "x": 80, "y": 40, "color": "red" },
      { "id": "b2", "x": 200, "y": 40, "color": "blue" },
      { "id": "b3", "x": 140, "y": 40, "color": "green" }
    ],
    "cups": [
      { "id": "c1", "x": 50, "y": 400, "width": 50, "height": 60, "acceptColor": "red" },
      { "id": "c2", "x": 225, "y": 400, "width": 50, "height": 60, "acceptColor": "blue" },
      { "id": "c3", "x": 110, "y": 400, "width": 50, "height": 60, "acceptColor": "green" }
    ],
    "channels": [
      { "segments": [[80, 60, 80, 140], [80, 140, 80, 400]], "blockedByPin": "p1" },
      { "segments": [[200, 60, 200, 140], [200, 140, 200, 400]], "blockedByPin": "p2" },
      { "segments": [[140, 60, 140, 280], [140, 280, 140, 400]], "blockedByPin": "p3" }
    ],
    "difficulty": 3
  },
  {
    "id": "ptp-012",
    "pins": [
      { "id": "p1", "x": 90, "y": 110 },
      { "id": "p2", "x": 230, "y": 110 },
      { "id": "p3", "x": 90, "y": 260 },
      { "id": "p4", "x": 230, "y": 260 }
    ],
    "balls": [
      { "id": "b1", "x": 70, "y": 40, "color": "red" },
      { "id": "b2", "x": 250, "y": 40, "color": "blue" },
      { "id": "b3", "x": 160, "y": 40, "color": "green" }
    ],
    "cups": [
      { "id": "c1", "x": 40, "y": 400, "width": 50, "height": 60, "acceptColor": "red" },
      { "id": "c2", "x": 225, "y": 400, "width": 50, "height": 60, "acceptColor": "blue" },
      { "id": "c3", "x": 130, "y": 400, "width": 50, "height": 60, "acceptColor": "green" }
    ],
    "channels": [
      { "segments": [[70, 60, 70, 110], [70, 110, 70, 400]], "blockedByPin": "p1" },
      { "segments": [[250, 60, 250, 110], [250, 110, 250, 400]], "blockedByPin": "p2" },
      { "segments": [[160, 60, 160, 400]], "blockedByPin": "p3" }
    ],
    "difficulty": 3
  },
  {
    "id": "ptp-013",
    "pins": [
      { "id": "p1", "x": 100, "y": 160 },
      { "id": "p2", "x": 220, "y": 160 },
      { "id": "p3", "x": 160, "y": 300 }
    ],
    "balls": [
      { "id": "b1", "x": 100, "y": 40, "color": "yellow" },
      { "id": "b2", "x": 220, "y": 40, "color": "purple" }
    ],
    "cups": [
      { "id": "c1", "x": 70, "y": 400, "width": 60, "height": 60, "acceptColor": "yellow" },
      { "id": "c2", "x": 190, "y": 400, "width": 60, "height": 60, "acceptColor": "purple" }
    ],
    "channels": [
      { "segments": [[100, 60, 100, 160], [100, 160, 100, 400]], "blockedByPin": "p1" },
      { "segments": [[220, 60, 220, 160], [220, 160, 220, 400]], "blockedByPin": "p2" }
    ],
    "difficulty": 3
  },
  {
    "id": "ptp-014",
    "pins": [
      { "id": "p1", "x": 80, "y": 130 },
      { "id": "p2", "x": 160, "y": 200 },
      { "id": "p3", "x": 240, "y": 130 },
      { "id": "p4", "x": 160, "y": 340 }
    ],
    "balls": [
      { "id": "b1", "x": 80, "y": 40, "color": "red" },
      { "id": "b2", "x": 240, "y": 40, "color": "red" },
      { "id": "b3", "x": 160, "y": 40, "color": "blue" },
      { "id": "b4", "x": 160, "y": 40, "color": "blue" }
    ],
    "cups": [
      { "id": "c1", "x": 70, "y": 400, "width": 60, "height": 60, "acceptColor": "red" },
      { "id": "c2", "x": 190, "y": 400, "width": 60, "height": 60, "acceptColor": "blue" }
    ],
    "channels": [
      { "segments": [[80, 60, 80, 130], [80, 130, 100, 400]], "blockedByPin": "p1" },
      { "segments": [[240, 60, 240, 130], [240, 130, 100, 400]], "blockedByPin": "p3" },
      { "segments": [[160, 60, 160, 200], [160, 200, 160, 400]], "blockedByPin": "p2" }
    ],
    "difficulty": 4
  },
  {
    "id": "ptp-015",
    "pins": [
      { "id": "p1", "x": 70, "y": 100 },
      { "id": "p2", "x": 160, "y": 100 },
      { "id": "p3", "x": 250, "y": 100 },
      { "id": "p4", "x": 115, "y": 240 },
      { "id": "p5", "x": 205, "y": 240 }
    ],
    "balls": [
      { "id": "b1", "x": 70, "y": 40, "color": "red" },
      { "id": "b2", "x": 160, "y": 40, "color": "green" },
      { "id": "b3", "x": 250, "y": 40, "color": "blue" }
    ],
    "cups": [
      { "id": "c1", "x": 40, "y": 400, "width": 50, "height": 60, "acceptColor": "red" },
      { "id": "c2", "x": 130, "y": 400, "width": 50, "height": 60, "acceptColor": "green" },
      { "id": "c3", "x": 220, "y": 400, "width": 50, "height": 60, "acceptColor": "blue" }
    ],
    "channels": [
      { "segments": [[70, 60, 70, 100], [70, 100, 70, 400]], "blockedByPin": "p1" },
      { "segments": [[160, 60, 160, 100], [160, 100, 160, 400]], "blockedByPin": "p2" },
      { "segments": [[250, 60, 250, 100], [250, 100, 250, 400]], "blockedByPin": "p3" }
    ],
    "difficulty": 4
  },
  {
    "id": "ptp-016",
    "pins": [
      { "id": "p1", "x": 80, "y": 120 },
      { "id": "p2", "x": 240, "y": 120 },
      { "id": "p3", "x": 80, "y": 270 },
      { "id": "p4", "x": 240, "y": 270 }
    ],
    "balls": [
      { "id": "b1", "x": 80, "y": 40, "color": "orange" },
      { "id": "b2", "x": 240, "y": 40, "color": "purple" },
      { "id": "b3", "x": 160, "y": 40, "color": "orange" },
      { "id": "b4", "x": 160, "y": 40, "color": "purple" }
    ],
    "cups": [
      { "id": "c1", "x": 50, "y": 400, "width": 60, "height": 60, "acceptColor": "orange" },
      { "id": "c2", "x": 210, "y": 400, "width": 60, "height": 60, "acceptColor": "purple" }
    ],
    "channels": [
      { "segments": [[80, 60, 80, 120], [80, 120, 80, 270], [80, 270, 80, 400]], "blockedByPin": "p1" },
      { "segments": [[240, 60, 240, 120], [240, 120, 240, 270], [240, 270, 240, 400]], "blockedByPin": "p2" },
      { "segments": [[160, 60, 160, 400]], "blockedByPin": "p3" }
    ],
    "difficulty": 4
  },
  {
    "id": "ptp-017",
    "pins": [
      { "id": "p1", "x": 90, "y": 110 },
      { "id": "p2", "x": 230, "y": 110 },
      { "id": "p3", "x": 90, "y": 240 },
      { "id": "p4", "x": 230, "y": 240 },
      { "id": "p5", "x": 160, "y": 170 }
    ],
    "balls": [
      { "id": "b1", "x": 90, "y": 40, "color": "red" },
      { "id": "b2", "x": 230, "y": 40, "color": "blue" },
      { "id": "b3", "x": 160, "y": 40, "color": "green" }
    ],
    "cups": [
      { "id": "c1", "x": 55, "y": 400, "width": 55, "height": 60, "acceptColor": "red" },
      { "id": "c2", "x": 195, "y": 400, "width": 55, "height": 60, "acceptColor": "blue" },
      { "id": "c3", "x": 125, "y": 400, "width": 55, "height": 60, "acceptColor": "green" }
    ],
    "channels": [
      { "segments": [[90, 60, 90, 110], [90, 110, 90, 400]], "blockedByPin": "p1" },
      { "segments": [[230, 60, 230, 110], [230, 110, 230, 400]], "blockedByPin": "p2" },
      { "segments": [[160, 60, 160, 170], [160, 170, 160, 400]], "blockedByPin": "p5" }
    ],
    "difficulty": 4
  },
  {
    "id": "ptp-018",
    "pins": [
      { "id": "p1", "x": 75, "y": 100 },
      { "id": "p2", "x": 160, "y": 100 },
      { "id": "p3", "x": 245, "y": 100 },
      { "id": "p4", "x": 115, "y": 230 },
      { "id": "p5", "x": 205, "y": 230 }
    ],
    "balls": [
      { "id": "b1", "x": 75, "y": 40, "color": "cyan" },
      { "id": "b2", "x": 160, "y": 40, "color": "pink" },
      { "id": "b3", "x": 245, "y": 40, "color": "yellow" },
      { "id": "b4", "x": 115, "y": 40, "color": "cyan" }
    ],
    "cups": [
      { "id": "c1", "x": 45, "y": 400, "width": 50, "height": 60, "acceptColor": "cyan" },
      { "id": "c2", "x": 125, "y": 400, "width": 50, "height": 60, "acceptColor": "pink" },
      { "id": "c3", "x": 215, "y": 400, "width": 50, "height": 60, "acceptColor": "yellow" }
    ],
    "channels": [
      { "segments": [[75, 60, 75, 100], [75, 100, 75, 400]], "blockedByPin": "p1" },
      { "segments": [[160, 60, 160, 100], [160, 100, 160, 400]], "blockedByPin": "p2" },
      { "segments": [[245, 60, 245, 100], [245, 100, 245, 400]], "blockedByPin": "p3" },
      { "segments": [[115, 60, 115, 230], [115, 230, 75, 400]], "blockedByPin": "p4" }
    ],
    "difficulty": 5
  },
  {
    "id": "ptp-019",
    "pins": [
      { "id": "p1", "x": 70, "y": 90 },
      { "id": "p2", "x": 160, "y": 90 },
      { "id": "p3", "x": 250, "y": 90 },
      { "id": "p4", "x": 70, "y": 220 },
      { "id": "p5", "x": 250, "y": 220 }
    ],
    "balls": [
      { "id": "b1", "x": 70, "y": 40, "color": "red" },
      { "id": "b2", "x": 160, "y": 40, "color": "blue" },
      { "id": "b3", "x": 250, "y": 40, "color": "green" },
      { "id": "b4", "x": 115, "y": 40, "color": "yellow" }
    ],
    "cups": [
      { "id": "c1", "x": 40, "y": 400, "width": 48, "height": 60, "acceptColor": "red" },
      { "id": "c2", "x": 98, "y": 400, "width": 48, "height": 60, "acceptColor": "blue" },
      { "id": "c3", "x": 156, "y": 400, "width": 48, "height": 60, "acceptColor": "green" },
      { "id": "c4", "x": 214, "y": 400, "width": 48, "height": 60, "acceptColor": "yellow" }
    ],
    "channels": [
      { "segments": [[70, 60, 70, 90], [70, 90, 70, 220], [70, 220, 70, 400]], "blockedByPin": "p1" },
      { "segments": [[160, 60, 160, 90], [160, 90, 160, 400]], "blockedByPin": "p2" },
      { "segments": [[250, 60, 250, 90], [250, 90, 250, 220], [250, 220, 250, 400]], "blockedByPin": "p3" },
      { "segments": [[115, 60, 115, 400]], "blockedByPin": "p4" }
    ],
    "difficulty": 5
  },
  {
    "id": "ptp-020",
    "pins": [
      { "id": "p1", "x": 75, "y": 85 },
      { "id": "p2", "x": 160, "y": 85 },
      { "id": "p3", "x": 245, "y": 85 },
      { "id": "p4", "x": 75, "y": 210 },
      { "id": "p5", "x": 245, "y": 210 }
    ],
    "balls": [
      { "id": "b1", "x": 75, "y": 40, "color": "red" },
      { "id": "b2", "x": 160, "y": 40, "color": "blue" },
      { "id": "b3", "x": 245, "y": 40, "color": "green" },
      { "id": "b4", "x": 115, "y": 40, "color": "red" },
      { "id": "b5", "x": 205, "y": 40, "color": "blue" }
    ],
    "cups": [
      { "id": "c1", "x": 45, "y": 400, "width": 48, "height": 60, "acceptColor": "red" },
      { "id": "c2", "x": 103, "y": 400, "width": 48, "height": 60, "acceptColor": "blue" },
      { "id": "c3", "x": 161, "y": 400, "width": 48, "height": 60, "acceptColor": "green" },
      { "id": "c4", "x": 219, "y": 400, "width": 48, "height": 60, "acceptColor": "red" }
    ],
    "channels": [
      { "segments": [[75, 60, 75, 85], [75, 85, 75, 400]], "blockedByPin": "p1" },
      { "segments": [[160, 60, 160, 85], [160, 85, 160, 400]], "blockedByPin": "p2" },
      { "segments": [[245, 60, 245, 85], [245, 85, 245, 400]], "blockedByPin": "p3" },
      { "segments": [[115, 60, 115, 210], [115, 210, 75, 400]], "blockedByPin": "p4" },
      { "segments": [[205, 60, 205, 210], [205, 210, 245, 400]], "blockedByPin": "p5" }
    ],
    "difficulty": 5
  }
];

const ptpLevels = [...readLevels('pull-the-pin'), ...ptpNewLevels];
commitLevels('pull-the-pin', ptpLevels);

// ─── CROWD RUNNER ─────────────────────────────────────────────────────────────
// Current: 12 levels. Target: 20. Adding 8 hard levels.

const crNewLevels = [
  {
    "id": "cr-013",
    "startingCrowd": 10,
    "courseLength": 950,
    "speed": 2.7,
    "gates": [
      { "z": 80,  "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 8 } },
      { "z": 160, "left": { "op": "+", "value": 15 }, "right": { "op": "÷", "value": 2 } },
      { "z": 240, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 10 } },
      { "z": 320, "left": { "op": "+", "value": 20 }, "right": { "op": "−", "value": 8 } },
      { "z": 400, "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 5 } },
      { "z": 480, "left": { "op": "+", "value": 25 }, "right": { "op": "÷", "value": 3 } },
      { "z": 560, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 15 } },
      { "z": 640, "left": { "op": "+", "value": 30 }, "right": { "op": "−", "value": 20 } },
      { "z": 720, "left": { "op": "×", "value": 2 },  "right": { "op": "÷", "value": 4 } },
      { "z": 820, "left": { "op": "+", "value": 40 }, "right": { "op": "−", "value": 25 } }
    ],
    "boss": { "size": 600 },
    "difficulty": "hard"
  },
  {
    "id": "cr-014",
    "startingCrowd": 12,
    "courseLength": 1000,
    "speed": 2.8,
    "gates": [
      { "z": 80,  "left": { "op": "+", "value": 10 }, "right": { "op": "−", "value": 6 } },
      { "z": 160, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 8 } },
      { "z": 240, "left": { "op": "+", "value": 20 }, "right": { "op": "÷", "value": 2 } },
      { "z": 320, "left": { "op": "×", "value": 2 },  "right": { "op": "−", "value": 10 } },
      { "z": 400, "left": { "op": "+", "value": 30 }, "right": { "op": "÷", "value": 3 } },
      { "z": 480, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 12 } },
      { "z": 560, "left": { "op": "+", "value": 25 }, "right": { "op": "−", "value": 15 } },
      { "z": 640, "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 20 } },
      { "z": 720, "left": { "op": "+", "value": 35 }, "right": { "op": "÷", "value": 4 } },
      { "z": 830, "left": { "op": "×", "value": 2 },  "right": { "op": "−", "value": 30 } }
    ],
    "boss": { "size": 700 },
    "difficulty": "hard"
  },
  {
    "id": "cr-015",
    "startingCrowd": 15,
    "courseLength": 1050,
    "speed": 2.9,
    "gates": [
      { "z": 80,  "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 10 } },
      { "z": 160, "left": { "op": "+", "value": 20 }, "right": { "op": "−", "value": 8 } },
      { "z": 240, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 5 } },
      { "z": 320, "left": { "op": "+", "value": 15 }, "right": { "op": "÷", "value": 2 } },
      { "z": 400, "left": { "op": "×", "value": 2 },  "right": { "op": "−", "value": 12 } },
      { "z": 480, "left": { "op": "+", "value": 30 }, "right": { "op": "÷", "value": 3 } },
      { "z": 560, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 20 } },
      { "z": 640, "left": { "op": "+", "value": 25 }, "right": { "op": "−", "value": 18 } },
      { "z": 730, "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 15 } },
      { "z": 840, "left": { "op": "+", "value": 40 }, "right": { "op": "÷", "value": 5 } }
    ],
    "boss": { "size": 800 },
    "difficulty": "hard"
  },
  {
    "id": "cr-016",
    "startingCrowd": 10,
    "courseLength": 1100,
    "speed": 3.0,
    "gates": [
      { "z": 80,  "left": { "op": "+", "value": 12 }, "right": { "op": "−", "value": 5 } },
      { "z": 160, "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 8 } },
      { "z": 240, "left": { "op": "+", "value": 18 }, "right": { "op": "÷", "value": 2 } },
      { "z": 320, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 10 } },
      { "z": 400, "left": { "op": "+", "value": 25 }, "right": { "op": "−", "value": 10 } },
      { "z": 480, "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 15 } },
      { "z": 560, "left": { "op": "+", "value": 30 }, "right": { "op": "÷", "value": 3 } },
      { "z": 650, "left": { "op": "×", "value": 3 },  "right": { "op": "−", "value": 20 } },
      { "z": 750, "left": { "op": "+", "value": 50 }, "right": { "op": "÷", "value": 4 } },
      { "z": 860, "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 30 } }
    ],
    "boss": { "size": 900 },
    "difficulty": "hard"
  },
  {
    "id": "cr-017",
    "startingCrowd": 10,
    "courseLength": 1150,
    "speed": 3.1,
    "gates": [
      { "z": 80,  "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 5 } },
      { "z": 160, "left": { "op": "+", "value": 15 }, "right": { "op": "−", "value": 8 } },
      { "z": 240, "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 12 } },
      { "z": 330, "left": { "op": "+", "value": 20 }, "right": { "op": "÷", "value": 3 } },
      { "z": 420, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 8 } },
      { "z": 510, "left": { "op": "+", "value": 30 }, "right": { "op": "−", "value": 15 } },
      { "z": 600, "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 20 } },
      { "z": 690, "left": { "op": "+", "value": 40 }, "right": { "op": "÷", "value": 4 } },
      { "z": 780, "left": { "op": "×", "value": 3 },  "right": { "op": "−", "value": 25 } },
      { "z": 880, "left": { "op": "+", "value": 60 }, "right": { "op": "÷", "value": 5 } }
    ],
    "boss": { "size": 1000 },
    "difficulty": "hard"
  },
  {
    "id": "cr-018",
    "startingCrowd": 10,
    "courseLength": 1200,
    "speed": 3.2,
    "gates": [
      { "z": 90,  "left": { "op": "+", "value": 10 }, "right": { "op": "−", "value": 4 } },
      { "z": 180, "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 6 } },
      { "z": 270, "left": { "op": "+", "value": 15 }, "right": { "op": "−", "value": 8 } },
      { "z": 360, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 10 } },
      { "z": 450, "left": { "op": "+", "value": 20 }, "right": { "op": "÷", "value": 2 } },
      { "z": 540, "left": { "op": "×", "value": 2 },  "right": { "op": "−", "value": 12 } },
      { "z": 630, "left": { "op": "+", "value": 30 }, "right": { "op": "÷", "value": 3 } },
      { "z": 720, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 15 } },
      { "z": 810, "left": { "op": "+", "value": 45 }, "right": { "op": "−", "value": 20 } },
      { "z": 900, "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 25 } }
    ],
    "boss": { "size": 1100 },
    "difficulty": "hard"
  },
  {
    "id": "cr-019",
    "startingCrowd": 10,
    "courseLength": 1250,
    "speed": 3.3,
    "gates": [
      { "z": 90,  "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 8 } },
      { "z": 180, "left": { "op": "+", "value": 20 }, "right": { "op": "−", "value": 10 } },
      { "z": 270, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 5 } },
      { "z": 370, "left": { "op": "+", "value": 25 }, "right": { "op": "÷", "value": 2 } },
      { "z": 460, "left": { "op": "×", "value": 2 },  "right": { "op": "−", "value": 15 } },
      { "z": 555, "left": { "op": "+", "value": 35 }, "right": { "op": "÷", "value": 3 } },
      { "z": 650, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 20 } },
      { "z": 745, "left": { "op": "+", "value": 40 }, "right": { "op": "−", "value": 25 } },
      { "z": 840, "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 30 } },
      { "z": 950, "left": { "op": "+", "value": 50 }, "right": { "op": "÷", "value": 5 } }
    ],
    "boss": { "size": 1200 },
    "difficulty": "hard"
  },
  {
    "id": "cr-020",
    "startingCrowd": 10,
    "courseLength": 1300,
    "speed": 3.5,
    "gates": [
      { "z": 90,  "left": { "op": "+", "value": 15 }, "right": { "op": "−", "value": 5 } },
      { "z": 190, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 10 } },
      { "z": 290, "left": { "op": "+", "value": 25 }, "right": { "op": "÷", "value": 2 } },
      { "z": 390, "left": { "op": "×", "value": 2 },  "right": { "op": "−", "value": 20 } },
      { "z": 490, "left": { "op": "+", "value": 40 }, "right": { "op": "÷", "value": 3 } },
      { "z": 590, "left": { "op": "×", "value": 3 },  "right": { "op": "+", "value": 15 } },
      { "z": 690, "left": { "op": "+", "value": 30 }, "right": { "op": "−", "value": 25 } },
      { "z": 790, "left": { "op": "×", "value": 2 },  "right": { "op": "+", "value": 35 } },
      { "z": 890, "left": { "op": "+", "value": 50 }, "right": { "op": "÷", "value": 4 } },
      { "z": 1000,"left": { "op": "×", "value": 3 },  "right": { "op": "−", "value": 30 } }
    ],
    "boss": { "size": 1400 },
    "difficulty": "hard"
  }
];

const crLevels = [...readLevels('crowd-runner'), ...crNewLevels];
commitLevels('crowd-runner', crLevels);

// ─── GIANT RUNNER ─────────────────────────────────────────────────────────────
// Current: 20 levels. Target: 20. Just write to levels/ structure.
commitLevels('giant-runner', readLevels('giant-runner'));

// ─── JELLY SHIFT ─────────────────────────────────────────────────────────────
// Current: 15 levels. Target: 15. Just write to levels/ structure.
commitLevels('jelly-shift', readLevels('jelly-shift'));

// ─── MAKEOVER RUN ────────────────────────────────────────────────────────────
// Current: 12 levels. Target: 15. Adding 3 more (1 easy, 1 medium, 1 hard).

const mrNewLevels = [
  {
    "id": "mr-013",
    "courseLength": 250,
    "speed": 2.0,
    "stations": [
      { "z": 40,  "x": -1, "type": "hair",        "upgrade": 3, "positive": true },
      { "z": 40,  "x":  1, "type": "mud", "downgrade": "accessories", "amount": 1, "positive": false },
      { "z": 80,  "x":  1, "type": "makeup",       "upgrade": 3, "positive": true },
      { "z": 80,  "x": -1, "type": "mud", "downgrade": "hair",        "amount": 1, "positive": false },
      { "z": 120, "x": -1, "type": "outfit",       "upgrade": 2, "positive": true },
      { "z": 120, "x":  1, "type": "mud", "downgrade": "makeup",      "amount": 1, "positive": false },
      { "z": 160, "x":  1, "type": "accessories",  "upgrade": 2, "positive": true },
      { "z": 160, "x": -1, "type": "mud", "downgrade": "outfit",      "amount": 1, "positive": false },
      { "z": 200, "x": -1, "type": "hair",         "upgrade": 2, "positive": true },
      { "z": 200, "x":  1, "type": "mud", "downgrade": "makeup",      "amount": 1, "positive": false },
      { "z": 240, "x":  1, "type": "makeup",       "upgrade": 2, "positive": true },
      { "z": 240, "x": -1, "type": "mud", "downgrade": "accessories", "amount": 1, "positive": false }
    ],
    "difficulty": "easy"
  },
  {
    "id": "mr-014",
    "courseLength": 350,
    "speed": 2.3,
    "stations": [
      { "z": 45,  "x": -1, "type": "accessories",  "upgrade": 1, "positive": true },
      { "z": 45,  "x":  1, "type": "mud", "downgrade": "outfit",      "amount": 1, "positive": false },
      { "z": 90,  "x":  1, "type": "makeup",        "upgrade": 2, "positive": true },
      { "z": 90,  "x": -1, "type": "mud", "downgrade": "hair",        "amount": 1, "positive": false },
      { "z": 135, "x": -1, "type": "outfit",        "upgrade": 2, "positive": true },
      { "z": 135, "x":  1, "type": "mud", "downgrade": "accessories", "amount": 1, "positive": false },
      { "z": 180, "x":  1, "type": "hair",          "upgrade": 2, "positive": true },
      { "z": 180, "x": -1, "type": "mud", "downgrade": "makeup",      "amount": 1, "positive": false },
      { "z": 225, "x": -1, "type": "accessories",   "upgrade": 3, "positive": true },
      { "z": 225, "x":  1, "type": "mud", "downgrade": "outfit",      "amount": 2, "positive": false },
      { "z": 270, "x":  1, "type": "outfit",        "upgrade": 3, "positive": true },
      { "z": 270, "x": -1, "type": "mud", "downgrade": "hair",        "amount": 1, "positive": false },
      { "z": 315, "x": -1, "type": "makeup",        "upgrade": 3, "positive": true },
      { "z": 315, "x":  1, "type": "mud", "downgrade": "accessories", "amount": 1, "positive": false },
      { "z": 335, "x":  1, "type": "hair",          "upgrade": 3, "positive": true },
      { "z": 335, "x": -1, "type": "mud", "downgrade": "makeup",      "amount": 2, "positive": false }
    ],
    "difficulty": "medium"
  },
  {
    "id": "mr-015",
    "courseLength": 450,
    "speed": 2.6,
    "stations": [
      { "z": 60,  "x": -1, "type": "makeup",        "upgrade": 1, "positive": true },
      { "z": 60,  "x":  1, "type": "mud", "downgrade": "hair",        "amount": 2, "positive": false },
      { "z": 99,  "x":  1, "type": "accessories",   "upgrade": 1, "positive": true },
      { "z": 99,  "x": -1, "type": "mud", "downgrade": "outfit",      "amount": 2, "positive": false },
      { "z": 138, "x": -1, "type": "hair",          "upgrade": 2, "positive": true },
      { "z": 138, "x":  1, "type": "mud", "downgrade": "makeup",      "amount": 1, "positive": false },
      { "z": 177, "x":  1, "type": "outfit",        "upgrade": 2, "positive": true },
      { "z": 177, "x": -1, "type": "mud", "downgrade": "accessories", "amount": 2, "positive": false },
      { "z": 216, "x": -1, "type": "makeup",        "upgrade": 3, "positive": true },
      { "z": 216, "x":  1, "type": "mud", "downgrade": "hair",        "amount": 1, "positive": false },
      { "z": 255, "x":  1, "type": "accessories",   "upgrade": 3, "positive": true },
      { "z": 255, "x": -1, "type": "mud", "downgrade": "outfit",      "amount": 1, "positive": false },
      { "z": 294, "x": -1, "type": "hair",          "upgrade": 3, "positive": true },
      { "z": 294, "x":  1, "type": "mud", "downgrade": "makeup",      "amount": 2, "positive": false },
      { "z": 333, "x":  1, "type": "outfit",        "upgrade": 3, "positive": true },
      { "z": 333, "x": -1, "type": "mud", "downgrade": "accessories", "amount": 2, "positive": false },
      { "z": 372, "x": -1, "type": "hair",          "upgrade": 3, "positive": true },
      { "z": 372, "x":  1, "type": "mud", "downgrade": "makeup",      "amount": 3, "positive": false },
      { "z": 411, "x":  1, "type": "makeup",        "upgrade": 3, "positive": true },
      { "z": 411, "x": -1, "type": "mud", "downgrade": "outfit",      "amount": 3, "positive": false }
    ],
    "difficulty": "hard"
  }
];

const mrLevels = [...readLevels('makeover-run'), ...mrNewLevels];
commitLevels('makeover-run', mrLevels);

// ─── BRIDGE RACE ─────────────────────────────────────────────────────────────
// Current: 10 levels. Target: 15. Adding 5 more.

const brNewLevels = [
  {
    "id": "br-011",
    "arenaWidth": 24,
    "finishZ": 240,
    "playerColor": "blue",
    "opponents": [
      { "color": "red",   "x": 6,  "ai": "greedy" },
      { "color": "green", "x": -6, "ai": "greedy" }
    ],
    "bridges": [
      { "z": 50,  "required": 5 },
      { "z": 100, "required": 5 },
      { "z": 150, "required": 5 },
      { "z": 210, "required": 5 }
    ],
    "blockPiles": [
      { "x": -8, "z": 8,  "color": "blue",  "count": 9 },
      { "x": 8,  "z": 8,  "color": "red",   "count": 9 },
      { "x": 0,  "z": 8,  "color": "green", "count": 9 },
      { "x": 2,  "z": 28, "color": "blue",  "count": 9 },
      { "x": -6, "z": 70, "color": "blue",  "count": 9 },
      { "x": 7,  "z": 70, "color": "red",   "count": 9 },
      { "x": -7, "z": 70, "color": "green", "count": 9 },
      { "x": 4,  "z": 70, "color": "blue",  "count": 3 }
    ]
  },
  {
    "id": "br-012",
    "arenaWidth": 28,
    "finishZ": 260,
    "playerColor": "blue",
    "opponents": [
      { "color": "red",    "x": 7,  "ai": "greedy" },
      { "color": "green",  "x": -7, "ai": "greedy" },
      { "color": "yellow", "x": 0,  "ai": "random" }
    ],
    "bridges": [
      { "z": 55,  "required": 5 },
      { "z": 110, "required": 5 },
      { "z": 175, "required": 5 },
      { "z": 230, "required": 5 }
    ],
    "blockPiles": [
      { "x": -9,  "z": 8,  "color": "blue",   "count": 10 },
      { "x": 9,   "z": 8,  "color": "red",    "count": 10 },
      { "x": 0,   "z": 8,  "color": "green",  "count": 10 },
      { "x": -3,  "z": 8,  "color": "yellow", "count": 10 },
      { "x": 3,   "z": 30, "color": "blue",   "count": 10 },
      { "x": -7,  "z": 75, "color": "blue",   "count": 10 },
      { "x": 8,   "z": 75, "color": "red",    "count": 10 },
      { "x": -8,  "z": 75, "color": "green",  "count": 10 },
      { "x": 5,   "z": 75, "color": "blue",   "count": 2 }
    ]
  },
  {
    "id": "br-013",
    "arenaWidth": 28,
    "finishZ": 280,
    "playerColor": "blue",
    "opponents": [
      { "color": "red",    "x": 7,  "ai": "greedy" },
      { "color": "green",  "x": -7, "ai": "greedy" },
      { "color": "yellow", "x": 0,  "ai": "greedy" }
    ],
    "bridges": [
      { "z": 55,  "required": 6 },
      { "z": 115, "required": 6 },
      { "z": 185, "required": 6 },
      { "z": 245, "required": 6 }
    ],
    "blockPiles": [
      { "x": -9,  "z": 8,  "color": "blue",   "count": 12 },
      { "x": 9,   "z": 8,  "color": "red",    "count": 12 },
      { "x": -3,  "z": 8,  "color": "green",  "count": 12 },
      { "x": 3,   "z": 8,  "color": "yellow", "count": 12 },
      { "x": 0,   "z": 32, "color": "blue",   "count": 12 },
      { "x": -8,  "z": 80, "color": "blue",   "count": 12 },
      { "x": 8,   "z": 80, "color": "red",    "count": 12 },
      { "x": -9,  "z": 80, "color": "green",  "count": 12 },
      { "x": 6,   "z": 80, "color": "blue",   "count": 2 }
    ]
  },
  {
    "id": "br-014",
    "arenaWidth": 32,
    "finishZ": 300,
    "playerColor": "blue",
    "opponents": [
      { "color": "red",    "x": 8,  "ai": "greedy" },
      { "color": "green",  "x": -8, "ai": "greedy" },
      { "color": "yellow", "x": 0,  "ai": "greedy" }
    ],
    "bridges": [
      { "z": 60,  "required": 6 },
      { "z": 120, "required": 6 },
      { "z": 195, "required": 6 },
      { "z": 265, "required": 6 }
    ],
    "blockPiles": [
      { "x": -10, "z": 8,  "color": "blue",   "count": 14 },
      { "x": 10,  "z": 8,  "color": "red",    "count": 14 },
      { "x": -4,  "z": 8,  "color": "green",  "count": 14 },
      { "x": 4,   "z": 8,  "color": "yellow", "count": 14 },
      { "x": 0,   "z": 35, "color": "blue",   "count": 14 },
      { "x": -9,  "z": 85, "color": "blue",   "count": 14 },
      { "x": 9,   "z": 85, "color": "red",    "count": 14 },
      { "x": -10, "z": 85, "color": "green",  "count": 14 },
      { "x": 7,   "z": 85, "color": "blue",   "count": 2 }
    ]
  },
  {
    "id": "br-015",
    "arenaWidth": 32,
    "finishZ": 320,
    "playerColor": "blue",
    "opponents": [
      { "color": "red",    "x": 8,  "ai": "greedy" },
      { "color": "green",  "x": -8, "ai": "greedy" },
      { "color": "yellow", "x": 4,  "ai": "greedy" },
      { "color": "purple", "x": -4, "ai": "greedy" }
    ],
    "bridges": [
      { "z": 60,  "required": 7 },
      { "z": 130, "required": 7 },
      { "z": 210, "required": 7 },
      { "z": 285, "required": 7 }
    ],
    "blockPiles": [
      { "x": -10, "z": 8,  "color": "blue",   "count": 16 },
      { "x": 10,  "z": 8,  "color": "red",    "count": 16 },
      { "x": -5,  "z": 8,  "color": "green",  "count": 16 },
      { "x": 5,   "z": 8,  "color": "yellow", "count": 16 },
      { "x": 0,   "z": 8,  "color": "purple", "count": 16 },
      { "x": 0,   "z": 38, "color": "blue",   "count": 16 },
      { "x": -9,  "z": 90, "color": "blue",   "count": 16 },
      { "x": 9,   "z": 90, "color": "red",    "count": 16 },
      { "x": -10, "z": 90, "color": "green",  "count": 16 },
      { "x": 7,   "z": 90, "color": "blue",   "count": 2 }
    ]
  }
];

const brLevels = [...readLevels('bridge-race'), ...brNewLevels];
commitLevels('bridge-race', brLevels);

// ─── PARKING ESCAPE ──────────────────────────────────────────────────────────
// Generate-200-and-Rank Pipeline: generate 200 per tier, solve, rank, pick top 30

const peLevels = generateAndRankParkingEscape();

// Write individual parking-escape levels (no src/games entry since game not implemented)
const peDir = join(LEVELS_DIR, 'parking-escape');
ensure(peDir);
for (const level of peLevels) {
  writeJSON(join(peDir, `${level.id}.json`), level);
}
console.log(`parking-escape: ${peLevels.length} levels written`);

// ─── MERGE GAMES ─────────────────────────────────────────────────────────────
// Generate 15 levels: 5 easy, 5 medium, 5 hard
// Uses DFS solver to verify solvability; seed ranges chosen to avoid duplication.

const mgEasy   = generateMergeBatch(1001, 'easy',   5).map((l, i) => ({ ...l, id: `mg-${String(i + 1).padStart(3, '0')}`,  difficulty: 1 }));
const mgMedium = generateMergeBatch(2001, 'medium', 5).map((l, i) => ({ ...l, id: `mg-${String(i + 6).padStart(3, '0')}`,  difficulty: 2 }));
const mgHard   = generateMergeBatch(3001, 'hard',   5).map((l, i) => ({ ...l, id: `mg-${String(i + 11).padStart(3, '0')}`, difficulty: 3 }));
const mgLevels = [...mgEasy, ...mgMedium, ...mgHard];
commitLevels('merge-games', mgLevels);

// ─── SATISFYING ASMR ─────────────────────────────────────────────────────────
// Generate 10 levels: 4 easy, 3 medium, 3 hard
// All patterns trivially solvable; variety from pattern type and coverage.

const asmrEasy   = generateAsmrBatch(2001, 'easy',   4).map((l, i) => ({ ...l, id: `asmr-${String(i + 1).padStart(3, '0')}`, difficulty: 1 }));
const asmrMedium = generateAsmrBatch(3001, 'medium', 3).map((l, i) => ({ ...l, id: `asmr-${String(i + 5).padStart(3, '0')}`, difficulty: 2 }));
const asmrHard   = generateAsmrBatch(4001, 'hard',   3).map((l, i) => ({ ...l, id: `asmr-${String(i + 8).padStart(3, '0')}`, difficulty: 3 }));
const asmrLevels = [...asmrEasy, ...asmrMedium, ...asmrHard];
commitLevels('satisfying-asmr', asmrLevels);

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
const games = [
  { name: 'water-sort',        count: wsLevels.length },
  { name: 'pull-the-pin',      count: ptpLevels.length },
  { name: 'crowd-runner',      count: crLevels.length },
  { name: 'giant-runner',      count: readLevels('giant-runner').length },
  { name: 'jelly-shift',       count: readLevels('jelly-shift').length },
  { name: 'makeover-run',      count: mrLevels.length },
  { name: 'bridge-race',       count: brLevels.length },
  { name: 'parking-escape',    count: peLevels.length },
  { name: 'merge-games',       count: mgLevels.length },
  { name: 'satisfying-asmr',   count: asmrLevels.length },
  { name: 'brain-teaser',      count: 25 },   // already in levels/
  { name: 'save-the-character', count: 20 },  // already in levels/
];

const total = games.reduce((s, g) => s + g.count, 0);
console.log('\n─── Level Corpus Summary ─────────────────────────────');
for (const { name, count } of games) {
  console.log(`  ${name.padEnd(22)} ${count}`);
}
console.log(`  ${'TOTAL'.padEnd(22)} ${total}`);
console.log('─────────────────────────────────────────────────────');
