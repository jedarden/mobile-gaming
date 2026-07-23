/**
 * Game retry-overlay wiring — contract tests
 * @vitest-environment node
 *
 * Verifies that every game wires the shared universal retry overlay
 * (src/shared/retry.js) into its win/loss/stuck flow, replacing the ad hoc
 * per-game overlay handling.
 *
 * Why a source contract test, not a behavioral one:
 *   game.js modules cannot be unit-bootstrapped — they construct Three.js /
 *   Phaser renderers, fetch levels.json, and attach DOM listeners at import
 *   time. The shared component's own behavior (show/hide, failure counting,
 *   skip-after-3, stuck/undo buttons, sounds) is exhaustively covered by
 *   tests/unit/retry.test.js. This file covers the games' half of the
 *   contract: that they import the shared factory, construct an overlay, and
 *   drive it with ResultType on level completion.
 *
 * The contract each game must satisfy:
 *   1. import { createRetryOverlay, ResultType } from '../../shared/retry.js'
 *   2. construct an overlay via createRetryOverlay({ ... })
 *   3. show it with ResultType.WIN when a level is completed
 *   4. wire the standard callbacks (onRetry / onNext) so the overlay's
 *      buttons drive real level flow
 *
 * Puzzle games that can dead-end (define isStuck in state.js) additionally:
 *   5. show ResultType.STUCK and wire onUndo (Undo to last good state)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
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

// Games whose state.js exports isStuck — these must wire STUCK + onUndo.
const STUCK_GAMES = GAMES.filter((g) => {
  const statePath = resolve(SRC, g, 'state.js');
  return existsSync(statePath) && /export\s+(function|const)\s+isStuck/.test(readFileSync(statePath, 'utf8'));
});

function readGame(name) {
  return readFileSync(resolve(SRC, name, 'game.js'), 'utf8');
}

describe('shared/retry.js wiring across all 13 games', () => {
  for (const game of GAMES) {
    describe(`${game}/game.js`, () => {
      const src = readGame(game);

      it('imports createRetryOverlay and ResultType from shared/retry.js', () => {
        expect(src, 'must import the shared retry module').toContain(
          "from '../../shared/retry.js'"
        );
        expect(src, 'must import createRetryOverlay').toContain('createRetryOverlay');
        expect(src, 'must import ResultType').toContain('ResultType');
      });

      it('constructs a retry overlay via createRetryOverlay({ ... })', () => {
        expect(src).toMatch(/createRetryOverlay\s*\(\s*\{/);
      });

      it('shows the overlay on win with ResultType.WIN', () => {
        expect(src).toMatch(/\.show\(\s*ResultType\.WIN/);
      });

      it('wires onRetry and onNext callbacks into the overlay', () => {
        expect(src, 'onRetry drives Retry/Replay button').toContain('onRetry');
        expect(src, 'onNext drives Next Level button').toContain('onNext');
      });
    });
  }
});

describe('puzzle games that can dead-end wire the stuck flow', () => {
  it('has at least one stuck-capable game (sanity)', () => {
    expect(STUCK_GAMES.length).toBeGreaterThan(0);
    expect(STUCK_GAMES).toContain('water-sort');
  });

  for (const game of STUCK_GAMES) {
    describe(`${game}/game.js`, () => {
      const src = readGame(game);

      it('shows the overlay on dead-end with ResultType.STUCK', () => {
        expect(src).toMatch(/\.show\(\s*ResultType\.STUCK/);
      });

      it('wires onUndo (Undo to last good state)', () => {
        expect(src).toContain('onUndo');
      });
    });
  }
});
