/**
 * Viewport — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests: LOGICAL_RESOLUTIONS, createViewport, createPortraitViewport,
 * createLandscapeViewport, createSquareViewport, cleanupAllViewports,
 * getDimensions, getContext, resizeLogical, destroy.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LOGICAL_RESOLUTIONS,
  createViewport,
  createPortraitViewport,
  createLandscapeViewport,
  createSquareViewport,
  cleanupAllViewports,
} from '../../src/shared/viewport.js';

// ─── Mock ResizeObserver ──────────────────────────────────────────────────────

const observeMock    = vi.fn();
const disconnectMock = vi.fn();

global.ResizeObserver = class ResizeObserver {
  constructor(callback) { this._callback = callback; }
  observe(el) { observeMock(el); }
  disconnect() { disconnectMock(); }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContainer() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  observeMock.mockClear();
  disconnectMock.mockClear();
});

afterEach(() => {
  cleanupAllViewports();
  // Remove all child nodes added to body
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
});

// ── LOGICAL_RESOLUTIONS ────────────────────────────────────────────────────

describe('LOGICAL_RESOLUTIONS', () => {
  it('defines portrait resolution', () => {
    expect(LOGICAL_RESOLUTIONS.portrait).toBeDefined();
    expect(LOGICAL_RESOLUTIONS.portrait.width).toBeGreaterThan(0);
    expect(LOGICAL_RESOLUTIONS.portrait.height).toBeGreaterThan(0);
  });

  it('defines landscape resolution', () => {
    expect(LOGICAL_RESOLUTIONS.landscape).toBeDefined();
    expect(LOGICAL_RESOLUTIONS.landscape.width).toBeGreaterThan(LOGICAL_RESOLUTIONS.landscape.height);
  });

  it('defines square resolution', () => {
    expect(LOGICAL_RESOLUTIONS.square).toBeDefined();
    expect(LOGICAL_RESOLUTIONS.square.width).toBe(LOGICAL_RESOLUTIONS.square.height);
  });

  it('portrait width < portrait height', () => {
    const { width, height } = LOGICAL_RESOLUTIONS.portrait;
    expect(width).toBeLessThan(height);
  });
});

// ── createViewport ─────────────────────────────────────────────────────────

describe('createViewport', () => {
  it('creates and returns a viewport instance', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 390, logicalHeight: 844 });
    expect(vp).toBeDefined();
    expect(vp.canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('sets canvas width and height from logical dimensions', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 320, logicalHeight: 480 });
    expect(vp.canvas.width).toBe(320);
    expect(vp.canvas.height).toBe(480);
  });

  it('appends canvas wrapper to container', () => {
    const container = makeContainer();
    createViewport(container, { logicalWidth: 390, logicalHeight: 844 });
    expect(container.children.length).toBe(1);
    expect(container.children[0]).toBe(document.querySelector('div > div'));
  });

  it('uses default portrait dimensions when none provided', () => {
    const container = makeContainer();
    const vp = createViewport(container);
    expect(vp.canvas.width).toBe(LOGICAL_RESOLUTIONS.portrait.width);
    expect(vp.canvas.height).toBe(LOGICAL_RESOLUTIONS.portrait.height);
  });

  it('attaches ResizeObserver when autoResize=true', () => {
    const container = makeContainer();
    createViewport(container, { logicalWidth: 390, logicalHeight: 844, autoResize: true });
    expect(observeMock).toHaveBeenCalledWith(container);
  });

  it('does not attach ResizeObserver when autoResize=false', () => {
    const container = makeContainer();
    createViewport(container, { logicalWidth: 390, logicalHeight: 844, autoResize: false });
    expect(observeMock).not.toHaveBeenCalled();
  });
});

// ── getDimensions ──────────────────────────────────────────────────────────

describe('getDimensions', () => {
  it('returns correct logical width and height', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 600, logicalHeight: 400 });
    const dims = vp.getDimensions();
    expect(dims.width).toBe(600);
    expect(dims.height).toBe(400);
  });
});

// ── getContext ──────────────────────────────────────────────────────────────

describe('getContext', () => {
  it('returns a context when called with "2d"', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 390, logicalHeight: 844 });
    // In jsdom, getContext may return null without canvas package
    // Just ensure the call doesn't throw
    expect(() => vp.getContext('2d')).not.toThrow();
  });

  it('defaults to 2d context type', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 390, logicalHeight: 844 });
    expect(() => vp.getContext()).not.toThrow();
  });
});

// ── resizeLogical ──────────────────────────────────────────────────────────

describe('resizeLogical', () => {
  it('updates canvas width and height', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 390, logicalHeight: 844 });
    vp.resizeLogical(800, 600);
    expect(vp.canvas.width).toBe(800);
    expect(vp.canvas.height).toBe(600);
  });

  it('updates the instance logicalWidth and logicalHeight', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 390, logicalHeight: 844 });
    vp.resizeLogical(1024, 768);
    expect(vp.logicalWidth).toBe(1024);
    expect(vp.logicalHeight).toBe(768);
  });
});

// ── destroy ────────────────────────────────────────────────────────────────

describe('destroy', () => {
  it('removes the wrapper from the DOM', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 390, logicalHeight: 844 });
    vp.destroy();
    expect(container.children.length).toBe(0);
  });

  it('disconnects ResizeObserver', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 390, logicalHeight: 844, autoResize: true });
    vp.destroy();
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw when called twice', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 390, logicalHeight: 844 });
    vp.destroy();
    expect(() => vp.destroy()).not.toThrow();
  });

  it('does not throw when wrapper was already removed from DOM (parentNode guard)', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 390, logicalHeight: 844 });
    // Manually remove wrapper from DOM before destroy
    container.removeChild(vp.wrapper);
    expect(() => vp.destroy()).not.toThrow();
    expect(container.children.length).toBe(0);
  });

  it('does not throw when resizeObserver is null (autoResize=false — if(this.resizeObserver) false branch)', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 390, logicalHeight: 844, autoResize: false });
    expect(() => vp.destroy()).not.toThrow();
    expect(container.children.length).toBe(0);
  });
});

// ── factory helpers ────────────────────────────────────────────────────────

describe('createPortraitViewport', () => {
  it('creates a viewport with portrait dimensions', () => {
    const container = makeContainer();
    const vp = createPortraitViewport(container);
    expect(vp.canvas.width).toBe(LOGICAL_RESOLUTIONS.portrait.width);
    expect(vp.canvas.height).toBe(LOGICAL_RESOLUTIONS.portrait.height);
  });
});

describe('createLandscapeViewport', () => {
  it('creates a viewport with landscape dimensions', () => {
    const container = makeContainer();
    const vp = createLandscapeViewport(container);
    expect(vp.canvas.width).toBe(LOGICAL_RESOLUTIONS.landscape.width);
    expect(vp.canvas.height).toBe(LOGICAL_RESOLUTIONS.landscape.height);
  });
});

describe('createSquareViewport', () => {
  it('creates a viewport with square dimensions', () => {
    const container = makeContainer();
    const vp = createSquareViewport(container);
    expect(vp.canvas.width).toBe(LOGICAL_RESOLUTIONS.square.width);
    expect(vp.canvas.height).toBe(LOGICAL_RESOLUTIONS.square.height);
  });
});

// ── getScale ───────────────────────────────────────────────────────────────

describe('getScale', () => {
  it('returns ratio of physical to logical dimensions', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 390, logicalHeight: 844 });
    // Mock getBoundingClientRect to return double the logical size
    vp.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 780, height: 1688 });
    const scale = vp.getScale();
    expect(scale.x).toBeCloseTo(2); // 780 / 390
    expect(scale.y).toBeCloseTo(2); // 1688 / 844
  });
});

// ── physicalToLogical / logicalToPhysical ──────────────────────────────────

describe('physicalToLogical', () => {
  it('converts physical coordinates to logical using scale and offset', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 390, logicalHeight: 844 });
    // Scale is 2× with canvas at (10, 20) physical offset
    vp.canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 780, height: 1688 });
    // physical (210, 420) → logical (200/2, 400/2) = (100, 200)
    const result = vp.physicalToLogical(210, 420);
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200);
  });
});

describe('logicalToPhysical', () => {
  it('converts logical coordinates to physical using scale and offset', () => {
    const container = makeContainer();
    const vp = createViewport(container, { logicalWidth: 390, logicalHeight: 844 });
    vp.canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 780, height: 1688 });
    // logical (100, 200) → physical (100*2 + 10, 200*2 + 20) = (210, 420)
    const result = vp.logicalToPhysical(100, 200);
    expect(result.x).toBeCloseTo(210);
    expect(result.y).toBeCloseTo(420);
  });
});

// ── _updateCanvasScale — fixed orientation (else branch) ───────────────────

describe('_updateCanvasScale — fixed orientation', () => {
  it('scales canvas by Math.min(scaleX, scaleY) when orientation is not auto', () => {
    const container = makeContainer();
    // Container 300×200, logical 390×844
    // scaleX = 300/390, scaleY = 200/844 → Math.min picks scaleY
    container.getBoundingClientRect = () => ({ width: 300, height: 200, left: 0, top: 0 });
    const vp = createViewport(container, {
      logicalWidth: 390,
      logicalHeight: 844,
      orientation: 'portrait',
      autoResize: true,
    });
    const expected = Math.min(300 / 390, 200 / 844);
    expect(vp.canvas.style.transform).toBe(`scale(${expected})`);
  });
});

// ── _updateCanvasScale — auto orientation sub-branches ─────────────────────

describe('_updateCanvasScale — auto orientation', () => {
  it('fits to height when container is wider than logical aspect (containerAspect > logicalAspect)', () => {
    const container = makeContainer();
    // Container 1200×844: aspect 1.42; logical 390×844: aspect 0.46 → wider → fit to height
    container.getBoundingClientRect = () => ({ width: 1200, height: 844, left: 0, top: 0 });
    const vp = createViewport(container, {
      logicalWidth: 390, logicalHeight: 844,
      orientation: 'auto', autoResize: true,
    });
    const expected = 844 / 844; // containerRect.height / logicalHeight = 1
    expect(vp.canvas.style.transform).toBe(`scale(${expected})`);
  });

  it('fits to width when container is taller than logical aspect (containerAspect <= logicalAspect)', () => {
    const container = makeContainer();
    // Container 200×1200: aspect 0.17; logical 390×844: aspect 0.46 → taller → fit to width
    container.getBoundingClientRect = () => ({ width: 200, height: 1200, left: 0, top: 0 });
    const vp = createViewport(container, {
      logicalWidth: 390, logicalHeight: 844,
      orientation: 'auto', autoResize: true,
    });
    const expected = 200 / 390; // containerRect.width / logicalWidth
    expect(vp.canvas.style.transform).toBe(`scale(${expected})`);
  });
});

// ── cleanupAllViewports ────────────────────────────────────────────────────

describe('cleanupAllViewports', () => {
  it('destroys all active viewport instances', () => {
    const c1 = makeContainer();
    const c2 = makeContainer();
    createViewport(c1, { logicalWidth: 390, logicalHeight: 844 });
    createViewport(c2, { logicalWidth: 844, logicalHeight: 390 });
    cleanupAllViewports();
    expect(c1.children.length).toBe(0);
    expect(c2.children.length).toBe(0);
  });

  it('does not throw when no viewports exist', () => {
    cleanupAllViewports(); // already cleaned up by afterEach
    expect(() => cleanupAllViewports()).not.toThrow();
  });
});
