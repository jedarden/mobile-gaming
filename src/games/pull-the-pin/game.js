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
  let animationFrame = null;
  let physicsInterval = null;

  /**
   * Load a level
   */
  function loadLevel(level) {
    gameState = state.createInitialState(level);

    // Setup input handling
    if (inputHandler) {
      inputHandler.destroy();
    }

    inputHandler = createInputHandler(canvas, {
      onPinTap: handlePinTap,
      onTapMiss: () => {}
    });

    // Initial render
    render();

    return gameState;
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
    gameState = state.removePin(gameState, pinId);

    if (onPinRemoved) {
      onPinRemoved(pinId);
    }

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
  }

  return {
    loadLevel,
    reset,
    getState,
    render,
    destroy
  };
}

export default {
  createGame
};

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  const levels = levelsData;
  let currentLevelIndex = 0;

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
    onWin() {
      const hasNext = currentLevelIndex < levels.length - 1;
      showOverlay('Level Complete!', 'All balls reached their cups!', hasNext);
    },
    onLose() {
      showOverlay('Try Again', 'A ball missed its cup.', false);
    },
    onPinRemoved() {
      updateUI(game.getState());
    }
  });

  function loadLevel(index) {
    currentLevelIndex = index;
    hideOverlay();
    game.loadLevel(levels[index]);
    updateUI(game.getState());
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
