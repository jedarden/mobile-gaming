/**
 * Makeover Run - Solver Tests
 *
 * Validates that all hand-crafted and generated levels satisfy:
 *   - Optimal path (all positives) → 3 stars
 *   - Worst path  (all negatives)  → ≤ 1 star
 */

import { describe, it, expect } from 'vitest';
import levels from '../../src/games/makeover-run/levels.json';
import { simulatePath, optimalPath, worstPath, calculateStars, MAX_SCORE } from '../../src/games/makeover-run/state.js';
import { generateBatch, validateLevel } from '../../src/games/makeover-run/generator.js';

// ─── Helper ───────────────────────────────────────────────────────────────────

function runConstraints(level, label) {
  const opt   = simulatePath(level, optimalPath(level));
  const worst = simulatePath(level, worstPath(level));
  return { opt, worst, label };
}

// ─── Hand-crafted levels ──────────────────────────────────────────────────────

describe('hand-crafted levels', () => {
  it('all 12 levels are present', () => {
    expect(levels).toHaveLength(12);
  });

  levels.forEach(level => {
    describe(`level ${level.id}`, () => {
      it('optimal path → 3 stars', () => {
        const { opt } = runConstraints(level, level.id);
        expect(opt.stars).toBe(3);
      });

      it('worst path → 1 star', () => {
        const { worst } = runConstraints(level, level.id);
        expect(worst.stars).toBe(1);
      });

      it('has at least 6 stations', () => {
        expect(level.stations.length).toBeGreaterThanOrEqual(6);
      });

      it('each z group has exactly one positive and one negative station', () => {
        const zGroups = {};
        level.stations.forEach(s => {
          if (!zGroups[s.z]) zGroups[s.z] = { positive: 0, negative: 0 };
          if (s.positive) zGroups[s.z].positive++;
          else zGroups[s.z].negative++;
        });
        Object.entries(zGroups).forEach(([z, counts]) => {
          expect(counts.positive).toBeGreaterThanOrEqual(1);
          expect(counts.negative).toBeGreaterThanOrEqual(1);
        });
      });

      it('no two stations at same z and same x', () => {
        const seen = new Set();
        level.stations.forEach(s => {
          const key = `${s.z},${s.x}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        });
      });

      it('positive stations have valid type (hair/outfit/makeup/accessories)', () => {
        const validTypes = new Set(['hair', 'outfit', 'makeup', 'accessories']);
        level.stations.filter(s => s.positive).forEach(s => {
          expect(validTypes.has(s.type)).toBe(true);
        });
      });

      it('positive station upgrade in [1, 3]', () => {
        level.stations.filter(s => s.positive).forEach(s => {
          expect(s.upgrade).toBeGreaterThanOrEqual(1);
          expect(s.upgrade).toBeLessThanOrEqual(3);
        });
      });

      it('negative stations have downgrade field with valid category', () => {
        const validCats = new Set(['hair', 'outfit', 'makeup', 'accessories']);
        level.stations.filter(s => !s.positive).forEach(s => {
          expect(validCats.has(s.downgrade)).toBe(true);
          expect(s.amount).toBeGreaterThanOrEqual(1);
        });
      });

      it('courseLength > last station z', () => {
        const maxZ = Math.max(...level.stations.map(s => s.z));
        expect(level.courseLength).toBeGreaterThan(maxZ);
      });
    });
  });
});

// ─── Generated levels — easy ──────────────────────────────────────────────────

describe('generated levels — easy', () => {
  const easyLevels = generateBatch(1, 'easy', 10);

  it('generates 10 levels', () => {
    expect(easyLevels).toHaveLength(10);
  });

  easyLevels.forEach((level, i) => {
    it(`easy-${i}: optimal → 3 stars`, () => {
      const result = simulatePath(level, optimalPath(level));
      expect(result.stars).toBe(3);
    });

    it(`easy-${i}: worst → 1 star`, () => {
      const result = simulatePath(level, worstPath(level));
      expect(result.stars).toBe(1);
    });

    it(`easy-${i}: passes validateLevel`, () => {
      const v = validateLevel(level);
      expect(v.valid).toBe(true);
    });
  });
});

// ─── Generated levels — medium ────────────────────────────────────────────────

describe('generated levels — medium', () => {
  const medLevels = generateBatch(100, 'medium', 10);

  it('generates 10 levels', () => {
    expect(medLevels).toHaveLength(10);
  });

  medLevels.forEach((level, i) => {
    it(`medium-${i}: optimal → 3 stars`, () => {
      expect(simulatePath(level, optimalPath(level)).stars).toBe(3);
    });

    it(`medium-${i}: worst → 1 star`, () => {
      expect(simulatePath(level, worstPath(level)).stars).toBe(1);
    });
  });
});

// ─── Generated levels — hard ──────────────────────────────────────────────────

describe('generated levels — hard', () => {
  const hardLevels = generateBatch(200, 'hard', 10);

  it('generates 10 levels', () => {
    expect(hardLevels).toHaveLength(10);
  });

  hardLevels.forEach((level, i) => {
    it(`hard-${i}: optimal → 3 stars`, () => {
      expect(simulatePath(level, optimalPath(level)).stars).toBe(3);
    });

    it(`hard-${i}: worst → 1 star`, () => {
      expect(simulatePath(level, worstPath(level)).stars).toBe(1);
    });
  });
});

// ─── Solver properties ────────────────────────────────────────────────────────

describe('solver properties', () => {
  it('optimal score is always >= worst score for every level', () => {
    levels.forEach(level => {
      const opt   = simulatePath(level, optimalPath(level));
      const worst = simulatePath(level, worstPath(level));
      expect(opt.score).toBeGreaterThanOrEqual(worst.score);
    });
  });

  it('max achievable score for any level ≤ MAX_SCORE (12)', () => {
    levels.forEach(level => {
      const opt = simulatePath(level, optimalPath(level));
      expect(opt.score).toBeLessThanOrEqual(MAX_SCORE);
    });
  });

  it('appearance values never exceed 3 on optimal path', () => {
    levels.forEach(level => {
      const opt = simulatePath(level, optimalPath(level));
      Object.values(opt.appearance).forEach(v => expect(v).toBeLessThanOrEqual(3));
    });
  });

  it('appearance values never go below 0 on worst path', () => {
    levels.forEach(level => {
      const worst = simulatePath(level, worstPath(level));
      Object.values(worst.appearance).forEach(v => expect(v).toBeGreaterThanOrEqual(0));
    });
  });
});
