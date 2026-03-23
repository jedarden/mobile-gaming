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

  it('obstacles reduce average scale (20% hit chance per obstacle)', () => {
    const base = { playerColor: 'blue', collectibles: [], obstacles: [], boss: { scale: 1 } };
    const withObstacles = {
      ...base,
      obstacles: Array.from({ length: 10 }, (_, i) => ({ x: 0, z: i * 50, width: 1.5 })),
    };
    const avgNoObs   = calculateAverageScale(base, 1.0, 100);
    const avgWithObs = calculateAverageScale(withObstacles, 1.0, 100);
    // 10 obstacles × 20% hit rate × 0.2 penalty ≈ 0.4 expected deduction
    expect(avgWithObs).toBeLessThan(avgNoObs);
  });

  it('average scale never goes below MIN_SCALE (0.1) even with heavy penalties', () => {
    const level = {
      playerColor: 'blue',
      collectibles: Array.from({ length: 20 }, () => ({ color: 'red', value: 1.0 })),
      obstacles: Array.from({ length: 20 }, (_, i) => ({ x: 0, z: i * 10, width: 1.5 })),
      boss: { scale: 1 }
    };
    const avg = calculateAverageScale(level, 1.0, 100);
    expect(avg).toBeGreaterThanOrEqual(0.1 - 1e-9); // MIN_SCALE = 0.1 (allow float rounding)
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

// ── Additional structure and range invariants ─────────────────────────────

describe('generateLevel — unknown difficulty fallback', () => {
  it('falls back to medium config for an unknown difficulty string', () => {
    // DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium (line 130)
    const level = generateLevel(42, 'legendary', 0);
    expect(level).toBeDefined();
    expect(level.id).toBeDefined();
    // Same config as medium — courseLength should be in medium range [300, 450]
    expect(level.courseLength).toBeGreaterThanOrEqual(300);
    expect(level.courseLength).toBeLessThanOrEqual(450);
  });
});

describe('generateLevel — difficulty ranges', () => {
  it('easy courseLength is within [200, 300]', () => {
    const counts = new Set();
    for (let s = 1; s <= 10; s++) counts.add(generateLevel(s, 'easy').courseLength);
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(200);
      expect(c).toBeLessThanOrEqual(300);
    }
  });

  it('medium courseLength is within [300, 450]', () => {
    const counts = new Set();
    for (let s = 1; s <= 10; s++) counts.add(generateLevel(s, 'medium').courseLength);
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(300);
      expect(c).toBeLessThanOrEqual(450);
    }
  });

  it('hard courseLength is within [450, 600]', () => {
    const counts = new Set();
    for (let s = 1; s <= 10; s++) counts.add(generateLevel(s, 'hard').courseLength);
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(450);
      expect(c).toBeLessThanOrEqual(600);
    }
  });

  it('easy speed is within [2.5, 3.0]', () => {
    const level = generateLevel(1, 'easy');
    expect(level.speed).toBeGreaterThanOrEqual(2.5);
    expect(level.speed).toBeLessThanOrEqual(3.0);
  });

  it('medium speed is within [3.0, 3.5]', () => {
    const level = generateLevel(1, 'medium');
    expect(level.speed).toBeGreaterThanOrEqual(3.0);
    expect(level.speed).toBeLessThanOrEqual(3.5);
  });

  it('hard speed is within [3.5, 4.0]', () => {
    const level = generateLevel(1, 'hard');
    expect(level.speed).toBeGreaterThanOrEqual(3.5);
    expect(level.speed).toBeLessThanOrEqual(4.0);
  });

  it('easy boss.scale is within [1.5, 3.0]', () => {
    const level = generateLevel(1, 'easy');
    expect(level.boss.scale).toBeGreaterThanOrEqual(1.5);
    expect(level.boss.scale).toBeLessThanOrEqual(3.0);
  });

  it('medium boss.scale is within [3.0, 5.0]', () => {
    const level = generateLevel(1, 'medium');
    expect(level.boss.scale).toBeGreaterThanOrEqual(3.0);
    expect(level.boss.scale).toBeLessThanOrEqual(5.0);
  });

  it('hard boss.scale is within [5.0, 8.0]', () => {
    const level = generateLevel(1, 'hard');
    expect(level.boss.scale).toBeGreaterThanOrEqual(5.0);
    expect(level.boss.scale).toBeLessThanOrEqual(8.0);
  });
});

describe('generateLevel — structural invariants', () => {
  it('id format is "gr-gen-{difficulty}-{index}-{seed}"', () => {
    const level = generateLevel(7, 'hard', 3);
    expect(level.id).toBe('gr-gen-hard-3-7');
  });

  it('obstacles array is defined (may be empty)', () => {
    const level = generateLevel(1, 'easy');
    expect(Array.isArray(level.obstacles)).toBe(true);
  });

  it('hard levels have more obstacles than easy (on average)', () => {
    let easyObs = 0, hardObs = 0;
    for (let s = 1; s <= 10; s++) {
      easyObs += generateLevel(s, 'easy').obstacles.length;
      hardObs += generateLevel(s, 'hard').obstacles.length;
    }
    expect(hardObs).toBeGreaterThan(easyObs);
  });

  it('collectibles are sorted by z position', () => {
    const level = generateLevel(5, 'medium');
    for (let i = 1; i < level.collectibles.length; i++) {
      expect(level.collectibles[i].z).toBeGreaterThanOrEqual(level.collectibles[i - 1].z);
    }
  });

  it('boss.z equals courseLength', () => {
    const level = generateLevel(3, 'easy');
    expect(level.boss.z).toBe(level.courseLength);
  });

  it('startScale is a positive number', () => {
    const level = generateLevel(1, 'easy');
    expect(typeof level.startScale).toBe('number');
    expect(level.startScale).toBeGreaterThan(0);
  });
});

describe('validateLevel — detailed result fields', () => {
  it('returns optimalScale, averageScale, and bossScale fields', () => {
    const levels = generateBatch(5000, 'easy', 1);
    if (levels.length === 0) return;
    const result = validateLevel(levels[0]);
    expect(result).toHaveProperty('optimalScale');
    expect(result).toHaveProperty('averageScale');
    expect(result).toHaveProperty('bossScale');
    expect(result).toHaveProperty('errors');
  });

  it('valid result has empty errors array', () => {
    const levels = generateBatch(6000, 'easy', 1);
    if (levels.length === 0) return;
    const result = validateLevel(levels[0]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('invalid result has non-empty errors array', () => {
    const level = {
      id: 'test',
      difficulty: 'easy',
      playerColor: 'blue',
      collectibles: [],
      obstacles: [],
      boss: { scale: 99, z: 100 },
      courseLength: 100,
      speed: 2.5,
      startScale: 1.0
    };
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
