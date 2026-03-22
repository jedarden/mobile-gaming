/**
 * Bus Jam - Generator Unit Tests
 *
 * Tests for the procedural level generator: determinism, difficulty
 * presets, structural validity, and road/exit placement.
 */

import { describe, it, expect } from 'vitest';
import { generateLevel } from '../../src/games/bus-jam/generator.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function isEdge(x, y, gridSize) {
  return x === 0 || x === gridSize - 1 || y === 0 || y === gridSize - 1;
}

// ── generateLevel ──────────────────────────────────────────────────────────

describe('generateLevel', () => {
  describe('structure', () => {
    it('returns a level object with required fields', () => {
      const level = generateLevel(1);
      expect(level).toHaveProperty('id');
      expect(level).toHaveProperty('grid');
      expect(level).toHaveProperty('buses');
      expect(level).toHaveProperty('stops');
      expect(level).toHaveProperty('exits');
      expect(level).toHaveProperty('roads');
    });

    it('id encodes the seed', () => {
      const level = generateLevel(42);
      expect(level.id).toBe('gen-42');
    });

    it('difficulty is stored on the level', () => {
      const level = generateLevel(1, 0.2);
      expect(level.difficulty).toBe(0.2);
    });
  });

  describe('determinism', () => {
    it('produces identical output for the same seed', () => {
      const a = generateLevel(1234);
      const b = generateLevel(1234);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('produces different output for different seeds', () => {
      const a = generateLevel(1);
      const b = generateLevel(2);
      expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    });
  });

  describe('difficulty presets', () => {
    it('easy (d<0.33): 2 buses, 2 stops, 5×5 grid', () => {
      const level = generateLevel(1, 0.1);
      expect(level.buses.length).toBe(2);
      expect(level.stops.length).toBe(2);
      expect(level.grid.cols).toBe(5);
      expect(level.grid.rows).toBe(5);
    });

    it('medium (0.33≤d<0.66): 3 buses, 3 stops, 6×6 grid', () => {
      const level = generateLevel(1, 0.5);
      expect(level.buses.length).toBe(3);
      expect(level.stops.length).toBe(3);
      expect(level.grid.cols).toBe(6);
      expect(level.grid.rows).toBe(6);
    });

    it('hard (d≥0.66): 4 buses, 4 stops, 7×7 grid', () => {
      const level = generateLevel(1, 0.8);
      expect(level.buses.length).toBe(4);
      expect(level.stops.length).toBe(4);
      expect(level.grid.cols).toBe(7);
      expect(level.grid.rows).toBe(7);
    });
  });

  describe('roads', () => {
    it('roads cover the full grid (gridSize²)', () => {
      const level = generateLevel(1, 0.5);
      const { cols, rows } = level.grid;
      expect(level.roads.length).toBe(cols * rows);
    });

    it('all road cells are within grid bounds', () => {
      const level = generateLevel(5, 0.1);
      const { cols, rows } = level.grid;
      for (const [x, y] of level.roads) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(cols);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(rows);
      }
    });
  });

  describe('exits', () => {
    it('has exactly one exit', () => {
      const level = generateLevel(1);
      expect(level.exits.length).toBe(1);
    });

    it('exit is on the edge of the grid', () => {
      // Test multiple seeds to be confident
      for (let seed = 1; seed <= 20; seed++) {
        const level = generateLevel(seed, 0.5);
        const { x, y } = level.exits[0];
        const { cols, rows } = level.grid;
        expect(isEdge(x, y, Math.min(cols, rows))).toBe(true);
      }
    });
  });

  describe('buses', () => {
    it('each bus has required fields', () => {
      const level = generateLevel(1, 0.5);
      for (const bus of level.buses) {
        expect(bus.id).toBeDefined();
        expect(typeof bus.x).toBe('number');
        expect(typeof bus.y).toBe('number');
        expect(bus.color).toBeDefined();
        expect(bus.capacity).toBeGreaterThan(0);
        expect(['up', 'down', 'left', 'right']).toContain(bus.direction);
      }
    });

    it('buses start with 0 passengers', () => {
      const level = generateLevel(1, 0.5);
      for (const bus of level.buses) {
        expect(bus.passengers).toBe(0);
      }
    });
  });

  describe('stops', () => {
    it('each stop has required fields', () => {
      const level = generateLevel(1, 0.5);
      for (const stop of level.stops) {
        expect(typeof stop.x).toBe('number');
        expect(typeof stop.y).toBe('number');
        expect(stop.color).toBeDefined();
        expect(Array.isArray(stop.waiting)).toBe(true);
        expect(stop.waiting.length).toBeGreaterThan(0);
      }
    });

    it('stop waiting passengers match stop color', () => {
      const level = generateLevel(1, 0.5);
      for (const stop of level.stops) {
        for (const p of stop.waiting) {
          expect(p).toBe(stop.color);
        }
      }
    });
  });
});
