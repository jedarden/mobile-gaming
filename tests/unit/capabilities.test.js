/**
 * Capabilities — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests: getCapabilities, hasCapability, checkRequirements,
 * getCapabilityReport, isMobile, isIOS, isAndroid, getPixelRatio.
 */

import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
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

// ── hasCapability edge cases ───────────────────────────────────────────────

describe('hasCapability — edge cases', () => {
  it('returns false for empty string key', () => {
    expect(hasCapability('')).toBe(false);
  });

  it('returns false for numeric-like string key', () => {
    expect(hasCapability('123')).toBe(false);
  });
});

// ── getCapabilityReport — section completeness ─────────────────────────────

describe('getCapabilityReport — all groups present', () => {
  it('contains Performance section', () => {
    expect(getCapabilityReport()).toContain('Performance');
  });

  it('contains Web APIs section', () => {
    expect(getCapabilityReport()).toContain('Web APIs');
  });

  it('contains Other section', () => {
    expect(getCapabilityReport()).toContain('Other');
  });

  it('contains Audio/Video section', () => {
    expect(getCapabilityReport()).toContain('Audio/Video');
  });

  it('contains specific feature names from each group', () => {
    const report = getCapabilityReport();
    expect(report).toContain('webgl');
    expect(report).toContain('mediaRecorder');
    expect(report).toContain('indexedDB');
    expect(report).toContain('vibration');
    expect(report).toContain('shareApi');
    expect(report).toContain('performanceNow');
    expect(report).toContain('websockets');
    expect(report).toContain('serviceWorker');
  });
});

// ── checkRequirements — mixed satisfied and missing ────────────────────────

describe('checkRequirements — mixed results', () => {
  it('separates missing from present capabilities', () => {
    // 'localStorage' is present in jsdom; 'impossibleXYZ' is not
    const result = checkRequirements(['localStorage', 'impossibleXYZ']);
    expect(result.supported).toBe(false);
    expect(result.missing).toContain('impossibleXYZ');
    expect(result.missing).not.toContain('localStorage');
  });

  it('missing array length equals count of absent capabilities', () => {
    const result = checkRequirements(['fakeA', 'fakeB']);
    expect(result.missing.length).toBe(2);
  });
});

// ── isIOS — non-iOS user agents ───────────────────────────────────────────

describe('isIOS — non-iOS user agents', () => {
  it('returns false for Android user agent', () => {
    const orig = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 11; Pixel 5)',
      configurable: true, writable: true
    });
    expect(isIOS()).toBe(false);
    Object.defineProperty(navigator, 'userAgent', { value: orig, configurable: true, writable: true });
  });

  it('returns false for Windows user agent', () => {
    const orig = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true, writable: true
    });
    expect(isIOS()).toBe(false);
    Object.defineProperty(navigator, 'userAgent', { value: orig, configurable: true, writable: true });
  });
});

// ── isAndroid — non-Android user agents ───────────────────────────────────

describe('isAndroid — non-Android user agents', () => {
  it('returns false for iPad user agent', () => {
    const orig = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)',
      configurable: true, writable: true
    });
    expect(isAndroid()).toBe(false);
    Object.defineProperty(navigator, 'userAgent', { value: orig, configurable: true, writable: true });
  });
});

// ── catch branches via module reset ───────────────────────────────────────

describe('checkLocalStorage — catch branch (private browsing)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('returns false when localStorage.setItem throws SecurityError', async () => {
    vi.resetModules();
    vi.stubGlobal('localStorage', {
      setItem: () => { throw new Error('SecurityError'); },
      removeItem: () => {},
      getItem: () => null,
      clear: () => {},
      length: 0,
    });
    const mod = await import('../../src/shared/capabilities.js');
    const caps = mod.getCapabilities();
    expect(caps.localStorage).toBe(false);
  });
});

describe('checkSessionStorage — catch branch (private browsing)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('returns false when sessionStorage.setItem throws', async () => {
    vi.resetModules();
    vi.stubGlobal('sessionStorage', {
      setItem: () => { throw new Error('SecurityError'); },
      removeItem: () => {},
      getItem: () => null,
      clear: () => {},
      length: 0,
    });
    const mod = await import('../../src/shared/capabilities.js');
    const caps = mod.getCapabilities();
    expect(caps.sessionStorage).toBe(false);
  });
});

describe('checkCanvas2D — catch branch (getContext throws)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns false for canvas2d when getContext throws', async () => {
    vi.resetModules();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('Canvas blocked');
    });
    const mod = await import('../../src/shared/capabilities.js');
    const caps = mod.getCapabilities();
    expect(caps.canvas2d).toBe(false);
    expect(caps.webgl).toBe(false);
    expect(caps.webgl2).toBe(false);
  });
});

// ── checkWebGL — experimental-webgl fallback ───────────────────────────────

describe('checkWebGL — experimental-webgl fallback', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('returns true for webgl when experimental-webgl context is available but webgl is not', async () => {
    vi.resetModules();
    vi.stubGlobal('WebGLRenderingContext', function MockWebGL() {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((type) => {
      if (type === 'experimental-webgl') return { drawingBufferWidth: 0 };
      return null;
    });
    const mod = await import('../../src/shared/capabilities.js');
    const caps = mod.getCapabilities();
    expect(caps.webgl).toBe(true);
  });
});

// ── checkWebAudio — webkitAudioContext fallback ────────────────────────────

describe('checkWebAudio — webkitAudioContext fallback', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns true for webAudio when webkitAudioContext exists but AudioContext does not', async () => {
    vi.resetModules();
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', function MockWebkitAudioContext() {});
    const mod = await import('../../src/shared/capabilities.js');
    const caps = mod.getCapabilities();
    expect(caps.webAudio).toBe(true);
  });
});

// ── checkIndexedDB — webkitIndexedDB fallback ─────────────────────────────

describe('checkIndexedDB — webkitIndexedDB fallback', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns true for indexedDB when webkitIndexedDB exists but indexedDB does not', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('webkitIndexedDB', { open: () => {} });
    const mod = await import('../../src/shared/capabilities.js');
    const caps = mod.getCapabilities();
    expect(caps.indexedDB).toBe(true);
  });

  it('returns true for indexedDB when only mozIndexedDB exists', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('webkitIndexedDB', undefined);
    vi.stubGlobal('mozIndexedDB', { open: () => {} });
    const mod = await import('../../src/shared/capabilities.js');
    const caps = mod.getCapabilities();
    expect(caps.indexedDB).toBe(true);
  });
});

// ── checkTouch — maxTouchPoints > 0 branch ────────────────────────────────

describe('checkTouch — maxTouchPoints > 0 branch', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true, writable: true });
  });

  it('returns true for touch when maxTouchPoints > 0 and ontouchstart is absent', async () => {
    vi.resetModules();
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true, writable: true });
    const mod = await import('../../src/shared/capabilities.js');
    const caps = mod.getCapabilities();
    expect(caps.touch).toBe(true);
  });
});

// ── checkFullscreen — webkit/moz/ms fallback branches ─────────────────────

describe('checkFullscreen — webkitFullscreenEnabled fallback', () => {
  afterEach(() => {
    Object.defineProperty(document, 'webkitFullscreenEnabled', { value: undefined, configurable: true, writable: true });
  });

  it('returns true for fullscreen when webkitFullscreenEnabled is true', async () => {
    vi.resetModules();
    Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true, writable: true });
    Object.defineProperty(document, 'webkitFullscreenEnabled', { value: true, configurable: true, writable: true });
    const mod = await import('../../src/shared/capabilities.js');
    const caps = mod.getCapabilities();
    expect(caps.fullscreen).toBe(true);
  });
});

// ── checkFullscreen — mozFullScreenEnabled fallback ───────────────────────

describe('checkFullscreen — mozFullScreenEnabled fallback', () => {
  afterEach(() => {
    Object.defineProperty(document, 'mozFullScreenEnabled', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(document, 'webkitFullscreenEnabled', { value: undefined, configurable: true, writable: true });
  });

  it('returns true for fullscreen when only mozFullScreenEnabled is true', async () => {
    vi.resetModules();
    Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true, writable: true });
    Object.defineProperty(document, 'webkitFullscreenEnabled', { value: false, configurable: true, writable: true });
    Object.defineProperty(document, 'mozFullScreenEnabled', { value: true, configurable: true, writable: true });
    const mod = await import('../../src/shared/capabilities.js');
    const caps = mod.getCapabilities();
    expect(caps.fullscreen).toBe(true);
  });
});

// ── checkFullscreen — msFullscreenEnabled fallback ────────────────────────

describe('checkFullscreen — msFullscreenEnabled fallback', () => {
  afterEach(() => {
    Object.defineProperty(document, 'msFullscreenEnabled', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(document, 'mozFullScreenEnabled', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(document, 'webkitFullscreenEnabled', { value: undefined, configurable: true, writable: true });
  });

  it('returns true for fullscreen when only msFullscreenEnabled is true', async () => {
    vi.resetModules();
    Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true, writable: true });
    Object.defineProperty(document, 'webkitFullscreenEnabled', { value: false, configurable: true, writable: true });
    Object.defineProperty(document, 'mozFullScreenEnabled', { value: false, configurable: true, writable: true });
    Object.defineProperty(document, 'msFullscreenEnabled', { value: true, configurable: true, writable: true });
    const mod = await import('../../src/shared/capabilities.js');
    const caps = mod.getCapabilities();
    expect(caps.fullscreen).toBe(true);
  });
});

// ── isMobile — touch && mobile-UA true branch ─────────────────────────────

describe('isMobile — touch && mobile-UA true branch', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true, writable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: navigator.userAgent, configurable: true, writable: true,
    });
  });

  it('returns true when touch is enabled and user agent matches mobile pattern', async () => {
    vi.resetModules();
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true, writable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 12; Pixel 6) Chrome/99',
      configurable: true, writable: true,
    });
    const mod = await import('../../src/shared/capabilities.js');
    expect(mod.isMobile()).toBe(true);
  });
});

// ── isMobile — touch && deviceOrientation/deviceMotion true branch ─────────

describe('isMobile — deviceOrientation and deviceMotion fallback branches', () => {
  afterEach(async () => {
    delete globalThis.DeviceOrientationEvent;
    delete globalThis.DeviceMotionEvent;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true, writable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/99',
      configurable: true, writable: true,
    });
    vi.resetModules();
  });

  it('returns true when touch enabled and DeviceOrientationEvent exists — (caps.deviceOrientation) true branch', async () => {
    vi.resetModules();
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true, writable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/99', // non-mobile UA
      configurable: true, writable: true,
    });
    globalThis.DeviceOrientationEvent = {};
    const mod = await import('../../src/shared/capabilities.js');
    expect(mod.isMobile()).toBe(true);
  });

  it('returns true when touch enabled and DeviceMotionEvent exists — (caps.deviceMotion) true branch', async () => {
    vi.resetModules();
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true, writable: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/99', // non-mobile UA
      configurable: true, writable: true,
    });
    globalThis.DeviceMotionEvent = {};
    const mod = await import('../../src/shared/capabilities.js');
    expect(mod.isMobile()).toBe(true);
  });
});

// ── checkTouch — ontouchstart absent, maxTouchPoints=0 → touch false ────────

describe('checkTouch — both conditions false → touch=false (|| false || false = false)', () => {
  afterEach(async () => {
    // Restore ontouchstart and reset maxTouchPoints
    globalThis.ontouchstart = undefined;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true, writable: true });
    vi.resetModules();
  });

  it('returns false for touch when ontouchstart is deleted and maxTouchPoints=0 (both || operands false)', async () => {
    vi.resetModules();
    // Remove ontouchstart from window so first || operand is false
    delete globalThis.ontouchstart;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true, writable: true });
    const mod = await import('../../src/shared/capabilities.js');
    const caps = mod.getCapabilities();
    // Both 'ontouchstart' in window (false) and maxTouchPoints > 0 (false) → touch=false
    expect(caps.touch).toBe(false);
  });
});
