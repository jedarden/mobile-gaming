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

// ─── recordLevel — neutral outcome (partial decay) ───────────────────────────

describe('recordLevel — neutral outcome decays streak', () => {
  beforeEach(clearGame);

  it('decays a positive streak by 1 after a neutral (neither frustrated nor easy-win) outcome', () => {
    // Build a positive streak of 2 via easy wins
    const easy = { retryCount: 0, hintUsage: 0, solveTime: 5000, rapidTapBursts: 0 };
    recordLevel(GAME, easy, { won: true });
    recordLevel(GAME, easy, { won: true });
    expect(getProfile(GAME).streak).toBe(2);

    // A neutral level: moderate frustration, not won → neither branch fires
    // retryCount=1 gives frustration ~0.09 < 0.7 (not frustrated), won=false (not easy win)
    recordLevel(GAME, { retryCount: 1, solveTime: 60000 }, { won: false });

    // Streak should decay from 2 to 1
    expect(getProfile(GAME).streak).toBe(1);
  });

  it('decays a negative streak by 1 toward 0 after a neutral outcome', () => {
    // Build a frustration streak of -2
    const hard = { retryCount: 10, hintUsage: 5, rapidTapBursts: 5, undoRate: 2 };
    recordLevel(GAME, hard);
    recordLevel(GAME, hard);
    expect(getProfile(GAME).streak).toBe(-2);

    // A neutral level: retryCount=1 → frustration ~0.09 < 0.7, won=true but frustration≈0.09 < 0.3 and retryCount=1 ≠ 0 → not easy win
    recordLevel(GAME, { retryCount: 1 }, { won: true });

    // Streak should decay from -2 to -1
    expect(getProfile(GAME).streak).toBe(-1);
  });
});

// ─── recordLevel — isEasyWin with prior negative streak ──────────────────────

describe('recordLevel — isEasyWin resets negative streak to 1 (Math.max(0, streak) branch)', () => {
  beforeEach(clearGame);

  it('resets streak from negative to 1 on easy win (Math.max(0, negative) = 0 branch)', () => {
    // Build a negative streak of -2 via frustrated levels
    const hard = { retryCount: 10, hintUsage: 5, rapidTapBursts: 5, undoRate: 2 };
    recordLevel(GAME, hard);
    recordLevel(GAME, hard);
    expect(getProfile(GAME).streak).toBe(-2);

    // Easy win while streak is negative → Math.max(0, -2) = 0, so streak = 0 + 1 = 1
    const easy = { retryCount: 0, hintUsage: 0, solveTime: 5000, rapidTapBursts: 0 };
    recordLevel(GAME, easy, { won: true });
    expect(getProfile(GAME).streak).toBe(1); // not -1, because Math.max(0, streak) clamps
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

// ─── recordLevel — frustration with positive streak (Math.min clamp) ──────────

describe('recordLevel — frustrated level clamps positive streak to 0 (Math.min(0, streak) branch)', () => {
  beforeEach(clearGame);

  it('streak goes to -1 (not -(streak+1)) when frustration hits a positive streak (Math.min(0, positive)=0 then -1)', () => {
    // Build a positive streak of 2 via easy wins
    const easy = { retryCount: 0, hintUsage: 0, solveTime: 5000, rapidTapBursts: 0 };
    recordLevel(GAME, easy, { won: true });
    recordLevel(GAME, easy, { won: true });
    expect(getProfile(GAME).streak).toBe(2);

    // Frustrated level: Math.min(0, 2) - 1 = 0 - 1 = -1, not 2 - 1 = 1
    const hard = { retryCount: 10, hintUsage: 5, rapidTapBursts: 5, undoRate: 2 };
    recordLevel(GAME, hard);
    expect(getProfile(GAME).streak).toBe(-1);
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

  it('maps tier 0 and below to easy (condition is tier <= 2)', () => {
    expect(tierToString(0)).toBe('easy');
    expect(tierToString(-1)).toBe('easy');
  });

  it('maps tier 6 and above to hard (condition is tier >= 4)', () => {
    expect(tierToString(6)).toBe('hard');
    expect(tierToString(10)).toBe('hard');
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

// ─── Storage corruption recovery ──────────────────────────────────────────────

describe('loadProfile — corrupted storage', () => {
  it('returns default profile when localStorage has invalid JSON', () => {
    // Use a unique gameId to avoid interference with other tests
    localStorageMock.setItem('mg:corrupted-game:adaptive', '{ not valid json }');
    const profile = getProfile('corrupted-game');
    // loadProfile catch block → returns default profile
    expect(profile).toBeDefined();
    expect(typeof profile.tier).toBe('number');
    expect(profile.tier).toBe(2); // DEFAULT_TIER
    expect(Array.isArray(profile.history)).toBe(true);
    expect(profile.ema).toBe(0);
  });

  it('returns default profile when storage has valid JSON but not an object (e.g., string)', () => {
    // JSON.parse('"hello"') = "hello" — typeof "hello" !== 'object' → fallback
    localStorageMock.setItem('mg:string-game:adaptive', '"hello"');
    const profile = getProfile('string-game');
    expect(profile.tier).toBe(2);
    expect(Array.isArray(profile.history)).toBe(true);
  });

  it('returns default profile when stored JSON is null (&&-short-circuit: null is falsy)', () => {
    // JSON.parse('null') = null — `parsed && typeof parsed === 'object'` → false (null falsy)
    // → falls through to default profile, never returns parsed
    localStorageMock.setItem('mg:null-game:adaptive', 'null');
    const profile = getProfile('null-game');
    expect(profile.tier).toBe(2); // DEFAULT_TIER
    expect(Array.isArray(profile.history)).toBe(true);
    expect(profile.ema).toBe(0);
  });
});

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

// ─── saveProfile and resetAdaptive error resilience ───────────────────────────

describe('saveProfile — catch block', () => {
  it('does not throw when localStorage.setItem throws (catch swallows QuotaExceeded)', () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    });
    // setTier calls saveProfile internally
    expect(() => setTier(GAME, 3)).not.toThrow();
  });
});

describe('resetAdaptive — catch block', () => {
  it('does not throw when localStorage.removeItem throws', () => {
    localStorageMock.removeItem.mockImplementationOnce(() => {
      throw new Error('Storage denied');
    });
    expect(() => resetAdaptive(GAME)).not.toThrow();
  });
});

describe('saveProfile — history trimming (if history.length > MAX_HISTORY true branch)', () => {
  it('trims history to MAX_HISTORY=20 after 22 recorded levels', () => {
    localStorageMock.clear();
    // Each recordLevel call appends one entry; after 22 calls saveProfile trims to 20
    for (let i = 0; i < 22; i++) {
      recordLevel('trim-game', { retryCount: 0 });
    }
    const profile = getProfile('trim-game');
    expect(profile.history.length).toBeLessThanOrEqual(20);
  });
});

// ─── recordLevel — retryCount: null (?? 0 null coalescing) ───────────────────

describe('recordLevel — retryCount null coalescing (?? 0 operator with null)', () => {
  beforeEach(clearGame);

  it('treats retryCount: null as 0 via ?? operator (null ?? 0 = 0), allowing easy-win streak', () => {
    // retryCount: null → null ?? 0 = 0 → satisfies (signals.retryCount ?? 0) === 0
    // With won:true, frustration near 0, isEasyWin = true → streak increments
    const easyNullRetry = { retryCount: null, hintUsage: 0, solveTime: 5000, rapidTapBursts: 0 };
    recordLevel(GAME, easyNullRetry, { won: true });
    expect(getProfile(GAME).streak).toBe(1); // easy-win streak incremented
  });
});
