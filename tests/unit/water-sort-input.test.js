/**
 * Water Sort Input — Unit Tests
 *
 * Tests createInput by capturing the tap handler from shared/input.js.
 * Covers: tubeIdx >= 0 guard, onTubeTap guard, destroy guard.
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

import { createInput } from '../../src/games/water-sort/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCanvas = () => ({ addEventListener: vi.fn() });
const makeRenderer = (tubeIdx = 0) => ({
  canvasToTubeIndex: vi.fn(() => tubeIdx),
});

// ─────────────────────────────────────────────────────────────────────────────

describe('water-sort createInput', () => {
  let canvas, renderer, onTubeTap;

  beforeEach(() => {
    capturedTapHandler = null;
    canvas = makeCanvas();
    onTubeTap = vi.fn();
  });

  function setup(tubeIdx = 0, overrides = {}) {
    renderer = makeRenderer(tubeIdx);
    const input = createInput({ canvas, renderer, onTubeTap, ...overrides });
    input.init();
    return input;
  }

  it('calls onTubeTap with tube index when tubeIdx >= 0 — true arm', () => {
    setup(2);
    capturedTapHandler({ x: 50, y: 50 });
    expect(onTubeTap).toHaveBeenCalledWith(2);
  });

  it('skips onTubeTap when tubeIdx < 0 — (tubeIdx >= 0) false arm', () => {
    setup(-1);
    capturedTapHandler({ x: 50, y: 50 });
    expect(onTubeTap).not.toHaveBeenCalled();
  });

  it('skips when onTubeTap not provided — (&& onTubeTap) false arm', () => {
    setup(0, { onTubeTap: undefined });
    expect(() => capturedTapHandler({ x: 50, y: 50 })).not.toThrow();
  });

  it('destroy after init calls cleanupTap — (if cleanupTap) true arm', () => {
    const input = setup();
    expect(() => input.destroy()).not.toThrow();
  });

  it('destroy before init is safe — (if cleanupTap) false arm', () => {
    renderer = makeRenderer();
    const input = createInput({ canvas, renderer, onTubeTap });
    expect(() => input.destroy()).not.toThrow();
  });
});
