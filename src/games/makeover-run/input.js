/**
 * Makeover Run - Input Handler
 *
 * Left/right drag or swipe steers the character between lanes.
 * Auto-runner: character advances forward automatically.
 */

import { onDrag, disableTouchActions } from '../../shared/input.js';

// How much a single drag pixel moves the x position
const STEER_SENSITIVITY = 0.008;

/**
 * Create input handler for Makeover Run.
 *
 * @param {Object} options
 * @param {HTMLElement} options.element - Element to listen on
 * @param {Function} options.onSteer   - Called with (delta) on drag
 * @returns {{ init, destroy }}
 */
export function createInput({ element, onSteer }) {
  let cleanupDrag = null;

  function init() {
    disableTouchActions(element);

    cleanupDrag = onDrag(element, ({ dx, isDragging }) => {
      if (isDragging && onSteer) {
        onSteer(dx * STEER_SENSITIVITY);
      }
    });

    document.addEventListener('keydown', handleKeyDown);
  }

  function handleKeyDown(e) {
    if (!onSteer) return;
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        onSteer(-0.25);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        onSteer(0.25);
        break;
    }
  }

  function destroy() {
    if (cleanupDrag) cleanupDrag();
    document.removeEventListener('keydown', handleKeyDown);
  }

  return { init, destroy };
}

export default { createInput };
