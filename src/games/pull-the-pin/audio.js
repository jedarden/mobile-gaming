/**
 * Pull the Pin - Audio Manager
 *
 * Manages game audio with:
 * - Sound effects for pin removal, ball bounces, hazards
 * - Victory and failure sounds
 * - Volume control and mute functionality
 */

// Audio state
let audioContext = null;
let sounds = {};
let muted = false;
let masterVolume = 0.7;

/**
 * Initialize audio context
 */
function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Initialize audio (public API for game initialization)
 */
export function init() {
  initAudioContext();
}

/**
 * Generate a simple tone
 */
function playTone(frequency, duration, type = 'sine', volume = 0.3) {
  if (muted) return;

  const ctx = initAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  gainNode.gain.setValueAtTime(volume * masterVolume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

/**
 * Play pin removal sound
 */
export function playPinRemove() {
  if (muted) return;

  const ctx = initAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(800, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);

  gainNode.gain.setValueAtTime(0.3 * masterVolume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.15);
}

/**
 * Play ball bounce sound
 */
export function playBounce(intensity = 1) {
  if (muted) return;

  const ctx = initAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(200 * intensity, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);

  const volume = Math.min(0.2, 0.1 * intensity) * masterVolume;
  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.05);
}

/**
 * Play hazard destruction sound
 */
export function playHazard() {
  if (muted) return;

  const ctx = initAudioContext();

  // Create noise for sizzle effect
  const bufferSize = ctx.sampleRate * 0.3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(2000, ctx.currentTime);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.3 * masterVolume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  noise.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);

  noise.start(ctx.currentTime);
  noise.stop(ctx.currentTime + 0.3);
}

/**
 * Play goal collection sound
 */
export function playCollect() {
  if (muted) return;

  const ctx = initAudioContext();

  // Arpeggio for collection
  const notes = [523, 659, 784]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.05);

    const startTime = ctx.currentTime + i * 0.05;
    gainNode.gain.setValueAtTime(0.2 * masterVolume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.2);
  });
}

/**
 * Play victory sound
 */
export function playVictory() {
  if (muted) return;

  const ctx = initAudioContext();

  // Major chord arpeggio
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);

    const startTime = ctx.currentTime + i * 0.1;
    gainNode.gain.setValueAtTime(0.25 * masterVolume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.4);
  });
}

/**
 * Play failure sound
 */
export function playFailure() {
  if (muted) return;

  const ctx = initAudioContext();

  // Descending minor tones
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(300, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);

  gainNode.gain.setValueAtTime(0.2 * masterVolume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.5);
}

/**
 * Toggle mute state
 */
export function toggleMute() {
  muted = !muted;
  return muted;
}

/**
 * Set master volume
 */
export function setVolume(volume) {
  masterVolume = Math.max(0, Math.min(1, volume));
}

/**
 * Check if muted
 */
export function isMuted() {
  return muted;
}

export default {
  init,
  playPinRemove,
  playBounce,
  playHazard,
  playCollect,
  playVictory,
  playFailure,
  toggleMute,
  setVolume,
  isMuted
};
