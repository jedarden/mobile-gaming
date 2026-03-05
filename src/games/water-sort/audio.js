/**
 * Water Sort - Audio Manager
 *
 * Manages sound effects for the water sort game:
 * - Pour sounds (liquid glugging effect)
 * - Invalid shake sound
 * - Tube complete celebration
 * - Level win fanfare
 * - UI feedback
 */

import { audio as sharedAudio } from '../../shared/audio.js';

class WaterSortAudio {
  constructor() {
    this.initialized = false;
    this.muted = false;
    this.volume = 0.5;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Initialize shared audio context
    sharedAudio.init();
  }

  resume() {
    sharedAudio.resume();
  }

  setVolume(vol) {
    this.volume = vol;
    this.muted = vol === 0;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Play liquid pour sound - glugging/bubbling effect
   */
  playPour() {
    if (this.muted) return;

    // Create a liquid glugging sound with frequency sweeps
    const baseVolume = this.volume * 0.25;

    // Initial pour splash
    sharedAudio.playTone(350, 0.08, 'sine', baseVolume);

    // Glug sequence - simulates liquid flowing
    setTimeout(() => sharedAudio.playTone(280, 0.06, 'sine', baseVolume * 0.7), 40);
    setTimeout(() => sharedAudio.playTone(320, 0.06, 'sine', baseVolume * 0.6), 80);
    setTimeout(() => sharedAudio.playTone(260, 0.07, 'sine', baseVolume * 0.5), 120);
    setTimeout(() => sharedAudio.playTone(240, 0.08, 'triangle', baseVolume * 0.4), 160);
  }

  /**
   * Play tube selection sound
   */
  playSelect() {
    if (this.muted) return;
    sharedAudio.playTone(600, 0.08, 'sine', this.volume * 0.2);
  }

  /**
   * Play invalid move shake sound - rattling buzz
   */
  playShake() {
    if (this.muted) return;

    const baseVolume = this.volume * 0.2;

    // Rattling shake effect
    sharedAudio.playTone(180, 0.06, 'square', baseVolume);
    setTimeout(() => sharedAudio.playTone(220, 0.05, 'square', baseVolume * 0.8), 50);
    setTimeout(() => sharedAudio.playTone(180, 0.06, 'square', baseVolume * 0.6), 100);
    setTimeout(() => sharedAudio.playTone(160, 0.08, 'square', baseVolume * 0.4), 150);
  }

  /**
   * Play error sound (kept for backward compatibility, uses shake)
   */
  playError() {
    this.playShake();
  }

  /**
   * Play tube complete celebration sound
   */
  playComplete() {
    if (this.muted) return;

    const baseVolume = this.volume * 0.3;

    // Ascending celebration chime
    sharedAudio.playTone(523, 0.1, 'sine', baseVolume);      // C5
    setTimeout(() => sharedAudio.playTone(659, 0.1, 'sine', baseVolume * 0.9), 80);  // E5
    setTimeout(() => sharedAudio.playTone(784, 0.15, 'sine', baseVolume * 0.8), 160); // G5
  }

  /**
   * Play level win fanfare
   */
  playWin() {
    if (this.muted) return;

    const baseVolume = this.volume * 0.35;
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      setTimeout(() => {
        sharedAudio.playTone(freq, 0.25, 'sine', baseVolume);
      }, i * 150);
    });

    // Add a final flourish
    setTimeout(() => {
      sharedAudio.playTone(1319, 0.3, 'sine', baseVolume * 0.8); // E6
    }, 600);
  }
}

export const audio = new WaterSortAudio();
