/**
 * Video Overlay — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests: constants, getIntroFrameCount, getOutroFrameCount,
 * getTotalOverlayDuration, createOverlayCanvas, drawIntroFrame,
 * drawOutroFrame, drawWatermark, renderFrame.
 *
 * Canvas 2D rendering calls are exercised via a mock context.
 * Named exports + default-export constants are tested.
 */

import { describe, it, expect, vi } from 'vitest';
import videoOverlay, {
  createOverlayCanvas,
  drawIntroFrame,
  drawOutroFrame,
  drawWatermark,
  renderFrame,
  getIntroFrameCount,
  getOutroFrameCount,
  getTotalOverlayDuration,
} from '../../src/shared/video-overlay.js';

// Constants come from the default export
const { OUTPUT_WIDTH, OUTPUT_HEIGHT, INTRO_DURATION, OUTRO_DURATION, COLORS, FONTS } = videoOverlay;

// ─── Canvas context mock ──────────────────────────────────────────────────────

function makeCtxMock() {
  return {
    clearRect:         vi.fn(),
    fillRect:          vi.fn(),
    fillText:          vi.fn(),
    strokeText:        vi.fn(),
    beginPath:         vi.fn(),
    moveTo:            vi.fn(),
    lineTo:            vi.fn(),
    quadraticCurveTo:  vi.fn(),
    closePath:         vi.fn(),
    fill:              vi.fn(),
    stroke:            vi.fn(),
    drawImage:         vi.fn(),
    save:              vi.fn(),
    restore:           vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText:       vi.fn(() => ({ width: 100 })),
    // Settable properties
    fillStyle:         '',
    strokeStyle:       '',
    font:              '',
    textAlign:         '',
    textBaseline:      '',
    globalAlpha:       1,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: '',
    lineWidth:         1,
    shadowColor:       '',
    shadowBlur:        0,
    shadowOffsetX:     0,
    shadowOffsetY:     0,
  };
}

// ── Constants ─────────────────────────────────────────────────────────────

describe('constants', () => {
  it('OUTPUT_WIDTH is 1080', () => {
    expect(OUTPUT_WIDTH).toBe(1080);
  });

  it('OUTPUT_HEIGHT is 1920', () => {
    expect(OUTPUT_HEIGHT).toBe(1920);
  });

  it('INTRO_DURATION is positive', () => {
    expect(INTRO_DURATION).toBeGreaterThan(0);
  });

  it('OUTRO_DURATION is positive', () => {
    expect(OUTRO_DURATION).toBeGreaterThan(0);
  });

  it('COLORS object has expected fields', () => {
    expect(COLORS.background).toBeDefined();
    expect(COLORS.primary).toBeDefined();
    expect(COLORS.text).toBeDefined();
    expect(COLORS.accent).toBeDefined();
  });

  it('FONTS object has title and subtitle', () => {
    expect(FONTS.title).toBeDefined();
    expect(FONTS.subtitle).toBeDefined();
  });
});

// ── getIntroFrameCount ────────────────────────────────────────────────────

describe('getIntroFrameCount', () => {
  it('returns correct frame count for 30fps', () => {
    const expected = Math.ceil((INTRO_DURATION / 1000) * 30);
    expect(getIntroFrameCount(30)).toBe(expected);
  });

  it('returns correct frame count for 60fps', () => {
    const expected = Math.ceil((INTRO_DURATION / 1000) * 60);
    expect(getIntroFrameCount(60)).toBe(expected);
  });

  it('defaults to 30fps', () => {
    expect(getIntroFrameCount()).toBe(getIntroFrameCount(30));
  });

  it('returns a positive integer', () => {
    const count = getIntroFrameCount(30);
    expect(count).toBeGreaterThan(0);
    expect(Number.isInteger(count)).toBe(true);
  });
});

// ── getOutroFrameCount ────────────────────────────────────────────────────

describe('getOutroFrameCount', () => {
  it('returns correct frame count for 30fps', () => {
    const expected = Math.ceil((OUTRO_DURATION / 1000) * 30);
    expect(getOutroFrameCount(30)).toBe(expected);
  });

  it('returns more frames than intro at same fps (outro is longer)', () => {
    expect(getOutroFrameCount(30)).toBeGreaterThanOrEqual(getIntroFrameCount(30));
  });

  it('defaults to 30fps', () => {
    expect(getOutroFrameCount()).toBe(getOutroFrameCount(30));
  });
});

// ── getTotalOverlayDuration ───────────────────────────────────────────────

describe('getTotalOverlayDuration', () => {
  it('equals INTRO_DURATION + OUTRO_DURATION', () => {
    expect(getTotalOverlayDuration()).toBe(INTRO_DURATION + OUTRO_DURATION);
  });

  it('is positive', () => {
    expect(getTotalOverlayDuration()).toBeGreaterThan(0);
  });
});

// ── createOverlayCanvas ───────────────────────────────────────────────────

describe('createOverlayCanvas', () => {
  it('returns an object with a canvas element', () => {
    // In jsdom without canvas package, getContext('2d') returns null
    // createOverlayCanvas may throw trying to set ctx.imageSmoothingEnabled
    // So we mock HTMLCanvasElement.prototype.getContext
    const mockCtx = makeCtxMock();
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx);

    const result = createOverlayCanvas();
    expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(result.canvas.width).toBe(OUTPUT_WIDTH);
    expect(result.canvas.height).toBe(OUTPUT_HEIGHT);

    HTMLCanvasElement.prototype.getContext = origGetContext;
  });
});

// ── drawIntroFrame ────────────────────────────────────────────────────────

describe('drawIntroFrame', () => {
  it('does not throw with a mock context', () => {
    const ctx = makeCtxMock();
    expect(() => drawIntroFrame(ctx, { gameName: 'Test Game' })).not.toThrow();
  });

  it('calls clearRect with full output dimensions', () => {
    const ctx = makeCtxMock();
    drawIntroFrame(ctx, { gameName: 'Test Game' });
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  });

  it('draws the game name text', () => {
    const ctx = makeCtxMock();
    drawIntroFrame(ctx, { gameName: 'My Game' });
    const calls = ctx.fillText.mock.calls;
    expect(calls.some(([text]) => text === 'My Game')).toBe(true);
  });

  it('uses "Game" as fallback when gameName is empty', () => {
    const ctx = makeCtxMock();
    drawIntroFrame(ctx, {});
    const calls = ctx.fillText.mock.calls;
    expect(calls.some(([text]) => text === 'Game')).toBe(true);
  });

  it('draws dailyChallenge when provided', () => {
    const ctx = makeCtxMock();
    drawIntroFrame(ctx, { gameName: 'Test', dailyChallenge: 'Day 42' });
    const calls = ctx.fillText.mock.calls;
    expect(calls.some(([text]) => text === 'Day 42')).toBe(true);
  });

  it('accepts progress parameter (0-1) without throwing', () => {
    const ctx = makeCtxMock();
    expect(() => drawIntroFrame(ctx, { gameName: 'Test' }, 0)).not.toThrow();
    expect(() => drawIntroFrame(ctx, { gameName: 'Test' }, 0.5)).not.toThrow();
    expect(() => drawIntroFrame(ctx, { gameName: 'Test' }, 1)).not.toThrow();
  });
});

// ── drawOutroFrame ────────────────────────────────────────────────────────

describe('drawOutroFrame', () => {
  it('does not throw with a mock context', () => {
    const ctx = makeCtxMock();
    expect(() => drawOutroFrame(ctx, { gameName: 'Test', stats: { stars: 3 } })).not.toThrow();
  });

  it('calls clearRect with full output dimensions', () => {
    const ctx = makeCtxMock();
    drawOutroFrame(ctx, { gameName: 'Test', stats: {} });
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  });

  it('draws "Solved!" text', () => {
    const ctx = makeCtxMock();
    drawOutroFrame(ctx, { gameName: 'Test', stats: { stars: 2 } });
    const calls = ctx.fillText.mock.calls;
    expect(calls.some(([text]) => text === 'Solved!')).toBe(true);
  });

  it('draws moves stat when provided', () => {
    const ctx = makeCtxMock();
    drawOutroFrame(ctx, { stats: { moves: 7, stars: 1 } });
    const calls = ctx.fillText.mock.calls;
    expect(calls.some(([text]) => text === '7')).toBe(true);
  });

  it('draws formatted time when provided', () => {
    const ctx = makeCtxMock();
    drawOutroFrame(ctx, { stats: { time: 65, stars: 1 } }); // 1:05
    const calls = ctx.fillText.mock.calls;
    expect(calls.some(([text]) => text === '1:05')).toBe(true);
  });

  it('draws score when provided', () => {
    const ctx = makeCtxMock();
    drawOutroFrame(ctx, { stats: { score: 1000, stars: 2 } });
    const calls = ctx.fillText.mock.calls;
    expect(calls.some(([text]) => text === '1000')).toBe(true);
  });

  it('accepts progress parameter without throwing', () => {
    const ctx = makeCtxMock();
    expect(() => drawOutroFrame(ctx, { stats: { stars: 1 } }, 0.5)).not.toThrow();
  });
});

// ── drawWatermark ─────────────────────────────────────────────────────────

describe('drawWatermark', () => {
  it('does not throw', () => {
    const ctx = makeCtxMock();
    expect(() => drawWatermark(ctx, 'mobile-gaming.pages.dev')).not.toThrow();
  });

  it('calls save and restore', () => {
    const ctx = makeCtxMock();
    drawWatermark(ctx, 'test.dev');
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('draws the watermark text', () => {
    const ctx = makeCtxMock();
    drawWatermark(ctx, 'my-watermark');
    const calls = ctx.fillText.mock.calls;
    expect(calls.some(([text]) => text === 'my-watermark')).toBe(true);
  });

  it('uses custom x/y positions when provided', () => {
    const ctx = makeCtxMock();
    drawWatermark(ctx, 'test', 50, 100);
    const calls = ctx.fillText.mock.calls;
    expect(calls.some(([, x, y]) => x === 50 && y === 100)).toBe(true);
  });
});

// ── renderFrame ────────────────────────────────────────────────────────────

describe('renderFrame', () => {
  it('calls clearRect for all phases', () => {
    const ctx = makeCtxMock();
    renderFrame(ctx, null, { phase: 'intro', options: { gameName: 'Test' }, progress: 1 });
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  });

  it('handles "intro" phase without throwing', () => {
    const ctx = makeCtxMock();
    expect(() => renderFrame(ctx, null, { phase: 'intro', options: { gameName: 'Test' }, progress: 0.5 })).not.toThrow();
  });

  it('handles "outro" phase without throwing', () => {
    const ctx = makeCtxMock();
    expect(() => renderFrame(ctx, null, { phase: 'outro', options: { stats: { stars: 1 } }, progress: 1 })).not.toThrow();
  });

  it('handles "gameplay" phase without throwing', () => {
    const ctx = makeCtxMock();
    expect(() => renderFrame(ctx, null, { phase: 'gameplay', options: {}, progress: 1 })).not.toThrow();
  });

  it('draws watermark on gameplay phase', () => {
    const ctx = makeCtxMock();
    renderFrame(ctx, null, { phase: 'gameplay' }, 'my-watermark');
    const calls = ctx.fillText.mock.calls;
    expect(calls.some(([text]) => text === 'my-watermark')).toBe(true);
  });
});
