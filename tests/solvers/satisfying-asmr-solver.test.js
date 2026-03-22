/**
 * Satisfying ASMR - Solver Tests
 *
 * Systematic scan solver: spray left-to-right top-to-bottom in a grid.
 * Verifies all levels are completable within the playability bound.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { createInitialState, cleanArea, getProgress, isComplete, WIN_THRESHOLD } from '../../src/games/satisfying-asmr/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const levels = JSON.parse(
  readFileSync(join(__dirname, '../../src/games/satisfying-asmr/levels.json'), 'utf8')
);

const SPRAY_RADIUS = 2;
const MAX_SPRAYS = 5000;

/**
 * Systematic scan solver: spray every (stride) cell in row-major order.
 */
function scanSolve(level, radius = SPRAY_RADIUS) {
  let state = createInitialState(level);
  const stride = Math.max(1, Math.floor(radius));
  let sprays = 0;

  for (let gy = 0; gy < state.height && !isComplete(state); gy += stride) {
    for (let gx = 0; gx < state.width && !isComplete(state); gx += stride) {
      state = cleanArea(state, gx, gy, radius);
      sprays++;
      if (sprays >= MAX_SPRAYS) return { state, sprays };
    }
  }

  return { state, sprays };
}

describe('Satisfying ASMR Solver', () => {
  it('has at least 10 levels', () => {
    expect(levels.length).toBeGreaterThanOrEqual(10);
  });

  it('every level has cells and totalDirt', () => {
    for (const level of levels) {
      expect(level.cells).toBeDefined();
      expect(Array.isArray(level.cells)).toBe(true);
      expect(level.cells.length).toBe(level.width * level.height);
      expect(level.totalDirt).toBeGreaterThan(0);
    }
  });

  it('every level has >= 10% dirt coverage', () => {
    for (const level of levels) {
      const coverage = level.totalDirt / (level.width * level.height);
      expect(coverage).toBeGreaterThanOrEqual(0.1);
    }
  });

  for (const level of levels) {
    it(`level ${level.id} completes via systematic scan`, () => {
      const { state, sprays } = scanSolve(level);
      expect(isComplete(state)).toBe(true);
      expect(sprays).toBeLessThan(MAX_SPRAYS);
    });

    it(`level ${level.id} scan uses < 5000 sprays`, () => {
      const { sprays } = scanSolve(level);
      expect(sprays).toBeLessThan(MAX_SPRAYS);
    });
  }

  it('spray radius covers area proportional to radius', () => {
    const level = levels[0];
    let s0 = createInitialState(level);
    let s1 = cleanArea(s0, 8, 8, 1);
    let s2 = cleanArea(s0, 8, 8, 3);
    expect(s2.cleanedCount).toBeGreaterThan(s1.cleanedCount);
  });

  it('WIN_THRESHOLD allows completion before 100%', () => {
    expect(WIN_THRESHOLD).toBeLessThan(1.0);
    expect(WIN_THRESHOLD).toBeGreaterThanOrEqual(0.9);
  });
});
