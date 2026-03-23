/**
 * Merge Games - Input Handler
 *
 * Drag a tile from one cell and drop on an adjacent cell.
 * If same tier → merge. If empty → move (not supported, only merge).
 */

import { disableTouchActions } from '../../shared/input.js';

export function createInput({ canvas, renderer, getState, onMerge }) {
  let drag = null;
  let listeners = [];

  function add(el, ev, fn, opts) {
    el.addEventListener(ev, fn, opts);
    listeners.push(() => el.removeEventListener(ev, fn, opts));
  }

  function getPoint(e) {
    const touch = e.touches ? e.touches[0] : e;
    const rect = canvas.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }

  function onDown(e) {
    e.preventDefault();
    const { x, y } = getPoint(e);
    const state = getState();
    if (!state || state.status !== 'playing') return;
    const cell = renderer.canvasToCell(x, y);
    if (!cell) return;
    const tier = state.grid[cell.r]?.[cell.c];
    if (!tier) return;
    drag = { fromR: cell.r, fromC: cell.c, tier, px: x, py: y };
    renderer.render(state, drag);
  }

  function onMove(e) {
    e.preventDefault();
    if (!drag) return;
    const { x, y } = getPoint(e);
    drag.px = x;
    drag.py = y;
    const state = getState();
    if (state) renderer.render(state, drag);
  }

  function onUp(_e) {
    if (!drag) return;
    const state = getState();
    if (state) {
      const cell = renderer.canvasToCell(drag.px, drag.py);
      if (cell && !(cell.r === drag.fromR && cell.c === drag.fromC)) {
        const dr = Math.abs(cell.r - drag.fromR);
        const dc = Math.abs(cell.c - drag.fromC);
        if (dr + dc === 1) { // adjacent
          onMerge(drag.fromR, drag.fromC, cell.r, cell.c);
        }
      }
      renderer.render(state, null);
    }
    drag = null;
  }

  function init() {
    disableTouchActions(canvas);
    add(canvas, 'mousedown', onDown);
    add(canvas, 'mousemove', onMove);
    add(window, 'mouseup', onUp);
    add(canvas, 'touchstart', onDown, { passive: false });
    add(canvas, 'touchmove', onMove, { passive: false });
    add(window, 'touchend', onUp);
  }

  function destroy() {
    listeners.forEach(fn => fn());
    listeners = [];
  }

  return { init, destroy };
}

export default { createInput };
