/**
 * Game audio wiring — contract tests
 * @vitest-environment node
 *
 * Verifies that each of the 11 previously-silent games wires the persisted
 * `soundEnabled` setting into the shared audio gate so the on-screen sound
 * toggle actually controls synthesized SFX (i.e. the control no longer "lies").
 *
 * Why a source contract test, not a behavioral one:
 *   game.js modules cannot be unit-bootstrapped — they construct Three.js /
 *   Phaser renderers, fetch levels.json, and attach DOM listeners at import
 *   time. Every existing per-game unit test targets state.js instead. The
 *   shared module's half of the contract — that `playSound()` returns null
 *   when `soundEnabled` is false — is already exhaustively covered by
 *   tests/unit/audio.test.js and tests/shared/audio.test.js. This file covers
 *   the games' half: that they feed the persisted setting into that gate and
 *   call playSound for at least one core action.
 *
 * The contract each game must satisfy:
 *   1. import { playSound, setSoundEnabled } from '../../shared/audio.js'
 *   2. call setSoundEnabled(getSettings().soundEnabled) at init — so the
 *      persisted setting gates playback
 *   3. call playSound(...) at least once (SFX is wired to a real action)
 *   4. if the game ships a sound UI control (btn-sound header toggle or a
 *      setting-sound drawer switch), toggling it must call setSoundEnabled
 *      live — so flipping the control updates the gate without a reload.
 *      (pull-the-pin has no sound UI control, so it gates only at init.)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../../src/games');

// The 11 games this bead covers (brain-teaser & bus-jam use their own local
// audio.js and are out of scope here).
const GAMES = [
  'bridge-race',
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

function readGame(name) {
  return readFileSync(resolve(SRC, name, 'game.js'), 'utf8');
}

function readHtml(name) {
  return readFileSync(resolve(SRC, name, 'index.html'), 'utf8');
}

describe('shared/audio.js wiring across all 11 games', () => {
  for (const game of GAMES) {
    describe(`${game}/game.js`, () => {
      const src = readGame(game);

      it('imports playSound and setSoundEnabled from shared/audio.js', () => {
        expect(src, 'must import the shared audio module').toContain(
          "from '../../shared/audio.js'"
        );
        expect(src, 'must import playSound').toContain('playSound');
        expect(src, 'must import setSoundEnabled').toContain('setSoundEnabled');
      });

      it('gates SFX on the persisted soundEnabled setting at init', () => {
        // The persisted setting must flow into the shared gate so playSound
        // (which checks soundEnabled internally) honors it.
        expect(src).toContain('setSoundEnabled(getSettings().soundEnabled)');
      });

      it('calls playSound for at least one core action', () => {
        expect(src).toMatch(/playSound\s*\(/);
      });

      it('wires a live sound toggle when it ships a sound UI control', () => {
        const html = readHtml(game);
        const hasSoundUi =
          html.includes('id="btn-sound"') || html.includes('id="setting-sound"');

        // Count setSoundEnabled call sites: 1 = init gate only.
        const setSoundCalls = (src.match(/setSoundEnabled\s*\(/g) || []).length;

        if (hasSoundUi) {
          // init gate + at least one live toggle handler
          expect(
            setSoundCalls,
            `${game} has a sound UI control, so toggling it must call setSoundEnabled live`
          ).toBeGreaterThanOrEqual(2);
        } else {
          // No sound UI control (pull-the-pin): gate only at init.
          expect(
            setSoundCalls,
            `${game} has no sound UI control, so it must still gate at init`
          ).toBeGreaterThanOrEqual(1);
        }
      });
    });
  }
});

describe('sound UI controls are present where the games wire them', () => {
  // Sanity: every game that toggles sound live must actually ship the control
  // it references, and pull-the-pin correctly has no sound UI control.
  it.each([
    ['pull-the-pin', false],
    ['save-the-character', true], // btn-sound header toggle
    ['water-sort', true], // btn-sound + setting-sound
    ['parking-escape', true], // btn-sound + setting-sound
    ['bridge-race', true], // setting-sound
    ['crowd-runner', true], // setting-sound
    ['makeover-run', true], // setting-sound
  ])('%s sound UI control presence matches expectation', (game, expected) => {
    const html = readHtml(game);
    const present =
      html.includes('id="btn-sound"') || html.includes('id="setting-sound"');
    expect(present).toBe(expected);
  });
});
