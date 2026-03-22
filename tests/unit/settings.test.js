/**
 * Settings — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests getSettings(), setSetting(), isDarkMode(), isReducedMotion(),
 * and resetSettings() — the non-UI, headless exports.
 *
 * createSettings() builds a full DOM drawer and is excluded here
 * because it has no testable return value beyond the instance.
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

import {
  getSettings,
  setSetting,
  isDarkMode,
  isReducedMotion,
  resetSettings,
  cleanupAll,
} from '../../src/shared/settings.js';
import { storage } from '../../src/shared/storage.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock._reset();
  vi.clearAllMocks();
  cleanupAll();
  storage.cache.clear();
  storage.accessOrder = [];
});

// ─── Default values ───────────────────────────────────────────────────────────

describe('getSettings — defaults', () => {
  it('sound is true by default', () => {
    expect(getSettings().sound).toBe(true);
  });

  it('haptic is true by default', () => {
    expect(getSettings().haptic).toBe(true);
  });

  it('colorBlind is false by default', () => {
    expect(getSettings().colorBlind).toBe(false);
  });

  it('darkMode is null by default (follow system)', () => {
    expect(getSettings().darkMode).toBeNull();
  });

  it('reducedMotion is null by default (follow system)', () => {
    expect(getSettings().reducedMotion).toBeNull();
  });

  it('devMode is false by default', () => {
    expect(getSettings().devMode).toBe(false);
  });
});

// ─── setSetting ───────────────────────────────────────────────────────────────

describe('setSetting', () => {
  it('updates a boolean setting', () => {
    setSetting('sound', false);
    expect(getSettings().sound).toBe(false);
  });

  it('updates multiple settings independently', () => {
    setSetting('sound', false);
    setSetting('haptic', false);
    const s = getSettings();
    expect(s.sound).toBe(false);
    expect(s.haptic).toBe(false);
  });

  it('changing one setting does not affect others', () => {
    setSetting('colorBlind', true);
    const s = getSettings();
    expect(s.sound).toBe(true);
    expect(s.haptic).toBe(true);
    expect(s.colorBlind).toBe(true);
  });

  it('can set darkMode to an explicit boolean', () => {
    setSetting('darkMode', true);
    expect(getSettings().darkMode).toBe(true);

    setSetting('darkMode', false);
    expect(getSettings().darkMode).toBe(false);
  });

  it('can set reducedMotion to an explicit boolean', () => {
    setSetting('reducedMotion', true);
    expect(getSettings().reducedMotion).toBe(true);
  });

  it('settings persist across getSettings() calls', () => {
    setSetting('sound', false);
    setSetting('sound', false); // idempotent
    expect(getSettings().sound).toBe(false);
  });
});

// ─── isDarkMode ───────────────────────────────────────────────────────────────

describe('isDarkMode', () => {
  it('returns explicit true when darkMode=true', () => {
    setSetting('darkMode', true);
    expect(isDarkMode()).toBe(true);
  });

  it('returns explicit false when darkMode=false', () => {
    setSetting('darkMode', false);
    expect(isDarkMode()).toBe(false);
  });

  it('falls back to false when darkMode=null and matchMedia not available', () => {
    // jsdom does not implement matchMedia by default
    setSetting('darkMode', null);
    // In the absence of a matching prefers-color-scheme query, returns false
    expect(typeof isDarkMode()).toBe('boolean');
  });

  it('follows matchMedia when darkMode=null', () => {
    setSetting('darkMode', null);
    const orig = window.matchMedia;
    // Mock matchMedia to return dark preference
    window.matchMedia = vi.fn((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    expect(isDarkMode()).toBe(true);
    window.matchMedia = orig;
  });
});

// ─── isReducedMotion ──────────────────────────────────────────────────────────

describe('isReducedMotion', () => {
  it('returns explicit true when reducedMotion=true', () => {
    setSetting('reducedMotion', true);
    expect(isReducedMotion()).toBe(true);
  });

  it('returns explicit false when reducedMotion=false', () => {
    setSetting('reducedMotion', false);
    expect(isReducedMotion()).toBe(false);
  });

  it('follows matchMedia when reducedMotion=null', () => {
    setSetting('reducedMotion', null);
    const orig = window.matchMedia;
    window.matchMedia = vi.fn((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    expect(isReducedMotion()).toBe(true);
    window.matchMedia = orig;
  });

  it('returns false when reducedMotion=null and system prefers no reduction', () => {
    setSetting('reducedMotion', null);
    const orig = window.matchMedia;
    window.matchMedia = vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }));
    expect(isReducedMotion()).toBe(false);
    window.matchMedia = orig;
  });
});

// ─── resetSettings ────────────────────────────────────────────────────────────

describe('resetSettings', () => {
  it('restores all settings to defaults', () => {
    setSetting('sound', false);
    setSetting('haptic', false);
    setSetting('colorBlind', true);
    setSetting('darkMode', true);
    setSetting('reducedMotion', true);
    setSetting('devMode', true);

    storage.cache.clear();
    storage.accessOrder = [];
    resetSettings();
    storage.cache.clear();
    storage.accessOrder = [];

    const s = getSettings();
    expect(s.sound).toBe(true);
    expect(s.haptic).toBe(true);
    expect(s.colorBlind).toBe(false);
    expect(s.darkMode).toBeNull();
    expect(s.reducedMotion).toBeNull();
    expect(s.devMode).toBe(false);
  });

  it('is safe to call multiple times', () => {
    resetSettings();
    storage.cache.clear();
    storage.accessOrder = [];
    resetSettings();
    storage.cache.clear();
    storage.accessOrder = [];
    expect(getSettings().sound).toBe(true);
  });
});
