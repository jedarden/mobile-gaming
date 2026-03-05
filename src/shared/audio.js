/**
 * Audio.js - Sound Manager
 *
 * Manages game audio with:
 * - Sound effect playback with pooling
 * - Volume control
 * - Mute/unmute functionality
 * - Ambient audio for zen mode
 */

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
    const audio = new window.Audio();
    audio.src = src;
    audio.preload = 'auto';
    this.sounds.set(id, audio);

    // Add to pool for overlapping playback
    for (let i = 0; i < this.poolSize; i++) {
      const clone = audio.cloneNode();
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
