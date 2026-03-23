/**
 * Pull the Pin Input — Unit Tests
 *
 * Tests createInputHandler by simulating DOM events on a mock canvas.
 * Covers: getCoords touch/mouse paths, handleUp early return / movement threshold /
 * onPinTap guard / changedTouches branch, handleClick guard, hitTestPin body/handle/miss,
 * findPinAt removed guard and match/no-match paths, destroy cleanup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInputHandler } from '../../src/games/pull-the-pin/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCanvas({ left = 0, top = 0, w = 300, h = 300 } = {}) {
  const stored = {};
  return {
    width: w,
    height: h,
    getBoundingClientRect: vi.fn(() => ({ left, top, width: w, height: h })),
    addEventListener: vi.fn((ev, fn) => {
      stored[ev] = stored[ev] || [];
      stored[ev].push(fn);
    }),
    removeEventListener: vi.fn((ev, fn) => {
      if (stored[ev]) stored[ev] = stored[ev].filter(f => f !== fn);
    }),
    _fire: (ev, e) => (stored[ev] || []).forEach(fn => fn(e)),
  };
}

const prevent = { preventDefault: vi.fn() };

// ─────────────────────────────────────────────────────────────────────────────

describe('createInputHandler', () => {
  let canvas, onPinTap, handler;

  beforeEach(() => {
    canvas = makeCanvas();
    onPinTap = vi.fn();
    handler = createInputHandler(canvas, { onPinTap });
  });

  // ── getCoords: touch path ─────────────────────────────────────────────────

  it('getCoords uses touches[0] when touches.length > 0 — (if e.touches && e.touches.length > 0) true arm', () => {
    canvas._fire('mousedown', { preventDefault: vi.fn(), touches: [{ clientX: 50, clientY: 60 }] });
    // Now fire mouseup at same position — delta is 0 so tap fires
    canvas._fire('mouseup', {
      preventDefault: vi.fn(),
      changedTouches: null,
      clientX: 50,
      clientY: 60,
    });
    expect(onPinTap).toHaveBeenCalledWith(50, 60);
  });

  // ── getCoords: mouse path ─────────────────────────────────────────────────

  it('getCoords uses clientX/clientY when touches is falsy — (else) mouse path', () => {
    canvas._fire('mousedown', { preventDefault: vi.fn(), clientX: 30, clientY: 40 });
    canvas._fire('mouseup', { preventDefault: vi.fn(), clientX: 30, clientY: 40 });
    expect(onPinTap).toHaveBeenCalledWith(30, 40);
  });

  // ── handleUp: early return when not down ─────────────────────────────────

  it('handleUp returns early when isDown is false — (!isDown) guard', () => {
    // fire mouseup without prior mousedown
    canvas._fire('mouseup', { preventDefault: vi.fn(), clientX: 10, clientY: 10 });
    expect(onPinTap).not.toHaveBeenCalled();
  });

  // ── handleUp: movement threshold ─────────────────────────────────────────

  it('handleUp skips tap when dx > 20 — (dx > 20) true arm', () => {
    canvas._fire('mousedown', { preventDefault: vi.fn(), clientX: 0, clientY: 0 });
    canvas._fire('mouseup', { preventDefault: vi.fn(), clientX: 25, clientY: 0 }); // dx=25 > 20
    expect(onPinTap).not.toHaveBeenCalled();
  });

  it('handleUp skips tap when dy > 20 — (dy > 20) true arm', () => {
    canvas._fire('mousedown', { preventDefault: vi.fn(), clientX: 0, clientY: 0 });
    canvas._fire('mouseup', { preventDefault: vi.fn(), clientX: 0, clientY: 25 }); // dy=25 > 20
    expect(onPinTap).not.toHaveBeenCalled();
  });

  it('handleUp calls onPinTap when movement is within threshold — threshold false arm', () => {
    canvas._fire('mousedown', { preventDefault: vi.fn(), clientX: 10, clientY: 10 });
    canvas._fire('mouseup', { preventDefault: vi.fn(), clientX: 15, clientY: 15 }); // dx=dy=5 ≤ 20
    expect(onPinTap).toHaveBeenCalledWith(15, 15);
  });

  it('handleUp: no error when onPinTap is not provided — (if onPinTap) false arm', () => {
    const h2 = createInputHandler(canvas, { onPinTap: undefined });
    canvas._fire('mousedown', { preventDefault: vi.fn(), clientX: 10, clientY: 10 });
    expect(() => canvas._fire('mouseup', { preventDefault: vi.fn(), clientX: 10, clientY: 10 })).not.toThrow();
  });

  // ── handleUp: changedTouches path ────────────────────────────────────────

  it('handleUp uses changedTouches[0] when e.changedTouches is truthy — ternary true arm', () => {
    canvas._fire('mousedown', { preventDefault: vi.fn(), clientX: 50, clientY: 50 });
    // Simulate touch end: changedTouches present, pass as the event arg
    const touchEndEvent = {
      preventDefault: vi.fn(),
      changedTouches: [{ clientX: 50, clientY: 50 }], // same position
    };
    // handleUp receives the event; it does: getCoords(e.changedTouches ? e.changedTouches[0] : e)
    // changedTouches[0] = { clientX:50, clientY:50 } → getCoords sees no .touches → uses clientX/clientY
    canvas._fire('mouseup', touchEndEvent);
    expect(onPinTap).toHaveBeenCalledWith(50, 50);
  });

  // ── handleClick ───────────────────────────────────────────────────────────

  it('handleClick calls onPinTap with coordinates — (if onPinTap) true arm', () => {
    canvas._fire('click', { clientX: 20, clientY: 30 });
    expect(onPinTap).toHaveBeenCalledWith(20, 30);
  });

  it('handleClick: no error when onPinTap is not provided — (if onPinTap) false arm', () => {
    const h2 = createInputHandler(canvas, { onPinTap: undefined });
    expect(() => canvas._fire('click', { clientX: 20, clientY: 30 })).not.toThrow();
  });

  // ── hitTestPin (via findPinAt) ────────────────────────────────────────────

  it('findPinAt: body hit — hitTestPin true via body rectangle', () => {
    // pin at (100, 100): body is x∈[80,120], y∈[90,110]
    const pin = { id: 'p1', removed: false, x: 100, y: 100 };
    expect(handler.findPinAt(100, 100, [pin])).toBe(pin);
  });

  it('findPinAt: handle hit — hitTestPin true via handle circle (pin.x+30, pin.y, r=10)', () => {
    const pin = { id: 'p1', removed: false, x: 100, y: 100 };
    // handle center is (130, 100); point at (130, 100) → dist=0 ≤ 10
    expect(handler.findPinAt(130, 100, [pin])).toBe(pin);
  });

  it('findPinAt: miss — hitTestPin false for both body and handle', () => {
    const pin = { id: 'p1', removed: false, x: 100, y: 100 };
    // x=200, y=200 — far from body and handle
    expect(handler.findPinAt(200, 200, [pin])).toBeNull();
  });

  it('findPinAt: skips removed pins — (!pin.removed) short-circuit', () => {
    const pin = { id: 'p1', removed: true, x: 100, y: 100 };
    expect(handler.findPinAt(100, 100, [pin])).toBeNull();
  });

  it('findPinAt returns null when pins array is empty', () => {
    expect(handler.findPinAt(100, 100, [])).toBeNull();
  });

  it('findPinAt returns first matching pin and stops', () => {
    const pin1 = { id: 'p1', removed: false, x: 100, y: 100 };
    const pin2 = { id: 'p2', removed: false, x: 100, y: 100 };
    expect(handler.findPinAt(100, 100, [pin1, pin2])).toBe(pin1);
  });

  // ── destroy ───────────────────────────────────────────────────────────────

  it('destroy removes all event listeners', () => {
    handler.destroy();
    expect(canvas.removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(canvas.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
    expect(canvas.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    expect(canvas.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(canvas.removeEventListener).toHaveBeenCalledWith('touchend', expect.any(Function));
  });
});
