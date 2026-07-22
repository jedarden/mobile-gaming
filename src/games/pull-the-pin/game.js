/**
 * Pull the Pin - Game Lifecycle Controller
 *
 * Manages game state, physics simulation loop,
 * and user interactions.
 */

import * as state from './state.js';
import { createRenderer } from './renderer.js';
import { createInput } from './input.js';
import levelsData from './levels.json';
import { initStorage, getSettings, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { playSound, setSoundEnabled, resumeAudio } from '../../shared/audio.js';
import { haptic } from '../../shared/haptics.js';
import { recordLevel } from '../../shared/adaptive.js';
import { isColorBlindEnabled } from '../../shared/color-blind.js';
import { createHintSession, getHintTokens } from '../../shared/hints.js';
import { createRetryOverlay, ResultType } from '../../shared/retry.js';
import { quickShare, generateShareText } from '../../shared/share.js';
import { encodeState, decodeState, isStateHash } from '../../shared/state-url.js';

const PHYSICS_TICK_MS = 1000 / 60; // 60 FPS

/**
 * Create game instance
 *
 * @param {HTMLCanvasElement} canvas - Game canvas
 * @param {Object} options - Game options
 * @returns {Object} Game controller
 */
export function createGame(canvas, options = {}) {
  const { onWin, onLose, onPinRemoved } = options;

  // Load initial level
  let gameState = null;
  let renderer = null;
  let inputHandler = null;
  let physicsInterval = null;
  let hintSession = null;

  /**
   * Initialize renderer with state
   * Called once when game is first created
   */
  function initRenderer(initialState) {
    renderer = createRenderer(canvas);
    renderer.setReducedMotion(isReducedMotionEnabled());
    renderer.setColorBlindMode(isColorBlindEnabled());

    // Set up input callback
    if (inputHandler) {
      inputHandler.destroy();
    }

    inputHandler = createInput({
      canvas,
      renderer,
      onPinTap: handlePinTap
    });
    inputHandler.init();
  }

  /**
   * Load a level
   */
  function loadLevel(level) {
    gameState = state.createInitialState(level);

    // Initialize renderer if not already done
    if (!renderer) {
      initRenderer(gameState);
    }

    renderer.resetAnimations();

    // Reset hint session for new level
    if (hintSession) { hintSession.destroy(); }
    hintSession = createHintSession({
      gameId: 'pull-the-pin',
      level,
      getState: () => gameState,
      onHighlight: ({ move }) => {
        renderer.setHintPin(move.pinId);
        render();
      },
      onShowMove: ({ move }) => {
        renderer.setHintPin(move.pinId);
        render();
      },
      onAutoPlay: ({ move }) => {
        renderer.setHintPin(null);
        if (gameState && gameState.status === 'playing') {
          removePin(move.pinId);
        }
      },
      onTokensEmpty: updateHintButton,
    });
    updateHintButton();

    // Initial render
    render();

    return gameState;
  }

  function updateHintButton() {
    const btn = document.getElementById('btn-hint');
    if (!btn) return;
    const tokens = getHintTokens();
    btn.textContent = `Hint (${tokens})`;
    btn.disabled = tokens <= 0;
  }

  /**
   * Handle tap on canvas (called from Phaser scene)
   */
  function handlePinTap(pinId) {
    if (!gameState || gameState.status !== 'playing') return;
    removePin(pinId);
  }

  /**
   * Remove a pin and start physics simulation
   */
  function removePin(pinId) {
    renderer.setHintPin(null);
    gameState = state.removePin(gameState, pinId);

    if (onPinRemoved) {
      onPinRemoved(pinId);
    }

    haptic('pin_pull');

    // Pin-pull SFX (gated by the shared soundEnabled setting)
    resumeAudio();
    playSound('slide');

    // Start physics simulation
    startPhysics();
  }

  /**
   * Start physics simulation loop
   */
  function startPhysics() {
    if (physicsInterval) {
      clearInterval(physicsInterval);
    }

    physicsInterval = setInterval(() => {
      if (!gameState) {
        stopPhysics();
        return;
      }

      // Run one physics step
      gameState = state.simulateStep(gameState);

      // Check if simulation is done
      const allDone = gameState.balls.every(b => b.settled || b.lost);
      if (allDone) {
        stopPhysics();
        gameState = { ...gameState, status: state.checkWin(gameState) };

        if (gameState.status === 'won' && onWin) {
          onWin();
        } else if (gameState.status === 'lost' && onLose) {
          onLose();
        }
      }

      render();
      // After physics stops on win, drive confetti animation via loop
      if (allDone && gameState.status === 'won') renderer.startLoop();
    }, PHYSICS_TICK_MS);
  }

  /**
   * Stop physics simulation
   */
  function stopPhysics() {
    if (physicsInterval) {
      clearInterval(physicsInterval);
      physicsInterval = null;
    }
  }

  /**
   * Render current state
   */
  function render() {
    if (gameState && renderer) {
      renderer.render(gameState);
    }
  }

  /**
   * Reset current level
   */
  function reset(level) {
    stopPhysics();
    if (hintSession) hintSession.reset();
    loadLevel(level || gameState);
  }

  /**
   * Get current state
   */
  function getState() {
    return gameState;
  }

  /**
   * Cleanup game resources
   */
  function destroy() {
    stopPhysics();
    if (inputHandler) {
      inputHandler.destroy();
    }
    if (hintSession) {
      hintSession.destroy();
      hintSession = null;
    }
  }

  /**
   * Hydrate the game from a decoded shared state (shared/state-url.js).
   *
   * The level is loaded first so the hint session / renderer are wired to the
   * right level, then gameState is replaced with the restored board. A state
   * captured mid-animation is normalized to 'playing' so the player can resume.
   *
   * @param {Object} level - Level definition (for hint session)
   * @param {Object} saved - Decoded game state
   * @returns {Object} The restored game state
   */
  function hydrate(level, saved) {
    loadLevel(level);
    if (saved && typeof saved === 'object') {
      gameState = {
        ...saved,
        status: saved.status === 'animating' ? 'playing' : (saved.status || 'playing'),
      };
      render();
    }
    return gameState;
  }

  return {
    loadLevel,
    reset,
    getState,
    hydrate,
    render,
    destroy,
    showHint() { if (hintSession) hintSession.showHint(); },
    getHintLevel() { return hintSession?.level ?? 0; },
    setReducedMotion(v) { if (renderer) renderer.setReducedMotion(v); },
    setColorBlindMode(v) { if (renderer) renderer.setColorBlindMode(v); }
  };
}

export default {
  createGame
};

const GAME_ID = 'pull-the-pin';

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', async () => {
  await initStorage();
  initAccessibility();

  // Gate synthesized SFX on the persisted sound setting
  setSoundEnabled(getSettings().soundEnabled);

  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  const levels = levelsData;
  let currentLevelIndex = 0;
  let levelStartTime = Date.now();
  let levelRetries = 0;
  let retryOverlay = null;

  const levelIndicator = document.getElementById('level-indicator');
  const pinCountEl = document.getElementById('pin-count');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMessage = document.getElementById('overlay-message');
  const overlayRetry = document.getElementById('overlay-retry');
  const overlayNext = document.getElementById('overlay-next');
  const resetBtn = document.getElementById('reset-btn');

  function showOverlay(title, message, showNext) {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayMessage) overlayMessage.textContent = message;
    if (overlayNext) overlayNext.style.display = showNext ? '' : 'none';
    if (overlay) overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    if (overlay) overlay.classList.add('hidden');
  }

  function updateUI(gameState) {
    if (levelIndicator) levelIndicator.textContent = `Level ${currentLevelIndex + 1}`;
    if (pinCountEl && gameState) {
      const remaining = gameState.pins.filter(p => !p.removed).length;
      pinCountEl.textContent = `Pins: ${remaining}`;
    }
  }

  const game = createGame(canvas, {
    async onWin() {
      haptic('win');
      recordLevel(GAME_ID, {
        retryCount: levelRetries,
        solveTime: Date.now() - levelStartTime,
        hintUsage: game.getHintLevel(),
      }, { won: true });
      const hasNext = currentLevelIndex < levels.length - 1;
      showOverlay('Level Complete!', 'All balls reached their cups!', hasNext);
      announce(`Level ${currentLevelIndex + 1} complete! All balls reached their cups!`);
      await updateGameStats(GAME_ID, { lastLevel: currentLevelIndex, played: 1, completed: 1, stars: 3 });
      await awardLevelComplete(GAME_ID, 3, { levelId: currentLevelIndex });
    },
    onLose() {
      haptic('fail');
      recordLevel(GAME_ID, {
        retryCount: levelRetries,
        solveTime: Date.now() - levelStartTime,
        hintUsage: game.getHintLevel(),
      }, { won: false });
      showOverlay('Try Again', 'A ball missed its cup.', false);
      announce('A ball missed its cup. Try again!');
    },
    onPinRemoved() {
      updateUI(game.getState());
    }
  });
  game.setReducedMotion(isReducedMotionEnabled());
  game.setColorBlindMode(isColorBlindEnabled());
  // Exposed for e2e tests (shareable-state round-trip).
  window.__ptpGame = game;

  /**
   * Read a shared puzzle state from window.location.hash, if present and valid.
   * @returns {{levelIndex:number, state:Object}|null}
   */
  function readSharedState() {
    const hash = window.location.hash;
    if (!isStateHash(hash)) return null;
    const decoded = decodeState(hash);
    if (!decoded || decoded.gameId !== GAME_ID) return null;
    const s = decoded.state;
    if (!s || typeof s !== 'object' || !s.state) return null;
    return s;
  }

  /**
   * Encode the current puzzle into a #s=… link, put it in the address bar and
   * copy it to the clipboard so it can be shared / resumed later.
   */
  async function shareState() {
    const gs = game.getState();
    if (!gs) return;
    const payload = { levelIndex: currentLevelIndex, state: gs };
    const hash = encodeState(GAME_ID, payload);
    window.location.hash = hash;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch {
      // Clipboard access can be denied; the hash is still shareable.
    }
    announce('Puzzle link copied to clipboard.');
  }

  const shareBtn = document.getElementById('btn-share');
  if (shareBtn) shareBtn.addEventListener('click', shareState);

  function loadLevel(index) {
    const isRetry = index === currentLevelIndex && levelStartTime > 0;
    if (isRetry) levelRetries++;
    else levelRetries = 0;
    currentLevelIndex = index;
    levelStartTime = Date.now();
    hideOverlay();
    game.loadLevel(levels[index]);
    updateUI(game.getState());
    announce(`Level ${index + 1}. Pull the pins to guide the balls into the cups.`);
  }

  const hintBtn = document.getElementById('btn-hint');
  function updateHintButton() {
    if (!hintBtn) return;
    const tokens = getHintTokens();
    hintBtn.textContent = `Hint (${tokens})`;
    hintBtn.disabled = tokens <= 0;
  }
  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      game.showHint();
      updateHintButton();
    });
  }

  if (overlayRetry) {
    overlayRetry.addEventListener('click', () => loadLevel(currentLevelIndex));
  }
  if (overlayNext) {
    overlayNext.addEventListener('click', () => {
      if (currentLevelIndex < levels.length - 1) {
        loadLevel(currentLevelIndex + 1);
      }
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => loadLevel(currentLevelIndex));
  }

  // A shared puzzle link (#s=...) takes precedence over loading level 1.
  const shared = readSharedState();
  if (shared) {
    currentLevelIndex = Math.min(Math.max(shared.levelIndex | 0, 0), levels.length - 1);
    levelStartTime = Date.now();
    hideOverlay();
    game.hydrate(levels[currentLevelIndex], shared.state);
    updateUI(game.getState());
    announce('Resumed a shared puzzle.');
  } else {
    loadLevel(0);
  }
});
