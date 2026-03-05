/**
 * Daily.js - Daily Challenge System
 *
 * Provides seed-based daily challenges with:
 * - Consistent daily puzzles across all players
 * - Streak tracking and rewards
 * - Timezone-aware daily reset
 */

import { mulberry32 } from './rng.js';
import * as storage from './storage.js';
import * as meta from './meta.js';

// Salt for daily seed generation
const DAILY_SALT = 'mobile-gaming-daily-v1';

/**
 * Get today's date string (YYYY-MM-DD)
 */
export function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Get yesterday's date string
 */
export function getYesterdayString() {
  const yesterday = new Date(Date.now() - 86400000);
  return yesterday.toISOString().slice(0, 10);
}

/**
 * Hash a string to a number
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Get daily seed for today
 */
export function getDailySeed() {
  const today = getTodayString();
  return hashString(today + DAILY_SALT);
}

/**
 * Get daily seed for a specific date
 */
export function getDailySeedForDate(dateStr) {
  return hashString(dateStr + DAILY_SALT);
}

/**
 * Get game-specific daily seed
 */
export function getGameDailySeed(gameId) {
  const baseSeed = getDailySeed();
  return hashString(baseSeed + gameId);
}

/**
 * Get daily challenge for a game
 */
export function getDailyChallenge(gameId, generator = null) {
  const seed = getGameDailySeed(gameId);
  const today = getTodayString();

  const difficulty = getDifficultyFromSeed(seed);
  const levelParams = generator ? generator(seed, { difficulty }) : null;

  return {
    date: today,
    gameId,
    seed,
    difficulty,
    levelParams,
    completed: false,
    bestResult: null
  };
}

/**
 * Get a seeded PRNG for today's daily challenge
 */
export function getDailyRNG(gameId) {
  const seed = getGameDailySeed(gameId);
  return mulberry32(seed);
}

/**
 * Determine difficulty from seed
 */
function getDifficultyFromSeed(seed) {
  const difficulties = ['easy', 'medium', 'medium', 'hard'];
  return difficulties[seed % difficulties.length];
}

/**
 * Check if daily challenge is completed for a game today
 */
export function isDailyCompleted(gameId) {
  const today = getTodayString();
  const data = storage.getDailyChallengeData(today, gameId);
  return data?.completed || false;
}

/**
 * Get daily challenge result for a game today
 */
export function getDailyResult(gameId) {
  const today = getTodayString();
  return storage.getDailyChallengeData(today, gameId);
}

/**
 * Complete daily challenge and update streak
 */
export async function completeDailyChallenge(gameId, result) {
  const today = getTodayString();
  const profile = storage.getProfile();

  const dailyData = {
    completed: true,
    moves: result.moves,
    time: result.time,
    stars: result.stars,
    attempts: ((await getDailyResult(gameId))?.attempts || 0) + 1,
    completedAt: new Date().toISOString()
  };

  await storage.saveDailyChallengeData(today, gameId, dailyData);

  const streakUpdated = updateStreak(profile);
  const xpResult = await meta.awardDailyComplete(gameId, result.stars);

  return {
    xpResult,
    streakUpdated,
    newStreak: profile.dailyStreak,
    newAchievements: []
  };
}

/**
 * Update daily streak based on last play date
 */
function updateStreak(profile) {
  const today = getTodayString();
  const yesterday = getYesterdayString();

  if (profile.lastDailyDate === today) {
    return false;
  }

  if (profile.lastDailyDate === yesterday) {
    profile.dailyStreak++;
  } else {
    profile.dailyStreak = 1;
  }

  profile.longestStreak = Math.max(profile.longestStreak, profile.dailyStreak);
  profile.lastDailyDate = today;

  storage.save(profile);
  return true;
}

/**
 * Get current streak info
 */
export function getStreakInfo() {
  const profile = storage.getProfile();
  const today = getTodayString();
  const yesterday = getYesterdayString();

  const isActive = profile.lastDailyDate === today || profile.lastDailyDate === yesterday;

  return {
    current: isActive ? profile.dailyStreak : 0,
    longest: profile.longestStreak,
    lastPlayed: profile.lastDailyDate,
    isActive,
    needsPlayToday: profile.lastDailyDate !== today
  };
}

/**
 * Get daily status for all games
 */
export function getDailyStatus() {
  const games = ['water-sort', 'parking-escape', 'bus-jam', 'pull-pin'];
  const today = getTodayString();

  return games.map(gameId => {
    const data = storage.getDailyChallengeData(today, gameId);
    return {
      gameId,
      completed: data?.completed || false,
      stars: data?.stars || 0,
      time: data?.time || null
    };
  });
}

/**
 * Check if all daily challenges are completed
 */
export function allDailiesCompleted() {
  const status = getDailyStatus();
  return status.every(game => game.completed);
}

/**
 * Get time remaining until next daily
 */
export function getTimeUntilReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  return tomorrow - now;
}

/**
 * Format time until reset for display
 */
export function formatTimeUntilReset() {
  const ms = getTimeUntilReset();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get streak emoji based on streak length
 */
export function getStreakEmoji(streak) {
  if (streak >= 100) return '👑';
  if (streak >= 30) return '🔥';
  if (streak >= 7) return '⚡';
  if (streak >= 3) return '✨';
  return '🌟';
}

/**
 * Get motivational message for streak
 */
export function getStreakMessage(streak) {
  if (streak >= 100) return 'Incredible! You\'re a true legend!';
  if (streak >= 30) return 'Amazing! A full month of dedication!';
  if (streak >= 14) return 'Two weeks strong! Keep it up!';
  if (streak >= 7) return 'One week streak! You\'re on fire!';
  if (streak >= 3) return 'Nice streak! Keep it going!';
  if (streak >= 1) return 'Great start! Come back tomorrow!';
  return 'Play your first daily challenge!';
}

export { storage, meta };
export default {
  getTodayString,
  getYesterdayString,
  getDailySeed,
  getDailySeedForDate,
  getGameDailySeed,
  getDailyChallenge,
  getDailyRNG,
  isDailyCompleted,
  getDailyResult,
  completeDailyChallenge,
  getStreakInfo,
  getDailyStatus,
  allDailiesCompleted,
  getTimeUntilReset,
  formatTimeUntilReset,
  getStreakEmoji,
  getStreakMessage
};
