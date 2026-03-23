/**
 * Accessibility — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests: initAccessibility, announce, isReducedMotionEnabled,
 * focusElement, trapFocus, onReducedMotionChange.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock localStorage ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store = {};
  return {
    getItem:    vi.fn((key)        => store[key] ?? null),
    setItem:    vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key)        => { delete store[key]; }),
    clear:      vi.fn(()           => { store = {}; }),
    get length()  { return Object.keys(store).length; },
    key:        vi.fn((i)          => Object.keys(store)[i] ?? null),
    _reset()    { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ─── Mock window.matchMedia ───────────────────────────────────────────────────

const matchMediaMock = vi.fn((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

Object.defineProperty(globalThis, 'matchMedia', { value: matchMediaMock, writable: true });

import {
  initAccessibility,
  announce,
  isReducedMotionEnabled,
  focusElement,
  trapFocus,
  onReducedMotionChange,
} from '../../src/shared/accessibility.js';

beforeEach(() => {
  localStorageMock._reset();
  vi.clearAllMocks();
  // Re-apply matchMedia mock after clearAllMocks
  matchMediaMock.mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  // Clean up any aria live regions from previous tests
  document.getElementById('aria-live-assertive')?.remove();
  document.getElementById('aria-live-polite')?.remove();
});

// ── initAccessibility ─────────────────────────────────────────────────────

describe('initAccessibility', () => {
  it('creates aria-live-assertive element', () => {
    initAccessibility();
    const el = document.getElementById('aria-live-assertive');
    expect(el).not.toBeNull();
    expect(el.getAttribute('aria-live')).toBe('assertive');
  });

  it('creates aria-live-polite element', () => {
    initAccessibility();
    const el = document.getElementById('aria-live-polite');
    expect(el).not.toBeNull();
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('sets aria-atomic on both regions', () => {
    initAccessibility();
    expect(document.getElementById('aria-live-assertive').getAttribute('aria-atomic')).toBe('true');
    expect(document.getElementById('aria-live-polite').getAttribute('aria-atomic')).toBe('true');
  });

  it('sets role=status on both regions', () => {
    initAccessibility();
    expect(document.getElementById('aria-live-assertive').getAttribute('role')).toBe('status');
    expect(document.getElementById('aria-live-polite').getAttribute('role')).toBe('status');
  });

  it('is idempotent — calling twice does not create duplicates', () => {
    initAccessibility();
    initAccessibility();
    const assertive = document.querySelectorAll('#aria-live-assertive');
    const polite = document.querySelectorAll('#aria-live-polite');
    expect(assertive.length).toBe(1);
    expect(polite.length).toBe(1);
  });

  it('applies sr-only class', () => {
    initAccessibility();
    expect(document.getElementById('aria-live-assertive').className).toContain('sr-only');
    expect(document.getElementById('aria-live-polite').className).toContain('sr-only');
  });
});

// ── announce ──────────────────────────────────────────────────────────────

describe('announce', () => {
  beforeEach(() => {
    initAccessibility();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears the assertive region before setting new message', () => {
    const region = document.getElementById('aria-live-assertive');
    region.textContent = 'old message';
    announce('new message');
    expect(region.textContent).toBe('');
  });

  it('sets message on assertive region after timeout', () => {
    announce('hello');
    vi.advanceTimersByTime(100);
    const region = document.getElementById('aria-live-assertive');
    expect(region.textContent).toBe('hello');
  });

  it('sets message on polite region when priority="polite"', () => {
    announce('soft message', 'polite');
    vi.advanceTimersByTime(100);
    const region = document.getElementById('aria-live-polite');
    expect(region.textContent).toBe('soft message');
  });

  it('uses assertive by default', () => {
    announce('default');
    vi.advanceTimersByTime(100);
    expect(document.getElementById('aria-live-assertive').textContent).toBe('default');
    expect(document.getElementById('aria-live-polite').textContent).toBe('');
  });

  it('initializes regions if not yet initialized', () => {
    document.getElementById('aria-live-assertive')?.remove();
    document.getElementById('aria-live-polite')?.remove();
    // announce should auto-init
    expect(() => announce('auto-init test')).not.toThrow();
  });
});

// ── isReducedMotionEnabled ────────────────────────────────────────────────

describe('isReducedMotionEnabled', () => {
  it('returns a boolean', () => {
    expect(typeof isReducedMotionEnabled()).toBe('boolean');
  });

  it('returns user override when reducedMotionSetByUser is true', () => {
    localStorageMock.setItem('mg:settings', JSON.stringify({
      reducedMotion: true,
      reducedMotionSetByUser: true,
    }));
    expect(isReducedMotionEnabled()).toBe(true);
  });

  it('returns false override when set by user', () => {
    localStorageMock.setItem('mg:settings', JSON.stringify({
      reducedMotion: false,
      reducedMotionSetByUser: true,
    }));
    expect(isReducedMotionEnabled()).toBe(false);
  });

  it('falls back to media query when not set by user', () => {
    // matchMedia mock returns matches:false
    const result = isReducedMotionEnabled();
    expect(result).toBe(false);
  });

  it('returns true when matchMedia reports prefers-reduced-motion', () => {
    matchMediaMock.mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const result = isReducedMotionEnabled();
    expect(result).toBe(true);
  });

  it('falls back to media query when reducedMotionSetByUser is false', () => {
    localStorageMock.setItem('mg:settings', JSON.stringify({
      reducedMotion: true,
      reducedMotionSetByUser: false,
    }));
    // matchMedia mock returns matches:false
    expect(isReducedMotionEnabled()).toBe(false);
  });

  it('handles JSON parse errors gracefully', () => {
    localStorageMock.setItem('mg:settings', 'invalid-json');
    expect(() => isReducedMotionEnabled()).not.toThrow();
  });
});

// ── focusElement ──────────────────────────────────────────────────────────

describe('focusElement', () => {
  it('focuses a button element', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Click me';
    document.body.appendChild(btn);
    focusElement(btn);
    expect(document.activeElement).toBe(btn);
    btn.remove();
  });

  it('focuses an element by selector string', () => {
    const btn = document.createElement('button');
    btn.id = 'test-btn';
    document.body.appendChild(btn);
    focusElement('#test-btn');
    expect(document.activeElement).toBe(btn);
    btn.remove();
  });

  it('adds tabindex=-1 to non-focusable elements', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    focusElement(div);
    expect(div.getAttribute('tabindex')).toBe('-1');
    div.remove();
  });

  it('does not throw when element is null', () => {
    expect(() => focusElement(null)).not.toThrow();
  });

  it('does not throw when selector matches nothing', () => {
    expect(() => focusElement('#non-existent')).not.toThrow();
  });
});

// ── trapFocus ─────────────────────────────────────────────────────────────

describe('trapFocus', () => {
  it('returns a cleanup function', () => {
    const container = document.createElement('div');
    container.innerHTML = '<button>A</button><button>B</button>';
    document.body.appendChild(container);
    const cleanup = trapFocus(container);
    expect(typeof cleanup).toBe('function');
    cleanup();
    container.remove();
  });

  it('focuses the first focusable element', () => {
    const container = document.createElement('div');
    container.innerHTML = '<button id="first">A</button><button id="second">B</button>';
    document.body.appendChild(container);
    trapFocus(container);
    expect(document.activeElement.id).toBe('first');
    container.remove();
  });

  it('does not throw when container has no focusable elements', () => {
    const container = document.createElement('div');
    container.innerHTML = '<span>No buttons here</span>';
    document.body.appendChild(container);
    expect(() => trapFocus(container)).not.toThrow();
    container.remove();
  });

  it('wraps Tab forward from last focusable to first', () => {
    const container = document.createElement('div');
    container.innerHTML = '<button id="ft-first">A</button><button id="ft-last">B</button>';
    document.body.appendChild(container);
    trapFocus(container); // focuses ft-first
    container.querySelector('#ft-last').focus();
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement.id).toBe('ft-first');
    container.remove();
  });

  it('wraps Shift+Tab backward from first focusable to last', () => {
    const container = document.createElement('div');
    container.innerHTML = '<button id="st-first">A</button><button id="st-last">B</button>';
    document.body.appendChild(container);
    trapFocus(container); // focuses st-first
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement.id).toBe('st-last');
    container.remove();
  });

  it('ignores non-Tab keypresses (does not move focus)', () => {
    const container = document.createElement('div');
    container.innerHTML = '<button id="nt-first">A</button><button id="nt-last">B</button>';
    document.body.appendChild(container);
    trapFocus(container); // focuses nt-first
    // Press Enter — not Tab, should be ignored by handleKeyDown
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.activeElement.id).toBe('nt-first'); // focus unchanged
    container.remove();
  });
});

// ── onReducedMotionChange ──────────────────────────────────────────────────

describe('onReducedMotionChange', () => {
  it('returns an unsubscribe function', () => {
    const unsubscribe = onReducedMotionChange(() => {});
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('unsubscribe does not throw', () => {
    const unsubscribe = onReducedMotionChange(() => {});
    expect(() => unsubscribe()).not.toThrow();
  });

  it('fires callback when media query changes and no user override is stored', () => {
    let capturedHandler;
    const fakeMediaQuery = {
      matches: false,
      addEventListener: vi.fn((type, handler) => { capturedHandler = handler; }),
      removeEventListener: vi.fn(),
    };
    matchMediaMock.mockReturnValueOnce(fakeMediaQuery);

    const callback = vi.fn();
    onReducedMotionChange(callback);

    // No mg:settings in localStorage — should fire callback
    capturedHandler({ matches: true });
    expect(callback).toHaveBeenCalledWith(true);
  });

  it('ignores system change when reducedMotionSetByUser=true (manual override path)', () => {
    let capturedHandler;
    const fakeMediaQuery = {
      matches: false,
      addEventListener: vi.fn((type, handler) => { capturedHandler = handler; }),
      removeEventListener: vi.fn(),
    };
    matchMediaMock.mockReturnValueOnce(fakeMediaQuery);

    // Set user override in storage
    localStorageMock.setItem('mg:settings', JSON.stringify({ reducedMotionSetByUser: true, reducedMotion: false }));

    const callback = vi.fn();
    onReducedMotionChange(callback);

    // System changes to true, but user override should suppress callback
    capturedHandler({ matches: true });
    expect(callback).not.toHaveBeenCalled();
  });

  it('still fires callback when localStorage.getItem throws in handler (catch block)', () => {
    let capturedHandler;
    const fakeMediaQuery = {
      matches: false,
      addEventListener: vi.fn((type, handler) => { capturedHandler = handler; }),
      removeEventListener: vi.fn(),
    };
    matchMediaMock.mockReturnValueOnce(fakeMediaQuery);
    localStorageMock.getItem.mockImplementationOnce(() => { throw new Error('Storage denied'); });

    const callback = vi.fn();
    onReducedMotionChange(callback);
    capturedHandler({ matches: true });
    // catch swallowed the error; callback still fires with e.matches
    expect(callback).toHaveBeenCalledWith(true);
  });
});
