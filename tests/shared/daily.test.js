/**
 * Tests for Daily.js - Daily Challenge System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import daily module (will use mocked localStorage from setup.js)
import * as storage from '../../src/shared/storage.js';
import * as daily from '../../src/shared/daily.js';

describe('Daily Challenge System', () => {
  beforeEach(async () => {
    // Reset storage before each test
    await storage.initStorage();
  });

  describe('getTodayString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const result = daily.getTodayString();
      const pattern = /^\d{4}-\d{2}-\d{2}$/;

      expect(result).toMatch(pattern);
    });
  });

  describe('getYesterdayString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const result = daily.getYesterdayString();
      const pattern = /^\d{4}-\d{2}-\d{2}$/;

      expect(result).toMatch(pattern);
    });

    it('should be one day before today', () => {
      const today = new Date(daily.getTodayString());
      const yesterday = new Date(daily.getYesterdayString());
      const diffMs = today - yesterday;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeCloseTo(1, 0);
    });
  });

  describe('getDailySeed', () => {
    it('should return a number', () => {
      const seed = daily.getDailySeed();

      expect(typeof seed).toBe('number');
    });

    it('should return positive number', () => {
      const seed = daily.getDailySeed();

      expect(seed).toBeGreaterThan(0);
    });

    it('should return same seed for same day', () => {
      const seed1 = daily.getDailySeed();
      const seed2 = daily.getDailySeed();

      expect(seed1).toBe(seed2);
    });
  });

  describe('getDailySeedForDate', () => {
    it('should return consistent seeds for same date', () => {
      const seed1 = daily.getDailySeedForDate('2024-01-01');
      const seed2 = daily.getDailySeedForDate('2024-01-01');

      expect(seed1).toBe(seed2);
    });

    it('should return different seeds for different dates', () => {
      const seed1 = daily.getDailySeedForDate('2024-01-01');
      const seed2 = daily.getDailySeedForDate('2024-01-02');

      expect(seed1).not.toBe(seed2);
    });
  });

  describe('getGameDailySeed', () => {
    it('should return different seeds for different games', () => {
      const seed1 = daily.getGameDailySeed('water-sort');
      const seed2 = daily.getGameDailySeed('parking-escape');

      expect(seed1).not.toBe(seed2);
    });
  });

  describe('getDailyChallenge', () => {
    it('should return challenge object with required fields', () => {
      const challenge = daily.getDailyChallenge('water-sort');

      expect(challenge).toHaveProperty('date');
      expect(challenge).toHaveProperty('gameId');
      expect(challenge).toHaveProperty('seed');
      expect(challenge).toHaveProperty('difficulty');
      expect(challenge).toHaveProperty('completed');
    });

    it('should set gameId correctly', () => {
      const challenge = daily.getDailyChallenge('bus-jam');

      expect(challenge.gameId).toBe('bus-jam');
    });

    it('should set difficulty from seed', () => {
      const challenge = daily.getDailyChallenge('pull-pin');

      expect(['easy', 'medium', 'hard']).toContain(challenge.difficulty);
    });
  });

  describe('getStreakEmoji', () => {
    it('should return crown for 100+ streak', () => {
      expect(daily.getStreakEmoji(100)).toBe('👑');
      expect(daily.getStreakEmoji(200)).toBe('👑');
    });

    it('should return fire for 30+ streak', () => {
      expect(daily.getStreakEmoji(30)).toBe('🔥');
      expect(daily.getStreakEmoji(50)).toBe('🔥');
    });

    it('should return lightning for 7+ streak', () => {
      expect(daily.getStreakEmoji(7)).toBe('⚡');
      expect(daily.getStreakEmoji(15)).toBe('⚡');
    });

    it('should return sparkles for 3+ streak', () => {
      expect(daily.getStreakEmoji(3)).toBe('✨');
      expect(daily.getStreakEmoji(5)).toBe('✨');
    });

    it('should return star for lower streaks', () => {
      expect(daily.getStreakEmoji(1)).toBe('🌟');
      expect(daily.getStreakEmoji(2)).toBe('🌟');
    });
  });

  describe('getStreakMessage', () => {
    it('should return appropriate messages based on streak', () => {
      expect(daily.getStreakMessage(100)).toContain('legend');
      expect(daily.getStreakMessage(30)).toContain('month');
      expect(daily.getStreakMessage(14)).toContain('week');
      expect(daily.getStreakMessage(7)).toContain('week');
      expect(daily.getStreakMessage(3)).toContain('Nice');
      expect(daily.getStreakMessage(1)).toContain('start');
      expect(daily.getStreakMessage(0)).toContain('first');
    });
  });

  describe('getTimeUntilReset', () => {
    it('should return a positive number', () => {
      const ms = daily.getTimeUntilReset();

      expect(ms).toBeGreaterThan(0);
    });

    it('should be less than 24 hours', () => {
      const ms = daily.getTimeUntilReset();
      const hours = ms / (1000 * 60 * 60);

      expect(hours).toBeLessThan(24);
    });
  });

  describe('formatTimeUntilReset', () => {
    it('should return formatted string', () => {
      const formatted = daily.formatTimeUntilReset();

      // Should match patterns like "5h 30m" or "45m"
      expect(formatted).toMatch(/^\d+h \d+m$|^\d+m$/);
    });
  });

  describe('getDailyStatus', () => {
    it('should return status for all games', () => {
      const status = daily.getDailyStatus();

      expect(Array.isArray(status)).toBe(true);
      expect(status.length).toBe(4);
    });

    it('should include required game IDs', () => {
      const status = daily.getDailyStatus();
      const gameIds = status.map(s => s.gameId);

      expect(gameIds).toContain('water-sort');
      expect(gameIds).toContain('parking-escape');
      expect(gameIds).toContain('bus-jam');
      expect(gameIds).toContain('pull-pin');
    });
  });
});
