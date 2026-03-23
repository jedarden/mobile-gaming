/**
 * Pull the Pin - Game Lifecycle Controller
 *
 * Manages game state, physics simulation loop,
 * and user interactions.
 */

import * as state from './state.js';
import { createRenderer } from './renderer.js';
import { createInputHandler } from './input.js';
import levelsData from './levels.json';
import { initStorage, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { haptic } from '../../shared/haptics.js';
import { recordLevel } from '../../shared/adaptive.js';
import { isColorBlindEnabled } from '../../shared/color-blind.js';
import { createHintSession, getHintTokens } from '../../shared/hints.js';

const PHYSICS_TICK_MS = 1000 / 60; // 60 FPS

/**
 * Create game instance
 *
 * @param {HTMLCanvasElement} canvas - Game canvas
 * @param {Object} options - Game options
 * @returns {Object} Game controller
 */
export function createGame(canvas, options = {}) {
  const { onWin, onLose, onPinRemoved, audio } = options;

  // Load initial level
  let gameState = null;
  let renderer = createRenderer(canvas);
  let inputHandler = null;
  let physicsInterval = null;
  let hintSession = null;

  /**
   * Load a level
   */
  function loadLevel(level) {
    gameState = state.createInitialState(level);
    renderer.resetAnimations();

    // Setup input handling
    if (inputHandler) {
      inputHandler.destroy();
    }

    inputHandler = createInputHandler(canvas, {
      onPinTap: handlePinTap,
      onTapMiss: () => {}
    });

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
   * Handle tap on canvas
   */
  function handlePinTap(x, y) {
    if (!gameState || gameState.status !== 'playing') return;

    const pin = inputHandler.findPinAt(x, y, gameState.pins);
    if (pin) {
      removePin(pin.id);
    }
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

    if (audio) {
      audio.play('pull');
    }

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
      // After physics stops on win, drive confetti animation via RAF loop
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
    if (gameState) {
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

  return {
    loadLevel,
    reset,
    getState,
    render,
    destroy,
    showHint() { if (hintSession) hintSession.showHint(); },
    setReducedMotion(v) { renderer.setReducedMotion(v); },
    setColorBlindMode(v) { renderer.setColorBlindMode(v); }
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

  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  const levels = levelsData;
  let currentLevelIndex = 0;
  let levelStartTime = Date.now();
  let levelRetries = 0;

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
  if (hintBtn) {
    hintBtn.addEventListener('click', () => game.showHint());
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

  loadLevel(0);
});
