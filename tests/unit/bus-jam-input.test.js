/**
 * Bus Jam Input — Unit Tests
 *
 * Tests createInput by mocking the renderer's setCallbacks method.
 * With Phaser integration, input is handled by the scene, so this module
 * provides a thin wrapper to wire up callbacks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createInput } from '../../src/games/bus-jam/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCanvas = () => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

const makeRenderer = () => ({
  setCallbacks: vi.fn(),
  canvasToGrid: vi.fn((x, y) => ({ x: Math.floor(x / 50), y: Math.floor(y / 50) })),
});

// ─────────────────────────────────────────────────────────────────────────────

describe('bus-jam createInput', () => {
  let renderer, onCellTap, onCellHover;

  beforeEach(() => {
    renderer = makeRenderer();
    onCellTap = vi.fn();
    onCellHover = vi.fn();
  });

  function setup(overrides = {}) {
    const input = createInput({
      canvas: makeCanvas(),
      renderer,
      onCellTap,
      onCellHover,
      ...overrides
    });
    input.init();
    return input;
  }

  // ── init: wiring callbacks ───────────────────────────────────────────────────

  it('init calls renderer.setCallbacks with provided callbacks', () => {
    setup();
    expect(renderer.setCallbacks).toHaveBeenCalledWith({
      onCellTap: expect.any(Function),
      onCellHover: expect.any(Function)
    });
  });

  it('init calls renderer.setCallbacks with null callbacks when not provided', () => {
    const input = createInput({
      canvas: makeCanvas(),
      renderer,
      onCellTap: null,
      onCellHover: null
    });
    input.init();
    expect(renderer.setCallbacks).toHaveBeenCalledWith({
      onCellTap: null,
      onCellHover: null
    });
  });

  // ── callback forwarding ──────────────────────────────────────────────────────

  it('wired onCellTap callback is called when invoked via renderer', () => {
    setup();
    // Get the callbacks that were passed to renderer.setCallbacks
    const setCallbacksCall = renderer.setCallbacks.mock.calls[0];
    const callbacks = setCallbacksCall[0];

    // Simulate the scene calling the onCellTap callback
    callbacks.onCellTap(2, 3);
    expect(onCellTap).toHaveBeenCalledWith(2, 3);
  });

  it('wired onCellHover callback is called when invoked via renderer', () => {
    setup();
    const setCallbacksCall = renderer.setCallbacks.mock.calls[0];
    const callbacks = setCallbacksCall[0];

    // Simulate the scene calling the onCellHover callback
    callbacks.onCellHover(1, 4);
    expect(onCellHover).toHaveBeenCalledWith(1, 4);
  });

  it('onCellTap not provided — no error when callback is null', () => {
    const input = createInput({
      canvas: makeCanvas(),
      renderer,
      onCellTap: null,
      onCellHover
    });
    input.init();

    const setCallbacksCall = renderer.setCallbacks.mock.calls[0];
    const callbacks = setCallbacksCall[0];

    expect(() => callbacks.onCellTap?.(2, 3)).not.toThrow();
  });

  it('onCellHover not provided — no error when callback is null', () => {
    const input = createInput({
      canvas: makeCanvas(),
      renderer,
      onCellTap,
      onCellHover: null
    });
    input.init();

    const setCallbacksCall = renderer.setCallbacks.mock.calls[0];
    const callbacks = setCallbacksCall[0];

    expect(() => callbacks.onCellHover?.(1, 4)).not.toThrow();
  });

  // ── init idempotence ─────────────────────────────────────────────────────────

  it('init is idempotent — calling init multiple times only wires callbacks once', () => {
    const input = setup();
    const callCount = renderer.setCallbacks.mock.calls.length;
    input.init(); // second call
    expect(renderer.setCallbacks).toHaveBeenCalledTimes(callCount);
  });

  // ── destroy ───────────────────────────────────────────────────────────────────

  it('destroy calls renderer.setCallbacks with null to clear callbacks', () => {
    const input = setup();
    input.destroy();
    expect(renderer.setCallbacks).toHaveBeenLastCalledWith({
      onCellTap: null,
      onCellHover: null
    });
  });

  it('destroy before init is safe — setCallbacks still called with null', () => {
    const input = createInput({
      canvas: makeCanvas(),
      renderer,
      onCellTap,
      onCellHover
    });
    input.destroy();
    expect(renderer.setCallbacks).toHaveBeenCalledWith({
      onCellTap: null,
      onCellHover: null
    });
  });

  it('destroy resets initialized state — init can be called again after destroy', () => {
    const input = setup();
    input.destroy();
    input.init(); // re-init after destroy
    // setup() calls init once (call 1), destroy() calls setCallbacks with null (call 2), init() again (call 3)
    expect(renderer.setCallbacks).toHaveBeenCalledTimes(3);
  });

  // ── renderer without setCallbacks ───────────────────────────────────────────

  it('init does not throw when renderer.setCallbacks is not available', () => {
    const rendererWithoutMethod = {};
    const input = createInput({
      canvas: makeCanvas(),
      renderer: rendererWithoutMethod,
      onCellTap,
      onCellHover
    });
    expect(() => input.init()).not.toThrow();
  });

  it('destroy does not throw when renderer.setCallbacks is not available', () => {
    const rendererWithoutMethod = {};
    const input = createInput({
      canvas: makeCanvas(),
      renderer: rendererWithoutMethod,
      onCellTap,
      onCellHover
    });
    input.init();
    expect(() => input.destroy()).not.toThrow();
  });
});
