/**
 * Merge Games Input — Unit Tests
 *
 * Tests createInput by stubbing shared/input.js (disableTouchActions),
 * capturing DOM listeners via a mock canvas, and stubbing window/document
 * for mouseup/touchend. Tests all branches of the drag state machine.
 * Covers: state/status guards, cell guard, tier guard, drag move guard,
 * onUp state guard, same-cell guard, adjacency guard, onMerge call.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock shared/input.js ──────────────────────────────────────────────────────

vi.mock('../../src/shared/input.js', () => ({
  disableTouchActions: vi.fn(),
}));

// ── Stub window and document ──────────────────────────────────────────────────

const winListeners = {};
const fakeWindow = {
  addEventListener: vi.fn((ev, fn) => { winListeners[ev] = fn; }),
  removeEventListener: vi.fn((ev, fn) => { if (winListeners[ev] === fn) delete winListeners[ev]; }),
};
vi.stubGlobal('window', fakeWindow);

import { createInput } from '../../src/games/merge-games/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCanvas() {
  const stored = {};
  return {
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0 })),
    addEventListener: vi.fn((ev, fn) => { stored[ev] = fn; }),
    removeEventListener: vi.fn(),
    _fire: (ev, e) => stored[ev] && stored[ev](e),
  };
}

const makeRenderer = (cellReturn = { r: 0, c: 0 }) => ({
  canvasToCell: vi.fn(() => cellReturn),
  render: vi.fn(),
});

const makeState = (overrides = {}) => ({
  status: 'playing',
  grid: [[1, 1], [1, 1]], // 2×2 grid with tier=1
  ...overrides,
});

const prevent = { preventDefault: vi.fn(), touches: null };

// ─────────────────────────────────────────────────────────────────────────────

describe('merge-games createInput', () => {
  let canvas, renderer, getState, onMerge;

  beforeEach(() => {
    Object.keys(winListeners).forEach(k => delete winListeners[k]);
    fakeWindow.addEventListener.mockClear();
    fakeWindow.removeEventListener.mockClear();
    canvas = makeCanvas();
    renderer = makeRenderer();
    onMerge = vi.fn();
    getState = vi.fn(() => makeState());
  });

  function setup(overrides = {}) {
    const input = createInput({ canvas, renderer, getState, onMerge, ...overrides });
    input.init();
    return input;
  }

  function mousedown(x = 10, y = 10) {
    canvas._fire('mousedown', { preventDefault: vi.fn(), clientX: x, clientY: y });
  }

  function mouseup(x = 10, y = 10) {
    if (winListeners['mouseup']) winListeners['mouseup']({ clientX: x, clientY: y, changedTouches: null });
  }

  function mousemove(x = 15, y = 15) {
    canvas._fire('mousemove', { preventDefault: vi.fn(), clientX: x, clientY: y });
  }

  // ── onDown: state guard ───────────────────────────────────────────────────

  it('onDown returns early when getState() returns null — (!state) guard', () => {
    getState.mockReturnValue(null);
    setup();
    mousedown();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('onDown returns early when status !== "playing" — (state.status !== "playing") guard', () => {
    getState.mockReturnValue(makeState({ status: 'won' }));
    setup();
    mousedown();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  // ── onDown: cell guard ────────────────────────────────────────────────────

  it('onDown returns early when canvasToCell returns null — (!cell) guard', () => {
    renderer = makeRenderer(null);
    setup();
    mousedown();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  // ── onDown: tier guard ────────────────────────────────────────────────────

  it('onDown returns early when grid cell has no tier (0/undefined) — (!tier) guard', () => {
    getState.mockReturnValue(makeState({ grid: [[0, 0], [0, 0]] }));
    setup();
    mousedown();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  // ── onDown: normal drag start ─────────────────────────────────────────────

  it('onDown sets drag and calls renderer.render when all guards pass', () => {
    setup();
    mousedown();
    expect(renderer.render).toHaveBeenCalledOnce();
  });

  // ── onMove: drag guard ────────────────────────────────────────────────────

  it('onMove returns early when no drag is active — (!drag) guard', () => {
    setup();
    mousemove();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('onMove calls renderer.render when drag is active', () => {
    setup();
    mousedown();
    renderer.render.mockClear();
    mousemove(20, 20);
    expect(renderer.render).toHaveBeenCalled();
  });

  // ── onMove: state guard ───────────────────────────────────────────────────

  it('onMove skips render when state is null — (if state) false arm', () => {
    setup();
    mousedown();
    getState.mockReturnValue(null);
    renderer.render.mockClear();
    mousemove(20, 20);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  // ── onMove: touch path ────────────────────────────────────────────────────

  it('onMove uses touches[0] when present — (e.touches ? e.touches[0] : e) true arm', () => {
    setup();
    mousedown(); // start drag
    renderer.render.mockClear();
    canvas._fire('touchmove', {
      preventDefault: vi.fn(),
      touches: [{ clientX: 20, clientY: 25 }],
    });
    expect(renderer.render).toHaveBeenCalled();
  });

  // ── onUp: drag guard ──────────────────────────────────────────────────────

  it('onUp returns early when no drag is active — (!drag) guard', () => {
    setup();
    mouseup();
    expect(onMerge).not.toHaveBeenCalled();
  });

  // ── onUp: state guard ─────────────────────────────────────────────────────

  it('onUp skips merge when state is null — (if state) false arm', () => {
    setup();
    mousedown();
    getState.mockReturnValue(null);
    mouseup(50, 50);
    expect(onMerge).not.toHaveBeenCalled();
  });

  // ── onUp: same-cell guard ─────────────────────────────────────────────────

  it('onUp skips merge when drop cell is same as origin — same-cell guard', () => {
    // canvasToCell always returns {r:0,c:0} → down and up are same cell
    setup();
    mousedown(5, 5);
    mouseup(5, 5);
    expect(onMerge).not.toHaveBeenCalled();
  });

  // ── onUp: non-adjacent cell guard ────────────────────────────────────────

  it('onUp skips merge when cells are not adjacent — (dr+dc === 1) false arm', () => {
    renderer.canvasToCell
      .mockReturnValueOnce({ r: 0, c: 0 }) // down (origin)
      .mockReturnValueOnce({ r: 1, c: 1 }); // up (diagonal: dr+dc=2)
    setup();
    mousedown();
    mouseup(50, 50);
    expect(onMerge).not.toHaveBeenCalled();
  });

  // ── onUp: adjacent merge ─────────────────────────────────────────────────

  it('onUp calls onMerge when drop is an adjacent cell — (dr+dc === 1) true arm', () => {
    renderer.canvasToCell
      .mockReturnValueOnce({ r: 0, c: 0 }) // down (origin)
      .mockReturnValueOnce({ r: 0, c: 1 }); // move preview
    // For onUp, drag.px/py = last move position; canvasToCell is called with those
    renderer.canvasToCell
      .mockReturnValueOnce({ r: 0, c: 1 }); // up target cell (adjacent)
    setup();
    mousedown(5, 5);
    mousemove(50, 5); // update drag.px to 50
    mouseup();
    expect(onMerge).toHaveBeenCalledWith(0, 0, 0, 1);
  });

  // ── destroy ───────────────────────────────────────────────────────────────

  it('destroy removes all listeners', () => {
    const input = setup();
    expect(() => input.destroy()).not.toThrow();
    // canvas.removeEventListener is called for mousedown, mousemove, touchstart, touchmove
    expect(canvas.removeEventListener).toHaveBeenCalled();
    // window.removeEventListener is called for mouseup, touchend
    expect(fakeWindow.removeEventListener).toHaveBeenCalled();
  });
});
