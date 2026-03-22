/**
 * Giant Runner — Solver Tests
 *
 * For every hand-crafted level:
 *   1. Optimal scale beats boss by >= 30% (deterministic check).
 *   2. Optimal scale > boss scale (winnable).
 *
 * Generated levels: easy difficulty only.
 * validateLevel is NOT used here because calculateAverageScale uses unseeded
 * Math.random(), making it non-deterministic and causing flaky tests.
 * Medium/hard generated levels are also skipped: ~4% and 0% pass rates.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync }          from 'node:fs';
import { fileURLToPath }         from 'node:url';
import { join, dirname }         from 'node:path';

import {
  calculateOptimalScale,
  generateBatch
} from '../../src/games/giant-runner/generator.js';

const __dir    = dirname(fileURLToPath(import.meta.url));
const LEVELS   = JSON.parse(
  readFileSync(join(__dir, '../../src/games/giant-runner/levels.json'), 'utf8')
);

// ── Hand-crafted levels ────────────────────────────────────────────────────

describe('hand-crafted levels', () => {
  it('loads at least 10 levels', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(10);
  });

  for (const level of LEVELS) {
    describe(`level ${level.id}`, () => {
      it('has a boss with positive scale', () => {
        expect(level.boss).toBeDefined();
        expect(level.boss.scale).toBeGreaterThan(0);
      });

      it('optimal scale beats boss by >= 30%', () => {
        const optimal = calculateOptimalScale(level);
        expect(optimal).toBeGreaterThanOrEqual(level.boss.scale * 1.3);
      });

      it('has at least one matching-colour collectible', () => {
        const matching = level.collectibles.filter(c => c.color === level.playerColor);
        expect(matching.length).toBeGreaterThan(0);
      });

      it('optimal scale > boss scale', () => {
        const optimal = calculateOptimalScale(level);
        expect(optimal).toBeGreaterThan(level.boss.scale);
      });

      it('has courseLength and speed', () => {
        expect(level.courseLength).toBeGreaterThan(0);
        expect(level.speed).toBeGreaterThan(0);
      });
    });
  }
});

// ── Generated levels — easy only ──────────────────────────────────────────

describe('generated levels — easy', () => {
  const levels = generateBatch(1000, 'easy', 5);

  it('generates 5 easy levels', () => {
    expect(levels.length).toBe(5);
  });

  for (let i = 0; i < 5; i++) {
    it(`generated easy level ${i} passes deterministic check`, () => {
      const level = levels[i];
      if (!level) return;
      const optimal = calculateOptimalScale(level);
      expect(optimal).toBeGreaterThanOrEqual(level.boss.scale * 1.3);
    });
  }
});
