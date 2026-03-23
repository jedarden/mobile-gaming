/**
 * Bus Jam Input — Unit Tests
 *
 * Tests createInput by capturing the tap handler registered with shared/input.js
 * and directly invoking the mousemove listener added to canvas.
 * Covers: onCellTap/onCellHover guards, touch vs mouse coord paths, destroy guards.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock shared/input.js ──────────────────────────────────────────────────────

let capturedTapHandler = null;

vi.mock('../../src/shared/input.js', () => ({
  onTap: vi.fn((canvas, handler) => {
    capturedTapHandler = handler;
    return vi.fn(); // cleanup fn
  }),
  disableTouchActions: vi.fn(),
}));

import { createInput } from '../../src/games/bus-jam/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCanvas = () => {
  const stored = {};
  return {
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 100, height: 100 })),
    addEventListener: vi.fn((event, handler) => { stored[event] = handler; }),
    removeEventListener: vi.fn(),
    _fire: (event, e) => stored[event] && stored[event](e),
  };
};

const makeRenderer = () => ({
  scale: 1,
  canvasToGrid: vi.fn((x, y) => ({ x: Math.floor(x / 50), y: Math.floor(y / 50) })),
});

// ─────────────────────────────────────────────────────────────────────────────

describe('bus-jam createInput', () => {
  let canvas, renderer, onCellTap, onCellHover;

  beforeEach(() => {
    capturedTapHandler = null;
    canvas = makeCanvas();
    renderer = makeRenderer();
    onCellTap = vi.fn();
    onCellHover = vi.fn();
  });

  function setup(overrides = {}) {
    const input = createInput({ canvas, renderer, onCellTap, onCellHover, ...overrides });
    input.init();
    return input;
  }

  // ── tap handler ───────────────────────────────────────────────────────────

  it('calls onCellTap with grid coordinates when tapped', () => {
    setup();
    capturedTapHandler({ x: 10, y: 20 });
    expect(onCellTap).toHaveBeenCalledWith(0, 0);
  });

  it('onCellTap not provided — tap is a no-op (if onCellTap) false arm', () => {
    setup({ onCellTap: undefined });
    expect(() => capturedTapHandler({ x: 10, y: 20 })).not.toThrow();
  });

  // ── handleMove ────────────────────────────────────────────────────────────

  it('handleMove calls onCellHover with grid coords from clientX/clientY — mouse path', () => {
    setup();
    canvas._fire('mousemove', { clientX: 10, clientY: 20 });
    expect(onCellHover).toHaveBeenCalledWith(0, 0);
    expect(renderer.canvasToGrid).toHaveBeenCalledWith(10, 20, 1);
  });

  it('handleMove calls onCellHover using touch coordinates when clientX is undefined — touch path', () => {
    setup();
    canvas._fire('mousemove', {
      clientX: undefined,
      clientY: undefined,
      touches: [{ clientX: 55, clientY: 60 }],
    });
    expect(onCellHover).toHaveBeenCalledWith(1, 1); // floor(55/50)=1, floor(60/50)=1
  });

  it('handleMove uses 0,0 when clientX is undefined and touches is null — nullish fallback', () => {
    setup();
    canvas._fire('mousemove', { clientX: undefined, clientY: undefined, touches: null });
    expect(onCellHover).toHaveBeenCalledWith(0, 0);
    expect(renderer.canvasToGrid).toHaveBeenCalledWith(0, 0, 1);
  });

  it('handleMove: onCellHover not provided — no error (if onCellHover) false arm', () => {
    setup({ onCellHover: undefined });
    expect(() => canvas._fire('mousemove', { clientX: 10, clientY: 20 })).not.toThrow();
  });

  // ── destroy ───────────────────────────────────────────────────────────────

  it('destroy after init calls both cleanup functions', () => {
    const input = setup();
    expect(() => input.destroy()).not.toThrow();
    // cleanupMove removes the mousemove listener
    expect(canvas.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
  });

  it('destroy before init is safe — (if cleanupTap/cleanupMove) false arms', () => {
    const input = createInput({ canvas, renderer, onCellTap, onCellHover });
    expect(() => input.destroy()).not.toThrow();
    expect(canvas.removeEventListener).not.toHaveBeenCalled();
  });
});
