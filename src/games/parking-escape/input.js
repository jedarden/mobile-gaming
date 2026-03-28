/**
 * Parking Escape - Input Handler
 *
 * Simplified for Phaser migration. Input handling is now done by the Phaser scene,
 * but we keep this module for callback wiring and testing compatibility.
 */

import { disableTouchActions } from '../../shared/input.js';

/**
 * @param {Object} options
 * @param {HTMLCanvasElement} options.canvas
 * @param {Object} options.renderer
 * @param {Function} options.getState  - returns current game state
 * @param {Function} options.onMove    - (vehicleId, direction, distance) => void
 * @param {Function} options.onUndo    - () => void
 * @returns {{ init, destroy }}
 */
export function createInput({ canvas, renderer, getState, onMove, onUndo: _onUndo }) {
  let listeners = [];
  let drag = null;

  function add(el, ev, fn, opts) {
    el.addEventListener(ev, fn, opts);
    listeners.push(() => el.removeEventListener(ev, fn, opts));
  }

  function getPoint(e) {
    const touch = e.touches ? e.touches[0] : e;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width / (window.devicePixelRatio || 1)),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height / (window.devicePixelRatio || 1))
    };
  }

  function onPointerDown(e) {
    e.preventDefault();
    const { x, y } = getPoint(e);
    const state = getState();
    if (!state || state.status !== 'playing') return;

    const vehicleId = renderer.hitTestVehicle(x, y, state);
    if (!vehicleId) return;

    const vehicle = state.vehicles.find(v => v.id === vehicleId);
    drag = {
      vehicleId,
      axis: vehicle.orientation === 'horizontal' ? 'x' : 'y',
      startPx: x,
      startPy: y,
      currentDx: 0,
      currentDy: 0
    };
  }

  function onPointerMove(e) {
    e.preventDefault();
    if (!drag) return;
    const { x, y } = getPoint(e);
    drag.currentDx = drag.axis === 'x' ? x - drag.startPx : 0;
    drag.currentDy = drag.axis === 'y' ? y - drag.startPy : 0;

    // Re-render with drag offset
    const state = getState();
    if (state) {
      renderer.render(state, { vehicleId: drag.vehicleId, dx: drag.currentDx, dy: drag.currentDy });
    }
  }

  function onPointerUp(_e) {
    if (!drag) return;
    const state = getState();
    if (state) {
      const vehicle = state.vehicles.find(v => v.id === drag.vehicleId);
      if (vehicle) {
        const snap = renderer.computeSnapMove(vehicle, drag.currentDx, drag.currentDy, state);
        if (snap && snap.distance > 0) {
          onMove(drag.vehicleId, snap.direction, snap.distance);
        } else {
          renderer.render(state, null);
        }
      }
    }
    drag = null;
  }

  function init() {
    // Check if renderer has setCallbacks (Phaser mode)
    if (renderer.setCallbacks) {
      // Use Phaser scene for input handling
      renderer.setCallbacks({
        onDragStart: (_vehicleId) => {
          // Drag started
        },
        onDragMove: (vehicleId, dx, dy) => {
          // Drag move - renderer handles visual update
        },
        onDragEnd: (vehicleId, dx, dy) => {
          const state = getState();
          if (state) {
            const vehicle = state.vehicles.find(v => v.id === vehicleId);
            if (vehicle) {
              const snap = renderer.computeSnapMove(vehicle, dx, dy, state);
              if (snap && snap.distance > 0) {
                onMove(vehicleId, snap.direction, snap.distance);
              } else {
                renderer.render(state, null);
              }
            }
          }
        }
      });
    } else {
      // Fallback to canvas event listeners (for testing)
      disableTouchActions(canvas);
      add(canvas, 'mousedown', onPointerDown);
      add(canvas, 'mousemove', onPointerMove);
      add(window, 'mouseup', onPointerUp);
      add(canvas, 'touchstart', onPointerDown, { passive: false });
      add(canvas, 'touchmove', onPointerMove, { passive: false });
      add(window, 'touchend', onPointerUp);
    }
  }

  function destroy() {
    listeners.forEach(fn => fn());
    listeners = [];
  }

  return { init, destroy };
}

/**
 * Helper function for hit-testing (used in tests)
 */
export function getChoiceAt(px, py, state, layout) {
  const { col, row } = { col: Math.floor((px - layout.offsetX) / layout.cellSize), row: Math.floor((py - layout.offsetY) / layout.cellSize) };
  for (const v of state.vehicles) {
    if (v.orientation === 'horizontal') {
      if (row === v.y && col >= v.x && col < v.x + v.width) return v.id;
    } else {
      if (col === v.x && row >= v.y && row < v.y + v.height) return v.id;
    }
  }
  return null;
}

export default { createInput, getChoiceAt };
