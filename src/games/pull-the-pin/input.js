/**
 * Pull the Pin - Input Handler
 *
 * Handles user interactions:
 * - Tap on pins to remove them
 * - Touch and mouse support
 * - Coordinate conversion
 */

/**
 * Create input handler for the game
 *
 * @param {HTMLCanvasElement} canvas - Game canvas
 * @param {Object} callbacks - Event callbacks
 * @returns {Object} Input handler with cleanup method
 */
export function createInputHandler(canvas, callbacks) {
  const { onPinTap, onTapMiss: _onTapMiss } = callbacks;

  // Track touch/mouse state
  let isDown = false;
  let lastX = 0;
  let lastY = 0;

  /**
   * Get canvas-relative coordinates from event
   */
  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  /**
   * Check if a point hits a pin
   */
  function hitTestPin(x, y, pin) {
    // Pin is a rectangle with handle
    const handleRadius = 10;

    // Check main body
    if (x >= pin.x - 20 && x <= pin.x + 20 &&
        y >= pin.y - 10 && y <= pin.y + 10) {
      return true;
    }

    // Check handle circle
    const handleX = pin.x + 30;
    const handleY = pin.y;
    const dist = Math.sqrt((x - handleX) ** 2 + (y - handleY) ** 2);
    if (dist <= handleRadius) {
      return true;
    }

    return false;
  }

  /**
   * Handle pointer down
   */
  function handleDown(e) {
    e.preventDefault();
    isDown = true;

    const coords = getCoords(e);
    lastX = coords.x;
    lastY = coords.y;
  }

  /**
   * Handle pointer up (tap complete)
   */
  function handleUp(e) {
    e.preventDefault();

    if (!isDown) return;
    isDown = false;

    const coords = getCoords(e.changedTouches ? e.changedTouches[0] : e);

    // Check for significant movement (not a tap)
    const dx = Math.abs(coords.x - lastX);
    const dy = Math.abs(coords.y - lastY);
    if (dx > 20 || dy > 20) {
      return; // Not a tap
    }

    // Check if it's a valid tap
    if (onPinTap) {
      onPinTap(coords.x, coords.y);
    }
  }

  /**
   * Handle mouse click
   */
  function handleClick(e) {
    const coords = getCoords(e);

    if (onPinTap) {
      onPinTap(coords.x, coords.y);
    }
  }

  // Mouse events
  canvas.addEventListener('mousedown', handleDown);
  canvas.addEventListener('mouseup', handleUp);
  canvas.addEventListener('click', handleClick);

  // Touch events
  canvas.addEventListener('touchstart', handleDown, { passive: false });
  canvas.addEventListener('touchend', handleUp, { passive: false });

  return {
    /**
     * Find pin at coordinates
     */
    findPinAt(x, y, pins) {
      for (const pin of pins) {
        if (!pin.removed && hitTestPin(x, y, pin)) {
          return pin;
        }
      }
      return null;
    },

    /**
     * Cleanup event listeners
     */
    destroy() {
      canvas.removeEventListener('mousedown', handleDown);
      canvas.removeEventListener('mouseup', handleUp);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchstart', handleDown);
      canvas.removeEventListener('touchend', handleUp);
    }
  };
}

export default {
  createInputHandler
};
