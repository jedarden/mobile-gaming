/**
 * Parking Escape - Solver Tests
 *
 * For every hand-crafted level, verify:
 * 1. Level is solvable (solve returns non-null)
 * 2. Replaying the solution path reaches 'won' status
 * 3. Move count matches targetMoves (within tolerance)
 *
 * Also verifies generated levels (the generator uses BFS internally, so
 * generated levels are solvable by construction — these tests confirm that).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { createInitialState, applyMove, solve } from '../../src/games/parking-escape/state.js';
import { generateBatch, validateLevel } from '../../src/games/parking-escape/generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const levels = JSON.parse(
  readFileSync(join(__dirname, '../../src/games/parking-escape/levels.json'), 'utf8')
);

describe('Parking Escape Solver', () => {
  it('has at least 10 levels', () => {
    expect(levels.length).toBeGreaterThanOrEqual(10);
  });

  it('every level has a hero vehicle', () => {
    for (const level of levels) {
      const hero = level.grid.vehicles.find(v => v.type === 'hero');
      expect(hero).toBeDefined();
    }
  });

  it('every level has a valid exit', () => {
    for (const level of levels) {
      expect(level.grid.exit).toBeDefined();
      expect(level.grid.exit.direction).toBeDefined();
    }
  });

  it('no vehicle overlaps in initial state', () => {
    for (const level of levels) {
      const { width, height, vehicles } = level.grid;
      const occ = Array.from({ length: height }, () => Array(width).fill(null));
      let hasOverlap = false;
      for (const v of vehicles) {
        if (v.orientation === 'horizontal') {
          for (let dx = 0; dx < v.width; dx++) {
            const cx = v.x + dx;
            if (cx < width) {
              if (occ[v.y][cx]) hasOverlap = true;
              occ[v.y][cx] = v.id;
            }
          }
        } else {
          for (let dy = 0; dy < v.height; dy++) {
            const cy = v.y + dy;
            if (cy < height) {
              if (occ[cy][v.x]) hasOverlap = true;
              occ[cy][v.x] = v.id;
            }
          }
        }
      }
      expect(hasOverlap).toBe(false);
    }
  });

  for (const level of levels) {
    it(`level ${level.id} is solvable`, () => {
      const result = solve(level);
      expect(result).not.toBeNull();
    });

    it(`level ${level.id} solution replays to won`, () => {
      const result = solve(level);
      expect(result).not.toBeNull();
      let state = createInitialState(level);
      for (const move of result.path) {
        state = applyMove(state, move.vehicleId, move.direction, move.distance);
      }
      expect(state.status).toBe('won');
    });

    it(`level ${level.id} solver cost equals targetMoves`, () => {
      const result = solve(level);
      expect(result).not.toBeNull();
      expect(result.cost).toBe(level.targetMoves);
    });

    it(`level ${level.id} solution path contains only valid vehicle ids`, () => {
      const result = solve(level);
      expect(result).not.toBeNull();
      const validIds = new Set(level.grid.vehicles.map(v => v.id));
      for (const move of result.path) {
        expect(validIds.has(move.vehicleId)).toBe(true);
      }
    });

    it(`level ${level.id} solution uses at most maxMoves`, () => {
      const result = solve(level);
      expect(result).not.toBeNull();
      expect(result.cost).toBeLessThanOrEqual(level.maxMoves);
    });
  }

  it('hand-crafted levels cover easy through hard difficulty', () => {
    const difficulties = levels.map(l => l.difficulty);
    const min = Math.min(...difficulties);
    const max = Math.max(...difficulties);
    expect(min).toBeLessThanOrEqual(3);
    expect(max).toBeGreaterThanOrEqual(8);
  });
});

// ── Generated level solvability ────────────────────────────────────────────────
//
// The parking-escape generator runs BFS internally and only emits levels whose
// move count falls in the difficulty range. These tests confirm the end-to-end
// pipeline: generate → validateLevel → solve.
//
// Note: medium levels can take ~1-2s each for BFS (6×6 grid), so we test only
// a small batch. Easy levels are fast (<100ms each).

describe('Parking Escape — generated easy levels', () => {
  // Use seeds far from hand-crafted level seeds to avoid overlap
  const GEN_LEVELS = generateBatch(80000, 'easy', 4);

  it('generates 4 easy levels', () => {
    expect(GEN_LEVELS.length).toBe(4);
  });

  it('every generated easy level passes validateLevel', () => {
    for (const level of GEN_LEVELS) {
      const { valid, reason } = validateLevel(level);
      expect(valid, reason).toBe(true);
    }
  });

  it('every generated easy level has a hero vehicle', () => {
    for (const level of GEN_LEVELS) {
      const hero = level.grid.vehicles.find(v => v.type === 'hero');
      expect(hero).toBeDefined();
    }
  });

  for (let i = 0; i < 4; i++) {
    it(`generated easy level ${i} is BFS-solvable`, () => {
      const level = GEN_LEVELS[i];
      const result = solve(level);
      expect(result, `generated easy level ${i}: solve returned null`).not.toBeNull();
    });

    it(`generated easy level ${i} solution replays to won`, () => {
      const level = GEN_LEVELS[i];
      const result = solve(level);
      if (!result) return;
      let state = createInitialState(level);
      for (const move of result.path) {
        state = applyMove(state, move.vehicleId, move.direction, move.distance);
      }
      expect(state.status).toBe('won');
    });
  }
});

describe('Parking Escape — generated medium levels', () => {
  const GEN_LEVELS = generateBatch(90000, 'medium', 3);

  it('generates 3 medium levels', () => {
    expect(GEN_LEVELS.length).toBe(3);
  }, 60000);

  for (let i = 0; i < 3; i++) {
    it(`generated medium level ${i} is BFS-solvable`, () => {
      const level = GEN_LEVELS[i];
      const result = solve(level);
      expect(result, `generated medium level ${i}: solve returned null`).not.toBeNull();
    }, 30000);
  }
});
