/**
 * Crowd Runner Input — Unit Tests
 *
 * Tests createInput by capturing the drag handler registered with shared/input.js
 * and directly invoking the captured keydown handler.
 * Covers: isDragging/onSteer guards, all keyboard cases, destroy cleanup.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

let capturedKeyHandler = null;
let capturedKeyHandlerRef = null; // same ref used for removeEventListener

const fakeDocument = {
  addEventListener: vi.fn((ev, fn) => {
    if (ev === 'keydown') {
      capturedKeyHandler = fn;
      capturedKeyHandlerRef = fn;
    }
  }),
  removeEventListener: vi.fn((ev, fn) => {
    if (ev === 'keydown' && fn === capturedKeyHandlerRef) {
      capturedKeyHandler = null;
    }
  }),
};

vi.stubGlobal('document', fakeDocument);

import { createInput } from '../../src/games/crowd-runner/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeElement = () => ({ addEventListener: vi.fn() });

function fireKey(key) {
  if (capturedKeyHandler) capturedKeyHandler({ key });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('crowd-runner createInput', () => {
  let element, onSteer;

  beforeEach(() => {
    capturedDragHandler = null;
    capturedKeyHandler = null;
    fakeDocument.addEventListener.mockClear();
    fakeDocument.removeEventListener.mockClear();
    element = makeElement();
    onSteer = vi.fn();
  });

  function setup(overrides = {}) {
    const input = createInput({ element, onSteer, ...overrides });
    input.init();
    return input;
  }

  // ── drag handler ──────────────────────────────────────────────────────────

  it('calls onSteer with scaled dx when isDragging=true — (isDragging && onSteer) true arm', () => {
    setup();
    capturedDragHandler({ isDragging: true, dx: 100 });
    expect(onSteer).toHaveBeenCalledWith(100 * 0.008);
  });

  it('skips onSteer when isDragging=false — (isDragging && ...) false arm', () => {
    setup();
    capturedDragHandler({ isDragging: false, dx: 100 });
    expect(onSteer).not.toHaveBeenCalled();
  });

  it('skips onSteer when onSteer is not provided — (&& onSteer) false arm', () => {
    setup({ onSteer: undefined });
    expect(() => capturedDragHandler({ isDragging: true, dx: 100 })).not.toThrow();
  });

  // ── keyboard: handleKeyDown guard ─────────────────────────────────────────

  it('handleKeyDown returns early when onSteer is not provided — (!onSteer) guard', () => {
    setup({ onSteer: undefined });
    expect(() => fireKey('ArrowLeft')).not.toThrow();
  });

  // ── keyboard: ArrowLeft / a / A ───────────────────────────────────────────

  it('ArrowLeft key calls onSteer(-0.25)', () => {
    setup();
    fireKey('ArrowLeft');
    expect(onSteer).toHaveBeenCalledWith(-0.25);
  });

  it('"a" key calls onSteer(-0.25)', () => {
    setup();
    fireKey('a');
    expect(onSteer).toHaveBeenCalledWith(-0.25);
  });

  it('"A" key calls onSteer(-0.25)', () => {
    setup();
    fireKey('A');
    expect(onSteer).toHaveBeenCalledWith(-0.25);
  });

  // ── keyboard: ArrowRight / d / D ──────────────────────────────────────────

  it('ArrowRight key calls onSteer(0.25)', () => {
    setup();
    fireKey('ArrowRight');
    expect(onSteer).toHaveBeenCalledWith(0.25);
  });

  it('"d" key calls onSteer(0.25)', () => {
    setup();
    fireKey('d');
    expect(onSteer).toHaveBeenCalledWith(0.25);
  });

  it('"D" key calls onSteer(0.25)', () => {
    setup();
    fireKey('D');
    expect(onSteer).toHaveBeenCalledWith(0.25);
  });

  // ── keyboard: unrecognized key ────────────────────────────────────────────

  it('unrecognized key does not call onSteer — switch no-op', () => {
    setup();
    fireKey('Enter');
    expect(onSteer).not.toHaveBeenCalled();
  });

  // ── destroy ───────────────────────────────────────────────────────────────

  it('destroy removes keydown listener — (if cleanupDrag) true arm', () => {
    const input = setup();
    input.destroy();
    expect(fakeDocument.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    // After destroy, keydown no longer fires onSteer
    fireKey('ArrowLeft');
    expect(onSteer).not.toHaveBeenCalled();
  });

  it('destroy before init does not throw — (if cleanupDrag) false arm', () => {
    const input = createInput({ element, onSteer });
    expect(() => input.destroy()).not.toThrow();
  });
});
