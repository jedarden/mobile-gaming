/**
 * Water Sort - Input Handler
 *
 * Game-specific input mapping for Water Sort.
 * Translates pointer events into tube selection actions:
 * - Tap tube to select
 * - Tap another tube to pour
 * - Tap same tube to deselect
 *
 * Uses shared/input.js for normalized pointer events.
 */

import { onTap, disableTouchActions } from '../../shared/input.js';

/**
 * Create input handler for Water Sort
 *
 * @param {Object} options - Configuration
 * @param {HTMLCanvasElement} options.canvas - Game canvas element
 * @param {Object} options.renderer - Renderer instance (must expose canvasToTubeIndex)
 * @param {Function} options.onTubeTap - Callback when a tube is tapped: (tubeIndex)
 * @returns {Object} Input controller with init() and destroy() methods
 */
export function createInput(options) {
  const { canvas, renderer, onTubeTap } = options;
  let cleanupTap = null;

  /**
   * Handle tap: convert to tube index and notify
   */
  function init() {
    disableTouchActions(canvas);

    cleanupTap = onTap(canvas, ({ x, y }) => {
      const tubeIdx = renderer.canvasToTubeIndex(x, y, null);
      if (tubeIdx >= 0 && onTubeTap) {
        onTubeTap(tubeIdx);
      }
    });
  }

  /**
   * Remove all input listeners
   */
  function destroy() {
    if (cleanupTap) cleanupTap();
  }

  return { init, destroy };
}

export default { createInput };
