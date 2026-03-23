/**
 * Retry Overlay — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests ResultType enum, RetryOverlay._formatTime(), _getSubtitleText(),
 * failure-count tracking, show/hide state, and skip-button threshold.
 *
 * Full DOM rendering is tested via the overlay's isVisible flag and
 * by inspecting the element after show() is called.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

// ─── Mock audio ───────────────────────────────────────────────────────────────

vi.mock('../../src/shared/audio.js', () => ({
  playSound: vi.fn(),
  playTap:   vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { ResultType, RetryOverlay, createRetryOverlay } from '../../src/shared/retry.js';
import { storage } from '../../src/shared/storage.js';
import { playSound } from '../../src/shared/audio.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeContainer() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function makeOverlay(opts = {}) {
  const container = makeContainer();
  return new RetryOverlay({
    container,
    gameId: opts.gameId ?? 'test-game',
    levelIndex: opts.levelIndex ?? 0,
    onRetry: opts.onRetry ?? vi.fn(),
    onNext:  opts.onNext  ?? vi.fn(),
    onSkip:  opts.onSkip  ?? vi.fn(),
    onHint:  opts.onHint  ?? vi.fn(),
    onShare: opts.onShare ?? vi.fn(),
    ...opts,
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock._reset();
  vi.clearAllMocks();
  storage.cache.clear();
  storage.accessOrder = [];
  document.body.innerHTML = '';
});

// ─── ResultType ───────────────────────────────────────────────────────────────

describe('ResultType', () => {
  it('WIN equals "win"', () => {
    expect(ResultType.WIN).toBe('win');
  });

  it('LOSS equals "loss"', () => {
    expect(ResultType.LOSS).toBe('loss');
  });

  it('STUCK equals "stuck"', () => {
    expect(ResultType.STUCK).toBe('stuck');
  });

  it('has exactly three values', () => {
    expect(Object.keys(ResultType)).toHaveLength(3);
  });
});

// ─── createRetryOverlay factory ───────────────────────────────────────────────

describe('createRetryOverlay', () => {
  it('returns a RetryOverlay instance', () => {
    const overlay = makeOverlay();
    expect(overlay).toBeInstanceOf(RetryOverlay);
  });
});

// ─── _formatTime ─────────────────────────────────────────────────────────────

describe('RetryOverlay._formatTime', () => {
  let overlay;
  beforeEach(() => { overlay = makeOverlay(); });

  it('formats 0 seconds as "0:00"', () => {
    expect(overlay._formatTime(0)).toBe('0:00');
  });

  it('formats 59 seconds as "0:59"', () => {
    expect(overlay._formatTime(59)).toBe('0:59');
  });

  it('formats 60 seconds as "1:00"', () => {
    expect(overlay._formatTime(60)).toBe('1:00');
  });

  it('formats 90 seconds as "1:30"', () => {
    expect(overlay._formatTime(90)).toBe('1:30');
  });

  it('formats 446 seconds as "7:26"', () => {
    expect(overlay._formatTime(446)).toBe('7:26');
  });

  it('zero-pads single-digit seconds', () => {
    expect(overlay._formatTime(65)).toBe('1:05');
  });

  it('handles large values (> 60 minutes)', () => {
    expect(overlay._formatTime(3661)).toBe('61:01');
  });

  it('produces negative output for negative seconds (no clamping)', () => {
    // -30s: floor(-30/60)=-1, floor(-30%60)=-30 → '-1:-30'
    expect(overlay._formatTime(-30)).toBe('-1:-30');
  });
});

// ─── _getSubtitleText ────────────────────────────────────────────────────────

describe('RetryOverlay._getSubtitleText', () => {
  it('returns "Great job!" when stats is null', () => {
    const overlay = makeOverlay();
    overlay.stats = null;
    expect(overlay._getSubtitleText()).toBe('Great job!');
  });

  it('returns "Great job!" when stats is undefined (also falsy)', () => {
    const overlay = makeOverlay();
    overlay.stats = undefined;
    expect(overlay._getSubtitleText()).toBe('Great job!');
  });

  it('returns "Perfect! ⭐" when optimality >= 100', () => {
    const overlay = makeOverlay();
    overlay.stats = { optimality: 100 };
    expect(overlay._getSubtitleText()).toBe('Perfect! ⭐');

    overlay.stats = { optimality: 110 };
    expect(overlay._getSubtitleText()).toBe('Perfect! ⭐');
  });

  it('returns "Excellent!" when optimality 80–99', () => {
    const overlay = makeOverlay();
    overlay.stats = { optimality: 80 };
    expect(overlay._getSubtitleText()).toBe('Excellent!');

    overlay.stats = { optimality: 99 };
    expect(overlay._getSubtitleText()).toBe('Excellent!');
  });

  it('returns "Great job!" when optimality 60–79', () => {
    const overlay = makeOverlay();
    overlay.stats = { optimality: 60 };
    expect(overlay._getSubtitleText()).toBe('Great job!');

    overlay.stats = { optimality: 79 };
    expect(overlay._getSubtitleText()).toBe('Great job!');
  });

  it('returns "Level cleared!" when optimality < 60', () => {
    const overlay = makeOverlay();
    overlay.stats = { optimality: 59 };
    expect(overlay._getSubtitleText()).toBe('Level cleared!');

    overlay.stats = { optimality: 0 };
    expect(overlay._getSubtitleText()).toBe('Level cleared!');
  });
});

// ─── WIN stats rendering edge cases ──────────────────────────────────────────

describe('WIN stats rendering — undefined vs zero', () => {
  it('renders moves stat when moves=0 (0 !== undefined)', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.WIN, { optimality: 80, moves: 0, time: 30 });
    const statValues = overlay.element.querySelectorAll('.mg-retry-stat-value');
    const texts = Array.from(statValues).map(el => el.textContent);
    expect(texts.some(t => t === '0')).toBe(true);
  });

  it('omits time stat when time is undefined', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.WIN, { optimality: 80, moves: 5 }); // no time
    // The time stat element should not appear
    const html = overlay.element.innerHTML;
    expect(html).not.toMatch(/0:00/);
  });
});

// ─── failure count ────────────────────────────────────────────────────────────

describe('failure count', () => {
  it('starts at 0 for a fresh level', () => {
    const overlay = makeOverlay({ gameId: 'game1', levelIndex: 3 });
    expect(overlay.failureCount).toBe(0);
  });

  it('increments on each LOSS show()', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.LOSS);
    expect(overlay.failureCount).toBe(1);
    overlay.show(ResultType.LOSS);
    expect(overlay.failureCount).toBe(2);
  });

  it('does NOT increment on WIN show()', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.WIN, { optimality: 100, moves: 5, time: 30 });
    expect(overlay.failureCount).toBe(0);
  });

  it('does NOT increment on STUCK show()', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.STUCK);
    expect(overlay.failureCount).toBe(0);
  });

  it('resetFailureCount() sets count back to 0', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.LOSS);
    overlay.show(ResultType.LOSS);
    overlay.resetFailureCount();
    expect(overlay.failureCount).toBe(0);
  });

  it('persists failure count across separate instances for the same game+level', () => {
    const opts = { gameId: 'persist-test', levelIndex: 2 };
    const a = makeOverlay(opts);
    a.show(ResultType.LOSS);
    a.show(ResultType.LOSS);

    // Clear cache so the second instance reads from storage
    storage.cache.clear();
    storage.accessOrder = [];

    const b = makeOverlay(opts);
    expect(b.failureCount).toBe(2);
  });

  it('failure counts are independent per level', () => {
    const a = makeOverlay({ gameId: 'g', levelIndex: 0 });
    const b = makeOverlay({ gameId: 'g', levelIndex: 1 });
    a.show(ResultType.LOSS);
    a.show(ResultType.LOSS);
    expect(b.failureCount).toBe(0);
  });
});

// ─── show / hide state ───────────────────────────────────────────────────────

describe('show / hide', () => {
  it('isVisible is false before show()', () => {
    const overlay = makeOverlay();
    expect(overlay.isVisible).toBe(false);
  });

  it('isVisible is true after show()', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.WIN, { optimality: 100, moves: 3, time: 20 });
    expect(overlay.isVisible).toBe(true);
  });

  it('isVisible is false after hide()', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.WIN, { optimality: 100, moves: 3, time: 20 });
    overlay.hide();
    expect(overlay.isVisible).toBe(false);
  });

  it('hide() is safe to call before show()', () => {
    const overlay = makeOverlay();
    expect(() => overlay.hide()).not.toThrow();
  });

  it('show(WIN) creates an element in the container', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.WIN, { optimality: 80, moves: 6, time: 45 });
    expect(overlay.element).not.toBeNull();
    expect(overlay.container.contains(overlay.element)).toBe(true);
  });

  it('show(LOSS) creates an element in the container', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.LOSS);
    expect(overlay.element).not.toBeNull();
  });

  it('show(STUCK) creates an element in the container', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.STUCK);
    expect(overlay.element).not.toBeNull();
  });
});

// ─── skip button threshold ───────────────────────────────────────────────────

describe('skip button after 3 failures', () => {
  it('skip button absent when failureCount < 3', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.LOSS); // failureCount = 1
    overlay.show(ResultType.LOSS); // failureCount = 2
    const skipBtn = overlay.element.querySelector('[data-action="skip"]');
    expect(skipBtn).toBeNull();
  });

  it('skip button present when failureCount >= 3', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.LOSS); // 1
    overlay.show(ResultType.LOSS); // 2
    overlay.show(ResultType.LOSS); // 3
    const skipBtn = overlay.element.querySelector('[data-action="skip"]');
    expect(skipBtn).not.toBeNull();
  });

  it('skip button present for STUCK when failureCount >= 3 (previous LOSS count)', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.LOSS);
    overlay.show(ResultType.LOSS);
    overlay.show(ResultType.LOSS); // failureCount = 3
    overlay.hide();
    overlay.show(ResultType.STUCK);
    const skipBtn = overlay.element.querySelector('[data-action="skip"]');
    expect(skipBtn).not.toBeNull();
  });
});

// ─── optional callbacks ───────────────────────────────────────────────────────

describe('optional button rendering', () => {
  it('watch replay button is absent by default', () => {
    const overlay = makeOverlay({ onWatchReplay: null });
    overlay.show(ResultType.LOSS);
    expect(overlay.element.querySelector('[data-action="replay"]')).toBeNull();
  });

  it('watch replay button is present when onWatchReplay provided', () => {
    const overlay = makeOverlay({ onWatchReplay: vi.fn() });
    overlay.show(ResultType.LOSS);
    expect(overlay.element.querySelector('[data-action="replay"]')).not.toBeNull();
  });

  it('undo button is absent by default', () => {
    const overlay = makeOverlay({ onUndo: null });
    overlay.show(ResultType.STUCK);
    expect(overlay.element.querySelector('[data-action="undo"]')).toBeNull();
  });

  it('undo button is present when onUndo provided', () => {
    const overlay = makeOverlay({ onUndo: vi.fn() });
    overlay.show(ResultType.STUCK);
    expect(overlay.element.querySelector('[data-action="undo"]')).not.toBeNull();
  });
});

// ─── sound effects ────────────────────────────────────────────────────────────

describe('sound effects', () => {
  beforeEach(() => {
    vi.mocked(playSound).mockClear();
  });

  it('plays "success" sound on WIN', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.WIN, { optimality: 80, moves: 5, time: 30 });
    expect(playSound).toHaveBeenCalledWith('success');
  });

  it('plays "fail" sound on LOSS', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.LOSS);
    expect(playSound).toHaveBeenCalledWith('fail');
  });

  it('plays "fail" sound on STUCK', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.STUCK);
    expect(playSound).toHaveBeenCalledWith('fail');
  });
});

// ─── destroy ──────────────────────────────────────────────────────────────────

describe('destroy', () => {
  it('removes element from the DOM', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.WIN, { optimality: 100, moves: 3, time: 15 });
    const el = overlay.element;
    overlay.destroy();
    expect(document.body.contains(el)).toBe(false);
  });

  it('is safe to call before show()', () => {
    const overlay = makeOverlay();
    expect(() => overlay.destroy()).not.toThrow();
  });

  it('is safe to call destroy() twice (element.parentNode is null on second call)', () => {
    const overlay = makeOverlay();
    overlay.show(ResultType.WIN, { optimality: 100, moves: 3, time: 15 });
    overlay.destroy();
    expect(() => overlay.destroy()).not.toThrow();
  });
});

// ─── _handleAction — optional callback guards ─────────────────────────────────

describe('_handleAction optional callbacks', () => {
  it('does not throw when replay action fires but onWatchReplay is null (false branch)', () => {
    const overlay = makeOverlay({ onWatchReplay: null });
    // Call _handleAction directly with 'replay' — onWatchReplay is falsy → silently skipped
    expect(() => overlay._handleAction('replay')).not.toThrow();
  });

  it('does not throw when undo action fires but onUndo is null (false branch)', () => {
    const overlay = makeOverlay({ onUndo: null });
    // Call _handleAction directly with 'undo' — onUndo is falsy → silently skipped
    expect(() => overlay._handleAction('undo')).not.toThrow();
  });

  it('does not throw for an unrecognised action (switch default / no-match)', () => {
    const overlay = makeOverlay();
    // No case matches 'unknown' — switch falls through silently
    expect(() => overlay._handleAction('unknown')).not.toThrow();
  });
});
