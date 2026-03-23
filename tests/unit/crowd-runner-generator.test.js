/**
 * Crowd Runner - Generator Unit Tests
 *
 * Tests for: generateLevel (structure, determinism),
 *            validateLevel (valid/invalid cases),
 *            generateBatch (count, determinism, all-valid).
 *
 * Validation invariants (from generator):
 *   - optimal path beats boss
 *   - optimal path beats boss by ≥ 20% (margin ≥ 1.2×)
 *   - at least one path loses (worst ≤ boss)
 */

import { describe, it, expect } from 'vitest';
import {
  generateLevel,
  validateLevel,
  generateBatch,
} from '../../src/games/crowd-runner/generator.js';

// ── generateLevel ────────────────────────────────────────────────────────────

describe('generateLevel', () => {
  describe('structure', () => {
    it('returns required top-level fields', () => {
      const level = generateLevel(1, 'medium');
      expect(level).toHaveProperty('id');
      expect(level).toHaveProperty('startingCrowd');
      expect(level).toHaveProperty('courseLength');
      expect(level).toHaveProperty('speed');
      expect(level).toHaveProperty('gates');
      expect(level).toHaveProperty('boss');
      expect(level).toHaveProperty('difficulty');
    });

    it('id encodes difficulty, index, and seed', () => {
      const level = generateLevel(5, 'hard', 2);
      expect(level.id).toBe('gen-hard-2-5');
    });

    it('startingCrowd is within difficulty range', () => {
      const easyLevel = generateLevel(1, 'easy');
      expect(easyLevel.startingCrowd).toBeGreaterThanOrEqual(8);
      expect(easyLevel.startingCrowd).toBeLessThanOrEqual(12);

      const medLevel = generateLevel(1, 'medium');
      expect(medLevel.startingCrowd).toBeGreaterThanOrEqual(10);
      expect(medLevel.startingCrowd).toBeLessThanOrEqual(15);

      const hardLevel = generateLevel(1, 'hard');
      expect(hardLevel.startingCrowd).toBeGreaterThanOrEqual(10);
      expect(hardLevel.startingCrowd).toBeLessThanOrEqual(12);
    });

    it('courseLength is within difficulty range', () => {
      const easyLevel = generateLevel(1, 'easy');
      expect(easyLevel.courseLength).toBeGreaterThanOrEqual(350);
      expect(easyLevel.courseLength).toBeLessThanOrEqual(450);

      const hardLevel = generateLevel(1, 'hard');
      expect(hardLevel.courseLength).toBeGreaterThanOrEqual(600);
      expect(hardLevel.courseLength).toBeLessThanOrEqual(800);
    });

    it('gate count is within difficulty range', () => {
      const easyLevel = generateLevel(1, 'easy');
      expect(easyLevel.gates.length).toBeGreaterThanOrEqual(3);
      expect(easyLevel.gates.length).toBeLessThanOrEqual(4);

      const hardLevel = generateLevel(1, 'hard');
      expect(hardLevel.gates.length).toBeGreaterThanOrEqual(7);
      expect(hardLevel.gates.length).toBeLessThanOrEqual(9);
    });

    it('each gate has left and right operations with op and value', () => {
      const level = generateLevel(1, 'medium');
      const validOps = ['+', '−', '×', '÷'];
      for (const gate of level.gates) {
        expect(typeof gate.z).toBe('number');
        expect(validOps).toContain(gate.left.op);
        expect(validOps).toContain(gate.right.op);
        expect(typeof gate.left.value).toBe('number');
        expect(typeof gate.right.value).toBe('number');
        expect(gate.left.value).toBeGreaterThan(0);
        expect(gate.right.value).toBeGreaterThan(0);
      }
    });

    it('gates are positioned within course bounds (15%–85%)', () => {
      const level = generateLevel(10, 'medium');
      const lo = level.courseLength * 0.15;
      const hi = level.courseLength * 0.85;
      for (const gate of level.gates) {
        expect(gate.z).toBeGreaterThanOrEqual(Math.floor(lo));
        expect(gate.z).toBeLessThanOrEqual(Math.ceil(hi));
      }
    });

    it('boss has a positive size', () => {
      const level = generateLevel(1, 'medium');
      expect(level.boss).toHaveProperty('size');
      expect(level.boss.size).toBeGreaterThan(0);
    });

    it('speed is within difficulty range', () => {
      const level = generateLevel(1, 'easy');
      expect(level.speed).toBeGreaterThanOrEqual(1.4);
      expect(level.speed).toBeLessThanOrEqual(1.8);
    });

    it('unknown difficulty falls back to medium config', () => {
      const medium = generateLevel(3, 'medium');
      const unknown = generateLevel(3, 'unknown');
      expect(unknown.gates.length).toBe(medium.gates.length);
    });
  });

  describe('determinism', () => {
    it('same seed produces identical output', () => {
      const a = generateLevel(77, 'medium', 0);
      const b = generateLevel(77, 'medium', 0);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('different seeds produce different gate layouts', () => {
      const a = generateLevel(1, 'medium');
      const b = generateLevel(2, 'medium');
      expect(JSON.stringify(a.gates)).not.toBe(JSON.stringify(b.gates));
    });
  });
});

// ── validateLevel ────────────────────────────────────────────────────────────

describe('validateLevel', () => {
  it('returns { valid, reason } shape', () => {
    const level = generateLevel(1, 'medium');
    const result = validateLevel(level);
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('reason');
    expect(typeof result.valid).toBe('boolean');
    expect(typeof result.reason).toBe('string');
  });

  it('valid reason is "OK"', () => {
    // generateBatch guarantees valid levels
    const levels = generateBatch(100, 'easy', 1);
    if (levels.length > 0) {
      expect(validateLevel(levels[0]).reason).toBe('OK');
    }
  });

  it('rejects a level where no path can beat the boss', () => {
    // Make the boss enormous so even the optimal path loses
    const base = generateLevel(1, 'easy');
    const result = validateLevel({ ...base, boss: { size: 999999 } });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/No winning path/i);
  });

  it('rejects a level where optimal margin is below 1.2x', () => {
    // Construct a level where optimal=11, boss=10 → margin=1.1 < 1.2 → rejected
    // optimal(11) > boss(10) so line 175 passes; then margin 1.10 < 1.2 hits line 180
    const level = {
      id: 'test-margin',
      startingCrowd: 10,
      courseLength: 100,
      speed: 2,
      gates: [{ z: 50, left: { op: '+', value: 1 }, right: { op: '-', value: 9 }, crossed: false }],
      boss: { size: 10 },
    };
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Optimal margin too small/i);
  });

  it('rejects a level where worst path also beats the boss', () => {
    // Zero gates: only path = startingCrowd (10) > tiny boss (1)
    // worst=10 > boss=1 → "No losing path" → invalid
    const level = {
      id: 'test-no-losing',
      startingCrowd: 10,
      courseLength: 100,
      speed: 2,
      gates: [],
      boss: { size: 1 }
    };
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/No losing path/i);
  });

  it('rejects when optimal exactly equals boss size (boundary of <= condition)', () => {
    // No gates: optimal = worst = startingCrowd = boss.size = 10
    // optimal (10) <= boss (10) → "No winning path"
    const level = {
      id: 'test-exact-boundary',
      startingCrowd: 10,
      courseLength: 100,
      speed: 2,
      gates: [],
      boss: { size: 10 }
    };
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/No winning path/i);
  });

  it('accepts when worst path exactly equals boss size (worst > boss is false)', () => {
    // One gate with asymmetric ops: good side +10 (optimal=20), bad side +0 (worst=10)
    // optimal=20 > boss=10, margin=2.0 >= 1.2; worst=10 NOT > boss=10 → valid
    const level = {
      id: 'test-worst-boundary',
      startingCrowd: 10,
      courseLength: 100,
      speed: 2,
      gates: [{ z: 50, left: { op: '+', value: 10 }, right: { op: '+', value: 0 }, crossed: false }],
      boss: { size: 10 }
    };
    const result = validateLevel(level);
    expect(result.valid).toBe(true);
    expect(result.reason).toBe('OK');
  });
});

// ── generateBatch ────────────────────────────────────────────────────────────

describe('generateBatch', () => {
  it('returns the requested number of levels', () => {
    const levels = generateBatch(100, 'easy', 5);
    expect(levels.length).toBe(5);
  });

  it('is deterministic', () => {
    const a = generateBatch(200, 'medium', 3);
    const b = generateBatch(200, 'medium', 3);
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
      const levels = generateBatch(1, diff, 2);
      for (const level of levels) {
        expect(level.difficulty).toBe(diff);
      }
    }
  });

  it('each level has a unique id', () => {
    const levels = generateBatch(400, 'medium', 5);
    const ids = new Set(levels.map(l => l.id));
    expect(ids.size).toBe(levels.length);
  });
});

// ── Additional structure invariants ──────────────────────────────────────────

describe('generateLevel — additional invariants', () => {
  it('speed is within range for medium difficulty', () => {
    const level = generateLevel(1, 'medium');
    expect(level.speed).toBeGreaterThanOrEqual(1.8);
    expect(level.speed).toBeLessThanOrEqual(2.2);
  });

  it('speed is within range for hard difficulty', () => {
    const level = generateLevel(1, 'hard');
    expect(level.speed).toBeGreaterThanOrEqual(2.2);
    expect(level.speed).toBeLessThanOrEqual(2.8);
  });

  it('courseLength is within range for medium difficulty', () => {
    const level = generateLevel(1, 'medium');
    expect(level.courseLength).toBeGreaterThanOrEqual(450);
    expect(level.courseLength).toBeLessThanOrEqual(600);
  });

  it('gate count is within range for medium difficulty [5, 6]', () => {
    // Sample a few seeds to hit both ends of the range
    const counts = new Set();
    for (let s = 1; s <= 20; s++) {
      counts.add(generateLevel(s, 'medium').gates.length);
    }
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(5);
      expect(c).toBeLessThanOrEqual(6);
    }
  });

  it('gate z positions are strictly increasing', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      const level = generateLevel(7, diff);
      let last = -Infinity;
      for (const gate of level.gates) {
        expect(gate.z).toBeGreaterThan(last);
        last = gate.z;
      }
    }
  });

  it('boss.size is positive and passes validateLevel for generateBatch levels', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      const levels = generateBatch(1, diff, 3);
      for (const level of levels) {
        expect(level.boss.size).toBeGreaterThan(0);
        // generateBatch only returns validated levels — validateLevel guarantees
        // optimal path > boss.size (there is a winning path)
        const result = validateLevel(level);
        expect(result.valid).toBe(true);
      }
    }
  });

  it('boss.size is at least 2', () => {
    for (let s = 1; s <= 10; s++) {
      const level = generateLevel(s, 'easy');
      expect(level.boss.size).toBeGreaterThanOrEqual(2);
    }
  });

  it('speed is rounded to one decimal place', () => {
    for (let s = 1; s <= 10; s++) {
      const level = generateLevel(s, 'medium');
      const rounded = Math.round(level.speed * 10) / 10;
      expect(level.speed).toBeCloseTo(rounded, 5);
    }
  });

  it('good ops on left produce positive crowd change', () => {
    // Verify that at least one gate side always increases the crowd (a "good op")
    const level = generateLevel(42, 'easy');
    for (const gate of level.gates) {
      const leftOp  = gate.left;
      const rightOp = gate.right;
      // At least one side should be a + or × op (a "good" op)
      const hasGoodOp = [leftOp, rightOp].some(op => op.op === '+' || op.op === '×');
      expect(hasGoodOp).toBe(true);
    }
  });

  it('bad ops on right produce negative crowd change', () => {
    // At least one gate side per gate is a "bad" op (− or ÷)
    const level = generateLevel(42, 'easy');
    for (const gate of level.gates) {
      const hasHarmfulOp = [gate.left, gate.right].some(op => op.op === '−' || op.op === '÷');
      expect(hasHarmfulOp).toBe(true);
    }
  });

  it('gate operation values are all positive', () => {
    const level = generateLevel(1, 'hard');
    for (const gate of level.gates) {
      expect(gate.left.value).toBeGreaterThan(0);
      expect(gate.right.value).toBeGreaterThan(0);
    }
  });
});
