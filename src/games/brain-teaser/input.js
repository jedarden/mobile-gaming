/**
 * Brain Teaser - Input Handler
 *
 * Game-specific input mapping for Brain Teaser puzzles.
 * With Phaser migration, input handling is done by the Phaser scene.
 * This module provides callback setup utilities.
 */

/**
 * Create input handler for Brain Teaser
 *
 * @param {Object} options - Configuration
 * @param {HTMLCanvasElement} options.canvas - Game canvas element (unused with Phaser, kept for API compat)
 * @param {Object} options.renderer - Renderer instance (must expose setCallbacks)
 * @param {Object} options.getState - Function to get current state
 * @param {Function} options.onTapAction - Callback when element is tapped: (element, action)
 * @param {Function} options.onDragStart - Callback when drag starts: (element)
 * @param {Function} options.onDragMove - Callback during drag: (element, dx, dy)
 * @param {Function} options.onDragEnd - Callback when drag ends: (sourceElement, targetElement)
 * @returns {Object} Input controller with init() and destroy() methods
 */
export function createInput(options) {
  const {
    renderer,
    onTapAction,
    onDragStart,
    onDragMove,
    onDragEnd
  } = options;

  let initialized = false;

  /**
   * Initialize input - wire callbacks to renderer
   */
  function init() {
    if (initialized) return;

    renderer.setCallbacks({
      onElementTap: (element, action) => {
        if (onTapAction) {
          onTapAction(element, action);
        }
      },
      onDragStart: (element) => {
        if (onDragStart) {
          onDragStart(element);
        }
      },
      onDragMove: (element, dx, dy) => {
        if (onDragMove) {
          onDragMove(element, dx, dy);
        }
      },
      onDragEnd: (source, target) => {
        if (onDragEnd) {
          onDragEnd(source, target);
        }
      }
    });

    initialized = true;
  }

  /**
   * Remove input listeners
   */
  function destroy() {
    if (renderer && renderer.setCallbacks) {
      renderer.setCallbacks({
        onElementTap: null,
        onDragStart: null,
        onDragMove: null,
        onDragEnd: null
      });
    }
    initialized = false;
  }

  return { init, destroy };
}

/**
 * Create sequence input handler for multi-tap sequences
 *
 * @param {Object} options - Configuration
 * @param {HTMLCanvasElement} options.canvas - Game canvas (unused with Phaser)
 * @param {Object} options.renderer - Renderer instance
 * @param {Function} options.getState - Function to get current state
 * @param {Function} options.onSequenceStep - Callback for each step: (element, currentSequence)
 * @param {Function} options.onSequenceComplete - Callback when sequence is done: (sequence)
 * @returns {Object} Input controller
 */
export function createSequenceInput(options) {
  const {
    renderer,
    getState,
    onSequenceStep,
    onSequenceComplete
  } = options;

  let initialized = false;

  function handleTap(element) {
    const state = getState();
    if (!state || !state.puzzle) return;

    if (!element || element.clickable === false) return;

    // Add to sequence
    const newSequence = [...state.currentSequence, element.id];

    if (onSequenceStep) {
      onSequenceStep(element, newSequence);
    }

    // Check if sequence matches solution length
    const solutionSteps = state.puzzle.solution.steps || [];
    if (newSequence.length === solutionSteps.length && onSequenceComplete) {
      onSequenceComplete(newSequence);
    }
  }

  /**
   * Initialize input listeners
   */
  function init() {
    if (initialized) return;

    renderer.setCallbacks({
      onElementTap: (element) => {
        handleTap(element);
      }
    });

    initialized = true;
  }

  /**
   * Remove all input listeners
   */
  function destroy() {
    if (renderer && renderer.setCallbacks) {
      renderer.setCallbacks({
        onElementTap: null
      });
    }
    initialized = false;
  }

  return { init, destroy };
}

export default { createInput, createSequenceInput };
