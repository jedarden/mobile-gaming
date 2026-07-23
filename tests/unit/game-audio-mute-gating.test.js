/**
 * Game audio mute gating — behavioral verification test
 * @vitest-environment jsdom
 *
 * Verifies that the soundEnabled mute toggle actually gates audio playback.
 * The existing game-audio-wiring.test.js only checks source patterns (imports,
 * function calls) — this test proves the behavior end-to-end: when soundEnabled
 * is false, playSound() returns null and creates no audio nodes; when true,
 * it creates the oscillator/gain nodes as expected.
 *
 * This tests the shared module's behavior (the gate implementation itself),
 * which is what every game relies on for their sound toggle. The games'
 * responsibility is to call setSoundEnabled with the persisted setting at
 * init (already verified by game-audio-wiring.test.js).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Create mock AudioContext that tracks node creation
function createMockAudioContext() {
  const oscillators = [];
  const gainNodes = [];

  return {
    state: 'suspended',
    currentTime: 0,
    destination: {},
    createGain() {
      const node = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        }
      };
      gainNodes.push(node);
      return node;
    },
    createOscillator() {
      const node = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        type: 'sine',
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        },
        start: vi.fn(),
        stop: vi.fn()
      };
      oscillators.push(node);
      return node;
    },
    resume: vi.fn(async function() { this.state = 'running'; }),
    suspend: vi.fn(function() { this.state = 'suspended'; }),
    // Trackers
    _oscillators: oscillators,
    _gainNodes: gainNodes,
    _reset() {
      oscillators.length = 0;
      gainNodes.length = 0;
    }
  };
}

let mockCtx;
let audioModule;

async function getFreshModule() {
  mockCtx = createMockAudioContext();
  global.window = { AudioContext: vi.fn(() => mockCtx) };
  vi.resetModules();
  return await import('../../src/shared/audio.js');
}

describe('audio mute gating — soundEnabled toggle behavior', () => {
  beforeEach(async () => {
    audioModule = await getFreshModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setSoundEnabled(false) suppresses audio', () => {
    it('playSound returns null when soundEnabled is false', () => {
      audioModule.setSoundEnabled(false);
      const result = audioModule.playSound('click', 1);
      expect(result).toBeNull();
    });

    it('playSound creates no audio nodes when soundEnabled is false', () => {
      audioModule.setSoundEnabled(false);
      audioModule.playSound('click', 1);

      // No oscillator or gain node should be created
      expect(mockCtx._oscillators.length).toBe(0);
      expect(mockCtx._gainNodes.length).toBe(0);
    });

    it('playSoundPattern (via playClick) creates no nodes when soundEnabled is false', () => {
      audioModule.setSoundEnabled(false);
      audioModule.playClick(1);

      expect(mockCtx._oscillators.length).toBe(0);
      expect(mockCtx._gainNodes.length).toBe(0);
    });

    it('all convenience play functions respect soundEnabled=false', () => {
      audioModule.setSoundEnabled(false);

      // Test all convenience functions
      audioModule.playClick(1);
      audioModule.playSuccess(1);
      audioModule.playFail(1);
      audioModule.playWhoosh(1);
      audioModule.playPop(1);
      audioModule.playTap(1);
      audioModule.playSlide(1);
      audioModule.playBounce(1);
      audioModule.playCollect(1);
      audioModule.playLevelComplete(1);

      // None should have created any audio nodes
      expect(mockCtx._oscillators.length).toBe(0);
      expect(mockCtx._gainNodes.length).toBe(0);
    });

    it('volume=0 also suppresses audio (independent gate)', () => {
      audioModule.setSoundEnabled(true); // sound enabled
      const result = audioModule.playSound('click', 0);

      expect(result).toBeNull();
      expect(mockCtx._oscillators.length).toBe(0);
      expect(mockCtx._gainNodes.length).toBe(0);
    });
  });

  describe('setSoundEnabled(true) allows audio', () => {
    it('playSound returns gain node when soundEnabled is true', () => {
      audioModule.setSoundEnabled(true);
      const result = audioModule.playSound('click', 1);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    it('playSound creates oscillator and gain nodes when soundEnabled is true', () => {
      audioModule.setSoundEnabled(true);
      audioModule.playSound('click', 1);

      // Should have created one oscillator and one gain node
      expect(mockCtx._oscillators.length).toBe(1);
      expect(mockCtx._gainNodes.length).toBe(1);
    });

    it('oscillator is configured with correct type and frequency', () => {
      audioModule.setSoundEnabled(true);
      audioModule.playSound('click', 1);

      const osc = mockCtx._oscillators[0];
      expect(osc.type).toBe('sine'); // SOUNDS.click.type
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(800, expect.any(Number)); // SOUNDS.click.frequency
    });

    it('gain node is connected to destination', () => {
      audioModule.setSoundEnabled(true);
      const result = audioModule.playSound('click', 1);

      const gain = mockCtx._gainNodes[0];
      expect(gain.connect).toHaveBeenCalledWith(mockCtx.destination);
    });

    it('oscillator is connected to gain node', () => {
      audioModule.setSoundEnabled(true);
      audioModule.playSound('click', 1);

      const osc = mockCtx._oscillators[0];
      expect(osc.connect).toHaveBeenCalledWith(mockCtx._gainNodes[0]);
    });
  });

  describe('toggling soundEnabled switches audio on and off', () => {
    it('audio is off, then on, then off again', () => {
      // Start with sound off
      audioModule.setSoundEnabled(false);
      expect(audioModule.playSound('click')).toBeNull();
      expect(mockCtx._oscillators.length).toBe(0);

      // Turn sound on
      audioModule.setSoundEnabled(true);
      expect(audioModule.playSound('click')).not.toBeNull();
      expect(mockCtx._oscillators.length).toBe(1);

      // Turn sound off again
      mockCtx._reset(); // clear previous nodes
      audioModule.setSoundEnabled(false);
      expect(audioModule.playSound('click')).toBeNull();
      expect(mockCtx._oscillators.length).toBe(0);
    });

    it('isSoundEnabled reflects current state', () => {
      expect(audioModule.isSoundEnabled()).toBe(true); // default

      audioModule.setSoundEnabled(false);
      expect(audioModule.isSoundEnabled()).toBe(false);

      audioModule.setSoundEnabled(true);
      expect(audioModule.isSoundEnabled()).toBe(true);
    });
  });

  describe('sound patterns with different characteristics', () => {
    it('sine wave sound (click) creates nodes when enabled', () => {
      audioModule.setSoundEnabled(true);
      audioModule.playSound('click');
      expect(mockCtx._oscillators.length).toBe(1);
    });

    it('sawtooth wave sound (fail) creates nodes when enabled', () => {
      audioModule.setSoundEnabled(true);
      audioModule.playSound('fail');
      expect(mockCtx._oscillators.length).toBe(1);
      expect(mockCtx._oscillators[0].type).toBe('sawtooth');
    });

    it('square wave sound (levelComplete) creates nodes when enabled', () => {
      audioModule.setSoundEnabled(true);
      audioModule.playSound('levelComplete');
      expect(mockCtx._oscillators.length).toBe(1);
      expect(mockCtx._oscillators[0].type).toBe('square');
    });

    it('triangle wave sound (whoosh) creates nodes when enabled', () => {
      audioModule.setSoundEnabled(true);
      audioModule.playSound('whoosh');
      expect(mockCtx._oscillators.length).toBe(1);
      expect(mockCtx._oscillators[0].type).toBe('triangle');
    });
  });
});
