/**
 * Jelly Shift Input — Unit Tests
 *
 * Tests createInput by capturing the drag handler from shared/input.js and
 * stubbing document for keydown/keyup listeners.
 * Covers: isDragging/onReshape guards, processKeys key combos and guard,
 * destroy cleanup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock shared/input.js ──────────────────────────────────────────────────────

let capturedDragHandler = null;

vi.mock('../../src/shared/input.js', () => ({
  onDrag: vi.fn((element, handler) => {
    capturedDragHandler = handler;
    return vi.fn(); // cleanup fn
  }),
  disableTouchActions: vi.fn(),
}));

// ── Stub document (node env has no DOM) ──────────────────────────────────────

const docListeners = {};
const fakeDocument = {
  addEventListener: vi.fn((ev, fn) => {
    docListeners[ev] = docListeners[ev] || [];
    docListeners[ev].push(fn);
  }),
  removeEventListener: vi.fn((ev, fn) => {
    if (docListeners[ev]) docListeners[ev] = docListeners[ev].filter(f => f !== fn);
  }),
  _fire: (ev, e) => (docListeners[ev] || []).forEach(fn => fn(e)),
};
vi.stubGlobal('document', fakeDocument);

import { createInput } from '../../src/games/jelly-shift/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeElement = () => ({ addEventListener: vi.fn() });

// ─────────────────────────────────────────────────────────────────────────────

describe('jelly-shift createInput', () => {
  let element, onReshape;

  beforeEach(() => {
    capturedDragHandler = null;
    // Clear docListeners between tests
    Object.keys(docListeners).forEach(k => delete docListeners[k]);
    fakeDocument.addEventListener.mockClear();
    fakeDocument.removeEventListener.mockClear();
    element = makeElement();
    onReshape = vi.fn();
  });

  function setup(overrides = {}) {
    const input = createInput({ element, onReshape, ...overrides });
    input.init();
    return input;
  }

  // ── drag handler ──────────────────────────────────────────────────────────

  it('calls onReshape with widthDelta when isDragging=true — (isDragging && onReshape) true arm', () => {
    setup();
    capturedDragHandler({ isDragging: true, dy: 100 });
    expect(onReshape).toHaveBeenCalledWith(100 * 0.015);
  });

  it('skips onReshape when isDragging=false — (isDragging && ...) false arm', () => {
    setup();
    capturedDragHandler({ isDragging: false, dy: 100 });
    expect(onReshape).not.toHaveBeenCalled();
  });

  it('skips onReshape when onReshape is not provided — (&& onReshape) false arm', () => {
    setup({ onReshape: undefined });
    expect(() => capturedDragHandler({ isDragging: true, dy: 100 })).not.toThrow();
  });

  // ── processKeys: guard ────────────────────────────────────────────────────

  it('processKeys returns early when onReshape is not provided — (!onReshape) guard', () => {
    const input = createInput({ element, onReshape: undefined });
    input.init();
    expect(() => input.processKeys(1 / 60)).not.toThrow();
  });

  // ── processKeys: ArrowUp / w / W → onReshape(-keySpeed*2) ────────────────

  it('processKeys: ArrowUp key calls onReshape with negative delta', () => {
    const input = setup();
    fakeDocument._fire('keydown', { key: 'ArrowUp' });
    input.processKeys(1 / 60);
    expect(onReshape).toHaveBeenCalledWith(expect.any(Number));
    expect(onReshape.mock.calls[0][0]).toBeLessThan(0);
  });

  it('processKeys: "w" key calls onReshape with negative delta', () => {
    const input = setup();
    fakeDocument._fire('keydown', { key: 'w' });
    input.processKeys(1 / 60);
    expect(onReshape.mock.calls[0][0]).toBeLessThan(0);
  });

  it('processKeys: "W" key calls onReshape with negative delta', () => {
    const input = setup();
    fakeDocument._fire('keydown', { key: 'W' });
    input.processKeys(1 / 60);
    expect(onReshape.mock.calls[0][0]).toBeLessThan(0);
  });

  // ── processKeys: ArrowDown / s / S → onReshape(+keySpeed*2) ─────────────

  it('processKeys: ArrowDown key calls onReshape with positive delta', () => {
    const input = setup();
    fakeDocument._fire('keydown', { key: 'ArrowDown' });
    input.processKeys(1 / 60);
    expect(onReshape.mock.calls[0][0]).toBeGreaterThan(0);
  });

  it('processKeys: "s" key calls onReshape with positive delta', () => {
    const input = setup();
    fakeDocument._fire('keydown', { key: 's' });
    input.processKeys(1 / 60);
    expect(onReshape.mock.calls[0][0]).toBeGreaterThan(0);
  });

  it('processKeys: "S" key calls onReshape with positive delta', () => {
    const input = setup();
    fakeDocument._fire('keydown', { key: 'S' });
    input.processKeys(1 / 60);
    expect(onReshape.mock.calls[0][0]).toBeGreaterThan(0);
  });

  // ── processKeys: keyUp removes from keysDown ──────────────────────────────

  it('processKeys: no call when key was released before processKeys — keyUp clears keysDown', () => {
    const input = setup();
    fakeDocument._fire('keydown', { key: 'ArrowUp' });
    fakeDocument._fire('keyup', { key: 'ArrowUp' });
    input.processKeys(1 / 60);
    expect(onReshape).not.toHaveBeenCalled();
  });

  // ── processKeys: no keys held → no call ───────────────────────────────────

  it('processKeys: no call when no keys are held', () => {
    const input = setup();
    input.processKeys(1 / 60);
    expect(onReshape).not.toHaveBeenCalled();
  });

  // ── destroy ───────────────────────────────────────────────────────────────

  it('destroy removes keydown and keyup listeners and clears keysDown', () => {
    const input = setup();
    fakeDocument._fire('keydown', { key: 'ArrowUp' }); // add to keysDown
    input.destroy();
    expect(fakeDocument.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(fakeDocument.removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
    // After destroy, processKeys should not fire onReshape (keysDown cleared)
    input.processKeys(1 / 60);
    expect(onReshape).not.toHaveBeenCalled();
  });

  it('destroy before init does not throw — (if cleanupDrag) false arm', () => {
    const input = createInput({ element, onReshape });
    expect(() => input.destroy()).not.toThrow();
  });
});
