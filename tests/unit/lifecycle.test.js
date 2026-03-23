/**
 * Lifecycle — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests: initLifecycle, ready, pause, resume, handleError,
 * getState, isRunning, isPaused, cancelTrackedRAF, cleanup.
 *
 * Uses vi.resetModules() in beforeEach to get fresh module state
 * (lifecycle.js stores state at module scope).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock audio ───────────────────────────────────────────────────────────────

vi.mock('../../src/shared/audio.js', () => ({
  suspendAudio: vi.fn(),
  resumeAudio:  vi.fn(),
}));

// ─── Dynamic import helper ────────────────────────────────────────────────────

let mod;
let suspendAudioMock;
let resumeAudioMock;

beforeEach(async () => {
  vi.resetModules();
  mod = await import('../../src/shared/lifecycle.js');

  // Re-import audio mock to inspect calls
  const audio = await import('../../src/shared/audio.js');
  suspendAudioMock = audio.suspendAudio;
  resumeAudioMock  = audio.resumeAudio;
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up DOM elements added by lifecycle
  document.getElementById('mg-loading')?.remove();
  document.getElementById('mg-resume')?.remove();
  document.getElementById('mg-error')?.remove();
});

// ── getState / isRunning / isPaused (initial) ──────────────────────────────

describe('initial state', () => {
  it('getState returns "loading" before init', () => {
    expect(mod.getState()).toBe('loading');
  });

  it('isRunning returns false before ready()', () => {
    expect(mod.isRunning()).toBe(false);
  });

  it('isPaused returns false before pausing', () => {
    expect(mod.isPaused()).toBe(false);
  });
});

// ── initLifecycle ─────────────────────────────────────────────────────────

describe('initLifecycle', () => {
  it('does not throw', () => {
    expect(() => mod.initLifecycle({ container: document.body })).not.toThrow();
  });

  it('creates loading overlay in the container', () => {
    mod.initLifecycle({ container: document.body });
    expect(document.getElementById('mg-loading')).not.toBeNull();
  });

  it('creates resume overlay in the container', () => {
    mod.initLifecycle({ container: document.body });
    expect(document.getElementById('mg-resume')).not.toBeNull();
  });

  it('creates error overlay in the container', () => {
    mod.initLifecycle({ container: document.body });
    expect(document.getElementById('mg-error')).not.toBeNull();
  });
});

// ── ready ─────────────────────────────────────────────────────────────────

describe('ready', () => {
  beforeEach(() => {
    mod.initLifecycle({ container: document.body });
  });

  it('sets state to "running"', () => {
    mod.ready();
    expect(mod.getState()).toBe('running');
  });

  it('isRunning returns true after ready()', () => {
    mod.ready();
    expect(mod.isRunning()).toBe(true);
  });

  it('starts fading out loading overlay', () => {
    mod.ready();
    const loading = document.getElementById('mg-loading');
    expect(loading.style.opacity).toBe('0');
  });
});

// ── pause ──────────────────────────────────────────────────────────────────

describe('pause', () => {
  beforeEach(() => {
    mod.initLifecycle({ container: document.body });
    mod.ready();
  });

  it('sets state to "paused"', () => {
    mod.pause();
    expect(mod.getState()).toBe('paused');
  });

  it('isPaused returns true after pause()', () => {
    mod.pause();
    expect(mod.isPaused()).toBe(true);
  });

  it('calls suspendAudio', () => {
    mod.pause();
    expect(suspendAudioMock).toHaveBeenCalledTimes(1);
  });

  it('shows the resume overlay', () => {
    mod.pause();
    const overlay = document.getElementById('mg-resume');
    expect(overlay.style.opacity).toBe('1');
  });

  it('is a no-op when not "running"', () => {
    mod.pause();           // first pause: running → paused
    mod.pause();           // second pause: should be no-op
    expect(mod.getState()).toBe('paused');
    expect(suspendAudioMock).toHaveBeenCalledTimes(1);
  });

  it('calls onSave callback if provided', () => {
    const onSave = vi.fn();
    mod.cleanup();
    mod.initLifecycle({ container: document.body, onSave });
    mod.ready();
    mod.pause();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('continues pause flow even if onSave throws (try-catch swallows error)', () => {
    const onSave = vi.fn(() => { throw new Error('Save failed'); });
    mod.cleanup();
    mod.initLifecycle({ container: document.body, onSave });
    mod.ready();
    expect(() => mod.pause()).not.toThrow();
    expect(mod.getState()).toBe('paused');
  });
});

// ── resume ─────────────────────────────────────────────────────────────────

describe('resume', () => {
  beforeEach(() => {
    mod.initLifecycle({ container: document.body });
    mod.ready();
    mod.pause();
  });

  it('sets state back to "running"', () => {
    mod.resume();
    expect(mod.getState()).toBe('running');
  });

  it('isRunning returns true after resume()', () => {
    mod.resume();
    expect(mod.isRunning()).toBe(true);
  });

  it('calls resumeAudio', () => {
    mod.resume();
    expect(resumeAudioMock).toHaveBeenCalledTimes(1);
  });

  it('hides the resume overlay', () => {
    mod.resume();
    const overlay = document.getElementById('mg-resume');
    expect(overlay.style.opacity).toBe('0');
  });

  it('is a no-op when not "paused"', () => {
    mod.resume();           // paused → running
    mod.resume();           // should be no-op
    expect(mod.getState()).toBe('running');
    expect(resumeAudioMock).toHaveBeenCalledTimes(1);
  });

  it('calls onRestore callback if provided', () => {
    const onRestore = vi.fn();
    mod.cleanup();
    mod.initLifecycle({ container: document.body, onRestore });
    mod.ready();
    mod.pause();
    mod.resume();
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('continues resume flow even if onRestore throws (try-catch swallows error)', () => {
    const onRestore = vi.fn(() => { throw new Error('Restore failed'); });
    mod.cleanup();
    mod.initLifecycle({ container: document.body, onRestore });
    mod.ready();
    mod.pause();
    expect(() => mod.resume()).not.toThrow();
    expect(mod.getState()).toBe('running');
  });
});

// ── handleError ───────────────────────────────────────────────────────────

describe('handleError', () => {
  beforeEach(() => {
    mod.initLifecycle({ container: document.body });
    mod.ready();
  });

  it('sets state to "error"', () => {
    mod.handleError(new Error('test error'));
    expect(mod.getState()).toBe('error');
  });

  it('shows the error overlay', () => {
    mod.handleError(new Error('test'));
    const overlay = document.getElementById('mg-error');
    expect(overlay.style.opacity).toBe('1');
  });

  it('does not throw for any error type', () => {
    expect(() => mod.handleError(new Error('oops'))).not.toThrow();
    expect(() => mod.handleError(null)).not.toThrow();
    expect(() => mod.handleError('string error')).not.toThrow();
  });
});

// ── showResumeOverlay ──────────────────────────────────────────────────────

describe('showResumeOverlay', () => {
  it('pauses when called while running', () => {
    mod.initLifecycle({ container: document.body });
    mod.ready();
    mod.showResumeOverlay();
    expect(mod.getState()).toBe('paused');
  });

  it('is a no-op when already paused', () => {
    mod.initLifecycle({ container: document.body });
    mod.ready();
    mod.pause();
    mod.showResumeOverlay();
    // still paused, audio suspended only once
    expect(mod.getState()).toBe('paused');
    expect(suspendAudioMock).toHaveBeenCalledTimes(1);
  });
});

// ── cancelTrackedRAF ──────────────────────────────────────────────────────

describe('cancelTrackedRAF', () => {
  it('does not throw when no RAF is active', () => {
    expect(() => mod.cancelTrackedRAF()).not.toThrow();
  });
});

// ── requestAnimationFrame ─────────────────────────────────────────────────────

describe('requestAnimationFrame', () => {
  it('returns null when state is not running (loading state)', () => {
    // Module starts in 'loading' state — no initLifecycle or ready called
    const result = mod.requestAnimationFrame(() => {});
    expect(result).toBeNull();
  });

  it('returns null when state is paused', async () => {
    mod.initLifecycle({ container: document.body });
    mod.ready();
    mod.pause();
    const result = mod.requestAnimationFrame(() => {});
    expect(result).toBeNull();
  });

  it('does not invoke callback when state changes to paused before RAF fires (inner running check)', () => {
    // Intercept window.requestAnimationFrame so we can fire it manually
    let capturedWrapped;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      capturedWrapped = cb;
      return 42;
    });
    mod.initLifecycle({ container: document.body });
    mod.ready();
    const cb = vi.fn();
    mod.requestAnimationFrame(cb);
    mod.pause(); // state → 'paused' before RAF fires
    capturedWrapped(100); // fire the wrapped RAF callback manually
    expect(cb).not.toHaveBeenCalled(); // inner `if (currentState === 'running')` is false
    vi.restoreAllMocks();
  });

  it('cancels pending RAF when pause() is called while RAF is active (rafId !== null branch)', () => {
    let capturedWrapped;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      capturedWrapped = cb;
      return 99;
    });
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    mod.initLifecycle({ container: document.body });
    mod.ready();
    mod.requestAnimationFrame(() => {}); // sets rafId = 99
    mod.pause(); // rafId !== null → cancelAnimationFrame(99) called
    expect(cancelSpy).toHaveBeenCalledWith(99);
    vi.restoreAllMocks();
  });
});

// ── cleanup ───────────────────────────────────────────────────────────────

describe('cleanup', () => {
  it('removes overlays from DOM', () => {
    mod.initLifecycle({ container: document.body });
    mod.cleanup();
    expect(document.getElementById('mg-loading')).toBeNull();
    expect(document.getElementById('mg-resume')).toBeNull();
    expect(document.getElementById('mg-error')).toBeNull();
  });

  it('does not throw when called before initLifecycle', () => {
    expect(() => mod.cleanup()).not.toThrow();
  });
});

// ── setupVisibilityHandler ────────────────────────────────────────────────────

describe('setupVisibilityHandler', () => {
  it('pauses when document becomes hidden', () => {
    mod.initLifecycle({ container: document.body });
    mod.ready();
    mod.setupVisibilityHandler();

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mod.getState()).toBe('paused');
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('shows resume overlay when document becomes visible (else branch)', () => {
    mod.initLifecycle({ container: document.body });
    mod.ready();
    mod.setupVisibilityHandler();

    // First hide (pause), then show (else branch → showResumeOverlay)
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(document.getElementById('mg-resume')).not.toBeNull();
  });
});

// ── unhandledrejection boundary ───────────────────────────────────────────────

describe('unhandledrejection boundary', () => {
  it('transitions to error state when window fires unhandledrejection with a reason', () => {
    mod.initLifecycle({ container: document.body });
    mod.ready();
    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new Error('Promise rejected') }));
    expect(mod.getState()).toBe('error');
  });

  it('transitions to error state when unhandledrejection has no reason (fallback Error used)', () => {
    mod.initLifecycle({ container: document.body });
    mod.ready();
    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: null }));
    expect(mod.getState()).toBe('error');
  });
});
