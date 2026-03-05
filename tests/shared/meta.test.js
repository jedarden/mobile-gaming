/**
 * Tests for Meta.js - Cross-Game Meta Progression
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as meta from '../../src/shared/meta.js';
import * as storage from '../../src/shared/storage.js';
import { clearAllData } from '../../src/shared/storage.js';

describe('Meta', () => {
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

  describe('XP_AWARDS', () => {
    it('should have defined XP award values', () => {
      expect(meta.XP_AWARDS.LEVEL_COMPLETE).toBe(10);
      expect(meta.XP_AWARDS.STAR_BONUS).toBe(5);
      expect(meta.XP_AWARDS.DAILY_COMPLETE).toBe(25);
    });

    it('should have achievement tier XP values', () => {
      expect(meta.XP_AWARDS.ACHIEVEMENT.bronze).toBe(50);
      expect(meta.XP_AWARDS.ACHIEVEMENT.silver).toBe(100);
      expect(meta.XP_AWARDS.ACHIEVEMENT.gold).toBe(200);
      expect(meta.XP_AWARDS.ACHIEVEMENT.platinum).toBe(500);
    });

    it('should calculate streak bonus correctly', () => {
      expect(meta.XP_AWARDS.STREAK_BONUS(1)).toBe(5);
      expect(meta.XP_AWARDS.STREAK_BONUS(7)).toBe(35);
      expect(meta.XP_AWARDS.STREAK_BONUS(30)).toBe(150);
    });
  });

  describe('LEVEL_THRESHOLDS', () => {
    it('should start at 0 for level 1', () => {
      expect(meta.LEVEL_THRESHOLDS[0]).toBe(0);
    });

    it('should have increasing thresholds', () => {
      for (let i = 1; i < meta.LEVEL_THRESHOLDS.length; i++) {
        expect(meta.LEVEL_THRESHOLDS[i]).toBeGreaterThan(meta.LEVEL_THRESHOLDS[i - 1]);
      }
    });

    it('should have 30 levels defined', () => {
      expect(meta.LEVEL_THRESHOLDS.length).toBe(30);
    });
  });

  describe('LEVEL_UNLOCKS', () => {
    it('should have unlocks at specific levels', () => {
      expect(meta.LEVEL_UNLOCKS[2]).toBeDefined();
      expect(meta.LEVEL_UNLOCKS[10]).toBeDefined();
      expect(meta.LEVEL_UNLOCKS[30]).toBeDefined();
    });

    it('should have required properties for unlocks', () => {
      const unlock = meta.LEVEL_UNLOCKS[5];
      expect(unlock.id).toBeDefined();
      expect(unlock.name).toBeDefined();
      expect(unlock.type).toBeDefined();
    });
  });

  describe('getLevelFromXP', () => {
    it('should return level 1 for 0 XP', () => {
      expect(meta.getLevelFromXP(0)).toBe(1);
    });

    it('should return level 1 for XP below level 2 threshold', () => {
      expect(meta.getLevelFromXP(50)).toBe(1);
      expect(meta.getLevelFromXP(99)).toBe(1);
    });

    it('should return level 2 at 100 XP', () => {
      expect(meta.getLevelFromXP(100)).toBe(2);
    });

    it('should return level 3 at 250 XP', () => {
      expect(meta.getLevelFromXP(250)).toBe(3);
    });

    it('should return level 10 at 4000 XP', () => {
      expect(meta.getLevelFromXP(4000)).toBe(10);
    });

    it('should return max level for XP at or above max threshold', () => {
      expect(meta.getLevelFromXP(200000)).toBe(30);
      expect(meta.getLevelFromXP(500000)).toBe(30);
    });
  });

  describe('getXPForNextLevel', () => {
    it('should return threshold for next level', () => {
      expect(meta.getXPForNextLevel(1)).toBe(100);
      expect(meta.getXPForNextLevel(2)).toBe(250);
    });

    it('should return max threshold for max level', () => {
      expect(meta.getXPForNextLevel(30)).toBe(200000);
      expect(meta.getXPForNextLevel(31)).toBe(200000);
    });
  });

  describe('getLevelProgress', () => {
    it('should return 0 for 0 XP at level 1', () => {
      expect(meta.getLevelProgress(0)).toBe(0);
    });

    it('should return progress between 0 and 1 for mid-level XP', () => {
      // Level 1: 0-100 XP, so 50 XP = 0.5 progress
      expect(meta.getLevelProgress(50)).toBe(0.5);
    });

    it('should return 1 for max level', () => {
      expect(meta.getLevelProgress(200000)).toBe(1);
      expect(meta.getLevelProgress(300000)).toBe(1);
    });

    it('should calculate progress correctly at level boundaries', () => {
      // Just hit level 2
      expect(meta.getLevelProgress(100)).toBe(0);
      // Halfway through level 2 (100 to 250 = 150 range, so 75 = 0.5)
      expect(meta.getLevelProgress(175)).toBe(0.5);
    });
  });

  describe('addXP', () => {
    it('should add XP to profile', async () => {
      const result = await meta.addXP(50);

      expect(result.xpGained).toBe(50);
      expect(result.totalXP).toBe(50);
      expect(result.leveledUp).toBe(false);
    });

    it('should detect level up', async () => {
      const result = await meta.addXP(100);

      expect(result.xpGained).toBe(100);
      expect(result.totalXP).toBe(100);
      expect(result.leveledUp).toBe(true);
      expect(result.oldLevel).toBe(1);
      expect(result.newLevel).toBe(2);
    });

    it('should unlock cosmetics on level up', async () => {
      // Level 2 requires 100 XP and has an unlock
      // Use a fresh profile to avoid shallow copy issues
      const profile = storage.getProfile();
      profile.unlockedCosmetics = ['theme_default']; // Reset to default only
      profile.xp = 0; // Reset XP
      await storage.save(profile);

      const result = await meta.addXP(100);

      expect(result.unlocks.length).toBeGreaterThan(0);
      expect(result.unlocks[0].level).toBe(2);
    });

    it('should not duplicate unlocks for already unlocked cosmetics', async () => {
      // First add XP to get level 2
      await meta.addXP(100);

      // Add more XP - should not duplicate unlock
      const result = await meta.addXP(150);

      // Check that level 2 unlock is not duplicated
      const level2Unlocks = result.unlocks.filter(u => u.level === 2);
      expect(level2Unlocks.length).toBe(0);
    });
  });

  describe('awardLevelComplete', () => {
    it('should award base XP for level completion', async () => {
      const result = await meta.awardLevelComplete('test-game');

      expect(result.xpGained).toBe(meta.XP_AWARDS.LEVEL_COMPLETE);
    });

    it('should add star bonus XP', async () => {
      const result = await meta.awardLevelComplete('test-game', 3);

      // Base 10 + 3 stars * 5 = 25
      expect(result.xpGained).toBe(25);
    });

    it('should add streak bonus when provided', async () => {
      const result = await meta.awardLevelComplete('test-game', 0, { streakDays: 7 });

      // Base 10 + streak 35 = 45
      expect(result.xpGained).toBe(45);
    });

    it('should halve XP in zen mode', async () => {
      await storage.updateSettings({ zenMode: true });
      const result = await meta.awardLevelComplete('test-game', 3);

      // (Base 10 + 15 stars) / 2 = 12 (floored)
      expect(result.xpGained).toBe(12);
    });

    it('should update game stats', async () => {
      const gameId = 'stats-test-game-' + Date.now();
      await meta.awardLevelComplete(gameId, 2, { moves: 10 });

      const stats = storage.getGameStats(gameId);
      expect(stats.played).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.stars).toBe(2);
      expect(stats.totalMoves).toBe(10);
    });

    it('should increment perfect clears for 3 stars', async () => {
      const gameId = 'perfect-clears-test-' + Date.now();
      await meta.awardLevelComplete(gameId, 3);

      const stats = storage.getGameStats(gameId);
      expect(stats.perfectClears).toBe(1);
    });

    it('should not increment perfect clears for less than 3 stars', async () => {
      const gameId = 'no-perfect-clears-test-' + Date.now();
      await meta.awardLevelComplete(gameId, 2);

      const stats = storage.getGameStats(gameId);
      expect(stats.perfectClears).toBe(0);
    });
  });

  describe('awardDailyComplete', () => {
    it('should award daily completion XP', async () => {
      const result = await meta.awardDailyComplete('test-game');

      expect(result.xpGained).toBe(meta.XP_AWARDS.DAILY_COMPLETE);
    });

    it('should add star bonus', async () => {
      const result = await meta.awardDailyComplete('test-game', 2);

      // 25 + 2 * 5 = 35
      expect(result.xpGained).toBe(35);
    });

    it('should halve XP in zen mode', async () => {
      await storage.updateSettings({ zenMode: true });
      const result = await meta.awardDailyComplete('test-game', 3);

      // (25 + 15) / 2 = 20
      expect(result.xpGained).toBe(20);
    });
  });

  describe('awardAchievement', () => {
    it('should award bronze achievement XP', async () => {
      const result = await meta.awardAchievement('bronze');
      expect(result.xpGained).toBe(50);
    });

    it('should award silver achievement XP', async () => {
      const result = await meta.awardAchievement('silver');
      expect(result.xpGained).toBe(100);
    });

    it('should award gold achievement XP', async () => {
      const result = await meta.awardAchievement('gold');
      expect(result.xpGained).toBe(200);
    });

    it('should award platinum achievement XP', async () => {
      const result = await meta.awardAchievement('platinum');
      expect(result.xpGained).toBe(500);
    });

    it('should default to bronze for unknown tier', async () => {
      const result = await meta.awardAchievement('unknown');
      expect(result.xpGained).toBe(50);
    });
  });

  describe('getCurrentLevel', () => {
    it('should return level 1 for new profile', () => {
      expect(meta.getCurrentLevel()).toBe(1);
    });

    it('should return correct level after XP added', async () => {
      await meta.addXP(500);
      expect(meta.getCurrentLevel()).toBe(4);
    });
  });

  describe('getTotalXP', () => {
    it('should return 0 for new profile', () => {
      expect(meta.getTotalXP()).toBe(0);
    });

    it('should return total XP after additions', async () => {
      await meta.addXP(100);
      await meta.addXP(50);
      expect(meta.getTotalXP()).toBe(150);
    });
  });

  describe('getLevelInfo', () => {
    it('should return level info for new profile', () => {
      const info = meta.getLevelInfo();

      expect(info.level).toBe(1);
      expect(info.xp).toBe(0);
      expect(info.currentLevelXP).toBe(0);
      expect(info.nextLevelXP).toBe(100);
      expect(info.progress).toBe(0);
      expect(info.maxLevel).toBe(false);
    });

    it('should return correct info mid-level', async () => {
      await meta.addXP(50);
      const info = meta.getLevelInfo();

      expect(info.level).toBe(1);
      expect(info.currentLevelXP).toBe(50);
      expect(info.nextLevelXP).toBe(100);
      expect(info.progress).toBe(0.5);
    });

    it('should indicate max level at level 30', async () => {
      await meta.addXP(200000);
      const info = meta.getLevelInfo();

      expect(info.level).toBe(30);
      expect(info.maxLevel).toBe(true);
    });
  });

  describe('getUnlockedCosmetics', () => {
    it('should return default cosmetics for new profile', () => {
      const cosmetics = meta.getUnlockedCosmetics();
      expect(cosmetics).toContain('theme_default');
    });
  });

  describe('isCosmeticUnlocked', () => {
    it('should return true for default theme', () => {
      expect(meta.isCosmeticUnlocked('theme_default')).toBe(true);
    });

    it('should return false for locked cosmetic', async () => {
      // Reset profile to ensure clean state
      const profile = storage.getProfile();
      profile.unlockedCosmetics = ['theme_default'];
      await storage.save(profile);

      expect(meta.isCosmeticUnlocked('theme_dark')).toBe(false);
    });

    it('should return true after unlocking', async () => {
      await storage.unlockCosmetic('theme_dark');
      expect(meta.isCosmeticUnlocked('theme_dark')).toBe(true);
    });
  });

  describe('getProfileStats', () => {
    it('should return stats for new profile', async () => {
      // Reset profile to ensure clean state
      const profile = storage.getProfile();
      profile.gamesPlayed = {};
      profile.achievements = [];
      profile.xp = 0;
      profile.dailyStreak = 0;
      profile.longestStreak = 0;
      await storage.save(profile);

      const stats = meta.getProfileStats();

      expect(stats.level).toBe(1);
      expect(stats.xp).toBe(0);
      expect(stats.totalPlayed).toBe(0);
      expect(stats.totalCompleted).toBe(0);
      expect(stats.totalStars).toBe(0);
      expect(stats.totalPerfectClears).toBe(0);
      expect(stats.achievementCount).toBe(0);
      expect(stats.dailyStreak).toBe(0);
    });

    it('should aggregate stats from multiple games', async () => {
      // Reset profile first to ensure clean state
      const profile = storage.getProfile();
      profile.gamesPlayed = {};
      await storage.save(profile);

      // Use unique game IDs to avoid conflicts
      const game1 = 'agg-game1-' + Date.now();
      const game2 = 'agg-game2-' + Date.now();

      await storage.updateGameStats(game1, { played: 5, completed: 3, stars: 10 });
      await storage.updateGameStats(game2, { played: 10, completed: 8, stars: 20 });

      const stats = meta.getProfileStats();

      expect(stats.totalPlayed).toBe(15);
      expect(stats.totalCompleted).toBe(11);
      expect(stats.totalStars).toBe(30);
    });
  });

  describe('formatXP', () => {
    it('should format small numbers as-is', () => {
      expect(meta.formatXP(0)).toBe('0');
      expect(meta.formatXP(100)).toBe('100');
      expect(meta.formatXP(999)).toBe('999');
    });

    it('should format thousands with K suffix', () => {
      expect(meta.formatXP(1000)).toBe('1.0K');
      expect(meta.formatXP(5500)).toBe('5.5K');
      expect(meta.formatXP(999999)).toBe('1000.0K');
    });

    it('should format millions with M suffix', () => {
      expect(meta.formatXP(1000000)).toBe('1.0M');
      expect(meta.formatXP(2500000)).toBe('2.5M');
    });
  });
});
