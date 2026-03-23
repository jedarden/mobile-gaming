/**
 * Parking Escape Input — Unit Tests
 *
 * Tests createInput by stubbing shared/input.js (disableTouchActions),
 * capturing DOM listeners via a mock canvas, and stubbing window for mouseup/touchend.
 * Covers: state/status guard, vehicleId guard, drag guard in onPointerMove/Up,
 * axis assignment, state guard in onPointerMove/Up, vehicle guard, snap guard,
 * else arm (no snap → render null), destroy.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock shared/input.js ──────────────────────────────────────────────────────

vi.mock('../../src/shared/input.js', () => ({
  disableTouchActions: vi.fn(),
}));

// ── Stub window ───────────────────────────────────────────────────────────────

const winListeners = {};
const fakeWindow = {
  addEventListener: vi.fn((ev, fn) => { winListeners[ev] = fn; }),
  removeEventListener: vi.fn(),
  devicePixelRatio: 1,
};
vi.stubGlobal('window', fakeWindow);

import { createInput } from '../../src/games/parking-escape/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCanvas() {
  const stored = {};
  return {
    width: 300, height: 300,
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 300, height: 300 })),
    addEventListener: vi.fn((ev, fn) => { stored[ev] = fn; }),
    removeEventListener: vi.fn(),
    _fire: (ev, e) => stored[ev] && stored[ev](e),
  };
}

const makeVehicle = (id = 'v1', orientation = 'horizontal') => ({ id, orientation });

const makeRenderer = ({ vehicleId = 'v1', snap = { direction: 'right', distance: 1 } } = {}) => ({
  hitTestVehicle: vi.fn(() => vehicleId),
  render: vi.fn(),
  computeSnapMove: vi.fn(() => snap),
});

const makeState = (overrides = {}) => ({
  status: 'playing',
  vehicles: [makeVehicle()],
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────

describe('parking-escape createInput', () => {
  let canvas, renderer, getState, onMove, onUndo;

  beforeEach(() => {
    Object.keys(winListeners).forEach(k => delete winListeners[k]);
    fakeWindow.addEventListener.mockClear();
    fakeWindow.removeEventListener.mockClear();
    canvas = makeCanvas();
    renderer = makeRenderer();
    onMove = vi.fn();
    onUndo = vi.fn();
    getState = vi.fn(() => makeState());
  });

  function setup(overrides = {}) {
    const input = createInput({ canvas, renderer, getState, onMove, onUndo, ...overrides });
    input.init();
    return input;
  }

  function pointerdown(x = 50, y = 50) {
    canvas._fire('mousedown', { preventDefault: vi.fn(), clientX: x, clientY: y, touches: null });
  }

  function pointermove(x = 60, y = 50) {
    canvas._fire('mousemove', { preventDefault: vi.fn(), clientX: x, clientY: y, touches: null });
  }

  function pointerup(x = 60, y = 50) {
    if (winListeners['mouseup']) winListeners['mouseup']({ clientX: x, clientY: y, touches: null });
  }

  // ── onPointerDown: state guard ────────────────────────────────────────────

  it('onPointerDown returns early when getState() is null — (!state) guard', () => {
    getState.mockReturnValue(null);
    setup();
    pointerdown();
    expect(renderer.hitTestVehicle).not.toHaveBeenCalled();
  });

  it('onPointerDown returns early when status !== "playing" — (state.status !== "playing") guard', () => {
    getState.mockReturnValue(makeState({ status: 'won' }));
    setup();
    pointerdown();
    expect(renderer.hitTestVehicle).not.toHaveBeenCalled();
  });

  // ── onPointerDown: vehicleId guard ────────────────────────────────────────

  it('onPointerDown returns early when hitTestVehicle returns null — (!vehicleId) guard', () => {
    renderer = makeRenderer({ vehicleId: null });
    setup();
    pointerdown();
    // No drag set — move/up should be no-ops
    pointermove();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  // ── onPointerDown: axis assignment ────────────────────────────────────────

  it('onPointerDown sets axis="x" for horizontal vehicle', () => {
    // vehicle orientation = 'horizontal' → axis = 'x'
    setup();
    pointerdown(50, 50);
    // Move horizontally: dx should be captured
    pointermove(70, 50);
    expect(renderer.render).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ vehicleId: 'v1', dx: expect.any(Number), dy: 0 })
    );
  });

  it('onPointerDown sets axis="y" for vertical vehicle', () => {
    getState.mockReturnValue(makeState({ vehicles: [makeVehicle('v1', 'vertical')] }));
    setup();
    pointerdown(50, 50);
    pointermove(50, 70);
    expect(renderer.render).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ vehicleId: 'v1', dx: 0, dy: expect.any(Number) })
    );
  });

  // ── onPointerMove: drag guard ─────────────────────────────────────────────

  it('onPointerMove returns early when no drag active — (!drag) guard', () => {
    setup();
    pointermove();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  // ── onPointerMove: state guard ────────────────────────────────────────────

  it('onPointerMove skips render when state is null — (if state) false arm', () => {
    setup();
    pointerdown();
    getState.mockReturnValue(null);
    renderer.render.mockClear();
    pointermove();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  // ── onPointerUp: drag guard ───────────────────────────────────────────────

  it('onPointerUp returns early when no drag active — (!drag) guard', () => {
    setup();
    pointerup();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  // ── onPointerUp: state guard ──────────────────────────────────────────────

  it('onPointerUp skips snap when state is null — (if state) false arm', () => {
    setup();
    pointerdown();
    getState.mockReturnValue(null);
    pointerup();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  // ── onPointerUp: vehicle guard ────────────────────────────────────────────

  it('onPointerUp skips snap when vehicle not found — (if vehicle) false arm', () => {
    getState.mockReturnValue(makeState({ vehicles: [] })); // no matching vehicle
    setup();
    // Use a fresh state with the vehicle for pointerdown, then switch
    getState.mockReturnValueOnce(makeState()).mockReturnValue(makeState({ vehicles: [] }));
    pointerdown();
    pointerup();
    expect(onMove).not.toHaveBeenCalled();
  });

  // ── onPointerUp: snap with distance > 0 → onMove ─────────────────────────

  it('onPointerUp calls onMove when snap.distance > 0 — (snap && snap.distance > 0) true arm', () => {
    setup();
    pointerdown();
    pointerup();
    expect(onMove).toHaveBeenCalledWith('v1', 'right', 1);
  });

  // ── onPointerUp: snap null → render(null) ────────────────────────────────

  it('onPointerUp calls renderer.render(state, null) when snap is null — else arm', () => {
    renderer = makeRenderer({ snap: null });
    setup();
    pointerdown();
    renderer.render.mockClear();
    pointerup();
    expect(onMove).not.toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledWith(expect.any(Object), null);
  });

  it('onPointerUp calls renderer.render(state, null) when snap.distance=0 — else arm', () => {
    renderer = makeRenderer({ snap: { direction: 'right', distance: 0 } });
    setup();
    pointerdown();
    renderer.render.mockClear();
    pointerup();
    expect(onMove).not.toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledWith(expect.any(Object), null);
  });

  // ── touch: getPoint uses touches[0] ──────────────────────────────────────

  it('getPoint uses touches[0] when touches present — (e.touches ? e.touches[0] : e) true arm', () => {
    setup();
    canvas._fire('touchstart', {
      preventDefault: vi.fn(),
      touches: [{ clientX: 50, clientY: 50 }],
    });
    expect(renderer.hitTestVehicle).toHaveBeenCalled();
  });

  // ── destroy ───────────────────────────────────────────────────────────────

  it('destroy removes all listeners and clears drag', () => {
    const input = setup();
    expect(() => input.destroy()).not.toThrow();
    expect(canvas.removeEventListener).toHaveBeenCalled();
    expect(fakeWindow.removeEventListener).toHaveBeenCalled();
  });
});
