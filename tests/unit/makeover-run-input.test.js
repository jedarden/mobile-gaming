/**
 * Makeover Run Input — Unit Tests
 *
 * Tests createInput by capturing the drag handler from shared/input.js
 * and stubbing document for keydown listeners.
 * Covers: isDragging/onSteer guards, all 6 keyboard cases, destroy cleanup.
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

let capturedKeyHandler = null;
const fakeDocument = {
  addEventListener: vi.fn((ev, fn) => { if (ev === 'keydown') capturedKeyHandler = fn; }),
  removeEventListener: vi.fn((ev, fn) => { if (ev === 'keydown' && fn === capturedKeyHandler) capturedKeyHandler = null; }),
};
vi.stubGlobal('document', fakeDocument);

import { createInput } from '../../src/games/makeover-run/input.js';

const makeElement = () => ({ addEventListener: vi.fn() });
const fireKey = (key) => { if (capturedKeyHandler) capturedKeyHandler({ key }); };

// ─────────────────────────────────────────────────────────────────────────────

describe('makeover-run createInput', () => {
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

  it('calls onSteer with scaled delta when isDragging=true', () => {
    setup();
    capturedDragHandler({ isDragging: true, dx: 100 });
    expect(onSteer).toHaveBeenCalledWith(100 * 0.008);
  });

  it('skips onSteer when isDragging=false — false arm', () => {
    setup();
    capturedDragHandler({ isDragging: false, dx: 100 });
    expect(onSteer).not.toHaveBeenCalled();
  });

  it('skips when onSteer not provided — (&& onSteer) false arm', () => {
    setup({ onSteer: undefined });
    expect(() => capturedDragHandler({ isDragging: true, dx: 100 })).not.toThrow();
  });

  it('handleKeyDown guard: returns early when onSteer not provided', () => {
    setup({ onSteer: undefined });
    expect(() => fireKey('ArrowLeft')).not.toThrow();
  });

  it('ArrowLeft → onSteer(-0.25)', () => { setup(); fireKey('ArrowLeft'); expect(onSteer).toHaveBeenCalledWith(-0.25); });
  it('"a" → onSteer(-0.25)',       () => { setup(); fireKey('a');         expect(onSteer).toHaveBeenCalledWith(-0.25); });
  it('"A" → onSteer(-0.25)',       () => { setup(); fireKey('A');         expect(onSteer).toHaveBeenCalledWith(-0.25); });
  it('ArrowRight → onSteer(0.25)', () => { setup(); fireKey('ArrowRight'); expect(onSteer).toHaveBeenCalledWith(0.25); });
  it('"d" → onSteer(0.25)',        () => { setup(); fireKey('d');          expect(onSteer).toHaveBeenCalledWith(0.25); });
  it('"D" → onSteer(0.25)',        () => { setup(); fireKey('D');          expect(onSteer).toHaveBeenCalledWith(0.25); });

  it('unrecognized key is a no-op', () => {
    setup();
    fireKey('Tab');
    expect(onSteer).not.toHaveBeenCalled();
  });

  it('destroy removes keydown listener', () => {
    const input = setup();
    input.destroy();
    expect(fakeDocument.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('destroy before init does not throw — (if cleanupDrag) false arm', () => {
    const input = createInput({ element, onSteer });
    expect(() => input.destroy()).not.toThrow();
  });
});
