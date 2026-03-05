/**
 * Parking Escape - Audio System
 *
 * Synthesized sound effects for:
 * - Car drag/start
 * - Car snap to grid
 * - Invalid move
 * - Level complete
 * - UI feedback
 */

class ParkingEscapeAudio {
  constructor() {
    this.context = null;
    this.muted = false;
    this.masterVolume = 0.5;
    this.initialized = false;
  }

  /**
   * Initialize audio context (must be called from user gesture)
   */
  init() {
    if (this.initialized) return;

    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  /**
   * Resume audio context if suspended
   */
  async resume() {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  /**
   * Play a tone
   */
  playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!this.context || this.muted) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);

    const adjustedVolume = volume * this.masterVolume;
    gainNode.gain.setValueAtTime(adjustedVolume, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.context.currentTime + duration
    );

    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + duration);
  }

  /**
   * Play car pickup/drag start sound
   */
  playPickup() {
    this.playTone(400, 0.08, 'sine', 0.2);
  }

  /**
   * Play car snap sound
   */
  playSnap() {
    this.playTone(500, 0.1, 'sine', 0.25);
    setTimeout(() => this.playTone(600, 0.08, 'sine', 0.2), 50);
  }

  /**
   * Play car sliding sound (continuous drag)
   */
  playSlide() {
    this.playTone(300, 0.05, 'triangle', 0.1);
  }

  /**
   * Play invalid move sound
   */
  playInvalid() {
    this.playTone(200, 0.15, 'square', 0.15);
    setTimeout(() => this.playTone(150, 0.2, 'square', 0.15), 100);
  }

  /**
   * Play level complete fanfare
   */
  playWin() {
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 0.3, 'sine', 0.3);
      }, i * 150);
    });
  }

  /**
   * Play select/click sound
   */
  playSelect() {
    this.playTone(440, 0.1, 'sine', 0.2);
  }

  /**
   * Play car exit sound
   */
  playExit() {
    // Engine rev sound
    this.playTone(150, 0.3, 'sawtooth', 0.2);
    setTimeout(() => this.playTone(200, 0.2, 'sawtooth', 0.25), 100);
    setTimeout(() => this.playTone(250, 0.15, 'sawtooth', 0.2), 200);
  }

  /**
   * Toggle mute
   */
  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Set master volume
   */
  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }
}

export const audio = new ParkingEscapeAudio();
export default audio;
