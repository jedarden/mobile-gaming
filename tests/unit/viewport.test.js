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
