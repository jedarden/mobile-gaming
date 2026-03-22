/**
 * Frustration-Aware Adaptive Difficulty
 *
 * Silently adjusts difficulty based on play signals. Players never see
 * difficulty numbers — the game just feels right.
 *
 * Storage key: mg:<gameId>:adaptive
 * Format:      { tier, ema, streak, levelCount, history: [...] }
 *
 * @module adaptive
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const EMA_ALPHA = 0.3;           // exponential moving average weight
const MIN_TIER = 1;
const MAX_TIER = 5;
const DEFAULT_TIER = 2;          // start in the middle
const STORAGE_KEY_PREFIX = 'mg:';
const STORAGE_KEY_SUFFIX = ':adaptive';

// Maximum history entries stored per game (circular buffer)
const MAX_HISTORY = 20;

// Thresholds for tier transitions
const FRUSTRATION_THRESHOLD = 0.7;   // frustration score above this → consider easier
const FRUSTRATION_STREAK = 3;         // consecutive frustrated levels before acting
const SUCCESS_STREAK_HARD = 5;        // consecutive easy wins before going harder

// Signal normalization caps (raw value that maps to frustration = 1.0)
const SIGNAL_CAPS = {
  retryCount: 5,
  hesitationTime: 30000,   // ms
  undoRate: 2.0,           // undos per move
  rapidTapBursts: 5,
  solveTime: 120000,       // ms — levels taking longer than 2 min indicate struggle
  hintUsage: 3,
  sessionLength: 3600000,  // ms — 1 hour
};

// Weights: positive weight = more of this signal = harder for player (lower difficulty)
const SIGNAL_WEIGHTS = {
  retryCount:      0.30,
  hesitationTime:  0.10,
  undoRate:        0.20,
  rapidTapBursts:  0.20,
  solveTime:       0.10,
  hintUsage:       0.30,
  sessionLength:   0.05,
};

// ─── Storage ──────────────────────────────────────────────────────────────────

function storageKey(gameId) {
  return `${STORAGE_KEY_PREFIX}${gameId}${STORAGE_KEY_SUFFIX}`;
}

function loadProfile(gameId) {
  try {
    const raw = localStorage.getItem(storageKey(gameId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // corrupted storage — start fresh
  }
  return {
    tier: DEFAULT_TIER,
    ema: 0,
    streak: 0,        // positive = success streak, negative = frustration streak
    levelCount: 0,
    history: [],
  };
}

function saveProfile(gameId, profile) {
  try {
    // Trim history to keep storage compact
    if (profile.history.length > MAX_HISTORY) {
      profile.history = profile.history.slice(-MAX_HISTORY);
    }
    localStorage.setItem(storageKey(gameId), JSON.stringify(profile));
  } catch {
    // QuotaExceededError — fail silently, adaptive state is non-critical
  }
}

// ─── Signal Normalization ─────────────────────────────────────────────────────

/**
 * Normalize a raw signal value to [0, 1].
 * @param {string} signal - Signal name
 * @param {number} value  - Raw value
 * @returns {number}
 */
function normalize(signal, value) {
  const cap = SIGNAL_CAPS[signal];
  if (cap === undefined || cap === 0) return 0;
  return Math.min(1, Math.max(0, value / cap));
}

/**
 * Compute frustration score from level signals.
 *
 * All signals are "frustration indicators" — higher value = more frustrated.
 * Score is a weighted average in [0, 1].
 *
 * @param {Object} signals
 * @param {number} [signals.retryCount=0]      - Times the player restarted this level
 * @param {number} [signals.hesitationTime=0]  - ms from level load to first input
 * @param {number} [signals.undoRate=0]        - undos per move
 * @param {number} [signals.rapidTapBursts=0]  - number of panic-tap bursts
 * @param {number} [signals.solveTime=0]       - ms to complete (0 = abandoned/rage-quit)
 * @param {number} [signals.hintUsage=0]       - hints requested
 * @param {number} [signals.sessionLength=0]   - ms since session started
 * @returns {number} frustration score in [0, 1]
 */
export function computeFrustration(signals) {
  const s = {
    retryCount: 0,
    hesitationTime: 0,
    undoRate: 0,
    rapidTapBursts: 0,
    solveTime: 0,
    hintUsage: 0,
    sessionLength: 0,
    ...signals,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [signal, weight] of Object.entries(SIGNAL_WEIGHTS)) {
    weightedSum += normalize(signal, s[signal]) * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// ─── Tier Management ──────────────────────────────────────────────────────────

/**
 * Get the current difficulty tier for a game.
 *
 * @param {string} gameId
 * @returns {number} Tier in [MIN_TIER, MAX_TIER]
 */
export function getTier(gameId) {
  const profile = loadProfile(gameId);
  return profile.tier;
}

/**
 * Record level outcome and update adaptive difficulty.
 *
 * Call this at the end of each level (win, loss, or rage-quit).
 *
 * @param {string} gameId   - Game identifier
 * @param {Object} signals  - See computeFrustration for field descriptions
 * @param {Object} [opts]
 * @param {boolean} [opts.won=true]    - Whether the player completed the level
 * @param {boolean} [opts.daily=false] - Daily challenges are exempt from adaptation
 * @returns {{ tier: number, frustration: number, changed: boolean }}
 */
export function recordLevel(gameId, signals, opts = {}) {
  const { won = true, daily = false } = opts;

  if (daily) {
    const profile = loadProfile(gameId);
    return { tier: profile.tier, frustration: 0, changed: false };
  }

  const profile = loadProfile(gameId);
  const frustration = computeFrustration(signals);

  // Update EMA
  const prevEma = profile.ema;
  profile.ema = EMA_ALPHA * frustration + (1 - EMA_ALPHA) * prevEma;

  // Track streak
  const isFrustrated = frustration >= FRUSTRATION_THRESHOLD;
  const isEasyWin = won && frustration < 0.3 && (signals.retryCount ?? 0) === 0;

  if (isFrustrated) {
    profile.streak = Math.min(0, profile.streak) - 1;
  } else if (isEasyWin) {
    profile.streak = Math.max(0, profile.streak) + 1;
  } else {
    // Partial decay toward 0
    profile.streak = Math.sign(profile.streak) * Math.max(0, Math.abs(profile.streak) - 1);
  }

  profile.levelCount++;
  profile.history.push({ frustration, won, signals });

  // Decide tier change — never jump more than one tier
  const prevTier = profile.tier;
  let newTier = profile.tier;

  if (profile.streak <= -FRUSTRATION_STREAK && profile.tier > MIN_TIER) {
    newTier = profile.tier - 1;
    profile.streak = 0; // reset streak after acting
  } else if (profile.streak >= SUCCESS_STREAK_HARD && profile.tier < MAX_TIER) {
    newTier = profile.tier + 1;
    profile.streak = 0;
  }

  profile.tier = Math.min(MAX_TIER, Math.max(MIN_TIER, newTier));
  saveProfile(gameId, profile);

  return {
    tier: profile.tier,
    frustration,
    changed: profile.tier !== prevTier,
  };
}

/**
 * Reset adaptive state for a game (e.g. on explicit difficulty reset in dev mode).
 *
 * @param {string} gameId
 */
export function resetAdaptive(gameId) {
  try {
    localStorage.removeItem(storageKey(gameId));
  } catch {
    // ignore
  }
}

/**
 * Override the current tier (dev mode / testing).
 *
 * @param {string} gameId
 * @param {number} tier
 */
export function setTier(gameId, tier) {
  const profile = loadProfile(gameId);
  profile.tier = Math.min(MAX_TIER, Math.max(MIN_TIER, tier));
  profile.streak = 0;
  saveProfile(gameId, profile);
}

/**
 * Get full profile for debugging / developer overlay.
 *
 * @param {string} gameId
 * @returns {{ tier, ema, streak, levelCount, history }}
 */
export function getProfile(gameId) {
  return loadProfile(gameId);
}

/**
 * Map a tier [1-5] to a generator difficulty string used by game generators.
 *
 * @param {number} tier
 * @returns {'easy' | 'medium' | 'hard'}
 */
export function tierToString(tier) {
  if (tier <= 2) return 'easy';
  if (tier >= 4) return 'hard';
  return 'medium';
}

export { MIN_TIER, MAX_TIER, DEFAULT_TIER, FRUSTRATION_THRESHOLD, FRUSTRATION_STREAK, SUCCESS_STREAK_HARD };
