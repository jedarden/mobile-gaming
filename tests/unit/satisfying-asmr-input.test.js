/**
 * Satisfying ASMR Input — Unit Tests
 *
 * Tests createInput by stubbing shared/input.js (disableTouchActions),
 * capturing DOM listeners via a mock canvas/window, and exercising all branches.
 * Covers: getPoint touch/mouse paths, onMove active guard, onUp resets active,
 * destroy calls all cleanup functions.
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
  removeEventListener: vi.fn((ev, fn) => { if (winListeners[ev] === fn) delete winListeners[ev]; }),
};
vi.stubGlobal('window', fakeWindow);

import { createInput } from '../../src/games/satisfying-asmr/input.js';

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

// ─────────────────────────────────────────────────────────────────────────────

describe('satisfying-asmr createInput', () => {
  let canvas, onSpray;

  beforeEach(() => {
    Object.keys(winListeners).forEach(k => delete winListeners[k]);
    fakeWindow.addEventListener.mockClear();
    fakeWindow.removeEventListener.mockClear();
    canvas = makeCanvas();
    onSpray = vi.fn();
  });

  function setup() {
    const input = createInput({ canvas, onSpray });
    input.init();
    return input;
  }

  // ── getPoint: mouse path ──────────────────────────────────────────────────

  it('onDown calls onSpray using clientX/clientY — mouse path', () => {
    setup();
    canvas._fire('mousedown', { preventDefault: vi.fn(), clientX: 30, clientY: 40 });
    expect(onSpray).toHaveBeenCalledWith(30, 40);
  });

  // ── getPoint: touch path ──────────────────────────────────────────────────

  it('onDown calls onSpray using touches[0] — touch path', () => {
    setup();
    canvas._fire('touchstart', {
      preventDefault: vi.fn(),
      touches: [{ clientX: 50, clientY: 60 }],
    });
    expect(onSpray).toHaveBeenCalledWith(50, 60);
  });

  // ── onMove: active guard ──────────────────────────────────────────────────

  it('onMove returns early when active=false — (!active) guard', () => {
    setup();
    canvas._fire('mousemove', { preventDefault: vi.fn(), clientX: 10, clientY: 10 });
    expect(onSpray).not.toHaveBeenCalled();
  });

  it('onMove calls onSpray when active=true', () => {
    setup();
    canvas._fire('mousedown', { preventDefault: vi.fn(), clientX: 0, clientY: 0 }); // sets active=true
    onSpray.mockClear();
    canvas._fire('mousemove', { preventDefault: vi.fn(), clientX: 20, clientY: 25 });
    expect(onSpray).toHaveBeenCalledWith(20, 25);
  });

  // ── onUp: resets active ───────────────────────────────────────────────────

  it('mouseup resets active so subsequent move is a no-op', () => {
    setup();
    canvas._fire('mousedown', { preventDefault: vi.fn(), clientX: 0, clientY: 0 });
    winListeners['mouseup']({ clientX: 0, clientY: 0 });
    onSpray.mockClear();
    canvas._fire('mousemove', { preventDefault: vi.fn(), clientX: 10, clientY: 10 });
    expect(onSpray).not.toHaveBeenCalled();
  });

  // ── destroy ───────────────────────────────────────────────────────────────

  it('destroy removes all canvas and window listeners', () => {
    const input = setup();
    expect(() => input.destroy()).not.toThrow();
    expect(canvas.removeEventListener).toHaveBeenCalled();
    expect(fakeWindow.removeEventListener).toHaveBeenCalled();
  });
});
