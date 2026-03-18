/**
 * Shared Scoring System
 *
 * Calculates scores based on moves, time, and optimality.
 * Tracks best scores per level in localStorage.
 * Provides a level-complete overlay with stats display.
 */

import { storage } from './storage.js';
import { playSound } from './audio.js';
import { BLUISH_GREEN, BLUE, ORANGE, GRAY, WHITE, YELLOW } from './colors.js';

/** Storage key prefix for best scores */
const SCORE_KEY_PREFIX = 'best-scores:';

/** Scoring weights */
const WEIGHTS = {
  moves: 0.4,    // 40% weight for move efficiency
  time: 0.3,     // 30% weight for time efficiency
  optimal: 0.3,  // 30% weight for optimality
};

/** Time bonus thresholds (seconds) */
const TIME_THRESHOLDS = {
  fast: 10,     // Under 10s = fast bonus
  normal: 30,   // 10-30s = normal
  slow: 60,     // 30-60s = slow
};

/** Score rating thresholds */
const RATING_THRESHOLDS = [
  { min: 90, stars: 3, label: 'Perfect' },
  { min: 70, stars: 2, label: 'Great' },
  { min: 40, stars: 1, label: 'Good' },
  { min: 0, stars: 0, label: 'Cleared' },
];

/** Active instances for cleanup */
const instances = new Set();

/** Injected styles (only once) */
let stylesInjected = false;

/**
 * Inject overlay styles into the document
 */
function injectStyles() {
  if (stylesInjected) return;

  const style = document.createElement('style');
  style.textContent = `
    .mg-score-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 300;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .mg-score-overlay.mg-visible {
      opacity: 1;
      pointer-events: auto;
    }
    .mg-score-card {
      background: #1a1a2e;
      border-radius: 24px;
      padding: 32px 28px;
      text-align: center;
      max-width: 320px;
      width: 90%;
      transform: scale(0.8) translateY(20px);
      transition: transform 0.3s ease;
    }
    .mg-score-overlay.mg-visible .mg-score-card {
      transform: scale(1) translateY(0);
    }
    .mg-score-stars {
      font-size: 36px;
      margin-bottom: 12px;
      letter-spacing: 4px;
    }
    .mg-score-stars .mg-star-filled {
      color: ${YELLOW.hex};
    }
    .mg-score-stars .mg-star-empty {
      color: rgba(255, 255, 255, 0.15);
    }
    .mg-score-title {
      font-size: 24px;
      font-weight: 700;
      color: white;
      margin-bottom: 4px;
    }
    .mg-score-subtitle {
      font-size: 14px;
      color: ${GRAY.hex};
      margin-bottom: 24px;
    }
    .mg-score-stats {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 24px;
    }
    .mg-score-stat {
      flex: 1;
    }
    .mg-score-stat-value {
      font-size: 24px;
      font-weight: 700;
      color: white;
    }
    .mg-score-stat-label {
      font-size: 11px;
      color: ${GRAY.hex};
      text-transform: uppercase;
      margin-top: 2px;
    }
    .mg-score-stat-new {
      font-size: 10px;
      color: ${ORANGE.hex};
      font-weight: 600;
      text-transform: uppercase;
    }
    .mg-score-bar {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    .mg-score-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.6s ease;
    }
    .mg-score-buttons {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .mg-score-btn {
      padding: 14px 20px;
      border-radius: 12px;
      border: none;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.1s;
    }
    .mg-score-btn:active {
      transform: scale(0.98);
      opacity: 0.9;
    }
    .mg-score-btn-primary {
      background: ${BLUISH_GREEN.hex};
      color: white;
    }
    .mg-score-btn-secondary {
      background: ${BLUE.hex};
      color: white;
    }
    .mg-score-btn-row {
      display: flex;
      gap: 10px;
    }
    .mg-score-btn-row .mg-score-btn {
      flex: 1;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

/**
 * Get storage key for a game level's best score
 * @param {string} gameId - Game identifier
 * @param {number} levelIndex - Level index
 * @returns {string}
 */
function getScoreKey(gameId, levelIndex) {
  return `${SCORE_KEY_PREFIX}${gameId}:${levelIndex}`;
}

/**
 * Calculate the time efficiency component
 * @param {number} time - Time taken in seconds
 * @param {number} parTime - Par time in seconds (expected time for optimal play)
 * @returns {number} Efficiency score 0-100
 */
function calculateTimeScore(time, parTime) {
  if (parTime <= 0) return 100;
  const ratio = time / parTime;
  if (ratio <= 1) return 100;
  if (ratio >= 3) return 0;
  return Math.round(100 * (1 - (ratio - 1) / 2));
}

/**
 * Calculate the move efficiency component
 * @param {number} moves - Moves taken
 * @param {number} parMoves - Par moves (optimal number of moves)
 * @returns {number} Efficiency score 0-100
 */
function calculateMoveScore(moves, parMoves) {
  if (parMoves <= 0) return 100;
  const ratio = moves / parMoves;
  if (ratio <= 1) return 100;
  if (ratio >= 3) return 0;
  return Math.round(100 * (1 - (ratio - 1) / 2));
}

/**
 * Get the rating for a score
 * @param {number} score - Total score 0-100
 * @returns {Object} Rating with stars and label
 */
function getRating(score) {
  return RATING_THRESHOLDS.find(r => score >= r.min);
}

/**
 * Calculate score for a level completion
 *
 * @param {Object} state - Game state at completion
 * @param {number} moves - Total moves taken
 * @param {number} time - Time taken in seconds
 * @param {Object} options - Scoring options
 * @param {number} options.parMoves - Optimal move count
 * @param {number} options.parTime - Optimal time in seconds
 * @returns {Object} Score result
 */
export function calculateScore(state, moves, time, options = {}) {
  const { parMoves = 1, parTime = 10 } = options;

  const moveScore = calculateMoveScore(moves, parMoves);
  const timeScore = calculateTimeScore(time, parTime);
  const optimality = Math.round(
    moveScore * WEIGHTS.moves +
    timeScore * WEIGHTS.time +
    moveScore * WEIGHTS.optimal
  );

  const rating = getRating(optimality);

  return {
    moves,
    time,
    moveScore,
    timeScore,
    optimality,
    stars: rating.stars,
    rating: rating.label,
    parMoves,
    parTime,
  };
}

/**
 * Get the best score for a level
 *
 * @param {string} gameId - Game identifier
 * @param {number} levelIndex - Level index
 * @returns {Object|null} Best score or null
 */
export function getBestScore(gameId, levelIndex) {
  return storage.get(getScoreKey(gameId, levelIndex), null);
}

/**
 * Save a score if it's a new best
 *
 * @param {string} gameId - Game identifier
 * @param {number} levelIndex - Level index
 * @param {Object} score - Score result from calculateScore
 * @returns {boolean} True if this is a new best score
 */
export function saveBestScore(gameId, levelIndex, score) {
  const best = getBestScore(gameId, levelIndex);

  if (!best || score.optimality > best.optimality) {
    storage.set(getScoreKey(gameId, levelIndex), {
      optimality: score.optimality,
      stars: score.stars,
      moves: score.moves,
      time: score.time,
      rating: score.rating,
      timestamp: Date.now(),
    });
    return true;
  }

  return false;
}

/**
 * Clear best score for a level
 *
 * @param {string} gameId - Game identifier
 * @param {number} levelIndex - Level index
 */
export function clearBestScore(gameId, levelIndex) {
  storage.delete(getScoreKey(gameId, levelIndex));
}

/**
 * Format time in seconds to MM:SS
 * @param {number} seconds - Time in seconds
 * @returns {string}
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get the bar fill color based on optimality
 * @param {number} optimality - Optimality percentage
 * @returns {string} CSS color
 */
function getBarColor(optimality) {
  if (optimality >= 90) return BLUISH_GREEN.hex;
  if (optimality >= 70) return BLUE.hex;
  if (optimality >= 40) return ORANGE.hex;
  return GRAY.hex;
}

/**
 * Show a level-complete overlay
 *
 * @param {Object} options - Configuration
 * @param {HTMLElement} options.container - Container element
 * @param {string} options.gameId - Game identifier
 * @param {number} options.levelIndex - Current level index
 * @param {Object} options.stats - Score result from calculateScore
 * @param {boolean} options.isNewBest - Whether this is a new best score
 * @param {Function} options.onNext - Callback for next level
 * @param {Function} options.onReplay - Callback for replay
 * @param {Function} options.onClose - Callback for closing overlay
 * @returns {Object} Overlay instance with hide() and destroy()
 */
export function showLevelComplete(options = {}) {
  const {
    container,
    gameId,
    levelIndex,
    stats,
    isNewBest = false,
    onNext,
    onReplay,
    onClose,
  } = options;

  injectStyles();

  const overlay = document.createElement('div');
  overlay.className = 'mg-score-overlay';

  // Build stars HTML
  let starsHtml = '';
  for (let i = 0; i < 3; i++) {
    starsHtml += i < stats.stars
      ? '<span class="mg-star-filled">\u2605</span>'
      : '<span class="mg-star-empty">\u2605</span>';
  }

  // Build stats HTML
  const bestScore = gameId ? getBestScore(gameId, levelIndex) : null;

  overlay.innerHTML = `
    <div class="mg-score-card">
      <div class="mg-score-stars">${starsHtml}</div>
      <div class="mg-score-title">${stats.rating}!</div>
      <div class="mg-score-subtitle">${isNewBest ? 'New Best!' : 'Level Complete'}</div>
      <div class="mg-score-stats">
        <div class="mg-score-stat">
          <div class="mg-score-stat-value">${stats.moves}</div>
          <div class="mg-score-stat-label">Moves</div>
        </div>
        <div class="mg-score-stat">
          <div class="mg-score-stat-value">${formatTime(stats.time)}</div>
          <div class="mg-score-stat-label">Time</div>
        </div>
        <div class="mg-score-stat">
          <div class="mg-score-stat-value">${stats.optimality}%</div>
          <div class="mg-score-stat-label">Optimal</div>
          ${isNewBest ? '<div class="mg-score-stat-new">NEW</div>' : ''}
        </div>
      </div>
      <div class="mg-score-bar">
        <div class="mg-score-bar-fill" style="width: 0%; background: ${getBarColor(stats.optimality)};"></div>
      </div>
      <div class="mg-score-buttons">
        <button class="mg-score-btn mg-score-btn-primary" data-action="next">Next Level</button>
        <div class="mg-score-btn-row">
          <button class="mg-score-btn mg-score-btn-secondary" data-action="replay">Replay</button>
          <button class="mg-score-btn mg-score-btn-secondary" data-action="close" style="background: rgba(255,255,255,0.08);">Close</button>
        </div>
      </div>
    </div>
  `;

  const target = container || document.body;
  target.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('mg-visible');

    // Animate the score bar
    requestAnimationFrame(() => {
      const barFill = overlay.querySelector('.mg-score-bar-fill');
      if (barFill) {
        barFill.style.width = `${stats.optimality}%`;
      }
    });
  });

  // Play sound
  if (stats.stars >= 3) {
    playSound('levelComplete');
  } else {
    playSound('success');
  }

  // Button handlers
  overlay.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      instance.hide();

      switch (action) {
        case 'next':
          if (onNext) onNext();
          break;
        case 'replay':
          if (onReplay) onReplay();
          break;
        case 'close':
          if (onClose) onClose();
          break;
      }
    });
  });

  const instance = {
    overlay,

    /**
     * Hide the overlay
     */
    hide() {
      overlay.classList.remove('mg-visible');
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        instances.delete(instance);
      }, 300);
    },

    /**
     * Destroy immediately
     */
    destroy() {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      instances.delete(instance);
    },
  };

  instances.add(instance);
  return instance;
}

/**
 * Get all best scores for a game
 *
 * @param {string} gameId - Game identifier
 * @returns {Object} Map of levelIndex to best score
 */
export function getAllBestScores(gameId) {
  const prefix = `${SCORE_KEY_PREFIX}${gameId}:`;
  const scores = {};

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const levelIndex = parseInt(key.slice(prefix.length), 10);
        if (!isNaN(levelIndex)) {
          scores[levelIndex] = storage.get(getScoreKey(gameId, levelIndex));
        }
      }
    }
  } catch {
    // Storage unavailable
  }

  return scores;
}

/**
 * Reset all scores for a game
 *
 * @param {string} gameId - Game identifier
 */
export function resetAllScores(gameId) {
  const prefix = `${SCORE_KEY_PREFIX}${gameId}:`;

  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable
  }
}

/**
 * Cleanup all score overlay instances
 */
export function cleanupAll() {
  for (const inst of instances) {
    inst.destroy();
  }
  instances.clear();
}
