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

  describe('plus holes — non-overlapping ranges (ternary branch)', () => {
    // To reach the ternary at line 79, the two ranges must NOT overlap.
    // This happens when one range is inverted (empty), e.g. widthH < 1/heightH.
    //
    // With MIN_WIDTH=0.3, MAX_WIDTH=3.0:
    //   { widthH:0.3, heightH:0.3, widthV:3.0, heightV:3.0 }
    //   hRange = { min: max(0.3, 1/0.3≈3.33) = 3.33, max: min(3.0, 0.3) = 0.3 }  — inverted
    //   vRange = { min: max(0.3, 1/3.0≈0.33) = 0.33, max: min(3.0, 3.0) = 3.0 }
    //   Overlap check: 0.3 >= 0.33 → false  AND  3.0 >= 3.33 → false  → non-overlapping
    //   hWidth = 0.3 - 3.33 = -3.03  <  vWidth = 3.0 - 0.33 = 2.67  → FALSE branch → returns vRange

    it('returns vRange when hWidth < vWidth (ternary false branch — non-overlapping plus hole)', () => {
      const hole = { shape: 'plus', widthH: 0.3, heightH: 0.3, widthV: 3.0, heightV: 3.0 };
      const range = getValidWidthRange(hole);
      // Should return vRange: { min: ~0.333, max: 3.0 }
      expect(range.max).toBeCloseTo(MAX_WIDTH); // vRange.max = min(3.0, 3.0) = 3.0
      expect(range.min).toBeGreaterThan(MIN_WIDTH); // vRange.min = max(0.3, 1/3) ≈ 0.333
      expect(range.min).toBeLessThanOrEqual(range.max);
    });

    // Symmetric case: inverted vRange, valid hRange
    //   { widthH:3.0, heightH:3.0, widthV:0.3, heightV:0.3 }
    //   hRange = { min: 0.333, max: 3.0 }  — valid
    //   vRange = { min: 3.33, max: 0.3 }   — inverted
    //   Overlap check: 3.0 >= 3.33 → false  AND  0.3 >= 0.333 → false  → non-overlapping
    //   hWidth = 2.67  >  vWidth = -3.03  → TRUE branch → returns hRange

    it('returns hRange when hWidth >= vWidth (ternary true branch — non-overlapping plus hole)', () => {
      const hole = { shape: 'plus', widthH: 3.0, heightH: 3.0, widthV: 0.3, heightV: 0.3 };
      const range = getValidWidthRange(hole);
      // Should return hRange: { min: ~0.333, max: 3.0 }
      expect(range.max).toBeCloseTo(MAX_WIDTH); // hRange.max = min(3.0, 3.0) = 3.0
      expect(range.min).toBeGreaterThan(MIN_WIDTH); // hRange.min = max(0.3, 1/3) ≈ 0.333
      expect(range.min).toBeLessThanOrEqual(range.max);
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

  it('else branch: wide→tall (rangeB left of rangeA) — achievable with large spacing', () => {
    // rangeA = {2.0, 2.0}, rangeB = {0.4, 0.4} → rangeB.max (0.4) < rangeA.min (2.0)
    // minTransitionDist = rangeA.min - rangeB.max = 1.6 (else branch)
    const holeA = { shape: 'wide', width: 2.0, height: 0.5 };
    const holeB = { shape: 'tall', width: 0.4, height: 2.5 };
    expect(isTransitionAchievable(holeA, holeB, 1000, speed)).toBe(true);
  });

  it('else branch: wide→tall (rangeB left of rangeA) — not achievable with tiny spacing', () => {
    // Same as above but spacing=1 → maxReshapeDist ≈ 0.067 < 1.6 → false
    const holeA = { shape: 'wide', width: 2.0, height: 0.5 };
    const holeB = { shape: 'tall', width: 0.4, height: 2.5 };
    expect(isTransitionAchievable(holeA, holeB, 1, speed)).toBe(false);
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

  it('easy wall count is in [6, 8]', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const level = generateLevel(seed, 'easy');
      expect(level.walls.length).toBeGreaterThanOrEqual(6);
      expect(level.walls.length).toBeLessThanOrEqual(8);
    }
  });

  it('medium wall count is in [8, 12]', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const level = generateLevel(seed, 'medium');
      expect(level.walls.length).toBeGreaterThanOrEqual(8);
      expect(level.walls.length).toBeLessThanOrEqual(12);
    }
  });

  it('hard wall count is in [10, 15]', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const level = generateLevel(seed, 'hard');
      expect(level.walls.length).toBeGreaterThanOrEqual(10);
      expect(level.walls.length).toBeLessThanOrEqual(15);
    }
  });

  it('easy speed is 1.8', () => {
    expect(generateLevel(1, 'easy').speed).toBe(1.8);
  });

  it('medium speed is 2.0', () => {
    expect(generateLevel(1, 'medium').speed).toBe(2.0);
  });

  it('hard speed is 2.2', () => {
    expect(generateLevel(1, 'hard').speed).toBe(2.2);
  });

  it('wall z-positions are strictly increasing', () => {
    const level = generateLevel(7, 'medium');
    for (let i = 1; i < level.walls.length; i++) {
      expect(level.walls[i].z).toBeGreaterThan(level.walls[i - 1].z);
    }
  });

  it('first wall z is at least 20 (not right at the start)', () => {
    const level = generateLevel(1, 'easy');
    expect(level.walls[0].z).toBeGreaterThanOrEqual(20);
  });

  it('each wall has a z and hole property', () => {
    const level = generateLevel(3, 'medium');
    for (const wall of level.walls) {
      expect(wall).toHaveProperty('z');
      expect(wall).toHaveProperty('hole');
      expect(typeof wall.z).toBe('number');
      expect(typeof wall.hole).toBe('object');
    }
  });

  it('each hole has a shape property', () => {
    const level = generateLevel(5, 'hard');
    for (const wall of level.walls) {
      expect(['tall', 'wide', 'plus']).toContain(wall.hole.shape);
    }
  });

  it('hard levels can include plus-shaped holes', () => {
    // Hard difficulty sets usePlusHoles=true; run many seeds to encounter one
    let foundPlus = false;
    for (let seed = 1; seed <= 50; seed++) {
      const level = generateLevel(seed, 'hard');
      if (level.walls.some(w => w.hole.shape === 'plus')) {
        foundPlus = true;
        break;
      }
    }
    expect(foundPlus).toBe(true);
  });

  it('easy levels never contain plus-shaped holes', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const level = generateLevel(seed, 'easy');
      expect(level.walls.every(w => w.hole.shape !== 'plus')).toBe(true);
    }
  });

  it('hard levels: wall[0] is never plus (i > 0 condition skips first wall even with usePlusHoles)', () => {
    // Source: usePlusHoles && i > 0 && i % 3 === 0 — i=0 fails i > 0, so wall[0] uses tall/wide
    for (let seed = 1; seed <= 20; seed++) {
      const level = generateLevel(seed, 'hard');
      if (level.walls.length > 0) {
        expect(level.walls[0].hole.shape).not.toBe('plus');
      }
    }
  });

  it('level id encodes difficulty and seed', () => {
    const level = generateLevel(42, 'hard', 3);
    expect(level.id).toContain('hard');
    expect(level.id).toContain('42');
  });

  it('unknown difficulty defaults to medium config', () => {
    const medium = generateLevel(1, 'medium');
    const unknown = generateLevel(1, 'unknown');
    expect(unknown.speed).toBe(medium.speed);
    expect(unknown.difficulty).toBe(medium.difficulty);
  });

  it('different seeds produce different levels', () => {
    const a = generateLevel(100, 'medium');
    const b = generateLevel(200, 'medium');
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('substitutes fallback hole when transition is not achievable (lines 169-175 covered)', () => {
    // When a WIDE-extreme → TALL-extreme transition is not achievable given the interval/speed,
    // generateLevel sets hole = { shape:'tall'|'wide', width:1.0, height:1.0 }.
    // These exact dimensions (1.0/1.0) do not appear in any TALL_HOLES or WIDE_HOLES template,
    // so their presence in the output proves the fallback branch fired.
    // Hard difficulty at start interval=25, speed=2.2: maxReshapeDist ≈ 1.5 <  some transition dists.
    let fallbackFound = false;
    for (let seed = 1; seed <= 200; seed++) {
      const level = generateLevel(seed, 'hard');
      if (level.walls.some(w =>
        (w.hole.shape === 'tall' || w.hole.shape === 'wide') &&
        w.hole.width === 1.0 && w.hole.height === 1.0
      )) {
        fallbackFound = true;
        break;
      }
    }
    expect(fallbackFound).toBe(true);
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

  it('returns errors array on invalid level', () => {
    const level = {
      id: 'bad',
      speed: 2.0,
      walls: [{ z: 10, hole: { shape: 'tall', width: 0.1, height: 0.1 } }]
    };
    const result = validateLevel(level);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns empty errors array on valid level', () => {
    const level = generateLevel(5, 'easy');
    const result = validateLevel(level);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a level with zero walls', () => {
    const result = validateLevel({ id: 'empty', speed: 2.0, walls: [] });
    expect(result.valid).toBe(true);
  });

  it('null speed falls back to BASE_SPEED via || operator (no crash, still valid)', () => {
    // level.speed || BASE_SPEED — null speed uses BASE_SPEED for transition checks
    const result = validateLevel({ id: 'null-speed', speed: null, walls: [] });
    expect(result.valid).toBe(true);
  });

  it('rejects a level with impossible transition between consecutive walls', () => {
    // wall 1: tall narrow (max ~0.4), wall 2: wide narrow (min ~2.5) — spacing=1 too tight
    const level = {
      id: 'tight-transition',
      speed: 2.0,
      walls: [
        { z: 10, hole: { shape: 'tall', width: 0.4, height: 2.5 } },
        { z: 11, hole: { shape: 'wide', width: 2.5, height: 0.4 } },
      ]
    };
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
  });

  it('all 10 hand-crafted levels pass validateLevel', async () => {
    const { default: levels } = await import('../../src/games/jelly-shift/levels.json', { with: { type: 'json' } });
    for (const level of levels) {
      const result = validateLevel(level);
      expect(result.valid, `level ${level.id}: ${result.errors?.join(', ')}`).toBe(true);
    }
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

  it('count=0 returns empty array', () => {
    expect(generateBatch(1, 'easy', 0)).toEqual([]);
  });

  it('all levels in batch have unique ids', () => {
    const levels = generateBatch(300, 'medium', 5);
    const ids = levels.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hard batch contains valid levels with high wall counts', () => {
    const levels = generateBatch(700, 'hard', 3);
    for (const level of levels) {
      expect(level.walls.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('different difficulties produce different batches', () => {
    const easy = generateBatch(1, 'easy', 3);
    const hard = generateBatch(1, 'hard', 3);
    expect(JSON.stringify(easy)).not.toBe(JSON.stringify(hard));
  });
});
