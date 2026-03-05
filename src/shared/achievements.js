// Mobile Gaming - Achievement System
// Defines all achievements and provides checking functions

import * as storage from './storage.js';
import * as meta from './meta.js';

// Achievement definitions organized by category
export const ACHIEVEMENTS = {
  // Progress achievements
  first_win: {
    id: 'first_win',
    name: 'First Steps',
    description: 'Complete any level',
    tier: 'bronze',
    icon: '🎯',
    check: (stats) => stats.totalCompleted >= 1
  },
  dedicated: {
    id: 'dedicated',
    name: 'Dedicated',
    description: 'Complete 50 levels',
    tier: 'bronze',
    icon: '🎮',
    check: (stats) => stats.totalCompleted >= 50
  },
  centurion: {
    id: 'centurion',
    name: 'Centurion',
    description: 'Complete 100 levels',
    tier: 'silver',
    icon: '💯',
    check: (stats) => stats.totalCompleted >= 100
  },
  marathoner: {
    id: 'marathoner',
    name: 'Marathoner',
    description: 'Complete 500 levels',
    tier: 'gold',
    icon: '🏃',
    check: (stats) => stats.totalCompleted >= 500
  },
  legend: {
    id: 'legend',
    name: 'Legend',
    description: 'Complete 1000 levels',
    tier: 'platinum',
    icon: '👑',
    check: (stats) => stats.totalCompleted >= 1000
  },

  // Streak achievements
  streak_3: {
    id: 'streak_3',
    name: 'Getting Started',
    description: '3-day daily challenge streak',
    tier: 'bronze',
    icon: '🔥',
    check: (stats) => stats.dailyStreak >= 3
  },
  streak_7: {
    id: 'streak_7',
    name: 'Weekly Warrior',
    description: '7-day daily challenge streak',
    tier: 'silver',
    icon: '📅',
    check: (stats) => stats.dailyStreak >= 7
  },
  streak_30: {
    id: 'streak_30',
    name: 'Monthly Master',
    description: '30-day daily challenge streak',
    tier: 'gold',
    icon: '🗓️',
    check: (stats) => stats.dailyStreak >= 30
  },
  streak_100: {
    id: 'streak_100',
    name: 'Legendary Dedication',
    description: '100-day daily challenge streak',
    tier: 'platinum',
    icon: '⚡',
    check: (stats) => stats.dailyStreak >= 100
  },

  // Star achievements
  star_collector: {
    id: 'star_collector',
    name: 'Star Collector',
    description: 'Earn 50 stars',
    tier: 'bronze',
    icon: '⭐',
    check: (stats) => stats.totalStars >= 50
  },
  star_hunter: {
    id: 'star_hunter',
    name: 'Star Hunter',
    description: 'Earn 200 stars',
    tier: 'silver',
    icon: '🌟',
    check: (stats) => stats.totalStars >= 200
  },
  star_master: {
    id: 'star_master',
    name: 'Star Master',
    description: 'Earn 500 stars',
    tier: 'gold',
    icon: '🌠',
    check: (stats) => stats.totalStars >= 500
  },
  perfectionist: {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Get 100 perfect (3-star) clears',
    tier: 'gold',
    icon: '💎',
    check: (stats) => stats.totalPerfectClears >= 100
  },

  // Challenge achievements
  speedster: {
    id: 'speedster',
    name: 'Speedster',
    description: 'Complete any level in under 5 seconds',
    tier: 'silver',
    icon: '⚡',
    check: (stats, custom) => custom?.fastestTime < 5
  },
  confident: {
    id: 'confident',
    name: 'Confident',
    description: 'Complete 10 levels without using undo',
    tier: 'bronze',
    icon: '😤',
    check: (stats, custom) => custom?.noUndoCount >= 10
  },
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    description: 'Play all four games',
    tier: 'bronze',
    icon: '🗺️',
    check: (stats, custom) => custom?.gamesPlayedCount >= 4
  },

  // Level achievements
  level_5: {
    id: 'level_5',
    name: 'Rising Star',
    description: 'Reach level 5',
    tier: 'bronze',
    icon: '📈',
    check: (stats) => stats.level >= 5
  },
  level_10: {
    id: 'level_10',
    name: 'Veteran',
    description: 'Reach level 10',
    tier: 'silver',
    icon: '🏅',
    check: (stats) => stats.level >= 10
  },
  level_20: {
    id: 'level_20',
    name: 'Expert',
    description: 'Reach level 20',
    tier: 'gold',
    icon: '🏆',
    check: (stats) => stats.level >= 20
  },
  level_30: {
    id: 'level_30',
    name: 'Master',
    description: 'Reach level 30 (max level)',
    tier: 'platinum',
    icon: '🎖️',
    check: (stats) => stats.level >= 30
  }
};

// Per-game mastery achievement templates
export const GAME_MASTERY_TEMPLATES = {
  novice: {
    suffix: '_novice',
    name: 'Novice',
    description: 'Earn 25 stars in {game}',
    starsRequired: 25,
    tier: 'bronze',
    icon: '🌱'
  },
  adept: {
    suffix: '_adept',
    name: 'Adept',
    description: 'Earn 50 stars in {game}',
    starsRequired: 50,
    tier: 'silver',
    icon: '🌿'
  },
  master: {
    suffix: '_master',
    name: 'Master',
    description: 'Earn 100 stars in {game}',
    starsRequired: 100,
    tier: 'gold',
    icon: '🌳'
  },
  legend: {
    suffix: '_legend',
    name: 'Legend',
    description: 'Earn 200 stars in {game}',
    starsRequired: 200,
    tier: 'platinum',
    icon: '🏛️'
  }
};

// Game identifiers for mastery achievements
export const GAMES = {
  'water-sort': { name: 'Water Sort', id: 'water-sort' },
  'parking-escape': { name: 'Parking Escape', id: 'parking-escape' },
  'bus-jam': { name: 'Bus Jam', id: 'bus-jam' },
  'pull-pin': { name: 'Pull the Pin', id: 'pull-pin' }
};

/**
 * Get all achievements with unlock status
 */
export function getAllAchievements() {
  const profile = storage.getProfile();
  const stats = meta.getProfileStats();

  return Object.values(ACHIEVEMENTS).map(achievement => ({
    ...achievement,
    unlocked: profile.achievements.includes(achievement.id),
    progress: getAchievementProgress(achievement, stats)
  }));
}

/**
 * Get game mastery achievements for a specific game
 */
export function getGameMasteryAchievements(gameId) {
  const game = GAMES[gameId];
  if (!game) return [];

  const profile = storage.getProfile();
  const gameStats = storage.getGameStats(gameId);

  return Object.values(GAME_MASTERY_TEMPLATES).map(template => {
    const achievementId = `${gameId}${template.suffix}`;
    return {
      id: achievementId,
      name: `${game.name} ${template.name}`,
      description: template.description.replace('{game}', game.name),
      tier: template.tier,
      icon: template.icon,
      unlocked: profile.achievements.includes(achievementId),
      progress: Math.min(1, gameStats.stars / template.starsRequired),
      starsRequired: template.starsRequired,
      currentStars: gameStats.stars
    };
  });
}

/**
 * Get progress towards an achievement (0-1)
 */
function getAchievementProgress(achievement, stats) {
  // Simple progress calculation based on check function
  // Could be enhanced with specific progress tracking
  return achievement.check(stats) ? 1 : 0;
}

/**
 * Check all achievements and return newly unlocked ones
 */
export async function checkAchievements(customData = {}) {
  const profile = storage.getProfile();
  const stats = meta.getProfileStats();
  const newlyUnlocked = [];

  // Check standard achievements
  for (const achievement of Object.values(ACHIEVEMENTS)) {
    if (!profile.achievements.includes(achievement.id)) {
      if (achievement.check(stats, customData)) {
        await storage.unlockAchievement(achievement.id);
        await meta.awardAchievement(achievement.tier);
        newlyUnlocked.push(achievement);
      }
    }
  }

  // Check game mastery achievements
  for (const gameId of Object.keys(GAMES)) {
    const gameStats = storage.getGameStats(gameId);

    for (const template of Object.values(GAME_MASTERY_TEMPLATES)) {
      const achievementId = `${gameId}${template.suffix}`;

      if (!profile.achievements.includes(achievementId)) {
        if (gameStats.stars >= template.starsRequired) {
          await storage.unlockAchievement(achievementId);
          await meta.awardAchievement(template.tier);

          const game = GAMES[gameId];
          newlyUnlocked.push({
            id: achievementId,
            name: `${game.name} ${template.name}`,
            description: template.description.replace('{game}', game.name),
            tier: template.tier,
            icon: template.icon
          });
        }
      }
    }
  }

  return newlyUnlocked;
}

/**
 * Get achievement by ID
 */
export function getAchievement(achievementId) {
  return ACHIEVEMENTS[achievementId] || null;
}

/**
 * Get unlocked achievements count
 */
export function getUnlockedCount() {
  const profile = storage.getProfile();
  return profile.achievements.length;
}

/**
 * Get total achievements count
 */
export function getTotalCount() {
  // Standard achievements + (game mastery templates * games)
  return Object.keys(ACHIEVEMENTS).length +
         (Object.keys(GAME_MASTERY_TEMPLATES).length * Object.keys(GAMES).length);
}

/**
 * Get XP value for achievement tier
 */
export function getAchievementXP(tier) {
  return meta.XP_AWARDS.ACHIEVEMENT[tier] || 50;
}

export { storage, meta };
