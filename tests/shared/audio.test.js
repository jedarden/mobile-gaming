import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Create mock AudioContext once and reuse (module caches it internally)
function createMockAudioContext() {
  return {
    state: 'suspended',
    currentTime: 0,
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
      this._gainNodes = this._gainNodes || [];
      this._gainNodes.push(node);
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
      this._oscillators = this._oscillators || [];
      this._oscillators.push(node);
      return node;
    },
    resume: vi.fn(async function() { this.state = 'running'; }),
    suspend: vi.fn(function() { this.state = 'suspended'; })
  };
}

// Must use resetModules to get fresh module state since audioContext is cached
let audioModule;
let mockCtx;

async function getFreshModule() {
  mockCtx = createMockAudioContext();
  global.window = { AudioContext: vi.fn(() => mockCtx) };
  vi.resetModules();
  return await import('../../src/shared/audio.js');
}

describe('audio', () => {
  beforeEach(async () => {
    audioModule = await getFreshModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resumeAudio', () => {
    it('resumes a suspended audio context', async () => {
      const result = await audioModule.resumeAudio();
      expect(result).toBe(true);
      expect(mockCtx.resume).toHaveBeenCalled();
    });

    it('returns true when already running', async () => {
      mockCtx.state = 'running';
      const result = await audioModule.resumeAudio();
      expect(result).toBe(true);
      expect(mockCtx.resume).not.toHaveBeenCalled();
    });
  });

  describe('sound enabled/volume', () => {
    it('toggles sound enabled', () => {
      audioModule.setSoundEnabled(false);
      expect(audioModule.isSoundEnabled()).toBe(false);
      audioModule.setSoundEnabled(true);
      expect(audioModule.isSoundEnabled()).toBe(true);
    });

    it('sets master volume (clamped 0-1)', () => {
      audioModule.setMasterVolume(0.8);
      expect(audioModule.getMasterVolume()).toBe(0.8);

      audioModule.setMasterVolume(2);
      expect(audioModule.getMasterVolume()).toBe(1);

      audioModule.setMasterVolume(-1);
      expect(audioModule.getMasterVolume()).toBe(0);
    });
  });

  describe('SOUNDS', () => {
    it('has all expected sound patterns', () => {
      const expected = ['click', 'success', 'successChord', 'fail', 'whoosh',
        'pop', 'tap', 'slide', 'bounce', 'collect', 'levelComplete'];
      for (const name of expected) {
        expect(audioModule.SOUNDS[name]).toBeDefined();
        expect(audioModule.SOUNDS[name]).toHaveProperty('type');
        expect(audioModule.SOUNDS[name]).toHaveProperty('frequency');
        expect(audioModule.SOUNDS[name]).toHaveProperty('duration');
      }
    });
  });

  describe('playSound', () => {
    it('returns null for unknown sound', () => {
      expect(audioModule.playSound('nonexistent')).toBeNull();
    });

    it('returns null when sound is disabled', () => {
      audioModule.setSoundEnabled(false);
      expect(audioModule.playSound('click')).toBeNull();
    });

    it('plays a known sound and returns gain node', async () => {
      await audioModule.resumeAudio();
      const result = audioModule.playSound('click');
      expect(result).toBeDefined();
      expect(mockCtx._oscillators.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('convenience play functions', () => {
    beforeEach(async () => {
      await audioModule.resumeAudio();
    });

    it('playClick creates oscillator', () => {
      audioModule.playClick();
      expect(mockCtx._oscillators.length).toBeGreaterThanOrEqual(1);
    });

    it('playFail creates oscillator', () => {
      audioModule.playFail();
      expect(mockCtx._oscillators.length).toBeGreaterThanOrEqual(1);
    });

    it('playWhoosh creates oscillator', () => {
      audioModule.playWhoosh();
      expect(mockCtx._oscillators.length).toBeGreaterThanOrEqual(1);
    });

    it('playPop creates oscillator', () => {
      audioModule.playPop();
      expect(mockCtx._oscillators.length).toBeGreaterThanOrEqual(1);
    });

    it('playTap creates oscillator', () => {
      audioModule.playTap();
      expect(mockCtx._oscillators.length).toBeGreaterThanOrEqual(1);
    });

    it('playSlide creates oscillator', () => {
      audioModule.playSlide();
      expect(mockCtx._oscillators.length).toBeGreaterThanOrEqual(1);
    });

    it('playBounce creates oscillator', () => {
      audioModule.playBounce();
      expect(mockCtx._oscillators.length).toBeGreaterThanOrEqual(1);
    });

    it('playCollect creates oscillator', () => {
      audioModule.playCollect();
      expect(mockCtx._oscillators.length).toBeGreaterThanOrEqual(1);
    });

    it('playLevelComplete creates oscillators (first note)', () => {
      audioModule.playLevelComplete();
      expect(mockCtx._oscillators.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('playSuccess', () => {
    it('plays success note immediately', async () => {
      await audioModule.resumeAudio();
      audioModule.playSuccess();
      expect(mockCtx._oscillators.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('createSoundPattern', () => {
    it('creates a pattern with defaults', () => {
      const pattern = audioModule.createSoundPattern({ frequency: 440 });
      expect(pattern.type).toBe('sine');
      expect(pattern.frequency).toBe(440);
      expect(pattern.duration).toBe(0.1);
    });

    it('creates a pattern with all options', () => {
      const pattern = audioModule.createSoundPattern({
        type: 'square',
        frequency: 880,
        frequencyEnd: 440,
        duration: 0.5,
        attack: 0.05,
        decay: 0.4
      });
      expect(pattern).toEqual({
        type: 'square',
        frequency: 880,
        frequencyEnd: 440,
        duration: 0.5,
        attack: 0.05,
        decay: 0.4
      });
    });
  });

  describe('suspendAudio', () => {
    it('suspends a running audio context', async () => {
      await audioModule.resumeAudio();
      mockCtx.state = 'running';

      audioModule.suspendAudio();
      expect(mockCtx.suspend).toHaveBeenCalled();
    });

    it('does nothing when context is not initialized', () => {
      expect(() => audioModule.suspendAudio()).not.toThrow();
    });
  });

  describe('isAudioSupported', () => {
    it('returns true when AudioContext is available', () => {
      expect(audioModule.isAudioSupported()).toBe(true);
    });

    it('returns false when AudioContext is not available', async () => {
      // Remove AudioContext from window mock
      delete global.window.AudioContext;
      delete global.window.webkitAudioContext;

      // Get fresh module to re-evaluate audio support
      vi.resetModules();
      const mod = await import('../../src/shared/audio.js');

      expect(mod.isAudioSupported()).toBe(false);

      // Restore AudioContext for other tests
      global.window.AudioContext = vi.fn(() => mockCtx);
    });
  });
});
