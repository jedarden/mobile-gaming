/**
 * Adaptive Difficulty — Unit Tests
 *
 * Tests frustration computation, tier transitions, streak logic, and storage.
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock localStorage ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    _store: () => store,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

import {
  computeFrustration,
  getTier,
  recordLevel,
  resetAdaptive,
  setTier,
  getProfile,
  tierToString,
  MIN_TIER,
  MAX_TIER,
  DEFAULT_TIER,
  FRUSTRATION_THRESHOLD,
  FRUSTRATION_STREAK,
  SUCCESS_STREAK_HARD,
} from '../../src/shared/adaptive.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GAME = 'water-sort';

function clearGame() {
  localStorageMock.clear();
}

// ─── computeFrustration ───────────────────────────────────────────────────────

describe('computeFrustration', () => {
  it('returns 0 for zero signals', () => {
    expect(computeFrustration({})).toBe(0);
  });

  it('returns a value between 0 and 1', () => {
    const score = computeFrustration({ retryCount: 3, hesitationTime: 5000, solveTime: 60000 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns high frustration for many retries and hints', () => {
    const score = computeFrustration({
      retryCount: 10,
      hintUsage: 5,
      rapidTapBursts: 5,
      undoRate: 3,
    });
    expect(score).toBeGreaterThan(FRUSTRATION_THRESHOLD);
  });

  it('returns low frustration for a quick clean solve', () => {
    const score = computeFrustration({
      retryCount: 0,
      hesitationTime: 1000,
      hintUsage: 0,
      undoRate: 0,
      solveTime: 8000,
      rapidTapBursts: 0,
    });
    expect(score).toBeLessThan(0.3);
  });

  it('caps normalized values at 1', () => {
    // Absurdly high retry count should still cap at 1
    const score = computeFrustration({ retryCount: 1000, hintUsage: 1000 });
    expect(score).toBeLessThanOrEqual(1);
  });

  it('handles missing fields gracefully', () => {
    expect(() => computeFrustration({ retryCount: 3 })).not.toThrow();
    expect(() => computeFrustration(undefined)).not.toThrow();
  });
});

// ─── getTier ──────────────────────────────────────────────────────────────────

describe('getTier', () => {
  beforeEach(clearGame);

  it('returns DEFAULT_TIER for a new game', () => {
    expect(getTier(GAME)).toBe(DEFAULT_TIER);
  });

  it('returns updated tier after setTier', () => {
    setTier(GAME, 4);
    expect(getTier(GAME)).toBe(4);
  });

  it('clamps tier to MIN_TIER', () => {
    setTier(GAME, -5);
    expect(getTier(GAME)).toBe(MIN_TIER);
  });

  it('clamps tier to MAX_TIER', () => {
    setTier(GAME, 99);
    expect(getTier(GAME)).toBe(MAX_TIER);
  });
});

// ─── recordLevel — frustration streak ─────────────────────────────────────────

describe('recordLevel — frustration decreases tier', () => {
  beforeEach(clearGame);

  it('does not change tier on single frustrated level', () => {
    const result = recordLevel(GAME, { retryCount: 10, hintUsage: 5 });
    expect(result.changed).toBe(false);
    expect(result.tier).toBe(DEFAULT_TIER);
  });

  it('decreases tier after FRUSTRATION_STREAK frustrated levels', () => {
    const frustratedSignals = { retryCount: 10, hintUsage: 5, rapidTapBursts: 5, undoRate: 2 };
    let result;
    for (let i = 0; i < FRUSTRATION_STREAK; i++) {
      result = recordLevel(GAME, frustratedSignals);
    }
    expect(result.changed).toBe(true);
    expect(result.tier).toBe(DEFAULT_TIER - 1);
  });

  it('does not drop below MIN_TIER', () => {
    setTier(GAME, MIN_TIER);
    const frustratedSignals = { retryCount: 10, hintUsage: 5, rapidTapBursts: 5, undoRate: 2 };
    for (let i = 0; i < 20; i++) {
      recordLevel(GAME, frustratedSignals);
    }
    expect(getTier(GAME)).toBe(MIN_TIER);
  });

  it('resets frustration streak after tier drop', () => {
    const frustratedSignals = { retryCount: 10, hintUsage: 5, rapidTapBursts: 5, undoRate: 2 };
    for (let i = 0; i < FRUSTRATION_STREAK; i++) {
      recordLevel(GAME, frustratedSignals);
    }
    const tierAfterDrop = getTier(GAME);
    // One more frustrated level should not immediately drop again
    recordLevel(GAME, frustratedSignals);
    expect(getTier(GAME)).toBe(tierAfterDrop);
  });
});

// ─── recordLevel — success streak ─────────────────────────────────────────────

describe('recordLevel — success increases tier', () => {
  beforeEach(clearGame);

  it('does not change tier on single easy win', () => {
    const result = recordLevel(GAME, { retryCount: 0, solveTime: 5000 }, { won: true });
    expect(result.changed).toBe(false);
  });

  it('increases tier after SUCCESS_STREAK_HARD easy wins', () => {
    const easySignals = { retryCount: 0, hintUsage: 0, solveTime: 5000, rapidTapBursts: 0 };
    let result;
    for (let i = 0; i < SUCCESS_STREAK_HARD; i++) {
      result = recordLevel(GAME, easySignals, { won: true });
    }
    expect(result.changed).toBe(true);
    expect(result.tier).toBe(DEFAULT_TIER + 1);
  });

  it('does not exceed MAX_TIER', () => {
    setTier(GAME, MAX_TIER);
    const easySignals = { retryCount: 0, hintUsage: 0, solveTime: 5000 };
    for (let i = 0; i < 20; i++) {
      recordLevel(GAME, easySignals, { won: true });
    }
    expect(getTier(GAME)).toBe(MAX_TIER);
  });
});

// ─── recordLevel — daily exempt ───────────────────────────────────────────────

describe('recordLevel — daily exemption', () => {
  beforeEach(clearGame);

  it('does not change tier for daily challenge levels', () => {
    const frustratedSignals = { retryCount: 10, hintUsage: 5 };
    for (let i = 0; i < 10; i++) {
      recordLevel(GAME, frustratedSignals, { daily: true });
    }
    expect(getTier(GAME)).toBe(DEFAULT_TIER);
  });
});

// ─── resetAdaptive ────────────────────────────────────────────────────────────

describe('resetAdaptive', () => {
  beforeEach(clearGame);

  it('resets tier back to default', () => {
    setTier(GAME, 5);
    resetAdaptive(GAME);
    expect(getTier(GAME)).toBe(DEFAULT_TIER);
  });

  it('resets streak', () => {
    const easySignals = { retryCount: 0, hintUsage: 0, solveTime: 5000 };
    for (let i = 0; i < 3; i++) {
      recordLevel(GAME, easySignals, { won: true });
    }
    resetAdaptive(GAME);
    const profile = getProfile(GAME);
    expect(profile.streak).toBe(0);
  });
});

// ─── getProfile ───────────────────────────────────────────────────────────────

describe('getProfile', () => {
  beforeEach(clearGame);

  it('returns default profile for new game', () => {
    const profile = getProfile(GAME);
    expect(profile.tier).toBe(DEFAULT_TIER);
    expect(profile.ema).toBe(0);
    expect(profile.streak).toBe(0);
    expect(profile.levelCount).toBe(0);
    expect(Array.isArray(profile.history)).toBe(true);
  });

  it('history grows with recordLevel calls', () => {
    recordLevel(GAME, { retryCount: 1 });
    recordLevel(GAME, { retryCount: 2 });
    const profile = getProfile(GAME);
    expect(profile.history.length).toBe(2);
  });

  it('levelCount increments with each recordLevel', () => {
    for (let i = 0; i < 5; i++) recordLevel(GAME, {});
    expect(getProfile(GAME).levelCount).toBe(5);
  });
});

// ─── tierToString ─────────────────────────────────────────────────────────────

describe('tierToString', () => {
  it('maps low tiers to easy', () => {
    expect(tierToString(1)).toBe('easy');
    expect(tierToString(2)).toBe('easy');
  });

  it('maps middle tier to medium', () => {
    expect(tierToString(3)).toBe('medium');
  });

  it('maps high tiers to hard', () => {
    expect(tierToString(4)).toBe('hard');
    expect(tierToString(5)).toBe('hard');
  });
});

// ─── EMA updates ─────────────────────────────────────────────────────────────

describe('EMA tracking', () => {
  beforeEach(clearGame);

  it('EMA starts at 0 and moves toward frustration score', () => {
    const highFrustration = { retryCount: 10, hintUsage: 5 };
    recordLevel(GAME, highFrustration);
    const profile = getProfile(GAME);
    expect(profile.ema).toBeGreaterThan(0);
  });

  it('EMA decays back toward 0 after easy levels', () => {
    const high = { retryCount: 10, hintUsage: 5 };
    const easy = { retryCount: 0, hintUsage: 0 };
    for (let i = 0; i < 3; i++) recordLevel(GAME, high);
    const emaAfterHard = getProfile(GAME).ema;
    for (let i = 0; i < 5; i++) recordLevel(GAME, easy);
    const emaAfterEasy = getProfile(GAME).ema;
    expect(emaAfterEasy).toBeLessThan(emaAfterHard);
  });
});

// ─── Multiple games isolation ─────────────────────────────────────────────────

describe('per-game isolation', () => {
  beforeEach(() => localStorageMock.clear());

  it('tracks separate tiers for different games', () => {
    setTier('water-sort', 4);
    setTier('parking-escape', 1);
    expect(getTier('water-sort')).toBe(4);
    expect(getTier('parking-escape')).toBe(1);
  });

  it('resetting one game does not affect another', () => {
    setTier('water-sort', 4);
    setTier('parking-escape', 4);
    resetAdaptive('water-sort');
    expect(getTier('parking-escape')).toBe(4);
  });
});
