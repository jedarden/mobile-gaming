/**
 * Fail Speedrun — DOM Overlay Unit Tests
 * @vitest-environment jsdom
 *
 * Tests the three DOM-rendering exports not covered in fail-speedrun.test.js:
 *   showFailResult, showFailTimer, cleanupAllOverlays.
 *
 * Uses jsdom for document/DOM APIs and mocks storage + RAF.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

// localStorage needed by StorageManager (used transitively)
const _store = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem:    vi.fn(k => _store[k] ?? null),
    setItem:    vi.fn((k, v) => { _store[k] = v; }),
    removeItem: vi.fn(k => { delete _store[k]; }),
    clear:      vi.fn(() => { for (const k in _store) delete _store[k]; }),
    get length() { return Object.keys(_store).length; },
    key:        vi.fn(i => Object.keys(_store)[i] ?? null),
  },
  writable: true,
});

// requestAnimationFrame — call callback synchronously so visibility class is set
globalThis.requestAnimationFrame = vi.fn(cb => { cb(0); return 1; });
globalThis.cancelAnimationFrame  = vi.fn();

// ── Import module under test ───────────────────────────────────────────────

import {
  showFailResult,
  showFailTimer,
  cleanupAllOverlays,
} from '../../src/shared/fail-speedrun.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContainer() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

// ── showFailResult ─────────────────────────────────────────────────────────

describe('showFailResult', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  afterEach(() => {
    container.remove();
    cleanupAllOverlays();
    vi.clearAllMocks();
  });

  it('appends an overlay to the container', () => {
    showFailResult({ container, gameId: 'pull-the-pin', levelIndex: 0, timeMs: 1500 });
    expect(container.querySelector('.fs-overlay')).not.toBeNull();
  });

  it('contains "FAIL!" title', () => {
    showFailResult({ container, gameId: 'water-sort', levelIndex: 0, timeMs: 800 });
    expect(container.textContent).toContain('FAIL!');
  });

  it('shows formatted fail time', () => {
    showFailResult({ container, gameId: 'brain-teaser', levelIndex: 0, timeMs: 2345 });
    expect(container.textContent).toContain('2.345');
  });

  it('shows "New Personal Best!" when isNewBest is true', () => {
    showFailResult({ container, gameId: 'pull-the-pin', levelIndex: 0, timeMs: 900, isNewBest: true });
    expect(container.textContent).toContain('New Personal Best!');
  });

  it('does not show "New Personal Best!" when isNewBest is false', () => {
    showFailResult({ container, gameId: 'pull-the-pin', levelIndex: 0, timeMs: 900, isNewBest: false });
    expect(container.textContent).not.toContain('New Personal Best!');
  });

  it('shows Ad Recreation badge when badgeAwarded is true', () => {
    showFailResult({ container, gameId: 'pull-the-pin', levelIndex: 0, timeMs: 500, badgeAwarded: true });
    expect(container.textContent).toContain('Ad Recreation Badge!');
  });

  it('does not show Ad Recreation badge when badgeAwarded is false', () => {
    showFailResult({ container, gameId: 'pull-the-pin', levelIndex: 0, timeMs: 500, badgeAwarded: false });
    expect(container.textContent).not.toContain('Ad Recreation Badge!');
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    showFailResult({ container, gameId: 'jelly-shift', levelIndex: 0, timeMs: 1000, onRetry });
    container.querySelector('[data-action="retry"]').click();
    expect(onRetry).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    showFailResult({ container, gameId: 'jelly-shift', levelIndex: 0, timeMs: 1000, onClose });
    container.querySelector('[data-action="close"]').click();
    expect(onClose).toHaveBeenCalled();
  });

  it('returns instance with overlay and hide/destroy methods', () => {
    const instance = showFailResult({ container, gameId: 'pull-the-pin', levelIndex: 0, timeMs: 500 });
    expect(instance.overlay).toBeInstanceOf(HTMLElement);
    expect(typeof instance.hide).toBe('function');
    expect(typeof instance.destroy).toBe('function');
  });

  it('destroy() removes overlay from container', () => {
    const instance = showFailResult({ container, gameId: 'pull-the-pin', levelIndex: 0, timeMs: 600 });
    instance.destroy();
    expect(container.querySelector('.fs-overlay')).toBeNull();
  });

  it('shows game fail objective from config', () => {
    // pull-the-pin config has a failObjective mentioning "wrong cup"
    showFailResult({ container, gameId: 'pull-the-pin', levelIndex: 0, timeMs: 1200 });
    expect(container.textContent.toLowerCase()).toContain('wrong cup');
  });

  it('falls back to "Fastest fail" for unknown gameId', () => {
    showFailResult({ container, gameId: 'unknown-game', levelIndex: 0, timeMs: 500 });
    expect(container.textContent).toContain('Fastest fail');
  });
});

// ── showFailTimer ──────────────────────────────────────────────────────────

describe('showFailTimer', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  it('appends a timer element to the container', () => {
    showFailTimer({ container, getCurrentTime: () => 0 });
    expect(container.querySelector('.fs-timer')).not.toBeNull();
  });

  it('initially displays "0.000"', () => {
    const instance = showFailTimer({ container, getCurrentTime: () => 0 });
    expect(instance.timer.textContent).toBe('0.000');
  });

  it('update(false) shows "Waiting..."', () => {
    const instance = showFailTimer({ container, getCurrentTime: () => 0 });
    instance.update(false);
    expect(instance.timer.textContent).toBe('Waiting...');
  });

  it('update(true) shows formatted elapsed time', () => {
    let t = 0;
    const instance = showFailTimer({ container, getCurrentTime: () => t });
    t = 1500;
    instance.update(true);
    expect(instance.timer.textContent).toBe('1.500');
  });

  it('update(true) removes fs-waiting class', () => {
    const instance = showFailTimer({ container, getCurrentTime: () => 500 });
    instance.timer.classList.add('fs-waiting'); // ensure it starts waiting
    instance.update(true);
    expect(instance.timer.classList.contains('fs-waiting')).toBe(false);
  });

  it('destroy() removes the timer from the DOM', () => {
    const instance = showFailTimer({ container, getCurrentTime: () => 0 });
    instance.destroy();
    expect(container.querySelector('.fs-timer')).toBeNull();
  });

  it('update() is a no-op after destroy()', () => {
    const instance = showFailTimer({ container, getCurrentTime: () => 0 });
    instance.destroy();
    // Should not throw
    expect(() => instance.update(true)).not.toThrow();
  });
});

// ── cleanupAllOverlays ─────────────────────────────────────────────────────

describe('cleanupAllOverlays', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  it('removes all tracked overlay instances', () => {
    showFailResult({ container, gameId: 'pull-the-pin', levelIndex: 0, timeMs: 500 });
    showFailResult({ container, gameId: 'water-sort', levelIndex: 1, timeMs: 800 });
    expect(container.querySelectorAll('.fs-overlay').length).toBe(2);

    cleanupAllOverlays();

    expect(container.querySelectorAll('.fs-overlay').length).toBe(0);
  });

  it('is a no-op when no overlays exist', () => {
    expect(() => cleanupAllOverlays()).not.toThrow();
  });
});
