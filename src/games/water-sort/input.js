/**
 * Water Sort - Input Handler
 *
 * Game-specific input mapping for Water Sort.
 * With Phaser, input is handled by the scene, so this module
 * provides a thin wrapper to wire up callbacks.
 *
 * The hit-testing logic (canvasToTubeIndex) is now in renderer.js
 * and used by the Phaser scene directly.
 */

/**
 * Create input handler for Water Sort
 *
 * @param {Object} options - Configuration
 * @param {HTMLCanvasElement} options.canvas - Game canvas element (used by Phaser)
 * @param {Object} options.renderer - Renderer instance (Phaser game wrapper)
 * @param {Function} options.onTubeTap - Callback when a tube is tapped: (tubeIndex)
 * @returns {Object} Input controller with init() and destroy() methods
 */
export function createInput(options) {
  const { renderer, onTubeTap } = options;
  let initialized = false;

  /**
   * Initialize input handling
   * Wire up callback to renderer's Phaser scene
   */
  function init() {
    if (initialized) return;

    // The renderer handles input via Phaser scene
    // We just need to set the callback
    if (renderer && renderer.setOnTubeTap) {
      renderer.setOnTubeTap(onTubeTap);
    }

    initialized = true;
  }

  /**
   * Remove input listeners
   */
  function destroy() {
    if (renderer && renderer.setOnTubeTap) {
      renderer.setOnTubeTap(null);
    }
    initialized = false;
  }

  return { init, destroy };
}

export default { createInput };
