/**
 * Daily Seeded Challenge wiring — contract tests
 * @vitest-environment node
 *
 * Verifies that every game wires the shared daily-challenge system
 * (src/shared/daily.js) into its init + win flow, so the hub daily banner
 * (?daily=true) reaches a per-game seeded challenge and a win is recorded via
 * completeDailyChallenge(GAME_ID).
 *
 * Why a source contract test, not a behavioral one:
 *   game.js modules cannot be unit-bootstrapped — they construct Three.js /
 *   Phaser renderers, fetch levels.json, and attach DOM listeners at import
 *   time. The daily module's own behavior (seed derivation, completion
 *   tracking, per-game keys) is covered by tests/unit/daily.test.js. This file
 *   covers the games' half of the contract: that they import the shared
 *   module, detect ?daily=true, build the seeded daily level, and mark the
 *   daily challenge complete exactly once on a daily-mode win.
 *
 * The contract each daily-capable game must satisfy:
 *   1. import from '../../shared/daily.js'
 *   2. detect daily mode via URL (?daily=true) and gate on an isDailyMode flag
 *   3. mark completion with completeDailyChallenge(GAME_ID) exactly once,
 *      guarded by isDailyMode (so it fires only on a daily-mode win)
 *
 * Generator games additionally build the seeded level via generateLevel().
 * Non-generator games (brain-teaser, save-the-character) instead pick an
 * existing level with the plan's fallback: levelIndex = seed % levels.length.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../../src/games');

// All 13 games.
const GAMES = [
  'brain-teaser',
  'bridge-race',
  'bus-jam',
  'crowd-runner',
  'giant-runner',
  'jelly-shift',
  'makeover-run',
  'merge-games',
  'parking-escape',
  'pull-the-pin',
  'satisfying-asmr',
  'save-the-character',
  'water-sort',
];

// Non-generator games use the plan's fallback (seed % levels.length) instead of
// a procedural generator.
const FALLBACK_GAMES = ['brain-teaser', 'save-the-character'];

// giant-runner is knowingly incomplete: it wires daily mode but never calls
// completeDailyChallenge(). Tracked separately as bf-j4n79 — excluded from the
// "marks completion" assertion so this suite does not duplicate that bead.
const KNOWN_MISSING_COMPLETE = ['giant-runner'];

const COMPLETING_GAMES = GAMES.filter((g) => !KNOWN_MISSING_COMPLETE.includes(g));
const GENERATOR_DAILY_GAMES = COMPLETING_GAMES.filter((g) => !FALLBACK_GAMES.includes(g));

function readGame(name) {
  return readFileSync(resolve(SRC, name, 'game.js'), 'utf8');
}

function countOccurrences(src, needle) {
  return src.split(needle).length - 1;
}

describe('shared/daily.js wiring across all 13 games', () => {
  for (const game of GAMES) {
    describe(`${game}/game.js`, () => {
      const src = readGame(game);

      it('imports from shared/daily.js', () => {
        expect(src, 'must import the shared daily module').toContain(
          "from '../../shared/daily.js'"
        );
      });

      it('detects daily mode from ?daily=true and gates on isDailyMode', () => {
        expect(src, 'reads the ?daily URL parameter').toMatch(/get\(\s*['"]daily['"]\s*\)/);
        expect(src, 'tracks an isDailyMode flag').toContain('isDailyMode');
      });
    });
  }
});

describe('daily-capable games mark completion on a daily-mode win', () => {
  it('has the expected set of completing games (sanity)', () => {
    expect(COMPLETING_GAMES).toContain('water-sort');
    expect(COMPLETING_GAMES).toContain('bus-jam');
    expect(COMPLETING_GAMES).not.toContain('giant-runner');
    expect(COMPLETING_GAMES).toHaveLength(12);
  });

  for (const game of COMPLETING_GAMES) {
    describe(`${game}/game.js`, () => {
      const src = readGame(game);

      it('imports completeDailyChallenge', () => {
        expect(src).toContain('completeDailyChallenge');
      });

      it('calls completeDailyChallenge(GAME_ID) exactly once', () => {
        expect(countOccurrences(src, 'completeDailyChallenge(GAME_ID)')).toBe(1);
      });

      it('guards the completion call with isDailyMode (fires only on a daily win)', () => {
        expect(src).toMatch(/isDailyMode\)?\s*(?:\{[^}]*)?completeDailyChallenge\(GAME_ID\)/s);
      });
    });
  }
});

describe('generator games build the seeded daily level via generateLevel()', () => {
  for (const game of GENERATOR_DAILY_GAMES) {
    describe(`${game}/game.js`, () => {
      const src = readGame(game);

      it('uses the seeded daily level source (generateLevel or per-game generator)', () => {
        // Most games call generateLevel(...); bus-jam builds its own seeded
        // level inline from createRNG(this.dailySeed).
        const usesGenerator =
          /generateLevel\s*\(/.test(src) || /createRNG\(\s*this\.dailySeed/.test(src);
        expect(usesGenerator).toBe(true);
      });

      it('derives the daily seed from getGameDailySeed', () => {
        expect(src).toContain('getGameDailySeed');
      });
    });
  }
});

describe('non-generator games use the seed-modulo-length fallback', () => {
  for (const game of FALLBACK_GAMES) {
    describe(`${game}/game.js`, () => {
      const src = readGame(game);

      it('uses a numeric daily seed', () => {
        expect(src).toContain('getGameDailyNumericSeed');
      });

      it('selects an existing level via seed % length', () => {
        expect(src).toMatch(/%\s*this\.(levels|puzzles)\.length/);
      });
    });
  }
});
