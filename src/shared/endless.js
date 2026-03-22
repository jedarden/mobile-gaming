/**
 * Endless Procedural Mode
 *
 * Provides an infinite sequence of procedurally generated levels at an
 * adaptively-selected difficulty. Difficulty ratchets up every 5 completions
 * independent of the adaptive module's session-based adjustments.
 *
 * Supported games (10 of 12 — Brain Teaser and Save the Character are
 * hand-crafted only):
 *   water-sort, parking-escape, pull-the-pin, merge-games, crowd-runner,
 *   giant-runner, jelly-shift, makeover-run, bridge-race, satisfying-asmr
 *
 * Usage:
 *   import { createEndlessSession, ENDLESS_GAMES, tierToParams } from '../shared/endless.js';
 *   import * as generator from '../games/water-sort/generator.js';
 *
 *   const session = createEndlessSession('water-sort', generator, {
 *     sessionSeed: Date.now(),
 *     initialTier: getTier('water-sort'),   // from adaptive.js
 *   });
 *
 *   const level = session.nextLevel();       // generate first level
 *   // ... player plays ...
 *   session.completeLevel(usedHint);         // record result
 *   const nextLevel = session.nextLevel();   // advance
 *
 *   // On failure / "Continue?" prompt:
 *   const canContinue = session.retryLevel();  // false = session over
 *
 *   // On unload / quit:
 *   session.endSession();  // persist personal best
 */

// ─── Supported games ──────────────────────────────────────────────────────────

export const ENDLESS_GAMES = new Set([
  'water-sort',
  'parking-escape',
  'pull-the-pin',
  'merge-games',
  'crowd-runner',
  'giant-runner',
  'jelly-shift',
  'makeover-run',
  'bridge-race',
  'satisfying-asmr',
]);

// ─── Tier → difficulty mapping ────────────────────────────────────────────────

/**
 * Games using a float difficulty in [0, 1].
 * Generated levels do not have discrete easy/medium/hard bands.
 */
const FLOAT_DIFFICULTY_GAMES = new Set(['water-sort', 'bus-jam']);

/**
 * Per-game string-difficulty sequences for tiers 1–10.
 * Games that top out at 'medium' (no hard generator) stay there.
 */
const TIER_STRINGS = {
  'giant-runner':   ['easy','easy','easy','medium','medium','medium','medium','medium','medium','medium'],
  'parking-escape': ['easy','easy','easy','medium','medium','medium','medium','medium','medium','medium'],
  _default:         ['easy','easy','easy','medium','medium','medium','hard','hard','hard','hard'],
};

/**
 * Map an endless session tier (1–10) to the difficulty value expected by
 * the game's generator.
 *
 * @param {string} gameId
 * @param {number} tier - Clamped to [1, 10]
 * @returns {{ difficulty: string|number }}
 */
export function tierToParams(gameId, tier) {
  const t = Math.min(10, Math.max(1, Math.round(tier)));

  if (FLOAT_DIFFICULTY_GAMES.has(gameId)) {
    // Linear interpolation: tier 1 → 0.10, tier 10 → 0.91
    const difficulty = Math.round((0.1 + (t - 1) * 0.09) * 100) / 100;
    return { difficulty };
  }

  const tiers = TIER_STRINGS[gameId] ?? TIER_STRINGS._default;
  return { difficulty: tiers[t - 1] };
}

// ─── Streak multipliers ───────────────────────────────────────────────────────

/**
 * Compute the score multiplier from the current streak.
 *
 * Streak breakpoints:
 *   0–2:  ×1.0 (baseline)
 *   3–5:  ×1.2
 *   6–9:  ×1.5
 *   10+:  ×2.0
 *
 * @param {number} streak - Consecutive hint-free completions.
 * @returns {number}
 */
export function streakMultiplier(streak) {
  if (streak >= 10) return 2.0;
  if (streak >= 6)  return 1.5;
  if (streak >= 3)  return 1.2;
  return 1.0;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const BEST_KEY_PREFIX = 'mg:endless:best:';

function getBestScore(gameId) {
  try {
    const raw = localStorage.getItem(`${BEST_KEY_PREFIX}${gameId}`);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(gameId, score) {
  try {
    localStorage.setItem(`${BEST_KEY_PREFIX}${gameId}`, String(score));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

// ─── Level generation helpers ─────────────────────────────────────────────────

/**
 * Invoke a generator to produce one level.
 * Handles both `generateLevel(seed, difficulty, index)` and
 * `generateBatch(seed, difficulty, 1)` generator shapes.
 *
 * @param {Object} generator - Imported generator module
 * @param {number} seed
 * @param {string|number} difficulty
 * @param {number} index
 * @returns {Object|null}
 */
function getLevel(generator, seed, difficulty, index) {
  if (typeof generator.generateLevel === 'function') {
    return generator.generateLevel(seed, difficulty, index) ?? null;
  }
  if (typeof generator.generateBatch === 'function') {
    const batch = generator.generateBatch(seed, difficulty, 1);
    return (batch && batch.length > 0) ? batch[0] : null;
  }
  return null;
}

// Max retry attempts per slot when generation returns null
const MAX_GENERATION_ATTEMPTS = 5;

// ─── Session factory ──────────────────────────────────────────────────────────

/**
 * Create an endless session for one game.
 *
 * @param {string} gameId - Must be in ENDLESS_GAMES.
 * @param {Object} generator - Imported generator module (injected for testability).
 * @param {Object} [opts]
 * @param {number} [opts.sessionSeed] - Base seed for the entire session.
 *   Levels use seed = sessionSeed + levelIndex. Defaults to Date.now().
 * @param {number} [opts.initialTier] - Starting tier (1–10).
 *   Defaults to 1. Pass getTier(gameId) from adaptive.js for adaptive start.
 * @param {number} [opts.maxRetries] - Retries allowed per level before
 *   the session ends. Default 3.
 * @returns {Object} Session interface.
 */
export function createEndlessSession(gameId, generator, opts = {}) {
  const {
    sessionSeed = Date.now(),
    initialTier = 1,
    maxRetries = 3,
  } = opts;

  let tier = Math.min(10, Math.max(1, Math.round(initialTier)));
  let levelIndex = 0;
  let retriesLeft = maxRetries;
  let streak = 0;
  let score = 0;

  // ── Level generation ───────────────────────────────────────────────────────

  /**
   * Generate the next level for this session.
   *
   * Seeds are deterministic: sessionSeed + levelIndex (+ attempt offset).
   * Up to MAX_GENERATION_ATTEMPTS seeds are tried; if all fail the tier is
   * lowered by 2 and one more attempt is made.
   *
   * @returns {Object|null} Level data, or null if generation failed entirely.
   */
  function nextLevel() {
    const { difficulty } = tierToParams(gameId, tier);
    const baseSeed = sessionSeed + levelIndex;

    // Try primary seeds
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      const level = getLevel(generator, baseSeed + attempt, difficulty, levelIndex);
      if (level) return level;
    }

    // Fallback: relax difficulty by 2 tiers
    const { difficulty: easierDifficulty } = tierToParams(gameId, Math.max(1, tier - 2));
    return getLevel(generator, baseSeed + MAX_GENERATION_ATTEMPTS, easierDifficulty, levelIndex);
  }

  // ── Scoring ────────────────────────────────────────────────────────────────

  /**
   * Record a successful level completion.
   *
   * @param {boolean} [usedHint=false] - Whether the player used a hint.
   *   Using a hint resets the streak multiplier to ×1.0.
   */
  function completeLevel(usedHint = false) {
    if (usedHint) {
      streak = 0;
    } else {
      streak++;
    }

    score += Math.round(100 * streakMultiplier(streak));
    levelIndex++;

    // Difficulty ratchet: +1 tier every 5 completions, capped at 10
    if (levelIndex % 5 === 0) {
      tier = Math.min(10, tier + 1);
    }
  }

  /**
   * Record a level failure / player selects "Continue?".
   *
   * Streak resets to ×1.0. Each call consumes one retry.
   *
   * @returns {boolean} True if the player may retry; false if the session
   *   is over (retries exhausted).
   */
  function retryLevel() {
    if (retriesLeft <= 0) return false;
    retriesLeft--;
    streak = 0;
    return true;
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  /**
   * Persist the session score as a personal best if it beats the stored value.
   * Call on session end (page unload, explicit quit, retries exhausted).
   */
  function endSession() {
    if (score > getBestScore(gameId)) {
      saveBestScore(gameId, score);
    }
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  /**
   * Return a snapshot of the current session state.
   *
   * @returns {{
   *   score: number,
   *   streak: number,
   *   multiplier: number,
   *   levelCount: number,
   *   levelIndex: number,
   *   tier: number,
   *   retriesLeft: number,
   *   bestScore: number,
   * }}
   */
  function getScore() {
    return {
      score,
      streak,
      multiplier: streakMultiplier(streak),
      levelCount: levelIndex,
      levelIndex,
      tier,
      retriesLeft,
      bestScore: getBestScore(gameId),
    };
  }

  return { nextLevel, completeLevel, retryLevel, endSession, getScore };
}

// ─── Async factory (production use) ──────────────────────────────────────────

/**
 * Load the generator module for a game and create an endless session.
 * This is the production entry point; tests inject the generator directly
 * via createEndlessSession().
 *
 * @param {string} gameId
 * @param {Object} [opts] - Same as createEndlessSession options.
 * @returns {Promise<Object>} Endless session object.
 */
export async function createEndlessSessionAsync(gameId, opts = {}) {
  if (!ENDLESS_GAMES.has(gameId)) {
    throw new Error(`${gameId} does not support endless mode`);
  }
  const generator = await import(`../games/${gameId}/generator.js`);
  return createEndlessSession(gameId, generator, opts);
}
