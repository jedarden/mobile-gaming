/**
 * Jelly Shift - Unit Tests
 *
 * Tests for state management: fitsHole, reshape, area preservation, speed escalation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
    });

    describe('unknown shapes', () => {
      it('should return false for unknown shape', () => {
        const result = fitsHole(1.0, 1.0, { shape: 'unknown' });
        expect(result.fits).toBe(false);
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

    it('should set status to won when all walls passed', () => {
      const state = createInitialState(baseLevel);
      state.walls = state.walls.map(w => ({ ...w, passed: true }));
      state.blob.z = 100;

      const newState = advance(state, 1 / 60);
      expect(newState.status).toBe('won');
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

    it('should report missing hole on wall', () => {
      const validation = validateLevel({
        id: 1,
        walls: [{ z: 30 }]
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('missing hole'))).toBe(true);
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
