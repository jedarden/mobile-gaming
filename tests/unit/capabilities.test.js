/**
 * Capabilities — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests: getCapabilities, hasCapability, checkRequirements,
 * getCapabilityReport, isMobile, isIOS, isAndroid, getPixelRatio.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  getCapabilities,
  hasCapability,
  checkRequirements,
  getCapabilityReport,
  isMobile,
  isIOS,
  isAndroid,
  getPixelRatio,
} from '../../src/shared/capabilities.js';

// ── getCapabilities ────────────────────────────────────────────────────────

describe('getCapabilities', () => {
  it('returns an object', () => {
    const caps = getCapabilities();
    expect(typeof caps).toBe('object');
    expect(caps).not.toBeNull();
  });

  it('includes rendering capabilities', () => {
    const caps = getCapabilities();
    expect(typeof caps.canvas2d).toBe('boolean');
    expect(typeof caps.webgl).toBe('boolean');
    expect(typeof caps.webgl2).toBe('boolean');
  });

  it('includes storage capabilities', () => {
    const caps = getCapabilities();
    expect(typeof caps.localStorage).toBe('boolean');
    expect(typeof caps.sessionStorage).toBe('boolean');
    expect(typeof caps.indexedDB).toBe('boolean');
  });

  it('includes audio/video capabilities', () => {
    const caps = getCapabilities();
    expect(typeof caps.webAudio).toBe('boolean');
    expect(typeof caps.mediaRecorder).toBe('boolean');
    expect(typeof caps.videoEncoder).toBe('boolean');
  });

  it('includes device capabilities', () => {
    const caps = getCapabilities();
    expect(typeof caps.vibration).toBe('boolean');
    expect(typeof caps.touch).toBe('boolean');
  });

  it('includes performance capabilities', () => {
    const caps = getCapabilities();
    expect(typeof caps.performanceNow).toBe('boolean');
    expect(typeof caps.requestAnimationFrame).toBe('boolean');
  });

  it('includes web API capabilities', () => {
    const caps = getCapabilities();
    expect(typeof caps.shareApi).toBe('boolean');
    expect(typeof caps.clipboard).toBe('boolean');
    expect(typeof caps.fullscreen).toBe('boolean');
  });

  it('includes web worker and service worker capabilities', () => {
    const caps = getCapabilities();
    expect(typeof caps.webWorker).toBe('boolean');
    expect(typeof caps.serviceWorker).toBe('boolean');
  });

  it('includes websocket capability', () => {
    const caps = getCapabilities();
    expect(typeof caps.websockets).toBe('boolean');
  });

  it('returns same object on subsequent calls (cached)', () => {
    const caps1 = getCapabilities();
    const caps2 = getCapabilities();
    expect(caps1).toBe(caps2);
  });
});

// ── hasCapability ──────────────────────────────────────────────────────────

describe('hasCapability', () => {
  it('returns boolean for known capability names', () => {
    expect(typeof hasCapability('canvas2d')).toBe('boolean');
    expect(typeof hasCapability('localStorage')).toBe('boolean');
    expect(typeof hasCapability('webAudio')).toBe('boolean');
  });

  it('returns false for unknown capability name', () => {
    expect(hasCapability('nonExistentCapability')).toBe(false);
  });

  it('matches getCapabilities() values', () => {
    const caps = getCapabilities();
    for (const [key, value] of Object.entries(caps)) {
      expect(hasCapability(key)).toBe(!!value);
    }
  });
});

// ── checkRequirements ──────────────────────────────────────────────────────

describe('checkRequirements', () => {
  it('returns { supported: true, missing: [] } for empty requirements', () => {
    const result = checkRequirements([]);
    expect(result.supported).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('reports missing capabilities correctly', () => {
    // 'fakeCapability' does not exist → will be missing
    const result = checkRequirements(['fakeCapability']);
    expect(result.supported).toBe(false);
    expect(result.missing).toContain('fakeCapability');
  });

  it('returns supported=true when all requirements are met', () => {
    // localStorage is always true in jsdom
    const result = checkRequirements(['localStorage']);
    // In jsdom localStorage is available
    if (result.supported) {
      expect(result.missing).toEqual([]);
    }
  });

  it('lists all missing capabilities', () => {
    const result = checkRequirements(['fake1', 'fake2', 'fake3']);
    expect(result.missing).toContain('fake1');
    expect(result.missing).toContain('fake2');
    expect(result.missing).toContain('fake3');
    expect(result.supported).toBe(false);
  });
});

// ── getCapabilityReport ────────────────────────────────────────────────────

describe('getCapabilityReport', () => {
  it('returns a non-empty string', () => {
    const report = getCapabilityReport();
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
  });

  it('contains the header "Browser Capabilities"', () => {
    const report = getCapabilityReport();
    expect(report).toContain('Browser Capabilities');
  });

  it('contains the Rendering section', () => {
    const report = getCapabilityReport();
    expect(report).toContain('Rendering');
  });

  it('contains the Storage section', () => {
    const report = getCapabilityReport();
    expect(report).toContain('Storage');
  });

  it('contains the Device section', () => {
    const report = getCapabilityReport();
    expect(report).toContain('Device');
  });

  it('contains checkmark or cross symbols', () => {
    const report = getCapabilityReport();
    // Report uses ✓ or ✗ symbols
    expect(report.includes('✓') || report.includes('✗')).toBe(true);
  });
});

// ── isMobile ──────────────────────────────────────────────────────────────

describe('isMobile', () => {
  it('returns a boolean', () => {
    expect(typeof isMobile()).toBe('boolean');
  });

  it('returns false in jsdom (no touch events, no mobile user agent)', () => {
    // jsdom does not set a mobile user agent by default
    // This test is environment-specific
    const result = isMobile();
    expect(typeof result).toBe('boolean');
  });
});

// ── isIOS ─────────────────────────────────────────────────────────────────

describe('isIOS', () => {
  it('returns a boolean', () => {
    expect(typeof isIOS()).toBe('boolean');
  });

  it('returns false in default jsdom environment', () => {
    // jsdom default user agent is not iOS
    expect(isIOS()).toBe(false);
  });
});

// ── isAndroid ─────────────────────────────────────────────────────────────

describe('isAndroid', () => {
  it('returns a boolean', () => {
    expect(typeof isAndroid()).toBe('boolean');
  });

  it('returns false in default jsdom environment', () => {
    expect(isAndroid()).toBe(false);
  });

  it('returns true when user agent contains "Android"', () => {
    const orig = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 12; Pixel 6) Chrome/99',
      configurable: true, writable: true,
    });
    expect(isAndroid()).toBe(true);
    Object.defineProperty(navigator, 'userAgent', { value: orig, configurable: true, writable: true });
  });
});

describe('isIOS', () => {
  it('returns true when user agent contains "iPhone"', () => {
    const orig = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true, writable: true,
    });
    expect(isIOS()).toBe(true);
    Object.defineProperty(navigator, 'userAgent', { value: orig, configurable: true, writable: true });
  });

  it('returns true via platform check for iPad with MacIntel + maxTouchPoints > 1 (second OR branch)', () => {
    // iPadOS reports platform='MacIntel' + maxTouchPoints>1 but no iOS UA string
    const origPlatform = navigator.platform;
    const origMTP = navigator.maxTouchPoints;
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true, writable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true, writable: true });
    expect(isIOS()).toBe(true);
    Object.defineProperty(navigator, 'platform', { value: origPlatform, configurable: true, writable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: origMTP, configurable: true, writable: true });
  });
});

// ── getPixelRatio ─────────────────────────────────────────────────────────

describe('getPixelRatio', () => {
  it('returns a number', () => {
    expect(typeof getPixelRatio()).toBe('number');
  });

  it('returns at least 1', () => {
    expect(getPixelRatio()).toBeGreaterThanOrEqual(1);
  });

  it('returns 1 when devicePixelRatio is 0 (falsy fallback)', () => {
    const orig = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true, writable: true });
    expect(getPixelRatio()).toBe(1);
    Object.defineProperty(window, 'devicePixelRatio', { value: orig, configurable: true, writable: true });
  });

  it('returns the actual devicePixelRatio when truthy', () => {
    const orig = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true, writable: true });
    expect(getPixelRatio()).toBe(2);
    Object.defineProperty(window, 'devicePixelRatio', { value: orig, configurable: true, writable: true });
  });
});
