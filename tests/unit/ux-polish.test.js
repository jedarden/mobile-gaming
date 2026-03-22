/**
 * UX Polish — Unit Tests
 *
 * Covers: haptics.js, screen-shake.js, particles.js, color-blind.js
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
import { createScreenShake } from '../../src/shared/screen-shake.js';
import { createParticleSystem, PRESETS } from '../../src/shared/particles.js';
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

// ─── screen-shake.js ─────────────────────────────────────────────────────────

describe('createScreenShake', () => {
  it('returns trigger, update, isActive, reset', () => {
    const shake = createScreenShake();
    expect(typeof shake.trigger).toBe('function');
    expect(typeof shake.update).toBe('function');
    expect(typeof shake.isActive).toBe('function');
    expect(typeof shake.reset).toBe('function');
  });

  it('isActive() is false before any trigger', () => {
    const shake = createScreenShake();
    expect(shake.isActive()).toBe(false);
  });

  it('isActive() is true after trigger', () => {
    const shake = createScreenShake();
    shake.trigger(1, 200);
    expect(shake.isActive()).toBe(true);
  });

  it('update() returns { x: 0, y: 0 } when not active', () => {
    const shake = createScreenShake();
    expect(shake.update(16)).toEqual({ x: 0, y: 0 });
  });

  it('update() returns non-zero offsets while active', () => {
    const shake = createScreenShake({ maxAmplitude: 20 });
    shake.trigger(1, 500);
    const { x, y } = shake.update(16);
    // At full intensity with 20px amplitude, at least one axis should move
    const moved = Math.abs(x) > 0 || Math.abs(y) > 0;
    expect(moved).toBe(true);
  });

  it('update() returns integers', () => {
    const shake = createScreenShake();
    shake.trigger(1, 500);
    const { x, y } = shake.update(16);
    expect(Number.isInteger(x)).toBe(true);
    expect(Number.isInteger(y)).toBe(true);
  });

  it('shake decays to zero as remaining time runs out', () => {
    const shake = createScreenShake({ maxAmplitude: 12 });
    shake.trigger(1, 100);
    // Consume all 100ms
    for (let i = 0; i < 8; i++) shake.update(16);
    // Should be inactive now (100ms consumed)
    expect(shake.isActive()).toBe(false);
    expect(shake.update(16)).toEqual({ x: 0, y: 0 });
  });

  it('isActive() is false after remaining time consumed', () => {
    const shake = createScreenShake();
    shake.trigger(1, 50);
    shake.update(30);
    shake.update(30); // total 60ms > 50ms
    expect(shake.isActive()).toBe(false);
  });

  it('reset() stops the shake immediately', () => {
    const shake = createScreenShake();
    shake.trigger(1, 1000);
    shake.reset();
    expect(shake.isActive()).toBe(false);
    expect(shake.update(16)).toEqual({ x: 0, y: 0 });
  });

  it('trigger() clamps intensity to [0, 1]', () => {
    const shake = createScreenShake({ maxAmplitude: 10 });
    shake.trigger(5, 200); // intensity > 1
    shake.trigger(-1, 200); // intensity < 0
    // Should not throw and should remain functional
    const { x, y } = shake.update(16);
    expect(typeof x).toBe('number');
    expect(typeof y).toBe('number');
  });

  it('trigger() extends duration when called again with longer duration', () => {
    const shake = createScreenShake();
    shake.trigger(1, 100);
    shake.trigger(1, 500); // longer — should extend
    shake.update(100);     // consume first 100ms
    expect(shake.isActive()).toBe(true); // still has 400ms left
  });

  it('no-ops when prefers-reduced-motion is set', () => {
    // Mock matchMedia to return prefers-reduced-motion: reduce
    const original = window.matchMedia;
    window.matchMedia = vi.fn(q =>
      q === '(prefers-reduced-motion: reduce)'
        ? { matches: true }
        : { matches: false }
    );
    const shake = createScreenShake();
    shake.trigger(1, 500);
    expect(shake.isActive()).toBe(false);
    window.matchMedia = original;
  });
});

// ─── particles.js ─────────────────────────────────────────────────────────────

/**
 * Minimal Canvas 2D context mock — only what particles.js calls.
 */
function createMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  };
}

describe('particles.js — PRESETS', () => {
  it('has confetti, sparkle, splash presets', () => {
    expect(PRESETS).toHaveProperty('confetti');
    expect(PRESETS).toHaveProperty('sparkle');
    expect(PRESETS).toHaveProperty('splash');
  });

  it('each preset has required fields', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      expect(preset, `${name}.count`).toHaveProperty('count');
      expect(preset, `${name}.speed`).toHaveProperty('speed');
      expect(preset, `${name}.life`).toHaveProperty('life');
      expect(preset, `${name}.colors`).toHaveProperty('colors');
      expect(preset.colors.length, `${name} colors`).toBeGreaterThan(0);
    }
  });
});

describe('createParticleSystem', () => {
  let ctx;
  let ps;

  beforeEach(() => {
    ctx = createMockCtx();
    ps = createParticleSystem(ctx, 400, 600);
  });

  it('returns spawn, update, render, clear, getActiveCount, isEmpty', () => {
    expect(typeof ps.spawn).toBe('function');
    expect(typeof ps.update).toBe('function');
    expect(typeof ps.render).toBe('function');
    expect(typeof ps.clear).toBe('function');
    expect(typeof ps.getActiveCount).toBe('function');
    expect(typeof ps.isEmpty).toBe('function');
  });

  it('starts empty', () => {
    expect(ps.isEmpty()).toBe(true);
    expect(ps.getActiveCount()).toBe(0);
  });

  it('spawn() increases active count', () => {
    ps.spawn('sparkle', 100, 100);
    expect(ps.getActiveCount()).toBeGreaterThan(0);
    expect(ps.isEmpty()).toBe(false);
  });

  it('spawn() with confetti adds particles', () => {
    ps.spawn('confetti', 200, 50);
    expect(ps.getActiveCount()).toBeGreaterThan(0);
  });

  it('spawn() with splash adds particles', () => {
    ps.spawn('splash', 200, 300);
    expect(ps.getActiveCount()).toBeGreaterThan(0);
  });

  it('countOverride limits particles spawned', () => {
    ps.spawn('confetti', 100, 100, 5);
    expect(ps.getActiveCount()).toBe(5);
  });

  it('spawn() ignores unknown type gracefully', () => {
    ps.spawn('unknown_type', 100, 100);
    expect(ps.getActiveCount()).toBe(0);
  });

  it('update() reduces count as particles expire', () => {
    ps.spawn('sparkle', 100, 100, 10);
    const initial = ps.getActiveCount();
    // Advance past maximum life of sparkle (650ms)
    ps.update(700);
    expect(ps.getActiveCount()).toBeLessThan(initial);
    // After sufficient time all should be dead
    expect(ps.getActiveCount()).toBe(0);
  });

  it('update() moves active particles', () => {
    // Can't directly inspect positions, but update should not throw
    ps.spawn('confetti', 200, 200, 3);
    expect(() => ps.update(16)).not.toThrow();
    expect(() => ps.update(16)).not.toThrow();
  });

  it('render() calls ctx.save/restore per active particle', () => {
    ps.spawn('sparkle', 100, 100, 3);
    ps.render();
    expect(ctx.save).toHaveBeenCalledTimes(3);
    expect(ctx.restore).toHaveBeenCalledTimes(3);
  });

  it('render() is safe with null ctx', () => {
    const noCtxPs = createParticleSystem(null, 400, 600);
    noCtxPs.spawn('sparkle', 100, 100, 3);
    expect(() => noCtxPs.render()).not.toThrow();
  });

  it('clear() removes all particles', () => {
    ps.spawn('confetti', 200, 200);
    ps.clear();
    expect(ps.isEmpty()).toBe(true);
    expect(ps.getActiveCount()).toBe(0);
  });

  it('no particles spawned when prefers-reduced-motion is set', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn(q =>
      q === '(prefers-reduced-motion: reduce)'
        ? { matches: true }
        : { matches: false }
    );
    ps.spawn('confetti', 200, 200);
    expect(ps.getActiveCount()).toBe(0);
    window.matchMedia = original;
  });

  it('pool exhaustion: stops allocating at pool capacity without throwing', () => {
    // Spawn many particles — should not throw even if pool is full
    for (let i = 0; i < 20; i++) {
      ps.spawn('confetti', 100, 100, 20);
    }
    expect(ps.getActiveCount()).toBeLessThanOrEqual(256); // POOL_SIZE
    expect(ps.getActiveCount()).toBeGreaterThan(0);
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
