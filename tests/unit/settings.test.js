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

// ─── Mock audio ───────────────────────────────────────────────────────────────

vi.mock('../../src/shared/audio.js', () => ({
  playSound: vi.fn(),
  playTap:   vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  createSettings,
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

  it('returns fallback false when matchMedia is not a function (typeof !== function branch)', () => {
    setSetting('darkMode', null);
    const orig = window.matchMedia;
    window.matchMedia = 'not-a-function';
    expect(isDarkMode()).toBe(false);
    window.matchMedia = orig;
  });

  it('returns truthy value when matchMedia.matches is truthy non-boolean (e.g., 1)', () => {
    setSetting('darkMode', null);
    const orig = window.matchMedia;
    window.matchMedia = vi.fn(() => ({ matches: 1 }));
    expect(isDarkMode()).toBeTruthy();
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

  it('returns fallback false when matchMedia is not a function (typeof !== function branch)', () => {
    setSetting('reducedMotion', null);
    const orig = window.matchMedia;
    window.matchMedia = undefined;
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

// ─── createSettings — destroy() parentNode null branch ───────────────────────

describe('createSettings — destroy() parentNode guards', () => {
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; });

  it('does not throw when destroy() is called twice (parentNode null on second call — all three if-guards false)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container });
    inst.destroy(); // removes gear, backdrop, drawer — parentNode becomes null
    expect(() => inst.destroy()).not.toThrow(); // second call: all parentNode checks are false
  });
});

// ─── createSettings — sync-import if(code && onSyncImport) branches ──────────

describe('createSettings — sync-import button', () => {
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; vi.unstubAllGlobals(); });

  it('calls onSyncImport with prompt value when code is truthy (if true branch)', () => {
    vi.stubGlobal('prompt', vi.fn(() => 'TESTCODE'));
    const onSyncImport = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container, onSyncImport });
    inst.show(); // builds content with event handlers
    inst.drawer.querySelector('[data-action="sync-import"]').click();
    expect(onSyncImport).toHaveBeenCalledWith('TESTCODE');
  });

  it('does not call onSyncImport when prompt returns null (code is falsy — if false branch)', () => {
    vi.stubGlobal('prompt', vi.fn(() => null));
    const onSyncImport = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container, onSyncImport });
    inst.show();
    inst.drawer.querySelector('[data-action="sync-import"]').click();
    expect(onSyncImport).not.toHaveBeenCalled();
  });

  it('does not throw when code is truthy but onSyncImport is not provided (if false branch — onSyncImport falsy)', () => {
    vi.stubGlobal('prompt', vi.fn(() => 'TESTCODE'));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container }); // no onSyncImport
    inst.show();
    expect(() => inst.drawer.querySelector('[data-action="sync-import"]').click()).not.toThrow();
  });
});

// ─── createSettings — sync-export if(onSyncExport) branch ────────────────────

describe('createSettings — sync-export button', () => {
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; });

  it('calls onSyncExport when provided and sync-export button is clicked (if true branch)', () => {
    const onSyncExport = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container, onSyncExport });
    inst.show();
    inst.drawer.querySelector('[data-action="sync-export"]').click();
    expect(onSyncExport).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onSyncExport is not provided (if false branch)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container }); // no onSyncExport
    inst.show();
    expect(() => inst.drawer.querySelector('[data-action="sync-export"]').click()).not.toThrow();
  });
});

// ─── createSettings — onSettingsChange omitted (if false branch) ──────────────

describe('createSettings — onSettingsChange omitted (if false branch)', () => {
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; });

  it('does not throw when toggle changes without onSettingsChange callback (if false branch)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container }); // no onSettingsChange
    inst.show();

    const toggle = inst.drawer.querySelector('input[data-setting]');
    expect(() => {
      if (toggle) toggle.dispatchEvent(new Event('change', { bubbles: true }));
    }).not.toThrow();
  });
});

// ─── createSettings — onSettingsChange provided (if true branch) ─────────────

describe('createSettings — onSettingsChange provided (if true branch)', () => {
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; });

  it('calls onSettingsChange with updated settings when a toggle changes (if true branch)', () => {
    const onSettingsChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container, onSettingsChange });
    inst.show();

    const toggle = inst.drawer.querySelector('input[data-setting]');
    if (toggle) toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSettingsChange).toHaveBeenCalledTimes(1);
    // Called with the current settings object
    expect(typeof onSettingsChange.mock.calls[0][0]).toBe('object');
  });
});

// ─── createSettings — onDevMode omitted (if false branch) ────────────────────

describe('createSettings — onDevMode omitted (if false branch)', () => {
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; vi.useRealTimers(); });

  it('does not throw on triple version tap without onDevMode callback (if false branch)', () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container }); // no onDevMode
    inst.show();

    const versionEl = inst.drawer.querySelector('[data-action="version"]');
    expect(() => {
      if (versionEl) {
        versionEl.click();
        versionEl.click();
        versionEl.click();
      }
    }).not.toThrow();
  });
});

// ─── createSettings — onDevMode provided (if true branch) ────────────────────

describe('createSettings — onDevMode provided (if true branch)', () => {
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; vi.useRealTimers(); });

  it('calls onDevMode on triple version tap when callback is provided (if true branch)', () => {
    vi.useFakeTimers();
    const onDevMode = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container, onDevMode });
    inst.show();

    const versionEl = inst.drawer.querySelector('[data-action="version"]');
    if (versionEl) {
      versionEl.click();
      versionEl.click();
      versionEl.click();
    }
    expect(onDevMode).toHaveBeenCalledTimes(1);
  });
});

// ─── triggerHaptic — haptic disabled early return ─────────────────────────────

describe('createSettings — triggerHaptic() with haptic=false (if(!settings.haptic) true branch)', () => {
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; storage.cache.clear(); storage.accessOrder = []; });

  it('show() does not throw when haptic setting is false (early-return branch)', () => {
    setSetting('haptic', false);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container });
    expect(() => inst.show()).not.toThrow();
  });
});

// ─── triggerHaptic — navigator.vibrate true branch and catch ─────────────────

describe('createSettings — triggerHaptic() navigator.vibrate branches', () => {
  afterEach(() => {
    cleanupAll();
    document.body.innerHTML = '';
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true, writable: true });
  });

  it('calls navigator.vibrate(10) when vibrate is available and haptic is enabled (if true branch)', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container });
    inst.show(); // calls triggerHaptic() → if(navigator.vibrate) → vibrate(10)
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it('does not throw when navigator.vibrate throws (catch block)', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(() => { throw new Error('Vibrate unavailable'); }),
      configurable: true, writable: true,
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container });
    expect(() => inst.show()).not.toThrow();
  });

  it('does not throw when navigator.vibrate is undefined (if(navigator.vibrate) false branch)', () => {
    // navigator.vibrate is already undefined (set by afterEach) — haptic is enabled (default=true)
    // triggerHaptic() → if(!settings.haptic) skipped → try { if(navigator.vibrate) } → false → no-op
    expect(navigator.vibrate).toBeUndefined();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = createSettings({ container });
    expect(() => inst.show()).not.toThrow();
  });
});
