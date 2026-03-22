/**
 * Bridge Race - Generator Unit Tests
 *
 * Tests for: generateLevel (structure, determinism),
 *            validateLevel (valid/invalid cases),
 *            generateBatch (count, determinism, all-valid).
 */

import { describe, it, expect } from 'vitest';
import {
  generateLevel,
  validateLevel,
  generateBatch,
} from '../../src/games/bridge-race/generator.js';

// ── generateLevel ────────────────────────────────────────────────────────────

describe('generateLevel', () => {
  describe('structure', () => {
    it('returns required top-level fields', () => {
      const level = generateLevel(1, 'easy');
      expect(level).toHaveProperty('id');
      expect(level).toHaveProperty('arenaWidth');
      expect(level).toHaveProperty('finishZ');
      expect(level).toHaveProperty('playerColor');
      expect(level).toHaveProperty('opponents');
      expect(level).toHaveProperty('bridges');
      expect(level).toHaveProperty('blockPiles');
      expect(level).toHaveProperty('difficulty');
    });

    it('id encodes difficulty, index, and seed', () => {
      const level = generateLevel(42, 'hard', 7);
      expect(level.id).toBe('gen-hard-7-42');
    });

    it('playerColor is always blue', () => {
      for (const diff of ['easy', 'medium', 'hard']) {
        const level = generateLevel(1, diff);
        expect(level.playerColor).toBe('blue');
      }
    });

    it('arenaWidth is always 24', () => {
      expect(generateLevel(1, 'easy').arenaWidth).toBe(24);
      expect(generateLevel(2, 'hard').arenaWidth).toBe(24);
    });

    it('easy difficulty produces 1 opponent', () => {
      const level = generateLevel(1, 'easy');
      expect(level.difficulty).toBe('easy');
      expect(level.opponents.length).toBe(1);
    });

    it('medium difficulty produces 2 opponents', () => {
      const level = generateLevel(1, 'medium');
      expect(level.opponents.length).toBe(2);
    });

    it('hard difficulty produces 2 opponents', () => {
      const level = generateLevel(1, 'hard');
      expect(level.opponents.length).toBe(2);
    });

    it('each bridge has z and required fields', () => {
      const level = generateLevel(10, 'medium');
      expect(level.bridges.length).toBeGreaterThan(0);
      for (const bridge of level.bridges) {
        expect(typeof bridge.z).toBe('number');
        expect(typeof bridge.required).toBe('number');
        expect(bridge.required).toBeGreaterThan(0);
      }
    });

    it('each blockPile has x, z, color, and count', () => {
      const level = generateLevel(10, 'medium');
      for (const pile of level.blockPiles) {
        expect(typeof pile.x).toBe('number');
        expect(typeof pile.z).toBe('number');
        expect(typeof pile.color).toBe('string');
        expect(pile.count).toBeGreaterThan(0);
      }
    });

    it('finishZ is within the configured range for easy', () => {
      // easy: finishZBase=90, offset [0,30] → [90, 120]
      const level = generateLevel(1, 'easy');
      expect(level.finishZ).toBeGreaterThanOrEqual(90);
      expect(level.finishZ).toBeLessThanOrEqual(120);
    });

    it('unknown difficulty falls back to medium', () => {
      const levelMedium = generateLevel(5, 'medium');
      const levelUnknown = generateLevel(5, 'unknown');
      // Both should use medium config; id will differ but opponent count matches
      expect(levelUnknown.opponents.length).toBe(levelMedium.opponents.length);
    });
  });

  describe('determinism', () => {
    it('same seed produces identical output', () => {
      const a = generateLevel(999, 'medium', 0);
      const b = generateLevel(999, 'medium', 0);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('different seeds produce different output', () => {
      const a = generateLevel(1, 'medium');
      const b = generateLevel(2, 'medium');
      expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    });
  });
});

// ── validateLevel ────────────────────────────────────────────────────────────

describe('validateLevel', () => {
  it('accepts valid levels from generateBatch', () => {
    const levels = generateBatch(100, 'easy', 3);
    for (const level of levels) {
      const result = validateLevel(level);
      expect(result.valid, `${level.id}: ${result.reason}`).toBe(true);
    }
  });

  it('returns { valid, reason } shape', () => {
    const level = generateLevel(1, 'easy');
    const result = validateLevel(level);
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('reason');
    expect(typeof result.valid).toBe('boolean');
    expect(typeof result.reason).toBe('string');
  });

  it('rejects a level with no bridges', () => {
    const level = { ...generateLevel(1, 'easy'), bridges: [] };
    expect(validateLevel(level).valid).toBe(false);
    expect(validateLevel(level).reason).toMatch(/No bridges/i);
  });

  it('rejects a level with insufficient blue blocks', () => {
    const level = generateLevel(1, 'easy');
    // Strip all blue block piles
    const modified = { ...level, blockPiles: level.blockPiles.filter(p => p.color !== 'blue') };
    const result = validateLevel(modified);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Insufficient blue blocks/i);
  });

  it('rejects a level where a bridge z >= finishZ', () => {
    const level = generateLevel(1, 'easy');
    const badBridges = level.bridges.map(b => ({ ...b, z: level.finishZ + 5 }));
    const result = validateLevel({ ...level, bridges: badBridges });
    expect(result.valid).toBe(false);
  });

  it('rejects a level where bridge z values are not strictly increasing', () => {
    const level = generateLevel(1, 'medium');
    if (level.bridges.length < 2) return; // skip if only 1 bridge
    const [first, second, ...rest] = level.bridges;
    // Make second bridge z equal to first
    const badBridges = [first, { ...second, z: first.z }, ...rest];
    const result = validateLevel({ ...level, bridges: badBridges });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not strictly increasing/i);
  });
});

// ── generateBatch ────────────────────────────────────────────────────────────

describe('generateBatch', () => {
  it('returns the requested number of levels', () => {
    const levels = generateBatch(500, 'easy', 5);
    expect(levels.length).toBe(5);
  });

  it('is deterministic', () => {
    const a = generateBatch(1000, 'medium', 4);
    const b = generateBatch(1000, 'medium', 4);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('all returned levels pass validateLevel', () => {
    const levels = generateBatch(200, 'hard', 4);
    for (const level of levels) {
      const result = validateLevel(level);
      expect(result.valid, `${level.id}: ${result.reason}`).toBe(true);
    }
  });

  it('each level has a unique id', () => {
    const levels = generateBatch(300, 'medium', 5);
    const ids = new Set(levels.map(l => l.id));
    expect(ids.size).toBe(levels.length);
  });

  it('works for all three difficulties', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      const levels = generateBatch(42, diff, 2);
      expect(levels.length).toBe(2);
      for (const level of levels) {
        expect(level.difficulty).toBe(diff);
      }
    }
  });
});
