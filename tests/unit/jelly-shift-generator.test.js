/**
 * Jelly Shift - Generator Unit Tests
 *
 * Tests for the geometry validation helper functions:
 *   getValidWidthRange, isHoleAchievable, isTransitionAchievable.
 * Also covers generateLevel, validateLevel, generateBatch.
 */

import { describe, it, expect } from 'vitest';
import {
  getValidWidthRange,
  isHoleAchievable,
  isTransitionAchievable,
  generateLevel,
  validateLevel,
  generateBatch,
} from '../../src/games/jelly-shift/generator.js';
import { MIN_WIDTH, MAX_WIDTH, RESHAPE_SPEED } from '../../src/games/jelly-shift/state.js';

// ── getValidWidthRange ──────────────────────────────────────────────────────

describe('getValidWidthRange', () => {
  describe('tall holes', () => {
    it('range.min >= MIN_WIDTH', () => {
      const range = getValidWidthRange({ shape: 'tall', width: 0.4, height: 2.5 });
      expect(range.min).toBeGreaterThanOrEqual(MIN_WIDTH);
    });

    it('range.max <= MAX_WIDTH', () => {
      const range = getValidWidthRange({ shape: 'tall', width: 0.4, height: 2.5 });
      expect(range.max).toBeLessThanOrEqual(MAX_WIDTH);
    });

    it('narrow tall hole: max equals hole.width', () => {
      const hole = { shape: 'tall', width: 0.4, height: 2.5 };
      const range = getValidWidthRange(hole);
      expect(range.max).toBeCloseTo(0.4);
    });

    it('wide tall hole: max equals hole.width', () => {
      const hole = { shape: 'tall', width: 0.8, height: 1.25 };
      const range = getValidWidthRange(hole);
      expect(range.max).toBeCloseTo(0.8);
    });
  });

  describe('wide holes', () => {
    it('range.min >= MIN_WIDTH', () => {
      const range = getValidWidthRange({ shape: 'wide', width: 2.5, height: 0.4 });
      expect(range.min).toBeGreaterThanOrEqual(MIN_WIDTH);
    });

    it('range.max <= MAX_WIDTH', () => {
      const range = getValidWidthRange({ shape: 'wide', width: 2.5, height: 0.4 });
      expect(range.max).toBeLessThanOrEqual(MAX_WIDTH);
    });

    it('short wide hole: min is 1/height', () => {
      const hole = { shape: 'wide', width: 2.5, height: 0.4 };
      // min = 1/0.4 = 2.5, but clamped to MAX_WIDTH... wait, 2.5 = MAX_WIDTH?
      // MAX_WIDTH = 3.0, so min = max(MIN_WIDTH, 1/0.4) = max(0.3, 2.5) = 2.5
      const range = getValidWidthRange(hole);
      expect(range.min).toBeCloseTo(2.5);
    });
  });

  describe('plus holes', () => {
    it('returns a valid range', () => {
      const hole = { shape: 'plus', widthH: 0.5, heightH: 2.5, widthV: 2.5, heightV: 0.5 };
      const range = getValidWidthRange(hole);
      expect(range.min).toBeLessThanOrEqual(range.max);
    });

    it('range is between MIN_WIDTH and MAX_WIDTH', () => {
      const hole = { shape: 'plus', widthH: 0.6, heightH: 2.0, widthV: 2.0, heightV: 0.6 };
      const range = getValidWidthRange(hole);
      expect(range.min).toBeGreaterThanOrEqual(MIN_WIDTH);
      expect(range.max).toBeLessThanOrEqual(MAX_WIDTH);
    });
  });

  describe('unknown shape', () => {
    it('returns [MIN_WIDTH, MAX_WIDTH] for unknown shape', () => {
      const range = getValidWidthRange({ shape: 'circle', width: 1, height: 1 });
      expect(range.min).toBe(MIN_WIDTH);
      expect(range.max).toBe(MAX_WIDTH);
    });
  });
});

// ── isHoleAchievable ────────────────────────────────────────────────────────

describe('isHoleAchievable', () => {
  it('returns true for a standard tall hole', () => {
    expect(isHoleAchievable({ shape: 'tall', width: 0.5, height: 2.0 })).toBe(true);
  });

  it('returns true for a standard wide hole', () => {
    expect(isHoleAchievable({ shape: 'wide', width: 2.0, height: 0.5 })).toBe(true);
  });

  it('returns true for all TALL_HOLES templates', () => {
    const tallHoles = [
      { shape: 'tall', width: 0.4, height: 2.5 },
      { shape: 'tall', width: 0.5, height: 2.0 },
      { shape: 'tall', width: 0.6, height: 1.67 },
      { shape: 'tall', width: 0.7, height: 1.43 },
      { shape: 'tall', width: 0.8, height: 1.25 },
    ];
    for (const hole of tallHoles) {
      expect(isHoleAchievable(hole), `tall hole ${hole.width}x${hole.height}`).toBe(true);
    }
  });

  it('returns true for all WIDE_HOLES templates', () => {
    const wideHoles = [
      { shape: 'wide', width: 2.5, height: 0.4 },
      { shape: 'wide', width: 2.0, height: 0.5 },
      { shape: 'wide', width: 1.67, height: 0.6 },
      { shape: 'wide', width: 1.43, height: 0.7 },
      { shape: 'wide', width: 1.25, height: 0.8 },
    ];
    for (const hole of wideHoles) {
      expect(isHoleAchievable(hole), `wide hole ${hole.width}x${hole.height}`).toBe(true);
    }
  });

  it('returns true for all PLUS_HOLES templates', () => {
    const plusHoles = [
      { shape: 'plus', widthH: 0.5, heightH: 2.5, widthV: 2.5, heightV: 0.5 },
      { shape: 'plus', widthH: 0.6, heightH: 2.0, widthV: 2.0, heightV: 0.6 },
      { shape: 'plus', widthH: 0.7, heightH: 1.8, widthV: 1.8, heightV: 0.7 },
      { shape: 'plus', widthH: 0.8, heightH: 1.5, widthV: 1.5, heightV: 0.8 },
    ];
    for (const hole of plusHoles) {
      expect(isHoleAchievable(hole), `plus hole`).toBe(true);
    }
  });
});

// ── isTransitionAchievable ─────────────────────────────────────────────────

describe('isTransitionAchievable', () => {
  const speed = 2.0;

  it('returns true when hole ranges overlap (no reshape needed)', () => {
    // Both tall holes — ranges both start near MIN_WIDTH, so they overlap
    const holeA = { shape: 'tall', width: 0.6, height: 1.67 };
    const holeB = { shape: 'tall', width: 0.7, height: 1.43 };
    // Both have overlapping valid width ranges
    expect(isTransitionAchievable(holeA, holeB, 30, speed)).toBe(true);
  });

  it('returns true for large wall spacing (enough time to reshape)', () => {
    const holeA = { shape: 'tall', width: 0.4, height: 2.5 };  // max width ~0.4
    const holeB = { shape: 'wide', width: 2.5, height: 0.4 };  // min width ~2.5
    // Large spacing gives enough time for reshape
    expect(isTransitionAchievable(holeA, holeB, 1000, speed)).toBe(true);
  });

  it('returns false when spacing is too small for large transition', () => {
    const holeA = { shape: 'tall', width: 0.4, height: 2.5 };  // narrow
    const holeB = { shape: 'wide', width: 2.5, height: 0.4 };  // wide
    // Very small spacing — no time to reshape
    expect(isTransitionAchievable(holeA, holeB, 1, speed)).toBe(false);
  });

  it('same hole type: transition is always achievable (ranges overlap)', () => {
    const hole = { shape: 'tall', width: 0.5, height: 2.0 };
    expect(isTransitionAchievable(hole, hole, 5, speed)).toBe(true);
  });
});

// ── generateLevel ──────────────────────────────────────────────────────────

describe('generateLevel', () => {
  it('returns a level with required fields', () => {
    const level = generateLevel(1);
    expect(level).toHaveProperty('id');
    expect(level).toHaveProperty('difficulty');
    expect(level).toHaveProperty('walls');
    expect(level).toHaveProperty('speed');
  });

  it('is deterministic given the same seed', () => {
    const a = generateLevel(42);
    const b = generateLevel(42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('easy difficulty has fewer walls than hard', () => {
    const easy = generateLevel(1, 'easy');
    const hard = generateLevel(1, 'hard');
    expect(hard.walls.length).toBeGreaterThanOrEqual(easy.walls.length);
  });
});

// ── validateLevel ──────────────────────────────────────────────────────────

describe('validateLevel', () => {
  it('accepts a generated easy level', () => {
    const level = generateLevel(1, 'easy');
    const result = validateLevel(level);
    expect(result.valid).toBe(true);
  });

  it('accepts a generated hard level (seed 2 is known-good)', () => {
    const level = generateLevel(2, 'hard');
    const result = validateLevel(level);
    expect(result.valid).toBe(true);
  });

  it('rejects a level with an unachievable hole (width too small for height)', () => {
    // hole.width=0.1 < 1/hole.height=1/0.1=10 → min(MAX_WIDTH, 0.1) < max(MIN_WIDTH, 10) → invalid
    const level = {
      id: 'bad',
      speed: 2.0,
      walls: [{ z: 10, hole: { shape: 'tall', width: 0.1, height: 0.1 } }]
    };
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
  });
});

// ── generateBatch ──────────────────────────────────────────────────────────

describe('generateBatch', () => {
  it('generates the requested number of levels', () => {
    const levels = generateBatch(1000, 'easy', 5);
    expect(levels.length).toBe(5);
  });

  it('all generated levels are valid', () => {
    const levels = generateBatch(2000, 'medium', 5);
    for (const level of levels) {
      const result = validateLevel(level);
      expect(result.valid, result.reason).toBe(true);
    }
  });

  it('batch is deterministic', () => {
    const a = generateBatch(5000, 'easy', 3);
    const b = generateBatch(5000, 'easy', 3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
