/**
 * Tests for Storage.js - Profile and Data Persistence
 */

import { describe, it, expect, beforeEach } from 'vitest';
import storage, {
  initStorage,
  getProfile,
  updateProfile,
  getGameStats,
  updateGameStats,
  getSettings,
  updateSettings,
  hasAchievement,
  unlockAchievement,
  hasCosmetic,
  unlockCosmetic,
  getDailyChallengeData,
  saveDailyChallengeData,
  clearAllData,
  DEFAULT_PROFILE,
  DEFAULT_GAME_STATS
} from '../../src/shared/storage.js';

describe('Storage', () => {
  beforeEach(async () => {
    // Clear storage completely and reinitialize
    await clearAllData();
    await initStorage();
  });

  describe('initStorage', () => {
    it('should return a profile object', async () => {
      const profile = await initStorage();

      expect(profile).toBeDefined();
      expect(profile.xp).toBeDefined();
      expect(profile.level).toBeDefined();
    });

    it('should create default profile if none exists', async () => {
      localStorage.clear();
      const profile = await initStorage();

      expect(profile.xp).toBe(0);
      expect(profile.level).toBe(1);
      expect(profile.achievements).toEqual([]);
    });
  });

  describe('getProfile', () => {
    it('should return current profile', async () => {
      await initStorage();
      const profile = getProfile();

      expect(profile).toBeDefined();
      expect(profile.version).toBe(DEFAULT_PROFILE.version);
    });
  });

  describe('updateProfile', () => {
    it('should update profile fields', async () => {
      await initStorage();

      await updateProfile({ xp: 100, level: 2 });

      const profile = getProfile();
      expect(profile.xp).toBe(100);
      expect(profile.level).toBe(2);
    });

    it('should preserve unmodified fields', async () => {
      await initStorage();

      await updateProfile({ xp: 500 });

      const profile = getProfile();
      expect(profile.xp).toBe(500);
      expect(profile.level).toBe(1); // Should remain default
    });
  });

  describe('Game Stats', () => {
    describe('getGameStats', () => {
      it('should return default stats for new game', async () => {
        await initStorage();
        const stats = getGameStats('new-game');

        expect(stats).toEqual(DEFAULT_GAME_STATS);
      });
    });

    describe('updateGameStats', () => {
      it('should update game stats', async () => {
        await initStorage();

        await updateGameStats('test-game', { played: 5, completed: 3 });

        const stats = getGameStats('test-game');
        expect(stats.played).toBe(5);
        expect(stats.completed).toBe(3);
      });

      it('should merge with existing stats', async () => {
        await initStorage();

        await updateGameStats('merge-game', { played: 10 });
        await updateGameStats('merge-game', { completed: 8 });

        const stats = getGameStats('merge-game');
        expect(stats.played).toBe(10);
        expect(stats.completed).toBe(8);
      });
    });
  });

  describe('Settings', () => {
    describe('getSettings', () => {
      it('should return default settings', async () => {
        await initStorage();
        const settings = getSettings();

        expect(settings.soundEnabled).toBe(true);
        expect(settings.hapticEnabled).toBe(true);
      });
    });

    describe('updateSettings', () => {
      it('should update settings', async () => {
        await initStorage();

        await updateSettings({ soundEnabled: false, reducedMotion: true });

        const settings = getSettings();
        expect(settings.soundEnabled).toBe(false);
        expect(settings.reducedMotion).toBe(true);
        // Other settings should remain
        expect(settings.hapticEnabled).toBe(true);
      });
    });
  });

  describe('Achievements', () => {
    describe('hasAchievement', () => {
      it('should return false for missing achievement', async () => {
        await initStorage();

        expect(hasAchievement('first-win')).toBe(false);
      });
    });

    describe('unlockAchievement', () => {
      it('should unlock new achievement', async () => {
        await initStorage();

        const result = await unlockAchievement('first-win');

        expect(result).toBe(true);
        expect(hasAchievement('first-win')).toBe(true);
      });

      it('should return false for already unlocked achievement', async () => {
        await initStorage();

        await unlockAchievement('first-win');
        const result = await unlockAchievement('first-win');

        expect(result).toBe(false);
      });
    });
  });

  describe('Cosmetics', () => {
    describe('hasCosmetic', () => {
      it('should return true for default theme', async () => {
        await initStorage();

        expect(hasCosmetic('theme_default')).toBe(true);
      });

      it('should return false for locked cosmetic', async () => {
        await initStorage();

        expect(hasCosmetic('theme_gold')).toBe(false);
      });
    });

    describe('unlockCosmetic', () => {
      it('should unlock new cosmetic', async () => {
        await initStorage();

        const result = await unlockCosmetic('theme_gold');

        expect(result).toBe(true);
        expect(hasCosmetic('theme_gold')).toBe(true);
      });

      it('should return false for already unlocked cosmetic', async () => {
        await initStorage();

        await unlockCosmetic('theme_rainbow');
        const result = await unlockCosmetic('theme_rainbow');

        expect(result).toBe(false);
      });
    });
  });

  describe('Daily Challenge Data', () => {
    describe('getDailyChallengeData', () => {
      it('should return null for missing data', async () => {
        await initStorage();

        const data = getDailyChallengeData('2024-01-01', 'water-sort');

        expect(data).toBeNull();
      });
    });

    describe('saveDailyChallengeData', () => {
      it('should save and retrieve daily data', async () => {
        await initStorage();

        const testData = { completed: true, stars: 3, moves: 25 };
        await saveDailyChallengeData('2024-01-01', 'water-sort', testData);

        const retrieved = getDailyChallengeData('2024-01-01', 'water-sort');
        expect(retrieved).toEqual(testData);
      });
    });
  });

  describe('clearAllData', () => {
    it('should clear all data', async () => {
      // Note: This test runs in isolation without beforeEach to properly test clearAllData

      // Initialize fresh
      await clearAllData();
      await initStorage();

      // Add some data
      await updateProfile({ xp: 1000 });
      await unlockAchievement('clear-test-achievement');
      await saveDailyChallengeData('2024-01-01', 'clear-test-game', { completed: true });

      // Clear all
      const result = await clearAllData();

      expect(result).toBe(true);

      // Daily data should be cleared
      const dailyData = getDailyChallengeData('2024-01-01', 'clear-test-game');
      expect(dailyData).toBeNull();
    });
  });
});
