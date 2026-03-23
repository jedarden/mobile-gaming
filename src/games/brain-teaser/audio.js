/**
 * Brain Teaser - Audio System
 *
 * Synthesized sound effects for:
 * - Correct solution
 * - Wrong answer (decoy hit)
 * - Puzzle complete
 * - UI feedback
 */

class BrainTeaserAudio {
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
    } catch (_e) {
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
   * Play correct answer sound
   */
  playCorrect() {
    // Happy ascending chime
    this.playTone(523, 0.15, 'sine', 0.3); // C5
    setTimeout(() => this.playTone(659, 0.15, 'sine', 0.3), 100); // E5
    setTimeout(() => this.playTone(784, 0.2, 'sine', 0.3), 200); // G5
  }

  /**
   * Play wrong answer sound
   */
  playWrong() {
    // Descending buzz
    this.playTone(300, 0.15, 'square', 0.2);
    setTimeout(() => this.playTone(200, 0.2, 'square', 0.2), 100);
  }

  /**
   * Play puzzle complete fanfare
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
   * Play select sound
   */
  playSelect() {
    this.playTone(440, 0.1, 'sine', 0.2);
  }

  /**
   * Play tap sound
   */
  playTap() {
    this.playTone(600, 0.08, 'sine', 0.15);
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

export const audio = new BrainTeaserAudio();
export default audio;
