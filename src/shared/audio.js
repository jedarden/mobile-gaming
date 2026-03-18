/**
 * Audio utilities using Web Audio API
 *
 * Synthesized sounds using oscillators (no external audio files).
 * Includes prebuilt sound patterns for common game events.
 */

// Audio context (lazily initialized)
let audioContext = null;

// Sound enabled state
let soundEnabled = true;

// Master volume
let masterVolume = 0.5;

/**
 * Get or create the audio context
 *
 * @returns {AudioContext} The audio context
 */
function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Resume the audio context (required after user interaction)
 *
 * @returns {Promise<boolean>} True if resumed successfully
 */
export async function resumeAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Set whether sound is enabled
 *
 * @param {boolean} enabled - Whether sounds should play
 */
export function setSoundEnabled(enabled) {
  soundEnabled = enabled;
}

/**
 * Check if sound is enabled
 *
 * @returns {boolean} Current sound enabled state
 */
export function isSoundEnabled() {
  return soundEnabled;
}

/**
 * Set the master volume
 *
 * @param {number} volume - Volume from 0 to 1
 */
export function setMasterVolume(volume) {
  masterVolume = Math.max(0, Math.min(1, volume));
}

/**
 * Get the current master volume
 *
 * @returns {number} Current volume (0 to 1)
 */
export function getMasterVolume() {
  return masterVolume;
}

/**
 * Play a synthesized sound
 *
 * @param {Object} pattern - Sound pattern definition
 * @param {number} volume - Volume multiplier (0 to 1)
 * @returns {AudioNode|null} The gain node for this sound (or null if disabled)
 */
function playSoundPattern(pattern, volume = 1) {
  if (!soundEnabled || volume <= 0) {
    return null;
  }

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Create gain node for this sound
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.setValueAtTime(0, now);

    // Apply master volume and sound volume
    const finalVolume = masterVolume * volume;

    // Create oscillator
    const osc = ctx.createOscillator();
    osc.connect(gainNode);

    // Apply pattern settings
    if (pattern.type) {
      osc.type = pattern.type;
    }

    if (pattern.frequency !== undefined) {
      osc.frequency.setValueAtTime(pattern.frequency, now);
    }

    if (pattern.frequencyEnd !== undefined) {
      const duration = pattern.duration || 0.1;
      osc.frequency.exponentialRampToValueAtTime(
        pattern.frequencyEnd,
        now + duration
      );
    }

    // Envelope
    const attackTime = pattern.attack || 0.01;
    const decayTime = pattern.decay || 0.05;
    const duration = pattern.duration || 0.1;

    gainNode.gain.linearRampToValueAtTime(finalVolume, now + attackTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime);

    // Start and stop
    osc.start(now);
    osc.stop(now + duration);

    // Cleanup after sound finishes
    setTimeout(() => {
      osc.disconnect();
      gainNode.disconnect();
    }, (duration + 0.1) * 1000);

    return gainNode;
  } catch (e) {
    // Audio failed (context not allowed, etc.)
    return null;
  }
}

/**
 * Prebuilt sound patterns
 */
export const SOUNDS = {
  click: {
    type: 'sine',
    frequency: 800,
    frequencyEnd: 600,
    duration: 0.05,
    attack: 0.01,
    decay: 0.04
  },

  success: {
    type: 'sine',
    frequency: 523.25,  // C5
    duration: 0.15,
    attack: 0.01,
    decay: 0.14
  },

  successChord: {
    type: 'sine',
    frequency: 659.25,  // E5
    duration: 0.2,
    attack: 0.01,
    decay: 0.19
  },

  fail: {
    type: 'sawtooth',
    frequency: 200,
    frequencyEnd: 100,
    duration: 0.2,
    attack: 0.02,
    decay: 0.18
  },

  whoosh: {
    type: 'triangle',
    frequency: 100,
    frequencyEnd: 400,
    duration: 0.15,
    attack: 0.02,
    decay: 0.13
  },

  pop: {
    type: 'sine',
    frequency: 600,
    frequencyEnd: 200,
    duration: 0.08,
    attack: 0.005,
    decay: 0.075
  },

  tap: {
    type: 'sine',
    frequency: 1000,
    duration: 0.03,
    attack: 0.005,
    decay: 0.025
  },

  slide: {
    type: 'triangle',
    frequency: 300,
    frequencyEnd: 500,
    duration: 0.1,
    attack: 0.01,
    decay: 0.09
  },

  bounce: {
    type: 'sine',
    frequency: 400,
    duration: 0.08,
    attack: 0.01,
    decay: 0.07
  },

  collect: {
    type: 'sine',
    frequency: 880,  // A5
    frequencyEnd: 1760,  // A6
    duration: 0.1,
    attack: 0.01,
    decay: 0.09
  },

  levelComplete: {
    type: 'square',
    frequency: 440,  // A4
    duration: 0.3,
    attack: 0.02,
    decay: 0.28
  }
};

/**
 * Play a sound by name
 *
 * @param {string} name - Sound name from SOUNDS object
 * @param {number} volume - Volume multiplier (0 to 1)
 * @returns {AudioNode|null} The gain node (or null if disabled)
 */
export function playSound(name, volume = 1) {
  const pattern = SOUNDS[name];
  if (!pattern) {
    return null;
  }
  return playSoundPattern(pattern, volume);
}

/**
 * Play a click sound
 *
 * @param {number} volume - Volume (0 to 1)
 */
export function playClick(volume = 1) {
  playSoundPattern(SOUNDS.click, volume);
}

/**
 * Play a success sound
 *
 * @param {number} volume - Volume (0 to 1)
 */
export function playSuccess(volume = 1) {
  playSoundPattern(SOUNDS.success, volume);
  // Play chord after short delay
  setTimeout(() => playSoundPattern(SOUNDS.successChord, volume * 0.7), 80);
}

/**
 * Play a fail sound
 *
 * @param {number} volume - Volume (0 to 1)
 */
export function playFail(volume = 1) {
  playSoundPattern(SOUNDS.fail, volume);
}

/**
 * Play a whoosh sound
 *
 * @param {number} volume - Volume (0 to 1)
 */
export function playWhoosh(volume = 1) {
  playSoundPattern(SOUNDS.whoosh, volume);
}

/**
 * Play a pop sound
 *
 * @param {number} volume - Volume (0 to 1)
 */
export function playPop(volume = 1) {
  playSoundPattern(SOUNDS.pop, volume);
}

/**
 * Play a tap sound
 *
 * @param {number} volume - Volume (0 to 1)
 */
export function playTap(volume = 1) {
  playSoundPattern(SOUNDS.tap, volume);
}

/**
 * Play a slide sound
 *
 * @param {number} volume - Volume (0 to 1)
 */
export function playSlide(volume = 1) {
  playSoundPattern(SOUNDS.slide, volume);
}

/**
 * Play a bounce sound
 *
 * @param {number} volume - Volume (0 to 1)
 */
export function playBounce(volume = 1) {
  playSoundPattern(SOUNDS.bounce, volume);
}

/**
 * Play a collect sound
 *
 * @param {number} volume - Volume (0 to 1)
 */
export function playCollect(volume = 1) {
  playSoundPattern(SOUNDS.collect, volume);
}

/**
 * Play a level complete sound
 *
 * @param {number} volume - Volume (0 to 1)
 */
export function playLevelComplete(volume = 1) {
  playSoundPattern(SOUNDS.levelComplete, volume);
  // Follow with success chord
  setTimeout(() => playSoundPattern(SOUNDS.successChord, volume * 0.6), 150);
}

/**
 * Create a custom sound pattern
 *
 * @param {Object} options - Sound configuration
 * @param {string} options.type - Oscillator type (sine, square, sawtooth, triangle)
 * @param {number} options.frequency - Start frequency in Hz
 * @param {number} options.frequencyEnd - End frequency (optional, for pitch sweeps)
 * @param {number} options.duration - Sound duration in seconds
 * @param {number} options.attack - Attack time in seconds
 * @param {number} options.decay - Decay time in seconds
 * @returns {Object} Sound pattern object
 */
export function createSoundPattern(options) {
  return {
    type: options.type || 'sine',
    frequency: options.frequency || 440,
    frequencyEnd: options.frequencyEnd,
    duration: options.duration || 0.1,
    attack: options.attack || 0.01,
    decay: options.decay || 0.09
  };
}

/**
 * Suspend the audio context to save resources
 */
export function suspendAudio() {
  if (audioContext && audioContext.state === 'running') {
    audioContext.suspend();
  }
}

/**
 * Check if Web Audio API is supported
 *
 * @returns {boolean} True if supported
 */
export function isAudioSupported() {
  return !!(window.AudioContext || window.webkitAudioContext);
}
