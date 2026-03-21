/**
 * Pull the Pin - Game Lifecycle Controller
 *
 * Manages game state, physics simulation loop,
 * and user interactions.
 */

import * as state from './state.js';
import { createRenderer } from './renderer.js';
import { createInputHandler } from './input.js';

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
