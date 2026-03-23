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

  it('extracts position from changedTouches when touches is empty', () => {
    const el = makeEl();
    // Simulate a touchend: touches=[], changedTouches=[{clientX:40, clientY:50}]
    const fakeEvent = {
      touches: [],
      changedTouches: [{ clientX: 40, clientY: 50 }],
    };
    const norm = normalizeEvent(el, 'up', fakeEvent);
    expect(norm.x).toBe(40);
    expect(norm.y).toBe(50);
  });

  it('extracts position from touches[0] when touches.length > 0 (active touch branch)', () => {
    const el = makeEl();
    // Simulate a touchstart/touchmove: touches has active touch points
    const fakeEvent = {
      touches: [{ clientX: 50, clientY: 60 }],
      changedTouches: [{ clientX: 99, clientY: 99 }], // should NOT be used
    };
    const norm = normalizeEvent(el, 'down', fakeEvent);
    expect(norm.x).toBe(50);
    expect(norm.y).toBe(60);
  });

  it('falls back to clientX/Y when both touches and changedTouches are empty (else branch)', () => {
    const el = makeEl();
    el.getBoundingClientRect = () => ({ left: 10, top: 20, width: 200, height: 200 });
    // touches exists but empty, changedTouches exists but empty → falls through to clientX/Y
    const fakeEvent = {
      touches: [],
      changedTouches: [],
      clientX: 70,
      clientY: 90,
    };
    const norm = normalizeEvent(el, 'move', fakeEvent);
    expect(norm.x).toBe(60); // 70 - 10
    expect(norm.y).toBe(70); // 90 - 20
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

  it('does not fire when duration is exactly 500ms (check is strictly < 500)', () => {
    const el = makeEl();
    const cb = vi.fn();
    onTap(el, cb);

    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(0);   // down time
    nowSpy.mockReturnValueOnce(500); // up time (exactly 500ms — NOT < 500)

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

  it('fires when distance equals threshold exactly (<= is inclusive)', () => {
    const el = makeEl();
    const cb = vi.fn();
    onTap(el, cb); // default threshold = 10
    mouseDown(el, 0, 0);
    mouseUp(el, 10, 0); // distance = 10, exactly at threshold
    expect(cb).toHaveBeenCalledOnce();
  });

  it('fires when duration is exactly 499ms (< 500 is exclusive of 500)', () => {
    const el = makeEl();
    const cb = vi.fn();
    onTap(el, cb);
    const nowSpy = vi.spyOn(Date, 'now');
    // Date.now is called twice per event: once in normalizeEvent, once in the handler
    nowSpy.mockReturnValueOnce(0);   // normalizeEvent during mouseDown
    nowSpy.mockReturnValueOnce(0);   // startTime = Date.now() in mouseDown handler
    nowSpy.mockReturnValueOnce(499); // normalizeEvent during mouseUp
    nowSpy.mockReturnValueOnce(499); // Date.now() for duration check in mouseUp handler
    mouseDown(el, 10, 10);
    mouseUp(el, 11, 10);
    expect(cb).toHaveBeenCalledOnce();
    nowSpy.mockRestore();
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

  it('does not fire end callback on mouseup when isDragging=false (if(isDragging) false branch)', () => {
    // mousedown → small move (below threshold → isDragging stays false) → mouseup
    const el = makeEl();
    const cb = vi.fn();
    onDrag(el, cb, 20); // threshold=20
    mouseDown(el, 0, 0); // fires initial down callback
    cb.mockClear();
    mouseMove(el, 5, 0); // 5px < 20 threshold → isDragging stays false, no move callback
    mouseUp(el, 5, 0);   // isDragging=false → if(isDragging) false branch → no callback
    expect(cb).not.toHaveBeenCalled();
  });

  it('fires on second move while already dragging (wasDragging=true branch of || condition)', () => {
    const el = makeEl();
    const cb = vi.fn();
    onDrag(el, cb, 5);
    mouseDown(el, 0, 0);
    mouseMove(el, 10, 0); // cross threshold: wasDragging=false, isDragging=true
    cb.mockClear();
    mouseMove(el, 15, 0); // continuing: wasDragging=true → short-circuits isDragging check
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].isDragging).toBe(true);
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

  it('fires for any direction when direction is null (explicit null default)', () => {
    const el = makeEl();
    const cb = vi.fn();
    onSwipe(el, cb, 30, null); // explicit null — accept all directions
    mouseDown(el, 0, 50);
    mouseUp(el, 0, 150); // downward swipe
    expect(cb).toHaveBeenCalledOnce();
  });

  it('does not fire when swipe duration exceeds timeout (duration > swipeTimeout branch)', () => {
    vi.useFakeTimers();
    const el = makeEl();
    const cb = vi.fn();
    onSwipe(el, cb, 30);
    vi.setSystemTime(0);
    mouseDown(el, 0, 50);
    vi.setSystemTime(400); // advance 400ms > 300ms swipeTimeout
    mouseUp(el, 0, 150); // 100px down — passes distance threshold
    expect(cb).not.toHaveBeenCalled();
    vi.useRealTimers();
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

  it('is safe to call twice in a row', () => {
    const el = makeEl();
    onTap(el, vi.fn());
    removeAllListeners();
    expect(() => removeAllListeners()).not.toThrow();
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

  it('sets webkit prefixed touch properties to none', () => {
    const el = makeEl();
    disableTouchActions(el);
    expect(el.style.webkitTouchCallout).toBe('none');
    expect(el.style.webkitUserSelect).toBe('none');
  });
});
