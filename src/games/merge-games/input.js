/**
 * Merge Games - Input Handler
 *
 * Drag a tile from one cell and drop on an adjacent cell.
 * If same tier → merge. If empty → move (not supported, only merge).
 *
 * With Phaser, input is handled by the scene, so this module
 * provides a thin wrapper to wire up callbacks.
 */

/**
 * Create input handler for Merge Games
 *
 * @param {Object} options - Configuration
 * @param {HTMLCanvasElement} options.canvas - Game canvas element (used by Phaser)
 * @param {Object} options.renderer - Renderer instance (Phaser game wrapper)
 * @param {Function} options.getState - Function to get current game state
 * @param {Function} options.onMerge - Callback when a merge occurs: (r1, c1, r2, c2)
 * @returns {Object} Input controller with init() and destroy() methods
 */
export function createInput(options) {
  const { renderer, getState, onMerge } = options;
  let initialized = false;

  /**
   * Initialize input handling
   * Wire up callback to renderer's Phaser scene
   */
  function init() {
    if (initialized) return;

    // The renderer handles input via Phaser scene
    // We just need to set the callback
    if (renderer && renderer.setOnMerge) {
      renderer.setOnMerge((r1, c1, r2, c2) => {
        const state = getState();
        if (state && state.status === 'playing') {
          onMerge(r1, c1, r2, c2);
        }
      });
    }

    initialized = true;
  }

  /**
   * Remove input listeners
   */
  function destroy() {
    if (renderer && renderer.setOnMerge) {
      renderer.setOnMerge(null);
    }
    initialized = false;
  }

  return { init, destroy };
}

export default { createInput };
