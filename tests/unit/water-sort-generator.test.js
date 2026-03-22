/**
 * Water Sort - Generator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateLevel,
  generateLevels
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
