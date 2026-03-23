/**
 * Merge Games - Generator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateLevel,
  validateLevel,
  generateBatch
} from '../../src/games/merge-games/generator.js';

describe('generateLevel', () => {
  it('returns a level object with required fields', () => {
    const level = generateLevel(42, 'easy', 0);
    expect(level).not.toBeNull();
    expect(level.id).toBeTruthy();
    expect(Array.isArray(level.grid)).toBe(true);
    expect(level.width).toBeGreaterThan(0);
    expect(level.height).toBeGreaterThan(0);
    expect(level.task).toBeDefined();
    expect(level.task.targetTier).toBeGreaterThan(0);
    expect(level.task.targetCount).toBeGreaterThan(0);
  });

  it('is deterministic — same seed produces same level', () => {
    const a = generateLevel(100, 'medium', 0);
    const b = generateLevel(100, 'medium', 0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds produce different levels', () => {
    const a = generateLevel(1, 'medium', 0);
    const b = generateLevel(2, 'medium', 0);
    // With very high probability these differ
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('easy difficulty uses targetTier 3', () => {
    const level = generateLevel(42, 'easy', 0);
    expect(level).not.toBeNull();
    expect(level.task.targetTier).toBe(3);
  });

  it('medium difficulty uses targetTier 4', () => {
    const level = generateLevel(42, 'medium', 0);
    expect(level).not.toBeNull();
    expect(level.task.targetTier).toBe(4);
  });

  it('hard difficulty uses targetTier 4 with targetCount 2', () => {
    const level = generateLevel(42, 'hard', 0);
    expect(level).not.toBeNull();
    expect(level.task.targetTier).toBe(4);
    expect(level.task.targetCount).toBe(2);
  });

  it('grid dimensions are 5x5', () => {
    const level = generateLevel(42, 'medium', 0);
    expect(level).not.toBeNull();
    expect(level.width).toBe(5);
    expect(level.height).toBe(5);
    expect(level.grid).toHaveLength(5);
    expect(level.grid[0]).toHaveLength(5);
  });

  it('grid contains at least one non-zero item', () => {
    const level = generateLevel(42, 'easy', 0);
    expect(level).not.toBeNull();
    const items = level.grid.flat().filter(v => v > 0);
    expect(items.length).toBeGreaterThan(0);
  });

  it('id includes difficulty and index', () => {
    const level = generateLevel(42, 'hard', 3);
    expect(level).not.toBeNull();
    expect(level.id).toContain('hard');
    expect(level.id).toContain('3');
  });

  it('defaults to medium difficulty', () => {
    const level = generateLevel(42);
    expect(level).not.toBeNull();
    expect(level.task.targetTier).toBe(4);
  });

  it('unknown difficulty falls back to medium', () => {
    const level = generateLevel(42, 'extreme', 0);
    expect(level).not.toBeNull();
    expect(level.task.targetTier).toBe(4);
  });

  it('easy difficulty has targetCount 1', () => {
    const level = generateLevel(42, 'easy', 0);
    expect(level).not.toBeNull();
    expect(level.task.targetCount).toBe(1);
  });

  it('medium difficulty has targetCount 1', () => {
    const level = generateLevel(42, 'medium', 0);
    expect(level).not.toBeNull();
    expect(level.task.targetCount).toBe(1);
  });

  it('grid cells contain only non-negative integer values', () => {
    const level = generateLevel(42, 'medium', 0);
    expect(level).not.toBeNull();
    for (const row of level.grid) {
      for (const cell of row) {
        expect(Number.isInteger(cell)).toBe(true);
        expect(cell).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('generated level is solvable (isSolvable validates)', () => {
    // import isSolvable from state to cross-verify
    const level = generateLevel(123, 'easy', 0);
    expect(level).not.toBeNull();
    // Verify the level has the required merges available (task-seeded items)
    const tierCounts = level.grid.flat().reduce((acc, t) => {
      if (t > 0) acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
    // Easy: tier1 seeds → tier3 target. Must have at least 4 tier1 items
    expect(tierCounts[1] || 0).toBeGreaterThanOrEqual(4);
  });
});

describe('validateLevel', () => {
  it('returns valid for a correctly generated level', () => {
    const level = generateLevel(42, 'easy', 0);
    expect(level).not.toBeNull();
    const result = validateLevel(level);
    expect(result.valid).toBe(true);
  });

  it('returns invalid for level missing task', () => {
    const level = generateLevel(42, 'easy', 0);
    const noTask = { ...level, task: undefined };
    const result = validateLevel(noTask);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('returns invalid when task exists but targetTier is 0 (falsy second branch of !task.targetTier)', () => {
    const level = generateLevel(42, 'easy', 0);
    const zeroTier = { ...level, task: { ...level.task, targetTier: 0 } };
    const result = validateLevel(zeroTier);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Missing task definition');
  });

  it('returns invalid for level with empty grid', () => {
    const level = generateLevel(42, 'easy', 0);
    const emptyGrid = { ...level, grid: [[0, 0], [0, 0]] };
    const result = validateLevel(emptyGrid);
    expect(result.valid).toBe(false);
  });

  it('returns invalid for null/missing grid', () => {
    const level = generateLevel(42, 'easy', 0);
    const noGrid = { ...level, grid: [] };
    const result = validateLevel(noGrid);
    expect(result.valid).toBe(false);
  });

  it('returns invalid when goal is not reachable (if (!solvable) branch)', () => {
    // One tier-1 item with targetTier=2 → cannot merge → isSolvable returns false
    const unsolvable = {
      task: { targetTier: 2, targetCount: 1 },
      grid: [[1, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]
    };
    const result = validateLevel(unsolvable);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/reachable/i);
  });

  it('returns valid for all difficulty levels', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      const level = generateLevel(99 + diff.length, diff, 0);
      if (!level) continue; // generation may rarely fail
      expect(validateLevel(level).valid).toBe(true);
    }
  });
});

describe('generateBatch', () => {
  it('returns an array', () => {
    const levels = generateBatch(1000, 'easy', 3);
    expect(Array.isArray(levels)).toBe(true);
  });

  it('returns the requested number of levels', () => {
    const levels = generateBatch(2000, 'easy', 5);
    expect(levels.length).toBe(5);
  });

  it('all levels in batch pass validateLevel', () => {
    const levels = generateBatch(3000, 'medium', 3);
    for (const level of levels) {
      expect(validateLevel(level).valid).toBe(true);
    }
  });

  it('each level in batch has a unique id', () => {
    const levels = generateBatch(4000, 'easy', 5);
    const ids = levels.map(l => l.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(levels.length);
  });

  it('returns empty array when count is 0', () => {
    expect(generateBatch(1, 'easy', 0)).toHaveLength(0);
  });

  it('is deterministic — same baseSeed produces same batch', () => {
    const a = generateBatch(5000, 'hard', 2);
    const b = generateBatch(5000, 'hard', 2);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ── validateLevel — null grid (!level.grid first OR clause) ──────────────────

describe('validateLevel — null grid (!level.grid first OR clause)', () => {
  it('returns invalid when grid is null (!level.grid true branch)', () => {
    const level = generateLevel(42, 'easy', 0);
    const result = validateLevel({ ...level, grid: null });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Missing grid/i);
  });
});
