/**
 * Satisfying ASMR - Input Handler
 *
 * Continuous drag → spray clean area at pointer position.
 */

import { disableTouchActions } from '../../shared/input.js';

export function createInput({ canvas, onSpray }) {
  let active = false;
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
    active = true;
    const { x, y } = getPoint(e);
    onSpray(x, y);
  }

  function onMove(e) {
    e.preventDefault();
    if (!active) return;
    const { x, y } = getPoint(e);
    onSpray(x, y);
  }

  function onUp(_e) { active = false; }

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
