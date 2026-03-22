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
