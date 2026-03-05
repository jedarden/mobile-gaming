/**
 * ZenMode.js - Relaxation-focused Gameplay Module
 *
 * Manages Zen mode state, settings, and session tracking:
 * - Toggle zen mode on/off
 * - Ambient audio management
 * - Session statistics (without competitive metrics)
 * - Smooth transitions between modes
 */

import { getSettings, updateSettings } from './storage.js';

// Zen mode configuration
const ZEN_CONFIG = {
  // XP rate in zen mode (flat rate, no bonuses)
  XP_PER_PUZZLE: 5,
  
  // Ambient track definitions
  AMBIENT_TRACKS: {
    silence: { name: 'Silence', src: null },
    rain: { name: 'Rain', src: '/audio/ambient/rain-loop.mp3' },
    piano: { name: 'Soft Piano', src: '/audio/ambient/soft-piano.mp3' },
    nature: { name: 'Nature', src: '/audio/ambient/forest.mp3' },
    lofi: { name: 'Lo-fi', src: '/audio/ambient/lofi-beats.mp3' },
    ocean: { name: 'Ocean', src: '/audio/ambient/ocean-waves.mp3' }
  },
  
  // Completion messages (gentle, non-competitive)
  COMPLETION_MESSAGES: [
    'Beautiful ✨',
    'Lovely 🌸',
    'Peaceful 🍃',
    'Serene 🌊',
    'Calm 🌙',
    'Harmony 🎋',
    'Tranquil 🌿',
    'Mindful 🧘'
  ],
  
  // Session quotes
  SESSION_QUOTES: [
    'Take a deep breath. Well done.',
    'A moment of peace in a busy world.',
    'You deserve this quiet time.',
    'Every puzzle solved is a small meditation.',
    'Enjoy the journey, not just the destination.'
  ]
};

// Zen mode state
let zenState = {
  enabled: false,
  ambiance: 'silence',
  volume: 0.3,
  sessionStart: null,
  puzzlesCompleted: 0,
  transitioning: false
};

// Ambient audio instance
let ambientAudio = null;

/**
 * Initialize Zen mode from stored settings
 */
export function initZenMode() {
  const settings = getSettings();
  
  zenState.enabled = settings.zenMode || false;
  zenState.ambiance = settings.zenAmbiance || 'silence';
  zenState.volume = settings.zenVolume ?? 0.3;
  
  // Apply zen mode class if enabled
  if (zenState.enabled) {
    applyZenMode(true);
  }
  
  // Initialize ambient audio
  initAmbientAudio();
  
  return zenState;
}

/**
 * Check if zen mode is enabled
 */
export function isZenMode() {
  return zenState.enabled;
}

/**
 * Toggle zen mode on/off
 */
export async function toggleZenMode() {
  zenState.transitioning = true;
  document.body.classList.add('zen-mode-transitioning');
  
  zenState.enabled = !zenState.enabled;
  
  // Save to storage
  await updateSettings({ zenMode: zenState.enabled });
  
  // Apply visual changes
  applyZenMode(zenState.enabled);
  
  // Handle ambient audio
  if (zenState.enabled && zenState.ambiance !== 'silence') {
    await playAmbientAudio(zenState.ambiance);
  } else if (!zenState.enabled) {
    stopAmbientAudio();
  }
  
  // Reset session stats when entering zen mode
  if (zenState.enabled) {
    startZenSession();
  } else {
    endZenSession();
  }
  
  // Dispatch event for game components
  window.dispatchEvent(new CustomEvent('zenModeChanged', {
    detail: { enabled: zenState.enabled }
  }));
  
  // Remove transition class after animation
  setTimeout(() => {
    zenState.transitioning = false;
    document.body.classList.remove('zen-mode-transitioning');
  }, 500);
  
  return zenState.enabled;
}

/**
 * Apply zen mode CSS class
 */
function applyZenMode(enabled) {
  if (enabled) {
    document.body.classList.add('zen-mode');
  } else {
    document.body.classList.remove('zen-mode');
  }
}

/**
 * Initialize ambient audio system
 */
function initAmbientAudio() {
  if (ambientAudio) return;
  
  ambientAudio = new Audio();
  ambientAudio.loop = true;
  ambientAudio.volume = 0;
}

/**
 * Play ambient audio track with crossfade
 */
export async function playAmbientAudio(trackId) {
  const track = ZEN_CONFIG.AMBIENT_TRACKS[trackId];
  
  if (!track || !track.src) {
    stopAmbientAudio();
    return;
  }
  
  if (!ambientAudio) {
    initAmbientAudio();
  }
  
  // Crossfade if already playing
  if (!ambientAudio.paused) {
    await fadeOut(500);
  }
  
  ambientAudio.src = track.src;
  ambientAudio.volume = 0;
  
  try {
    await ambientAudio.play();
    await fadeIn(1000);
    zenState.ambiance = trackId;
    await updateSettings({ zenAmbiance: trackId });
  } catch (error) {
    console.warn('[ZenMode] Failed to play ambient audio:', error);
  }
}

/**
 * Stop ambient audio with fade out
 */
export async function stopAmbientAudio() {
  if (!ambientAudio || ambientAudio.paused) return;
  
  await fadeOut(500);
  ambientAudio.src = '';
}

/**
 * Set ambient audio volume
 */
export async function setAmbientVolume(volume) {
  zenState.volume = Math.max(0, Math.min(1, volume));
  
  if (ambientAudio) {
    ambientAudio.volume = zenState.volume;
  }
  
  await updateSettings({ zenVolume: zenState.volume });
  
  return zenState.volume;
}

/**
 * Get current ambiance setting
 */
export function getAmbiance() {
  return zenState.ambiance;
}

/**
 * Get current volume setting
 */
export function getVolume() {
  return zenState.volume;
}

/**
 * Fade in audio
 */
async function fadeIn(duration) {
  const steps = 20;
  const stepTime = duration / steps;
  const stepVolume = zenState.volume / steps;
  
  for (let i = 0; i < steps; i++) {
    await new Promise(resolve => setTimeout(resolve, stepTime));
    if (ambientAudio) {
      ambientAudio.volume = Math.min(zenState.volume, ambientAudio.volume + stepVolume);
    }
  }
}

/**
 * Fade out audio
 */
async function fadeOut(duration) {
  const steps = 20;
  const stepTime = duration / steps;
  const startVolume = ambientAudio ? ambientAudio.volume : 0;
  const stepVolume = startVolume / steps;
  
  for (let i = 0; i < steps; i++) {
    await new Promise(resolve => setTimeout(resolve, stepTime));
    if (ambientAudio) {
      ambientAudio.volume = Math.max(0, ambientAudio.volume - stepVolume);
    }
  }
  
  if (ambientAudio) {
    ambientAudio.pause();
  }
}

/**
 * Start a zen session
 */
export function startZenSession() {
  zenState.sessionStart = Date.now();
  zenState.puzzlesCompleted = 0;
}

/**
 * End a zen session
 */
export function endZenSession() {
  const session = {
    duration: zenState.sessionStart ? Date.now() - zenState.sessionStart : 0,
    puzzlesCompleted: zenState.puzzlesCompleted
  };
  
  zenState.sessionStart = null;
  zenState.puzzlesCompleted = 0;
  
  return session;
}

/**
 * Record a puzzle completion in zen mode
 */
export function recordPuzzleCompletion() {
  if (!zenState.enabled) return null;
  
  zenState.puzzlesCompleted++;
  
  // Award flat XP rate (no bonuses in zen mode)
  const xp = ZEN_CONFIG.XP_PER_PUZZLE;
  
  return {
    xp,
    message: getRandomCompletionMessage()
  };
}

/**
 * Get random completion message
 */
export function getRandomCompletionMessage() {
  const messages = ZEN_CONFIG.COMPLETION_MESSAGES;
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Get random session quote
 */
export function getRandomSessionQuote() {
  const quotes = ZEN_CONFIG.SESSION_QUOTES;
  return quotes[Math.floor(Math.random() * quotes.length)];
}

/**
 * Format session duration
 */
export function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (minutes === 0) {
    return `${seconds} seconds`;
  }
  
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Get session summary for display
 */
export function getSessionSummary() {
  const duration = zenState.sessionStart ? Date.now() - zenState.sessionStart : 0;
  
  return {
    puzzlesCompleted: zenState.puzzlesCompleted,
    duration,
    durationFormatted: formatDuration(duration),
    quote: getRandomSessionQuote()
  };
}

/**
 * Get available ambient tracks
 */
export function getAmbientTracks() {
  return Object.entries(ZEN_CONFIG.AMBIENT_TRACKS).map(([id, track]) => ({
    id,
    name: track.name,
    available: !track.src || checkAudioAvailable(track.src)
  }));
}

/**
 * Check if audio file is available
 */
async function checkAudioAvailable(src) {
  try {
    const response = await fetch(src, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get zen mode configuration
 */
export function getZenConfig() {
  return { ...ZEN_CONFIG };
}

// Export configuration for external use
export { ZEN_CONFIG };

export default {
  initZenMode,
  isZenMode,
  toggleZenMode,
  playAmbientAudio,
  stopAmbientAudio,
  setAmbientVolume,
  getAmbiance,
  getVolume,
  startZenSession,
  endZenSession,
  recordPuzzleCompletion,
  getRandomCompletionMessage,
  getRandomSessionQuote,
  formatDuration,
  getSessionSummary,
  getAmbientTracks,
  getZenConfig
};
