/**
 * Input — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests normalizeEvent, onTap, onDrag, onSwipe,
 * removeAllListeners, and disableTouchActions.
 *
 * Uses jsdom's dispatchEvent to fire synthetic mouse events.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizeEvent,
  onTap,
  onDrag,
  onSwipe,
  removeAllListeners,
  disableTouchActions,
} from '../../src/shared/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a mock DOM element with a getBoundingClientRect that returns {left,top}=0.
 */
function makeEl() {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 });
  document.body.appendChild(el);
  return el;
}

function mouseDown(el, x, y) {
  el.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));
}
function mouseMove(el, x, y) {
  el.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
}
function mouseUp(el, x, y) {
  el.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true }));
}

// ── normalizeEvent ────────────────────────────────────────────────────────────

describe('normalizeEvent', () => {
  it('normalizes a mouse event to {type, x, y, dx, dy, timestamp, originalEvent}', () => {
    const el = makeEl();
    const raw = new MouseEvent('mousedown', { clientX: 30, clientY: 40 });
    const norm = normalizeEvent(el, 'down', raw);
    expect(norm.type).toBe('down');
    expect(norm.x).toBe(30);
    expect(norm.y).toBe(40);
    expect(norm.dx).toBe(0);
    expect(norm.dy).toBe(0);
    expect(typeof norm.timestamp).toBe('number');
    expect(norm.originalEvent).toBe(raw);
  });

  it('subtracts element bounding rect from clientX/Y', () => {
    const el = makeEl();
    el.getBoundingClientRect = () => ({ left: 50, top: 100, width: 200, height: 200 });
    const raw = new MouseEvent('mousemove', { clientX: 80, clientY: 120 });
    const norm = normalizeEvent(el, 'move', raw);
    expect(norm.x).toBe(30);  // 80 - 50
    expect(norm.y).toBe(20);  // 120 - 100
  });
});

// ── onTap ─────────────────────────────────────────────────────────────────────

describe('onTap', () => {
  it('fires callback when mouse moves < threshold', () => {
    const el = makeEl();
    const cb = vi.fn();
    onTap(el, cb);
    mouseDown(el, 10, 10);
    mouseUp(el, 12, 10); // 2px movement, < 10 threshold
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith({ x: 12, y: 10 });
  });

  it('does not fire when movement exceeds threshold', () => {
    const el = makeEl();
    const cb = vi.fn();
    onTap(el, cb);
    mouseDown(el, 10, 10);
    mouseUp(el, 30, 10); // 20px movement, > 10 threshold
    expect(cb).not.toHaveBeenCalled();
  });

  it('uses custom threshold', () => {
    const el = makeEl();
    const cb = vi.fn();
    onTap(el, cb, 20);
    mouseDown(el, 10, 10);
    mouseUp(el, 25, 10); // 15px movement, < 20 custom threshold
    expect(cb).toHaveBeenCalledOnce();
  });

  it('does not fire when duration exceeds 500ms', () => {
    const el = makeEl();
    const cb = vi.fn();
    onTap(el, cb);

    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(0);   // down time
    nowSpy.mockReturnValueOnce(600); // up time (600ms later)

    mouseDown(el, 10, 10);
    mouseUp(el, 11, 10);
    expect(cb).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('cleanup removes listener (no further fires)', () => {
    const el = makeEl();
    const cb = vi.fn();
    const cleanup = onTap(el, cb);
    cleanup();
    mouseDown(el, 10, 10);
    mouseUp(el, 10, 10);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── onDrag ────────────────────────────────────────────────────────────────────

describe('onDrag', () => {
  it('fires on mousedown with isDragging:false', () => {
    const el = makeEl();
    const cb = vi.fn();
    onDrag(el, cb);
    mouseDown(el, 10, 10);
    expect(cb).toHaveBeenCalledWith({ x: 10, y: 10, dx: 0, dy: 0, isDragging: false });
  });

  it('fires with isDragging:true once movement >= threshold', () => {
    const el = makeEl();
    const cb = vi.fn();
    onDrag(el, cb, 5);
    mouseDown(el, 0, 0);
    mouseMove(el, 10, 0); // 10px movement, >= 5 threshold
    const calls = cb.mock.calls.map(c => c[0]);
    const dragging = calls.find(c => c.isDragging === true);
    expect(dragging).toBeDefined();
  });

  it('does not fire move callbacks below threshold', () => {
    const el = makeEl();
    const cb = vi.fn();
    onDrag(el, cb, 20);
    mouseDown(el, 0, 0);
    cb.mockClear(); // clear the initial down call
    mouseMove(el, 5, 0); // 5px, below 20 threshold
    expect(cb).not.toHaveBeenCalled();
  });

  it('fires end callback with isDragging:false on mouseup', () => {
    const el = makeEl();
    const cb = vi.fn();
    onDrag(el, cb, 5);
    mouseDown(el, 0, 0);
    mouseMove(el, 10, 0); // start dragging
    mouseUp(el, 10, 0);
    const calls = cb.mock.calls.map(c => c[0]);
    const endCall = calls[calls.length - 1];
    expect(endCall.isDragging).toBe(false);
  });

  it('cleanup removes all listeners', () => {
    const el = makeEl();
    const cb = vi.fn();
    const cleanup = onDrag(el, cb, 5);
    cleanup();
    cb.mockClear();
    mouseDown(el, 0, 0);
    mouseMove(el, 20, 0);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── onSwipe ───────────────────────────────────────────────────────────────────

describe('onSwipe', () => {
  it('detects rightward swipe', () => {
    const el = makeEl();
    const cb = vi.fn();
    onSwipe(el, cb);
    mouseDown(el, 0, 50);
    mouseUp(el, 80, 50); // 80px right, > 30 threshold
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ direction: 'right' }));
  });

  it('detects leftward swipe', () => {
    const el = makeEl();
    const cb = vi.fn();
    onSwipe(el, cb);
    mouseDown(el, 100, 50);
    mouseUp(el, 20, 50); // 80px left
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ direction: 'left' }));
  });

  it('detects downward swipe', () => {
    const el = makeEl();
    const cb = vi.fn();
    onSwipe(el, cb);
    mouseDown(el, 50, 0);
    mouseUp(el, 50, 80); // 80px down
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ direction: 'down' }));
  });

  it('detects upward swipe', () => {
    const el = makeEl();
    const cb = vi.fn();
    onSwipe(el, cb);
    mouseDown(el, 50, 100);
    mouseUp(el, 50, 20); // 80px up
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ direction: 'up' }));
  });

  it('does not fire when movement < threshold', () => {
    const el = makeEl();
    const cb = vi.fn();
    onSwipe(el, cb, 30);
    mouseDown(el, 0, 0);
    mouseUp(el, 20, 0); // 20px < 30
    expect(cb).not.toHaveBeenCalled();
  });

  it('respects direction filter', () => {
    const el = makeEl();
    const cb = vi.fn();
    onSwipe(el, cb, 30, 'up');
    mouseDown(el, 0, 100);
    mouseUp(el, 80, 100); // rightward — filtered out
    expect(cb).not.toHaveBeenCalled();
  });

  it('passes direction filter when direction matches', () => {
    const el = makeEl();
    const cb = vi.fn();
    onSwipe(el, cb, 30, 'right');
    mouseDown(el, 0, 50);
    mouseUp(el, 80, 50);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('includes distance and velocity in callback payload', () => {
    const el = makeEl();
    const cb = vi.fn();
    onSwipe(el, cb);
    mouseDown(el, 0, 0);
    mouseUp(el, 60, 0);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({
      distance: expect.any(Number),
      velocity: expect.any(Number),
    }));
  });

  it('cleanup removes listener', () => {
    const el = makeEl();
    const cb = vi.fn();
    const cleanup = onSwipe(el, cb);
    cleanup();
    mouseDown(el, 0, 0);
    mouseUp(el, 100, 0);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── removeAllListeners ────────────────────────────────────────────────────────

describe('removeAllListeners', () => {
  it('clears all active listeners without throwing', () => {
    const el = makeEl();
    onTap(el, vi.fn());
    onDrag(el, vi.fn());
    expect(() => removeAllListeners()).not.toThrow();
  });

  it('listeners do not fire after removeAllListeners', () => {
    const el = makeEl();
    const cb = vi.fn();
    onTap(el, cb);
    removeAllListeners();
    mouseDown(el, 10, 10);
    mouseUp(el, 10, 10);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── disableTouchActions ───────────────────────────────────────────────────────

describe('disableTouchActions', () => {
  it('sets touchAction to none', () => {
    const el = makeEl();
    disableTouchActions(el);
    expect(el.style.touchAction).toBe('none');
  });

  it('sets userSelect to none', () => {
    const el = makeEl();
    disableTouchActions(el);
    expect(el.style.userSelect).toBe('none');
  });
});
