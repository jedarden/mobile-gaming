/**
 * Water Sort Input — Unit Tests
 *
 * Tests createInput for the Phaser-based input handling.
 * With Phaser, input is handled by the scene, so this tests the wiring
 * of callbacks through the renderer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock shared/input.js (still imported but not used by new input.js) ───────────

vi.mock('../../src/shared/input.js', () => ({
  onTap: vi.fn(),
  disableTouchActions: vi.fn()
}));

import { createInput } from '../../src/games/water-sort/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCanvas = () => ({ addEventListener: vi.fn() });
const makeRenderer = () => ({
  setOnTubeTap: vi.fn(),
});

// ─────────────────────────────────────────────────────────────────────────────

describe('water-sort createInput', () => {
  let canvas, renderer, onTubeTap;

  beforeEach(() => {
    canvas = makeCanvas();
    onTubeTap = vi.fn();
  });

  function setup(overrides = {}) {
    renderer = makeRenderer();
    const input = createInput({ canvas, renderer, onTubeTap, ...overrides });
    input.init();
    return input;
  }

  it('wires onTubeTap callback to renderer on init', () => {
    setup();
    expect(renderer.setOnTubeTap).toHaveBeenCalledWith(onTubeTap);
  });

  it('does not throw when onTubeTap is undefined', () => {
    expect(() => setup({ onTubeTap: undefined })).not.toThrow();
  });

  it('destroy clears the callback from renderer', () => {
    const input = setup();
    input.destroy();
    expect(renderer.setOnTubeTap).toHaveBeenCalledWith(null);
  });

  it('destroy before init is safe', () => {
    renderer = makeRenderer();
    const input = createInput({ canvas, renderer, onTubeTap });
    expect(() => input.destroy()).not.toThrow();
  });

  it('init is idempotent — calling init twice only wires once', () => {
    const input = setup();
    input.init(); // second init
    // setOnTubeTap should have been called once (the second init does nothing)
    expect(renderer.setOnTubeTap).toHaveBeenCalledTimes(1);
  });

  it('destroy allows re-init', () => {
    const input = setup();
    input.destroy();
    input.init();
    // Called once for init, once for destroy (null), once for re-init
    expect(renderer.setOnTubeTap).toHaveBeenCalledTimes(3);
  });
});
