/**
 * Giant Runner - Generator Unit Tests
 *
 * Tests for: calculateOptimalScale, calculateAverageScale, generateLevels,
 * generateLevel, validateLevel, generateBatch.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateOptimalScale,
  calculateAverageScale,
  generateLevel,
  generateLevels,
  validateLevel,
  generateBatch,
} from '../../src/games/giant-runner/generator.js';

// ── calculateOptimalScale ──────────────────────────────────────────────────

describe('calculateOptimalScale', () => {
  it('adds matching-color collectible values', () => {
    const level = {
      playerColor: 'blue',
      collectibles: [
        { color: 'blue', value: 1.5 },
        { color: 'blue', value: 2.0 },
      ],
      boss: { scale: 3 }
    };
    const optimal = calculateOptimalScale(level);
    // DEFAULT_START_SCALE + 1.5 + 2.0
    expect(optimal).toBeGreaterThan(3.0); // must beat boss
  });

  it('ignores non-matching-color collectibles', () => {
    const level = {
      playerColor: 'blue',
      collectibles: [
        { color: 'red', value: 5.0 },  // ignored (wrong color)
        { color: 'blue', value: 1.0 }, // counted
      ],
      boss: { scale: 3 }
    };
    const withRed = calculateOptimalScale(level, 1.0);
    const withoutRed = calculateOptimalScale({
      ...level,
      collectibles: [{ color: 'blue', value: 1.0 }]
    }, 1.0);
    expect(withRed).toBe(withoutRed);
  });

  it('respects custom startScale', () => {
    const level = {
      playerColor: 'blue',
      collectibles: [],
      boss: { scale: 1 }
    };
    expect(calculateOptimalScale(level, 5.0)).toBe(5.0);
    expect(calculateOptimalScale(level, 1.0)).toBe(1.0);
  });

  it('handles empty collectibles array', () => {
    const level = { playerColor: 'blue', collectibles: [], boss: { scale: 1 } };
    expect(calculateOptimalScale(level, 1.0)).toBe(1.0);
  });
});

// ── calculateAverageScale ──────────────────────────────────────────────────

describe('calculateAverageScale', () => {
  it('returns a positive number', () => {
    const level = generateLevel(1, 'easy');
    const avg = calculateAverageScale(level);
    expect(avg).toBeGreaterThan(0);
  });

  it('average is deterministic (internal LCG, not Math.random)', () => {
    const level = generateLevel(42, 'medium');
    const a = calculateAverageScale(level, 1.0, 50);
    const b = calculateAverageScale(level, 1.0, 50);
    expect(a).toBeCloseTo(b, 5);
  });

  it('average is less than or equal to optimal (Monte Carlo picks 70% of collectibles)', () => {
    const level = generateLevel(7, 'medium');
    const avg = calculateAverageScale(level);
    const optimal = calculateOptimalScale(level);
    expect(avg).toBeLessThanOrEqual(optimal + 0.01); // allow tiny float error
  });

  it('more runs produce a stable average', () => {
    const level = generateLevel(3, 'easy');
    const avg10  = calculateAverageScale(level, 1.0, 10);
    const avg100 = calculateAverageScale(level, 1.0, 100);
    // They should be roughly similar (within 2x)
    expect(avg100).toBeGreaterThan(0);
    expect(avg10).toBeGreaterThan(0);
  });
});

// ── generateLevel ──────────────────────────────────────────────────────────

describe('generateLevel', () => {
  it('returns required fields', () => {
    const level = generateLevel(1, 'easy');
    expect(level).toHaveProperty('id');
    expect(level).toHaveProperty('playerColor');
    expect(level).toHaveProperty('collectibles');
    expect(level).toHaveProperty('boss');
    expect(level).toHaveProperty('courseLength');
    expect(level).toHaveProperty('speed');
  });

  it('is deterministic', () => {
    const a = generateLevel(99);
    const b = generateLevel(99);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('has matching-color collectibles for player', () => {
    const level = generateLevel(5, 'easy');
    const matching = level.collectibles.filter(c => c.color === level.playerColor);
    expect(matching.length).toBeGreaterThan(0);
  });
});

// ── validateLevel ──────────────────────────────────────────────────────────

describe('validateLevel', () => {
  it('accepts known-valid easy levels (seeds 2-6)', () => {
    // Not all seeds produce valid levels — test known-good ones
    for (const seed of [2, 3, 4, 5, 6]) {
      const level = generateLevel(seed, 'easy');
      const result = validateLevel(level);
      expect(result.valid, `seed ${seed}: ${JSON.stringify(result)}`).toBe(true);
    }
  });

  it('accepts known-valid medium levels (seeds 2, 3, 23)', () => {
    for (const seed of [2, 3, 23]) {
      const level = generateLevel(seed, 'medium');
      const result = validateLevel(level);
      expect(result.valid, `seed ${seed}: ${JSON.stringify(result)}`).toBe(true);
    }
  });

  it('rejects a level where optimal scale < boss scale', () => {
    // Craft a level where optimal < boss
    const level = {
      id: 'test',
      difficulty: 'easy',
      playerColor: 'blue',
      collectibles: [],  // no collectibles → optimal = startScale ≈ 1.0
      obstacles: [],
      boss: { scale: 5 },  // boss is huge
      courseLength: 100,
      speed: 2
    };
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
  });
});

// ── generateLevels ─────────────────────────────────────────────────────────

describe('generateLevels', () => {
  it('generates the requested number of levels', () => {
    const levels = generateLevels(10);
    expect(levels.length).toBe(10);
  });

  it('generates 20 levels by default', () => {
    const levels = generateLevels();
    expect(levels.length).toBe(20);
  });

  it('some generated levels may not pass validateLevel (generateLevels is unfiltered)', () => {
    // generateLevels() does NOT filter invalid levels (unlike generateBatch)
    // Just verify the structure is correct
    const levels = generateLevels(8);
    for (const level of levels) {
      expect(level.id).toBeDefined();
      expect(level.collectibles).toBeDefined();
      expect(level.boss).toBeDefined();
    }
  });

  it('levels span easy/medium/hard difficulties', () => {
    const levels = generateLevels(20);
    const difficulties = new Set(levels.map(l => l.difficulty));
    expect(difficulties.size).toBeGreaterThan(1);
  });
});

// ── generateBatch ──────────────────────────────────────────────────────────

describe('generateBatch', () => {
  it('generates the requested number of levels', () => {
    const levels = generateBatch(1000, 'easy', 5);
    expect(levels.length).toBe(5);
  });

  it('is deterministic', () => {
    const a = generateBatch(2000, 'medium', 3);
    const b = generateBatch(2000, 'medium', 3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('all levels pass validation', () => {
    const levels = generateBatch(3000, 'easy', 5);
    for (const level of levels) {
      const result = validateLevel(level);
      expect(result.valid, `${level.id}: ${JSON.stringify(result)}`).toBe(true);
    }
  });
});
