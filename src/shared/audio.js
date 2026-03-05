/**
 * Audio.js - Sound Manager
 *
 * Manages game audio with:
 * - Sound effect playback with pooling (HTML Audio)
 * - Web Audio API synthesis for tones
 * - Volume control
 * - Mute/unmute functionality
 * - Ambient audio for zen mode
 */

// Web Audio API context for synthesized sounds
let audioContext = null;

/**
 * Initialize the Web Audio API context
 * Must be called after user interaction due to browser autoplay policies
 */
function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Resume audio context if suspended (required after user interaction)
 */
function resumeAudioContext() {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

/**
 * Play a synthesized tone
 * @param {number} frequency - Frequency in Hz
 * @param {number} duration - Duration in seconds
 * @param {string} [type='sine'] - Oscillator type (sine, square, sawtooth, triangle)
 * @param {number} [volume=1] - Volume (0-1)
 */
function playTone(frequency, duration, type = 'sine', volume = 1) {
  if (!audioContext) {
    initAudioContext();
  }

  if (audioContext.state === 'suspended') {
    resumeAudioContext();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

  gainNode.gain.setValueAtTime(volume * 0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

// Web Audio API interface for synthesized sounds
export const audio = {
  muted: false,
  masterVolume: 1.0,

  /**
   * Initialize the audio context
   */
  init() {
    initAudioContext();
  },

  /**
   * Resume audio playback (call after user interaction)
   */
  resume() {
    resumeAudioContext();
  },

  /**
   * Play a synthesized tone
   * @param {number} frequency - Frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {string} [type='sine'] - Oscillator type
   * @param {number} [volume=1] - Volume (0-1)
   */
  playTone(frequency, duration, type = 'sine', volume = 1) {
    if (this.muted) return;
    playTone(frequency, duration, type, volume * this.masterVolume);
  },

  /**
   * Set master volume
   * @param {number} vol - Volume (0-1)
   */
  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  },

  /**
   * Toggle mute state
   * @returns {boolean} New mute state
   */
  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
};

// HTML Audio element pool for pre-recorded sounds
export const Audio = {
  sounds: new Map(),
  pool: [],
  poolSize: 8,
  muted: false,
  masterVolume: 1.0,

  /**
   * Preload a sound effect
   * @param {string} id - Sound identifier
   * @param {string} src - Path to audio file
   */
  load(id, src) {
    const audioEl = new window.Audio();
    audioEl.src = src;
    audioEl.preload = 'auto';
    this.sounds.set(id, audioEl);

    // Add to pool for overlapping playback
    for (let i = 0; i < this.poolSize; i++) {
      const clone = audioEl.cloneNode();
      this.pool.push({ id, audio: clone, playing: false });
    }
  },

  /**
   * Play a sound effect
   * @param {string} id - Sound identifier
   * @param {number} [volume=1] - Volume (0-1)
   */
  play(id, volume = 1) {
    if (this.muted) return;

    // Find available pooled audio
    const available = this.pool.find(p => p.id === id && !p.playing);
    if (available) {
      available.audio.volume = volume * this.masterVolume;
      available.playing = true;
      available.audio.currentTime = 0;
      available.audio.play().finally(() => {
        available.playing = false;
      });
    }
  },

  /**
   * Set master volume
   * @param {number} vol - Volume (0-1)
   */
  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  },

  /**
   * Toggle mute state
   * @returns {boolean} New mute state
   */
  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
};

export default Audio;
