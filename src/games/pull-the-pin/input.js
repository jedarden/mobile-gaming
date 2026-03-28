/**
 * Pull the Pin - Input Handler
 *
 * Game-specific input mapping for Pull the Pin.
 * With Phaser, input is handled by the scene, so this module
 * provides a thin wrapper to wire up callbacks.
 *
 * The hit-testing logic (getPinAtPosition) is now in renderer.js
 * and used by the Phaser scene directly.
 */

/**
 * Create input handler for Pull the Pin
 *
 * @param {Object} options - Configuration
 * @param {HTMLCanvasElement} options.canvas - Game canvas element (used by Phaser)
 * @param {Object} options.renderer - Renderer instance (Phaser game wrapper)
 * @param {Function} options.onPinTap - Callback when a pin is tapped: (pinId)
 * @returns {Object} Input controller with init() and destroy() methods
 */
export function createInput(options) {
  const { renderer, onPinTap } = options;
  let initialized = false;

  /**
   * Initialize input handling
   * Wire up callback to renderer's Phaser scene
   */
  function init() {
    if (initialized) return;

    // The renderer handles input via Phaser scene
    // We just need to set the callback
    if (renderer && renderer.setOnPinTap) {
      renderer.setOnPinTap(onPinTap);
    }

    initialized = true;
  }

  /**
   * Remove input listeners
   */
  function destroy() {
    if (renderer && renderer.setOnPinTap) {
      renderer.setOnPinTap(null);
    }
    initialized = false;
  }

  return { init, destroy };
}

/**
 * Legacy function for backward compatibility with tests
 * Creates a canvas-based input handler
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
     * Find pin at coordinates (for testing)
     */
    findPinAt(x, y, pins) {
      // Use the exported function from renderer if available
      // Fall back to inline implementation for testing
      for (const pin of pins) {
        if (!pin.removed) {
          const handleRadius = 10;

          // Check main body
          if (x >= pin.x - 20 && x <= pin.x + 20 &&
              y >= pin.y - 10 && y <= pin.y + 10) {
            return pin;
          }

          // Check handle circle
          const handleX = pin.x + 30;
          const handleY = pin.y;
          const dist = Math.sqrt((x - handleX) ** 2 + (y - handleY) ** 2);
          if (dist <= handleRadius) {
            return pin;
          }
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

export default { createInput, createInputHandler };
