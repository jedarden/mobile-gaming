/**
 * Bus Jam - Input Handler
 *
 * Game-specific input mapping for Bus Jam.
 * Translates pointer events into grid-based actions:
 * - Tap on bus to select/deselect
 * - Tap on road cell to move selected bus
 * - Hover/move for path preview
 *
 * Uses shared/input.js for normalized pointer events.
 */

import { onTap, disableTouchActions } from '../../shared/input.js';

/**
 * Create input handler for Bus Jam
 *
 * @param {Object} options - Configuration
 * @param {HTMLCanvasElement} options.canvas - Game canvas element
 * @param {Object} options.renderer - Renderer instance (must expose canvasToGrid)
 * @param {Function} options.onCellTap - Callback when a grid cell is tapped: (gridX, gridY)
 * @param {Function} options.onCellHover - Callback when pointer moves over a cell: (gridX, gridY)
 * @returns {Object} Input controller with init() and destroy() methods
 */
export function createInput(options) {
  const { canvas, renderer, onCellTap, onCellHover } = options;

  let cleanupTap = null;
  let cleanupMove = null;

  /**
   * Convert canvas coordinates to grid position
   */
  function toGrid(canvasX, canvasY) {
    const scale = renderer.scale;
    return renderer.canvasToGrid(canvasX, canvasY, scale);
  }

  /**
   * Handle pointer move for hover/path preview
   */
  function handleMove(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    const gridPos = toGrid(canvasX, canvasY);

    if (onCellHover) {
      onCellHover(gridPos.x, gridPos.y);
    }
  }

  /**
   * Initialize input listeners
   */
  function init() {
    disableTouchActions(canvas);

    cleanupTap = onTap(canvas, ({ x, y }) => {
      const gridPos = toGrid(x, y);
      if (onCellTap) {
        onCellTap(gridPos.x, gridPos.y);
      }
    });

    canvas.addEventListener('mousemove', handleMove, { passive: true });
    cleanupMove = () => canvas.removeEventListener('mousemove', handleMove);
  }

  /**
   * Remove all input listeners
   */
  function destroy() {
    if (cleanupTap) cleanupTap();
    if (cleanupMove) cleanupMove();
  }

  return { init, destroy };
}

export default { createInput };
