import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeEvent, onTap, onDrag, onSwipe,
  removeAllListeners, disableTouchActions
} from '../../src/shared/input.js';

function createMockElement() {
  const listeners = {};
  return {
    style: {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 390, height: 844 };
    },
    addEventListener(type, fn, options) {
      (listeners[type] = listeners[type] || []).push({ fn, options });
    },
    removeEventListener(type, fn) {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter(l => l.fn !== fn);
      }
    },
    _listeners: listeners,
    _getListenerCount() {
      return Object.values(listeners).reduce((sum, arr) => sum + arr.length, 0);
    }
  };
}

function createMouseEvent(type, x, y) {
  return { type, clientX: x, clientY: y, preventDefault() {} };
}

function createTouchEvent(type, x, y) {
  return {
    type,
    touches: type === 'touchend' ? [] : [{ clientX: x, clientY: y }],
    changedTouches: [{ clientX: x, clientY: y }],
    preventDefault() {}
  };
}

describe('input', () => {
  let element;

  beforeEach(() => {
    element = createMockElement();
  });

  afterEach(() => {
    removeAllListeners();
  });

  describe('normalizeEvent', () => {
    it('normalizes a mouse event', () => {
      const event = createMouseEvent('mousedown', 100, 200);
      const result = normalizeEvent(element, 'down', event);
      expect(result).toMatchObject({ type: 'down', x: 100, y: 200 });
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.originalEvent).toBe(event);
    });

    it('normalizes a touch event (touchstart)', () => {
      const event = createTouchEvent('touchstart', 100, 200);
      const result = normalizeEvent(element, 'down', event);
      expect(result).toMatchObject({ type: 'down', x: 100, y: 200 });
    });

    it('normalizes a touch event (touchend using changedTouches)', () => {
      const event = createTouchEvent('touchend', 100, 200);
      const result = normalizeEvent(element, 'up', event);
      expect(result).toMatchObject({ type: 'up', x: 100, y: 200 });
    });
  });

  describe('onTap', () => {
    it('registers mouse and touch listeners', () => {
      const cleanup = onTap(element, () => {});
      expect(element._listeners.mousedown).toHaveLength(1);
      expect(element._listeners.mouseup).toHaveLength(1);
      expect(element._listeners.touchstart).toHaveLength(1);
      expect(element._listeners.touchend).toHaveLength(1);
    });

    it('calls callback on tap (mouse)', () => {
      const callback = vi.fn();
      onTap(element, callback);

      const downEvent = createMouseEvent('mousedown', 100, 200);
      const upEvent = createMouseEvent('mouseup', 100, 200);

      element._listeners.mousedown[0].fn(downEvent);
      element._listeners.mouseup[0].fn(upEvent);

      expect(callback).toHaveBeenCalledWith({ x: 100, y: 200 });
    });

    it('does not fire on drag (too much movement)', () => {
      const callback = vi.fn();
      onTap(element, callback);

      const downEvent = createMouseEvent('mousedown', 100, 200);
      const upEvent = createMouseEvent('mouseup', 150, 200); // 50px movement

      element._listeners.mousedown[0].fn(downEvent);
      element._listeners.mouseup[0].fn(upEvent);

      expect(callback).not.toHaveBeenCalled();
    });

    it('cleanup removes all listeners', () => {
      const cleanup = onTap(element, () => {});
      cleanup();
      expect(element._getListenerCount()).toBe(0);
    });
  });

  describe('onDrag', () => {
    it('registers all drag-related listeners', () => {
      const cleanup = onDrag(element, () => {});
      expect(element._listeners.mousedown).toHaveLength(1);
      expect(element._listeners.mousemove).toHaveLength(1);
      expect(element._listeners.mouseup).toHaveLength(1);
      expect(element._listeners.mouseleave).toHaveLength(1);
      expect(element._listeners.touchstart).toHaveLength(1);
      expect(element._listeners.touchmove).toHaveLength(1);
      expect(element._listeners.touchend).toHaveLength(1);
      expect(element._listeners.touchcancel).toHaveLength(1);
    });

    it('calls callback with isDragging: false on down', () => {
      const callback = vi.fn();
      onDrag(element, callback);

      const downEvent = createMouseEvent('mousedown', 100, 200);
      element._listeners.mousedown[0].fn(downEvent);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ x: 100, y: 200, isDragging: false })
      );
    });

    it('calls callback with isDragging: true after threshold', () => {
      const callback = vi.fn();
      onDrag(element, callback);

      const downEvent = createMouseEvent('mousedown', 100, 200);
      const moveEvent = createMouseEvent('mousemove', 120, 200); // 20px movement

      element._listeners.mousedown[0].fn(downEvent);
      element._listeners.mousemove[0].fn(moveEvent);

      const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0];
      expect(lastCall.isDragging).toBe(true);
    });

    it('cleanup removes all listeners', () => {
      const cleanup = onDrag(element, () => {});
      cleanup();
      expect(element._getListenerCount()).toBe(0);
    });
  });

  describe('onSwipe', () => {
    it('registers down and up listeners', () => {
      const cleanup = onSwipe(element, () => {});
      expect(element._listeners.mousedown).toHaveLength(1);
      expect(element._listeners.mouseup).toHaveLength(1);
      expect(element._listeners.touchstart).toHaveLength(1);
      expect(element._listeners.touchend).toHaveLength(1);
    });

    it('detects a right swipe', () => {
      const callback = vi.fn();
      onSwipe(element, callback, 30);

      const downEvent = createMouseEvent('mousedown', 100, 200);
      const upEvent = createMouseEvent('mouseup', 200, 200); // 100px right

      // Swipe detection uses Date.now() for duration
      // Default swipeTimeout is 300ms, so both calls must be within 300ms
      const realNow = Date.now;
      let callCount = 0;
      Date.now = () => 1000000 + (callCount++ * 100); // 100ms apart

      element._listeners.mousedown[0].fn(downEvent);
      element._listeners.mouseup[0].fn(upEvent);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'right' })
      );

      Date.now = realNow;
    });

    it('detects a left swipe', () => {
      const callback = vi.fn();
      onSwipe(element, callback, 30);

      const downEvent = createMouseEvent('mousedown', 200, 200);
      const upEvent = createMouseEvent('mouseup', 100, 200);

      const realNow = Date.now;
      let callCount = 0;
      Date.now = () => 1000000 + (callCount++ * 100);

      element._listeners.mousedown[0].fn(downEvent);
      element._listeners.mouseup[0].fn(upEvent);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'left' })
      );

      Date.now = realNow;
    });

    it('detects an up swipe', () => {
      const callback = vi.fn();
      onSwipe(element, callback, 30);

      const downEvent = createMouseEvent('mousedown', 100, 200);
      const upEvent = createMouseEvent('mouseup', 100, 100);

      const realNow = Date.now;
      let callCount = 0;
      Date.now = () => 1000000 + (callCount++ * 100);

      element._listeners.mousedown[0].fn(downEvent);
      element._listeners.mouseup[0].fn(upEvent);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'up' })
      );

      Date.now = realNow;
    });

    it('filters by direction when specified', () => {
      const callback = vi.fn();
      onSwipe(element, callback, 30, 'right');

      const downEvent = createMouseEvent('mousedown', 200, 200);
      const upEvent = createMouseEvent('mouseup', 100, 200); // left swipe

      const realNow = Date.now;
      let callCount = 0;
      Date.now = () => 1000000 + (callCount++ * 100);

      element._listeners.mousedown[0].fn(downEvent);
      element._listeners.mouseup[0].fn(upEvent);

      expect(callback).not.toHaveBeenCalled();

      Date.now = realNow;
    });

    it('does not fire if movement is below threshold', () => {
      const callback = vi.fn();
      onSwipe(element, callback, 30);

      const downEvent = createMouseEvent('mousedown', 100, 200);
      const upEvent = createMouseEvent('mouseup', 110, 200); // 10px movement

      const realNow = Date.now;
      let callCount = 0;
      Date.now = () => 1000000 + (callCount++ * 100);

      element._listeners.mousedown[0].fn(downEvent);
      element._listeners.mouseup[0].fn(upEvent);

      expect(callback).not.toHaveBeenCalled();

      Date.now = realNow;
    });

    it('cleanup removes all listeners', () => {
      const cleanup = onSwipe(element, () => {});
      cleanup();
      expect(element._getListenerCount()).toBe(0);
    });
  });

  describe('disableTouchActions', () => {
    it('sets touch action styles on element', () => {
      disableTouchActions(element);
      expect(element.style.touchAction).toBe('none');
      expect(element.style.webkitTouchCallout).toBe('none');
      expect(element.style.webkitUserSelect).toBe('none');
      expect(element.style.userSelect).toBe('none');
    });
  });
});
