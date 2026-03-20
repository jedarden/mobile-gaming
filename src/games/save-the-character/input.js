/**
 * Save the Character - Input Handler
 *
 * Game-specific input handling for choice-based gameplay:
 * - Tap/click on choices to select
 * - Hover effects for choices
 * - Keyboard navigation (optional)
 *
 * Uses shared/input.js for normalized pointer events.
 */

import { onTap, disableTouchActions } from '../../shared/input.js';

/**
 * Create input handler for Save the Character
 *
 * @param {Object} options - Configuration
 * @param {HTMLCanvasElement} options.canvas - Game canvas element
 * @param {Object} options.renderer - Renderer instance (must expose getChoiceAtPosition)
 * @param {Function} options.onChoiceSelect - Callback when a choice is selected: (choiceIndex)
 * @param {Function} options.onChoiceHover - Callback when pointer hovers a choice: (choiceIndex | null)
 * @returns {Object} Input controller with init() and destroy() methods
 */
export function createInput(options) {
  const { canvas, renderer, onChoiceSelect, onChoiceHover } = options;

  let cleanupTap = null;
  let cleanupMove = null;
  let currentState = null;

  /**
   * Handle pointer move for hover effects
   */
  function handleMove(e) {
    if (!currentState) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    const choiceIndex = renderer.getChoiceAtPosition(canvasX, canvasY, currentState);

    if (onChoiceHover) {
      onChoiceHover(choiceIndex);
    }
  }

  /**
   * Handle pointer tap/click
   */
  function handleTap({ x, y }) {
    if (!currentState) return;

    const choiceIndex = renderer.getChoiceAtPosition(x, y, currentState);

    if (choiceIndex !== null && onChoiceSelect) {
      onChoiceSelect(choiceIndex);
    }
  }

  /**
   * Update the current game state (needed for choice detection)
   */
  function updateState(state) {
    currentState = state;
  }

  /**
   * Initialize input listeners
   */
  function init() {
    disableTouchActions(canvas);

    cleanupTap = onTap(canvas, handleTap);

    canvas.addEventListener('mousemove', handleMove, { passive: true });
    canvas.addEventListener('touchmove', handleMove, { passive: true });
    cleanupMove = () => {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('touchmove', handleMove);
    };
  }

  /**
   * Remove all input listeners
   */
  function destroy() {
    if (cleanupTap) cleanupTap();
    if (cleanupMove) cleanupMove();
    currentState = null;
  }

  return { init, destroy, updateState };
}

export default { createInput };
