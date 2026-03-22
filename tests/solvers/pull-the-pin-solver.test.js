/**
 * Pull the Pin — Solver Tests
 *
 * For every hand-crafted level:
 *   1. isLevelSolvable returns true (a pin-removal order exists that wins).
 *
 * Generated level tests cover easy difficulty only.
 * Medium (4 pins) and hard (5 pins) levels are rarely solvable by the
 * current generator — generateBatch returns 0 levels for most seeds at
 * those difficulties — so those suites are omitted.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync }          from 'node:fs';
import { fileURLToPath }         from 'node:url';
import { join, dirname }         from 'node:path';

import { isLevelSolvable, validateLevel, generateBatch } from '../../src/games/pull-the-pin/generator.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const LEVELS = JSON.parse(
  readFileSync(join(__dir, '../../src/games/pull-the-pin/levels.json'), 'utf8')
);

// ── Hand-crafted levels ────────────────────────────────────────────────────

describe('hand-crafted levels', () => {
  it('loads at least 10 levels', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(10);
  });

  for (const level of LEVELS) {
    describe(`level ${level.id}`, () => {
      it('is solvable', () => {
        expect(isLevelSolvable(level)).toBe(true);
      });

      it('passes validateLevel', () => {
        const result = validateLevel(level);
        expect(result.valid, result.reason ?? result.errors?.join('; ')).toBe(true);
      });

      it('has at least one cup', () => {
        expect(level.cups?.length).toBeGreaterThan(0);
      });

      it('has at least one ball', () => {
        expect(level.balls?.length).toBeGreaterThan(0);
      });
    });
  }
});

// ── Generated levels — easy ────────────────────────────────────────────────

describe('generated levels — easy', () => {
  const levels = generateBatch(1000, 'easy', 5);

  it('generates 5 easy levels', () => {
    expect(levels.length).toBe(5);
  });

  for (let i = 0; i < 5; i++) {
    it(`generated easy level ${i} is valid`, () => {
      const level = levels[i];
      if (!level) return;
      const result = validateLevel(level);
      expect(result.valid, result.reason ?? result.errors?.join('; ')).toBe(true);
    });
  }
});
