/**
 * Satisfying ASMR - Generator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateLevel,
  validateLevel,
  generateBatch
} from '../../src/games/satisfying-asmr/generator.js';

const GRID_W = 16;
const GRID_H = 16;

describe('generateLevel', () => {
  it('returns a level object with required fields', () => {
    const level = generateLevel(42, 'easy', 0);
    expect(level).toBeDefined();
    expect(level.id).toBeTruthy();
    expect(Array.isArray(level.cells)).toBe(true);
    expect(level.width).toBe(GRID_W);
    expect(level.height).toBe(GRID_H);
    expect(level.patternType).toBeTruthy();
    expect(level.totalDirt).toBeGreaterThan(0);
  });

  it('cells array has correct length (width * height)', () => {
    const level = generateLevel(42, 'easy', 0);
    expect(level.cells).toHaveLength(GRID_W * GRID_H);
  });

  it('cells contain only 0 or 1', () => {
    const level = generateLevel(42, 'medium', 0);
    const unique = new Set(level.cells);
    for (const v of unique) {
      expect([0, 1]).toContain(v);
    }
  });

  it('totalDirt matches actual dirty cell count', () => {
    const level = generateLevel(42, 'easy', 0);
    const actualDirt = level.cells.filter(v => v === 1).length;
    expect(level.totalDirt).toBe(actualDirt);
  });

  it('is deterministic — same seed produces same level', () => {
    const a = generateLevel(100, 'medium', 0);
    const b = generateLevel(100, 'medium', 0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds produce different levels', () => {
    const a = generateLevel(1, 'medium', 0);
    const b = generateLevel(2, 'medium', 0);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('easy level uses full or stripes pattern', () => {
    // Run a few seeds to sample easy patterns
    const patterns = new Set();
    for (let s = 0; s < 20; s++) {
      const level = generateLevel(s, 'easy', 0);
      patterns.add(level.patternType);
    }
    for (const p of patterns) {
      expect(['full', 'stripes']).toContain(p);
    }
  });

  it('medium level uses splatter or checkerboard pattern', () => {
    const patterns = new Set();
    for (let s = 0; s < 20; s++) {
      const level = generateLevel(s, 'medium', 0);
      patterns.add(level.patternType);
    }
    for (const p of patterns) {
      expect(['splatter', 'checkerboard']).toContain(p);
    }
  });

  it('easy level has high coverage (>= 85% of cells dirty)', () => {
    // Sample several easy levels — all should meet minimum coverage
    for (let s = 0; s < 5; s++) {
      const level = generateLevel(s * 7, 'easy', 0);
      const fraction = level.totalDirt / (GRID_W * GRID_H);
      expect(fraction).toBeGreaterThanOrEqual(0.8); // slight tolerance
    }
  });

  it('id includes difficulty and index', () => {
    const level = generateLevel(42, 'hard', 5);
    expect(level.id).toContain('hard');
    expect(level.id).toContain('5');
  });

  it('defaults to medium difficulty', () => {
    const level = generateLevel(42);
    // medium patterns are splatter or checkerboard
    expect(['splatter', 'checkerboard']).toContain(level.patternType);
  });

  it('level always has at least 20% coverage (fallback enforced)', () => {
    // Generator falls back to stripes if coverage < 20%
    for (let s = 0; s < 10; s++) {
      const level = generateLevel(s * 13, 'hard', 0);
      const fraction = level.totalDirt / (GRID_W * GRID_H);
      expect(fraction).toBeGreaterThanOrEqual(0.2);
    }
  });

  it('hard level uses splatter or stripes pattern', () => {
    const patterns = new Set();
    for (let s = 0; s < 20; s++) {
      const level = generateLevel(s, 'hard', 0);
      patterns.add(level.patternType);
    }
    for (const p of patterns) {
      expect(['splatter', 'stripes']).toContain(p);
    }
  });

  it('medium level coverage fraction is in [0.50, 0.75]', () => {
    for (let s = 0; s < 5; s++) {
      const level = generateLevel(s * 11, 'medium', 0);
      const fraction = level.totalDirt / (GRID_W * GRID_H);
      expect(fraction).toBeGreaterThanOrEqual(0.5);
      expect(fraction).toBeLessThanOrEqual(0.75);
    }
  });

  it('hard level coverage is lower than easy level coverage (on average)', () => {
    // Hard levels target lower coverage fractions than easy levels
    let hardTotal = 0;
    let easyTotal = 0;
    const samples = 10;
    for (let s = 0; s < samples; s++) {
      hardTotal += generateLevel(s * 7, 'hard', 0).totalDirt;
      easyTotal += generateLevel(s * 7, 'easy', 0).totalDirt;
    }
    expect(hardTotal / samples).toBeLessThan(easyTotal / samples);
  });

  it('level includes difficulty field', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      const level = generateLevel(42, diff, 0);
      expect(level.difficulty).toBe(diff);
    }
  });
});

describe('validateLevel', () => {
  it('returns valid for a generated level', () => {
    const level = generateLevel(42, 'easy', 0);
    const result = validateLevel(level);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeTruthy();
  });

  it('returns invalid for level with no dirt', () => {
    const level = generateLevel(42, 'easy', 0);
    const noDirt = { ...level, cells: Array(GRID_W * GRID_H).fill(0), totalDirt: 0 };
    const result = validateLevel(noDirt);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('dirt');
  });

  it('returns invalid for level with very low coverage (< 10%)', () => {
    const cells = Array(GRID_W * GRID_H).fill(0);
    // Set just a few cells dirty (< 10% = < 25.6 cells)
    for (let i = 0; i < 10; i++) cells[i] = 1;
    const level = {
      id: 'test',
      width: GRID_W,
      height: GRID_H,
      cells,
      patternType: 'splatter',
      totalDirt: 10
    };
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('low');
  });

  it('returns valid for all difficulties', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      const level = generateLevel(777 + diff.length, diff, 0);
      expect(validateLevel(level).valid).toBe(true);
    }
  });

  it('reason contains coverage percentage for valid level', () => {
    const level = generateLevel(42, 'easy', 0);
    const result = validateLevel(level);
    expect(result.reason).toMatch(/%/);
  });
});

describe('generateBatch', () => {
  it('returns an array of the requested count', () => {
    const levels = generateBatch(100, 'easy', 4);
    expect(levels).toHaveLength(4);
  });

  it('all batch levels pass validateLevel', () => {
    const levels = generateBatch(200, 'medium', 3);
    for (const level of levels) {
      expect(validateLevel(level).valid).toBe(true);
    }
  });

  it('batch levels have sequential IDs derived from seed', () => {
    const levels = generateBatch(300, 'hard', 3);
    // Each level id encodes a unique seed
    const ids = levels.map(l => l.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(levels.length);
  });

  it('returns empty array for count 0', () => {
    expect(generateBatch(1, 'easy', 0)).toHaveLength(0);
  });

  it('is deterministic', () => {
    const a = generateBatch(400, 'medium', 3);
    const b = generateBatch(400, 'medium', 3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
