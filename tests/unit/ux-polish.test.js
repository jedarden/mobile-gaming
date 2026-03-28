/**
 * UX Polish — Unit Tests
 *
 * Covers: haptics.js, color-blind.js
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock StorageManager ───────────────────────────────────────────────────────

let _store = {};

vi.mock('../../src/shared/storage.js', () => ({
  StorageManager: class MockStorageManager {
    get(key, def = null) {
      return key in _store ? _store[key] : def;
    }
    set(key, val) {
      _store[key] = val;
      return true;
    }
  },
}));

import { haptic, isHapticEnabled, PATTERNS } from '../../src/shared/haptics.js';
import {
  isColorBlindEnabled,
  applyColorBlindClass,
  removeColorBlindClass,
  syncColorBlindClass,
  getPatternLabel,
  injectPatternDefs,
  removePatternDefs,
  COLOR_PATTERNS,
} from '../../src/shared/color-blind.js';

// ─── haptics.js ───────────────────────────────────────────────────────────────

describe('haptics — isHapticEnabled', () => {
  beforeEach(() => { _store = {}; });

  it('returns true with no stored settings (default)', () => {
    expect(isHapticEnabled()).toBe(true);
  });

  it('reads haptic from global:settings', () => {
    _store['global:settings'] = { haptic: false };
    expect(isHapticEnabled()).toBe(false);
  });

  it('falls back to legacy settings key', () => {
    _store['settings'] = { hapticEnabled: false };
    expect(isHapticEnabled()).toBe(false);
  });

  it('global:settings takes precedence over legacy', () => {
    _store['global:settings'] = { haptic: true };
    _store['settings'] = { hapticEnabled: false };
    expect(isHapticEnabled()).toBe(true);
  });
});

describe('haptics — PATTERNS', () => {
  it('has entries for all expected events', () => {
    for (const name of ['tap', 'collect', 'merge', 'pin_pull', 'win', 'boss_defeat', 'fail', 'error', 'level_start']) {
      expect(PATTERNS).toHaveProperty(name);
    }
  });

  it('win pattern is an array (multi-pulse)', () => {
    expect(Array.isArray(PATTERNS.win)).toBe(true);
    expect(PATTERNS.win.length).toBeGreaterThan(1);
  });

  it('tap pattern is a single number', () => {
    expect(typeof PATTERNS.tap).toBe('number');
  });
});

describe('haptics — haptic()', () => {
  let vibrateMock;

  beforeEach(() => {
    _store = {};
    vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls navigator.vibrate with the correct pattern', () => {
    haptic('tap');
    expect(vibrateMock).toHaveBeenCalledWith(PATTERNS.tap);
  });

  it('calls navigator.vibrate with win pattern', () => {
    haptic('win');
    expect(vibrateMock).toHaveBeenCalledWith(PATTERNS.win);
  });

  it('falls back to tap pattern for unknown name', () => {
    haptic('unknown_event');
    expect(vibrateMock).toHaveBeenCalledWith(PATTERNS.tap);
  });

  it('accepts a raw number directly', () => {
    haptic(50);
    expect(vibrateMock).toHaveBeenCalledWith(50);
  });

  it('accepts a raw array directly', () => {
    haptic([10, 20, 10]);
    expect(vibrateMock).toHaveBeenCalledWith([10, 20, 10]);
  });

  it('does nothing when haptic is disabled in settings', () => {
    _store['global:settings'] = { haptic: false };
    haptic('win');
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it('does nothing when navigator.vibrate is unavailable', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      configurable: true,
    });
    // Should not throw
    expect(() => haptic('win')).not.toThrow();
  });
});

// ─── color-blind.js ───────────────────────────────────────────────────────────

describe('color-blind — isColorBlindEnabled', () => {
  beforeEach(() => { _store = {}; });

  it('returns false by default', () => {
    expect(isColorBlindEnabled()).toBe(false);
  });

  it('reads from global:settings.colorBlind', () => {
    _store['global:settings'] = { colorBlind: true };
    expect(isColorBlindEnabled()).toBe(true);
  });

  it('reads from legacy settings.colorBlind', () => {
    _store['settings'] = { colorBlind: true };
    expect(isColorBlindEnabled()).toBe(true);
  });

  it('global:settings takes precedence over legacy', () => {
    _store['global:settings'] = { colorBlind: false };
    _store['settings'] = { colorBlind: true };
    expect(isColorBlindEnabled()).toBe(false);
  });
});

describe('color-blind — body class', () => {
  beforeEach(() => {
    document.body.className = '';
  });

  it('applyColorBlindClass adds class to body', () => {
    applyColorBlindClass();
    expect(document.body.classList.contains('color-blind-mode')).toBe(true);
  });

  it('applyColorBlindClass is idempotent', () => {
    applyColorBlindClass();
    applyColorBlindClass();
    expect(document.body.className.split(' ').filter(c => c === 'color-blind-mode').length).toBe(1);
  });

  it('removeColorBlindClass removes class', () => {
    document.body.classList.add('color-blind-mode');
    removeColorBlindClass();
    expect(document.body.classList.contains('color-blind-mode')).toBe(false);
  });

  it('syncColorBlindClass adds class when setting is enabled', () => {
    _store['global:settings'] = { colorBlind: true };
    syncColorBlindClass();
    expect(document.body.classList.contains('color-blind-mode')).toBe(true);
  });

  it('syncColorBlindClass removes class when setting is disabled', () => {
    document.body.classList.add('color-blind-mode');
    _store['global:settings'] = { colorBlind: false };
    syncColorBlindClass();
    expect(document.body.classList.contains('color-blind-mode')).toBe(false);
  });
});

describe('color-blind — getPatternLabel', () => {
  it('returns a string for known colors', () => {
    for (const name of Object.keys(COLOR_PATTERNS)) {
      const label = getPatternLabel(name);
      expect(typeof label, `label for ${name}`).toBe('string');
      expect(label.length, `label length for ${name}`).toBeGreaterThan(0);
    }
  });

  it('returns null for unknown color', () => {
    expect(getPatternLabel('fuchsia')).toBeNull();
  });

  it('red uses / pattern', () => {
    expect(getPatternLabel('red')).toBe('/');
  });

  it('blue uses · pattern', () => {
    expect(getPatternLabel('blue')).toBe('·');
  });
});

describe('color-blind — SVG pattern injection', () => {
  function makeSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);
    return svg;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('injectPatternDefs creates a <defs> block', () => {
    const svg = makeSvg();
    injectPatternDefs(svg);
    expect(svg.querySelector('defs')).not.toBeNull();
  });

  it('injectPatternDefs adds patterns for all known colors', () => {
    const svg = makeSvg();
    injectPatternDefs(svg);
    const defs = svg.querySelector('defs');
    for (const name of Object.keys(COLOR_PATTERNS)) {
      expect(defs.querySelector(`#cb-${name}`), `#cb-${name}`).not.toBeNull();
    }
  });

  it('injectPatternDefs is idempotent (re-inject overwrites, no duplicates)', () => {
    const svg = makeSvg();
    injectPatternDefs(svg);
    injectPatternDefs(svg);
    const defs = svg.querySelector('defs');
    const allPatterns = defs.querySelectorAll('pattern');
    const ids = Array.from(allPatterns).map(p => p.id);
    // No duplicate IDs
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('removePatternDefs removes cb- patterns', () => {
    const svg = makeSvg();
    injectPatternDefs(svg);
    removePatternDefs(svg);
    const defs = svg.querySelector('defs');
    if (defs) {
      for (const name of Object.keys(COLOR_PATTERNS)) {
        expect(defs.querySelector(`#cb-${name}`), `#cb-${name} should be gone`).toBeNull();
      }
    }
  });

  it('injectPatternDefs is safe with null argument', () => {
    expect(() => injectPatternDefs(null)).not.toThrow();
  });

  it('removePatternDefs is safe with null argument', () => {
    expect(() => removePatternDefs(null)).not.toThrow();
  });

  it('pattern IDs are prefixed with cb-', () => {
    const svg = makeSvg();
    injectPatternDefs(svg);
    const patterns = svg.querySelectorAll('pattern');
    for (const p of patterns) {
      expect(p.id).toMatch(/^cb-/);
    }
  });
});
