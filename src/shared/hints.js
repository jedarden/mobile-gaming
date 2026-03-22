/**
 * Hints System
 *
 * Progressive hint system for puzzle games. Works in conjunction with
 * hint-worker.js (Web Worker) which runs the solver asynchronously.
 *
 * Hint levels:
 *   1 = Highlight the area/element that needs attention
 *   2 = Show the specific move (arrow, highlight target)
 *   3 = Auto-play the move (execute it for the player)
 *
 * Hint tokens:
 *   - Stored in localStorage under key 'mg:hint-tokens'
 *   - Default: 5 tokens per day
 *   - Replenish each calendar day
 *   - Each hint request costs 1 token (levels 1 and 2 are free previews)
 *     Level 3 (auto-play) costs 1 token
 */

import { StorageManager } from './storage.js';

const storage = new StorageManager();

const TOKENS_KEY = 'hint-tokens';
const TOKENS_PER_DAY = 5;
const HINT_IDLE_MS = 15_000; // show hint button after 15s idle

// ─── Token Management ──────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Get current hint token balance, replenishing if a new day has started.
 * @returns {number}
 */
export function getHintTokens() {
  const stored = storage.get(TOKENS_KEY) || { date: null, count: 0 };
  const today = todayKey();

  if (stored.date !== today) {
    // New day — replenish tokens
    const refreshed = { date: today, count: TOKENS_PER_DAY };
    storage.set(TOKENS_KEY, refreshed);
    return TOKENS_PER_DAY;
  }

  return stored.count;
}

/**
 * Spend one hint token. Returns true if successful, false if out of tokens.
 * @returns {boolean}
 */
export function spendHintToken() {
  const tokens = getHintTokens();
  if (tokens <= 0) return false;

  const today = todayKey();
  storage.set(TOKENS_KEY, { date: today, count: tokens - 1 });
  return true;
}

/**
 * Force-add tokens (for testing / rewarded ads).
 * @param {number} count
 */
export function addHintTokens(count) {
  const current = getHintTokens();
  const today = todayKey();
  storage.set(TOKENS_KEY, { date: today, count: current + count });
}

// ─── Hint Session ──────────────────────────────────────────────────────────────

/**
 * Create a hint session for a game level.
 *
 * @param {Object} options
 * @param {string} options.gameId - e.g. 'parking-escape'
 * @param {Object} options.level - Current level data
 * @param {Function} options.getState - Returns current game state
 * @param {Function} options.onHighlight - Called with highlight info for level 1
 * @param {Function} options.onShowMove - Called with move info for level 2
 * @param {Function} options.onAutoPlay - Called with move info for level 3
 * @param {Function} [options.onTokensEmpty] - Called when tokens run out
 * @param {Function} [options.onWorkerError] - Called on solver error
 * @returns {Object} Hint session with methods and cleanup
 */
export function createHintSession({
  gameId,
  level,
  getState,
  onHighlight,
  onShowMove,
  onAutoPlay,
  onTokensEmpty,
  onWorkerError,
}) {
  let currentLevel = 0; // 0 = no hint shown, 1-3 = progressive levels
  let moves = null;     // cached solver result: [{type, ...}]
  let worker = null;
  let idleTimer = null;
  let pendingRequest = false;

  // ─── Worker communication ──────────────────────────────────────────────────

  function ensureWorker() {
    if (worker) return worker;
    try {
      worker = new Worker(
        new URL('./hint-worker.js', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = ({ data }) => {
        pendingRequest = false;
        if (data.error) {
          onWorkerError?.(data.error);
          return;
        }
        moves = data.moves || [];
        applyCurrentLevel();
      };
      worker.onerror = (e) => {
        pendingRequest = false;
        onWorkerError?.(e.message);
      };
    } catch (e) {
      onWorkerError?.(`Worker init failed: ${e.message}`);
    }
    return worker;
  }

  function requestSolve() {
    if (pendingRequest) return;
    const w = ensureWorker();
    if (!w) return;
    pendingRequest = true;
    moves = null;
    w.postMessage({ gameId, state: getState(), level });
  }

  // ─── Reveal logic ──────────────────────────────────────────────────────────

  function applyCurrentLevel() {
    if (!moves || moves.length === 0) return;
    const move = moves[0];

    if (currentLevel >= 1) {
      onHighlight?.({ move, level: currentLevel });
    }
    if (currentLevel >= 2) {
      onShowMove?.({ move, level: currentLevel });
    }
    if (currentLevel >= 3) {
      onAutoPlay?.({ move });
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Show the next hint level (or first hint if none shown yet).
   * Level 3 costs a hint token.
   * @returns {boolean} Whether a hint was shown
   */
  function showHint() {
    const nextLevel = currentLevel + 1;

    if (nextLevel > 3) return false; // already at max

    // Level 3 (auto-play) costs a token
    if (nextLevel === 3) {
      if (!spendHintToken()) {
        onTokensEmpty?.();
        return false;
      }
    }

    currentLevel = nextLevel;

    if (moves) {
      applyCurrentLevel();
    } else {
      requestSolve();
    }

    return true;
  }

  /**
   * Reset hint state (call when level restarts or new level starts).
   */
  function reset() {
    currentLevel = 0;
    moves = null;
    pendingRequest = false;
    stopIdleTimer();
  }

  /**
   * Record user input (resets idle timer).
   */
  function onUserInput() {
    stopIdleTimer();
    startIdleTimer();
  }

  function startIdleTimer() {
    if (typeof setTimeout === 'undefined') return;
    idleTimer = setTimeout(() => {
      // After idle, pre-fetch the solution so hint is instant when requested
      if (currentLevel === 0) requestSolve();
    }, HINT_IDLE_MS);
  }

  function stopIdleTimer() {
    if (idleTimer !== null) {
      if (typeof clearTimeout !== 'undefined') clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  /**
   * Tear down the session (terminate worker, clear timers).
   */
  function destroy() {
    stopIdleTimer();
    if (worker) {
      worker.terminate();
      worker = null;
    }
  }

  // Start idle timer immediately
  startIdleTimer();

  return {
    showHint,
    reset,
    onUserInput,
    destroy,
    /** Returns the current hint level (0 = no hint shown) */
    get level() { return currentLevel; },
    /** Returns cached moves (null if not yet solved) */
    get moves() { return moves; },
    /** Returns number of hint tokens remaining */
    get tokens() { return getHintTokens(); },
  };
}
