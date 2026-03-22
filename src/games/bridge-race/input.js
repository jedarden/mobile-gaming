/**
 * Bridge Race - Input Handler
 *
 * Joystick/drag input: drag on canvas → compute dx, dz for player movement.
 * Touch and mouse support.
 */

import { onDrag, disableTouchActions } from '../../shared/input.js';
import { ENTITY_SPEED } from './state.js';

// Pixels per world unit sensitivity
const DRAG_SENSITIVITY = 0.015;

/**
 * Create input handler for Bridge Race.
 *
 * @param {Object} options
 * @param {HTMLElement} options.element - Element to listen on
 * @param {Function} options.onMove    - Called with ({ dx, dz }) normalized movement
 * @returns {{ init, destroy }}
 */
export function createInput({ element, onMove }) {
  let cleanupDrag = null;
  let activeMove = { dx: 0, dz: 0 };
  let pointerDown = false;

  function init() {
    disableTouchActions(element);

    cleanupDrag = onDrag(element, ({ dx, dy, isDragging }) => {
      if (isDragging) {
        pointerDown = true;
        activeMove = {
          dx: dx * DRAG_SENSITIVITY * ENTITY_SPEED,
          dz: dy * DRAG_SENSITIVITY * ENTITY_SPEED
        };
        if (onMove) onMove(activeMove);
      } else {
        activeMove = { dx: 0, dz: 0 };
        pointerDown = false;
      }
    });

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
  }

  const keyState = {};

  function handleKeyDown(e) {
    keyState[e.key] = true;
    emitKeyMove();
  }

  function handleKeyUp(e) {
    keyState[e.key] = false;
    emitKeyMove();
  }

  function emitKeyMove() {
    if (!onMove) return;
    let dx = 0;
    let dz = 0;
    const speed = ENTITY_SPEED * (1 / 60);

    if (keyState['ArrowLeft']  || keyState['a'] || keyState['A']) dx -= speed;
    if (keyState['ArrowRight'] || keyState['d'] || keyState['D']) dx += speed;
    if (keyState['ArrowUp']    || keyState['w'] || keyState['W']) dz -= speed;
    if (keyState['ArrowDown']  || keyState['s'] || keyState['S']) dz += speed;

    onMove({ dx, dz });
  }

  function destroy() {
    if (cleanupDrag) cleanupDrag();
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
  }

  return { init, destroy };
}

export default { createInput };
