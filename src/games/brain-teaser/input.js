/**
 * Brain Teaser - Input Handler
 *
 * Game-specific input mapping for Brain Teaser puzzles.
 * Handles:
 * - Tap detection for click targets
 * - Drag detection for drag-and-drop
 * - Sequence tracking for multi-step puzzles
 *
 * Uses shared/input.js for normalized pointer events.
 */

import { onTap, onDrag, disableTouchActions } from '../../shared/input.js';

/**
 * Create input handler for Brain Teaser
 *
 * @param {Object} options - Configuration
 * @param {HTMLCanvasElement} options.canvas - Game canvas element
 * @param {Object} options.renderer - Renderer instance (must expose getElementAt)
 * @param {Object} options.state - Game state (must expose puzzle.elements)
 * @param {Function} options.onTap - Callback when element is tapped: (element, action)
 * @param {Function} options.onDragStart - Callback when drag starts: (element)
 * @param {Function} options.onDragMove - Callback during drag: (element, dx, dy)
 * @param {Function} options.onDragEnd - Callback when drag ends: (sourceElement, targetElement)
 * @returns {Object} Input controller with init() and destroy() methods
 */
export function createInput(options) {
  const {
    canvas,
    renderer,
    getState,
    onTapAction,
    onDragStart,
    onDragMove,
    onDragEnd
  } = options;

  let cleanupTap = null;
  let cleanupDrag = null;
  let draggedElement = null;
  let dragStartPos = null;

  /**
   * Get element at canvas position
   */
  function getElementAtPosition(canvasX, canvasY) {
    const state = getState();
    if (!state || !state.puzzle) return null;

    return renderer.getElementAt(canvasX, canvasY, state.puzzle.elements, renderer.scale);
  }

  /**
   * Handle tap gesture
   */
  function handleTap({ x, y }) {
    const element = getElementAtPosition(x, y);
    if (!element) return;

    // Check if element is interactive
    if (element.clickable === false && !element.draggable) return;

    // Build action
    const action = {
      action: 'tap',
      targetId: element.id
    };

    if (onTapAction) {
      onTapAction(element, action);
    }
  }

  /**
   * Handle drag start
   */
  function handleDragStart({ x, y }) {
    const element = getElementAtPosition(x, y);
    if (!element || !element.draggable) return;

    draggedElement = element;
    dragStartPos = { x, y };

    if (onDragStart) {
      onDragStart(element);
    }
  }

  /**
   * Handle drag move
   */
  function handleDragMove({ x, y, dx, dy, isDragging }) {
    if (!isDragging || !draggedElement) return;

    if (onDragMove) {
      onDragMove(draggedElement, dx, dy);
    }
  }

  /**
   * Handle drag end
   */
  function handleDragEnd({ x, y }) {
    if (!draggedElement) return;

    const targetElement = getElementAtPosition(x, y);
    const sourceElement = draggedElement;

    draggedElement = null;
    dragStartPos = null;

    if (onDragEnd && targetElement && targetElement.id !== sourceElement.id) {
      onDragEnd(sourceElement, targetElement);
    }
  }

  /**
   * Initialize input listeners
   */
  function init() {
    disableTouchActions(canvas);

    // Tap handler
    cleanupTap = onTap(canvas, handleTap);

    // Drag handler (for drag-type puzzles)
    cleanupDrag = onDrag(canvas, (data) => {
      if (!data.isDragging && dragStartPos) {
        // Drag ended
        handleDragEnd(data);
      } else if (data.isDragging && !draggedElement) {
        // Drag started
        handleDragStart(data);
      } else if (data.isDragging && draggedElement) {
        // Drag moving
        handleDragMove(data);
      }
    });
  }

  /**
   * Remove all input listeners
   */
  function destroy() {
    if (cleanupTap) cleanupTap();
    if (cleanupDrag) cleanupDrag();
    draggedElement = null;
    dragStartPos = null;
  }

  return { init, destroy };
}

/**
 * Create sequence input handler for multi-tap sequences
 *
 * @param {Object} options - Configuration
 * @param {HTMLCanvasElement} options.canvas - Game canvas
 * @param {Object} options.renderer - Renderer instance
 * @param {Function} options.getState - Function to get current state
 * @param {Function} options.onSequenceStep - Callback for each step: (element, currentSequence)
 * @param {Function} options.onSequenceComplete - Callback when sequence is done: (sequence)
 * @returns {Object} Input controller
 */
export function createSequenceInput(options) {
  const {
    canvas,
    renderer,
    getState,
    onSequenceStep,
    onSequenceComplete
  } = options;

  let cleanupTap = null;

  function handleTap({ x, y }) {
    const state = getState();
    if (!state || !state.puzzle) return;

    const element = renderer.getElementAt(x, y, state.puzzle.elements, renderer.scale);
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

  function init() {
    disableTouchActions(canvas);
    cleanupTap = onTap(canvas, handleTap);
  }

  function destroy() {
    if (cleanupTap) cleanupTap();
  }

  return { init, destroy };
}

export default { createInput, createSequenceInput };
