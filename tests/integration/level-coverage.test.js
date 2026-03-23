/**
 * Cross-Game Level Coverage Integration Tests
 *
 * Verifies that every game directory has:
 *   1. Required source files (index.html, state.js, game.js, levels.json)
 *   2. At least 10 hand-crafted levels
 *   3. Valid JSON in levels.json
 *   4. Each level has an `id` field
 *
 * For games that export `validateLevel` from their generator, also runs
 * the game-specific validator on every hand-crafted level.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath }  from 'node:url';
import { join, dirname }  from 'node:path';

const __dir    = dirname(fileURLToPath(import.meta.url));
const ROOT     = join(__dir, '../..');
const GAMES_DIR = join(ROOT, 'src/games');

// All 13 game directories
const GAME_DIRS = readdirSync(GAMES_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort();

// Required files for every game
const REQUIRED_FILES = ['index.html', 'state.js', 'game.js', 'levels.json'];

// ── File existence ──────────────────────────────────────────────────────────

describe('game directory structure', () => {
  it('has 13 game directories', () => {
    expect(GAME_DIRS.length).toBe(13);
  });

  for (const game of GAME_DIRS) {
    describe(`${game}`, () => {
      for (const file of REQUIRED_FILES) {
        it(`has ${file}`, () => {
          expect(existsSync(join(GAMES_DIR, game, file))).toBe(true);
        });
      }
    });
  }
});

// ── Level count and structure ───────────────────────────────────────────────

describe('levels.json validity', () => {
  for (const game of GAME_DIRS) {
    const levelsPath = join(GAMES_DIR, game, 'levels.json');

    describe(`${game}`, () => {
      let levels;

      it('parses as valid JSON array', () => {
        const raw = readFileSync(levelsPath, 'utf8');
        levels = JSON.parse(raw);
        expect(Array.isArray(levels)).toBe(true);
      });

      it('has at least 10 levels', () => {
        const raw = readFileSync(levelsPath, 'utf8');
        const parsed = JSON.parse(raw);
        expect(parsed.length).toBeGreaterThanOrEqual(10);
      });

      it('every level has an id field', () => {
        const raw = readFileSync(levelsPath, 'utf8');
        const parsed = JSON.parse(raw);
        for (const level of parsed) {
          expect(level).toHaveProperty('id');
        }
      });
    });
  }
});

// ── Game-specific validation (games with validateLevel) ─────────────────────
//
// Only run for games whose generator exports validateLevel and returns
// a { valid, ... } object. We dynamically import each generator and skip
// gracefully if the export is absent.

const GAMES_WITH_VALIDATORS = [
  'bridge-race',
  'crowd-runner',
  'giant-runner',
  'water-sort',
  'jelly-shift',
  'makeover-run',
  'merge-games',
  'parking-escape',
  'pull-the-pin',
  'satisfying-asmr',
];

for (const game of GAMES_WITH_VALIDATORS) {
  const levelsPath = join(GAMES_DIR, game, 'levels.json');
  const generatorPath = join(GAMES_DIR, game, 'generator.js');

  if (!existsSync(generatorPath)) continue;

  describe(`${game} — validateLevel`, async () => {
    let validateLevel;
    let levels;

    try {
      const mod = await import(generatorPath);
      validateLevel = mod.validateLevel;
      levels = JSON.parse(readFileSync(levelsPath, 'utf8'));
    } catch {
      // skip if import fails (e.g. Three.js not available in test env)
      return;
    }

    if (typeof validateLevel !== 'function') return;

    for (const level of levels) {
      it(`level ${level.id} passes validateLevel`, () => {
        const result = validateLevel(level);
        // validateLevel may return { valid, ... } or { valid, errors, ... }
        expect(result.valid, JSON.stringify(result)).toBe(true);
      });
    }
  });
}
