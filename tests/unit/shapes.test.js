/**
 * Shapes — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests all exported drawing primitives from src/shared/shapes.js using
 * a lightweight mock canvas context. Tests verify:
 *   - Color handling: string vs object with .hex property
 *   - Fast paths (drawRect without radius calls fillRect)
 *   - Rounded paths (drawRect with radius uses beginPath)
 *   - Edge cases: empty/short point arrays, empty segments
 *   - All public exports are callable functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  drawCircle,
  strokeCircle,
  drawRect,
  strokeRect,
  drawTriangle,
  strokeTriangle,
  drawRoundedPoly,
  strokePoly,
  drawLine,
  drawEllipse,
  drawRegularPoly,
  drawStar,
  drawArrow,
  drawCheckmark,
  drawX,
  drawRoundedRect,
  drawCircleWithHighlight,
  drawTube,
} from '../../src/shared/shapes.js';

// ── Mock canvas context factory ───────────────────────────────────────────────

function makeCtx() {
  return {
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    ellipse: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────

describe('exports', () => {
  const fns = [
    drawCircle, strokeCircle, drawRect, strokeRect,
    drawTriangle, strokeTriangle, drawRoundedPoly, strokePoly,
    drawLine, drawEllipse, drawRegularPoly, drawStar,
    drawArrow, drawCheckmark, drawX, drawRoundedRect,
    drawCircleWithHighlight, drawTube,
  ];

  it('all drawing functions are exported', () => {
    for (const fn of fns) {
      expect(typeof fn).toBe('function');
    }
  });
});

// ── Color handling ────────────────────────────────────────────────────────────

describe('color handling', () => {
  it('drawCircle sets fillStyle from string color', () => {
    const ctx = makeCtx();
    drawCircle(ctx, 10, 10, 5, '#ff0000');
    expect(ctx.fillStyle).toBe('#ff0000');
  });

  it('drawCircle sets fillStyle from object with .hex', () => {
    const ctx = makeCtx();
    drawCircle(ctx, 10, 10, 5, { hex: '#00ff00' });
    expect(ctx.fillStyle).toBe('#00ff00');
  });

  it('strokeCircle sets strokeStyle from string color', () => {
    const ctx = makeCtx();
    strokeCircle(ctx, 10, 10, 5, 'blue');
    expect(ctx.strokeStyle).toBe('blue');
  });

  it('strokeCircle sets strokeStyle from object with .hex', () => {
    const ctx = makeCtx();
    strokeCircle(ctx, 10, 10, 5, { hex: '#0000ff' });
    expect(ctx.strokeStyle).toBe('#0000ff');
  });

  it('strokeCircle sets lineWidth', () => {
    const ctx = makeCtx();
    strokeCircle(ctx, 10, 10, 5, 'red', 4);
    expect(ctx.lineWidth).toBe(4);
  });
});

// ── drawCircle ────────────────────────────────────────────────────────────────

describe('drawCircle', () => {
  it('calls beginPath, arc, fill', () => {
    const ctx = makeCtx();
    drawCircle(ctx, 50, 60, 20, '#fff');
    expect(ctx.beginPath).toHaveBeenCalledOnce();
    expect(ctx.arc).toHaveBeenCalledWith(50, 60, 20, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalledOnce();
  });
});

// ── strokeCircle ──────────────────────────────────────────────────────────────

describe('strokeCircle', () => {
  it('calls beginPath, arc, stroke', () => {
    const ctx = makeCtx();
    strokeCircle(ctx, 50, 60, 20, '#fff');
    expect(ctx.beginPath).toHaveBeenCalledOnce();
    expect(ctx.arc).toHaveBeenCalledWith(50, 60, 20, 0, Math.PI * 2);
    expect(ctx.stroke).toHaveBeenCalledOnce();
  });

  it('defaults lineWidth to 2', () => {
    const ctx = makeCtx();
    strokeCircle(ctx, 0, 0, 10, 'black');
    expect(ctx.lineWidth).toBe(2);
  });
});

// ── drawRect ──────────────────────────────────────────────────────────────────

describe('drawRect', () => {
  it('calls fillRect directly when borderRadius <= 0', () => {
    const ctx = makeCtx();
    drawRect(ctx, 0, 0, 100, 50, 'red');
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 50);
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it('uses rounded path when borderRadius > 0', () => {
    const ctx = makeCtx();
    drawRect(ctx, 0, 0, 100, 50, 'red', 8);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('sets fillStyle', () => {
    const ctx = makeCtx();
    drawRect(ctx, 0, 0, 10, 10, '#123456');
    expect(ctx.fillStyle).toBe('#123456');
  });
});

// ── strokeRect ────────────────────────────────────────────────────────────────

describe('strokeRect', () => {
  it('calls ctx.strokeRect directly when borderRadius <= 0', () => {
    const ctx = makeCtx();
    strokeRect(ctx, 0, 0, 100, 50, 'blue');
    expect(ctx.strokeRect).toHaveBeenCalledWith(0, 0, 100, 50);
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it('uses rounded path when borderRadius > 0', () => {
    const ctx = makeCtx();
    strokeRect(ctx, 0, 0, 100, 50, 'blue', 10);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

// ── drawTriangle ──────────────────────────────────────────────────────────────

describe('drawTriangle', () => {
  it('calls beginPath, moveTo, lineTo (×2), closePath, fill', () => {
    const ctx = makeCtx();
    drawTriangle(ctx, 50, 50, 20, 'green');
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
  });
});

// ── strokeTriangle ────────────────────────────────────────────────────────────

describe('strokeTriangle', () => {
  it('calls beginPath and stroke', () => {
    const ctx = makeCtx();
    strokeTriangle(ctx, 50, 50, 20, 'purple');
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

// ── drawRoundedPoly ───────────────────────────────────────────────────────────

describe('drawRoundedPoly', () => {
  it('returns early with < 2 points (no draw calls)', () => {
    const ctx = makeCtx();
    drawRoundedPoly(ctx, [{ x: 0, y: 0 }], 5, 'red');
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it('draws a line for exactly 2 points', () => {
    const ctx = makeCtx();
    drawRoundedPoly(ctx, [{ x: 0, y: 0 }, { x: 10, y: 10 }], 5, 'red');
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(10, 10);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('draws a polygon for >= 3 points', () => {
    const ctx = makeCtx();
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    drawRoundedPoly(ctx, points, 2, 'blue');
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

// ── strokePoly ────────────────────────────────────────────────────────────────

describe('strokePoly', () => {
  it('returns early with < 2 points', () => {
    const ctx = makeCtx();
    strokePoly(ctx, [{ x: 0, y: 0 }], 'red');
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it('draws with closePath when closed=true (default)', () => {
    const ctx = makeCtx();
    strokePoly(ctx, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }], 'red');
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('draws without closePath when closed=false', () => {
    const ctx = makeCtx();
    strokePoly(ctx, [{ x: 0, y: 0 }, { x: 10, y: 0 }], 'red', false);
    expect(ctx.closePath).not.toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

// ── drawLine ──────────────────────────────────────────────────────────────────

describe('drawLine', () => {
  it('calls beginPath, moveTo, lineTo, stroke', () => {
    const ctx = makeCtx();
    drawLine(ctx, 0, 0, 100, 100, 'black');
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 100);
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

// ── drawEllipse ───────────────────────────────────────────────────────────────

describe('drawEllipse', () => {
  it('calls beginPath, ellipse, fill', () => {
    const ctx = makeCtx();
    drawEllipse(ctx, 50, 50, 30, 20, 'orange');
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.ellipse).toHaveBeenCalledWith(50, 50, 30, 20, 0, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalled();
  });
});

// ── drawRegularPoly ───────────────────────────────────────────────────────────

describe('drawRegularPoly', () => {
  it('calls beginPath, moveTo, lineTo × (sides-1), closePath, fill', () => {
    const ctx = makeCtx();
    drawRegularPoly(ctx, 50, 50, 30, 6, 'yellow');
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalledTimes(5); // sides-1 lineTo calls
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

// ── drawStar ──────────────────────────────────────────────────────────────────

describe('drawStar', () => {
  it('calls beginPath and fill', () => {
    const ctx = makeCtx();
    drawStar(ctx, 50, 50, 30, 15, 5, 'gold');
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('draws points*2 segments', () => {
    const ctx = makeCtx();
    drawStar(ctx, 0, 0, 20, 10, 4, 'red'); // 4-point star → 8 segments
    // 1 moveTo + 7 lineTo = 8 total segments
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(7);
  });
});

// ── drawArrow ─────────────────────────────────────────────────────────────────

describe('drawArrow', () => {
  it('calls stroke at least twice (shaft + head)', () => {
    const ctx = makeCtx();
    drawArrow(ctx, 0, 0, 100, 0, 'black');
    expect(ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

// ── drawCheckmark ─────────────────────────────────────────────────────────────

describe('drawCheckmark', () => {
  it('calls beginPath, moveTo, lineTo × 2, stroke', () => {
    const ctx = makeCtx();
    drawCheckmark(ctx, 50, 50, 20, 'green');
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('sets lineCap to round then resets to butt', () => {
    const ctx = makeCtx();
    drawCheckmark(ctx, 50, 50, 20, 'green');
    expect(ctx.lineCap).toBe('butt');
  });
});

// ── drawX ─────────────────────────────────────────────────────────────────────

describe('drawX', () => {
  it('calls beginPath and stroke', () => {
    const ctx = makeCtx();
    drawX(ctx, 50, 50, 20, 'red');
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('resets lineCap to butt after drawing', () => {
    const ctx = makeCtx();
    drawX(ctx, 50, 50, 20, 'red');
    expect(ctx.lineCap).toBe('butt');
  });
});

// ── drawRoundedRect ───────────────────────────────────────────────────────────

describe('drawRoundedRect', () => {
  it('delegates to drawRect with rounded corners', () => {
    const ctx = makeCtx();
    drawRoundedRect(ctx, 0, 0, 80, 40, 10, 'teal');
    // radius > 0 → rounded path, not fillRect
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

// ── drawCircleWithHighlight ───────────────────────────────────────────────────

describe('drawCircleWithHighlight', () => {
  it('calls arc twice (base + highlight)', () => {
    const ctx = makeCtx();
    drawCircleWithHighlight(ctx, 50, 50, 25, '#ff8800');
    expect(ctx.arc.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('calls fill once (base circle) and stroke once (highlight arc)', () => {
    const ctx = makeCtx();
    drawCircleWithHighlight(ctx, 50, 50, 25, '#aabbcc');
    expect(ctx.fill).toHaveBeenCalledOnce();
    expect(ctx.stroke).toHaveBeenCalledOnce();
  });
});

// ── drawTube ──────────────────────────────────────────────────────────────────

describe('drawTube', () => {
  it('draws outline even with no segments', () => {
    const ctx = makeCtx();
    drawTube(ctx, 0, 0, 20, 80, []);
    // strokeRect is called for the tube outline (borderRadius > 0 → beginPath path)
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.save).not.toHaveBeenCalled(); // no segments → no save/restore
  });

  it('uses save/restore/clip for each segment', () => {
    const ctx = makeCtx();
    const segments = [
      { color: '#ff0000', fill: 0.5 },
      { color: '#0000ff', fill: 0.3 },
    ];
    drawTube(ctx, 0, 0, 20, 80, segments);
    expect(ctx.save).toHaveBeenCalledTimes(2);
    expect(ctx.restore).toHaveBeenCalledTimes(2);
    expect(ctx.clip).toHaveBeenCalledTimes(2);
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
  });

  it('handles segment color as object with .hex', () => {
    const ctx = makeCtx();
    const segments = [{ color: { hex: '#abcdef' }, fill: 0.5 }];
    drawTube(ctx, 0, 0, 20, 80, segments);
    expect(ctx.fillStyle).toBe('#abcdef');
  });
});
