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
  drawQRCodeAsync,
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

  it('draws difficulty badge text when difficulty is provided (if (difficulty) true branch)', () => {
    const ctx = makeCtxMock();
    drawIntroFrame(ctx, { gameName: 'Test', difficulty: 'Hard' });
    const calls = ctx.fillText.mock.calls;
    expect(calls.some(([text]) => text === 'Hard')).toBe(true);
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

  it('draws "0:00" when time is 0', () => {
    const ctx = makeCtxMock();
    drawOutroFrame(ctx, { stats: { time: 0, stars: 1 } });
    const calls = ctx.fillText.mock.calls;
    expect(calls.some(([text]) => text === '0:00')).toBe(true);
  });

  it('does not throw when stats is undefined', () => {
    const ctx = makeCtxMock();
    expect(() => drawOutroFrame(ctx, {})).not.toThrow();
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

  it('calls drawImage when gameCanvas provided (if(gameCanvas) true branch)', () => {
    const ctx = makeCtxMock();
    const gameCanvas = { width: 390, height: 844 }; // portrait — triggers ELSE branch in calculateGamePosition
    renderFrame(ctx, gameCanvas, { phase: 'gameplay' });
    expect(ctx.drawImage).toHaveBeenCalledWith(gameCanvas, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
  });

  it('positions wide game canvas correctly (gameAspect > outputAspect — IF branch in calculateGamePosition)', () => {
    // Wide landscape: 1920×1080, aspect=1.778 > output aspect (1080/1920=0.5625) → IF branch
    // Expected: drawWidth=OUTPUT_WIDTH, x=0, drawHeight=OUTPUT_WIDTH/gameAspect, y centered
    const ctx = makeCtxMock();
    const gameCanvas = { width: 1920, height: 1080 };
    renderFrame(ctx, gameCanvas, { phase: 'gameplay' });
    const [, x, y, w, h] = ctx.drawImage.mock.calls[0];
    expect(x).toBe(0); // wide game: x starts at 0
    expect(w).toBe(OUTPUT_WIDTH); // fills full output width
    expect(h).toBeCloseTo(OUTPUT_WIDTH / (1920 / 1080), 1); // height computed from aspect
    expect(y).toBeCloseTo((OUTPUT_HEIGHT - h) / 2, 1); // vertically centered
  });

  it('positions tall game canvas correctly (gameAspect ≤ outputAspect — ELSE branch in calculateGamePosition)', () => {
    // Tall portrait: 390×844, aspect≈0.462 < output aspect (0.5625) → ELSE branch
    // Expected: drawHeight=OUTPUT_HEIGHT, y=0, drawWidth=OUTPUT_HEIGHT*gameAspect, x centered
    const ctx = makeCtxMock();
    const gameCanvas = { width: 390, height: 844 };
    renderFrame(ctx, gameCanvas, { phase: 'gameplay' });
    const [, x, y, w, h] = ctx.drawImage.mock.calls[0];
    expect(y).toBe(0); // tall game: y starts at 0
    expect(h).toBe(OUTPUT_HEIGHT); // fills full output height
    expect(w).toBeCloseTo(OUTPUT_HEIGHT * (390 / 844), 1); // width computed from aspect
    expect(x).toBeCloseTo((OUTPUT_WIDTH - w) / 2, 1); // horizontally centered
  });
});

// ── drawOutroFrame — qrUrl branch ─────────────────────────────────────────

describe('drawOutroFrame — qrUrl branch', () => {
  it('draws QR placeholder when qrUrl is provided and QRCode is not yet loaded (fallback path)', () => {
    const ctx = makeCtxMock();
    // qrUrl triggers the if(qrUrl) branch; QRCode is null at startup → fallback renders "Scan"
    drawOutroFrame(ctx, { stats: { stars: 2 }, qrUrl: 'https://example.com' });
    const texts = ctx.fillText.mock.calls.map(([text]) => text);
    expect(texts).toContain('Scan');
    expect(texts).toContain('Scan to Play');
  });
});

// ── drawQRCodeAsync ───────────────────────────────────────────────────────

describe('drawQRCodeAsync', () => {
  it('resolves without throwing when qrcode-generator is available (if(QRCode) true branch)', async () => {
    const ctx = makeCtxMock();
    // loadQRCode sets the module-level QRCode; drawQRCode then takes the if(QRCode) true branch
    await expect(drawQRCodeAsync(ctx, 'https://example.com', 0, 0, 200)).resolves.toBeUndefined();
    // fillRect called for background + QR modules
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('skips loadQRCode when already loaded (if(qrCodeLoaded) early return branch)', async () => {
    // qrCodeLoaded is true after the first test above — second call hits the early return
    const ctx = makeCtxMock();
    await expect(drawQRCodeAsync(ctx, 'https://example.com/2', 10, 10, 150)).resolves.toBeUndefined();
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});

// ── renderFrame — gameplay with null gameCanvas (if(gameCanvas) false branch) ─

describe('renderFrame — gameplay phase null gameCanvas (if false branch)', () => {
  it('skips drawImage when gameCanvas is null (if(gameCanvas) false branch)', () => {
    const ctx = makeCtxMock();
    // Pass null as gameCanvas — if(gameCanvas) is false → drawImage is never called
    renderFrame(ctx, null, { phase: 'gameplay' });
    expect(ctx.drawImage).not.toHaveBeenCalled();
    // clearRect is always called
    expect(ctx.clearRect).toHaveBeenCalled();
  });
});

// ── renderFrame — gameplay with no watermark (if(watermark) false branch) ─────

describe('renderFrame — gameplay phase empty watermark (if false branch)', () => {
  it('skips drawWatermark when watermark is empty string (if(watermark) false branch)', () => {
    const ctx = makeCtxMock();
    const gameCanvas = { width: 390, height: 844 };
    // Pass empty string as watermark → if(watermark) is false → drawWatermark not called
    renderFrame(ctx, gameCanvas, { phase: 'gameplay' }, '');
    // drawImage IS called for the game canvas; fillText called for QR/outro is absent
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    // The watermark fillText ('mobile-gaming.pages.dev') is NOT in the calls
    const texts = ctx.fillText.mock.calls.map(([t]) => t);
    expect(texts).not.toContain('mobile-gaming.pages.dev');
  });
});

// ── renderFrame — unknown phase (no-op for unrecognized phase values) ──────────

describe('renderFrame — unknown phase (implicit else — all if/else-if branches false)', () => {
  it('only clears canvas when phase is not intro/gameplay/outro (unmatched phase no-op)', () => {
    const ctx = makeCtxMock();
    renderFrame(ctx, null, { phase: 'unknown-phase' });
    // clearRect is always called
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    // No phase-specific drawing occurred
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});

// ── drawQRCode — catch(e) branch when qr.make() throws ─────────────────────
// drawQRCode is private but is reachable via drawQRCodeAsync.
// To exercise the catch(e) at line 360 we need a fresh module where
// QRCode is a mock factory whose .make() throws, so the try block fails and
// falls through to the fallback placeholder renderer.

describe('drawQRCode — catch(e) branch when QRCode.make() throws', () => {
  it('logs console.warn and draws "Scan" fallback when make() throws (catch(e) arm)', async () => {
    vi.resetModules();
    // mock qrcode-generator to return a factory whose .make() throws
    vi.doMock('qrcode-generator', () => ({
      default: vi.fn(() => ({
        addData: vi.fn(),
        make: vi.fn(() => { throw new Error('mock QR make failure'); }),
        getModuleCount: vi.fn(() => 10),
        isDark: vi.fn(() => false),
      })),
    }));

    const { drawQRCodeAsync: freshDrawQRCodeAsync } = await import('../../src/shared/video-overlay.js');
    const ctx = makeCtxMock();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await freshDrawQRCodeAsync(ctx, 'https://example.com', 0, 0, 200);

    // catch(e) fired → console.warn('QR code generation failed:', e)
    expect(warnSpy).toHaveBeenCalledWith('QR code generation failed:', expect.any(Error));
    // Fallback placeholder renders "Scan" text
    expect(ctx.fillText.mock.calls.some(([t]) => t === 'Scan')).toBe(true);

    warnSpy.mockRestore();
    vi.resetModules();
  });
});
