/**
 * Crowd Runner - Solver Tests
 *
 * For every hand-crafted level, exhaustively evaluate all 2^N gate paths and assert:
 *   1. At least one path beats the boss.
 *   2. Optimal path exceeds boss by ≥ 20%.
 *   3. At least one path loses.
 *
 * Also validates generated levels from generateBatch().
 */

import { describe, it, expect } from 'vitest';
import { readFileSync }           from 'node:fs';
import { fileURLToPath }          from 'node:url';
import { join, dirname }          from 'node:path';

import { evaluateAllPaths } from '../../src/games/crowd-runner/state.js';
import { generateBatch, validateLevel } from '../../src/games/crowd-runner/generator.js';

// ── Load hand-crafted levels ───────────────────────────────────────────────

const __dir   = dirname(fileURLToPath(import.meta.url));
const levelsPath = join(__dir, '../../src/games/crowd-runner/levels.json');
const LEVELS  = JSON.parse(readFileSync(levelsPath, 'utf8'));

// ── Hand-crafted level validation ─────────────────────────────────────────

describe('hand-crafted levels', () => {
  it('loads at least 10 levels', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(10);
  });

  for (const level of LEVELS) {
    describe(`level ${level.id}`, () => {
      const { optimal, worst, allResults } = evaluateAllPaths(level);

      it('has at least one winning path', () => {
        const wins = allResults.filter(c => c > level.boss.size);
        expect(wins.length).toBeGreaterThan(0);
      });

      it('optimal path beats boss by ≥ 20%', () => {
        const margin = optimal / level.boss.size;
        expect(margin).toBeGreaterThanOrEqual(1.2);
      });

      it('has at least one losing path', () => {
        const losses = allResults.filter(c => c <= level.boss.size);
        expect(losses.length).toBeGreaterThan(0);
      });

      it('starting crowd is a positive integer', () => {
        expect(level.startingCrowd).toBeGreaterThan(0);
        expect(Number.isInteger(level.startingCrowd)).toBe(true);
      });

      it('boss size is a positive integer', () => {
        expect(level.boss.size).toBeGreaterThan(0);
        expect(Number.isInteger(level.boss.size)).toBe(true);
      });

      it('all gates have z > 0', () => {
        for (const g of level.gates) {
          expect(g.z).toBeGreaterThan(0);
        }
      });

      it('all gate z values are before courseLength', () => {
        for (const g of level.gates) {
          expect(g.z).toBeLessThan(level.courseLength);
        }
      });

      it('both sides of each gate have valid operations', () => {
        const validOps = ['+', '−', '×', '÷'];
        for (const g of level.gates) {
          expect(validOps).toContain(g.left.op);
          expect(validOps).toContain(g.right.op);
          expect(g.left.value).toBeGreaterThan(0);
          expect(g.right.value).toBeGreaterThan(0);
        }
      });
    });
  }
});

// ── Generated level validation ─────────────────────────────────────────────

describe('generated levels — easy difficulty', () => {
  const levels = generateBatch(1000, 'easy', 10);

  it('generates 10 valid easy levels', () => {
    expect(levels.length).toBe(10);
  });

  for (let i = 0; i < 10; i++) {
    it(`generated easy level ${i} is valid`, () => {
      const level = levels[i];
      if (!level) return; // guard in case generation failed
      const { valid, reason } = validateLevel(level);
      expect(valid, reason).toBe(true);
    });
  }
});

describe('generated levels — medium difficulty', () => {
  const levels = generateBatch(2000, 'medium', 10);

  it('generates 10 valid medium levels', () => {
    expect(levels.length).toBe(10);
  });

  for (let i = 0; i < 10; i++) {
    it(`generated medium level ${i} is valid`, () => {
      const level = levels[i];
      if (!level) return;
      const { valid, reason } = validateLevel(level);
      expect(valid, reason).toBe(true);
    });
  }
});

describe('generated levels — hard difficulty', () => {
  const levels = generateBatch(3000, 'hard', 10);

  it('generates 10 valid hard levels', () => {
    expect(levels.length).toBe(10);
  });

  for (let i = 0; i < 10; i++) {
    it(`generated hard level ${i} is valid`, () => {
      const level = levels[i];
      if (!level) return;
      const { valid, reason } = validateLevel(level);
      expect(valid, reason).toBe(true);
    });
  }
});

// ── Solver properties ──────────────────────────────────────────────────────

describe('evaluateAllPaths properties', () => {
  it('optimal >= worst', () => {
    for (const level of LEVELS) {
      const { optimal, worst } = evaluateAllPaths(level);
      expect(optimal).toBeGreaterThanOrEqual(worst);
    }
  });

  it('evaluates exactly 2^N paths per level', () => {
    for (const level of LEVELS) {
      const { allResults } = evaluateAllPaths(level);
      expect(allResults.length).toBe(2 ** level.gates.length);
    }
  });

  it('all results are >= 1 (crowd never hits 0)', () => {
    for (const level of LEVELS) {
      const { allResults } = evaluateAllPaths(level);
      for (const r of allResults) {
        expect(r).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
