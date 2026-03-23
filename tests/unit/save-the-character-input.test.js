/**
 * Save the Character Input — Unit Tests
 *
 * Tests createInput by capturing the tap handler from shared/input.js and the
 * mousemove/touchmove handler from canvas.addEventListener.
 * Covers: currentState guard, onChoiceHover/onChoiceSelect guards,
 * touch vs mouse coord path, choiceIndex null check, destroy guards.
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

import { createInput } from '../../src/games/save-the-character/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCanvas = () => {
  const stored = {};
  return {
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 300, height: 300 })),
    addEventListener: vi.fn((event, handler) => { stored[event] = handler; }),
    removeEventListener: vi.fn(),
    _fire: (event, e) => stored[event] && stored[event](e),
  };
};

const makeRenderer = (returnIndex = 0) => ({
  getChoiceAtPosition: vi.fn(() => returnIndex),
});

const fakeState = { choices: ['A', 'B'] };

// ─────────────────────────────────────────────────────────────────────────────

describe('save-the-character createInput', () => {
  let canvas, renderer, onChoiceSelect, onChoiceHover, input;

  beforeEach(() => {
    capturedTapHandler = null;
    canvas = makeCanvas();
    renderer = makeRenderer(1);
    onChoiceSelect = vi.fn();
    onChoiceHover = vi.fn();
  });

  function setup(overrides = {}) {
    input = createInput({ canvas, renderer, onChoiceSelect, onChoiceHover, ...overrides });
    input.init();
    return input;
  }

  // ── handleTap: currentState guard ─────────────────────────────────────────

  it('handleTap returns early when currentState is null — (!currentState) guard', () => {
    setup(); // currentState starts as null
    capturedTapHandler({ x: 50, y: 50 });
    expect(onChoiceSelect).not.toHaveBeenCalled();
  });

  it('handleTap calls onChoiceSelect after updateState sets currentState', () => {
    setup();
    input.updateState(fakeState);
    capturedTapHandler({ x: 50, y: 50 });
    expect(onChoiceSelect).toHaveBeenCalledWith(1);
  });

  it('handleTap skips onChoiceSelect when choiceIndex is null — (choiceIndex !== null) false arm', () => {
    renderer = makeRenderer(null);
    setup();
    input.updateState(fakeState);
    capturedTapHandler({ x: 50, y: 50 });
    expect(onChoiceSelect).not.toHaveBeenCalled();
  });

  it('handleTap skips onChoiceSelect when callback is not provided — (&& onChoiceSelect) false arm', () => {
    setup({ onChoiceSelect: undefined });
    input.updateState(fakeState);
    expect(() => capturedTapHandler({ x: 50, y: 50 })).not.toThrow();
  });

  // ── handleMove: currentState guard ────────────────────────────────────────

  it('handleMove returns early when currentState is null — (!currentState) guard', () => {
    setup();
    canvas._fire('mousemove', { clientX: 10, clientY: 10 });
    expect(onChoiceHover).not.toHaveBeenCalled();
  });

  it('handleMove calls onChoiceHover with choice index from clientX/clientY — mouse path', () => {
    setup();
    input.updateState(fakeState);
    canvas._fire('mousemove', { clientX: 50, clientY: 60 });
    expect(onChoiceHover).toHaveBeenCalledWith(1);
    expect(renderer.getChoiceAtPosition).toHaveBeenCalledWith(50, 60, fakeState);
  });

  it('handleMove uses touch coordinates when clientX is undefined — touch path', () => {
    setup();
    input.updateState(fakeState);
    canvas._fire('mousemove', {
      clientX: undefined,
      clientY: undefined,
      touches: [{ clientX: 30, clientY: 40 }],
    });
    expect(renderer.getChoiceAtPosition).toHaveBeenCalledWith(30, 40, fakeState);
  });

  it('handleMove uses 0,0 when clientX undefined and no touches — nullish fallback', () => {
    setup();
    input.updateState(fakeState);
    canvas._fire('mousemove', { clientX: undefined, clientY: undefined, touches: null });
    expect(renderer.getChoiceAtPosition).toHaveBeenCalledWith(0, 0, fakeState);
  });

  it('handleMove skips onChoiceHover when not provided — (if onChoiceHover) false arm', () => {
    setup({ onChoiceHover: undefined });
    input.updateState(fakeState);
    expect(() => canvas._fire('mousemove', { clientX: 10, clientY: 10 })).not.toThrow();
  });

  // ── updateState ───────────────────────────────────────────────────────────

  it('updateState sets currentState enabling tap/move handlers', () => {
    setup();
    input.updateState(fakeState);
    capturedTapHandler({ x: 10, y: 10 });
    expect(onChoiceSelect).toHaveBeenCalled();
  });

  // ── destroy ───────────────────────────────────────────────────────────────

  it('destroy after init calls both cleanup functions', () => {
    const i = setup();
    expect(() => i.destroy()).not.toThrow();
    expect(canvas.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(canvas.removeEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function));
  });

  it('destroy after init clears currentState', () => {
    const i = setup();
    i.updateState(fakeState);
    i.destroy();
    // After destroy, tap returns early due to currentState=null
    capturedTapHandler({ x: 10, y: 10 });
    expect(onChoiceSelect).not.toHaveBeenCalled();
  });

  it('destroy before init is safe — (if cleanupTap/cleanupMove) false arms', () => {
    const i = createInput({ canvas, renderer, onChoiceSelect, onChoiceHover });
    expect(() => i.destroy()).not.toThrow();
    expect(canvas.removeEventListener).not.toHaveBeenCalled();
  });
});
