/**
 * Water Sort - Audio Manager
 *
 * Manages sound effects for the water sort game:
 * - Pour sounds
 * - Win celebration
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
  
  playPour() {
    if (this.muted) return;
    sharedAudio.playTone(400, 0.1, 'sine', this.volume * 0.3);
    setTimeout(() => {
      sharedAudio.playTone(300, 0.1, 'sine', this.volume * 0.2);
    }, 50);
  }
  
  playSelect() {
    if (this.muted) return;
    sharedAudio.playTone(600, 0.08, 'sine', this.volume * 0.2);
  }
  
  playError() {
    if (this.muted) return;
    sharedAudio.playTone(200, 0.15, 'square', this.volume * 0.2);
  }
  
  playWin() {
    if (this.muted) return;
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => {
        sharedAudio.playTone(freq, 0.2, 'sine', this.volume * 0.3);
      }, i * 150);
    });
  }
  
  playComplete() {
    if (this.muted) return;
    sharedAudio.playTone(880, 0.15, 'sine', this.volume * 0.25);
  }
}

export const audio = new WaterSortAudio();
