/**
 * Retry Overlay Component
 *
 * Universal retry overlay that slides up from bottom.
 * Shows different content for win, loss, and stuck states.
 */

import { storage } from './storage.js';
import { BLUISH_GREEN, BLUE, ORANGE, GRAY } from './colors.js';
import { playSound } from './audio.js';

const STORAGE_KEY_PREFIX = 'failures:';

/**
 * Result types
 */
export const ResultType = {
  WIN: 'win',
  LOSS: 'loss',
  STUCK: 'stuck'
};

/**
 * Retry overlay component
 */
export class RetryOverlay {
  /**
   * @param {Object} options - Configuration options
   * @param {HTMLElement} options.container - Container element
   * @param {string} options.gameId - Game identifier for storage
   * @param {number} options.levelIndex - Current level index
   * @param {Function} options.onRetry - Callback for retry button
   * @param {Function} options.onNext - Callback for next level button
   * @param {Function} options.onSkip - Callback for skip button
   * @param {Function} options.onHint - Callback for hint button
   * @param {Function} options.onShare - Callback for share button
   * @param {Function} options.onWatchReplay - Callback for watching replay (runner games)
   * @param {Function} options.onUndo - Callback for undo to last good state
   */
  constructor(options) {
    this.container = options.container;
    this.gameId = options.gameId;
    this.levelIndex = options.levelIndex;
    this.onRetry = options.onRetry || (() => {});
    this.onNext = options.onNext || (() => {});
    this.onSkip = options.onSkip || (() => {});
    this.onHint = options.onHint || (() => {});
    this.onShare = options.onShare || (() => {});
    this.onWatchReplay = options.onWatchReplay || null;
    this.onUndo = options.onUndo || null;

    this.element = null;
    this.isVisible = false;
    this.stats = null;
    this.resultType = null;

    this.failureCount = this._loadFailureCount();
  }

  /**
   * Load failure count from storage
   */
  _loadFailureCount() {
    const key = `${STORAGE_KEY_PREFIX}${this.gameId}:${this.levelIndex}`;
    return storage.get(key, 0);
  }

  /**
   * Save failure count to storage
   */
  _saveFailureCount() {
    const key = `${STORAGE_KEY_PREFIX}${this.gameId}:${this.levelIndex}`;
    storage.set(key, this.failureCount);
  }

  /**
   * Reset failure count
   */
  resetFailureCount() {
    this.failureCount = 0;
    const key = `${STORAGE_KEY_PREFIX}${this.gameId}:${this.levelIndex}`;
    storage.delete(key);
  }

  /**
   * Show the overlay
   * @param {string} resultType - Result type (win, loss, stuck)
   * @param {Object} stats - Stats object
   */
  show(resultType, stats = {}) {
    this.resultType = resultType;
    this.stats = stats;

    if (resultType === ResultType.LOSS) {
      this.failureCount++;
      this._saveFailureCount();
    }

    if (!this.element) {
      this._create();
    }

    this._updateContent();
    this.element.classList.add('mg-visible');
    this.isVisible = true;

    // Play appropriate sound
    if (resultType === ResultType.WIN) {
      playSound('success');
    } else {
      playSound('fail');
    }
  }

  /**
   * Hide the overlay
   */
  hide() {
    if (this.element) {
      this.element.classList.remove('mg-visible');
      this.isVisible = false;
    }
  }

  /**
   * Create the overlay element
   */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'mg-retry-overlay';
    this.element.innerHTML = `
      <style>
        .mg-retry-overlay {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(26, 26, 46, 0.98);
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
          padding: 24px 20px 40px;
          transform: translateY(100%);
          transition: transform 0.25s ease-out;
          z-index: 200;
          max-height: 70vh;
          overflow-y: auto;
        }
        .mg-retry-overlay.mg-visible {
          transform: translateY(0);
        }
        .mg-retry-content {
          text-align: center;
        }
        .mg-retry-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .mg-retry-title {
          font-size: 24px;
          font-weight: bold;
          color: white;
          margin-bottom: 8px;
        }
        .mg-retry-subtitle {
          font-size: 14px;
          color: #888;
          margin-bottom: 20px;
        }
        .mg-retry-stats {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-bottom: 24px;
        }
        .mg-retry-stat {
          text-align: center;
        }
        .mg-retry-stat-value {
          font-size: 28px;
          font-weight: bold;
          color: white;
        }
        .mg-retry-stat-label {
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
        }
        .mg-retry-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mg-btn {
          padding: 16px 24px;
          border-radius: 12px;
          border: none;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.1s, opacity 0.1s;
        }
        .mg-btn:active {
          transform: scale(0.98);
          opacity: 0.9;
        }
        .mg-btn-primary {
          background: ${BLUISH_GREEN.hex};
          color: white;
        }
        .mg-btn-secondary {
          background: ${BLUE.hex};
          color: white;
        }
        .mg-btn-outline {
          background: transparent;
          border: 2px solid ${GRAY.hex};
          color: ${GRAY.hex};
        }
        .mg-btn-warning {
          background: ${ORANGE.hex};
          color: white;
        }
        .mg-btn-row {
          display: flex;
          gap: 12px;
        }
        .mg-btn-row .mg-btn {
          flex: 1;
        }
      </style>
      <div class="mg-retry-content">
        <div class="mg-retry-icon"></div>
        <div class="mg-retry-title"></div>
        <div class="mg-retry-subtitle"></div>
        <div class="mg-retry-stats"></div>
        <div class="mg-retry-buttons"></div>
      </div>
    `;

    this.container.appendChild(this.element);
  }

  /**
   * Update content based on result type
   */
  _updateContent() {
    const iconEl = this.element.querySelector('.mg-retry-icon');
    const titleEl = this.element.querySelector('.mg-retry-title');
    const subtitleEl = this.element.querySelector('.mg-retry-subtitle');
    const statsEl = this.element.querySelector('.mg-retry-stats');
    const buttonsEl = this.element.querySelector('.mg-retry-buttons');

    if (this.resultType === ResultType.WIN) {
      iconEl.textContent = '🎉';
      titleEl.textContent = 'Level Complete!';
      subtitleEl.textContent = this._getSubtitleText();

      statsEl.innerHTML = this._renderWinStats();
      buttonsEl.innerHTML = this._renderWinButtons();
    } else if (this.resultType === ResultType.STUCK) {
      iconEl.textContent = '🤔';
      titleEl.textContent = 'No Valid Moves';
      subtitleEl.textContent = 'Looks like you\'re stuck!';

      statsEl.innerHTML = '';
      buttonsEl.innerHTML = this._renderStuckButtons();
    } else {
      iconEl.textContent = '😔';
      titleEl.textContent = 'Try Again';
      subtitleEl.textContent = `Attempt ${this.failureCount + 1}`;

      statsEl.innerHTML = this._renderLossStats();
      buttonsEl.innerHTML = this._renderLossButtons();
    }

    this._attachButtonHandlers();
  }

  /**
   * Get subtitle text based on performance
   */
  _getSubtitleText() {
    if (!this.stats) return 'Great job!';

    const { optimality } = this.stats;
    if (optimality >= 100) return 'Perfect! ⭐';
    if (optimality >= 80) return 'Excellent!';
    if (optimality >= 60) return 'Great job!';
    return 'Level cleared!';
  }

  /**
   * Render win stats
   */
  _renderWinStats() {
    const stats = this.stats || {};
    const items = [];

    if (stats.moves !== undefined) {
      items.push(`<div class="mg-retry-stat">
        <div class="mg-retry-stat-value">${stats.moves}</div>
        <div class="mg-retry-stat-label">Moves</div>
      </div>`);
    }

    if (stats.time !== undefined) {
      items.push(`<div class="mg-retry-stat">
        <div class="mg-retry-stat-value">${this._formatTime(stats.time)}</div>
        <div class="mg-retry-stat-label">Time</div>
      </div>`);
    }

    if (stats.optimality !== undefined) {
      items.push(`<div class="mg-retry-stat">
        <div class="mg-retry-stat-value">${stats.optimality}%</div>
        <div class="mg-retry-stat-label">Optimal</div>
      </div>`);
    }

    return items.join('');
  }

  /**
   * Render loss stats
   */
  _renderLossStats() {
    const stats = this.stats || {};
    const items = [];

    if (stats.moves !== undefined) {
      items.push(`<div class="mg-retry-stat">
        <div class="mg-retry-stat-value">${stats.moves}</div>
        <div class="mg-retry-stat-label">Moves</div>
      </div>`);
    }

    return items.join('');
  }

  /**
   * Render win buttons
   */
  _renderWinButtons() {
    let html = `<button class="mg-btn mg-btn-primary" data-action="next">Next Level</button>`;

    html += `<div class="mg-btn-row">
      <button class="mg-btn mg-btn-secondary" data-action="retry">Replay</button>
      <button class="mg-btn mg-btn-outline" data-action="share">Share</button>
    </div>`;

    return html;
  }

  /**
   * Render loss buttons
   */
  _renderLossButtons() {
    let html = `<button class="mg-btn mg-btn-primary" data-action="retry">Retry</button>`;

    // Show hint option
    html += `<button class="mg-btn mg-btn-secondary" data-action="hint">Hint then Retry</button>`;

    // Show skip after 3 failures
    if (this.failureCount >= 3) {
      html += `<button class="mg-btn mg-btn-warning" data-action="skip">Skip Level</button>`;
    }

    // Show watch replay for runner games
    if (this.onWatchReplay) {
      html += `<button class="mg-btn mg-btn-outline" data-action="replay">Watch Replay</button>`;
    }

    return html;
  }

  /**
   * Render stuck buttons
   */
  _renderStuckButtons() {
    let html = '';

    // Undo option if available
    if (this.onUndo) {
      html += `<button class="mg-btn mg-btn-primary" data-action="undo">Undo to Last Good State</button>`;
    }

    html += `<button class="mg-btn mg-btn-secondary" data-action="retry">Restart Level</button>`;

    // Show skip after 3 failures
    if (this.failureCount >= 3) {
      html += `<button class="mg-btn mg-btn-warning" data-action="skip">Skip Level</button>`;
    }

    return html;
  }

  /**
   * Attach button click handlers
   */
  _attachButtonHandlers() {
    const buttons = this.element.querySelectorAll('[data-action]');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this._handleAction(action);
      });
    });
  }

  /**
   * Handle button action
   */
  _handleAction(action) {
    this.hide();

    switch (action) {
      case 'retry':
        this.onRetry();
        break;
      case 'next':
        this.resetFailureCount();
        this.onNext();
        break;
      case 'skip':
        this.resetFailureCount();
        this.onSkip();
        break;
      case 'hint':
        this.onHint();
        break;
      case 'share':
        this.onShare(this.stats);
        break;
      case 'replay':
        if (this.onWatchReplay) this.onWatchReplay();
        break;
      case 'undo':
        if (this.onUndo) this.onUndo();
        break;
    }
  }

  /**
   * Format time in seconds to MM:SS
   */
  _formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Cleanup the component
   */
  destroy() {
    this.hide();
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

/**
 * Create a retry overlay instance
 */
export function createRetryOverlay(options) {
  return new RetryOverlay(options);
}
