/**
 * Meta - Cross-game progression and XP tracking
 *
 * Provides:
 * - XP (experience points) system for gamification
 * - Level completion tracking across games
 * - Achievement/streak tracking
 *
 * Usage:
 *   await awardLevelComplete('pull-the-pin', 3, { moves: 5 });
 *   const info = getLevelInfo('pull-the-pin', 1);
 */

const STORAGE_KEY = 'mg:meta';

// XP constants
const XP_PER_STAR = 100;
const XP_BONUS_FIRST_COMPLETION = 50;
const XP_DAILY_BONUS = 200;

// Level thresholds for player level
const LEVEL_THRESHOLDS = [
  0,      // Level 1
  300,    // Level 2
  750,    // Level 3
  1500,   // Level 4
  2500,   // Level 5
  4000,   // Level 6
  6000,   // Level 7
  8500,   // Level 8
  11500,  // Level 9
  15000,  // Level 10
  // Each level after 10 requires 4000 more XP
];

/**
 * Get meta data from storage
 * @returns {object} Meta data object
 */
function getMeta() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : createDefaultMeta();
  } catch {
    return createDefaultMeta();
  }
}

/**
 * Create default meta data structure
 */
function createDefaultMeta() {
  return {
    totalXP: 0,
    playerLevel: 1,
    completedLevels: {},  // { gameId: { levelId: { stars, moves, timestamp } } }
    streaks: {
      daily: 0,
      lastDailyDate: null
    },
    achievements: [],
    firstPlayDate: null,
    totalPlayTime: 0
  };
}

/**
 * Save meta data to storage
 * @param {object} meta - Meta data to save
 */
function saveMeta(meta) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Storage full or disabled
  }
}

/**
 * Award XP for completing a level
 * @param {string} gameId - Game identifier
 * @param {number} stars - Stars earned (1-3)
 * @param {object} details - Additional details (moves, time, etc.)
 * @returns {object} Result with XP earned and new totals
 */
export async function awardLevelComplete(gameId, stars, details = {}) {
  const meta = getMeta();
  const levelId = details.levelId || 'current';

  // Initialize game's completed levels if needed
  if (!meta.completedLevels[gameId]) {
    meta.completedLevels[gameId] = {};
  }

  const isFirstCompletion = !meta.completedLevels[gameId][levelId];
  const previousStars = meta.completedLevels[gameId][levelId]?.stars || 0;

  // Calculate XP
  let xpEarned = stars * XP_PER_STAR;

  // First completion bonus
  if (isFirstCompletion) {
    xpEarned += XP_BONUS_FIRST_COMPLETION;
  }

  // Improvement bonus (earned more stars than before)
  if (!isFirstCompletion && stars > previousStars) {
    xpEarned += (stars - previousStars) * XP_PER_STAR;
  }

  // Daily challenge bonus
  if (details.isDaily) {
    xpEarned += XP_DAILY_BONUS;
  }

  // Record completion
  meta.completedLevels[gameId][levelId] = {
    stars,
    moves: details.moves || 0,
    time: details.time || 0,
    timestamp: Date.now(),
    xpEarned
  };

  // Update total XP
  const previousXP = meta.totalXP;
  meta.totalXP += xpEarned;

  // Update player level
  meta.playerLevel = calculatePlayerLevel(meta.totalXP);

  // Set first play date if not set
  if (!meta.firstPlayDate) {
    meta.firstPlayDate = Date.now();
  }

  saveMeta(meta);

  return {
    xpEarned,
    totalXP: meta.totalXP,
    playerLevel: meta.playerLevel,
    leveledUp: calculatePlayerLevel(previousXP) < meta.playerLevel,
    isFirstCompletion
  };
}

/**
 * Get level completion info
 * @param {string} gameId - Game identifier
 * @param {number|string} levelId - Level identifier
 * @returns {object|null} Level info or null if not completed
 */
export function getLevelInfo(gameId, levelId) {
  const meta = getMeta();
  return meta.completedLevels[gameId]?.[levelId] || null;
}

/**
 * Get all completed levels for a game
 * @param {string} gameId - Game identifier
 * @returns {object} Map of levelId -> level info
 */
export function getCompletedLevels(gameId) {
  const meta = getMeta();
  return meta.completedLevels[gameId] || {};
}

/**
 * Get total stars earned across all games
 * @returns {number}
 */
export function getTotalStars() {
  const meta = getMeta();
  let total = 0;

  for (const gameLevels of Object.values(meta.completedLevels)) {
    for (const level of Object.values(gameLevels)) {
      total += level.stars || 0;
    }
  }

  return total;
}

/**
 * Get player's current level based on XP
 * @returns {number}
 */
export function getPlayerLevel() {
  const meta = getMeta();
  return meta.playerLevel;
}

/**
 * Get XP progress toward next level
 * @returns {object} { current, needed, progress (0-1) }
 */
export function getXPProgress() {
  const meta = getMeta();
  const currentLevel = meta.playerLevel;
  const currentThreshold = getLevelThreshold(currentLevel);
  const nextThreshold = getLevelThreshold(currentLevel + 1);

  const xpInLevel = meta.totalXP - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;

  return {
    current: xpInLevel,
    needed: xpNeeded,
    progress: xpNeeded > 0 ? Math.min(xpInLevel / xpNeeded, 1) : 1
  };
}

/**
 * Calculate player level from total XP
 * @param {number} totalXP
 * @returns {number}
 */
function calculatePlayerLevel(totalXP) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Get XP threshold for a level
 * @param {number} level
 * @returns {number}
 */
function getLevelThreshold(level) {
  if (level <= LEVEL_THRESHOLDS.length) {
    return LEVEL_THRESHOLDS[level - 1] || 0;
  }
  // Levels beyond our table: 15000 + (level - 10) * 4000
  return 15000 + (level - 10) * 4000;
}

/**
 * Update daily streak
 * @returns {object} { streak, isNewDay }
 */
export function updateDailyStreak() {
  const meta = getMeta();
  const today = new Date().toISOString().split('T')[0];
  const lastDaily = meta.streaks.lastDailyDate;

  let isNewDay = false;

  if (lastDaily !== today) {
    isNewDay = true;

    // Check if yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastDaily === yesterdayStr) {
      // Continuing streak
      meta.streaks.daily++;
    } else if (lastDaily !== today) {
      // Streak broken or first day
      meta.streaks.daily = 1;
    }

    meta.streaks.lastDailyDate = today;
    saveMeta(meta);
  }

  return {
    streak: meta.streaks.daily,
    isNewDay
  };
}

/**
 * Get current daily streak
 * @returns {number}
 */
export function getDailyStreak() {
  const meta = getMeta();
  return meta.streaks.daily;
}

/**
 * Get player stats summary
 * @returns {object}
 */
export function getPlayerStats() {
  const meta = getMeta();

  return {
    totalXP: meta.totalXP,
    playerLevel: meta.playerLevel,
    totalStars: getTotalStars(),
    dailyStreak: meta.streaks.daily,
    gamesPlayed: Object.keys(meta.completedLevels).length,
    firstPlayDate: meta.firstPlayDate
  };
}

export default {
  awardLevelComplete,
  getLevelInfo,
  getCompletedLevels,
  getTotalStars,
  getPlayerLevel,
  getXPProgress,
  updateDailyStreak,
  getDailyStreak,
  getPlayerStats
};
