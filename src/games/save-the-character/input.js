/**
 * Save the Character - Input Handler
 *
 * Input handling for choice-based gameplay:
 * - Tap/click on choices to select
 * - Hover effects for choices
 *
 * Note: With Phaser, input handling is primarily done by the Phaser scene's
 * pointer events. This module provides a thin compatibility layer for
 * wiring callbacks and state updates.
 */

import { getChoiceAtPosition } from './renderer.js';
import { isChoosing } from './state.js';

/**
 * Create input handler for Save the Character
 *
 * @param {Object} options - Configuration
 * @param {HTMLCanvasElement} options.canvas - Game canvas element (for container reference)
 * @param {Object} options.renderer - Renderer instance (must expose getChoiceAtPosition)
 * @param {Function} options.onChoiceSelect - Callback when a choice is selected: (choiceIndex)
 * @param {Function} options.onChoiceHover - Callback when pointer hovers a choice: (choiceIndex | null)
 * @returns {Object} Input controller with init() and destroy() methods
 */
export function createInput(options) {
  const { canvas, renderer, onChoiceSelect, onChoiceHover } = options;

  let currentState = null;

  /**
   * Update the current game state (needed for choice detection)
   */
  function updateState(state) {
    currentState = state;
  }

  /**
   * Initialize input listeners
   *
   * Note: With Phaser, actual input handling is done by the scene.
   * This provides a fallback for testing and legacy compatibility.
   */
  function init() {
    // Phaser handles input via scene pointer events
    // This is a no-op but kept for API consistency
  }

  /**
   * Remove all input listeners
   */
  function destroy() {
    currentState = null;
  }

  /**
   * Hit-test for a choice at a given position
   * Used by tests and for manual hit-testing
   */
  function getChoiceAt(x, y) {
    if (!currentState || !isChoosing(currentState)) return null;

    const width = renderer.width;
    const height = renderer.height;
    const scale = renderer.scale;

    return getChoiceAtPosition(x, y, currentState, width, height, scale);
  }

  return { init, destroy, updateState, getChoiceAt };
}

export default { createInput };
