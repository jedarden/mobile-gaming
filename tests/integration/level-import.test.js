/**
 * Cross-Game Level Import Integration Tests
 *
 * Verifies that every level in every game's levels.json creates a valid initial
 * state without throwing.  Catches malformed level entries that might slip past
 * JSON schema checks (e.g. missing required fields that createInitialState
 * dereferences at runtime).
 *
 * Also asserts each game's expected initial status so that accidental
 * status-string regressions are caught at the data level, not just in unit
 * tests.
 */

import { describe, it, expect } from 'vitest';

// ── State factories ──────────────────────────────────────────────────────────

import { createInitialState as brainTeaserState }    from '../../src/games/brain-teaser/state.js';
import { createInitialState as bridgeRaceState }      from '../../src/games/bridge-race/state.js';
import { createInitialState as busJamState }          from '../../src/games/bus-jam/state.js';
import { createInitialState as crowdRunnerState }     from '../../src/games/crowd-runner/state.js';
import { createInitialState as giantRunnerState }     from '../../src/games/giant-runner/state.js';
import { createInitialState as jellyShiftState }      from '../../src/games/jelly-shift/state.js';
import { createInitialState as makeoverRunState }     from '../../src/games/makeover-run/state.js';
import { createInitialState as mergeGamesState }      from '../../src/games/merge-games/state.js';
import { createInitialState as parkingEscapeState }   from '../../src/games/parking-escape/state.js';
import { createInitialState as pullThePinState }      from '../../src/games/pull-the-pin/state.js';
import { createInitialState as satisfyingAsmrState }  from '../../src/games/satisfying-asmr/state.js';
import { createInitialState as saveTheCharacterState } from '../../src/games/save-the-character/state.js';
import { createInitialState as waterSortState }       from '../../src/games/water-sort/state.js';

// ── Level catalogs ───────────────────────────────────────────────────────────

import brainTeaserLevels    from '../../src/games/brain-teaser/levels.json';
import bridgeRaceLevels     from '../../src/games/bridge-race/levels.json';
import busJamLevels         from '../../src/games/bus-jam/levels.json';
import crowdRunnerLevels    from '../../src/games/crowd-runner/levels.json';
import giantRunnerLevels    from '../../src/games/giant-runner/levels.json';
import jellyShiftLevels     from '../../src/games/jelly-shift/levels.json';
import makeoverRunLevels    from '../../src/games/makeover-run/levels.json';
import mergeGamesLevels     from '../../src/games/merge-games/levels.json';
import parkingEscapeLevels  from '../../src/games/parking-escape/levels.json';
import pullThePinLevels     from '../../src/games/pull-the-pin/levels.json';
import satisfyingAsmrLevels from '../../src/games/satisfying-asmr/levels.json';
import saveTheCharacterLevels from '../../src/games/save-the-character/levels.json';
import waterSortLevels      from '../../src/games/water-sort/levels.json';

// ── Game registry ────────────────────────────────────────────────────────────
//
// statusCheck(state) returns a description of the "not-yet-started" indicator
// for each game so we can assert it is in the correct initial state.

const GAMES = [
  {
    name: 'brain-teaser',
    fn: brainTeaserState,
    levels: brainTeaserLevels,
    check: s => s.status === 'playing',
    desc: 'status === "playing"',
  },
  {
    name: 'bridge-race',
    fn: bridgeRaceState,
    levels: bridgeRaceLevels,
    check: s => s.status === 'racing',
    desc: 'status === "racing"',
  },
  {
    name: 'bus-jam',
    fn: busJamState,
    levels: busJamLevels,
    check: s => s.won === false,
    desc: 'won === false',
  },
  {
    name: 'crowd-runner',
    fn: crowdRunnerState,
    levels: crowdRunnerLevels,
    check: s => s.status === 'running',
    desc: 'status === "running"',
  },
  {
    name: 'giant-runner',
    fn: giantRunnerState,
    levels: giantRunnerLevels,
    check: s => s.status === 'running',
    desc: 'status === "running"',
  },
  {
    name: 'jelly-shift',
    fn: jellyShiftState,
    levels: jellyShiftLevels,
    check: s => s.status === 'running',
    desc: 'status === "running"',
  },
  {
    name: 'makeover-run',
    fn: makeoverRunState,
    levels: makeoverRunLevels,
    check: s => s.status === 'running',
    desc: 'status === "running"',
  },
  {
    name: 'merge-games',
    fn: mergeGamesState,
    levels: mergeGamesLevels,
    check: s => s.status === 'playing',
    desc: 'status === "playing"',
  },
  {
    name: 'parking-escape',
    fn: parkingEscapeState,
    levels: parkingEscapeLevels,
    check: s => s.status === 'playing',
    desc: 'status === "playing"',
  },
  {
    name: 'pull-the-pin',
    fn: pullThePinState,
    levels: pullThePinLevels,
    check: s => s.status === 'playing',
    desc: 'status === "playing"',
  },
  {
    name: 'satisfying-asmr',
    fn: satisfyingAsmrState,
    levels: satisfyingAsmrLevels,
    check: s => s.status === 'playing',
    desc: 'status === "playing"',
  },
  {
    name: 'save-the-character',
    fn: saveTheCharacterState,
    levels: saveTheCharacterLevels,
    check: s => s.status === 'choosing',
    desc: 'status === "choosing"',
  },
  {
    name: 'water-sort',
    fn: waterSortState,
    levels: waterSortLevels,
    check: s => s.status === 'playing',
    desc: 'status === "playing"',
  },
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe('cross-game level import', () => {
  it('covers all 13 games', () => {
    expect(GAMES.length).toBe(13);
  });

  for (const { name, fn, levels, check, desc } of GAMES) {
    describe(`${name} (${levels.length} levels)`, () => {
      it('createInitialState does not throw for any level', () => {
        for (const level of levels) {
          expect(
            () => fn(level),
            `level ${level.id ?? JSON.stringify(level).slice(0, 60)}`
          ).not.toThrow();
        }
      });

      it(`initial state satisfies: ${desc}`, () => {
        for (const level of levels) {
          const state = fn(level);
          expect(
            check(state),
            `level ${level.id}: expected ${desc}`
          ).toBe(true);
        }
      });

      it('every level produces a non-null state object', () => {
        for (const level of levels) {
          const state = fn(level);
          expect(state).not.toBeNull();
          expect(typeof state).toBe('object');
        }
      });
    });
  }
});
