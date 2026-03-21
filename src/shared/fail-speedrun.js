/**
 * Fail Speedrun Mode
 *
 * Race to trigger the fail state as fast as possible - mirrors the fake-ad phenomenon.
 * Provides per-game fail objectives, millisecond-precision timer, and leaderboard.
 *
 * Usage:
 *   import { createFailSpeedrun } from './fail-speedrun.js';
 *   const speedrun = createFailSpeedrun({
 *     gameId: 'pull-the-pin',
 *     levelIndex: 0,
 *     onFail: (time) => console.log(`Failed in ${time}ms!`)
 *   });
 *   speedrun.start();
 *   speedrun.recordInput(); // Called on first input
 *   speedrun.recordFail(); // Called when fail state is triggered
 */

import { storage } from './storage.js';

/** Storage key prefix for fail speedrun leaderboard */
const LEADERBOARD_KEY_PREFIX = 'fail-speedrun:';

/** Storage key for badge awards */
const BADGES_KEY = 'fail-speedrun:badges';

/** Time threshold for "Ad Recreation" badge (3 seconds in ms) */
const AD_RECREATION_THRESHOLD_MS = 3000;

/** Games eligible for "Ad Recreation" badge */
const AD_RECREATION_GAMES = ['pull-the-pin', 'save-the-character'];

/** Games that support fail speedrun mode */
const SUPPORTED_GAMES = {
  'pull-the-pin': {
    name: 'Pull the Pin',
    failObjective: 'First ball into wrong cup (fastest pin pull)',
    hasFailState: true,
  },
  'water-sort': {
    name: 'Water Sort',
    failObjective: 'Pour wrong color (fastest wrong pour)',
    hasFailState: true,
  },
  'brain-teaser': {
    name: 'Brain Teaser',
    failObjective: 'Tap most obvious wrong answer (fastest wrong tap)',
    hasFailState: true,
  },
  'save-the-character': {
    name: 'Save the Character',
    failObjective: 'Pick worst choice (fastest tap)',
    hasFailState: true,
  },
  'jelly-shift': {
    name: 'Jelly Shift',
    failObjective: 'Splat on first wall (fastest splat)',
    hasFailState: true,
  },
  'giant-runner': {
    name: 'Giant Runner',
    failObjective: 'Arrive at boss smallest possible (lowest scale)',
    hasFailState: true,
  },
  // Alternate objective games (no fail state, but tracked for future)
  'parking-escape': {
    name: 'Parking Escape',
    failObjective: 'Fewest moves to return to initial state (undo speedrun)',
    hasFailState: false, // Uses undo mechanic, not fail state
    isAlternateObjective: true,
  },
  'merge-games': {
    name: 'Merge Games',
    failObjective: 'Fill grid completely (fastest overflow)',
    hasFailState: true,
  },
  'crowd-runner': {
    name: 'Crowd Runner',
    failObjective: 'Reduce crowd to minimum before boss (lowest arrival count)',
    hasFailState: true,
  },
  'bridge-race': {
    name: 'Bridge Race',
    failObjective: 'Let all opponents finish first (last place speedrun)',
    hasFailState: false, // Uses alternate objective
    isAlternateObjective: true,
  },
  'makeover-run': {
    name: 'Makeover Run',
    failObjective: 'Hit every negative station (lowest score)',
    hasFailState: true,
  },
  // Excluded games (no fail state)
  'satisfying-asmr': {
    name: 'Satisfying/ASMR',
    failObjective: null,
    hasFailState: false,
    excluded: true,
  },
};

/**
 * Check if a game supports fail speedrun mode
 * @param {string} gameId - Game identifier
 * @returns {boolean}
 */
export function isGameSupported(gameId) {
  const game = SUPPORTED_GAMES[gameId];
  return !!(game && !game.excluded && game.hasFailState);
}

/**
 * Get all supported games for fail speedrun
 * @returns {string[]} Array of supported game IDs
 */
export function getSupportedGames() {
  return Object.entries(SUPPORTED_GAMES)
    .filter(([, config]) => !config.excluded && config.hasFailState)
    .map(([id]) => id);
}

/**
 * Get game configuration for fail speedrun
 * @param {string} gameId - Game identifier
 * @returns {Object|null} Game config or null if not supported
 */
export function getGameConfig(gameId) {
  return SUPPORTED_GAMES[gameId] || null;
}

/**
 * Get storage key for a game level's leaderboard
 * @param {string} gameId - Game identifier
 * @param {number} levelIndex - Level index
 * @returns {string}
 */
function getLeaderboardKey(gameId, levelIndex) {
  return `${LEADERBOARD_KEY_PREFIX}${gameId}:${levelIndex}`;
}

/**
 * Get personal best for a game level
 * @param {string} gameId - Game identifier
 * @param {number} levelIndex - Level index
 * @returns {number|null} Best time in ms or null
 */
export function getPersonalBest(gameId, levelIndex) {
  const key = getLeaderboardKey(gameId, levelIndex);
  return storage.get(key, null);
}

/**
 * Get all personal bests for a game
 * @param {string} gameId - Game identifier
 * @returns {Object} Map of levelIndex to best time
 */
export function getAllPersonalBests(gameId) {
  const prefix = `${LEADERBOARD_KEY_PREFIX}${gameId}:`;
  const bests = {};

  try {
    // Use storage module's internal key enumeration if available
    // Fall back to direct localStorage access
    const storageObj = storage.storage || storage;
    const keys = storageObj._getAllKeys ? storageObj._getAllKeys() : getStorageKeys();

    for (const key of keys) {
      // Handle both namespaced and non-namespaced keys
      const fullKey = key.startsWith('mg:') ? key.slice(3) : key;
      if (fullKey.startsWith(prefix.slice(3))) { // Remove 'mg:' from prefix
        const levelIndex = parseInt(fullKey.slice(prefix.slice(3).length), 10);
        if (!isNaN(levelIndex)) {
          bests[levelIndex] = storage.get(fullKey);
        }
      }
    }
  } catch {
    // Storage unavailable
  }

  return bests;
}

/**
 * Get all storage keys (fallback for direct localStorage access)
 * @returns {string[]} Array of keys without namespace prefix
 */
function getStorageKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith('mg:')) {
        keys.push(fullKey.slice(3));
      }
    }
  } catch {
    // Storage unavailable
  }
  return keys;
}

/**
 * Save a new personal best time
 * @param {string} gameId - Game identifier
 * @param {number} levelIndex - Level index
 * @param {number} timeMs - Time in milliseconds
 * @returns {boolean} True if this is a new personal best
 */
export function savePersonalBest(gameId, levelIndex, timeMs) {
  const key = getLeaderboardKey(gameId, levelIndex);
  const currentBest = storage.get(key, null);

  if (currentBest === null || timeMs < currentBest) {
    storage.set(key, timeMs);
    return true;
  }

  return false;
}

/**
 * Get all earned badges
 * @returns {Object[]} Array of badge objects
 */
export function getEarnedBadges() {
  return storage.get(BADGES_KEY, []);
}

/**
 * Check if "Ad Recreation" badge should be awarded
 * @param {string} gameId - Game identifier
 * @param {number} timeMs - Fail time in milliseconds
 * @returns {boolean} True if badge was awarded
 */
export function checkAdRecreationBadge(gameId, timeMs) {
  if (!AD_RECREATION_GAMES.includes(gameId)) {
    return false;
  }

  // Badge requires fail time UNDER 3 seconds
  if (timeMs >= AD_RECREATION_THRESHOLD_MS) {
    return false;
  }

  const badges = getEarnedBadges();
  const badgeId = `ad-recreation:${gameId}`;

  // Check if already earned
  if (badges.some(b => b.id === badgeId)) {
    return false;
  }

  // Award badge
  badges.push({
    id: badgeId,
    type: 'ad-recreation',
    gameId,
    timeMs,
    timestamp: Date.now(),
    description: 'You just made a fake ad - failed in under 3 seconds!',
  });

  storage.set(BADGES_KEY, badges);
  return true;
}

/**
 * Format time for display
 * @param {number} timeMs - Time in milliseconds
 * @returns {string} Formatted time string
 */
export function formatTime(timeMs) {
  if (timeMs === null || timeMs === undefined) {
    return '--:--.---';
  }

  const totalSeconds = timeMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ms = Math.floor(timeMs % 1000);

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  return `${seconds}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Create a fail speedrun session
 *
 * @param {Object} options - Configuration
 * @param {string} options.gameId - Game identifier
 * @param {number} options.levelIndex - Current level index
 * @param {Function} options.onFail - Callback(timeMs, isNewBest, badgeAwarded) when fail triggers
 * @param {Function} options.onTick - Callback(timeMs) for timer updates (optional)
 * @param {number} options.tickInterval - Timer update interval in ms (default: 16)
 * @returns {Object} Fail speedrun instance
 */
export function createFailSpeedrun(options = {}) {
  const {
    gameId,
    levelIndex = 0,
    onFail,
    onTick,
    tickInterval = 16,
  } = options;

  // State
  let startTime = null;
  let firstInputTime = null;
  let endTime = null;
  let isRunning = false;
  let hasInput = false;
  let tickIntervalId = null;

  /**
   * Get elapsed time since first input
   * @returns {number|null} Time in ms or null if not started
   */
  function getElapsedTime() {
    if (firstInputTime === null) {
      return null;
    }

    const end = endTime || performance.now();
    return end - firstInputTime;
  }

  /**
   * Get total time since speedrun start
   * @returns {number|null} Time in ms or null if not started
   */
  function getTotalTime() {
    if (startTime === null) {
      return null;
    }

    const end = endTime || performance.now();
    return end - startTime;
  }

  /**
   * Start the speedrun session
   * Called when the level begins
   */
  function start() {
    startTime = performance.now();
    firstInputTime = null;
    endTime = null;
    isRunning = true;
    hasInput = false;

    // Start tick interval
    if (onTick) {
      tickIntervalId = setInterval(() => {
        if (isRunning && firstInputTime !== null) {
          onTick(getElapsedTime());
        }
      }, tickInterval);
    }
  }

  /**
   * Record first input
   * Timer starts on first input, not on level start
   */
  function recordInput() {
    if (!isRunning || hasInput) {
      return;
    }

    hasInput = true;
    firstInputTime = performance.now();
  }

  /**
   * Record a fail event
   * Stops the timer and saves to leaderboard
   * @returns {Object} Result with time, isNewBest, badgeAwarded
   */
  function recordFail() {
    if (!isRunning || firstInputTime === null) {
      return { timeMs: null, isNewBest: false, badgeAwarded: false };
    }

    isRunning = false;
    endTime = performance.now();

    // Stop tick interval
    if (tickIntervalId !== null) {
      clearInterval(tickIntervalId);
      tickIntervalId = null;
    }

    const timeMs = getElapsedTime();

    // Save to leaderboard
    const isNewBest = savePersonalBest(gameId, levelIndex, timeMs);

    // Check for badge
    const badgeAwarded = checkAdRecreationBadge(gameId, timeMs);

    // Callback
    if (onFail) {
      onFail(timeMs, isNewBest, badgeAwarded);
    }

    return { timeMs, isNewBest, badgeAwarded };
  }

  /**
   * Stop/cancel the speedrun without recording
   */
  function stop() {
    isRunning = false;

    if (tickIntervalId !== null) {
      clearInterval(tickIntervalId);
      tickIntervalId = null;
    }
  }

  /**
   * Reset the speedrun for retry
   */
  function reset() {
    stop();
    startTime = null;
    firstInputTime = null;
    endTime = null;
    hasInput = false;
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  function getState() {
    return {
      gameId,
      levelIndex,
      isRunning,
      hasInput,
      startTime,
      firstInputTime,
      endTime,
      elapsedTime: getElapsedTime(),
      totalTime: getTotalTime(),
      personalBest: getPersonalBest(gameId, levelIndex),
    };
  }

  return {
    start,
    stop,
    reset,
    recordInput,
    recordFail,
    getElapsedTime,
    getTotalTime,
    getState,
    gameId,
    levelIndex,
  };
}

/**
 * Fail Speedrun UI Overlay
 *
 * Shows the fail speedrun timer and results overlay.
 */

/** Active overlay instances */
const overlayInstances = new Set();

/** Overlay styles injected flag */
let overlayStylesInjected = false;

/**
 * Inject overlay styles
 */
function injectOverlayStyles() {
  if (overlayStylesInjected) return;

  const style = document.createElement('style');
  style.textContent = `
    .fs-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 400;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .fs-overlay.fs-visible {
      opacity: 1;
      pointer-events: auto;
    }
    .fs-card {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 24px;
      padding: 40px 32px;
      text-align: center;
      max-width: 360px;
      width: 90%;
      transform: scale(0.8) translateY(20px);
      transition: transform 0.3s ease;
      border: 2px solid #ff6b6b;
    }
    .fs-overlay.fs-visible .fs-card {
      transform: scale(1) translateY(0);
    }
    .fs-badge {
      background: #ff6b6b;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
      display: inline-block;
    }
    .fs-title {
      font-size: 48px;
      font-weight: 800;
      color: #ff6b6b;
      margin-bottom: 8px;
      text-shadow: 0 4px 20px rgba(255, 107, 107, 0.4);
    }
    .fs-subtitle {
      font-size: 14px;
      color: #888;
      margin-bottom: 24px;
    }
    .fs-time {
      font-size: 56px;
      font-weight: 700;
      color: white;
      font-variant-numeric: tabular-nums;
      margin-bottom: 8px;
    }
    .fs-time-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 24px;
    }
    .fs-new-best {
      color: #4ecdc4;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .fs-comparison {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-bottom: 24px;
    }
    .fs-stat {
      text-align: center;
    }
    .fs-stat-value {
      font-size: 24px;
      font-weight: 700;
      color: white;
    }
    .fs-stat-label {
      font-size: 11px;
      color: #888;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .fs-buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .fs-btn {
      padding: 16px 24px;
      border-radius: 12px;
      border: none;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.1s;
    }
    .fs-btn:active {
      transform: scale(0.98);
      opacity: 0.9;
    }
    .fs-btn-primary {
      background: #ff6b6b;
      color: white;
    }
    .fs-btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }
    .fs-timer {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 24px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      z-index: 350;
      border: 2px solid #ff6b6b;
    }
    .fs-timer.fs-waiting {
      border-color: #ffd93d;
      color: #ffd93d;
    }
    .fs-ad-badge {
      background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .fs-ad-badge-title {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .fs-ad-badge-desc {
      font-size: 12px;
      opacity: 0.9;
    }
  `;
  document.head.appendChild(style);
  overlayStylesInjected = true;
}

/**
 * Show the fail speedrun results overlay
 *
 * @param {Object} options - Configuration
 * @param {HTMLElement} options.container - Container element
 * @param {string} options.gameId - Game identifier
 * @param {number} options.levelIndex - Level index
 * @param {number} options.timeMs - Fail time in milliseconds
 * @param {boolean} options.isNewBest - Whether this is a new personal best
 * @param {boolean} options.badgeAwarded - Whether "Ad Recreation" badge was awarded
 * @param {Function} options.onRetry - Callback for retry button
 * @param {Function} options.onClose - Callback for close button
 * @returns {Object} Overlay instance
 */
export function showFailResult(options = {}) {
  const {
    container,
    gameId,
    levelIndex,
    timeMs,
    isNewBest = false,
    badgeAwarded = false,
    onRetry,
    onClose,
  } = options;

  injectOverlayStyles();

  const gameConfig = getGameConfig(gameId);
  const previousBest = getPersonalBest(gameId, levelIndex);

  const overlay = document.createElement('div');
  overlay.className = 'fs-overlay';

  let html = '<div class="fs-card">';

  // Ad Recreation badge
  if (badgeAwarded) {
    html += `
      <div class="fs-ad-badge">
        <div class="fs-ad-badge-title">Ad Recreation Badge!</div>
        <div class="fs-ad-badge-desc">You just made a fake ad</div>
      </div>
    `;
  }

  // Badge for fail speedrun mode
  html += '<div class="fs-badge">Fail Speedrun</div>';

  // Title
  html += '<div class="fs-title">FAIL!</div>';
  html += `<div class="fs-subtitle">${gameConfig?.failObjective || 'Fastest fail'}</div>`;

  // Time
  html += `<div class="fs-time">${formatTime(timeMs)}</div>`;
  html += '<div class="fs-time-label">Fail Time</div>';

  // New best indicator
  if (isNewBest) {
    html += '<div class="fs-new-best">New Personal Best!</div>';
  }

  // Stats comparison
  html += '<div class="fs-comparison">';
  html += `
    <div class="fs-stat">
      <div class="fs-stat-value">${formatTime(timeMs)}</div>
      <div class="fs-stat-label">This Run</div>
    </div>
  `;
  if (previousBest !== null) {
    html += `
      <div class="fs-stat">
        <div class="fs-stat-value">${formatTime(previousBest)}</div>
        <div class="fs-stat-label">Best</div>
      </div>
    `;
  }
  html += '</div>';

  // Buttons
  html += '<div class="fs-buttons">';
  html += '<button class="fs-btn fs-btn-primary" data-action="retry">Try Again</button>';
  html += '<button class="fs-btn fs-btn-secondary" data-action="close">Exit</button>';
  html += '</div>';

  html += '</div>';

  overlay.innerHTML = html;

  const target = container || document.body;
  target.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('fs-visible');
  });

  // Button handlers
  overlay.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      instance.hide();

      if (action === 'retry' && onRetry) {
        onRetry();
      } else if (action === 'close' && onClose) {
        onClose();
      }
    });
  });

  const instance = {
    overlay,

    hide() {
      overlay.classList.remove('fs-visible');
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        overlayInstances.delete(instance);
      }, 300);
    },

    destroy() {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      overlayInstances.delete(instance);
    },
  };

  overlayInstances.add(instance);
  return instance;
}

/**
 * Show the live timer display
 *
 * @param {Object} options - Configuration
 * @param {HTMLElement} options.container - Container element
 * @param {Function} options.getCurrentTime - Function that returns current elapsed time in ms
 * @returns {Object} Timer instance with update() and destroy()
 */
export function showFailTimer(options = {}) {
  const { container, getCurrentTime } = options;

  injectOverlayStyles();

  const timer = document.createElement('div');
  timer.className = 'fs-timer fs-waiting';
  timer.textContent = '0.000';

  const target = container || document.body;
  target.appendChild(timer);

  let destroyed = false;

  const instance = {
    timer,

    /**
     * Update timer display
     * @param {boolean} hasInput - Whether first input has been recorded
     */
    update(hasInput = false) {
      if (destroyed) return;

      const timeMs = getCurrentTime();

      if (hasInput) {
        timer.classList.remove('fs-waiting');
        timer.textContent = formatTime(timeMs);
      } else {
        timer.classList.add('fs-waiting');
        timer.textContent = 'Waiting...';
      }
    },

    destroy() {
      destroyed = true;
      if (timer.parentNode) {
        timer.parentNode.removeChild(timer);
      }
    },
  };

  return instance;
}

/**
 * Cleanup all overlay instances
 */
export function cleanupAllOverlays() {
  for (const inst of overlayInstances) {
    inst.destroy();
  }
  overlayInstances.clear();
}

/**
 * Check if fail speedrun mode is enabled for a game
 * @param {string} gameId - Game identifier
 * @returns {boolean}
 */
export function isFailSpeedrunEnabled(gameId) {
  const key = `fail-speedrun:enabled:${gameId}`;
  return storage.get(key, false);
}

/**
 * Toggle fail speedrun mode for a game
 * @param {string} gameId - Game identifier
 * @param {boolean} enabled - Whether to enable
 */
export function setFailSpeedrunEnabled(gameId, enabled) {
  const key = `fail-speedrun:enabled:${gameId}`;
  storage.set(key, enabled);
}

/**
 * Toggle fail speedrun mode for a game (returns new state)
 * @param {string} gameId - Game identifier
 * @returns {boolean} New enabled state
 */
export function toggleFailSpeedrun(gameId) {
  const currentState = isFailSpeedrunEnabled(gameId);
  setFailSpeedrunEnabled(gameId, !currentState);
  return !currentState;
}

export default {
  createFailSpeedrun,
  isGameSupported,
  getSupportedGames,
  getGameConfig,
  getPersonalBest,
  getAllPersonalBests,
  savePersonalBest,
  getEarnedBadges,
  checkAdRecreationBadge,
  formatTime,
  showFailResult,
  showFailTimer,
  cleanupAllOverlays,
  isFailSpeedrunEnabled,
  setFailSpeedrunEnabled,
  toggleFailSpeedrun,
};
