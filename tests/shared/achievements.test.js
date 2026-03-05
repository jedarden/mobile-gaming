/**
 * Tests for Achievements.js - Achievement System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ACHIEVEMENTS,
  GAME_MASTERY_TEMPLATES,
  GAMES,
  getAllAchievements,
  getGameMasteryAchievements,
  checkAchievements,
  getAchievement,
  getUnlockedCount,
  getTotalCount,
  getAchievementXP
} from '../../src/shared/achievements.js';
import * as storage from '../../src/shared/storage.js';
import * as meta from '../../src/shared/meta.js';
import { clearAllData } from '../../src/shared/storage.js';

describe('Achievements', () => {
  beforeEach(async () => {
    // Clear localStorage first
    localStorage.clear();
    // Reset storage module cache
    await clearAllData();
    // Initialize fresh storage
    await storage.initStorage();
  });

  afterEach(async () => {
    // Clean up after each test
    await clearAllData();
    localStorage.clear();
  });

  describe('ACHIEVEMENTS', () => {
    it('should have required properties for each achievement', () => {
      Object.values(ACHIEVEMENTS).forEach(achievement => {
        expect(achievement.id).toBeDefined();
        expect(achievement.name).toBeDefined();
        expect(achievement.description).toBeDefined();
        expect(achievement.tier).toBeDefined();
        expect(achievement.icon).toBeDefined();
        expect(typeof achievement.check).toBe('function');
      });
    });

    it('should have valid tiers', () => {
      const validTiers = ['bronze', 'silver', 'gold', 'platinum'];
      Object.values(ACHIEVEMENTS).forEach(achievement => {
        expect(validTiers).toContain(achievement.tier);
      });
    });

    it('should have progress achievements', () => {
      expect(ACHIEVEMENTS.first_win).toBeDefined();
      expect(ACHIEVEMENTS.dedicated).toBeDefined();
      expect(ACHIEVEMENTS.centurion).toBeDefined();
      expect(ACHIEVEMENTS.marathoner).toBeDefined();
      expect(ACHIEVEMENTS.legend).toBeDefined();
    });

    it('should have streak achievements', () => {
      expect(ACHIEVEMENTS.streak_3).toBeDefined();
      expect(ACHIEVEMENTS.streak_7).toBeDefined();
      expect(ACHIEVEMENTS.streak_30).toBeDefined();
      expect(ACHIEVEMENTS.streak_100).toBeDefined();
    });

    it('should have star achievements', () => {
      expect(ACHIEVEMENTS.star_collector).toBeDefined();
      expect(ACHIEVEMENTS.star_hunter).toBeDefined();
      expect(ACHIEVEMENTS.star_master).toBeDefined();
      expect(ACHIEVEMENTS.perfectionist).toBeDefined();
    });

    it('should have level achievements', () => {
      expect(ACHIEVEMENTS.level_5).toBeDefined();
      expect(ACHIEVEMENTS.level_10).toBeDefined();
      expect(ACHIEVEMENTS.level_20).toBeDefined();
      expect(ACHIEVEMENTS.level_30).toBeDefined();
    });
  });

  describe('GAME_MASTERY_TEMPLATES', () => {
    it('should have all mastery tiers', () => {
      expect(GAME_MASTERY_TEMPLATES.novice).toBeDefined();
      expect(GAME_MASTERY_TEMPLATES.adept).toBeDefined();
      expect(GAME_MASTERY_TEMPLATES.master).toBeDefined();
      expect(GAME_MASTERY_TEMPLATES.legend).toBeDefined();
    });

    it('should have required properties for templates', () => {
      Object.values(GAME_MASTERY_TEMPLATES).forEach(template => {
        expect(template.suffix).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.starsRequired).toBeDefined();
        expect(template.tier).toBeDefined();
        expect(template.icon).toBeDefined();
      });
    });

    it('should have increasing star requirements', () => {
      expect(GAME_MASTERY_TEMPLATES.novice.starsRequired).toBeLessThan(GAME_MASTERY_TEMPLATES.adept.starsRequired);
      expect(GAME_MASTERY_TEMPLATES.adept.starsRequired).toBeLessThan(GAME_MASTERY_TEMPLATES.master.starsRequired);
      expect(GAME_MASTERY_TEMPLATES.master.starsRequired).toBeLessThan(GAME_MASTERY_TEMPLATES.legend.starsRequired);
    });
  });

  describe('GAMES', () => {
    it('should have all four games', () => {
      expect(GAMES['water-sort']).toBeDefined();
      expect(GAMES['parking-escape']).toBeDefined();
      expect(GAMES['bus-jam']).toBeDefined();
      expect(GAMES['pull-pin']).toBeDefined();
    });

    it('should have name and id for each game', () => {
      Object.values(GAMES).forEach(game => {
        expect(game.name).toBeDefined();
        expect(game.id).toBeDefined();
      });
    });
  });

  describe('getAllAchievements', () => {
    it('should return all achievements with unlock status', () => {
      const achievements = getAllAchievements();

      expect(achievements.length).toBe(Object.keys(ACHIEVEMENTS).length);
      achievements.forEach(a => {
        expect(a.unlocked).toBeDefined();
        expect(a.progress).toBeDefined();
      });
    });

    it('should show all achievements as locked initially', async () => {
      // Reset profile to ensure clean state
      const profile = storage.getProfile();
      profile.achievements = [];
      await storage.save(profile);

      const achievements = getAllAchievements();
      const lockedCount = achievements.filter(a => !a.unlocked).length;

      expect(lockedCount).toBe(achievements.length);
    });

    it('should show unlocked achievement', async () => {
      // Reset first
      const profile = storage.getProfile();
      profile.achievements = [];
      await storage.save(profile);

      await storage.unlockAchievement('first_win');
      const achievements = getAllAchievements();
      const firstWin = achievements.find(a => a.id === 'first_win');

      expect(firstWin.unlocked).toBe(true);
    });
  });

  describe('getGameMasteryAchievements', () => {
    it('should return mastery achievements for valid game', () => {
      const achievements = getGameMasteryAchievements('water-sort');

      expect(achievements.length).toBe(4); // 4 mastery levels
      achievements.forEach(a => {
        expect(a.id).toContain('water-sort');
        expect(a.unlocked).toBeDefined();
        expect(a.progress).toBeDefined();
        expect(a.starsRequired).toBeDefined();
        expect(a.currentStars).toBeDefined();
      });
    });

    it('should return empty array for invalid game', () => {
      const achievements = getGameMasteryAchievements('invalid-game');
      expect(achievements).toEqual([]);
    });

    it('should calculate progress correctly', async () => {
      await storage.updateGameStats('water-sort', { stars: 25 });
      const achievements = getGameMasteryAchievements('water-sort');
      const novice = achievements.find(a => a.id === 'water-sort_novice');

      // 25/25 = 1.0 progress
      expect(novice.progress).toBe(1);
    });

    it('should cap progress at 1', async () => {
      await storage.updateGameStats('water-sort', { stars: 200 });
      const achievements = getGameMasteryAchievements('water-sort');
      const novice = achievements.find(a => a.id === 'water-sort_novice');

      // Progress should be capped at 1 even with more stars
      expect(novice.progress).toBe(1);
    });
  });

  describe('checkAchievements', () => {
    it('should return empty array when no achievements unlocked', async () => {
      // Reset profile to ensure clean state
      const profile = storage.getProfile();
      profile.achievements = [];
      profile.gamesPlayed = {};
      await storage.save(profile);

      const unlocked = await checkAchievements();
      expect(unlocked).toEqual([]);
    });

    it('should unlock first_win when stats meet criteria', async () => {
      // Reset profile first
      const profile = storage.getProfile();
      profile.achievements = [];
      profile.gamesPlayed = {};
      await storage.save(profile);

      // Set up stats to meet first_win criteria (totalCompleted >= 1)
      const gameId = 'first-win-test-' + Date.now();
      await storage.updateGameStats(gameId, { completed: 1 });

      const unlocked = await checkAchievements();

      // First win should be unlocked
      const firstWin = unlocked.find(a => a.id === 'first_win');
      expect(firstWin).toBeDefined();
    });

    it('should not re-unlock already unlocked achievements', async () => {
      // Reset profile first
      const profile = storage.getProfile();
      profile.achievements = ['first_win'];
      await storage.save(profile);

      const unlocked = await checkAchievements();

      expect(unlocked.find(a => a.id === 'first_win')).toBeUndefined();
    });

    it('should check game mastery achievements', async () => {
      // Reset profile first
      const profile = storage.getProfile();
      profile.achievements = [];
      profile.gamesPlayed = {};
      await storage.save(profile);

      await storage.updateGameStats('water-sort', { stars: 25 });
      const unlocked = await checkAchievements();

      const novice = unlocked.find(a => a.id === 'water-sort_novice');
      expect(novice).toBeDefined();
      expect(novice.tier).toBe('bronze');
    });

    it('should award XP for unlocked achievements', async () => {
      // Reset profile first
      const profile = storage.getProfile();
      profile.achievements = [];
      profile.gamesPlayed = {};
      profile.xp = 0;
      await storage.save(profile);

      const initialXP = meta.getTotalXP();

      await storage.updateGameStats('water-sort', { stars: 25 });
      await checkAchievements();

      expect(meta.getTotalXP()).toBeGreaterThan(initialXP);
    });

    it('should check custom data achievements', async () => {
      // Reset profile first
      const profile = storage.getProfile();
      profile.achievements = [];
      await storage.save(profile);

      // Speedster requires fastestTime < 5
      const unlocked = await checkAchievements({ fastestTime: 4 });
      const speedster = unlocked.find(a => a.id === 'speedster');

      expect(speedster).toBeDefined();
    });

    it('should check explorer achievement with custom data', async () => {
      // Reset profile first
      const profile = storage.getProfile();
      profile.achievements = [];
      await storage.save(profile);

      // Explorer requires gamesPlayedCount >= 4
      const unlocked = await checkAchievements({ gamesPlayedCount: 4 });
      const explorer = unlocked.find(a => a.id === 'explorer');

      expect(explorer).toBeDefined();
    });
  });

  describe('getAchievement', () => {
    it('should return achievement by ID', () => {
      const achievement = getAchievement('first_win');

      expect(achievement).toBeDefined();
      expect(achievement.id).toBe('first_win');
      expect(achievement.name).toBe('First Steps');
    });

    it('should return null for unknown ID', () => {
      const achievement = getAchievement('unknown_achievement');
      expect(achievement).toBeNull();
    });
  });

  describe('getUnlockedCount', () => {
    it('should return 0 for new profile', () => {
      expect(getUnlockedCount()).toBe(0);
    });

    it('should return correct count after unlocking', async () => {
      await storage.unlockAchievement('first_win');
      await storage.unlockAchievement('streak_3');

      expect(getUnlockedCount()).toBe(2);
    });
  });

  describe('getTotalCount', () => {
    it('should return total achievement count', () => {
      const total = getTotalCount();

      // Standard achievements + (mastery templates * games)
      const expected = Object.keys(ACHIEVEMENTS).length +
                       (Object.keys(GAME_MASTERY_TEMPLATES).length * Object.keys(GAMES).length);

      expect(total).toBe(expected);
    });
  });

  describe('getAchievementXP', () => {
    it('should return correct XP for each tier', () => {
      expect(getAchievementXP('bronze')).toBe(50);
      expect(getAchievementXP('silver')).toBe(100);
      expect(getAchievementXP('gold')).toBe(200);
      expect(getAchievementXP('platinum')).toBe(500);
    });

    it('should return default XP for unknown tier', () => {
      expect(getAchievementXP('unknown')).toBe(50);
    });
  });

  describe('Achievement check functions', () => {
    it('first_win should check totalCompleted >= 1', () => {
      expect(ACHIEVEMENTS.first_win.check({ totalCompleted: 0 })).toBe(false);
      expect(ACHIEVEMENTS.first_win.check({ totalCompleted: 1 })).toBe(true);
      expect(ACHIEVEMENTS.first_win.check({ totalCompleted: 10 })).toBe(true);
    });

    it('dedicated should check totalCompleted >= 50', () => {
      expect(ACHIEVEMENTS.dedicated.check({ totalCompleted: 49 })).toBe(false);
      expect(ACHIEVEMENTS.dedicated.check({ totalCompleted: 50 })).toBe(true);
    });

    it('centurion should check totalCompleted >= 100', () => {
      expect(ACHIEVEMENTS.centurion.check({ totalCompleted: 99 })).toBe(false);
      expect(ACHIEVEMENTS.centurion.check({ totalCompleted: 100 })).toBe(true);
    });

    it('streak achievements should check dailyStreak', () => {
      expect(ACHIEVEMENTS.streak_3.check({ dailyStreak: 2 })).toBe(false);
      expect(ACHIEVEMENTS.streak_3.check({ dailyStreak: 3 })).toBe(true);
      expect(ACHIEVEMENTS.streak_7.check({ dailyStreak: 7 })).toBe(true);
      expect(ACHIEVEMENTS.streak_30.check({ dailyStreak: 30 })).toBe(true);
      expect(ACHIEVEMENTS.streak_100.check({ dailyStreak: 100 })).toBe(true);
    });

    it('star achievements should check totalStars', () => {
      expect(ACHIEVEMENTS.star_collector.check({ totalStars: 49 })).toBe(false);
      expect(ACHIEVEMENTS.star_collector.check({ totalStars: 50 })).toBe(true);
      expect(ACHIEVEMENTS.star_hunter.check({ totalStars: 200 })).toBe(true);
      expect(ACHIEVEMENTS.star_master.check({ totalStars: 500 })).toBe(true);
    });

    it('perfectionist should check totalPerfectClears', () => {
      expect(ACHIEVEMENTS.perfectionist.check({ totalPerfectClears: 99 })).toBe(false);
      expect(ACHIEVEMENTS.perfectionist.check({ totalPerfectClears: 100 })).toBe(true);
    });

    it('level achievements should check level', () => {
      expect(ACHIEVEMENTS.level_5.check({ level: 4 })).toBe(false);
      expect(ACHIEVEMENTS.level_5.check({ level: 5 })).toBe(true);
      expect(ACHIEVEMENTS.level_10.check({ level: 10 })).toBe(true);
      expect(ACHIEVEMENTS.level_20.check({ level: 20 })).toBe(true);
      expect(ACHIEVEMENTS.level_30.check({ level: 30 })).toBe(true);
    });

    it('speedster should use custom data for fastestTime', () => {
      expect(ACHIEVEMENTS.speedster.check({}, { fastestTime: 10 })).toBe(false);
      expect(ACHIEVEMENTS.speedster.check({}, { fastestTime: 5 })).toBe(false);
      expect(ACHIEVEMENTS.speedster.check({}, { fastestTime: 4 })).toBe(true);
    });

    it('confident should use custom data for noUndoCount', () => {
      expect(ACHIEVEMENTS.confident.check({}, { noUndoCount: 9 })).toBe(false);
      expect(ACHIEVEMENTS.confident.check({}, { noUndoCount: 10 })).toBe(true);
    });

    it('explorer should use custom data for gamesPlayedCount', () => {
      expect(ACHIEVEMENTS.explorer.check({}, { gamesPlayedCount: 3 })).toBe(false);
      expect(ACHIEVEMENTS.explorer.check({}, { gamesPlayedCount: 4 })).toBe(true);
    });
  });
});
