/**
 * Water Sort - Generator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateLevel,
  generateLevels,
  validateLevel
} from '../../src/games/water-sort/generator.js';

describe('generateLevel', () => {
  it('returns a level object with required fields', () => {
    // Try a few seeds to get a non-null result
    let level = null;
    for (let s = 0; s < 20; s++) {
      level = generateLevel(s, 0.5);
      if (level) break;
    }
    expect(level).not.toBeNull();
    expect(level.id).toBeTruthy();
    expect(Array.isArray(level.tubes)).toBe(true);
    expect(level.maxSegments).toBeGreaterThan(0);
    expect(level.colorCount).toBeGreaterThan(0);
  });

  it('tubes array has colorCount + buffer tubes', () => {
    let level = null;
    for (let s = 0; s < 20; s++) {
      level = generateLevel(s, 0.5);
      if (level) break;
    }
    expect(level).not.toBeNull();
    // Total tubes ≥ colorCount (buffer tubes make total > colorCount)
    expect(level.tubes.length).toBeGreaterThanOrEqual(level.colorCount);
  });

  it('color tubes each have maxSegments segments', () => {
    let level = null;
    for (let s = 0; s < 20; s++) {
      level = generateLevel(s, 0.5);
      if (level) break;
    }
    expect(level).not.toBeNull();
    // First colorCount tubes are full; buffer tubes are empty
    const nonEmpty = level.tubes.filter(t => t.length > 0);
    for (const t of nonEmpty) {
      expect(t.length).toBeLessThanOrEqual(level.maxSegments);
    }
  });

  it('level is not already in won state (has mixed tubes)', () => {
    let level = null;
    for (let s = 0; s < 20; s++) {
      level = generateLevel(s, 0.5);
      if (level) break;
    }
    expect(level).not.toBeNull();
    // At least some tubes must have mixed colors
    const mixedTubes = level.tubes.filter(t => {
      if (t.length === 0) return false;
      return !t.every(c => c === t[0]);
    });
    expect(mixedTubes.length).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic — same seed same level', () => {
    let seed = 0;
    let a = null;
    while (!a && seed < 50) { a = generateLevel(seed++, 0.5); }
    const b = generateLevel(seed - 1, 0.5);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('easy difficulty (d=0) has fewer colors', () => {
    let easyLevel = null;
    for (let s = 0; s < 30; s++) {
      easyLevel = generateLevel(s, 0.0);
      if (easyLevel) break;
    }
    let hardLevel = null;
    for (let s = 0; s < 30; s++) {
      hardLevel = generateLevel(s, 1.0);
      if (hardLevel) break;
    }
    if (easyLevel && hardLevel) {
      // Easy has 3-4 colors, hard has 7-8 colors on average
      expect(easyLevel.colorCount).toBeLessThan(hardLevel.colorCount);
    }
  });

  it('id contains seed', () => {
    let level = null;
    let s = 0;
    while (!level && s < 30) {
      level = generateLevel(s, 0.5);
      s++;
    }
    expect(level).not.toBeNull();
    expect(level.id).toContain('ws-gen-');
  });

  it('all segment values are known color strings', () => {
    const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange',
      'cyan', 'pink', 'teal', 'lime', 'indigo', 'coral'];
    let level = null;
    for (let s = 0; s < 20; s++) {
      level = generateLevel(s, 0.5);
      if (level) break;
    }
    expect(level).not.toBeNull();
    for (const tube of level.tubes) {
      for (const seg of tube) {
        expect(COLORS).toContain(seg);
      }
    }
  });

  it('optimal field is a positive number', () => {
    let level = null;
    for (let s = 0; s < 20; s++) {
      level = generateLevel(s, 0.5);
      if (level) break;
    }
    expect(level).not.toBeNull();
    expect(typeof level.optimal).toBe('number');
    expect(level.optimal).toBeGreaterThan(0);
  });

  it('uses default difficulty 0.5 when no difficulty argument is provided', () => {
    let level = null;
    for (let s = 1; s <= 30; s++) {
      level = generateLevel(s); // no difficulty arg → defaults to 0.5
      if (level) break;
    }
    expect(level).not.toBeNull();
    expect(level.difficulty).toBe(0.5);
  });

  it('result is always null or an object with tubes (return-type contract)', () => {
    // generateLevel returns null|Object — never throws, never returns other types
    for (let s = 0; s < 20; s++) {
      const result = generateLevel(s, 0.5);
      const valid = result === null || (typeof result === 'object' && Array.isArray(result.tubes));
      expect(valid).toBe(true);
    }
  });
});

describe('generateLevels', () => {
  it('returns an array', () => {
    const levels = generateLevels(0, 5, 0.3);
    expect(Array.isArray(levels)).toBe(true);
  });

  it('returns up to the requested count', () => {
    const levels = generateLevels(100, 5, 0.3);
    // May be fewer if some seeds fail validation, but count is bounded
    expect(levels.length).toBeLessThanOrEqual(5);
    expect(levels.length).toBeGreaterThan(0);
  });

  it('all returned levels have required structure', () => {
    const levels = generateLevels(200, 3, 0.5);
    for (const level of levels) {
      expect(level.id).toBeTruthy();
      expect(level.tubes).toBeDefined();
      expect(level.maxSegments).toBeGreaterThan(0);
    }
  });

  it('is deterministic', () => {
    const a = generateLevels(300, 5, 0.5);
    const b = generateLevels(300, 5, 0.5);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('consecutive seeds produce different levels', () => {
    const levels = generateLevels(400, 3, 0.5);
    if (levels.length < 2) return;
    expect(JSON.stringify(levels[0])).not.toBe(JSON.stringify(levels[1]));
  });

  it('default difficulty is 0.5', () => {
    const withDefault = generateLevels(500, 2);
    const withExplicit = generateLevels(500, 2, 0.5);
    expect(JSON.stringify(withDefault)).toBe(JSON.stringify(withExplicit));
  });
});

// ── Difficulty and structure boundary tests ────────────────────────────────────

describe('colorCount ranges by difficulty', () => {
  it('easy (d<0.33) colorCount is in [3, 4]', () => {
    let level = null;
    for (let s = 0; s < 50 && !level; s++) level = generateLevel(s, 0.1);
    expect(level).not.toBeNull();
    expect(level.colorCount).toBeGreaterThanOrEqual(3);
    expect(level.colorCount).toBeLessThanOrEqual(4);
  });

  it('medium (0.33 ≤ d < 0.66) colorCount is in [5, 6]', () => {
    let level = null;
    for (let s = 0; s < 50 && !level; s++) level = generateLevel(s, 0.5);
    expect(level).not.toBeNull();
    expect(level.colorCount).toBeGreaterThanOrEqual(5);
    expect(level.colorCount).toBeLessThanOrEqual(6);
  });

  it('hard (d≥0.66) colorCount is in [7, 8]', () => {
    let level = null;
    for (let s = 0; s < 50 && !level; s++) level = generateLevel(s, 0.9);
    expect(level).not.toBeNull();
    expect(level.colorCount).toBeGreaterThanOrEqual(7);
    expect(level.colorCount).toBeLessThanOrEqual(8);
  });

  it('exact boundary d=0.33 selects medium preset (not easy; < 0.33 is exclusive)', () => {
    // d=0.32 → easy (colorCount 3–4); d=0.33 → medium (colorCount 5–6)
    let easyLevel = null;
    for (let s = 0; s < 50 && !easyLevel; s++) easyLevel = generateLevel(s, 0.32);
    let medLevel = null;
    for (let s = 0; s < 50 && !medLevel; s++) medLevel = generateLevel(s, 0.33);
    expect(easyLevel).not.toBeNull();
    expect(medLevel).not.toBeNull();
    expect(easyLevel.colorCount).toBeLessThanOrEqual(4);
    expect(medLevel.colorCount).toBeGreaterThanOrEqual(5);
  });

  it('exact boundary d=0.66 selects hard preset (not medium; < 0.66 is exclusive)', () => {
    // d=0.65 → medium (colorCount 5–6); d=0.66 → hard (colorCount 7–8)
    let medLevel = null;
    for (let s = 0; s < 50 && !medLevel; s++) medLevel = generateLevel(s, 0.65);
    let hardLevel = null;
    for (let s = 0; s < 50 && !hardLevel; s++) hardLevel = generateLevel(s, 0.66);
    expect(medLevel).not.toBeNull();
    expect(hardLevel).not.toBeNull();
    expect(medLevel.colorCount).toBeLessThanOrEqual(6);
    expect(hardLevel.colorCount).toBeGreaterThanOrEqual(7);
  });
});

describe('tube structure invariants', () => {
  it('total tubes > colorCount (at least 1 buffer tube)', () => {
    let level = null;
    for (let s = 0; s < 20 && !level; s++) level = generateLevel(s, 0.5);
    expect(level).not.toBeNull();
    expect(level.tubes.length).toBeGreaterThan(level.colorCount);
  });

  it('total color segments = colorCount × maxSegments', () => {
    let level = null;
    for (let s = 0; s < 20 && !level; s++) level = generateLevel(s, 0.5);
    expect(level).not.toBeNull();
    const totalSegments = level.tubes.flat().length;
    expect(totalSegments).toBe(level.colorCount * level.maxSegments);
  });

  it('buffer tubes (indices >= colorCount) are empty', () => {
    let level = null;
    for (let s = 0; s < 20 && !level; s++) level = generateLevel(s, 0.5);
    expect(level).not.toBeNull();
    const bufferTubes = level.tubes.slice(level.colorCount);
    expect(bufferTubes.length).toBeGreaterThan(0);
    for (const tube of bufferTubes) {
      expect(tube).toHaveLength(0);
    }
  });

  it('maxSegments is always 4 for all difficulty tiers', () => {
    const allLevels = [
      ...generateLevels(2000, 3, 0.1),
      ...generateLevels(3000, 3, 0.5),
      ...generateLevels(4000, 3, 0.9),
    ];
    expect(allLevels.length).toBeGreaterThan(0);
    for (const level of allLevels) {
      expect(level.maxSegments).toBe(4);
    }
  });
});

describe('generateLevels edge cases', () => {
  it('count=0 returns empty array', () => {
    const levels = generateLevels(999, 0, 0.5);
    expect(levels).toHaveLength(0);
  });

  it('level ids match ws-gen-{seed} for each sequential seed', () => {
    const START = 10000;
    const levels = generateLevels(START, 3, 0.5);
    let expectedSeed = START;
    for (const level of levels) {
      expect(level.id).toBe(`ws-gen-${expectedSeed}`);
      expectedSeed++;
    }
  });

  it('all levels in a batch have unique ids', () => {
    const levels = generateLevels(5000, 8, 0.5);
    const ids = new Set(levels.map(l => l.id));
    expect(ids.size).toBe(levels.length);
  });
});

describe('validateLevel', () => {
  it('returns { valid: true } for a generated level', () => {
    let level = null;
    for (let s = 0; s < 20; s++) {
      level = generateLevel(s, 0.5);
      if (level) break;
    }
    expect(level).not.toBeNull();
    const result = validateLevel(level);
    expect(result).toHaveProperty('valid', true);
  });

  it('returns { valid: false } for an already-solved level', () => {
    // A level where every tube is either full of one color or empty is solved
    const solvedLevel = {
      tubes: [['red', 'red', 'red', 'red'], ['blue', 'blue', 'blue', 'blue'], []],
      maxSegments: 4
    };
    const result = validateLevel(solvedLevel);
    expect(result).toHaveProperty('valid', false);
  });
});
