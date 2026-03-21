/**
 * Giant Runner - Input Handler
 *
 * Handles swipe/drag gestures for left-right steering.
 * Auto-runner movement is handled by game state, not input.
 *
 * Uses shared/input.js for normalized pointer events.
 */

import { onDrag, disableTouchActions } from '../../shared/input.js';

// Steering sensitivity
const STEER_SENSITIVITY = 0.015;

/**
 * Create input handler for Giant Runner
 *
 * @param {Object} options - Configuration
 * @param {HTMLElement} options.element - Element to listen on
 * @param {Function} options.onSteer - Callback when steering: (xDelta)
 * @returns {Object} Input controller with init() and destroy() methods
 */
export function createInput(options) {
  const { element, onSteer } = options;

  let cleanupDrag = null;

  /**
   * Initialize input listeners
   */
  function init() {
    disableTouchActions(element);

    cleanupDrag = onDrag(element, ({ dx, isDragging }) => {
      if (isDragging && onSteer) {
        // Convert pixel movement to game units
        const xDelta = dx * STEER_SENSITIVITY;
        onSteer(xDelta);
      }
    });

    // Keyboard support
    document.addEventListener('keydown', handleKeyDown);
  }

  /**
   * Handle keyboard input
   */
  function handleKeyDown(e) {
    if (!onSteer) return;

    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        onSteer(-0.3);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        onSteer(0.3);
        break;
    }
  }

  /**
   * Remove all input listeners
   */
  function destroy() {
    if (cleanupDrag) cleanupDrag();
    document.removeEventListener('keydown', handleKeyDown);
  }

  return { init, destroy };
}

export default { createInput };
