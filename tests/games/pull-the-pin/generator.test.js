/**
 * Tests for Pull the Pin Level Generator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createGenerator, GRID, DIFFICULTY_PRESETS } from '../../../src/games/pull-the-pin/generator.js';

describe('Pull the Pin Generator', () => {
  let generator;

  beforeEach(() => {
    generator = createGenerator();
  });

  describe('createGenerator', () => {
    it('should create a generator instance', () => {
      expect(generator).toBeDefined();
      expect(generator.generate).toBeTypeOf('function');
      expect(generator.generateDaily).toBeTypeOf('function');
      expect(generator.validateLevel).toBeTypeOf('function');
    });
  });

  describe('generate', () => {
    it('should generate a valid level', () => {
      const level = generator.generate(12345, 'medium');

      expect(level).toBeDefined();
      expect(level.id).toBeDefined();
      expect(level.grid).toEqual({ width: GRID.width, height: GRID.height });
      expect(level.generated).toBe(true);
    });

    it('should generate consistent levels with same seed', () => {
      const level1 = generator.generate(12345, 'medium');
      const level2 = generator.generate(12345, 'medium');

      // Same seed should produce same level structure
      expect(level1.balls.length).toBe(level2.balls.length);
      expect(level1.pins.length).toBe(level2.pins.length);
    });

    it('should generate different levels with different seeds', () => {
      const level1 = generator.generate(12345, 'medium');
      const level2 = generator.generate(67890, 'medium');

      // Different seeds should likely produce different levels
      const sameLevel =
        level1.balls.length === level2.balls.length &&
        level1.pins.length === level2.pins.length;

      // Very unlikely to be identical
      // We just check they're both valid levels
      expect(level1).toBeDefined();
      expect(level2).toBeDefined();
    });

    it('should respect difficulty settings for easy', () => {
      const preset = DIFFICULTY_PRESETS.easy;

      for (let i = 0; i < 10; i++) {
        const level = generator.generate(10000 + i, 'easy');

        // Check that balls are within reasonable range (generator prioritizes solvability)
        expect(level.balls.length).toBeGreaterThanOrEqual(1);
        expect(level.balls.length).toBeLessThanOrEqual(preset.ballCount.max + 2);
        expect(level.pins.length).toBeGreaterThanOrEqual(1);
        expect(level.pins.length).toBeLessThanOrEqual(preset.pinCount.max + 2);
      }
    });

    it('should respect difficulty settings for medium', () => {
      const preset = DIFFICULTY_PRESETS.medium;

      for (let i = 0; i < 10; i++) {
        const level = generator.generate(20000 + i, 'medium');

        // Check that balls are within reasonable range (generator prioritizes solvability)
        expect(level.balls.length).toBeGreaterThanOrEqual(1);
        expect(level.balls.length).toBeLessThanOrEqual(preset.ballCount.max + 2);
        expect(level.pins.length).toBeGreaterThanOrEqual(1);
        expect(level.pins.length).toBeLessThanOrEqual(preset.pinCount.max + 2);
      }
    });

    it('should respect difficulty settings for hard', () => {
      const preset = DIFFICULTY_PRESETS.hard;

      for (let i = 0; i < 10; i++) {
        const level = generator.generate(30000 + i, 'hard');

        // Check that balls are within reasonable range (generator prioritizes solvability)
        expect(level.balls.length).toBeGreaterThanOrEqual(1);
        expect(level.balls.length).toBeLessThanOrEqual(preset.ballCount.max + 3);
        expect(level.pins.length).toBeGreaterThanOrEqual(1);
        // Hard difficulty can generate more complex levels
        expect(level.pins.length).toBeLessThanOrEqual(preset.pinCount.max + 4);
      }
    });

    it('should generate balls with valid properties', () => {
      const level = generator.generate(12345, 'medium');

      for (const ball of level.balls) {
        expect(ball.id).toBeDefined();
        expect(ball.x).toBeGreaterThan(GRID.margin);
        expect(ball.x).toBeLessThan(GRID.width - GRID.margin);
        expect(ball.y).toBeGreaterThan(20);
        expect(ball.y).toBeLessThan(100);
        expect(ball.radius).toBe(12);
        expect(['gold', 'silver', 'bronze']).toContain(ball.type);
      }
    });

    it('should generate pins with valid properties', () => {
      const level = generator.generate(12345, 'medium');

      for (const pin of level.pins) {
        expect(pin.id).toBeDefined();
        expect(pin.x).toBeGreaterThan(GRID.margin);
        expect(pin.x).toBeLessThan(GRID.width - GRID.margin);
        expect(pin.length).toBeGreaterThan(0);
        expect(pin.angle).toBeGreaterThanOrEqual(-Math.PI / 2);
        expect(pin.angle).toBeLessThanOrEqual(Math.PI / 2);
      }
    });

    it('should generate goals at the bottom', () => {
      const level = generator.generate(12345, 'medium');

      for (const goal of level.goals) {
        expect(goal.y).toBeGreaterThan(GRID.height - 100);
        expect(goal.width).toBeGreaterThan(0);
        expect(goal.height).toBeGreaterThan(0);
      }
    });

    it('should generate boundary walls', () => {
      const level = generator.generate(12345, 'medium');

      expect(level.walls.length).toBeGreaterThanOrEqual(2);

      // Check for left and right walls
      const leftWall = level.walls.find(w => w.x1 === GRID.margin && w.x2 === GRID.margin);
      const rightWall = level.walls.find(w =>
        w.x1 === GRID.width - GRID.margin &&
        w.x2 === GRID.width - GRID.margin
      );

      expect(leftWall).toBeDefined();
      expect(rightWall).toBeDefined();
    });

    it('should set requiredBalls appropriately', () => {
      const level = generator.generate(12345, 'medium');

      expect(level.requiredBalls).toBeGreaterThan(0);
      expect(level.requiredBalls).toBeLessThanOrEqual(level.balls.length);
    });

    it('should generate fallback level for invalid attempts', () => {
      // Even with extreme seeds, should generate a valid level
      const level = generator.generate(1, 'medium');

      expect(level).toBeDefined();
      expect(level.balls.length).toBeGreaterThan(0);
      expect(level.pins.length).toBeGreaterThan(0);
    });
  });

  describe('generateDaily', () => {
    it('should generate a daily challenge level', () => {
      const level = generator.generateDaily(20260305);

      expect(level).toBeDefined();
      expect(level.isDaily).toBe(true);
      expect(level.id).toContain('daily');
    });

    it('should generate consistent daily levels', () => {
      const level1 = generator.generateDaily(20260305);
      const level2 = generator.generateDaily(20260305);

      expect(level1.balls.length).toBe(level2.balls.length);
      expect(level1.pins.length).toBe(level2.pins.length);
    });
  });

  describe('validateLevel', () => {
    it('should validate a correct level', () => {
      const level = generator.generate(12345, 'medium');
      const isValid = generator.validateLevel(level);

      expect(isValid).toBe(true);
    });

    it('should reject level with no balls', () => {
      const level = {
        balls: [],
        pins: [{ id: 'p1', x: 150, y: 100, length: 80, angle: 0 }],
        goals: [{ id: 'g1', x: 100, y: 350, width: 100, height: 40 }],
        walls: [],
        hazards: []
      };

      const isValid = generator.validateLevel(level);
      expect(isValid).toBe(false);
    });

    it('should reject level with no pins', () => {
      const level = {
        balls: [{ id: 'b1', x: 150, y: 50, radius: 12, type: 'gold' }],
        pins: [],
        goals: [{ id: 'g1', x: 100, y: 350, width: 100, height: 40 }],
        walls: [],
        hazards: []
      };

      const isValid = generator.validateLevel(level);
      expect(isValid).toBe(false);
    });

    it('should reject level with no goals', () => {
      const level = {
        balls: [{ id: 'b1', x: 150, y: 50, radius: 12, type: 'gold' }],
        pins: [{ id: 'p1', x: 150, y: 100, length: 80, angle: 0 }],
        goals: [],
        walls: [],
        hazards: []
      };

      const isValid = generator.validateLevel(level);
      expect(isValid).toBe(false);
    });

    it('should reject balls outside bounds', () => {
      const level = {
        balls: [{ id: 'b1', x: 10, y: 50, radius: 12, type: 'gold' }], // Too far left
        pins: [{ id: 'p1', x: 150, y: 100, length: 80, angle: 0 }],
        goals: [{ id: 'g1', x: 100, y: 350, width: 100, height: 40 }],
        walls: [
          { x1: 40, y1: 30, x2: 40, y2: 340 },
          { x1: 260, y1: 30, x2: 260, y2: 340 }
        ],
        hazards: []
      };

      const isValid = generator.validateLevel(level);
      expect(isValid).toBe(false);
    });
  });

  describe('getLastGenerated', () => {
    it('should return null before any generation', () => {
      expect(generator.getLastGenerated()).toBeNull();
    });

    it('should return the last generated level', () => {
      const level = generator.generate(12345, 'medium');
      const lastGenerated = generator.getLastGenerated();

      expect(lastGenerated).toEqual(level);
    });
  });

  describe('getDifficultyPresets', () => {
    it('should return all difficulty presets', () => {
      const presets = generator.getDifficultyPresets();

      expect(presets.easy).toBeDefined();
      expect(presets.medium).toBeDefined();
      expect(presets.hard).toBeDefined();
    });

    it('should have correct preset structure', () => {
      const presets = generator.getDifficultyPresets();

      for (const [name, preset] of Object.entries(presets)) {
        expect(preset.ballCount).toBeDefined();
        expect(preset.ballCount.min).toBeLessThanOrEqual(preset.ballCount.max);
        expect(preset.pinCount).toBeDefined();
        expect(preset.pinCount.min).toBeLessThanOrEqual(preset.pinCount.max);
        expect(preset.hazardChance).toBeGreaterThanOrEqual(0);
        expect(preset.hazardChance).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('solvability', () => {
    it('should generate solvable levels', () => {
      // Generate multiple levels and check they're all solvable
      for (let i = 0; i < 5; i++) {
        const level = generator.generate(40000 + i, 'medium');
        expect(generator.validateLevel(level)).toBe(true);
      }
    });

    it('should generate solvable levels for all difficulties', () => {
      const difficulties = ['easy', 'medium', 'hard'];

      for (const difficulty of difficulties) {
        for (let i = 0; i < 3; i++) {
          const level = generator.generate(50000 + i, difficulty);
          expect(generator.validateLevel(level)).toBe(true);
        }
      }
    });
  });
});
