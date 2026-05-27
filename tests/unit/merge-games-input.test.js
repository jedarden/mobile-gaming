/**
 * Merge Games Input — Unit Tests
 *
 * Tests createInput for the Phaser-based input handling.
 * With Phaser, input is handled by the scene, so this tests the wiring
 * of callbacks through the renderer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock shared/input.js ──────────────────────────────────────────────────────

vi.mock('../../src/shared/input.js', () => ({
  disableTouchActions: vi.fn(),
}));

import { createInput } from '../../src/games/merge-games/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCanvas = () => ({ addEventListener: vi.fn() });
const makeRenderer = () => ({
  setOnMerge: vi.fn(),
});
const makeState = () => ({
  status: 'playing',
  grid: [[1, 1], [1, 1]], // 2×2 grid with tier=1
});

// ─────────────────────────────────────────────────────────────────────────────

describe('merge-games createInput', () => {
  let canvas, renderer, getState, onMerge;

  beforeEach(() => {
    canvas = makeCanvas();
    getState = vi.fn(() => makeState());
    onMerge = vi.fn();
  });

  function setup(overrides = {}) {
    renderer = makeRenderer();
    const input = createInput({ canvas, renderer, getState, onMerge, ...overrides });
    input.init();
    return input;
  }

  it('wires onMerge callback to renderer on init', () => {
    setup();
    expect(renderer.setOnMerge).toHaveBeenCalled();
    // Verify the wrapped callback checks state and calls onMerge
    const wrappedCallback = renderer.setOnMerge.mock.calls[0][0];
    expect(typeof wrappedCallback).toBe('function');
  });

  it('wrapped callback calls onMerge when state is playing', () => {
    setup();
    const wrappedCallback = renderer.setOnMerge.mock.calls[0][0];
    wrappedCallback(0, 0, 0, 1);
    expect(onMerge).toHaveBeenCalledWith(0, 0, 0, 1);
  });

  it('wrapped callback does not call onMerge when state is not playing', () => {
    getState.mockReturnValue({ status: 'won', grid: [[1, 1], [1, 1]] });
    setup();
    const wrappedCallback = renderer.setOnMerge.mock.calls[0][0];
    wrappedCallback(0, 0, 0, 1);
    expect(onMerge).not.toHaveBeenCalled();
  });

  it('wrapped callback does not call onMerge when state is null', () => {
    getState.mockReturnValue(null);
    setup();
    const wrappedCallback = renderer.setOnMerge.mock.calls[0][0];
    wrappedCallback(0, 0, 0, 1);
    expect(onMerge).not.toHaveBeenCalled();
  });

  it('does not throw when onMerge is undefined', () => {
    expect(() => setup({ onMerge: undefined })).not.toThrow();
  });

  it('destroy clears the callback from renderer', () => {
    const input = setup();
    input.destroy();
    expect(renderer.setOnMerge).toHaveBeenCalledWith(null);
  });

  it('destroy before init is safe', () => {
    renderer = makeRenderer();
    const input = createInput({ canvas, renderer, getState, onMerge });
    expect(() => input.destroy()).not.toThrow();
  });

  it('init is idempotent — calling init twice only wires once', () => {
    const input = setup();
    input.init(); // second init
    // setOnMerge should have been called once (the second init does nothing)
    expect(renderer.setOnMerge).toHaveBeenCalledTimes(1);
  });

  it('destroy allows re-init', () => {
    const input = setup();
    input.destroy();
    input.init();
    // Called once for init, once for destroy (null), once for re-init
    expect(renderer.setOnMerge).toHaveBeenCalledTimes(3);
  });
});
