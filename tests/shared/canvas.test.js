import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createCanvas, resizeCanvas, getContext2D,
  clearCanvas, startLoop, stopLoop, stopAllLoops
} from '../../src/shared/canvas.js';

// Minimal DOM mocks for canvas module
function createMockElement(tag) {
  const children = [];
  const listeners = {};
  return {
    tagName: tag.toUpperCase(),
    style: {},
    children,
    childNodes: children,
    appendChild(child) { children.push(child); },
    removeChild(child) {
      const idx = children.indexOf(child);
      if (idx >= 0) children.splice(idx, 1);
    },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter(f => f !== fn);
      }
    },
    _listeners: listeners
  };
}

function createMockCanvasEl() {
  const el = createMockElement('canvas');
  el.width = 0;
  el.height = 0;
  let scaleCalls = [];
  const mockCtx = {
    scale(x, y) { scaleCalls.push([x, y]); },
    clearRect(x, y, w, h) {},
    _scaleCalls: () => scaleCalls,
    _resetScaleCalls() { scaleCalls = []; }
  };
  el.getContext = (type) => type === '2d' ? mockCtx : null;
  return { el, ctx: mockCtx };
}

describe('canvas', () => {
  let container;

  beforeEach(() => {
    container = createMockElement('div');
    global.window = { devicePixelRatio: 1 };
    global.document = { createElement: (tag) => createMockElement(tag) };
  });

  describe('createCanvas', () => {
    it('creates a canvas with correct logical dimensions', () => {
      const { el } = createMockCanvasEl();
      const origCreate = global.document.createElement;
      global.document.createElement = (tag) => tag === 'canvas' ? el : createMockElement(tag);

      const canvas = createCanvas(container, 390, 844);

      expect(canvas.style.width).toBe('390px');
      expect(canvas.style.height).toBe('844px');
      expect(canvas.style.touchAction).toBe('none');
      expect(canvas.style.userSelect).toBe('none');
      expect(container.children).toHaveLength(1);

      global.document.createElement = origCreate;
    });

    it('scales canvas buffer by device pixel ratio', () => {
      const { el } = createMockCanvasEl();
      const origCreate = global.document.createElement;
      global.document.createElement = (tag) => tag === 'canvas' ? el : createMockElement(tag);

      global.window.devicePixelRatio = 2;

      const canvas = createCanvas(container, 390, 844);

      expect(canvas.width).toBe(780);
      expect(canvas.height).toBe(1688);

      global.document.createElement = origCreate;
    });
  });

  describe('resizeCanvas', () => {
    it('updates canvas dimensions with DPR scaling', () => {
      const { el } = createMockCanvasEl();
      global.window.devicePixelRatio = 2;

      resizeCanvas(el, 200, 400);

      expect(el.style.width).toBe('200px');
      expect(el.style.height).toBe('400px');
      expect(el.width).toBe(400);
      expect(el.height).toBe(800);
    });
  });

  describe('getContext2D', () => {
    it('applies DPR scale to context', () => {
      const { el, ctx } = createMockCanvasEl();
      global.window.devicePixelRatio = 2;

      const result = getContext2D(el);

      expect(result).toBe(ctx);
      expect(ctx._scaleCalls()).toEqual([[2, 2]]);
    });

    it('uses DPR of 1 when devicePixelRatio is undefined', () => {
      const { el, ctx } = createMockCanvasEl();
      global.window.devicePixelRatio = undefined;

      getContext2D(el);
      expect(ctx._scaleCalls()).toEqual([[1, 1]]);
    });

    it('uses DPR of 1 when devicePixelRatio is null (falsy || 1 fallback)', () => {
      const { el, ctx } = createMockCanvasEl();
      global.window.devicePixelRatio = null;

      getContext2D(el);
      expect(ctx._scaleCalls()).toEqual([[1, 1]]);
    });

    it('uses DPR of 1 when devicePixelRatio is 0 (falsy || 1 fallback)', () => {
      const { el, ctx } = createMockCanvasEl();
      global.window.devicePixelRatio = 0;

      getContext2D(el);
      expect(ctx._scaleCalls()).toEqual([[1, 1]]);
    });
  });

  describe('clearCanvas', () => {
    it('calls clearRect with the given dimensions', () => {
      const { ctx } = createMockCanvasEl();
      vi.spyOn(ctx, 'clearRect');

      clearCanvas(ctx, 390, 844);

      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 390, 844);
    });
  });

  describe('animation loops', () => {
    let rafIds;
    let rafCallbacks;

    beforeEach(() => {
      rafIds = [1, 2, 3];
      rafCallbacks = {};
      global.requestAnimationFrame = vi.fn((cb) => {
        const id = rafIds.shift() || Math.random();
        rafCallbacks[id] = cb;
        return id;
      });
      global.cancelAnimationFrame = vi.fn((id) => {
        delete rafCallbacks[id];
      });
    });

    it('startLoop returns the loop id', () => {
      const id = startLoop(() => {}, 'test');
      expect(id).toBe('test');
    });

    it('startLoop calls requestAnimationFrame', () => {
      startLoop(() => {}, 'test');
      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });

    it('stopLoop cancels the animation frame', () => {
      startLoop(() => {}, 'test');
      stopLoop('test');
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it('stopLoop is a no-op for unknown id', () => {
      expect(() => stopLoop('unknown')).not.toThrow();
    });

    it('stopAllLoops cancels all active loops', () => {
      startLoop(() => {}, 'loop1');
      startLoop(() => {}, 'loop2');
      stopAllLoops();
      expect(global.cancelAnimationFrame).toHaveBeenCalledTimes(2);
    });

    it('replacing a loop with the same id cancels the old one', () => {
      startLoop(() => {}, 'test');
      startLoop(() => {}, 'test');
      expect(global.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    });
  });
});
