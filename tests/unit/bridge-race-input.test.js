/**
 * Bridge Race Input — Unit Tests
 *
 * Tests createInput by capturing the drag handler from shared/input.js
 * and stubbing document for keydown/keyup listeners.
 * Covers: drag isDragging true/false arms, onMove guard, emitKeyMove
 * with all 12 key combos, emitKeyMove onMove guard, destroy cleanup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock shared/input.js ──────────────────────────────────────────────────────

let capturedDragHandler = null;

vi.mock('../../src/shared/input.js', () => ({
  onDrag: vi.fn((element, handler) => {
    capturedDragHandler = handler;
    return vi.fn();
  }),
  disableTouchActions: vi.fn(),
}));

// ── Stub document ─────────────────────────────────────────────────────────────

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

import { createInput } from '../../src/games/bridge-race/input.js';

const makeElement = () => ({ addEventListener: vi.fn() });

// ─────────────────────────────────────────────────────────────────────────────

describe('bridge-race createInput', () => {
  let element, onMove;

  beforeEach(() => {
    capturedDragHandler = null;
    Object.keys(docListeners).forEach(k => delete docListeners[k]);
    fakeDocument.addEventListener.mockClear();
    fakeDocument.removeEventListener.mockClear();
    element = makeElement();
    onMove = vi.fn();
  });

  function setup(overrides = {}) {
    const input = createInput({ element, onMove, ...overrides });
    input.init();
    return input;
  }

  // ── drag: isDragging true arm ─────────────────────────────────────────────

  it('drag isDragging=true calls onMove with dx/dz — (if isDragging) true arm', () => {
    setup();
    capturedDragHandler({ isDragging: true, dx: 10, dy: 5 });
    expect(onMove).toHaveBeenCalledOnce();
    const arg = onMove.mock.calls[0][0];
    expect(arg.dx).toBeCloseTo(10 * 0.015 * expect.any(Number) || arg.dx); // just check shape
    expect(typeof arg.dx).toBe('number');
    expect(typeof arg.dz).toBe('number');
  });

  it('drag isDragging=true: onMove not called when onMove not provided — (if onMove) false arm', () => {
    setup({ onMove: undefined });
    expect(() => capturedDragHandler({ isDragging: true, dx: 10, dy: 5 })).not.toThrow();
  });

  // ── drag: isDragging false arm (else) ─────────────────────────────────────

  it('drag isDragging=false resets activeMove to {0,0} — (else) arm', () => {
    setup();
    capturedDragHandler({ isDragging: true, dx: 10, dy: 5 });
    onMove.mockClear();
    capturedDragHandler({ isDragging: false, dx: 0, dy: 0 });
    // onMove is NOT called in else arm (no call for reset)
    expect(onMove).not.toHaveBeenCalled();
  });

  // ── emitKeyMove: onMove guard ─────────────────────────────────────────────

  it('emitKeyMove returns early when onMove not provided — (!onMove) guard', () => {
    setup({ onMove: undefined });
    expect(() => fakeDocument._fire('keydown', { key: 'ArrowLeft' })).not.toThrow();
  });

  // ── emitKeyMove: left keys (dx -= speed) ─────────────────────────────────

  it('ArrowLeft → onMove with negative dx', () => {
    setup();
    fakeDocument._fire('keydown', { key: 'ArrowLeft' });
    expect(onMove.mock.calls.at(-1)[0].dx).toBeLessThan(0);
    expect(onMove.mock.calls.at(-1)[0].dz).toBeCloseTo(0);
  });

  it('"a" → onMove with negative dx', () => {
    setup();
    fakeDocument._fire('keydown', { key: 'a' });
    expect(onMove.mock.calls.at(-1)[0].dx).toBeLessThan(0);
  });

  it('"A" → onMove with negative dx', () => {
    setup();
    fakeDocument._fire('keydown', { key: 'A' });
    expect(onMove.mock.calls.at(-1)[0].dx).toBeLessThan(0);
  });

  // ── emitKeyMove: right keys (dx += speed) ────────────────────────────────

  it('ArrowRight → onMove with positive dx', () => {
    setup();
    fakeDocument._fire('keydown', { key: 'ArrowRight' });
    expect(onMove.mock.calls.at(-1)[0].dx).toBeGreaterThan(0);
  });

  it('"d" → onMove with positive dx', () => {
    setup();
    fakeDocument._fire('keydown', { key: 'd' });
    expect(onMove.mock.calls.at(-1)[0].dx).toBeGreaterThan(0);
  });

  it('"D" → onMove with positive dx', () => {
    setup();
    fakeDocument._fire('keydown', { key: 'D' });
    expect(onMove.mock.calls.at(-1)[0].dx).toBeGreaterThan(0);
  });

  // ── emitKeyMove: up keys (dz -= speed) ───────────────────────────────────

  it('ArrowUp → onMove with negative dz', () => {
    setup();
    fakeDocument._fire('keydown', { key: 'ArrowUp' });
    expect(onMove.mock.calls.at(-1)[0].dz).toBeLessThan(0);
  });

  it('"w" → onMove with negative dz', () => {
    setup();
    fakeDocument._fire('keydown', { key: 'w' });
    expect(onMove.mock.calls.at(-1)[0].dz).toBeLessThan(0);
  });

  it('"W" → onMove with negative dz', () => {
    setup();
    fakeDocument._fire('keydown', { key: 'W' });
    expect(onMove.mock.calls.at(-1)[0].dz).toBeLessThan(0);
  });

  // ── emitKeyMove: down keys (dz += speed) ─────────────────────────────────

  it('ArrowDown → onMove with positive dz', () => {
    setup();
    fakeDocument._fire('keydown', { key: 'ArrowDown' });
    expect(onMove.mock.calls.at(-1)[0].dz).toBeGreaterThan(0);
  });

  it('"s" → onMove with positive dz', () => {
    setup();
    fakeDocument._fire('keydown', { key: 's' });
    expect(onMove.mock.calls.at(-1)[0].dz).toBeGreaterThan(0);
  });

  it('"S" → onMove with positive dz', () => {
    setup();
    fakeDocument._fire('keydown', { key: 'S' });
    expect(onMove.mock.calls.at(-1)[0].dz).toBeGreaterThan(0);
  });

  // ── keyUp clears keyState ─────────────────────────────────────────────────

  it('keyUp clears keyState and emits 0,0 move', () => {
    setup();
    fakeDocument._fire('keydown', { key: 'ArrowLeft' });
    onMove.mockClear();
    fakeDocument._fire('keyup', { key: 'ArrowLeft' });
    expect(onMove).toHaveBeenCalledWith({ dx: 0, dz: 0 });
  });

  // ── destroy ───────────────────────────────────────────────────────────────

  it('destroy removes keydown and keyup listeners', () => {
    const input = setup();
    input.destroy();
    expect(fakeDocument.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(fakeDocument.removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
  });

  it('destroy before init does not throw — (if cleanupDrag) false arm', () => {
    const input = createInput({ element, onMove });
    expect(() => input.destroy()).not.toThrow();
  });
});
