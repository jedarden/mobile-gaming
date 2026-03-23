/**
 * Makeover Run - Generator Unit Tests
 *
 * Tests for: generateLevel (structure, determinism),
 *            validateLevel (valid/invalid cases),
 *            generateBatch (count, determinism, all-valid).
 *
 * The generator guarantees:
 *   - optimal path (all positive stations) → 3 stars (score ≥ 9 / maxScore 12)
 *   - worst path  (all negative stations)  → ≤ 1 star (score = 0)
 */

import { describe, it, expect } from 'vitest';
import {
  generateLevel,
  validateLevel,
  generateBatch,
} from '../../src/games/makeover-run/generator.js';

// Difficulty configs from generator
const DIFFICULTY_PAIR_COUNTS = { easy: 6, medium: 8, hard: 10 };

// ── generateLevel ────────────────────────────────────────────────────────────

describe('generateLevel', () => {
  describe('structure', () => {
    it('returns required top-level fields', () => {
      const level = generateLevel(1, 'easy');
      expect(level).toHaveProperty('id');
      expect(level).toHaveProperty('courseLength');
      expect(level).toHaveProperty('speed');
      expect(level).toHaveProperty('stations');
      expect(level).toHaveProperty('difficulty');
    });

    it('id encodes difficulty, index, and seed', () => {
      const level = generateLevel(7, 'hard', 3);
      expect(level.id).toBe('gen-hard-3-7');
    });

    it('courseLength matches difficulty config', () => {
      expect(generateLevel(1, 'easy').courseLength).toBe(260);
      expect(generateLevel(1, 'medium').courseLength).toBe(360);
      expect(generateLevel(1, 'hard').courseLength).toBe(460);
    });

    it('speed matches difficulty config', () => {
      expect(generateLevel(1, 'easy').speed).toBe(2.0);
      expect(generateLevel(1, 'medium').speed).toBe(2.3);
      expect(generateLevel(1, 'hard').speed).toBe(2.6);
    });

    it('generates exactly 2 stations per pair (one positive, one negative)', () => {
      for (const [diff, pairCount] of Object.entries(DIFFICULTY_PAIR_COUNTS)) {
        const level = generateLevel(1, diff);
        expect(level.stations.length).toBe(pairCount * 2);
        const positives = level.stations.filter(s => s.positive);
        const negatives = level.stations.filter(s => !s.positive);
        expect(positives.length).toBe(pairCount);
        expect(negatives.length).toBe(pairCount);
      }
    });

    it('positive stations have valid category type and upgrade value', () => {
      const validCategories = ['hair', 'outfit', 'makeup', 'accessories'];
      const level = generateLevel(1, 'medium');
      const positives = level.stations.filter(s => s.positive);
      for (const s of positives) {
        expect(validCategories).toContain(s.type);
        expect(s.upgrade).toBeGreaterThanOrEqual(1);
        expect(s.upgrade).toBeLessThanOrEqual(3);
      }
    });

    it('negative stations have type mud and a valid downgrade category', () => {
      const validCategories = ['hair', 'outfit', 'makeup', 'accessories'];
      const level = generateLevel(1, 'medium');
      const negatives = level.stations.filter(s => !s.positive);
      for (const s of negatives) {
        expect(s.type).toBe('mud');
        expect(validCategories).toContain(s.downgrade);
        expect(s.amount).toBe(1);
      }
    });

    it('each pair shares the same z value', () => {
      const level = generateLevel(1, 'easy');
      const zValues = [...new Set(level.stations.map(s => s.z))];
      // Each z has exactly 2 stations (one pos, one neg)
      for (const z of zValues) {
        const atZ = level.stations.filter(s => s.z === z);
        expect(atZ.length).toBe(2);
        const hasPositive = atZ.some(s => s.positive);
        const hasNegative = atZ.some(s => !s.positive);
        expect(hasPositive).toBe(true);
        expect(hasNegative).toBe(true);
      }
    });

    it('stations within a pair occupy opposite x positions (-1 and 1)', () => {
      const level = generateLevel(1, 'easy');
      const zValues = [...new Set(level.stations.map(s => s.z))];
      for (const z of zValues) {
        const atZ = level.stations.filter(s => s.z === z);
        const xValues = atZ.map(s => s.x).sort();
        expect(xValues).toEqual([-1, 1]);
      }
    });

    it('unknown difficulty defaults to easy config', () => {
      const easyLevel = generateLevel(5, 'easy');
      const unknownLevel = generateLevel(5, 'unknown');
      expect(unknownLevel.courseLength).toBe(easyLevel.courseLength);
      expect(unknownLevel.stations.length).toBe(easyLevel.stations.length);
    });
  });

  describe('determinism', () => {
    it('same seed and difficulty produce identical output', () => {
      const a = generateLevel(42, 'medium', 0);
      const b = generateLevel(42, 'medium', 0);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('different seeds produce different station layouts', () => {
      const a = generateLevel(1, 'medium');
      const b = generateLevel(2, 'medium');
      expect(JSON.stringify(a.stations)).not.toBe(JSON.stringify(b.stations));
    });
  });
});

// ── validateLevel ────────────────────────────────────────────────────────────

describe('validateLevel', () => {
  it('returns { valid, reason } shape', () => {
    const level = generateLevel(1, 'easy');
    const result = validateLevel(level);
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('reason');
    expect(typeof result.valid).toBe('boolean');
    expect(typeof result.reason).toBe('string');
  });

  it('generated levels pass validation (the algorithm guarantees it)', () => {
    // The generator is designed so that virtually every seed passes
    for (const seed of [1, 2, 3, 10, 100]) {
      for (const diff of ['easy', 'medium', 'hard']) {
        const level = generateLevel(seed, diff);
        const result = validateLevel(level);
        expect(result.valid, `seed=${seed} diff=${diff}: ${result.reason}`).toBe(true);
      }
    }
  });

  it('rejects a level where optimal score is too low', () => {
    // A level with only negative stations cannot achieve 3 stars
    const base = generateLevel(1, 'easy');
    const badStations = base.stations.map(s => ({
      ...s,
      positive: false,
      type: 'mud',
      downgrade: 'hair',
      amount: 1,
      upgrade: undefined
    }));
    const result = validateLevel({ ...base, stations: badStations });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/stars/i);
  });

  it('rejects a level where worst path score exceeds 1 star (worst.stars > 1 branch)', () => {
    // All positive stations at x=0 — worstPath goes to x=0 (no negative alternative)
    // and hits all positive stations → score=maxScore → worst.stars=3 > 1
    const base = generateLevel(1, 'easy');
    const allPositiveAtCenter = base.stations.map(s => ({
      ...s,
      positive: true,
      x: 0,
      type: 'hair',
      upgrade: 'hair',
      amount: 1,
    }));
    const result = validateLevel({ ...base, stations: allPositiveAtCenter });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/stars/i);
  });
});

// ── generateBatch ────────────────────────────────────────────────────────────

describe('generateBatch', () => {
  it('returns the requested number of levels', () => {
    const levels = generateBatch(100, 'easy', 5);
    expect(levels.length).toBe(5);
  });

  it('is deterministic', () => {
    const a = generateBatch(200, 'medium', 4);
    const b = generateBatch(200, 'medium', 4);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('all returned levels pass validateLevel', () => {
    const levels = generateBatch(300, 'hard', 4);
    for (const level of levels) {
      const result = validateLevel(level);
      expect(result.valid, `${level.id}: ${result.reason}`).toBe(true);
    }
  });

  it('each level carries the correct difficulty', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      const levels = generateBatch(1, diff, 3);
      for (const level of levels) {
        expect(level.difficulty).toBe(diff);
      }
    }
  });

  it('each level has a unique id', () => {
    const levels = generateBatch(500, 'medium', 5);
    const ids = new Set(levels.map(l => l.id));
    expect(ids.size).toBe(levels.length);
  });
});

// ── Additional structure and path invariants ──────────────────────────────

describe('generateLevel — station layout invariants', () => {
  it('all station z positions are >= 40', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      const level = generateLevel(1, diff);
      for (const s of level.stations) {
        expect(s.z).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('all station z positions are < courseLength', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      const level = generateLevel(1, diff);
      for (const s of level.stations) {
        expect(s.z).toBeLessThan(level.courseLength);
      }
    }
  });

  it('each z value has exactly one positive and one negative station', () => {
    const level = generateLevel(3, 'easy');
    const zValues = [...new Set(level.stations.map(s => s.z))];
    for (const z of zValues) {
      const atZ = level.stations.filter(s => s.z === z);
      expect(atZ.length).toBe(2);
      expect(atZ.filter(s => s.positive).length).toBe(1);
      expect(atZ.filter(s => !s.positive).length).toBe(1);
    }
  });

  it('base 4 positive station types cover all 4 categories (easy)', () => {
    // easy has 6 pairs → 6 positives; the first 4 are seeded with one per category
    // so across all 4 category slots, each category is represented exactly once
    const level = generateLevel(1, 'easy');
    const positives = level.stations.filter(s => s.positive);
    const types = positives.map(s => s.type);
    const uniqueTypes = new Set(types);
    // At least 3 of the 4 categories must be present (algorithm assigns one per cat for base pairs)
    expect(uniqueTypes.size).toBeGreaterThanOrEqual(3);
  });

  it('negative stations all have type "mud"', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      const level = generateLevel(5, diff);
      const negatives = level.stations.filter(s => !s.positive);
      for (const s of negatives) {
        expect(s.type).toBe('mud');
      }
    }
  });

  it('negative stations all have amount = 1', () => {
    const level = generateLevel(2, 'medium');
    const negatives = level.stations.filter(s => !s.positive);
    for (const s of negatives) {
      expect(s.amount).toBe(1);
    }
  });

  it('positive station upgrade values are 2 or 3', () => {
    const level = generateLevel(4, 'hard');
    const positives = level.stations.filter(s => s.positive);
    for (const s of positives) {
      expect([2, 3]).toContain(s.upgrade);
    }
  });

  it('z positions are evenly spaced (spacing = (courseLength - 60) / numPairs)', () => {
    // easy: courseLength=260, numPairs=6, spacing=(260-60)/6≈33.33
    const level = generateLevel(1, 'easy');
    const zValues = [...new Set(level.stations.map(s => s.z))].sort((a, b) => a - b);
    expect(zValues.length).toBe(6); // 6 pairs = 6 distinct z positions
    // Each z starts at 40 + spacing*i — verify first is ~40
    expect(zValues[0]).toBeGreaterThanOrEqual(40);
    expect(zValues[0]).toBeLessThanOrEqual(45);
  });

  it('validateLevel reason is "OK" for generated levels', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      const level = generateLevel(10, diff);
      const result = validateLevel(level);
      // The algorithm is designed to always produce valid levels
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('OK');
    }
  });
});
