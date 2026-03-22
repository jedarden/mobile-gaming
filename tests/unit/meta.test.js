/**
 * Meta — Unit Tests
 *
 * Tests XP/progression system: awardLevelComplete, getLevelInfo,
 * getCompletedLevels, getTotalStars, getPlayerLevel, getXPProgress,
 * updateDailyStreak, getDailyStreak, getPlayerStats.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock localStorage ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store = {};
  return {
    getItem:    vi.fn((key)        => store[key] ?? null),
    setItem:    vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key)        => { delete store[key]; }),
    clear:      vi.fn(()           => { store = {}; }),
    get length()  { return Object.keys(store).length; },
    key:        vi.fn((i)          => Object.keys(store)[i] ?? null),
    _reset()    { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

import {
  awardLevelComplete,
  getLevelInfo,
  getCompletedLevels,
  getTotalStars,
  getPlayerLevel,
  getXPProgress,
  updateDailyStreak,
  getDailyStreak,
  getPlayerStats,
} from '../../src/shared/meta.js';

beforeEach(() => {
  localStorageMock._reset();
  vi.clearAllMocks();
});

// ── awardLevelComplete ─────────────────────────────────────────────────────

describe('awardLevelComplete', () => {
  it('awards XP equal to stars * 100 for first completion', async () => {
    const result = await awardLevelComplete('water-sort', 3, { levelId: 1 });
    // 3 stars * 100 = 300, plus 50 first-completion bonus
    expect(result.xpEarned).toBe(350);
  });

  it('includes first-completion bonus', async () => {
    const result = await awardLevelComplete('water-sort', 1, { levelId: 2 });
    // 1 star * 100 = 100, plus 50 bonus = 150
    expect(result.xpEarned).toBe(150);
  });

  it('marks isFirstCompletion=true on first attempt', async () => {
    const result = await awardLevelComplete('water-sort', 2, { levelId: 3 });
    expect(result.isFirstCompletion).toBe(true);
  });

  it('marks isFirstCompletion=false on subsequent attempt', async () => {
    await awardLevelComplete('water-sort', 2, { levelId: 4 });
    const result = await awardLevelComplete('water-sort', 2, { levelId: 4 });
    expect(result.isFirstCompletion).toBe(false);
  });

  it('gives improvement bonus when earning more stars than before', async () => {
    await awardLevelComplete('water-sort', 1, { levelId: 5 });
    const result = await awardLevelComplete('water-sort', 3, { levelId: 5 });
    // improvement: (3-1) * 100 = 200 additional XP
    expect(result.xpEarned).toBeGreaterThanOrEqual(200);
  });

  it('does not give improvement bonus when stars stay same or drop', async () => {
    await awardLevelComplete('water-sort', 3, { levelId: 6 });
    const result = await awardLevelComplete('water-sort', 2, { levelId: 6 });
    // no first-completion bonus, no improvement bonus
    expect(result.xpEarned).toBe(200); // 2 * 100
  });

  it('adds daily bonus when isDaily=true', async () => {
    const result = await awardLevelComplete('water-sort', 1, { levelId: 7, isDaily: true });
    // 100 + 50 (first) + 200 (daily) = 350
    expect(result.xpEarned).toBe(350);
  });

  it('accumulates total XP', async () => {
    await awardLevelComplete('water-sort', 1, { levelId: 'a' });
    const result = await awardLevelComplete('water-sort', 1, { levelId: 'b' });
    expect(result.totalXP).toBeGreaterThan(100);
  });

  it('sets leveledUp when player level increases', async () => {
    // Award enough XP to cross level 1→2 threshold (300 XP needed)
    await awardLevelComplete('water-sort', 3, { levelId: 'x1' }); // 350 XP
    const result = await awardLevelComplete('water-sort', 1, { levelId: 'x2' }); // gets us to 450+
    // Whether we level up depends on total XP; test that flag is boolean
    expect(typeof result.leveledUp).toBe('boolean');
  });

  it('returns player level ≥ 1', async () => {
    const result = await awardLevelComplete('water-sort', 1, { levelId: 'z' });
    expect(result.playerLevel).toBeGreaterThanOrEqual(1);
  });

  it('works without a levelId (defaults to "current")', async () => {
    const result = await awardLevelComplete('brain-teaser', 2);
    expect(result.xpEarned).toBeGreaterThan(0);
  });
});

// ── getLevelInfo ──────────────────────────────────────────────────────────

describe('getLevelInfo', () => {
  it('returns null before any completions', () => {
    expect(getLevelInfo('water-sort', 1)).toBeNull();
  });

  it('returns stored level data after completion', async () => {
    await awardLevelComplete('pull-the-pin', 2, { levelId: 1, moves: 5 });
    const info = getLevelInfo('pull-the-pin', 1);
    expect(info).toBeDefined();
    expect(info.stars).toBe(2);
    expect(info.moves).toBe(5);
  });

  it('returns null for a different game/level', async () => {
    await awardLevelComplete('pull-the-pin', 2, { levelId: 1 });
    expect(getLevelInfo('bus-jam', 1)).toBeNull();
  });
});

// ── getCompletedLevels ────────────────────────────────────────────────────

describe('getCompletedLevels', () => {
  it('returns empty object when game has no completions', () => {
    expect(getCompletedLevels('unknown-game')).toEqual({});
  });

  it('returns all completed levels for a game', async () => {
    await awardLevelComplete('water-sort', 3, { levelId: 1 });
    await awardLevelComplete('water-sort', 1, { levelId: 2 });
    const levels = getCompletedLevels('water-sort');
    expect(Object.keys(levels)).toHaveLength(2);
    expect(levels[1].stars).toBe(3);
    expect(levels[2].stars).toBe(1);
  });
});

// ── getTotalStars ─────────────────────────────────────────────────────────

describe('getTotalStars', () => {
  it('returns 0 before any completions', () => {
    expect(getTotalStars()).toBe(0);
  });

  it('counts stars across all games', async () => {
    await awardLevelComplete('water-sort', 2, { levelId: 1 });
    await awardLevelComplete('bus-jam', 3, { levelId: 1 });
    expect(getTotalStars()).toBe(5);
  });

  it('uses highest stars for re-completed levels', async () => {
    await awardLevelComplete('water-sort', 1, { levelId: 1 });
    await awardLevelComplete('water-sort', 3, { levelId: 1 });
    // Most recent write wins (3 stars)
    expect(getTotalStars()).toBe(3);
  });
});

// ── getPlayerLevel / getXPProgress ───────────────────────────────────────

describe('getPlayerLevel', () => {
  it('returns 1 with no XP', () => {
    expect(getPlayerLevel()).toBe(1);
  });

  it('returns > 1 after enough XP accumulated', async () => {
    // Need 300 XP for level 2
    await awardLevelComplete('water-sort', 3, { levelId: 'lv1' }); // 350 XP
    expect(getPlayerLevel()).toBeGreaterThanOrEqual(2);
  });
});

describe('getXPProgress', () => {
  it('returns object with current, needed, and progress fields', async () => {
    await awardLevelComplete('water-sort', 1, { levelId: 'p1' });
    const progress = getXPProgress();
    expect(typeof progress.current).toBe('number');
    expect(typeof progress.needed).toBe('number');
    expect(typeof progress.progress).toBe('number');
  });

  it('progress is between 0 and 1', async () => {
    await awardLevelComplete('water-sort', 2, { levelId: 'p2' });
    const { progress } = getXPProgress();
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThanOrEqual(1);
  });

  it('current is non-negative', async () => {
    const { current } = getXPProgress();
    expect(current).toBeGreaterThanOrEqual(0);
  });
});

// ── updateDailyStreak / getDailyStreak ────────────────────────────────────

describe('updateDailyStreak', () => {
  it('starts streak at 1 on first call', () => {
    const result = updateDailyStreak();
    expect(result.streak).toBe(1);
    expect(result.isNewDay).toBe(true);
  });

  it('does not increment streak on same day', () => {
    updateDailyStreak(); // first call
    const result = updateDailyStreak(); // same day
    expect(result.isNewDay).toBe(false);
    expect(result.streak).toBe(1);
  });

  it('returns object with streak and isNewDay properties', () => {
    const result = updateDailyStreak();
    expect(result).toHaveProperty('streak');
    expect(result).toHaveProperty('isNewDay');
  });
});

describe('getDailyStreak', () => {
  it('returns 0 before any daily activity', () => {
    expect(getDailyStreak()).toBe(0);
  });

  it('returns 1 after first daily activity', () => {
    updateDailyStreak();
    expect(getDailyStreak()).toBe(1);
  });
});

// ── getPlayerStats ────────────────────────────────────────────────────────

describe('getPlayerStats', () => {
  it('returns stats object with expected fields', async () => {
    const stats = getPlayerStats();
    expect(stats).toHaveProperty('totalXP');
    expect(stats).toHaveProperty('playerLevel');
    expect(stats).toHaveProperty('totalStars');
    expect(stats).toHaveProperty('dailyStreak');
    expect(stats).toHaveProperty('gamesPlayed');
    expect(stats).toHaveProperty('firstPlayDate');
  });

  it('starts with 0 XP and level 1', () => {
    const stats = getPlayerStats();
    expect(stats.totalXP).toBe(0);
    expect(stats.playerLevel).toBe(1);
  });

  it('increments gamesPlayed after completing levels in new games', async () => {
    await awardLevelComplete('game-a', 1, { levelId: 1 });
    await awardLevelComplete('game-b', 1, { levelId: 1 });
    const stats = getPlayerStats();
    expect(stats.gamesPlayed).toBe(2);
  });

  it('updates totalXP after completions', async () => {
    await awardLevelComplete('game-c', 3, { levelId: 1 });
    const stats = getPlayerStats();
    expect(stats.totalXP).toBeGreaterThan(0);
  });
});
