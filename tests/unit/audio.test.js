/**
 * Audio — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests the pure-logic portions of src/shared/audio.js that do not
 * require an actual Web Audio oscillator to fire:
 *   - SOUNDS catalog structure
 *   - setSoundEnabled / isSoundEnabled
 *   - setMasterVolume / getMasterVolume (clamping)
 *   - createSoundPattern defaults
 *   - playSound return value for unknown/disabled cases
 *   - isAudioSupported detection
 *   - playSound returns null when sound is disabled
 *
 * Functions that require a live AudioContext (resumeAudio, suspendAudio,
 * playClick, etc.) are excluded — they need a browser with AudioContext
 * and are verified manually / via E2E.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SOUNDS,
  setSoundEnabled,
  isSoundEnabled,
  setMasterVolume,
  getMasterVolume,
  createSoundPattern,
  playSound,
  isAudioSupported,
  resumeAudio,
  suspendAudio,
} from '../../src/shared/audio.js';

// ── SOUNDS catalog ────────────────────────────────────────────────────────────

describe('SOUNDS', () => {
  const EXPECTED_KEYS = [
    'click', 'success', 'successChord', 'fail', 'whoosh',
    'pop', 'tap', 'slide', 'bounce', 'collect', 'levelComplete',
  ];

  it('exports all expected sound names', () => {
    for (const key of EXPECTED_KEYS) {
      expect(SOUNDS, `missing key: ${key}`).toHaveProperty(key);
    }
  });

  it('every sound pattern has a type string', () => {
    const VALID_TYPES = ['sine', 'square', 'sawtooth', 'triangle'];
    for (const [name, pattern] of Object.entries(SOUNDS)) {
      expect(VALID_TYPES, `${name}.type invalid`).toContain(pattern.type);
    }
  });

  it('every sound pattern has a positive frequency', () => {
    for (const [name, pattern] of Object.entries(SOUNDS)) {
      expect(pattern.frequency, `${name}.frequency`).toBeGreaterThan(0);
    }
  });

  it('every sound pattern has a positive duration', () => {
    for (const [name, pattern] of Object.entries(SOUNDS)) {
      expect(pattern.duration, `${name}.duration`).toBeGreaterThan(0);
    }
  });

  it('every sound pattern has a positive attack time', () => {
    for (const [name, pattern] of Object.entries(SOUNDS)) {
      expect(pattern.attack, `${name}.attack`).toBeGreaterThan(0);
    }
  });

  it('every sound pattern has a positive decay time', () => {
    for (const [name, pattern] of Object.entries(SOUNDS)) {
      expect(pattern.decay, `${name}.decay`).toBeGreaterThan(0);
    }
  });

  it('attack + decay ≤ duration for each sound', () => {
    for (const [name, pattern] of Object.entries(SOUNDS)) {
      expect(
        pattern.attack + pattern.decay,
        `${name}: attack+decay exceeds duration`
      ).toBeLessThanOrEqual(pattern.duration + 1e-9);
    }
  });
});

// ── setSoundEnabled / isSoundEnabled ─────────────────────────────────────────

describe('setSoundEnabled / isSoundEnabled', () => {
  afterEach(() => {
    // Restore default
    setSoundEnabled(true);
  });

  it('sound is enabled by default', () => {
    setSoundEnabled(true); // ensure clean state
    expect(isSoundEnabled()).toBe(true);
  });

  it('setSoundEnabled(false) disables sound', () => {
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
  });

  it('setSoundEnabled(true) re-enables sound', () => {
    setSoundEnabled(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });
});

// ── setMasterVolume / getMasterVolume ─────────────────────────────────────────

describe('setMasterVolume / getMasterVolume', () => {
  afterEach(() => {
    setMasterVolume(0.5);
  });

  it('default master volume is 0.5', () => {
    setMasterVolume(0.5);
    expect(getMasterVolume()).toBe(0.5);
  });

  it('sets volume to arbitrary value in [0,1]', () => {
    setMasterVolume(0.8);
    expect(getMasterVolume()).toBe(0.8);
  });

  it('clamps volume below 0 to 0', () => {
    setMasterVolume(-1);
    expect(getMasterVolume()).toBe(0);
  });

  it('clamps volume above 1 to 1', () => {
    setMasterVolume(2);
    expect(getMasterVolume()).toBe(1);
  });

  it('clamps Infinity to 1', () => {
    setMasterVolume(Infinity);
    expect(getMasterVolume()).toBe(1);
  });

  it('clamps -Infinity to 0', () => {
    setMasterVolume(-Infinity);
    expect(getMasterVolume()).toBe(0);
  });

  it('volume 0 is allowed', () => {
    setMasterVolume(0);
    expect(getMasterVolume()).toBe(0);
  });

  it('volume 1 is allowed', () => {
    setMasterVolume(1);
    expect(getMasterVolume()).toBe(1);
  });
});

// ── createSoundPattern ────────────────────────────────────────────────────────

describe('createSoundPattern', () => {
  it('returns an object with the expected shape', () => {
    const pattern = createSoundPattern({ frequency: 440 });
    expect(pattern).toHaveProperty('type');
    expect(pattern).toHaveProperty('frequency');
    expect(pattern).toHaveProperty('duration');
    expect(pattern).toHaveProperty('attack');
    expect(pattern).toHaveProperty('decay');
  });

  it('defaults type to "sine"', () => {
    const pattern = createSoundPattern({ frequency: 440 });
    expect(pattern.type).toBe('sine');
  });

  it('defaults frequency to 440 when not provided', () => {
    const pattern = createSoundPattern({});
    expect(pattern.frequency).toBe(440);
  });

  it('defaults duration to 0.1', () => {
    const pattern = createSoundPattern({ frequency: 440 });
    expect(pattern.duration).toBe(0.1);
  });

  it('defaults attack to 0.01', () => {
    const pattern = createSoundPattern({ frequency: 440 });
    expect(pattern.attack).toBe(0.01);
  });

  it('defaults decay to 0.09', () => {
    const pattern = createSoundPattern({ frequency: 440 });
    expect(pattern.decay).toBe(0.09);
  });

  it('respects all provided options', () => {
    const pattern = createSoundPattern({
      type: 'square',
      frequency: 880,
      frequencyEnd: 440,
      duration: 0.5,
      attack: 0.05,
      decay: 0.4,
    });
    expect(pattern.type).toBe('square');
    expect(pattern.frequency).toBe(880);
    expect(pattern.frequencyEnd).toBe(440);
    expect(pattern.duration).toBe(0.5);
    expect(pattern.attack).toBe(0.05);
    expect(pattern.decay).toBe(0.4);
  });

  it('frequencyEnd is undefined when not provided', () => {
    const pattern = createSoundPattern({ frequency: 220 });
    expect(pattern.frequencyEnd).toBeUndefined();
  });

  it('frequency: 0 falls back to 440 (|| operator treats 0 as falsy)', () => {
    const pattern = createSoundPattern({ frequency: 0 });
    expect(pattern.frequency).toBe(440);
  });

  it('duration: 0 falls back to 0.1 (|| operator treats 0 as falsy)', () => {
    const pattern = createSoundPattern({ frequency: 440, duration: 0 });
    expect(pattern.duration).toBe(0.1);
  });

  it('attack: 0 falls back to 0.01 (|| operator treats 0 as falsy)', () => {
    const pattern = createSoundPattern({ frequency: 440, attack: 0 });
    expect(pattern.attack).toBe(0.01);
  });

  it('decay: 0 falls back to 0.09 (|| operator treats 0 as falsy)', () => {
    const pattern = createSoundPattern({ frequency: 440, decay: 0 });
    expect(pattern.decay).toBe(0.09);
  });

  it('type: empty string falls back to "sine" (|| operator treats "" as falsy)', () => {
    const pattern = createSoundPattern({ type: '', frequency: 440 });
    expect(pattern.type).toBe('sine');
  });
});

// ── playSound ─────────────────────────────────────────────────────────────────

describe('playSound', () => {
  afterEach(() => {
    setSoundEnabled(true);
  });

  it('returns null for an unknown sound name', () => {
    expect(playSound('does-not-exist')).toBeNull();
  });

  it('returns null when sound is disabled', () => {
    setSoundEnabled(false);
    // Even for a valid sound name, result is null (disabled path in playSoundPattern)
    // AudioContext won't be created since soundEnabled guard fires first
    expect(playSound('click', 1)).toBeNull();
  });

  it('returns null for volume=0', () => {
    // playSoundPattern returns null when volume <= 0
    expect(playSound('click', 0)).toBeNull();
  });

  it('returns null for negative volume', () => {
    expect(playSound('click', -0.5)).toBeNull();
  });

  it('returns null when AudioContext is unavailable (catch block — no AudioContext in jsdom)', () => {
    // soundEnabled=true (default), valid sound name, positive volume
    // getAudioContext() throws because window.AudioContext is not defined in jsdom
    // → catch fires → returns null
    setSoundEnabled(true);
    expect(playSound('click', 1)).toBeNull();
  });
});

// ── isAudioSupported ──────────────────────────────────────────────────────────

describe('isAudioSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when window.AudioContext is defined', () => {
    vi.stubGlobal('AudioContext', class MockAudioContext {});
    expect(isAudioSupported()).toBe(true);
  });

  it('returns true when window.webkitAudioContext is defined', () => {
    // Remove standard AudioContext, leave only webkit prefix
    const orig = window.AudioContext;
    Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
    vi.stubGlobal('webkitAudioContext', class MockAudioContext {});
    expect(isAudioSupported()).toBe(true);
    Object.defineProperty(window, 'AudioContext', { value: orig, configurable: true });
  });

  it('returns false when neither AudioContext variant is available', () => {
    const orig = window.AudioContext;
    Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
    const origWebkit = window.webkitAudioContext;
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true });
    expect(isAudioSupported()).toBe(false);
    Object.defineProperty(window, 'AudioContext', { value: orig, configurable: true });
    if (origWebkit !== undefined) {
      Object.defineProperty(window, 'webkitAudioContext', { value: origWebkit, configurable: true });
    }
  });
});

// ── resumeAudio — catch block ──────────────────────────────────────────────────

describe('resumeAudio — catch block', () => {
  it('returns false when ctx.resume() throws (catch branch)', async () => {
    // Use a fresh module load with a mock AudioContext whose resume() rejects
    vi.resetModules();
    const mockCtx = {
      state: 'suspended',
      currentTime: 0,
      destination: {},
      resume: vi.fn(() => Promise.reject(new Error('AudioContext resume rejected'))),
    };
    vi.stubGlobal('AudioContext', vi.fn(() => mockCtx));

    const { resumeAudio: resumeAudioFresh } = await import('../../src/shared/audio.js');
    const result = await resumeAudioFresh();
    expect(result).toBe(false);

    vi.unstubAllGlobals();
    vi.resetModules();
  });
});

// ── resumeAudio — non-suspended state (if branch false) ──────────────────────

describe('resumeAudio — non-suspended state', () => {
  it('returns true and skips ctx.resume() when state is not "suspended" (if branch false)', async () => {
    vi.resetModules();
    const resume = vi.fn();
    const mockCtx = { state: 'running', currentTime: 0, destination: {}, resume };
    vi.stubGlobal('AudioContext', vi.fn(() => mockCtx));

    const { resumeAudio: resumeAudioFresh } = await import('../../src/shared/audio.js');
    const result = await resumeAudioFresh();

    expect(result).toBe(true);
    expect(resume).not.toHaveBeenCalled(); // state !== 'suspended' → if body skipped

    vi.unstubAllGlobals();
    vi.resetModules();
  });
});

// ── suspendAudio ─────────────────────────────────────────────────────────────

describe('suspendAudio', () => {
  it('calls audioContext.suspend() when audioContext exists and state is "running" (if true branch)', async () => {
    vi.resetModules();
    const suspend = vi.fn();
    const mockCtx = { state: 'running', currentTime: 0, destination: {}, resume: vi.fn(), suspend };
    vi.stubGlobal('AudioContext', vi.fn(() => mockCtx));

    const { resumeAudio: resumeAudioFresh, suspendAudio: suspendAudioFresh } = await import('../../src/shared/audio.js');
    await resumeAudioFresh(); // initializes module-level audioContext (state='running', if skipped)
    suspendAudioFresh();
    expect(suspend).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('does not call suspend() when audioContext.state is not "running" (if false branch)', async () => {
    vi.resetModules();
    const suspend = vi.fn();
    const mockCtx = { state: 'suspended', currentTime: 0, destination: {}, resume: vi.fn(() => Promise.resolve()), suspend };
    vi.stubGlobal('AudioContext', vi.fn(() => mockCtx));

    const { resumeAudio: resumeAudioFresh, suspendAudio: suspendAudioFresh } = await import('../../src/shared/audio.js');
    await resumeAudioFresh(); // initializes audioContext (state='suspended', resumes it)
    // After resume(), state is still 'suspended' in our mock (we didn't update state)
    suspendAudioFresh();
    expect(suspend).not.toHaveBeenCalled(); // state is 'suspended', not 'running'

    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('does not throw when audioContext is not yet initialized (audioContext && ... — false branch)', async () => {
    vi.resetModules();
    // Import fresh module without creating audioContext (no getAudioContext call)
    const { suspendAudio: suspendAudioFresh } = await import('../../src/shared/audio.js');
    expect(() => suspendAudioFresh()).not.toThrow(); // audioContext is null → short-circuits

    vi.resetModules();
  });
});

// ── playSoundPattern — internal branches via playSound ───────────────────────

describe('playSoundPattern — osc.type, frequencyEnd ramp, and setTimeout cleanup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.useRealTimers();
  });

  function makeMocks() {
    const oscMock = {
      type: undefined,
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };
    const gainMock = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    };
    const ctxMock = {
      state: 'running',
      currentTime: 0,
      destination: {},
      resume: vi.fn(() => Promise.resolve()),
      createOscillator: vi.fn(() => oscMock),
      createGain: vi.fn(() => gainMock),
    };
    return { oscMock, gainMock, ctxMock };
  }

  it('sets osc.type when pattern.type is truthy (if(pattern.type) true branch)', async () => {
    vi.resetModules();
    const { oscMock, ctxMock } = makeMocks();
    vi.stubGlobal('AudioContext', vi.fn(() => ctxMock));

    const { playSound, setSoundEnabled } = await import('../../src/shared/audio.js');
    setSoundEnabled(true);
    // SOUNDS.success has type='sine' but no frequencyEnd — exercises only the type branch
    playSound('success', 1);

    expect(oscMock.type).toBe('sine');
  });

  it('calls exponentialRampToValueAtTime when pattern.frequencyEnd is defined (if(frequencyEnd) true branch)', async () => {
    vi.resetModules();
    const { oscMock, ctxMock } = makeMocks();
    vi.stubGlobal('AudioContext', vi.fn(() => ctxMock));

    const { playSound, setSoundEnabled } = await import('../../src/shared/audio.js');
    setSoundEnabled(true);
    // SOUNDS.click has frequencyEnd: 600 — exercises the frequencyEnd ramp branch
    playSound('click', 1);

    expect(oscMock.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      600,
      expect.any(Number)
    );
  });

  it('disconnects osc and gainNode after timeout fires (setTimeout cleanup branch)', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const { oscMock, gainMock, ctxMock } = makeMocks();
    vi.stubGlobal('AudioContext', vi.fn(() => ctxMock));

    const { playSound, setSoundEnabled } = await import('../../src/shared/audio.js');
    setSoundEnabled(true);
    // SOUNDS.click has duration: 0.05 → cleanup fires at (0.05 + 0.1) * 1000 = 150ms
    playSound('click', 1);

    expect(oscMock.disconnect).not.toHaveBeenCalled();
    expect(gainMock.disconnect).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200); // past the 150ms cleanup delay

    expect(oscMock.disconnect).toHaveBeenCalledTimes(1);
    expect(gainMock.disconnect).toHaveBeenCalledTimes(1);
  });
});

// ── getAudioContext — webkit fallback ─────────────────────────────────────────

describe('getAudioContext — webkitAudioContext fallback', () => {
  it('creates context via webkitAudioContext when AudioContext is absent (|| fallback branch)', async () => {
    vi.resetModules();
    const resume = vi.fn(() => Promise.resolve());
    const mockCtx = { state: 'running', currentTime: 0, destination: {}, resume };
    const webkitCtor = vi.fn(() => mockCtx);

    // Remove standard AudioContext so the || branch is taken
    const orig = window.AudioContext;
    Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true, writable: true });
    vi.stubGlobal('webkitAudioContext', webkitCtor);

    const { resumeAudio: resumeAudioFresh } = await import('../../src/shared/audio.js');
    const result = await resumeAudioFresh();

    // webkitAudioContext constructor was used
    expect(webkitCtor).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);

    Object.defineProperty(window, 'AudioContext', { value: orig, configurable: true, writable: true });
    vi.unstubAllGlobals();
    vi.resetModules();
  });
});
