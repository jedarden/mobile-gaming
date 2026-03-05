/**
 * Meta.js - Cross-Game Meta Progression
 *
 * Manages player progression including:
 * - Experience points (XP) and leveling
 * - Level unlocks and cosmetics
 * - Game statistics aggregation
 * - XP awards for various actions
 */

import * as storage from './storage.js';

// XP award amounts
export const XP_AWARDS = {
  LEVEL_COMPLETE: 10,
  STAR_BONUS: 5,           // Per star (max 15 for 3 stars)
  DAILY_COMPLETE: 25,
  STREAK_BONUS: (days) => days * 5,  // 7-day streak = 35 bonus
  ACHIEVEMENT: {
    bronze: 50,
    silver: 100,
    gold: 200,
    platinum: 500
  }
};

// Level thresholds (cumulative XP required)
export const LEVEL_THRESHOLDS = [
  0,       // Level 1
  100,     // Level 2
  250,     // Level 3
  500,     // Level 4
  800,     // Level 5
  1200,    // Level 6
  1700,    // Level 7
  2300,    // Level 8
  3000,    // Level 9
  4000,    // Level 10
  5000,    // Level 11
  6500,    // Level 12
  8000,    // Level 13
  10000,   // Level 14
  12500,   // Level 15
  15000,   // Level 16
  18000,   // Level 17
  22000,   // Level 18
  27000,   // Level 19
  33000,   // Level 20
  40000,   // Level 21
  50000,   // Level 22
  62000,   // Level 23
  76000,   // Level 24
  92000,   // Level 25
  110000,  // Level 26
  130000,  // Level 27
  152000,  // Level 28
  176000,  // Level 29
  200000   // Level 30
];

// Level unlockables
export const LEVEL_UNLOCKS = {
  2: { id: 'theme_dark', name: 'Dark Theme', type: 'theme' },
  5: { id: 'tube_neon', name: 'Neon Tubes', type: 'water-sort-skin' },
  8: { id: 'car_metallic', name: 'Metallic Cars', type: 'parking-skin' },
  10: { id: 'confetti', name: 'Confetti Effects', type: 'celebration' },
  15: { id: 'custom_bg', name: 'Custom Backgrounds', type: 'theme' },
  20: { id: 'animated_themes', name: 'Animated Themes', type: 'theme' },
  25: { id: 'gold_premium', name: 'Gold Everything', type: 'premium-skin' },
  30: { id: 'achievement_frames', name: 'Achievement Frames', type: 'profile' }
};

/**
 * Get current level from XP
 */
export function getLevelFromXP(xp) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Get XP required for next level
 */
export function getXPForNextLevel(currentLevel) {
  if (currentLevel >= LEVEL_THRESHOLDS.length) {
    return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  }
  return LEVEL_THRESHOLDS[currentLevel];
}

/**
 * Get XP progress within current level (0-1)
 */
export function getLevelProgress(xp) {
  const level = getLevelFromXP(xp);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || currentThreshold;

  if (nextThreshold === currentThreshold) {
    return 1; // Max level
  }

  return (xp - currentThreshold) / (nextThreshold - currentThreshold);
}

/**
 * Add XP to profile
 * @returns {Object} { leveledUp, newLevel, oldLevel, unlocks }
 */
export async function addXP(amount) {
  const profile = storage.getProfile();
  const oldLevel = getLevelFromXP(profile.xp);

  profile.xp += amount;
  const newLevel = getLevelFromXP(profile.xp);
  const leveledUp = newLevel > oldLevel;

  const unlocks = [];

  // Check for new unlocks
  if (leveledUp) {
    for (let level = oldLevel + 1; level <= newLevel; level++) {
      if (LEVEL_UNLOCKS[level]) {
        const unlock = LEVEL_UNLOCKS[level];
        if (!storage.hasCosmetic(unlock.id)) {
          await storage.unlockCosmetic(unlock.id);
          unlocks.push({ level, ...unlock });
        }
      }
    }
  }

  await storage.save(profile);

  return {
    leveledUp,
    newLevel,
    oldLevel,
    unlocks,
    xpGained: amount,
    totalXP: profile.xp
  };
}

/**
 * Award XP for completing a level
 */
export async function awardLevelComplete(gameId, stars = 0, options = {}) {
  let totalXP = XP_AWARDS.LEVEL_COMPLETE;
  totalXP += stars * XP_AWARDS.STAR_BONUS;

  if (options.streakDays && options.streakDays > 0) {
    totalXP += XP_AWARDS.STREAK_BONUS(options.streakDays);
  }

  const settings = storage.getSettings();
  if (settings.zenMode) {
    totalXP = Math.floor(totalXP / 2);
  }

  const gameStats = storage.getGameStats(gameId);
  await storage.updateGameStats(gameId, {
    played: gameStats.played + 1,
    completed: gameStats.completed + 1,
    stars: gameStats.stars + stars,
    perfectClears: stars === 3 ? gameStats.perfectClears + 1 : gameStats.perfectClears,
    totalMoves: (gameStats.totalMoves || 0) + (options.moves || 0)
  });

  return addXP(totalXP);
}

/**
 * Award XP for completing daily challenge
 */
export async function awardDailyComplete(gameId, stars = 0) {
  let totalXP = XP_AWARDS.DAILY_COMPLETE;
  totalXP += stars * XP_AWARDS.STAR_BONUS;

  const settings = storage.getSettings();
  if (settings.zenMode) {
    totalXP = Math.floor(totalXP / 2);
  }

  return addXP(totalXP);
}

/**
 * Award XP for unlocking an achievement
 */
export async function awardAchievement(tier = 'bronze') {
  const xpAmount = XP_AWARDS.ACHIEVEMENT[tier] || XP_AWARDS.ACHIEVEMENT.bronze;
  return addXP(xpAmount);
}

/**
 * Get current player level
 */
export function getCurrentLevel() {
  const profile = storage.getProfile();
  return getLevelFromXP(profile.xp);
}

/**
 * Get total XP
 */
export function getTotalXP() {
  const profile = storage.getProfile();
  return profile.xp;
}

/**
 * Get level display info
 */
export function getLevelInfo() {
  const profile = storage.getProfile();
  const level = getLevelFromXP(profile.xp);
  const progress = getLevelProgress(profile.xp);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || currentThreshold;

  return {
    level,
    xp: profile.xp,
    currentLevelXP: profile.xp - currentThreshold,
    nextLevelXP: nextThreshold - currentThreshold,
    progress,
    maxLevel: level >= LEVEL_THRESHOLDS.length
  };
}

/**
 * Get all unlocked cosmetics
 */
export function getUnlockedCosmetics() {
  return storage.getProfile().unlockedCosmetics;
}

/**
 * Check if a cosmetic is unlocked
 */
export function isCosmeticUnlocked(cosmeticId) {
  return storage.hasCosmetic(cosmeticId);
}

/**
 * Get stats for display
 */
export function getProfileStats() {
  const profile = storage.getProfile();
  const levelInfo = getLevelInfo();

  let totalPlayed = 0;
  let totalCompleted = 0;
  let totalStars = 0;
  let totalPerfectClears = 0;

  Object.values(profile.gamesPlayed).forEach(stats => {
    totalPlayed += stats.played || 0;
    totalCompleted += stats.completed || 0;
    totalStars += stats.stars || 0;
    totalPerfectClears += stats.perfectClears || 0;
  });

  return {
    level: levelInfo.level,
    xp: profile.xp,
    totalPlayed,
    totalCompleted,
    totalStars,
    totalPerfectClears,
    achievementCount: profile.achievements.length,
    dailyStreak: profile.dailyStreak,
    longestStreak: profile.longestStreak,
    memberSince: profile.createdAt
  };
}

/**
 * Format XP number for display
 */
export function formatXP(xp) {
  if (xp >= 1000000) {
    return (xp / 1000000).toFixed(1) + 'M';
  }
  if (xp >= 1000) {
    return (xp / 1000).toFixed(1) + 'K';
  }
  return xp.toString();
}

export { storage };
export default {
  XP_AWARDS,
  LEVEL_THRESHOLDS,
  LEVEL_UNLOCKS,
  getLevelFromXP,
  getXPForNextLevel,
  getLevelProgress,
  addXP,
  awardLevelComplete,
  awardDailyComplete,
  awardAchievement,
  getCurrentLevel,
  getTotalXP,
  getLevelInfo,
  getUnlockedCosmetics,
  isCosmeticUnlocked,
  getProfileStats,
  formatXP
};
