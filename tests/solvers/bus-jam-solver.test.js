/**
 * Bus Jam — Solver Tests
 *
 * Verifies that all 30 hand-crafted levels are solvable using a
 * greedy hint-following solver, and that the generator produces
 * structurally valid levels at each difficulty tier.
 *
 * Solver strategy: at each step, follow getHint() priority queue:
 *   1. Board available passenger
 *   2. Move full bus one step toward exit (then auto-exit if arrived)
 *   3. Move bus one step toward stop-adjacent boarding cell
 *   4. Any valid move
 * Auto-exit fires before each hint check to handle buses that
 * arrived at the exit from the previous step.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import {
  createInitialState,
  canBoard,
  boardPassenger,
  canExit,
  executeExit,
  checkWin,
  getHint,
} from '../../src/games/bus-jam/state.js';
import { generateLevel } from '../../src/games/bus-jam/generator.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const LEVELS = JSON.parse(
  readFileSync(join(__dir, '../../src/games/bus-jam/levels.json'), 'utf8')
);

/**
 * Greedy solver: follow getHint() one step at a time.
 * Returns true if the level reaches the win condition within maxSteps.
 */
function solveBusJam(level, maxSteps = 2000) {
  // Deep-clone level so the solver doesn't mutate the original level object
  const state = createInitialState(JSON.parse(JSON.stringify(level)));

  for (let step = 0; step < maxSteps; step++) {
    if (checkWin(state)) return true;

    // Auto-exit any full bus already sitting on an exit cell
    let autoExited = false;
    for (const bus of state.buses) {
      if (canExit(state, bus)) {
        executeExit(state, bus);
        autoExited = true;
      }
    }
    if (autoExited) continue;

    const hint = getHint(state);
    if (!hint) return false; // stuck — no valid action

    if (hint.type === 'board') {
      boardPassenger(state, hint.bus);
    } else if (hint.type === 'exit') {
      // Move one step along the path toward the exit
      if (hint.path && hint.path.length > 0) {
        const next = hint.path[0];
        hint.bus.x = next.x;
        hint.bus.y = next.y;
      }
    } else {
      // 'move' — advance one step toward the boarding position
      if (hint.path && hint.path.length > 0) {
        const next = hint.path[0];
        hint.bus.x = next.x;
        hint.bus.y = next.y;
      }
    }
  }

  return checkWin(state);
}

// ── Hand-crafted levels ────────────────────────────────────────────────────

describe('hand-crafted levels', () => {
  it('loads 30 levels', () => {
    expect(LEVELS.length).toBe(30);
  });

  it('every level has required fields', () => {
    for (const level of LEVELS) {
      expect(level).toHaveProperty('id');
      expect(level).toHaveProperty('grid');
      expect(level).toHaveProperty('buses');
      expect(level).toHaveProperty('stops');
      expect(level).toHaveProperty('exits');
      expect(level).toHaveProperty('roads');
      expect(level).toHaveProperty('optimal');
    }
  });

  it('every level has at least one bus, stop, and exit', () => {
    for (const level of LEVELS) {
      expect(level.buses.length).toBeGreaterThan(0);
      expect(level.stops.length).toBeGreaterThan(0);
      expect(level.exits.length).toBeGreaterThan(0);
    }
  });

  it('bus count matches stop count on all levels', () => {
    for (const level of LEVELS) {
      expect(level.buses.length).toBe(level.stops.length);
    }
  });

  for (const level of LEVELS) {
    it(`level ${level.id} is solvable`, () => {
      expect(solveBusJam(level)).toBe(true);
    });
  }
});

// ── Generated levels ───────────────────────────────────────────────────────

describe('generated levels', () => {
  for (const [diff, label] of [[0.2, 'easy'], [0.5, 'medium'], [0.8, 'hard']]) {
    describe(`difficulty ${label}`, () => {
      const levels = [];
      for (let seed = 42; seed < 52; seed++) {
        const level = generateLevel(seed, diff);
        if (level) levels.push(level);
      }

      it('generates at least 5 levels', () => {
        expect(levels.length).toBeGreaterThanOrEqual(5);
      });

      for (let i = 0; i < Math.min(levels.length, 5); i++) {
        it(`generated ${label} level ${i} has required fields`, () => {
          const level = levels[i];
          expect(level).toHaveProperty('id');
          expect(level).toHaveProperty('buses');
          expect(level).toHaveProperty('stops');
          expect(level).toHaveProperty('exits');
          expect(level).toHaveProperty('roads');
        });
      }
    });
  }
});
