/**
 * ZenSession.js - Zen Mode Session Summary Component
 *
 * Provides:
 * - Session summary overlay for zen mode
 * - Gentle completion messages
 * - Non-competitive statistics display
 */

import { 
  getSessionSummary, 
  getRandomCompletionMessage,
  getRandomSessionQuote,
  isZenMode 
} from './zen-mode.js';

/**
 * Create zen session summary overlay
 * @param {Object} options - Configuration options
 * @returns {HTMLElement} The overlay element
 */
export function createZenSessionSummary(options = {}) {
  const {
    puzzlesCompleted = 0,
    duration = 0,
    showContinue = true,
    onContinue = () => {},
    onExit = () => {}
  } = options;
  
  const summary = getSessionSummary();
  const quote = getRandomSessionQuote();
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'game-overlay active zen-session-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-labelledby', 'zen-summary-title');
  
  overlay.innerHTML = `
    <div class="game-overlay-content zen-session-summary">
      <div class="zen-session-icon" aria-hidden="true">🧘</div>
      
      <h2 id="zen-summary-title" class="zen-session-title">
        Session Complete
      </h2>
      
      <p class="zen-session-stats">
        ${summary.puzzlesCompleted || puzzlesCompleted} puzzle${(summary.puzzlesCompleted || puzzlesCompleted) !== 1 ? 's' : ''} enjoyed
      </p>
      
      <p class="zen-session-time">
        Time: ${formatDuration(summary.duration || duration)}
      </p>
      
      <p class="zen-session-quote">
        "${summary.quote || quote}"
      </p>
      
      <div class="zen-session-actions">
        ${showContinue ? `
          <button class="game-btn game-btn-primary zen-continue-btn">
            Continue
          </button>
        ` : ''}
        <button class="game-btn game-btn-secondary zen-exit-btn">
          Exit
        </button>
      </div>
    </div>
  `;
  
  // Add event listeners
  const continueBtn = overlay.querySelector('.zen-continue-btn');
  const exitBtn = overlay.querySelector('.zen-exit-btn');
  
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      overlay.remove();
      onContinue();
    });
  }
  
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      overlay.remove();
      onExit();
    });
  }
  
  // Close on escape key
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      onExit();
      document.removeEventListener('keydown', handleKeydown);
    }
  };
  document.addEventListener('keydown', handleKeydown);
  
  return overlay;
}

/**
 * Create zen level complete message
 * @param {Object} options - Configuration options
 * @returns {HTMLElement} The message element
 */
export function createZenLevelComplete(options = {}) {
  const {
    message = getRandomCompletionMessage(),
    autoDismiss = true,
    dismissDelay = 2000
  } = options;
  
  const container = document.createElement('div');
  container.className = 'zen-level-complete fade-in';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  
  container.innerHTML = `
    <div class="zen-complete-message">
      <span class="emoji" aria-hidden="true">✨</span>
      <span class="message">${message}</span>
    </div>
  `;
  
  // Auto dismiss if enabled
  if (autoDismiss) {
    setTimeout(() => {
      container.classList.add('fade-out');
      setTimeout(() => container.remove(), 500);
    }, dismissDelay);
  }
  
  return container;
}

/**
 * Format duration for display
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
function formatDuration(ms) {
  if (!ms || ms <= 0) return '0 seconds';
  
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (minutes === 0) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  
  if (seconds === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  return `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}`;
}

/**
 * Show zen session summary overlay
 * @param {Object} options - Configuration options
 * @returns {Promise} Resolves when overlay is dismissed
 */
export function showZenSessionSummary(options = {}) {
  return new Promise((resolve) => {
    const overlay = createZenSessionSummary({
      ...options,
      onContinue: () => {
        options.onContinue?.();
        resolve('continue');
      },
      onExit: () => {
        options.onExit?.();
        resolve('exit');
      }
    });
    
    document.body.appendChild(overlay);
    
    // Focus the primary button
    const primaryBtn = overlay.querySelector('.game-btn-primary');
    primaryBtn?.focus();
  });
}

/**
 * Show zen level complete notification
 * @param {Object} options - Configuration options
 * @returns {HTMLElement} The notification element
 */
export function showZenLevelComplete(options = {}) {
  const notification = createZenLevelComplete(options);
  document.body.appendChild(notification);
  return notification;
}

/**
 * Check if should show zen UI (helper for games)
 * @returns {boolean} True if zen mode is active
 */
export function shouldShowZenUI() {
  return isZenMode();
}

export default {
  createZenSessionSummary,
  createZenLevelComplete,
  showZenSessionSummary,
  showZenLevelComplete,
  shouldShowZenUI
};
