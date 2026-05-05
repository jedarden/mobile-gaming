/**
 * Bus Jam - Input Handler
 *
 * Game-specific input mapping for Bus Jam.
 * With Phaser, input is handled by the scene, so this module
 * provides a thin wrapper to wire up callbacks.
 *
 * The hit-testing logic (canvasToGrid, hitTestBusAt) is now in renderer.js
 * and used by the Phaser scene directly.
 */

/**
 * Create input handler for Bus Jam
 *
 * @param {Object} options - Configuration
 * @param {HTMLCanvasElement} options.canvas - Game canvas element (used by Phaser)
 * @param {Object} options.renderer - Renderer instance (Phaser game wrapper)
 * @param {Function} options.onCellTap - Callback when a grid cell is tapped: (gridX, gridY)
 * @param {Function} options.onCellHover - Callback when pointer moves over a cell: (gridX, gridY)
 * @returns {Object} Input controller with init() and destroy() methods
 */
export function createInput(options) {
  const { renderer, onCellTap, onCellHover } = options;
  let initialized = false;

  /**
   * Initialize input handling
   * Wire up callbacks to renderer's Phaser scene
   */
  function init() {
    if (initialized) return;

    // The renderer handles input via Phaser scene
    // We just need to set the callbacks
    if (renderer && renderer.setCallbacks) {
      renderer.setCallbacks({ onCellTap, onCellHover });
    }

    initialized = true;
  }

  /**
   * Remove input listeners
   */
  function destroy() {
    if (renderer && renderer.setCallbacks) {
      renderer.setCallbacks({ onCellTap: null, onCellHover: null });
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
  const { onCellTap, onCellHover } = callbacks;

  /**
   * Get canvas-relative coordinates from event
   */
  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  /**
   * Handle pointer move for hover/path preview
   */
  function handleMove(e) {
    if (!onCellHover) return;

    const coords = getCoords(e);
    const scale = 1; // Default scale for testing
    const gridPos = canvasToGrid(coords.x, coords.y, scale);
    onCellHover(gridPos.x, gridPos.y);
  }

  /**
   * Handle pointer click/tap
   */
  function handleClick(e) {
    if (!onCellTap) return;

    const coords = getCoords(e);
    const scale = 1; // Default scale for testing
    const gridPos = canvasToGrid(coords.x, coords.y, scale);
    onCellTap(gridPos.x, gridPos.y);
  }

  // Mouse events
  canvas.addEventListener('mousemove', handleMove, { passive: true });
  canvas.addEventListener('click', handleClick);

  return {
    /**
     * Cleanup event listeners
     */
    destroy() {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('click', handleClick);
    }
  };
}

/**
 * Convert canvas coordinates to grid coordinates
 * Exported for testing compatibility
 */
function canvasToGrid(canvasX, canvasY, scale = 1) {
  const CELL_SIZE = 60;
  return {
    x: Math.floor(canvasX / (CELL_SIZE * scale)),
    y: Math.floor(canvasY / (CELL_SIZE * scale))
  };
}

export default { createInput, createInputHandler };
