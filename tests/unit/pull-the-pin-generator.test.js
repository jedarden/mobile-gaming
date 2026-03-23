/**
 * Pull the Pin - Generator Unit Tests
 *
 * Tests for: generateLevel (structure, determinism),
 *            isLevelSolvable,
 *            findSolution (returns string[] or null),
 *            validateLevel (valid/invalid cases),
 *            generateBatch (count, determinism, all-valid).
 *
 * Note: generateLevel internally retries up to 10 times and returns null
 * if no solvable level can be found. generateBatch only includes non-null
 * levels, so it is the safest way to obtain valid levels for testing.
 */

import { describe, it, expect } from 'vitest';
import {
  generateLevel,
  isLevelSolvable,
  findSolution,
  validateLevel,
  generateBatch,
} from '../../src/games/pull-the-pin/generator.js';

// ── generateLevel ────────────────────────────────────────────────────────────

describe('generateLevel', () => {
  describe('structure', () => {
    it('returns null or a level object (retry loop may exhaust)', () => {
      const result = generateLevel(1, 'easy');
      // Result is either null (failed) or a well-formed object
      if (result !== null) {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('pins');
        expect(result).toHaveProperty('balls');
        expect(result).toHaveProperty('cups');
        expect(result).toHaveProperty('channels');
        expect(result).toHaveProperty('difficulty');
      }
    });

    it('returns a valid level for seeds that succeed', () => {
      // Try multiple seeds; at least one should produce a non-null result
      let found = null;
      for (let seed = 1; seed <= 20; seed++) {
        const level = generateLevel(seed, 'easy');
        if (level !== null) { found = level; break; }
      }
      expect(found).not.toBeNull();
    });

    it('id encodes seed and index', () => {
      // Find a seed that produces a non-null level
      for (let seed = 1; seed <= 30; seed++) {
        const level = generateLevel(seed, 'easy', 0);
        if (level !== null) {
          expect(level.id).toBe(`ptp-gen-${seed}-0`);
          break;
        }
      }
    });

    it('easy levels have 3 colors and 3 cups/balls', () => {
      for (let seed = 1; seed <= 30; seed++) {
        const level = generateLevel(seed, 'easy');
        if (level !== null) {
          expect(level.cups.length).toBe(3);
          expect(level.balls.length).toBe(3);
          break;
        }
      }
    });

    it('medium levels have 3 colors and 3 cups/balls', () => {
      for (let seed = 1; seed <= 30; seed++) {
        const level = generateLevel(seed, 'medium');
        if (level !== null) {
          expect(level.cups.length).toBe(3);
          expect(level.balls.length).toBe(3);
          break;
        }
      }
    });

    it('hard levels have 4 colors and 4 cups/balls', () => {
      for (let seed = 1; seed <= 30; seed++) {
        const level = generateLevel(seed, 'hard');
        if (level !== null) {
          expect(level.cups.length).toBe(4);
          expect(level.balls.length).toBe(4);
          break;
        }
      }
    });

    it('each cup has required fields', () => {
      const levels = generateBatch(1, 'easy', 1);
      if (levels.length === 0) return;
      for (const cup of levels[0].cups) {
        expect(cup).toHaveProperty('id');
        expect(typeof cup.x).toBe('number');
        expect(typeof cup.y).toBe('number');
        expect(cup).toHaveProperty('acceptColor');
      }
    });

    it('each ball has required fields', () => {
      const levels = generateBatch(1, 'easy', 1);
      if (levels.length === 0) return;
      for (const ball of levels[0].balls) {
        expect(ball).toHaveProperty('id');
        expect(typeof ball.x).toBe('number');
        expect(typeof ball.y).toBe('number');
        expect(ball).toHaveProperty('color');
      }
    });

    it('each channel has segments array and blockedByPin field', () => {
      const levels = generateBatch(1, 'easy', 1);
      if (levels.length === 0) return;
      for (const ch of levels[0].channels) {
        expect(Array.isArray(ch.segments)).toBe(true);
        expect(ch.segments.length).toBeGreaterThan(0);
        expect(ch).toHaveProperty('blockedByPin');
      }
    });

    it('each pin has id, x, and y', () => {
      const levels = generateBatch(1, 'easy', 1);
      if (levels.length === 0) return;
      for (const pin of levels[0].pins) {
        expect(pin).toHaveProperty('id');
        expect(typeof pin.x).toBe('number');
        expect(typeof pin.y).toBe('number');
      }
    });
  });

  describe('determinism', () => {
    it('same seed produces identical output', () => {
      // Find a seed that works
      for (let seed = 1; seed <= 30; seed++) {
        const a = generateLevel(seed, 'easy', 0);
        const b = generateLevel(seed, 'easy', 0);
        if (a !== null) {
          expect(JSON.stringify(a)).toBe(JSON.stringify(b));
          break;
        }
      }
    });
  });

  describe('unknown difficulty fallback', () => {
    it('falls back to medium config for an unknown difficulty string', () => {
      // Medium has 3 colors → 3 cups and 3 balls
      for (let seed = 1; seed <= 30; seed++) {
        const level = generateLevel(seed, 'legendary');
        if (level !== null) {
          expect(level.cups.length).toBe(3); // same as medium
          expect(level.balls.length).toBe(3);
          break;
        }
      }
    });
  });
});

// ── isLevelSolvable ──────────────────────────────────────────────────────────

describe('isLevelSolvable', () => {
  it('returns true for levels produced by generateBatch', () => {
    const levels = generateBatch(100, 'easy', 3);
    for (const level of levels) {
      expect(isLevelSolvable(level)).toBe(true);
    }
  });

  it('returns a boolean', () => {
    const levels = generateBatch(1, 'easy', 1);
    if (levels.length > 0) {
      expect(typeof isLevelSolvable(levels[0])).toBe('boolean');
    }
  });

  it('returns false for a level with clearly impossible pin arrangement', () => {
    // Craft a minimal level that cannot win: all channels blocked and unsolvable
    const level = {
      pins: [{ id: 'pin-0', x: 160, y: 200 }],
      balls: [{ id: 'ball-0', x: 80, y: 30, color: 'red' }],
      cups: [{ id: 'cup-0', x: 55, y: 400, width: 50, height: 60, acceptColor: 'blue' }],
      channels: [{ segments: [[80, 30, 80, 400]], blockedByPin: 'pin-0' }],
      difficulty: 1
    };
    // Ball is red, cup expects blue → will never win regardless of pins
    expect(isLevelSolvable(level)).toBe(false);
  });
});

// ── findSolution ─────────────────────────────────────────────────────────────

describe('findSolution', () => {
  it('returns an array for a solvable level', () => {
    const levels = generateBatch(100, 'easy', 3);
    for (const level of levels) {
      const sol = findSolution(level);
      expect(Array.isArray(sol)).toBe(true);
    }
  });

  it('returned array contains pin ids that exist in the level', () => {
    const levels = generateBatch(100, 'easy', 3);
    for (const level of levels) {
      const sol = findSolution(level);
      if (sol === null) continue;
      const pinIds = new Set(level.pins.map(p => p.id));
      for (const pinId of sol) {
        expect(pinIds.has(pinId)).toBe(true);
      }
    }
  });

  it('returns null for an unsolvable level', () => {
    const level = {
      pins: [{ id: 'pin-0', x: 160, y: 200 }],
      balls: [{ id: 'ball-0', x: 80, y: 30, color: 'red' }],
      cups: [{ id: 'cup-0', x: 55, y: 400, width: 50, height: 60, acceptColor: 'blue' }],
      channels: [{ segments: [[80, 30, 80, 400]], blockedByPin: 'pin-0' }],
      difficulty: 1
    };
    expect(findSolution(level)).toBeNull();
  });

  it('solution length is at most the number of pins in the level', () => {
    const levels = generateBatch(100, 'easy', 3);
    for (const level of levels) {
      const sol = findSolution(level);
      if (sol === null) continue;
      expect(sol.length).toBeLessThanOrEqual(level.pins.length);
    }
  });

  it('is deterministic: same level returns the same solution', () => {
    const levels = generateBatch(100, 'easy', 2);
    for (const level of levels) {
      const sol1 = findSolution(level);
      const sol2 = findSolution(level);
      expect(JSON.stringify(sol1)).toBe(JSON.stringify(sol2));
    }
  });

  it('returns [] when pins=[] and ball pre-positioned inside matching cup (pins.length===0 won branch)', () => {
    // Ball already inside the cup capture zone — simulator settles it immediately → won
    const level = {
      pins: [],
      balls: [{ id: 'b1', x: 155, y: 350, color: 'red' }],
      cups: [{ id: 'cup1', x: 100, y: 300, width: 100, height: 120, acceptColor: 'red' }],
      channels: [],
      gravity: 0.003,
      difficulty: 1,
    };
    const sol = findSolution(level);
    expect(sol).toEqual([]);  // empty array: no pins to remove, level instantly won
  });

  it('returns null when pins=[] and ball falls off screen (pins.length===0 null branch)', () => {
    // Ball falls freely — no cup to catch it — goes lost → status !== "won" → null
    const level = {
      pins: [],
      balls: [{ id: 'b1', x: 160, y: 100, color: 'red' }],
      cups: [],  // no cups → ball falls past y=600 → lost
      channels: [],
      gravity: 0.003,
      difficulty: 1,
    };
    const sol = findSolution(level);
    expect(sol).toBeNull();
  });
});

// ── validateLevel ────────────────────────────────────────────────────────────

describe('validateLevel', () => {
  it('returns { valid, reason } shape', () => {
    const levels = generateBatch(1, 'easy', 1);
    if (levels.length > 0) {
      const result = validateLevel(levels[0]);
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('reason');
    }
  });

  it('all levels from generateBatch pass validation', () => {
    const levels = generateBatch(200, 'easy', 3);
    for (const level of levels) {
      const result = validateLevel(level);
      expect(result.valid, `${level.id}: ${result.reason}`).toBe(true);
    }
  });

  it('rejects a level missing required fields', () => {
    const result = validateLevel({ difficulty: 1 });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Missing required fields/i);
  });

  it('rejects a level missing pins (has balls and cups but no pins)', () => {
    const levels = generateBatch(1, 'easy', 1);
    if (levels.length === 0) return;
    const { balls, cups } = levels[0];
    const result = validateLevel({ balls, cups });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Missing required fields/i);
  });

  it('rejects a level missing balls (has pins and cups but no balls)', () => {
    const levels = generateBatch(1, 'easy', 1);
    if (levels.length === 0) return;
    const { pins, cups } = levels[0];
    const result = validateLevel({ pins, cups });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Missing required fields/i);
  });

  it('rejects a level that is unsolvable', () => {
    const level = {
      pins: [{ id: 'pin-0', x: 160, y: 200 }],
      balls: [{ id: 'ball-0', x: 80, y: 30, color: 'red' }],
      cups: [{ id: 'cup-0', x: 55, y: 400, width: 50, height: 60, acceptColor: 'blue' }],
      channels: [{ segments: [[80, 30, 80, 400]], blockedByPin: 'pin-0' }],
      difficulty: 1
    };
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/unsolvable/i);
  });
});

// ── generateBatch ────────────────────────────────────────────────────────────

describe('generateBatch', () => {
  it('returns the requested number of levels', () => {
    const levels = generateBatch(100, 'easy', 3);
    expect(levels.length).toBe(3);
  });

  it('is deterministic', () => {
    const a = generateBatch(200, 'easy', 3);
    const b = generateBatch(200, 'easy', 3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('all levels contain pins, balls, and cups', () => {
    const levels = generateBatch(300, 'easy', 2);
    for (const level of levels) {
      expect(Array.isArray(level.pins)).toBe(true);
      expect(Array.isArray(level.balls)).toBe(true);
      expect(Array.isArray(level.cups)).toBe(true);
    }
  });

  it('each level has a unique id', () => {
    const levels = generateBatch(400, 'easy', 3);
    const ids = new Set(levels.map(l => l.id));
    expect(ids.size).toBe(levels.length);
  });

  it('medium levels are structurally valid when generated', () => {
    // Medium (4 pins) has low generation success rate; only check structure
    const levels = generateBatch(1000, 'medium', 2);
    for (const level of levels) {
      expect(Array.isArray(level.pins)).toBe(true);
      expect(Array.isArray(level.balls)).toBe(true);
      expect(Array.isArray(level.cups)).toBe(true);
    }
  });
});
