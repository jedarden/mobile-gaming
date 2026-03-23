/**
 * Bus Jam Audio — Unit Tests
 *
 * Tests the BusJamAudio singleton exported from bus-jam/audio.js.
 * Focuses on branch coverage: init guards, resume condition, playTone guard,
 * setVolume clamping.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock context factory ─────────────────────────────────────────────────────

const createMockContext = (state = 'running') => ({
  state,
  currentTime: 0,
  destination: {},
  resume: vi.fn().mockResolvedValue(undefined),
  createOscillator: vi.fn(() => ({
    connect: vi.fn(), type: '', start: vi.fn(), stop: vi.fn(),
    frequency: { setValueAtTime: vi.fn() },
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  })),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BusJamAudio', () => {
  let audio;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/games/bus-jam/audio.js');
    audio = mod.audio;
    // Reset singleton state to known baseline
    audio.initialized = false;
    audio.context = null;
    audio.muted = false;
    audio.masterVolume = 0.5;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── init() ─────────────────────────────────────────────────────────────────

  it('init() catch block leaves initialized=false when AudioContext is unavailable', () => {
    // jsdom has no AudioContext — new (undefined || undefined)() throws → catch fires
    audio.init();
    expect(audio.initialized).toBe(false);
    expect(audio.context).toBeNull();
  });

  it('init() is a no-op when already initialized — (if this.initialized) true arm', () => {
    // Manually mark as initialized; guard returns early before any AudioContext call
    audio.initialized = true;
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    audio.init();
    // If guard didn't fire, console.warn would be called from the catch block
    expect(spy).not.toHaveBeenCalled();
  });

  // ── resume() ───────────────────────────────────────────────────────────────

  it('resume() does nothing when context is null — (if context && ...) false arm', async () => {
    audio.context = null;
    await expect(audio.resume()).resolves.toBeUndefined();
  });

  it('resume() does nothing when context state is not suspended — (state === "suspended") false arm', async () => {
    const mockCtx = createMockContext('running');
    audio.context = mockCtx;
    await audio.resume();
    expect(mockCtx.resume).not.toHaveBeenCalled();
  });

  it('resume() calls context.resume() when state is suspended', async () => {
    const mockCtx = createMockContext('suspended');
    audio.context = mockCtx;
    await audio.resume();
    expect(mockCtx.resume).toHaveBeenCalledOnce();
  });

  // ── playTone() ─────────────────────────────────────────────────────────────

  it('playTone() returns early when context is null — (!context || muted) left arm', () => {
    audio.context = null;
    expect(() => audio.playTone(440, 0.1)).not.toThrow();
  });

  it('playTone() returns early when muted — (!context || muted) right arm', () => {
    const mockCtx = createMockContext();
    audio.context = mockCtx;
    audio.muted = true;
    audio.playTone(440, 0.1);
    expect(mockCtx.createOscillator).not.toHaveBeenCalled();
  });

  // ── setVolume() ────────────────────────────────────────────────────────────

  it('setVolume() clamps values above 1 to 1', () => {
    audio.setVolume(3.0);
    expect(audio.masterVolume).toBe(1);
  });

  it('setVolume() clamps values below 0 to 0', () => {
    audio.setVolume(-1.0);
    expect(audio.masterVolume).toBe(0);
  });

  it('setVolume() accepts values within [0, 1] unchanged', () => {
    audio.setVolume(0.4);
    expect(audio.masterVolume).toBeCloseTo(0.4);
  });

  // ── toggleMute() ───────────────────────────────────────────────────────────

  it('toggleMute() flips muted state and returns new value', () => {
    expect(audio.toggleMute()).toBe(true);
    expect(audio.muted).toBe(true);
    expect(audio.toggleMute()).toBe(false);
    expect(audio.muted).toBe(false);
  });
});
