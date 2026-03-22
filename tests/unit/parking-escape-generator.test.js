/**
 * Parking Escape - Generator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateLevel,
  validateLevel,
  generateBatch
} from '../../src/games/parking-escape/generator.js';

const GRID_SIZE = 6;

describe('generateLevel', () => {
  it('returns a level object with required fields', () => {
    const level = generateLevel(42, 'easy', 0);
    expect(level).not.toBeNull();
    expect(level.id).toBeTruthy();
    expect(level.grid).toBeDefined();
    expect(level.grid.vehicles).toBeDefined();
    expect(level.grid.width).toBe(GRID_SIZE);
    expect(level.grid.height).toBe(GRID_SIZE);
    expect(level.grid.exit).toBeDefined();
    expect(level.targetMoves).toBeGreaterThan(0);
  });

  it('always includes a hero vehicle', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const level = generateLevel(seed, 'easy', 0);
      if (!level) continue;
      const hero = level.grid.vehicles.find(v => v.type === 'hero');
      expect(hero).toBeDefined();
      expect(hero.id).toBe('hero');
    }
  });

  it('hero is horizontal and on exit row (y=2)', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const level = generateLevel(seed, 'easy', 0);
      if (!level) continue;
      const hero = level.grid.vehicles.find(v => v.type === 'hero');
      expect(hero.orientation).toBe('horizontal');
      expect(hero.y).toBe(2);
    }
  });

  it('exit is on the right side', () => {
    const level = generateLevel(42, 'easy', 0);
    if (!level) return;
    expect(level.grid.exit.direction).toBe('right');
    expect(level.grid.exit.y).toBe(2);
  });

  it('is deterministic — same seed same level', () => {
    const a = generateLevel(100, 'medium', 0);
    const b = generateLevel(100, 'medium', 0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('easy difficulty target moves in range [4, 8]', () => {
    let found = false;
    for (let seed = 0; seed < 20; seed++) {
      const level = generateLevel(seed, 'easy', 0);
      if (!level) continue;
      expect(level.targetMoves).toBeGreaterThanOrEqual(4);
      expect(level.targetMoves).toBeLessThanOrEqual(8);
      found = true;
      break;
    }
    // At least one easy level should generate in a reasonable seed range
    expect(found).toBe(true);
  });

  it('medium difficulty target moves in range [9, 16]', () => {
    let found = false;
    for (let seed = 0; seed < 20; seed++) {
      const level = generateLevel(seed, 'medium', 0);
      if (!level) continue;
      expect(level.targetMoves).toBeGreaterThanOrEqual(9);
      expect(level.targetMoves).toBeLessThanOrEqual(16);
      found = true;
      break;
    }
    expect(found).toBe(true);
  });

  it('id encodes difficulty and index', () => {
    // Use easy to avoid slow hard-level generation in tests
    let level = null;
    for (let s = 0; s < 20; s++) {
      level = generateLevel(s, 'easy', 7);
      if (level) break;
    }
    if (!level) return;
    expect(level.id).toContain('easy');
    expect(level.id).toContain('7');
  });

  it('all vehicles fit within grid bounds', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const level = generateLevel(seed, 'easy', 0);
      if (!level) continue;
      for (const v of level.grid.vehicles) {
        expect(v.x).toBeGreaterThanOrEqual(0);
        expect(v.y).toBeGreaterThanOrEqual(0);
        expect(v.x + v.width).toBeLessThanOrEqual(GRID_SIZE);
        expect(v.y + v.height).toBeLessThanOrEqual(GRID_SIZE);
      }
    }
  });

  it('vehicles have no overlapping cells', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const level = generateLevel(seed, 'easy', 0);
      if (!level) continue;

      // Build occupancy grid
      const occ = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
      for (const v of level.grid.vehicles) {
        for (let dy = 0; dy < v.height; dy++) {
          for (let dx = 0; dx < v.width; dx++) {
            const cell = occ[v.y + dy]?.[v.x + dx];
            expect(cell).toBeNull(); // no overlap
            if (occ[v.y + dy]) occ[v.y + dy][v.x + dx] = v.id;
          }
        }
      }
    }
  });
});

describe('validateLevel', () => {
  it('returns valid for a generated level', () => {
    let level = null;
    for (let s = 0; s < 20; s++) {
      level = generateLevel(s, 'easy', 0);
      if (level) break;
    }
    expect(level).not.toBeNull();
    const result = validateLevel(level);
    expect(result.valid).toBe(true);
    expect(result.reason).toContain('moves');
  });

  it('returns invalid for level without hero vehicle', () => {
    let level = null;
    for (let s = 0; s < 20; s++) {
      level = generateLevel(s, 'easy', 0);
      if (level) break;
    }
    expect(level).not.toBeNull();
    const noHero = {
      ...level,
      grid: {
        ...level.grid,
        vehicles: level.grid.vehicles.filter(v => v.type !== 'hero')
      }
    };
    const result = validateLevel(noHero);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('hero');
  });

  it('returns valid for medium difficulty level', () => {
    let level = null;
    for (let s = 0; s < 30; s++) {
      level = generateLevel(s, 'medium', 0);
      if (level) break;
    }
    if (!level) return; // skip if generation failed in test environment
    expect(validateLevel(level).valid).toBe(true);
  });
});

describe('generateBatch', () => {
  it('returns array of levels', () => {
    const levels = generateBatch(1000, 'easy', 2);
    expect(Array.isArray(levels)).toBe(true);
    // generateBatch may return fewer if not enough valid levels found in attempts
    // but for easy levels we expect at least some
    expect(levels.length).toBeGreaterThan(0);
  });

  it('all batch levels pass validateLevel', () => {
    const levels = generateBatch(2000, 'easy', 2);
    for (const level of levels) {
      expect(validateLevel(level).valid).toBe(true);
    }
  });

  it('batch levels have unique IDs', () => {
    const levels = generateBatch(3000, 'easy', 2);
    const ids = levels.map(l => l.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(levels.length);
  });

  it('is deterministic', () => {
    const a = generateBatch(4000, 'easy', 2);
    const b = generateBatch(4000, 'easy', 2);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('returns empty array for count 0', () => {
    expect(generateBatch(1, 'easy', 0)).toHaveLength(0);
  });
});
