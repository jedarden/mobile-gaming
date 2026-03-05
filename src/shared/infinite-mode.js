/**
 * InfiniteMode.js - Endless Puzzle Mode Module
 *
 * Provides:
 * - Toggle for infinite/endless mode
 * - Seed generation and input for reproducible puzzles
 * - Difficulty selector (easy/medium/hard)
 * - Session statistics tracking
 */

import { createRNG } from './rng.js';
import { getSettings, updateSettings, getGameStats, updateGameStats } from './storage.js';

// Difficulty configurations
export const DIFFICULTY_CONFIG = {
  easy: {
    id: 'easy',
    name: 'Easy',
    label: '😊',
    color: '#22c55e',
    ballCount: { min: 2, max: 4 },
    pinCount: { min: 1, max: 2 },
    hazardChance: 0.1,
    xpMultiplier: 1
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    label: '🤔',
    color: '#eab308',
    ballCount: { min: 3, max: 6 },
    pinCount: { min: 2, max: 4 },
    hazardChance: 0.3,
    xpMultiplier: 1.5
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    label: '😈',
    color: '#ef4444',
    ballCount: { min: 5, max: 8 },
    pinCount: { min: 3, max: 6 },
    hazardChance: 0.5,
    xpMultiplier: 2
  }
};

// Infinite mode state
let infiniteState = {
  enabled: false,
  seed: null,
  customSeed: false,
  difficulty: 'medium',
  sessionStart: null,
  puzzlesCompleted: 0,
  puzzlesAttempted: 0,
  totalScore: 0,
  bestStreak: 0,
  currentStreak: 0,
  totalTime: 0
};

/**
 * Initialize infinite mode from stored settings
 */
export function initInfiniteMode() {
  const settings = getSettings();
  
  infiniteState.enabled = settings.infiniteMode || false;
  infiniteState.difficulty = settings.infiniteDifficulty || 'medium';
  infiniteState.seed = settings.infiniteSeed || null;
  
  return infiniteState;
}

/**
 * Check if infinite mode is enabled
 */
export function isInfiniteMode() {
  return infiniteState.enabled;
}

/**
 * Toggle infinite mode on/off
 */
export async function toggleInfiniteMode() {
  infiniteState.enabled = !infiniteState.enabled;
  
  // Save to storage
  await updateSettings({ infiniteMode: infiniteState.enabled });
  
  // Reset session if enabling
  if (infiniteState.enabled) {
    startInfiniteSession();
  } else {
    endInfiniteSession();
  }
  
  // Dispatch event for game components
  window.dispatchEvent(new CustomEvent('infiniteModeChanged', {
    detail: { enabled: infiniteState.enabled }
  }));
  
  return infiniteState.enabled;
}

/**
 * Set infinite mode explicitly
 */
export async function setInfiniteMode(enabled) {
  if (infiniteState.enabled === enabled) return;
  
  infiniteState.enabled = enabled;
  await updateSettings({ infiniteMode: enabled });
  
  if (enabled) {
    startInfiniteSession();
  }
  
  window.dispatchEvent(new CustomEvent('infiniteModeChanged', {
    detail: { enabled }
  }));
}

/**
 * Get current seed
 */
export function getSeed() {
  return infiniteState.seed;
}

/**
 * Set custom seed
 */
export async function setSeed(seed) {
  // Convert to number or generate from string
  if (typeof seed === 'string' && seed.trim() !== '') {
    // Hash string to number
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    infiniteState.seed = Math.abs(hash);
    infiniteState.customSeed = true;
  } else if (typeof seed === 'number') {
    infiniteState.seed = Math.abs(Math.floor(seed));
    infiniteState.customSeed = true;
  } else {
    // Generate random seed
    infiniteState.seed = Math.floor(Math.random() * 1000000000);
    infiniteState.customSeed = false;
  }
  
  await updateSettings({ infiniteSeed: infiniteState.seed });
  
  return infiniteState.seed;
}

/**
 * Generate a new random seed
 */
export async function generateNewSeed() {
  infiniteState.seed = Math.floor(Math.random() * 1000000000);
  infiniteState.customSeed = false;
  
  await updateSettings({ infiniteSeed: infiniteState.seed });
  
  return infiniteState.seed;
}

/**
 * Get current difficulty
 */
export function getDifficulty() {
  return infiniteState.difficulty;
}

/**
 * Set difficulty
 */
export async function setDifficulty(difficulty) {
  if (!DIFFICULTY_CONFIG[difficulty]) {
    console.warn(`Invalid difficulty: ${difficulty}`);
    return null;
  }
  
  infiniteState.difficulty = difficulty;
  await updateSettings({ infiniteDifficulty: difficulty });
  
  window.dispatchEvent(new CustomEvent('infiniteDifficultyChanged', {
    detail: { difficulty }
  }));
  
  return difficulty;
}

/**
 * Get difficulty config
 */
export function getDifficultyConfig(difficulty = infiniteState.difficulty) {
  return DIFFICULTY_CONFIG[difficulty];
}

/**
 * Get all difficulty options
 */
export function getDifficultyOptions() {
  return Object.values(DIFFICULTY_CONFIG);
}

/**
 * Start an infinite session
 */
export function startInfiniteSession() {
  infiniteState.sessionStart = Date.now();
  infiniteState.puzzlesCompleted = 0;
  infiniteState.puzzlesAttempted = 0;
  infiniteState.totalScore = 0;
  infiniteState.currentStreak = 0;
  infiniteState.totalTime = 0;
  
  // Generate seed if not set
  if (!infiniteState.seed) {
    infiniteState.seed = Math.floor(Math.random() * 1000000000);
  }
  
  return infiniteState;
}

/**
 * End infinite session
 */
export function endInfiniteSession() {
  const session = { ...infiniteState };
  
  if (infiniteState.sessionStart) {
    session.duration = Date.now() - infiniteState.sessionStart;
  }
  
  infiniteState.sessionStart = null;
  
  return session;
}

/**
 * Record puzzle attempt
 */
export function recordPuzzleAttempt() {
  if (!infiniteState.enabled) return null;
  
  infiniteState.puzzlesAttempted++;
  
  return {
    attempted: infiniteState.puzzlesAttempted
  };
}

/**
 * Record puzzle completion
 */
export function recordPuzzleCompletion(score = 0) {
  if (!infiniteState.enabled) return null;
  
  infiniteState.puzzlesCompleted++;
  infiniteState.totalScore += score;
  infiniteState.currentStreak++;
  infiniteState.bestStreak = Math.max(infiniteState.bestStreak, infiniteState.currentStreak);
  
  // Advance seed for next puzzle
  infiniteState.seed = (infiniteState.seed * 1103515245 + 12345) & 0x7fffffff;
  
  return {
    completed: infiniteState.puzzlesCompleted,
    streak: infiniteState.currentStreak,
    totalScore: infiniteState.totalScore
  };
}

/**
 * Record puzzle failure
 */
export function recordPuzzleFailure() {
  if (!infiniteState.enabled) return null;
  
  infiniteState.currentStreak = 0;
  
  return {
    streak: 0
  };
}

/**
 * Get session stats
 */
export function getSessionStats() {
  const duration = infiniteState.sessionStart 
    ? Date.now() - infiniteState.sessionStart 
    : 0;
  
  return {
    enabled: infiniteState.enabled,
    seed: infiniteState.seed,
    customSeed: infiniteState.customSeed,
    difficulty: infiniteState.difficulty,
    difficultyConfig: DIFFICULTY_CONFIG[infiniteState.difficulty],
    puzzlesCompleted: infiniteState.puzzlesCompleted,
    puzzlesAttempted: infiniteState.puzzlesAttempted,
    totalScore: infiniteState.totalScore,
    currentStreak: infiniteState.currentStreak,
    bestStreak: infiniteState.bestStreak,
    duration,
    durationFormatted: formatDuration(duration),
    averageScore: infiniteState.puzzlesCompleted > 0 
      ? Math.round(infiniteState.totalScore / infiniteState.puzzlesCompleted) 
      : 0
  };
}

/**
 * Format seed for display
 */
export function formatSeed(seed) {
  if (!seed) return '------';
  return String(seed).padStart(6, '0').slice(-6);
}

/**
 * Parse seed from input
 */
export function parseSeed(input) {
  if (!input || input.trim() === '') return null;
  
  const num = parseInt(input, 10);
  if (!isNaN(num) && num > 0) {
    return num;
  }
  
  // Hash string
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Create RNG from current seed
 */
export function createInfiniteRNG(seed = infiniteState.seed) {
  return createRNG(seed || 12345);
}

/**
 * Generate level parameters for current seed and difficulty
 */
export function generateLevelParams(gameId) {
  const rng = createInfiniteRNG();
  const difficulty = DIFFICULTY_CONFIG[infiniteState.difficulty];
  
  // Generate game-specific parameters
  const params = {
    seed: infiniteState.seed,
    difficulty: infiniteState.difficulty,
    gameId
  };
  
  // Common parameters
  params.ballCount = rng.int(difficulty.ballCount.min, difficulty.ballCount.max);
  params.pinCount = rng.int(difficulty.pinCount.min, difficulty.pinCount.max);
  params.hasHazard = rng.bool(difficulty.hazardChance);
  params.xpMultiplier = difficulty.xpMultiplier;
  
  return params;
}

/**
 * Format duration for display
 */
function formatDuration(ms) {
  if (!ms || ms <= 0) return '0s';
  
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (minutes === 0) {
    return `${seconds}s`;
  }
  
  return `${minutes}m ${seconds}s`;
}

/**
 * Get infinite mode state (for debugging)
 */
export function getState() {
  return { ...infiniteState };
}

export default {
  initInfiniteMode,
  isInfiniteMode,
  toggleInfiniteMode,
  setInfiniteMode,
  getSeed,
  setSeed,
  generateNewSeed,
  getDifficulty,
  setDifficulty,
  getDifficultyConfig,
  getDifficultyOptions,
  startInfiniteSession,
  endInfiniteSession,
  recordPuzzleAttempt,
  recordPuzzleCompletion,
  recordPuzzleFailure,
  getSessionStats,
  formatSeed,
  parseSeed,
  createInfiniteRNG,
  generateLevelParams,
  DIFFICULTY_CONFIG,
  getState
};
