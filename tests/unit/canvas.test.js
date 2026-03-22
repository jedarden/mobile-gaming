/**
 * Canvas — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests DPR-aware canvas creation, resizing, context scaling,
 * clearCanvas, and the startLoop/stopLoop lifecycle.
 *
 * requestAnimationFrame is provided by jsdom; vi.useFakeTimers()
 * lets us control when RAF callbacks fire.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createCanvas,
  resizeCanvas,
  getContext2D,
  clearCanvas,
  startLoop,
  stopLoop,
  stopAllLoops,
} from '../../src/shared/canvas.js';

// ── createCanvas ──────────────────────────────────────────────────────────────

describe('createCanvas', () => {
  it('appends a canvas element to the container', () => {
    const container = document.createElement('div');
    const canvas = createCanvas(container, 390, 844);
    expect(container.firstChild).toBe(canvas);
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('sets CSS display size to the logical dimensions', () => {
    const container = document.createElement('div');
    const canvas = createCanvas(container, 390, 844);
    expect(canvas.style.width).toBe('390px');
    expect(canvas.style.height).toBe('844px');
  });

  it('physical pixel dimensions equal logical × DPR (DPR=1 in jsdom)', () => {
    // jsdom does not set window.devicePixelRatio → getDevicePixelRatio() returns 1
    const container = document.createElement('div');
    const canvas = createCanvas(container, 200, 100);
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
  });

  it('scales physical dimensions by DPR when DPR > 1', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    const container = document.createElement('div');
    const canvas = createCanvas(container, 200, 100);
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(200);
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  });

  it('sets touchAction to none', () => {
    const container = document.createElement('div');
    const canvas = createCanvas(container, 100, 100);
    expect(canvas.style.touchAction).toBe('none');
  });

  it('returns the canvas element', () => {
    const container = document.createElement('div');
    const result = createCanvas(container, 100, 100);
    expect(result instanceof HTMLCanvasElement).toBe(true);
  });
});

// ── resizeCanvas ──────────────────────────────────────────────────────────────

describe('resizeCanvas', () => {
  it('updates CSS display size to new logical dimensions', () => {
    const canvas = document.createElement('canvas');
    resizeCanvas(canvas, 800, 600);
    expect(canvas.style.width).toBe('800px');
    expect(canvas.style.height).toBe('600px');
  });

  it('updates physical pixel size (DPR=1 in jsdom)', () => {
    const canvas = document.createElement('canvas');
    resizeCanvas(canvas, 800, 600);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it('scales physical size by DPR when DPR > 1', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    const canvas = document.createElement('canvas');
    resizeCanvas(canvas, 100, 50);
    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(150);
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  });
});

// ── getContext2D ──────────────────────────────────────────────────────────────

describe('getContext2D', () => {
  it('requests a "2d" context from the canvas', () => {
    const mockCtx = { scale: vi.fn() };
    const canvas = { getContext: vi.fn(() => mockCtx) };
    getContext2D(canvas);
    expect(canvas.getContext).toHaveBeenCalledWith('2d');
  });

  it('scales the context by DPR', () => {
    const mockCtx = { scale: vi.fn() };
    const canvas = { getContext: vi.fn(() => mockCtx) };
    // DPR = 1 in jsdom (unless changed above)
    getContext2D(canvas);
    expect(mockCtx.scale).toHaveBeenCalledWith(1, 1);
  });

  it('scales by DPR=2 when devicePixelRatio is 2', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    const mockCtx = { scale: vi.fn() };
    const canvas = { getContext: vi.fn(() => mockCtx) };
    getContext2D(canvas);
    expect(mockCtx.scale).toHaveBeenCalledWith(2, 2);
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  });

  it('returns the 2D context', () => {
    const mockCtx = { scale: vi.fn() };
    const canvas = { getContext: vi.fn(() => mockCtx) };
    const result = getContext2D(canvas);
    expect(result).toBe(mockCtx);
  });
});

// ── clearCanvas ───────────────────────────────────────────────────────────────

describe('clearCanvas', () => {
  it('calls ctx.clearRect(0, 0, width, height)', () => {
    const ctx = { clearRect: vi.fn() };
    clearCanvas(ctx, 400, 300);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 400, 300);
  });

  it('passes zero dimensions correctly', () => {
    const ctx = { clearRect: vi.fn() };
    clearCanvas(ctx, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 0, 0);
  });
});

// ── startLoop / stopLoop / stopAllLoops ───────────────────────────────────────

describe('startLoop / stopLoop / stopAllLoops', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopAllLoops();
    vi.useRealTimers();
  });

  it('startLoop returns the provided loop id', () => {
    const id = startLoop(() => {}, 'my-loop');
    expect(id).toBe('my-loop');
  });

  it('callback is called once RAF fires', () => {
    const callback = vi.fn();
    startLoop(callback, 'cb-test');
    vi.advanceTimersByTime(16); // one RAF frame (16ms)
    expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('stopLoop prevents callback from being called again', () => {
    const callback = vi.fn();
    startLoop(callback, 'stop-test');
    stopLoop('stop-test');
    const countAfterStop = callback.mock.calls.length;
    vi.runAllTimers();
    expect(callback.mock.calls.length).toBe(countAfterStop);
  });

  it('stopLoop on a non-existent id is a no-op', () => {
    expect(() => stopLoop('does-not-exist')).not.toThrow();
  });

  it('starting a new loop with the same id cancels the previous', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    startLoop(cb1, 'shared');
    const countCb1Before = cb1.mock.calls.length;
    startLoop(cb2, 'shared'); // cancels cb1's loop
    vi.advanceTimersByTime(16); // advance one RAF frame
    // cb1 should not receive more calls than it had before being replaced
    expect(cb1.mock.calls.length).toBe(countCb1Before);
    expect(cb2.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('stopAllLoops stops every active loop', () => {
    const cbA = vi.fn();
    const cbB = vi.fn();
    startLoop(cbA, 'loop-a');
    startLoop(cbB, 'loop-b');
    stopAllLoops();
    const countA = cbA.mock.calls.length;
    const countB = cbB.mock.calls.length;
    vi.runAllTimers();
    expect(cbA.mock.calls.length).toBe(countA);
    expect(cbB.mock.calls.length).toBe(countB);
  });

  it('stopAllLoops is idempotent — calling twice does not throw', () => {
    startLoop(() => {}, 'idem-test');
    stopAllLoops();
    expect(() => stopAllLoops()).not.toThrow();
  });
});
