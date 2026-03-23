/**
 * Brain Teaser Audio — Unit Tests
 *
 * Tests the BrainTeaserAudio singleton exported from brain-teaser/audio.js.
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

describe('BrainTeaserAudio', () => {
  let audio;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/games/brain-teaser/audio.js');
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
    // Manually mark as initialized without a real context
    audio.initialized = true;
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    audio.init();
    // If the guard didn't fire, the catch block would call console.warn — verify it wasn't called
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
    audio.setVolume(2.5);
    expect(audio.masterVolume).toBe(1);
  });

  it('setVolume() clamps values below 0 to 0', () => {
    audio.setVolume(-0.5);
    expect(audio.masterVolume).toBe(0);
  });

  it('setVolume() accepts values within [0, 1] unchanged', () => {
    audio.setVolume(0.7);
    expect(audio.masterVolume).toBeCloseTo(0.7);
  });

  // ── toggleMute() ───────────────────────────────────────────────────────────

  it('toggleMute() flips muted state and returns new value', () => {
    expect(audio.toggleMute()).toBe(true);
    expect(audio.muted).toBe(true);
    expect(audio.toggleMute()).toBe(false);
    expect(audio.muted).toBe(false);
  });

  // ── playTone() happy path ──────────────────────────────────────────────────

  it('playTone() creates oscillator and gain node when context is set — happy path', () => {
    const mockCtx = createMockContext();
    audio.context = mockCtx;
    audio.playTone(440, 0.1);
    expect(mockCtx.createOscillator).toHaveBeenCalledOnce();
    expect(mockCtx.createGain).toHaveBeenCalledOnce();
  });

  it('playTone() connects oscillator → gain → destination', () => {
    const mockCtx = createMockContext();
    const osc = { connect: vi.fn(), type: '', start: vi.fn(), stop: vi.fn(), frequency: { setValueAtTime: vi.fn() } };
    const gain = { connect: vi.fn(), gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } };
    mockCtx.createOscillator.mockReturnValue(osc);
    mockCtx.createGain.mockReturnValue(gain);
    audio.context = mockCtx;
    audio.playTone(440, 0.1);
    expect(osc.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(mockCtx.destination);
  });

  it('playTone() sets oscillator type from parameter (square)', () => {
    const mockCtx = createMockContext();
    const osc = { connect: vi.fn(), type: '', start: vi.fn(), stop: vi.fn(), frequency: { setValueAtTime: vi.fn() } };
    const gain = { connect: vi.fn(), gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } };
    mockCtx.createOscillator.mockReturnValue(osc);
    mockCtx.createGain.mockReturnValue(gain);
    audio.context = mockCtx;
    audio.playTone(300, 0.1, 'square');
    expect(osc.type).toBe('square');
  });

  it('playTone() scales volume by masterVolume (adjustedVolume = volume * masterVolume)', () => {
    const mockCtx = createMockContext();
    const osc = { connect: vi.fn(), type: '', start: vi.fn(), stop: vi.fn(), frequency: { setValueAtTime: vi.fn() } };
    const gain = { connect: vi.fn(), gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } };
    mockCtx.createOscillator.mockReturnValue(osc);
    mockCtx.createGain.mockReturnValue(gain);
    audio.context = mockCtx;
    audio.masterVolume = 0.5;
    audio.playTone(440, 0.1, 'sine', 0.4);
    // adjustedVolume = 0.4 * 0.5 = 0.2
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.2, mockCtx.currentTime);
  });

  it('playTone() calls oscillator.start() and oscillator.stop()', () => {
    const mockCtx = createMockContext();
    const osc = { connect: vi.fn(), type: '', start: vi.fn(), stop: vi.fn(), frequency: { setValueAtTime: vi.fn() } };
    const gain = { connect: vi.fn(), gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } };
    mockCtx.createOscillator.mockReturnValue(osc);
    mockCtx.createGain.mockReturnValue(gain);
    audio.context = mockCtx;
    audio.playTone(440, 0.2);
    expect(osc.start).toHaveBeenCalledOnce();
    expect(osc.stop).toHaveBeenCalledOnce();
  });

  // ── Sound method wrappers ─────────────────────────────────────────────────

  it('playSelect() calls createOscillator once (single synchronous playTone call)', () => {
    const mockCtx = createMockContext();
    audio.context = mockCtx;
    audio.playSelect();
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
  });

  it('playTap() calls createOscillator once (single synchronous playTone call)', () => {
    const mockCtx = createMockContext();
    audio.context = mockCtx;
    audio.playTap();
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
  });

  it('playCorrect() calls createOscillator 3 times after all timers fire', () => {
    vi.useFakeTimers();
    const mockCtx = createMockContext();
    audio.context = mockCtx;
    audio.playCorrect();
    vi.runAllTimers();
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('playWrong() calls createOscillator 2 times after all timers fire', () => {
    vi.useFakeTimers();
    const mockCtx = createMockContext();
    audio.context = mockCtx;
    audio.playWrong();
    vi.runAllTimers();
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('playWin() calls createOscillator 4 times (4 notes) after all timers fire', () => {
    vi.useFakeTimers();
    const mockCtx = createMockContext();
    audio.context = mockCtx;
    audio.playWin();
    vi.runAllTimers();
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
});
