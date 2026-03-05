/**
 * Parking Escape - Drag Input Handler
 *
 * Handles all touch and mouse interactions:
 * - Touch/click on car to start drag
 * - Car follows finger/cursor along its axis only
 * - Snaps to grid on release
 * - Visual feedback for valid/invalid positions
 * - Collision preview during drag
 */

import { 
  getCarAt, 
  getCarCells, 
  canMoveTo, 
  findCollisions,
  getValidMoveRange 
} from './state.js';

/**
 * Create drag input handler
 * @param {Object} options - Configuration options
 * @param {HTMLCanvasElement} options.canvas - Game canvas element
 * @param {Object} options.renderer - Renderer instance with canvasToGrid method
 * @param {Object} options.audio - Audio instance for feedback sounds
 * @param {Function} options.onDragStart - Callback when drag starts
 * @param {Function} options.onDragMove - Callback during drag
 * @param {Function} options.onDragEnd - Callback when drag ends
 * @param {Function} options.onTap - Callback for non-drag tap
 */
export function createDragInput(options) {
  const {
    canvas,
    renderer,
    audio,
    onDragStart,
    onDragMove,
    onDragEnd,
    onTap,
    getState
  } = options;

  // Drag state
  let isDragging = false;
  let draggedCarId = null;
  let dragStartPos = { x: 0, y: 0 };
  let dragOffset = { x: 0, y: 0 };
  let lastMoveTime = 0;
  let hapticFeedback = true;

  // Threshold for detecting drag vs tap
  const DRAG_THRESHOLD = 10; // pixels
  const SLIDE_SOUND_INTERVAL = 50; // ms

  /**
   * Get position from mouse or touch event
   */
  function getEventPosition(e) {
    const rect = canvas.getBoundingClientRect();
    
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  /**
   * Find car at canvas position
   */
  function findCarAtPosition(canvasX, canvasY) {
    const state = getState();
    if (!state) return null;

    const scale = renderer.scale;
    const gridPos = renderer.canvasToGrid(canvasX, canvasY, scale);

    // Check each car's cells
    for (const car of state.cars) {
      const cells = getCarCells(car);
      for (const cell of cells) {
        if (Math.floor(gridPos.x) === cell.x && Math.floor(gridPos.y) === cell.y) {
          return car;
        }
      }
    }

    return null;
  }

  /**
   * Calculate constrained drag position
   * Car can only move along its axis
   */
  function calculateConstrainedPosition(car, canvasX, canvasY) {
    const state = getState();
    if (!state) return null;

    const scale = renderer.scale;
    const gridPos = renderer.canvasToGrid(canvasX, canvasY, scale);
    
    // Account for drag offset (where user grabbed the car)
    let targetX, targetY;
    
    if (car.orientation === 'horizontal') {
      // Can only move horizontally, snap to car's row
      targetX = gridPos.x - dragOffset.x;
      targetY = car.y; // Lock to original row
      
      // Snap to grid
      targetX = Math.round(targetX);
      
      // Clamp to valid range
      const range = getValidMoveRange(state, car);
      const minX = car.x - range.min;
      const maxX = car.x + range.max;
      targetX = Math.max(minX, Math.min(maxX, targetX));
    } else {
      // Can only move vertically, snap to car's column
      targetX = car.x; // Lock to original column
      targetY = gridPos.y - dragOffset.y;
      
      // Snap to grid
      targetY = Math.round(targetY);
      
      // Clamp to valid range
      const range = getValidMoveRange(state, car);
      const minY = car.y - range.min;
      const maxY = car.y + range.max;
      targetY = Math.max(minY, Math.min(maxY, targetY));
    }

    return { x: targetX, y: targetY };
  }

  /**
   * Handle pointer down (mouse or touch start)
   */
  function handlePointerDown(e) {
    e.preventDefault();
    
    const state = getState();
    if (!state || state.won || state.animating) return;

    // Resume audio on first interaction
    if (audio && audio.resume) {
      audio.resume();
    }

    const pos = getEventPosition(e);
    const car = findCarAtPosition(pos.x, pos.y);

    if (car) {
      // Calculate offset within the car
      const scale = renderer.scale;
      const gridPos = renderer.canvasToGrid(pos.x, pos.y, scale);
      
      dragOffset = {
        x: gridPos.x - car.x,
        y: gridPos.y - car.y
      };

      dragStartPos = { ...pos };
      draggedCarId = car.id;
      isDragging = false; // Will become true if we move past threshold

      // Play pickup sound
      if (audio && audio.playPickup) {
        audio.playPickup();
      }

      // Haptic feedback
      if (hapticFeedback && navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  }

  /**
   * Handle pointer move
   */
  function handlePointerMove(e) {
    const state = getState();
    if (!draggedCarId || state?.won || state?.animating) return;

    const pos = getEventPosition(e);
    
    // Check if we've moved past drag threshold
    if (!isDragging) {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > DRAG_THRESHOLD) {
        isDragging = true;
        
        // Notify drag start
        if (onDragStart) {
          onDragStart(draggedCarId);
        }
      } else {
        return; // Haven't started dragging yet
      }
    }

    e.preventDefault();

    const car = state.cars.find(c => c.id === draggedCarId);
    if (!car) return;

    // Calculate new position (constrained to axis)
    const newPos = calculateConstrainedPosition(car, pos.x, pos.y);
    if (!newPos) return;

    // Check for collisions
    const collisions = findCollisions(state, car, newPos.x, newPos.y);

    // Play slide sound (throttled)
    const now = Date.now();
    if (now - lastMoveTime > SLIDE_SOUND_INTERVAL) {
      if (audio && audio.playSlide) {
        audio.playSlide();
      }
      lastMoveTime = now;
    }

    // Notify of drag move
    if (onDragMove) {
      onDragMove({
        carId: draggedCarId,
        position: newPos,
        collisions: collisions,
        isValid: collisions.length === 0
      });
    }
  }

  /**
   * Handle pointer up (mouse or touch end)
   */
  function handlePointerUp(e) {
    if (!draggedCarId) return;

    const state = getState();
    const car = state?.cars?.find(c => c.id === draggedCarId);

    if (isDragging && car) {
      // Get final position from event or use current drag position
      const pos = getEventPosition(e);
      const finalPos = calculateConstrainedPosition(car, pos.x, pos.y);

      if (finalPos) {
        // Check if position changed
        const moved = finalPos.x !== car.x || finalPos.y !== car.y;

        if (moved) {
          // Play snap sound
          if (audio && audio.playSnap) {
            audio.playSnap();
          }

          // Haptic feedback
          if (hapticFeedback && navigator.vibrate) {
            navigator.vibrate(20);
          }
        }

        // Notify drag end
        if (onDragEnd) {
          onDragEnd({
            carId: draggedCarId,
            position: finalPos,
            moved: moved
          });
        }
      }
    } else if (!isDragging && car) {
      // This was a tap, not a drag
      if (onTap) {
        onTap(car);
      }
    }

    // Reset drag state
    isDragging = false;
    draggedCarId = null;
    dragOffset = { x: 0, y: 0 };
  }

  /**
   * Handle pointer cancel
   */
  function handlePointerCancel(e) {
    if (isDragging && onDragEnd) {
      // Cancel the drag - return to original position
      onDragEnd({
        carId: draggedCarId,
        position: null,
        moved: false,
        cancelled: true
      });
    }

    isDragging = false;
    draggedCarId = null;
    dragOffset = { x: 0, y: 0 };
  }

  /**
   * Handle mouse leave
   */
  function handleMouseLeave(e) {
    if (isDragging) {
      handlePointerCancel(e);
    }
  }

  /**
   * Initialize event listeners
   */
  function init() {
    // Mouse events
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('mouseup', handlePointerUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // Touch events
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    canvas.addEventListener('touchend', handlePointerUp, { passive: false });
    canvas.addEventListener('touchcancel', handlePointerCancel, { passive: false });

    // Prevent context menu on long press
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Remove event listeners
   */
  function destroy() {
    canvas.removeEventListener('mousedown', handlePointerDown);
    canvas.removeEventListener('mousemove', handlePointerMove);
    canvas.removeEventListener('mouseup', handlePointerUp);
    canvas.removeEventListener('mouseleave', handleMouseLeave);

    canvas.removeEventListener('touchstart', handlePointerDown);
    canvas.removeEventListener('touchmove', handlePointerMove);
    canvas.removeEventListener('touchend', handlePointerUp);
    canvas.removeEventListener('touchcancel', handlePointerCancel);
  }

  /**
   * Enable/disable haptic feedback
   */
  function setHapticFeedback(enabled) {
    hapticFeedback = enabled;
  }

  /**
   * Check if currently dragging
   */
  function getIsDragging() {
    return isDragging;
  }

  /**
   * Get currently dragged car ID
   */
  function getDraggedCarId() {
    return isDragging ? draggedCarId : null;
  }

  return {
    init,
    destroy,
    setHapticFeedback,
    getIsDragging,
    getDraggedCarId
  };
}

export default {
  createDragInput
};
