/**
 * Daily Challenge System — Unit Tests
 *
 * Tests for deterministic seed generation, challenge selection,
 * completion tracking, streak calculation, and upcoming previews.
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock localStorage ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

import {
  getTodaySeed,
  getDailyChallenge,
  getGameDailySeed,
  getGameDailyNumericSeed,
  isDailyCompleted,
  isGameDailyCompleted,
  completeDailyChallenge,
  getDailyStats,
  getUpcomingDailies,
  getDailyGames,
} from '../../src/shared/daily.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setDate(isoDate) {
  vi.setSystemTime(new Date(isoDate + 'T12:00:00Z'));
}

function clearStorage() {
  localStorageMock.clear();
}

// ─── getTodaySeed ─────────────────────────────────────────────────────────────

describe('getTodaySeed', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns YYYY-MM-DD format', () => {
    setDate('2026-03-22');
    expect(getTodaySeed()).toBe('2026-03-22');
  });

  it('changes when date changes', () => {
    setDate('2026-03-22');
    const seed1 = getTodaySeed();
    setDate('2026-03-23');
    const seed2 = getTodaySeed();
    expect(seed1).not.toBe(seed2);
  });
});

// ─── getGameDailySeed / getGameDailyNumericSeed ───────────────────────────────

describe('getGameDailySeed', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('includes the gameId and date', () => {
    setDate('2026-03-22');
    const seed = getGameDailySeed('water-sort');
    expect(seed).toContain('water-sort');
    expect(seed).toContain('2026-03-22');
  });

  it('different games produce different seeds', () => {
    setDate('2026-03-22');
    expect(getGameDailySeed('water-sort')).not.toBe(getGameDailySeed('pull-the-pin'));
  });

  it('same game same day produces the same seed', () => {
    setDate('2026-03-22');
    expect(getGameDailySeed('water-sort')).toBe(getGameDailySeed('water-sort'));
  });
});

describe('getGameDailyNumericSeed', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns a number', () => {
    setDate('2026-03-22');
    expect(typeof getGameDailyNumericSeed('water-sort')).toBe('number');
  });

  it('is deterministic for same game and date', () => {
    setDate('2026-03-22');
    expect(getGameDailyNumericSeed('water-sort')).toBe(getGameDailyNumericSeed('water-sort'));
  });

  it('differs between games', () => {
    setDate('2026-03-22');
    expect(getGameDailyNumericSeed('water-sort')).not.toBe(getGameDailyNumericSeed('pull-the-pin'));
  });

  it('differs between dates', () => {
    setDate('2026-03-22');
    const seed1 = getGameDailyNumericSeed('water-sort');
    setDate('2026-03-23');
    const seed2 = getGameDailyNumericSeed('water-sort');
    expect(seed1).not.toBe(seed2);
  });

  it('is a non-negative integer', () => {
    setDate('2026-03-22');
    const s = getGameDailyNumericSeed('crowd-runner');
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

// ─── getDailyChallenge ────────────────────────────────────────────────────────

describe('getDailyChallenge', () => {
  beforeEach(() => { vi.useFakeTimers(); clearStorage(); });
  afterEach(() => vi.useRealTimers());

  it('returns an object with gameId, level, and seed', () => {
    setDate('2026-03-22');
    const challenge = getDailyChallenge();
    expect(challenge).toHaveProperty('gameId');
    expect(challenge).toHaveProperty('level');
    expect(challenge).toHaveProperty('seed');
  });

  it('is deterministic — same day produces same challenge', () => {
    setDate('2026-03-22');
    const c1 = getDailyChallenge();
    const c2 = getDailyChallenge();
    expect(c1.gameId).toBe(c2.gameId);
    expect(c1.level).toBe(c2.level);
  });

  it('changes on a different day', () => {
    setDate('2026-03-22');
    const c1 = getDailyChallenge();
    setDate('2026-03-30');
    const c2 = getDailyChallenge();
    // Different date → different seed → at least one of gameId/level differs in general
    expect(c1.seed).not.toBe(c2.seed);
  });

  it('gameId is one of the known daily games', () => {
    setDate('2026-03-22');
    const { gameId } = getDailyChallenge();
    expect(getDailyGames()).toContain(gameId);
  });

  it('level is in the range 1–50', () => {
    setDate('2026-03-22');
    const { level } = getDailyChallenge();
    expect(level).toBeGreaterThanOrEqual(1);
    expect(level).toBeLessThanOrEqual(50);
  });

  it('seed matches the current date string', () => {
    setDate('2026-03-22');
    const { seed } = getDailyChallenge();
    expect(seed).toBe('2026-03-22');
  });
});

// ─── isDailyCompleted / completeDailyChallenge ────────────────────────────────

describe('isDailyCompleted', () => {
  beforeEach(() => { vi.useFakeTimers(); clearStorage(); });
  afterEach(() => vi.useRealTimers());

  it('returns false before completion', () => {
    setDate('2026-03-22');
    expect(isDailyCompleted()).toBe(false);
  });

  it('returns true after completeDailyChallenge', () => {
    setDate('2026-03-22');
    completeDailyChallenge();
    expect(isDailyCompleted()).toBe(true);
  });

  it('does not carry over to the next day', () => {
    setDate('2026-03-22');
    completeDailyChallenge();
    setDate('2026-03-23');
    expect(isDailyCompleted()).toBe(false);
  });

  it('returns false when stored value is truthy but not exactly true (strict ===)', () => {
    setDate('2026-03-22');
    // Inject numeric 1 instead of boolean true
    localStorageMock.setItem('mg:daily', JSON.stringify({ completed: { '2026-03-22': 1 } }));
    expect(isDailyCompleted()).toBe(false);
  });
});

describe('isGameDailyCompleted', () => {
  beforeEach(() => { vi.useFakeTimers(); clearStorage(); });
  afterEach(() => vi.useRealTimers());

  it('returns false before game-specific completion', () => {
    setDate('2026-03-22');
    expect(isGameDailyCompleted('water-sort')).toBe(false);
  });

  it('returns true after completeDailyChallenge with gameId', () => {
    setDate('2026-03-22');
    completeDailyChallenge('water-sort');
    expect(isGameDailyCompleted('water-sort')).toBe(true);
  });

  it('completing one game does not mark another as complete', () => {
    setDate('2026-03-22');
    completeDailyChallenge('water-sort');
    expect(isGameDailyCompleted('pull-the-pin')).toBe(false);
  });

  it('completing with a gameId also marks the general daily as complete', () => {
    setDate('2026-03-22');
    completeDailyChallenge('water-sort');
    expect(isDailyCompleted()).toBe(true);
  });
});

// ─── getDailyStats ────────────────────────────────────────────────────────────

describe('getDailyStats', () => {
  beforeEach(() => { vi.useFakeTimers(); clearStorage(); });
  afterEach(() => vi.useRealTimers());

  it('returns zero stats on fresh storage', () => {
    setDate('2026-03-22');
    const stats = getDailyStats();
    expect(stats.totalCompleted).toBe(0);
    expect(stats.currentStreak).toBe(0);
    expect(stats.lastCompletedDate).toBe(null);
  });

  it('increments totalCompleted after completion', () => {
    setDate('2026-03-22');
    completeDailyChallenge();
    expect(getDailyStats().totalCompleted).toBe(1);
  });

  it('streak is 1 after completing today', () => {
    setDate('2026-03-22');
    completeDailyChallenge();
    expect(getDailyStats().currentStreak).toBe(1);
  });

  it('streak is 2 after completing two consecutive days', () => {
    setDate('2026-03-21');
    completeDailyChallenge();
    setDate('2026-03-22');
    completeDailyChallenge();
    expect(getDailyStats().currentStreak).toBe(2);
  });

  it('streak resets after a missed day', () => {
    setDate('2026-03-20');
    completeDailyChallenge();
    // Skip 2026-03-21
    setDate('2026-03-22');
    completeDailyChallenge();
    expect(getDailyStats().currentStreak).toBe(1);
  });

  it('lastCompletedDate reflects the most recent completion', () => {
    setDate('2026-03-22');
    completeDailyChallenge();
    expect(getDailyStats().lastCompletedDate).toBe('2026-03-22');
  });

  it('totalCompleted counts only date entries, not game-specific entries', () => {
    setDate('2026-03-22');
    completeDailyChallenge('water-sort');   // sets both date and date:game
    completeDailyChallenge('pull-the-pin'); // sets date:game (date already set)
    expect(getDailyStats().totalCompleted).toBe(1);
  });

  it('completeDailyChallenge(null) marks only the general daily (no game-specific entry)', () => {
    setDate('2026-03-22');
    completeDailyChallenge(null);
    expect(isDailyCompleted()).toBe(true);
    // No game-specific key should exist
    expect(getDailyStats().totalCompleted).toBe(1);
  });

  it('streak counts yesterday when today is not yet completed (i===0 does not break streak)', () => {
    // Complete yesterday
    setDate('2026-03-21');
    completeDailyChallenge();
    // Move to today but do NOT complete
    setDate('2026-03-22');
    const stats = getDailyStats();
    // i=0 (today) not completed → no break (i>0 guard)
    // i=1 (yesterday) completed → streak=1
    expect(stats.currentStreak).toBe(1);
  });
});

// ─── getUpcomingDailies ───────────────────────────────────────────────────────

describe('getUpcomingDailies', () => {
  beforeEach(() => { vi.useFakeTimers(); clearStorage(); });
  afterEach(() => vi.useRealTimers());

  it('returns the requested number of days', () => {
    setDate('2026-03-22');
    expect(getUpcomingDailies(5).length).toBe(5);
    expect(getUpcomingDailies(7).length).toBe(7);
  });

  it('first entry is marked isToday', () => {
    setDate('2026-03-22');
    const [today, ...rest] = getUpcomingDailies(3);
    expect(today.isToday).toBe(true);
    expect(rest.every(d => !d.isToday)).toBe(true);
  });

  it('each entry has date, gameId, and level fields', () => {
    setDate('2026-03-22');
    for (const entry of getUpcomingDailies(3)) {
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('gameId');
      expect(entry).toHaveProperty('level');
    }
  });

  it('dates are consecutive starting from today', () => {
    setDate('2026-03-22');
    const entries = getUpcomingDailies(3);
    expect(entries[0].date).toBe('2026-03-22');
    expect(entries[1].date).toBe('2026-03-23');
    expect(entries[2].date).toBe('2026-03-24');
  });

  it('is deterministic — same call produces same results', () => {
    setDate('2026-03-22');
    const r1 = getUpcomingDailies(3);
    const r2 = getUpcomingDailies(3);
    for (let i = 0; i < 3; i++) {
      expect(r1[i].gameId).toBe(r2[i].gameId);
      expect(r1[i].level).toBe(r2[i].level);
    }
  });

  it('gameId in each entry is a known game', () => {
    setDate('2026-03-22');
    const games = getDailyGames();
    for (const entry of getUpcomingDailies(7)) {
      expect(games).toContain(entry.gameId);
    }
  });

  it('all levels are in range 1–50', () => {
    setDate('2026-03-22');
    for (const entry of getUpcomingDailies(10)) {
      expect(entry.level).toBeGreaterThanOrEqual(1);
      expect(entry.level).toBeLessThanOrEqual(50);
    }
  });

  it('returns empty array when days is 0', () => {
    setDate('2026-03-22');
    expect(getUpcomingDailies(0)).toEqual([]);
  });

  it('returns empty array when days is negative', () => {
    setDate('2026-03-22');
    expect(getUpcomingDailies(-1)).toEqual([]);
  });

  it('returns array of length 1 when days is 1', () => {
    setDate('2026-03-22');
    expect(getUpcomingDailies(1)).toHaveLength(1);
    expect(getUpcomingDailies(1)[0].isToday).toBe(true);
  });
});

// ─── getDailyData corruption recovery ────────────────────────────────────────

describe('getDailyData corruption recovery', () => {
  beforeEach(() => { vi.useFakeTimers(); clearStorage(); });
  afterEach(() => vi.useRealTimers());

  it('returns empty completed object when localStorage contains invalid JSON', () => {
    setDate('2026-03-22');
    // Corrupt the storage directly
    localStorageMock.setItem('mg:daily', '{ not valid json }');
    // All public functions that call getDailyData internally should return safe defaults
    expect(isDailyCompleted()).toBe(false);
    const stats = getDailyStats();
    expect(stats.totalCompleted).toBe(0);
    expect(stats.currentStreak).toBe(0);
    expect(stats.lastCompletedDate).toBe(null);
  });

  it('returns safe default when localStorage contains empty string (falsy)', () => {
    setDate('2026-03-22');
    // Empty string is falsy — getDailyData returns { completed: {} }
    localStorageMock.setItem('mg:daily', '');
    expect(isDailyCompleted()).toBe(false);
  });
});

// ─── getDailyGames ────────────────────────────────────────────────────────────

describe('getDailyGames', () => {
  it('returns an array of strings', () => {
    const games = getDailyGames();
    expect(Array.isArray(games)).toBe(true);
    expect(games.length).toBeGreaterThan(0);
    for (const g of games) expect(typeof g).toBe('string');
  });

  it('returns a copy (mutation does not affect internal list)', () => {
    const games = getDailyGames();
    const original = [...games];
    games.push('hacked');
    expect(getDailyGames()).toEqual(original);
  });
});

// ─── saveDailyData error resilience ──────────────────────────────────────────

describe('saveDailyData — catch block', () => {
  beforeEach(() => { vi.useFakeTimers(); clearStorage(); setDate('2026-03-22'); });
  afterEach(() => vi.useRealTimers());

  it('does not throw when localStorage.setItem throws (quota exceeded)', () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    });
    // completeDailyChallenge calls saveDailyData internally
    expect(() => completeDailyChallenge()).not.toThrow();
  });
});
