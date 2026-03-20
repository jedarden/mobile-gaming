/**
 * Jelly Shift - Input Handler
 *
 * Handles drag/swipe vertically to reshape the jelly blob.
 * Drag up = tall + narrow, drag down = wide + flat.
 * Continuous real-time control.
 *
 * Uses shared/input.js for normalized pointer events.
 */

import { onDrag, disableTouchActions } from '../../shared/input.js';

// Reshape sensitivity
const RESHAPE_SENSITIVITY = 0.015;

/**
 * Create input handler for Jelly Shift
 *
 * @param {Object} options - Configuration
 * @param {HTMLElement} options.element - Element to listen on
 * @param {Function} options.onReshape - Callback with widthDelta when reshaping
 * @returns {Object} Input controller with init() and destroy() methods
 */
export function createInput(options) {
  const { element, onReshape } = options;

  let cleanupDrag = null;

  /**
   * Initialize input listeners
   */
  function init() {
    disableTouchActions(element);

    cleanupDrag = onDrag(element, ({ dy, isDragging }) => {
      if (isDragging && onReshape) {
        // Drag up (negative dy) = decrease width = tall + narrow
        // Drag down (positive dy) = increase width = wide + flat
        const widthDelta = dy * RESHAPE_SENSITIVITY;
        onReshape(widthDelta);
      }
    });

    // Keyboard support: up/down arrows, W/S
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
  }

  let keysDown = new Set();

  function handleKeyDown(e) {
    keysDown.add(e.key);
  }

  function handleKeyUp(e) {
    keysDown.delete(e.key);
  }

  /**
   * Process held keys - called each frame
   */
  function processKeys(dt) {
    if (!onReshape) return;

    const keySpeed = RESHAPE_SENSITIVITY * 60 * dt;

    if (keysDown.has('ArrowUp') || keysDown.has('w') || keysDown.has('W')) {
      onReshape(-keySpeed * 2);
    }
    if (keysDown.has('ArrowDown') || keysDown.has('s') || keysDown.has('S')) {
      onReshape(keySpeed * 2);
    }
  }

  /**
   * Remove all input listeners
   */
  function destroy() {
    if (cleanupDrag) cleanupDrag();
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    keysDown.clear();
  }

  return { init, destroy, processKeys };
}

export default { createInput };
