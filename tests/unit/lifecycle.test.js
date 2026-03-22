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

// ── cancelTrackedRAF ──────────────────────────────────────────────────────

describe('cancelTrackedRAF', () => {
  it('does not throw when no RAF is active', () => {
    expect(() => mod.cancelTrackedRAF()).not.toThrow();
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
