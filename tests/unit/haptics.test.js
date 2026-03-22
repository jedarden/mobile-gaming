/**
 * Haptics — Unit Tests
 *
 * Tests PATTERNS object, isHapticEnabled() storage resolution,
 * and haptic() vibration dispatch.
 *
 * storage.js is mocked with vi.hoisted so hapticEnabled can be
 * flipped per-test without touching the real LRU cache.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mutable state (available inside vi.mock factory) ─────────────────

const state = vi.hoisted(() => ({ hapticEnabled: true }));

// ─── Mock storage so isHapticEnabled() is controllable ───────────────────────

vi.mock('../../src/shared/storage.js', () => ({
  StorageManager: vi.fn().mockImplementation(() => ({
    get: vi.fn((key) => {
      if (key === 'global:settings') return { haptic: state.hapticEnabled };
      return null;
    }),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  storage: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { PATTERNS, isHapticEnabled, haptic } from '../../src/shared/haptics.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  state.hapticEnabled = true;
  vi.clearAllMocks();
  Object.defineProperty(globalThis, 'navigator', {
    value: { vibrate: vi.fn() },
    configurable: true,
    writable: true,
  });
});

// ─── PATTERNS ─────────────────────────────────────────────────────────────────

describe('PATTERNS', () => {
  it('tap is a single number (short pulse)', () => {
    expect(typeof PATTERNS.tap).toBe('number');
    expect(PATTERNS.tap).toBeGreaterThan(0);
  });

  it('win is an array with multiple durations', () => {
    expect(Array.isArray(PATTERNS.win)).toBe(true);
    expect(PATTERNS.win.length).toBeGreaterThan(1);
  });

  it('fail is an array', () => {
    expect(Array.isArray(PATTERNS.fail)).toBe(true);
    expect(PATTERNS.fail.length).toBeGreaterThan(0);
  });

  it('merge is an array (alternating vibrate/pause)', () => {
    expect(Array.isArray(PATTERNS.merge)).toBe(true);
  });

  it('defines all named patterns', () => {
    const names = ['tap', 'collect', 'merge', 'pin_pull', 'win', 'boss_defeat', 'fail', 'error', 'level_start'];
    for (const name of names) {
      expect(PATTERNS[name], name).toBeDefined();
    }
  });

  it('all array patterns contain only positive numbers', () => {
    for (const [name, pat] of Object.entries(PATTERNS)) {
      if (Array.isArray(pat)) {
        for (const ms of pat) {
          expect(ms, `${name}: ${ms}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ─── isHapticEnabled ──────────────────────────────────────────────────────────

describe('isHapticEnabled', () => {
  it('returns true when haptic setting is true', () => {
    state.hapticEnabled = true;
    expect(isHapticEnabled()).toBe(true);
  });

  it('returns false when haptic setting is false', () => {
    state.hapticEnabled = false;
    expect(isHapticEnabled()).toBe(false);
  });
});

// ─── haptic ───────────────────────────────────────────────────────────────────

describe('haptic', () => {
  it('calls navigator.vibrate with the named pattern', () => {
    haptic('win');
    expect(globalThis.navigator.vibrate).toHaveBeenCalledWith(PATTERNS.win);
  });

  it('calls navigator.vibrate with tap by default (no argument)', () => {
    haptic();
    expect(globalThis.navigator.vibrate).toHaveBeenCalledWith(PATTERNS.tap);
  });

  it('falls back to tap pattern for unknown names', () => {
    haptic('totally_unknown_xyz');
    expect(globalThis.navigator.vibrate).toHaveBeenCalledWith(PATTERNS.tap);
  });

  it('passes a custom number directly to vibrate', () => {
    haptic(100);
    expect(globalThis.navigator.vibrate).toHaveBeenCalledWith(100);
  });

  it('passes a custom array directly to vibrate', () => {
    const custom = [30, 50, 30];
    haptic(custom);
    expect(globalThis.navigator.vibrate).toHaveBeenCalledWith(custom);
  });

  it('dispatches all named patterns correctly', () => {
    const names = ['tap', 'collect', 'merge', 'pin_pull', 'fail', 'error', 'level_start'];
    for (const name of names) {
      vi.clearAllMocks();
      haptic(name);
      expect(globalThis.navigator.vibrate).toHaveBeenCalledWith(PATTERNS[name]);
    }
  });

  it('is a no-op when haptics are disabled', () => {
    state.hapticEnabled = false;
    haptic('tap');
    expect(globalThis.navigator.vibrate).not.toHaveBeenCalled();
  });

  it('is a no-op when navigator.vibrate is unavailable', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    });
    expect(() => haptic('tap')).not.toThrow();
  });

  it('is a no-op when navigator is undefined', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(() => haptic('tap')).not.toThrow();
  });
});
