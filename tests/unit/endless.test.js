/**
 * Endless Procedural Mode — Unit Tests
 *
 * Tests for tier-to-parameter mapping, sequential seed determinism,
 * scoring with streak multiplier, session state, and session end/best-score.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  ENDLESS_GAMES,
  tierToParams,
  streakMultiplier,
  createEndlessSession,
  createEndlessSessionAsync,
} from '../../src/shared/endless.js';

// ─── Mock generator ───────────────────────────────────────────────────────────

/**
 * A deterministic mock generator: generateLevel(seed, difficulty, index)
 * returns a level object with the seed and difficulty embedded,
 * so tests can inspect what was requested.
 * Returns null when seed is divisible by 13 (simulates sporadic generation failure).
 */
const mockGenerator = {
  generateLevel: vi.fn((seed, difficulty, index = 0) => {
    if (seed % 13 === 0) return null; // simulate failure
    return { id: `mock-${seed}-${difficulty}`, seed, difficulty, index, valid: true };
  }),
};

// ─── ENDLESS_GAMES ────────────────────────────────────────────────────────────

describe('ENDLESS_GAMES', () => {
  const EXPECTED = [
    'water-sort', 'parking-escape', 'pull-the-pin', 'merge-games',
    'crowd-runner', 'giant-runner', 'jelly-shift', 'makeover-run',
    'bridge-race', 'satisfying-asmr',
  ];

  it('contains exactly the 10 supported games', () => {
    expect(ENDLESS_GAMES.size).toBe(10);
    for (const g of EXPECTED) {
      expect(ENDLESS_GAMES.has(g), `${g} should be in ENDLESS_GAMES`).toBe(true);
    }
  });

  it('does not include brain-teaser', () => {
    expect(ENDLESS_GAMES.has('brain-teaser')).toBe(false);
  });

  it('does not include save-the-character', () => {
    expect(ENDLESS_GAMES.has('save-the-character')).toBe(false);
  });
});

// ─── tierToParams ─────────────────────────────────────────────────────────────

describe('tierToParams — float-difficulty games', () => {
  it('tier 1 → difficulty ~0.10', () => {
    const { difficulty } = tierToParams('water-sort', 1);
    expect(difficulty).toBeCloseTo(0.10, 2);
  });

  it('tier 10 → difficulty ~0.91', () => {
    const { difficulty } = tierToParams('water-sort', 10);
    expect(difficulty).toBeCloseTo(0.91, 2);
  });

  it('difficulty increases with tier', () => {
    for (let t = 1; t < 10; t++) {
      const a = tierToParams('water-sort', t).difficulty;
      const b = tierToParams('water-sort', t + 1).difficulty;
      expect(b).toBeGreaterThan(a);
    }
  });

  it('difficulty is always in [0, 1]', () => {
    for (let t = 1; t <= 10; t++) {
      const { difficulty } = tierToParams('water-sort', t);
      expect(difficulty).toBeGreaterThanOrEqual(0);
      expect(difficulty).toBeLessThanOrEqual(1);
    }
  });

  it('clamps tier below 1 to 1', () => {
    expect(tierToParams('water-sort', 0).difficulty)
      .toBe(tierToParams('water-sort', 1).difficulty);
  });

  it('rounds fractional tier before clamping (0.4 rounds to 0, then clamps to 1)', () => {
    // Math.round(0.4) = 0, Math.max(1, 0) = 1
    expect(tierToParams('water-sort', 0.4).difficulty)
      .toBe(tierToParams('water-sort', 1).difficulty);
  });

  it('clamps tier above 10 to 10', () => {
    expect(tierToParams('water-sort', 99).difficulty)
      .toBe(tierToParams('water-sort', 10).difficulty);
  });
});

describe('tierToParams — string-difficulty games', () => {
  it('tier 1 → easy for default game', () => {
    expect(tierToParams('bridge-race', 1).difficulty).toBe('easy');
  });

  it('tier 5 → medium for default game', () => {
    expect(tierToParams('bridge-race', 5).difficulty).toBe('medium');
  });

  it('tier 8 → hard for default game', () => {
    expect(tierToParams('bridge-race', 8).difficulty).toBe('hard');
  });

  it('giant-runner never exceeds medium (no hard generator)', () => {
    for (let t = 1; t <= 10; t++) {
      const d = tierToParams('giant-runner', t).difficulty;
      expect(d, `giant-runner tier ${t}`).not.toBe('hard');
    }
  });

  it('parking-escape never exceeds medium', () => {
    for (let t = 1; t <= 10; t++) {
      const d = tierToParams('parking-escape', t).difficulty;
      expect(d, `parking-escape tier ${t}`).not.toBe('hard');
    }
  });

  it('pull-the-pin reaches hard by tier 7', () => {
    expect(tierToParams('pull-the-pin', 7).difficulty).toBe('hard');
  });

  it('returns an object with a difficulty key', () => {
    const params = tierToParams('crowd-runner', 3);
    expect(params).toHaveProperty('difficulty');
  });
});

// ─── streakMultiplier ─────────────────────────────────────────────────────────

describe('streakMultiplier', () => {
  it('returns 1.0 for streak 0', () => { expect(streakMultiplier(0)).toBe(1.0); });
  it('returns 1.0 for streak 1', () => { expect(streakMultiplier(1)).toBe(1.0); });
  it('returns 1.0 for streak 2', () => { expect(streakMultiplier(2)).toBe(1.0); });
  it('returns 1.2 for streak 3', () => { expect(streakMultiplier(3)).toBe(1.2); });
  it('returns 1.2 for streak 5', () => { expect(streakMultiplier(5)).toBe(1.2); });
  it('returns 1.5 for streak 6', () => { expect(streakMultiplier(6)).toBe(1.5); });
  it('returns 1.5 for streak 9', () => { expect(streakMultiplier(9)).toBe(1.5); });
  it('returns 2.0 for streak 10', () => { expect(streakMultiplier(10)).toBe(2.0); });
  it('returns 2.0 for streak 100', () => { expect(streakMultiplier(100)).toBe(2.0); });
});

// ─── getLevel — generator shapes ─────────────────────────────────────────────

describe('createEndlessSession — generateBatch generator shape', () => {
  it('uses generateBatch when generateLevel is absent', () => {
    const batchGenerator = {
      generateBatch: vi.fn((seed, diff, count) => [{ id: `batch-${seed}`, seed, diff }])
    };
    const s = createEndlessSession('water-sort', batchGenerator, { sessionSeed: 5 });
    const level = s.nextLevel();
    expect(level).not.toBeNull();
    expect(level.id).toBe('batch-5');
  });

  it('returns null when generator has neither generateLevel nor generateBatch', () => {
    const emptyGenerator = {};
    const s = createEndlessSession('water-sort', emptyGenerator, { sessionSeed: 5 });
    expect(s.nextLevel()).toBeNull();
  });

  it('returns null when generateBatch returns empty array (batch.length === 0)', () => {
    const emptyBatchGenerator = {
      generateBatch: vi.fn(() => [])
    };
    const s = createEndlessSession('water-sort', emptyBatchGenerator, { sessionSeed: 5 });
    expect(s.nextLevel()).toBeNull();
  });

  it('returns null when generateBatch returns null/falsy', () => {
    const nullBatchGenerator = {
      generateBatch: vi.fn(() => null)
    };
    const s = createEndlessSession('water-sort', nullBatchGenerator, { sessionSeed: 5 });
    expect(s.nextLevel()).toBeNull();
  });

  it('generateLevel returning undefined is treated as null (nullish coalescing)', () => {
    const undefinedGenerator = {
      generateLevel: vi.fn(() => undefined)
    };
    const s = createEndlessSession('water-sort', undefinedGenerator, { sessionSeed: 5 });
    expect(s.nextLevel()).toBeNull();
  });

  it('returns null when all 6 attempts (5 primary + 1 fallback) fail (fallback also returns null)', () => {
    // All attempts return null → nextLevel() returns null from the fallback call
    const allFailGenerator = { generateLevel: vi.fn(() => null) };
    const s = createEndlessSession('water-sort', allFailGenerator, { sessionSeed: 0 });
    const level = s.nextLevel();
    expect(level).toBeNull();
    // 5 primary attempts + 1 fallback = 6 total calls
    expect(allFailGenerator.generateLevel).toHaveBeenCalledTimes(6);
  });

  it('falls back to easier difficulty after 5 failed primary attempts (difficulty fallback branch)', () => {
    let callCount = 0;
    const fallbackGenerator = {
      generateLevel: vi.fn((seed, difficulty) => {
        callCount++;
        // First 5 calls (primary attempts) return null; 6th call (fallback) returns a level
        if (callCount <= 5) return null;
        return { id: `fallback-${seed}`, seed, difficulty, valid: true };
      })
    };
    const s = createEndlessSession('water-sort', fallbackGenerator, { sessionSeed: 0 });
    const level = s.nextLevel();
    expect(level).not.toBeNull();
    expect(level.id).toMatch(/^fallback-/);
    // 5 primary attempts + 1 fallback = 6 total calls
    expect(fallbackGenerator.generateLevel).toHaveBeenCalledTimes(6);
  });
});

// ─── createEndlessSession ─────────────────────────────────────────────────────

describe('createEndlessSession — API shape', () => {
  it('returns nextLevel, completeLevel, retryLevel, endSession, getScore', () => {
    const s = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 1 });
    expect(typeof s.nextLevel).toBe('function');
    expect(typeof s.completeLevel).toBe('function');
    expect(typeof s.retryLevel).toBe('function');
    expect(typeof s.endSession).toBe('function');
    expect(typeof s.getScore).toBe('function');
  });
});

describe('createEndlessSession — initial state', () => {
  it('getScore() starts at zero score, zero streak, tier 1', () => {
    const s = createEndlessSession('water-sort', mockGenerator, {
      sessionSeed: 1, initialTier: 1,
    });
    const state = s.getScore();
    expect(state.score).toBe(0);
    expect(state.streak).toBe(0);
    expect(state.multiplier).toBe(1.0);
    expect(state.levelCount).toBe(0);
    expect(state.tier).toBe(1);
  });

  it('initial tier is passed through', () => {
    const s = createEndlessSession('water-sort', mockGenerator, {
      sessionSeed: 1, initialTier: 4,
    });
    expect(s.getScore().tier).toBe(4);
  });

  it('retriesLeft starts at maxRetries (default 3)', () => {
    const s = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 1 });
    expect(s.getScore().retriesLeft).toBe(3);
  });

  it('custom maxRetries is respected', () => {
    const s = createEndlessSession('water-sort', mockGenerator, {
      sessionSeed: 1, maxRetries: 5,
    });
    expect(s.getScore().retriesLeft).toBe(5);
  });
});

describe('createEndlessSession — nextLevel', () => {
  beforeEach(() => { mockGenerator.generateLevel.mockClear(); });

  it('returns a non-null level for a typical session', () => {
    const s = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 2 });
    const level = s.nextLevel();
    expect(level).not.toBeNull();
    expect(level).toHaveProperty('id');
  });

  it('uses sessionSeed + levelIndex as base seed', () => {
    const sessionSeed = 100;
    const s = createEndlessSession('water-sort', mockGenerator, { sessionSeed });
    s.nextLevel(); // levelIndex=0 → seeds 100, 101, ...
    const calledSeeds = mockGenerator.generateLevel.mock.calls.map(c => c[0]);
    expect(calledSeeds[0]).toBe(sessionSeed); // first attempt uses sessionSeed + 0
  });

  it('different sessionSeeds produce different levels', () => {
    const s1 = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 1000 });
    const s2 = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 2000 });
    const l1 = s1.nextLevel();
    const l2 = s2.nextLevel();
    // They may use different seeds → different levels
    expect(l1.seed).not.toBe(l2.seed);
  });

  it('same sessionSeed produces deterministic levels', () => {
    const s1 = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 42 });
    const s2 = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 42 });
    const l1 = s1.nextLevel();
    const l2 = s2.nextLevel();
    expect(l1.seed).toBe(l2.seed);
    expect(l1.difficulty).toBe(l2.difficulty);
  });

  it('consecutive calls after completeLevel use sequential seeds', () => {
    const s = createEndlessSession('water-sort', mockGenerator, {
      sessionSeed: 100, initialTier: 1,
    });
    const l0 = s.nextLevel();
    s.completeLevel();
    const l1 = s.nextLevel();
    // l1 should use a higher base seed than l0
    expect(l1.seed).toBeGreaterThan(l0.seed);
  });

  it('retries with incremented seed on generation failure', () => {
    // Seed 13 → null (% 13 === 0). First level attempts seed 13, 14, …
    const s = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 13 });
    const level = s.nextLevel();
    // Seed 13 fails, seed 14 succeeds
    expect(level).not.toBeNull();
    expect(level.seed).toBe(14);
  });
});

describe('createEndlessSession — scoring', () => {
  let session;

  beforeEach(() => {
    session = createEndlessSession('water-sort', mockGenerator, {
      sessionSeed: 1, initialTier: 1,
    });
    localStorage.clear();
  });

  it('score += 100 after first completion (×1.0 multiplier)', () => {
    session.nextLevel();
    session.completeLevel();
    expect(session.getScore().score).toBe(100);
  });

  it('streak increases with each hint-free completion', () => {
    for (let i = 0; i < 4; i++) {
      session.nextLevel();
      session.completeLevel(false);
    }
    expect(session.getScore().streak).toBe(4);
  });

  it('multiplier at streak=3 is 1.2, score reflects it', () => {
    // Complete 3 levels without hints
    for (let i = 0; i < 3; i++) {
      session.nextLevel();
      session.completeLevel(false);
    }
    const before = session.getScore().score;
    session.nextLevel();
    session.completeLevel(false); // streak=4, still ×1.2
    const after = session.getScore().score;
    expect(after - before).toBe(Math.round(100 * 1.2));
  });

  it('using a hint resets streak to 0', () => {
    for (let i = 0; i < 5; i++) {
      session.nextLevel();
      session.completeLevel(false);
    }
    expect(session.getScore().streak).toBe(5);

    session.nextLevel();
    session.completeLevel(true); // usedHint
    expect(session.getScore().streak).toBe(0);
    expect(session.getScore().multiplier).toBe(1.0);
  });

  it('levelCount increments on each completion', () => {
    for (let i = 0; i < 3; i++) {
      session.nextLevel();
      session.completeLevel();
    }
    expect(session.getScore().levelCount).toBe(3);
  });
});

describe('createEndlessSession — difficulty ratchet', () => {
  it('tier increases by 1 every 5 completed levels', () => {
    const s = createEndlessSession('water-sort', mockGenerator, {
      sessionSeed: 1, initialTier: 1,
    });
    for (let i = 0; i < 5; i++) {
      s.nextLevel();
      s.completeLevel();
    }
    expect(s.getScore().tier).toBe(2);
  });

  it('tier does not increase before 5 completions', () => {
    const s = createEndlessSession('water-sort', mockGenerator, {
      sessionSeed: 1, initialTier: 1,
    });
    for (let i = 0; i < 4; i++) {
      s.nextLevel();
      s.completeLevel();
    }
    expect(s.getScore().tier).toBe(1);
  });

  it('tier is capped at 10', () => {
    const s = createEndlessSession('water-sort', mockGenerator, {
      sessionSeed: 1, initialTier: 9,
    });
    // Complete 10 levels to try to push tier beyond 10
    for (let i = 0; i < 10; i++) {
      s.nextLevel();
      s.completeLevel();
    }
    expect(s.getScore().tier).toBeLessThanOrEqual(10);
  });

  it('difficulty param changes after tier ratchet', () => {
    const s = createEndlessSession('water-sort', mockGenerator, {
      sessionSeed: 1, initialTier: 1,
    });
    const diffBefore = tierToParams('water-sort', 1).difficulty;

    for (let i = 0; i < 5; i++) {
      s.nextLevel();
      s.completeLevel();
    }

    const diffAfter = tierToParams('water-sort', s.getScore().tier).difficulty;
    expect(diffAfter).toBeGreaterThan(diffBefore);
  });
});

describe('createEndlessSession — retries', () => {
  let session;

  beforeEach(() => {
    session = createEndlessSession('water-sort', mockGenerator, {
      sessionSeed: 1, maxRetries: 3,
    });
  });

  it('retryLevel() returns true while retries remain', () => {
    session.nextLevel();
    expect(session.retryLevel()).toBe(true);
    expect(session.retryLevel()).toBe(true);
    expect(session.retryLevel()).toBe(true);
  });

  it('retryLevel() returns false when retries are exhausted', () => {
    session.nextLevel();
    session.retryLevel();
    session.retryLevel();
    session.retryLevel();
    expect(session.retryLevel()).toBe(false);
  });

  it('retryLevel() resets streak to 0', () => {
    for (let i = 0; i < 5; i++) {
      session.nextLevel();
      session.completeLevel(false);
    }
    expect(session.getScore().streak).toBe(5);
    session.retryLevel();
    expect(session.getScore().streak).toBe(0);
  });

  it('retriesLeft decrements on each retryLevel() call', () => {
    session.nextLevel();
    session.retryLevel();
    expect(session.getScore().retriesLeft).toBe(2);
  });
});

describe('createEndlessSession — endSession and best score', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('endSession() saves score to localStorage', () => {
    const s = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 1 });
    s.nextLevel();
    s.completeLevel();
    s.nextLevel();
    s.completeLevel();
    s.endSession();

    const stored = parseInt(localStorage.getItem('mg:endless:best:water-sort'), 10);
    expect(stored).toBe(s.getScore().score);
  });

  it('endSession() does not overwrite higher existing best', () => {
    localStorage.setItem('mg:endless:best:water-sort', '99999');

    const s = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 1 });
    s.nextLevel();
    s.completeLevel();
    s.endSession();

    const stored = parseInt(localStorage.getItem('mg:endless:best:water-sort'), 10);
    expect(stored).toBe(99999);
  });

  it('getScore().bestScore reflects stored best', () => {
    localStorage.setItem('mg:endless:best:water-sort', '500');

    const s = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 1 });
    expect(s.getScore().bestScore).toBe(500);
  });

  it('endSession() updates bestScore when score is higher', () => {
    localStorage.setItem('mg:endless:best:water-sort', '50');

    const s = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 1 });
    for (let i = 0; i < 3; i++) {
      s.nextLevel();
      s.completeLevel();
    }
    s.endSession();

    const stored = parseInt(localStorage.getItem('mg:endless:best:water-sort'), 10);
    expect(stored).toBeGreaterThan(50);
  });

  it('endSession() does not update best when score equals existing best (check is >, not >=)', () => {
    const s = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 1 });
    s.nextLevel();
    s.completeLevel(); // score = 100
    const currentScore = s.getScore().score; // 100
    // Pre-seed localStorage with exactly the current score
    localStorage.setItem('mg:endless:best:water-sort', String(currentScore));
    s.endSession(); // score (100) is NOT > best (100), so no update
    const stored = parseInt(localStorage.getItem('mg:endless:best:water-sort'), 10);
    expect(stored).toBe(currentScore); // unchanged — still 100
  });
});

// ── createEndlessSessionAsync ──────────────────────────────────────────────

// ── localStorage error resilience ─────────────────────────────────────────────

describe('getBestScore / saveBestScore — catch blocks', () => {
  it('endSession does not throw when localStorage.setItem throws (saveBestScore catch)', () => {
    const s = createEndlessSession('water-sort', mockGenerator, { sessionSeed: 1 });
    s.nextLevel();
    s.completeLevel(300, 10);
    const origSetItem = localStorage.setItem.bind(localStorage);
    const stub = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => s.endSession()).not.toThrow();
    stub.mockRestore();
  });

  it('createEndlessSession does not throw when localStorage.getItem throws (getBestScore catch)', () => {
    const stub = vi.spyOn(localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('Storage denied');
    });
    expect(() => createEndlessSession('water-sort', mockGenerator, { sessionSeed: 1 })).not.toThrow();
    stub.mockRestore();
  });
});

describe('createEndlessSessionAsync', () => {
  it('throws for unsupported game', async () => {
    await expect(createEndlessSessionAsync('unknown-game')).rejects.toThrow('does not support endless mode');
  });

  it('throws for brain-teaser (not in endless games set)', async () => {
    await expect(createEndlessSessionAsync('brain-teaser')).rejects.toThrow('does not support endless mode');
  });

  it('returns a session for a supported game', async () => {
    const session = await createEndlessSessionAsync('water-sort', { sessionSeed: 9999 });
    expect(session).toBeDefined();
    expect(typeof session.nextLevel).toBe('function');
    expect(typeof session.completeLevel).toBe('function');
    expect(typeof session.getScore).toBe('function');
  });
});
