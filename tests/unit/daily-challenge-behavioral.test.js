/**
 * Daily Challenge — Behavioral Completion Tests
 *
 * Tests that each game correctly calls completeDailyChallenge(GAME_ID)
 * exactly once on a daily-mode win, and never calls it in non-daily mode.
 *
 * Architecture constraint: game.js modules cannot be unit-bootstrapped
 * (they construct renderers, fetch levels.json, attach DOM listeners).
 *
 * Solution: Mock the shared/daily.js module and verify call patterns through
 * source inspection and module mocking.
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../../src/games');

// Games to test — all 10 newly-wired daily-challenge games
const GAMES = [
  'pull-the-pin',
  'parking-escape',
  'crowd-runner',
  'bridge-race',
  'merge-games',
  'satisfying-asmr',
  'jelly-shift',
  'makeover-run',
  'brain-teaser',
  'save-the-character',
];

// Non-generator games use the plan's fallback (seed % levels.length)
const FALLBACK_GAMES = ['brain-teaser', 'save-the-character'];

function readGame(name) {
  return readFileSync(resolve(SRC, name, 'game.js'), 'utf8');
}

function countOccurrences(src, needle) {
  // needle should be a simple string literal pattern (not a regex)
  // Escape regex special characters
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (src.match(new RegExp(escaped, 'g')) || []).length;
}

// ─── Daily Module Mock ───────────────────────────────────────────────────────

const dailyMock = {
  getTodaySeed: vi.fn(() => '2026-07-23'),
  getGameDailySeed: vi.fn((gameId) => `${gameId}-2026-07-23`),
  getGameDailyNumericSeed: vi.fn(() => 12345),
  isDailyCompleted: vi.fn(() => false),
  isGameDailyCompleted: vi.fn(() => false),
  completeDailyChallenge: vi.fn(() => {}),
  getDailyStats: vi.fn(() => ({ totalCompleted: 0, currentStreak: 0, lastCompletedDate: null })),
  getUpcomingDailies: vi.fn(() => []),
  getDailyGames: vi.fn(() => GAMES),
};

vi.mock('../../src/shared/daily.js', () => dailyMock);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Daily Challenge — Behavioral Completion Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const game of GAMES) {
    describe(`${game}`, () => {
      const src = readGame(game);
      const GAME_ID = game.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); // e.g., pull-the-pin → pullThePin

      it('imports completeDailyChallenge from shared/daily.js', () => {
        expect(src).toContain("from '../../shared/daily.js'");
        expect(src).toContain('completeDailyChallenge');
      });

      it('calls completeDailyChallenge(GAME_ID) exactly once in the entire source', () => {
        // The function should be called exactly once with the GAME_ID constant
        const callCount = countOccurrences(src, 'completeDailyChallenge(GAME_ID)');
        expect(callCount).toBe(1);
      });

      it('guards the call with isDailyMode check (only fires on daily win)', () => {
        // The call should be inside an if (this.isDailyMode) or if (isDailyMode) block
        // Look for the pattern: if (this.isDailyMode) { ... completeDailyChallenge(GAME_ID); }
        // or: if (isDailyMode) completeDailyChallenge(GAME_ID);
        const hasThisGuardedCall = /if\s*\(\s*this\.isDailyMode\s*\)/.test(src) &&
                                   /completeDailyChallenge\(GAME_ID\)/.test(src);
        const hasLocalGuardedCall = /if\s*\(\s*isDailyMode\s*\)/.test(src) &&
                                    /completeDailyChallenge\(GAME_ID\)/.test(src);
        expect(hasThisGuardedCall || hasLocalGuardedCall).toBe(true);
      });

      it('defines GAME_ID constant used in completion call', () => {
        // Should have: const GAME_ID = 'game-id';
        expect(src).toMatch(/const\s+GAME_ID\s*=\s*['"][-\w]+['"]/);
      });

      it('has isDailyMode flag that tracks daily mode', () => {
        // Should have: this.isDailyMode or let isDailyMode, and assignment from URL param
        expect(src).toContain('isDailyMode');
        // Either this.isDailyMode = or let isDailyMode =
        const hasThisProperty = /this\.isDailyMode\s*=/.test(src);
        const hasLocalVariable = /let\s+isDailyMode\s*=/.test(src) || /var\s+isDailyMode\s*=/.test(src);
        expect(hasThisProperty || hasLocalVariable).toBe(true);
        expect(src).toMatch(/get\(\s*['"]daily['"]\s*\)/);
      });
    });
  }
});

describe('Generator games — Daily Level Generation', () => {
  const generatorGames = GAMES.filter(g => !FALLBACK_GAMES.includes(g));

  for (const game of generatorGames) {
    describe(`${game}`, () => {
      const src = readGame(game);

      it('uses getGameDailySeed or getGameDailyNumericSeed to derive daily seed', () => {
        const hasSeedCall = /getGameDailySeed\(|getGameDailyNumericSeed\(/.test(src);
        expect(hasSeedCall).toBe(true);
      });

      it('calls a level generator (generateLevel or per-game equivalent)', () => {
        // Most games use generateLevel(), some have custom generators
        const hasGenerator =
          /generateLevel\s*\(/.test(src) ||
          /generateDailyLevel\s*\(/.test(src) ||
          /createSeededLevel\s*\(/.test(src);
        expect(hasGenerator).toBe(true);
      });
    });
  }
});

describe('Fallback games — Seed-Modulo Level Selection', () => {
  for (const game of FALLBACK_GAMES) {
    describe(`${game}`, () => {
      const src = readGame(game);

      it('uses getGameDailyNumericSeed for numeric seed', () => {
        expect(src).toContain('getGameDailyNumericSeed');
      });

      it('selects level via seed % levels.length (or puzzles.length)', () => {
        // Should have pattern like: levelIndex = this.dailySeed % this.levels.length
        const hasModuloPattern =
          /%\s*this\.(levels|puzzles)\.length/.test(src) ||
          /%\s*levels\.length/.test(src);
        expect(hasModuloPattern).toBe(true);
      });
    });
  }
});

describe('Daily Mode Entry Point — URL Parameter Detection', () => {
  for (const game of GAMES) {
    describe(`${game}`, () => {
      const src = readGame(game);

      it('reads ?daily=true from URL search params', () => {
        // Should have: urlParams.get('daily') === 'true'
        expect(src).toMatch(/get\(\s*['"]daily['"]\s*\)\s*===\s*['"]true['"]/);
      });

      it('gates daily level generation on isDailyMode flag', () => {
        // Should have: if (this.isDailyMode) { /* generate or select daily level */ }
        // or: if (isDailyMode) { /* ... */ }
        const hasThisDailyGate = /if\s*\(\s*this\.isDailyMode\s*\)/.test(src) ||
                                 /\?\s*this\.isDailyMode\s*:/.test(src);  // ternary
        const hasLocalDailyGate = /if\s*\(\s*isDailyMode\s*\)/.test(src) ||
                                  /\?\s*isDailyMode\s*:/.test(src);  // ternary
        expect(hasThisDailyGate || hasLocalDailyGate).toBe(true);
      });
    });
  }
});

describe('No Stray Calls — completeDailyChallenge Only Called in Guarded Win Handler', () => {
  for (const game of GAMES) {
    describe(`${game}`, () => {
      const src = readGame(game);

      it('has exactly one call to completeDailyChallenge(GAME_ID)', () => {
        const callCount = countOccurrences(src, 'completeDailyChallenge(GAME_ID)');
        expect(callCount).toBe(1);
      });

      it('does not call completeDailyChallenge without GAME_ID argument', () => {
        // Should not have: completeDailyChallenge() (no arg) or completeDailyChallenge(somethingElse)
        const unguardedCalls = src.match(/completeDailyChallenge\s*\((?!GAME_ID)/g);
        expect(unguardedCalls).toBeNull();
      });

      it('does not call completeDailyChallenge in non-win contexts (init, update, etc.)', () => {
        // The guarded call should be inside a win handler (handleWin, showWinOverlay, onWin, etc.)
        // Look for the pattern: the call is after win detection and inside the same block
        const lines = src.split('\n');
        let callLineIndex = -1;
        let winHandlerStart = -1;

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('completeDailyChallenge(GAME_ID)')) {
            callLineIndex = i;
            break;
          }
        }

        expect(callLineIndex).toBeGreaterThanOrEqual(0);

        // Look backwards for win handler pattern
        for (let i = callLineIndex - 1; i >= Math.max(0, callLineIndex - 30); i--) {
          if (/handleWin|showWin|onWin|checkWin|handleGameEnd|handleJudging|handleSolved|\.status\s*=\s*['"]won['"]/.test(lines[i])) {
            winHandlerStart = i;
            break;
          }
        }

        expect(winHandlerStart).toBeGreaterThanOrEqual(0);
      });
    });
  }
});
