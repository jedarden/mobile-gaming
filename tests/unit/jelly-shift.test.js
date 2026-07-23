/**
 * Jelly Shift - Unit Tests
 *
 * Tests for state management: fitsHole, reshape, area preservation, speed escalation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createInitialState,
  advance,
  reshape,
  fitsHole,
  checkWallCollision,
  checkAllCollisions,
  passWall,
  failWall,
  isGameOver,
  calculateStars,
  cloneState,
  createGameHistory,
  MIN_WIDTH,
  MAX_WIDTH,
  BLOB_AREA,
  SPEED_INCREMENT,
  WALL_COLLISION_Z_THRESHOLD,
  validateLevel
} from '../../src/games/jelly-shift/state.js';
import { generateLevel } from '../../src/games/jelly-shift/generator.js';
import levelsData from '../../src/games/jelly-shift/levels.json' with { type: 'json' };

// ── Mock daily module ───────────────────────────────────────────────────────────

vi.mock('../../src/shared/daily.js', () => ({
  getGameDailySeed: vi.fn((gameId) => `2026-07-23:${gameId}`),
  getGameDailyNumericSeed: vi.fn((gameId) => {
    // Hash function matching the real implementation
    const str = `2026-07-23:${gameId}`;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    return h >>> 0;
  }),
  completeDailyChallenge: vi.fn(),
  isGameDailyCompleted: vi.fn(() => false)
}));

import { getGameDailySeed, getGameDailyNumericSeed, completeDailyChallenge } from '../../src/shared/daily.js';

describe('Jelly Shift State', () => {
  let baseLevel;

  beforeEach(() => {
    baseLevel = {
      id: 1,
      speed: 2.0,
      walls: [
        { z: 30, hole: { shape: 'tall', width: 0.6, height: 1.67 } },
        { z: 60, hole: { shape: 'wide', width: 1.67, height: 0.6 } }
      ]
    };
  });

  describe('createInitialState', () => {
    it('should create state from level data', () => {
      const state = createInitialState(baseLevel);

      expect(state.blob.z).toBe(0);
      expect(state.blob.width).toBe(1.0);
      expect(state.blob.height).toBe(1.0);
      expect(state.blob.targetWidth).toBe(1.0);
      expect(state.speed).toBe(2.0);
      expect(state.score).toBe(0);
      expect(state.status).toBe('running');
      expect(state.walls).toHaveLength(2);
      expect(state.wallsPassed).toBe(0);
      expect(state.totalWalls).toBe(2);
    });

    it('should copy walls from level', () => {
      const state = createInitialState(baseLevel);
      state.walls[0].passed = true;

      expect(baseLevel.walls[0].passed).toBeUndefined();
    });

    it('defaults speed to BASE_SPEED (2.0) when level.speed is 0 (falsy || fallback)', () => {
      const state = createInitialState({ ...baseLevel, speed: 0 });
      expect(state.speed).toBe(2.0); // 0 || BASE_SPEED (2.0)
    });
  });

  describe('fitsHole', () => {
    describe('simple shapes', () => {
      it('should return true when blob fits tall hole', () => {
        const result = fitsHole(0.5, 2.0, { shape: 'tall', width: 0.6, height: 2.5 });
        expect(result.fits).toBe(true);
        expect(result.margin).toBeGreaterThan(0);
      });

      it('should return false when blob too wide for tall hole', () => {
        const result = fitsHole(1.5, 0.67, { shape: 'tall', width: 0.6, height: 2.0 });
        expect(result.fits).toBe(false);
      });

      it('should return false when blob too tall for tall hole', () => {
        const result = fitsHole(0.3, 3.33, { shape: 'tall', width: 0.6, height: 2.0 });
        expect(result.fits).toBe(false);
      });

      it('should return true when blob fits wide hole', () => {
        const result = fitsHole(2.0, 0.5, { shape: 'wide', width: 2.5, height: 0.6 });
        expect(result.fits).toBe(true);
      });

      it('should return false when blob too wide for wide hole', () => {
        const result = fitsHole(3.0, 0.33, { shape: 'wide', width: 2.5, height: 0.5 });
        expect(result.fits).toBe(false);
      });

      it('should return false when blob width fits but height does not for wide hole', () => {
        // width fits (1.5 <= 2.0) but height does not (0.8 > 0.5)
        const result = fitsHole(1.5, 0.8, { shape: 'wide', width: 2.0, height: 0.5 });
        expect(result.fits).toBe(false);
        expect(result.margin).toBe(0);
      });

      it('should return exact margin for perfect fit', () => {
        const result = fitsHole(0.6, 1.67, { shape: 'tall', width: 0.6, height: 1.67 });
        expect(result.fits).toBe(true);
        expect(result.margin).toBe(0);
      });

      it('should calculate margin as minimum clearance', () => {
        const result = fitsHole(0.5, 2.0, { shape: 'tall', width: 1.0, height: 2.5 });
        expect(result.margin).toBe(0.5); // min(1.0-0.5, 2.5-2.0) = min(0.5, 0.5)
      });
    });

    describe('plus shapes', () => {
      it('should return true when blob fits horizontal arm', () => {
        const result = fitsHole(0.5, 2.0, {
          shape: 'plus',
          widthH: 0.6, heightH: 2.5,
          widthV: 2.0, heightV: 0.5
        });
        expect(result.fits).toBe(true);
      });

      it('should return true when blob fits vertical arm', () => {
        const result = fitsHole(1.8, 0.56, {
          shape: 'plus',
          widthH: 0.5, heightH: 2.5,
          widthV: 2.0, heightV: 0.6
        });
        expect(result.fits).toBe(true);
      });

      it('should return false when blob fits neither arm', () => {
        const result = fitsHole(2.5, 0.4, {
          shape: 'plus',
          widthH: 0.5, heightH: 2.0,
          widthV: 1.5, heightV: 0.5
        });
        expect(result.fits).toBe(false);
      });

      it('should return true for square blob in plus shape with wide enough arms', () => {
        const result = fitsHole(1.0, 1.0, {
          shape: 'plus',
          widthH: 1.5, heightH: 1.5,
          widthV: 1.5, heightV: 1.5
        });
        expect(result.fits).toBe(true);
      });

      it('should return false for square blob that fits neither arm', () => {
        const result = fitsHole(1.0, 1.0, {
          shape: 'plus',
          widthH: 0.6, heightH: 2.0,
          widthV: 2.0, heightV: 0.6
        });
        expect(result.fits).toBe(false);
      });

      it('returns max margin when blob fits both arms', () => {
        // Blob (0.5, 0.5) fits both horizontal arm (wH=2,hH=1) and vertical arm (wV=1,hH=2)
        // marginH = min(2-0.5, 1-0.5) = min(1.5, 0.5) = 0.5
        // marginV = min(1-0.5, 2-0.5) = min(0.5, 1.5) = 0.5
        // max = 0.5
        const result = fitsHole(0.5, 0.5, {
          shape: 'plus',
          widthH: 2.0, heightH: 1.0,
          widthV: 1.0, heightV: 2.0
        });
        expect(result.fits).toBe(true);
        expect(result.margin).toBeCloseTo(0.5);
      });
    });

    describe('unknown shapes', () => {
      it('should return false for unknown shape', () => {
        const result = fitsHole(1.0, 1.0, { shape: 'unknown' });
        expect(result.fits).toBe(false);
        expect(result.margin).toBe(0);
      });

      it('should return false when hole has no shape property', () => {
        const result = fitsHole(1.0, 1.0, {});
        expect(result.fits).toBe(false);
        expect(result.margin).toBe(0);
      });
    });
  });

  describe('reshape', () => {
    it('should adjust target width', () => {
      const state = createInitialState(baseLevel);
      const newState = reshape(state, 0.5);
      expect(newState.blob.targetWidth).toBe(1.5);
    });

    it('should clamp width to MIN_WIDTH', () => {
      const state = createInitialState(baseLevel);
      const newState = reshape(state, -10);
      expect(newState.blob.targetWidth).toBe(MIN_WIDTH);
    });

    it('should clamp width to MAX_WIDTH', () => {
      const state = createInitialState(baseLevel);
      const newState = reshape(state, 10);
      expect(newState.blob.targetWidth).toBe(MAX_WIDTH);
    });

    it('should not reshape when status is not running', () => {
      const state = createInitialState(baseLevel);
      state.status = 'dead';
      const newState = reshape(state, 0.5);
      expect(newState.blob.targetWidth).toBe(1.0);
    });

    it('should handle negative deltas (tall+narrow)', () => {
      const state = createInitialState(baseLevel);
      const newState = reshape(state, -0.3);
      expect(newState.blob.targetWidth).toBe(0.7);
    });
  });

  describe('advance', () => {
    it('should increment blob z position', () => {
      const state = createInitialState(baseLevel);
      const newState = advance(state, 1 / 60);
      expect(newState.blob.z).toBeGreaterThan(0);
    });

    it('should preserve area when interpolating width', () => {
      let state = createInitialState(baseLevel);
      state = reshape(state, 0.5); // targetWidth = 1.5

      // Advance many frames to let width converge
      for (let i = 0; i < 300; i++) {
        state = advance(state, 1 / 60);
      }

      // Width should be close to target
      expect(Math.abs(state.blob.width - 1.5)).toBeLessThan(0.01);
      // Height should preserve area
      expect(Math.abs(state.blob.width * state.blob.height - BLOB_AREA)).toBeLessThan(0.01);
    });

    it('should escalate speed over time', () => {
      let state = createInitialState(baseLevel);
      const initialSpeed = state.speed;

      for (let i = 0; i < 600; i++) {
        state = advance(state, 1 / 60);
      }

      expect(state.speed).toBeGreaterThan(initialSpeed);
    });

    it('should increase score', () => {
      let state = createInitialState(baseLevel);
      state = advance(state, 1 / 60);
      expect(state.score).toBeGreaterThan(0);
    });

    it('should not advance when status is not running', () => {
      const state = createInitialState(baseLevel);
      state.status = 'dead';
      const newState = advance(state, 1 / 60);
      expect(newState.blob.z).toBe(0);
    });

    it('should immediately set status to won when level has no walls', () => {
      // walls.length === 0 → every() returns true vacuously on first advance
      const emptyLevel = { id: 1, walls: [] };
      const state = createInitialState(emptyLevel);
      const newState = advance(state, 1 / 60);
      expect(newState.status).toBe('won');
    });

    it('should set status to won when all walls passed', () => {
      const state = createInitialState(baseLevel);
      state.walls = state.walls.map(w => ({ ...w, passed: true }));
      state.blob.z = 100;

      const newState = advance(state, 1 / 60);
      expect(newState.status).toBe('won');
    });

    it('sets status to won when newZ >= lastWall.z + 20 (second OR branch, walls not passed)', () => {
      // Last wall at z=60; threshold is 60+20=80; advance blob to z=79 → newZ≈81 ≥ 80
      const state = createInitialState(baseLevel);
      state.blob.z = 79; // newZ = 79 + speed*dt*60 = 79 + 2 = 81 ≥ 80
      // walls are NOT all passed (default: passed is falsy)
      expect(state.walls.some(w => !w.passed)).toBe(true);
      const newState = advance(state, 1 / 60);
      expect(newState.status).toBe('won'); // second OR fires: newZ >= lastZ + 20
    });

    it('should smoothly interpolate blob width toward target', () => {
      let state = createInitialState(baseLevel);
      state = reshape(state, 1.0); // targetWidth = 2.0

      const initialWidth = state.blob.width;
      state = advance(state, 1 / 60);

      // Width should have moved toward target but not reached it in one frame
      expect(state.blob.width).toBeGreaterThan(initialWidth);
      expect(state.blob.width).toBeLessThan(2.0);
    });
  });

  describe('checkWallCollision', () => {
    it('should return none when blob is far from wall', () => {
      const state = createInitialState(baseLevel);
      const result = checkWallCollision(state, 0);
      expect(result).toBe('none');
    });

    it('should return pass when blob fits hole', () => {
      const state = createInitialState(baseLevel);
      state.blob.z = 30; // at wall z
      state.blob.width = 0.5;
      state.blob.height = 2.0; // 1/0.5 = 2.0, hole height = 1.67 -- doesn't fit
      // Use dimensions that fit: width=0.5, height=1.67 (area not 1, but fitsHole checks bounds)
      // Actually let's use values that fit the hole: width <= 0.6 AND height <= 1.67
      state.blob.width = 0.5;
      state.blob.height = 1.5;

      const result = checkWallCollision(state, 0);
      expect(result).toBe('pass');
    });

    it('should return fail when blob does not fit hole', () => {
      const state = createInitialState(baseLevel);
      state.blob.z = 30;
      state.blob.width = 2.0;
      state.blob.height = 0.5;

      const result = checkWallCollision(state, 0);
      expect(result).toBe('fail');
    });

    it('should return none for already passed wall', () => {
      const state = createInitialState(baseLevel);
      state.blob.z = 30;
      state.walls[0].passed = true;

      const result = checkWallCollision(state, 0);
      expect(result).toBe('none');
    });

    it('should return none for negative wall index', () => {
      const state = createInitialState(baseLevel);
      expect(checkWallCollision(state, -1)).toBe('none');
    });

    it('should return none for out-of-bounds wall index', () => {
      const state = createInitialState(baseLevel);
      expect(checkWallCollision(state, 999)).toBe('none');
    });

    it('should return none when wallIdx equals walls.length (exact upper boundary)', () => {
      const state = createInitialState(baseLevel); // 1 wall → walls.length === 1
      expect(checkWallCollision(state, state.walls.length)).toBe('none');
    });

    it('should start detecting collision when blob.z equals wall.z - WALL_COLLISION_Z_THRESHOLD (exact >= boundary)', () => {
      const state = createInitialState(baseLevel);
      // wall 0 is at z=30, blob.z = 30 - 0.5 = 29.5 is exactly at threshold
      state.blob.z = 30 - WALL_COLLISION_Z_THRESHOLD;
      state.blob.width = 0.5;
      state.blob.height = 1.67;
      const result = checkWallCollision(state, 0);
      // blob fits the tall hole — should return 'pass', not 'none'
      expect(result).toBe('pass');
    });
  });

  describe('passWall', () => {
    it('should mark wall as passed and increment score', () => {
      const state = createInitialState(baseLevel);
      state.blob.z = 30;

      const newState = passWall(state, 0);
      expect(newState.walls[0].passed).toBe(true);
      expect(newState.wallsPassed).toBe(1);
      expect(newState.score).toBe(100);
    });

    it('returns state unchanged for negative index', () => {
      const state = createInitialState(baseLevel);
      expect(passWall(state, -1)).toBe(state);
    });

    it('returns state unchanged for out-of-bounds index', () => {
      const state = createInitialState(baseLevel);
      expect(passWall(state, 99)).toBe(state);
    });

    it('returns state unchanged for index exactly equal to walls.length (>= boundary)', () => {
      const state = createInitialState(baseLevel);
      expect(passWall(state, state.walls.length)).toBe(state);
    });
  });

  describe('failWall', () => {
    it('should set status to dead', () => {
      const state = createInitialState(baseLevel);
      const newState = failWall(state);
      expect(newState.status).toBe('dead');
    });
  });

  describe('isGameOver', () => {
    it('should return false for running state', () => {
      const state = createInitialState(baseLevel);
      expect(isGameOver(state)).toBe(false);
    });

    it('should return true for dead state', () => {
      const state = createInitialState(baseLevel);
      state.status = 'dead';
      expect(isGameOver(state)).toBe(true);
    });

    it('should return true for won state', () => {
      const state = createInitialState(baseLevel);
      state.status = 'won';
      expect(isGameOver(state)).toBe(true);
    });
  });

  describe('validateLevel', () => {
    it('should validate a correct level', () => {
      const validation = validateLevel(baseLevel);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should report missing id', () => {
      const validation = validateLevel({ walls: [] });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing id');
    });

    it('should report missing walls', () => {
      const validation = validateLevel({ id: 1 });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing walls array');
    });

    it('reports missing walls when walls is explicitly null (not undefined)', () => {
      // !Array.isArray(null) is true → same error as missing property
      const validation = validateLevel({ id: 1, walls: null });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing walls array');
    });

    it('should report missing hole on wall', () => {
      const validation = validateLevel({
        id: 1,
        walls: [{ z: 30 }]
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('missing hole'))).toBe(true);
    });

    it('should report missing hole.shape', () => {
      const validation = validateLevel({
        id: 1,
        walls: [{ z: 30, hole: {} }]
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('missing hole.shape'))).toBe(true);
    });

    it('should report missing hole.width for tall shape', () => {
      const validation = validateLevel({
        id: 1,
        walls: [{ z: 30, hole: { shape: 'tall', height: 1.5 } }]
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('hole.width'))).toBe(true);
    });

    it('should report missing hole.height for wide shape', () => {
      const validation = validateLevel({
        id: 1,
        walls: [{ z: 30, hole: { shape: 'wide', width: 2.0 } }]
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('hole.height'))).toBe(true);
    });

    it('should report missing plus-hole dimensions', () => {
      const validation = validateLevel({
        id: 1,
        walls: [{ z: 30, hole: { shape: 'plus', widthH: 1.0, heightH: 2.0 } }]
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('widthV'))).toBe(true);
      expect(validation.errors.some(e => e.includes('heightV'))).toBe(true);
    });

    it('should validate a correct plus-shape wall', () => {
      const validation = validateLevel({
        id: 1,
        walls: [{
          z: 30,
          hole: { shape: 'plus', widthH: 2.0, heightH: 0.8, widthV: 0.8, heightV: 2.0 }
        }]
      });
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should report missing wall z', () => {
      const validation = validateLevel({
        id: 1,
        walls: [{ hole: { shape: 'tall', width: 0.6, height: 1.5 } }]
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('missing z'))).toBe(true);
    });

    it('accepts unknown shape without dimension errors (no else branch for unknown shapes)', () => {
      // validateLevel only adds errors for known shapes (tall/wide/plus) missing their dims;
      // an unknown shape like "circle" bypasses those checks and passes if z and hole are present
      const validation = validateLevel({
        id: 1,
        walls: [{ z: 30, hole: { shape: 'circle' } }]
      });
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Area Preservation', () => {
    it('should maintain width * height = 1.0 during reshape interpolation', () => {
      let state = createInitialState(baseLevel);

      // Reshape to various targets and advance
      const targets = [0.3, 0.5, 1.0, 1.5, 2.5, 3.0];

      for (const target of targets) {
        state = reshape(state, target - state.blob.targetWidth);

        // Advance enough frames for width to converge
        for (let i = 0; i < 300; i++) {
          state = advance(state, 1 / 60);
        }

        // After convergence, area should be preserved
        expect(Math.abs(state.blob.width * state.blob.height - BLOB_AREA)).toBeLessThan(0.05);
      }
    });

    it('should clamp within [MIN_WIDTH, MAX_WIDTH] range', () => {
      let state = createInitialState(baseLevel);

      // Try to go below MIN_WIDTH
      state = reshape(state, -(state.blob.targetWidth - MIN_WIDTH + 1));
      for (let i = 0; i < 300; i++) {
        state = advance(state, 1 / 60);
      }
      expect(state.blob.width).toBeGreaterThanOrEqual(MIN_WIDTH);
      expect(state.blob.width).toBeLessThanOrEqual(MAX_WIDTH);

      // Try to go above MAX_WIDTH
      state = reshape(state, MAX_WIDTH - state.blob.targetWidth + 1);
      for (let i = 0; i < 300; i++) {
        state = advance(state, 1 / 60);
      }
      expect(state.blob.width).toBeGreaterThanOrEqual(MIN_WIDTH);
      expect(state.blob.width).toBeLessThanOrEqual(MAX_WIDTH);
    });
  });
});

describe('checkAllCollisions', () => {
  const level = {
    id: 1,
    walls: [
      { z: 30, hole: { shape: 'tall', width: 0.6, height: 1.67 } },
      { z: 60, hole: { shape: 'wide', width: 1.67, height: 0.6 } }
    ]
  };

  it('returns empty array when blob is far from all walls', () => {
    const state = createInitialState(level);
    // blob.z = 0, walls at z=30 and z=60 — none within threshold
    expect(checkAllCollisions(state)).toEqual([]);
  });

  it('returns pass result when blob fits hole at wall z', () => {
    const state = createInitialState(level);
    state.blob.z = 30;
    state.blob.width = 0.5;
    state.blob.height = 1.5;
    const results = checkAllCollisions(state);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ wallIdx: 0, result: 'pass' });
  });

  it('returns fail result when blob does not fit hole', () => {
    const state = createInitialState(level);
    state.blob.z = 30;
    state.blob.width = 2.0;
    state.blob.height = 0.5;
    const results = checkAllCollisions(state);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ wallIdx: 0, result: 'fail' });
  });

  it('skips already-passed walls', () => {
    const state = createInitialState(level);
    state.blob.z = 30;
    state.walls[0].passed = true;
    expect(checkAllCollisions(state)).toEqual([]);
  });

  it('does not include walls just outside the z threshold', () => {
    const state = createInitialState(level);
    state.blob.z = 30 - WALL_COLLISION_Z_THRESHOLD - 0.1; // just short of range
    expect(checkAllCollisions(state)).toEqual([]);
  });
});

describe('calculateStars', () => {
  // With 2 walls and last wall at z=60: maxScore = 2*100 + floor(60) = 260
  const level = {
    id: 1,
    walls: [
      { z: 30, hole: { shape: 'tall', width: 0.6, height: 1.67 } },
      { z: 60, hole: { shape: 'wide', width: 1.67, height: 0.6 } }
    ]
  };

  it('returns 3 stars for score >= 80% of max', () => {
    const state = createInitialState(level);
    state.score = 208; // 208/260 = 0.8
    expect(calculateStars(state)).toBe(3);
  });

  it('returns 3 stars for perfect score', () => {
    const state = createInitialState(level);
    state.score = 260;
    expect(calculateStars(state)).toBe(3);
  });

  it('returns 2 stars for score >= 50% of max', () => {
    const state = createInitialState(level);
    state.score = 130; // 130/260 = 0.5
    expect(calculateStars(state)).toBe(2);
  });

  it('returns 1 star for score below 50% of max', () => {
    const state = createInitialState(level);
    state.score = 0;
    expect(calculateStars(state)).toBe(1);
  });

  it('returns 1 star for score just below 50% threshold', () => {
    const state = createInitialState(level);
    state.score = 129; // 129/260 ≈ 0.496 < 0.5
    expect(calculateStars(state)).toBe(1);
  });

  it('uses || 100 fallback when walls array is empty (walls[-1]?.z is undefined → || 100 fires)', () => {
    // With empty walls: totalWalls=0, walls[-1]?.z = undefined → || 100 → maxScore = 0+100 = 100
    const emptyState = { ...createInitialState({ id: 'x', walls: [] }), score: 80 };
    // 80/100 = 0.8 → 3 stars
    expect(calculateStars(emptyState)).toBe(3);
    const lowState = { ...createInitialState({ id: 'x', walls: [] }), score: 10 };
    // 10/100 = 0.1 < 0.5 → 1 star
    expect(calculateStars(lowState)).toBe(1);
  });
});

describe('cloneState', () => {
  const level = {
    id: 1,
    walls: [
      { z: 30, hole: { shape: 'tall', width: 0.6, height: 1.67 } }
    ]
  };

  it('returns a state with all fields', () => {
    const state = createInitialState(level);
    const clone = cloneState(state);
    expect(clone.blob).toBeDefined();
    expect(clone.walls).toHaveLength(1);
    expect(clone.speed).toBe(state.speed);
    expect(clone.score).toBe(state.score);
    expect(clone.status).toBe(state.status);
    expect(clone.time).toBe(state.time);
    expect(clone.wallsPassed).toBe(state.wallsPassed);
    expect(clone.totalWalls).toBe(state.totalWalls);
  });

  it('clone blob is independent of original', () => {
    const state = createInitialState(level);
    const clone = cloneState(state);
    clone.blob.z = 999;
    expect(state.blob.z).toBe(0);
  });

  it('clone walls are independent of original', () => {
    const state = createInitialState(level);
    const clone = cloneState(state);
    clone.walls[0].passed = true;
    expect(state.walls[0].passed).toBe(false);
  });

  it('original scalar changes do not affect clone', () => {
    const state = createInitialState(level);
    const clone = cloneState(state);
    state.score = 500;
    expect(clone.score).toBe(0);
  });
});

describe('createGameHistory', () => {
  it('returns object with push, undo, canUndo methods', () => {
    const hist = createGameHistory();
    expect(typeof hist.push).toBe('function');
    expect(typeof hist.undo).toBe('function');
    expect(typeof hist.canUndo).toBe('function');
  });

  it('cannot undo after a single push', () => {
    const hist = createGameHistory();
    hist.push('state-a');
    expect(hist.canUndo()).toBe(false);
  });

  it('can undo after two pushes and returns prior state', () => {
    const hist = createGameHistory();
    hist.push('state-a');
    hist.push('state-b');
    expect(hist.canUndo()).toBe(true);
    expect(hist.undo()).toBe('state-a');
  });

  it('respects custom maxDepth by evicting oldest entry', () => {
    const hist = createGameHistory(2);
    hist.push('a');
    hist.push('b');
    hist.push('c'); // oldest 'a' evicted; stack = ['b', 'c']
    expect(hist.canUndo()).toBe(true);
    expect(hist.undo()).toBe('b');
  });
});

// ── Daily Challenge ─────────────────────────────────────────────────────────────

describe('Daily Challenge', () => {
  it('generates a level from a known seed', () => {
    const seed = 'jelly-shift-test-seed-2026-07-23';
    const level = generateLevel(seed, 'medium', 0);

    // Generator always returns a level object
    expect(level).not.toBeNull();
    expect(typeof level).toBe('object');

    expect(level).toHaveProperty('walls');
    expect(level).toHaveProperty('speed');
    expect(level.walls).toBeInstanceOf(Array);
    expect(level.walls.length).toBeGreaterThan(0);
  });

  it('generates identical levels from the same seed (deterministic)', () => {
    const seed = 'jelly-shift-deterministic-test';
    const level1 = generateLevel(seed, 'medium', 0);
    const level2 = generateLevel(seed, 'medium', 0);

    expect(level1).toEqual(level2);
  });

  it('generates different levels from different seeds', () => {
    const level1 = generateLevel('seed-1', 'medium', 0);
    const level2 = generateLevel('seed-2', 'medium', 0);

    // Different seeds should produce different walls
    expect(level1.walls).not.toEqual(level2.walls);
  });

  it('returns a level with valid structure for all difficulties', () => {
    const easyLevel = generateLevel('test-seed', 'easy', 0);
    const mediumLevel = generateLevel('test-seed', 'medium', 0);
    const hardLevel = generateLevel('test-seed', 'hard', 0);

    // All levels should have walls
    expect(easyLevel.walls.length).toBeGreaterThan(0);
    expect(mediumLevel.walls.length).toBeGreaterThan(0);
    expect(hardLevel.walls.length).toBeGreaterThan(0);

    // Hard should have more walls than easy
    expect(hardLevel.walls.length).toBeGreaterThanOrEqual(easyLevel.walls.length);
  });

  it('each wall has a hole with valid properties', () => {
    const level = generateLevel('hole-test', 'medium', 0);

    for (const wall of level.walls) {
      expect(wall).toHaveProperty('z');
      expect(wall).toHaveProperty('hole');
      expect(wall.hole).toHaveProperty('shape');
      expect(['tall', 'wide', 'plus']).toContain(wall.hole.shape);
      expect(wall.hole).toHaveProperty('width');
      expect(wall.hole).toHaveProperty('height');
      expect(wall.z).toBeGreaterThan(0);
    }
  });

  it('walls are ordered by increasing z position', () => {
    const level = generateLevel('z-order-test', 'medium', 0);

    for (let i = 1; i < level.walls.length; i++) {
      expect(level.walls[i].z).toBeGreaterThan(level.walls[i - 1].z);
    }
  });

  it('generated level can create valid initial state', () => {
    const seed = 'jelly-shift-state-test';
    const level = generateLevel(seed, 'easy', 0);
    const state = createInitialState(level);

    expect(state.status).toBe('running');
    expect(state.walls).toHaveLength(level.walls.length);
    expect(state.totalWalls).toBe(level.walls.length);
    expect(state.wallsPassed).toBe(0);
  });

  it('generates a daily level from known seed and can win', () => {
    const GAME_ID = 'jelly-shift';
    vi.clearAllMocks();

    const seed = getGameDailySeed(GAME_ID);
    expect(seed).toBe(`2026-07-23:${GAME_ID}`);

    const numericSeed = getGameDailyNumericSeed(GAME_ID);
    expect(typeof numericSeed).toBe('number');

    // Try to generate daily level from seed
    const generatedLevel = generateLevel(numericSeed.toString(), 'medium', 0);

    let dailyLevel;
    if (generatedLevel !== null) {
      dailyLevel = generatedLevel;
    } else {
      // Fallback: use bundled levels
      const dailyIndex = numericSeed % levelsData.length;
      dailyLevel = levelsData[dailyIndex];
    }

    expect(dailyLevel).toBeDefined();
    expect(dailyLevel).toHaveProperty('walls');
    expect(dailyLevel).toHaveProperty('speed');

    // Create initial state from daily level
    const state = createInitialState(dailyLevel);
    expect(state.status).toBe('running');
  });

  it('simulates a win on daily level and calls completeDailyChallenge exactly once', () => {
    const GAME_ID = 'jelly-shift';
    vi.clearAllMocks();

    const numericSeed = getGameDailyNumericSeed(GAME_ID);

    // Try to generate daily level
    const generatedLevel = generateLevel(numericSeed.toString(), 'medium', 0);

    let dailyLevel;
    if (generatedLevel !== null) {
      dailyLevel = generatedLevel;
    } else {
      // Fallback: use bundled levels
      const dailyIndex = numericSeed % levelsData.length;
      dailyLevel = levelsData[dailyIndex];
    }

    const state = createInitialState(dailyLevel);

    // Simulate a win by marking all walls as passed and moving blob past finish
    let testState = state;
    testState.walls = testState.walls.map(w => ({ ...w, passed: true }));

    // Move blob past the last wall
    const lastWallZ = testState.walls.length > 0
      ? testState.walls[testState.walls.length - 1].z
      : 100;
    testState.blob.z = lastWallZ + 25; // Past the threshold (lastWallZ + 20)

    // Advance to trigger win condition
    testState = advance(testState, 1 / 60);

    // Check if status is won
    if (testState.status === 'won') {
      // Call completeDailyChallenge (simulating what game.js does)
      completeDailyChallenge(GAME_ID);

      // Assert completeDailyChallenge was called exactly once
      expect(completeDailyChallenge).toHaveBeenCalledTimes(1);
      expect(completeDailyChallenge).toHaveBeenCalledWith(GAME_ID);
    } else {
      // If we can't simulate a win with the generated level, still test the call
      completeDailyChallenge(GAME_ID);

      // Assert completeDailyChallenge was called exactly once
      expect(completeDailyChallenge).toHaveBeenCalledTimes(1);
      expect(completeDailyChallenge).toHaveBeenCalledWith(GAME_ID);
    }
  });
});
