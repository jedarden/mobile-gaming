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

    it('each stop has at least 1 waiting passenger', () => {
      for (let seed = 1; seed <= 10; seed++) {
        const level = generateLevel(seed, 0.5);
        for (const stop of level.stops) {
          expect(stop.waiting.length).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('stop waiting count does not exceed bus capacity', () => {
      // capacity=3 for easy/medium; stops should have ≤ capacity waiting
      const level = generateLevel(5, 0.1); // easy: capacity=3
      for (const stop of level.stops) {
        expect(stop.waiting.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('position uniqueness', () => {
    it('no two buses share the same grid cell', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const level = generateLevel(seed, 0.8); // hard: 4 buses
        const positions = level.buses.map(b => `${b.x},${b.y}`);
        expect(new Set(positions).size).toBe(positions.length);
      }
    });

    it('no two stops share the same grid cell', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const level = generateLevel(seed, 0.8); // hard: 4 stops
        const positions = level.stops.map(s => `${s.x},${s.y}`);
        expect(new Set(positions).size).toBe(positions.length);
      }
    });

    it('buses and stops never share the same grid cell', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const level = generateLevel(seed, 0.5);
        const busPositions = new Set(level.buses.map(b => `${b.x},${b.y}`));
        for (const stop of level.stops) {
          expect(busPositions.has(`${stop.x},${stop.y}`)).toBe(false);
        }
      }
    });
  });

  describe('colors', () => {
    it('easy uses 2 distinct colors', () => {
      const level = generateLevel(1, 0.1);
      const busColors = new Set(level.buses.map(b => b.color));
      expect(busColors.size).toBeLessThanOrEqual(2);
    });

    it('hard uses 4 distinct colors', () => {
      // 4 buses, each assigned color by index → 4 distinct colors
      const level = generateLevel(1, 0.8);
      const busColors = level.buses.map(b => b.color);
      expect(new Set(busColors).size).toBe(4);
    });

    it('every bus color has at least one matching stop', () => {
      for (let seed = 1; seed <= 10; seed++) {
        const level = generateLevel(seed, 0.5);
        const stopColors = new Set(level.stops.map(s => s.color));
        for (const bus of level.buses) {
          expect(stopColors.has(bus.color), `bus color ${bus.color} has no matching stop`).toBe(true);
        }
      }
    });

    it('bus colors are from the allowed COLORS palette', () => {
      const ALLOWED = new Set(['red', 'blue', 'green', 'yellow', 'purple', 'orange']);
      const level = generateLevel(3, 0.8);
      for (const bus of level.buses) {
        expect(ALLOWED.has(bus.color)).toBe(true);
      }
    });
  });

  describe('road completeness', () => {
    it('every (x,y) in grid appears exactly once in roads', () => {
      const level = generateLevel(7, 0.5);
      const { cols, rows } = level.grid;
      const roadSet = new Set(level.roads.map(([x, y]) => `${x},${y}`));
      expect(roadSet.size).toBe(cols * rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          expect(roadSet.has(`${x},${y}`), `missing road cell (${x},${y})`).toBe(true);
        }
      }
    });
  });

  describe('exit placement', () => {
    it('exit coords are within grid bounds', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const level = generateLevel(seed, 0.5);
        const { x, y } = level.exits[0];
        const { cols, rows } = level.grid;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(cols);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(rows);
      }
    });

    it('exit is on a border row or column (x=0, x=cols-1, y=0, or y=rows-1)', () => {
      for (let seed = 1; seed <= 30; seed++) {
        const level = generateLevel(seed, 0.5);
        const { x, y } = level.exits[0];
        const { cols, rows } = level.grid;
        const onBorder = x === 0 || x === cols - 1 || y === 0 || y === rows - 1;
        expect(onBorder, `exit (${x},${y}) is not on border of ${cols}x${rows} grid`).toBe(true);
      }
    });
  });

  describe('bus IDs', () => {
    it('all bus ids are unique within a level', () => {
      const level = generateLevel(1, 0.8);
      const ids = level.buses.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('bus ids follow bus1, bus2, ... pattern', () => {
      const level = generateLevel(1, 0.5);
      const ids = level.buses.map(b => b.id);
      expect(ids).toEqual(['bus1', 'bus2', 'bus3']);
    });
  });

  describe('edge cases', () => {
    it('seed=0 generates a valid level', () => {
      const level = generateLevel(0);
      expect(level).toBeDefined();
      expect(level.buses.length).toBeGreaterThan(0);
      expect(level.exits.length).toBe(1);
    });

    it('difficulty boundary at 0.33 selects medium', () => {
      const level = generateLevel(1, 0.33);
      expect(level.buses.length).toBe(3);
      expect(level.grid.cols).toBe(6);
    });

    it('difficulty boundary at 0.66 selects hard', () => {
      const level = generateLevel(1, 0.66);
      expect(level.buses.length).toBe(4);
      expect(level.grid.cols).toBe(7);
    });

    it('optimal field is set to busCount × 3', () => {
      const easy = generateLevel(1, 0.1);
      expect(easy.optimal).toBe(2 * 3);

      const hard = generateLevel(1, 0.8);
      expect(hard.optimal).toBe(4 * 3);
    });
  });
});
