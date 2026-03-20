/**
 * Jelly Shift - Solver Test
 *
 * Validates all levels by:
 * 1. Computing valid width range for each wall
 * 2. Verifying overlap with blob deformation range [0.3, 3.0]
 * 3. Verifying transition time between consecutive walls
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { fitsHole, MIN_WIDTH, MAX_WIDTH, RESHAPE_SPEED, validateLevel } from '../../src/games/jelly-shift/state.js';
import { getValidWidthRange, isHoleAchievable, isTransitionAchievable } from '../../src/games/jelly-shift/generator.js';
import levels from '../../src/games/jelly-shift/levels.json';

const BASE_SPEED = 2.0;

describe('Jelly Shift Solver', () => {
  describe('Level Validation', () => {
    it('should validate all levels', () => {
      levels.forEach((level, index) => {
        const validation = validateLevel(level);
        expect(validation.valid, `Level ${index + 1} (${level.id}): ${validation.errors.join(', ')}`).toBe(true);
      });
    });

    it('should have unique level IDs', () => {
      const ids = levels.map(l => l.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have increasing difficulty', () => {
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i].difficulty).toBeGreaterThanOrEqual(levels[i - 1].difficulty);
      }
    });
  });

  describe('Wall Passability', () => {
    levels.forEach((level, levelIdx) => {
      describe(`Level ${levelIdx + 1} (id=${level.id})`, () => {
        level.walls.forEach((wall, wallIdx) => {
          it(`wall ${wallIdx} (z=${wall.z}, shape=${wall.hole.shape}) should be achievable`, () => {
            const achievable = isHoleAchievable(wall.hole);
            expect(achievable, `Level ${levelIdx + 1}, wall ${wallIdx}: hole not achievable`).toBe(true);

            // Verify valid width range overlaps with blob range
            const range = getValidWidthRange(wall.hole);
            expect(range.min, `Level ${levelIdx + 1}, wall ${wallIdx}: min > max`).toBeLessThanOrEqual(range.max);

            // At least one valid width must be within blob range
            const hasOverlap = range.min <= MAX_WIDTH && range.max >= MIN_WIDTH;
            expect(hasOverlap, `Level ${levelIdx + 1}, wall ${wallIdx}: no overlap with [${MIN_WIDTH}, ${MAX_WIDTH}]`).toBe(true);
          });
        });
      });
    });
  });

  describe('Transition Feasibility', () => {
    levels.forEach((level, levelIdx) => {
      describe(`Level ${levelIdx + 1} (id=${level.id})`, () => {
        for (let i = 1; i < level.walls.length; i++) {
          it(`transition wall ${i - 1} -> wall ${i} should be achievable`, () => {
            const prevWall = level.walls[i - 1];
            const currWall = level.walls[i];
            const spacing = currWall.z - prevWall.z;
            const speed = level.speed || BASE_SPEED;

            const achievable = isTransitionAchievable(prevWall.hole, currWall.hole, spacing, speed);
            expect(achievable, `Level ${levelIdx + 1}, transition ${i - 1}->${i}: not achievable (spacing=${spacing}, speed=${speed})`).toBe(true);
          });
        }
      });
    });
  });

  describe('Geometric Feasibility Details', () => {
    it('should compute correct width ranges for simple shapes', () => {
      // Tall hole: width <= holeW AND w >= 1/holeH
      const range = getValidWidthRange({ shape: 'tall', width: 0.6, height: 2.0 });
      expect(range.min).toBeCloseTo(0.5); // 1/2.0
      expect(range.max).toBeCloseTo(0.6);
    });

    it('should compute correct width ranges for wide shapes', () => {
      const range = getValidWidthRange({ shape: 'wide', width: 2.0, height: 0.5 });
      expect(range.min).toBeCloseTo(2.0); // 1/0.5
      expect(range.max).toBeCloseTo(2.0);
    });

    it('should compute merged ranges for plus shapes', () => {
      // Plus: can fit in H or V
      const range = getValidWidthRange({
        shape: 'plus',
        widthH: 0.5, heightH: 2.0,
        widthV: 2.0, heightV: 0.5
      });
      // H: w in [0.5, 0.5], V: w in [2.0, 2.0]
      // Merged: [0.5, 2.0]
      expect(range.min).toBeCloseTo(0.5);
      expect(range.max).toBeCloseTo(2.0);
    });

    it('should handle extreme values', () => {
      // Very narrow tall hole
      const range = getValidWidthRange({ shape: 'tall', width: 0.3, height: 3.33 });
      expect(range.min).toBeCloseTo(MIN_WIDTH); // 1/3.33 clamped to 0.3
      expect(range.max).toBeCloseTo(0.3);
    });
  });

  describe('fitsHole Integration', () => {
    it('should correctly identify fit for all levels at range boundaries', () => {
      levels.forEach((level, levelIdx) => {
        level.walls.forEach((wall, wallIdx) => {
          const range = getValidWidthRange(wall.hole);

          // Test with width at min of valid range
          const minWidth = range.min;
          const minHeight = 1.0 / minWidth;
          const minResult = fitsHole(minWidth, minHeight, wall.hole);
          expect(minResult.fits, `Level ${levelIdx + 1}, wall ${wallIdx}: min valid width should fit`).toBe(true);

          // Test with width at max of valid range
          const maxWidth = range.max;
          const maxHeight = 1.0 / maxWidth;
          const maxResult = fitsHole(maxWidth, maxHeight, wall.hole);
          expect(maxResult.fits, `Level ${levelIdx + 1}, wall ${wallIdx}: max valid width should fit`).toBe(true);
        });
      });
    });
  });
});
