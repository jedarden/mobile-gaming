/**
 * Level navigation strip
 *
 * Horizontal scrollable strip of level indicators shown at the bottom of
 * the game screen. Supports completed, current, locked, and skipped states.
 * Integrates with localStorage for progress persistence.
 */

import { storage } from './storage.js';
import { playTap } from './audio.js';

/** Dot diameter in logical pixels */
const DOT_SIZE = 30;

/** Padding between dots */
const DOT_GAP = 6;

/** Strip height including padding */
const STRIP_HEIGHT = DOT_SIZE + 20;

/** Storage key prefix for level progress */
const PROGRESS_KEY_PREFIX = 'level-progress:';

/** Pulse animation CSS */
const PULSE_KEYFRAMES = `
@keyframes mg-level-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 114, 178, 0.5); }
  50% { box-shadow: 0 0 0 6px rgba(0, 114, 178, 0); }
}`;

/** Active instances for cleanup */
const instances = new Set();

/** Injected pulse keyframes (only once) */
let pulseKeyframesInjected = false;

/**
 * Inject pulse animation keyframes into the document
 */
function injectPulseKeyframes() {
  if (pulseKeyframesInjected) return;
  const style = document.createElement('style');
  style.textContent = PULSE_KEYFRAMES;
  document.head.appendChild(style);
  pulseKeyframesInjected = true;
}

/**
 * Get storage key for a game's level progress
 * @param {string} gameId - Game identifier
 * @returns {string}
 */
function getProgressKey(gameId) {
  return `${PROGRESS_KEY_PREFIX}${gameId}`;
}

/**
 * Load level progress from storage
 * @param {string} gameId - Game identifier
 * @returns {Object} Progress map: { levelIndex: 'completed'|'skipped' }
 */
function loadProgress(gameId) {
  return storage.get(getProgressKey(gameId), {});
}

/**
 * Save level progress to storage
 * @param {string} gameId - Game identifier
 * @param {Object} progress - Progress map
 */
function saveProgress(gameId, progress) {
  storage.set(getProgressKey(gameId), progress);
}

/**
 * Get the current level index for a game
 * @param {string} gameId - Game identifier
 * @returns {number} Current level index
 */
function loadCurrentLevel(gameId) {
  return storage.get(`${PROGRESS_KEY_PREFIX}${gameId}:current`, 0);
}

/**
 * Save the current level index for a game
 * @param {string} gameId - Game identifier
 * @param {number} index - Current level index
 */
function saveCurrentLevel(gameId, index) {
  storage.set(`${PROGRESS_KEY_PREFIX}${gameId}:current`, index);
}

/**
 * Create a level navigation strip
 *
 * @param {Object} options - Configuration
 * @param {HTMLElement} options.container - Container element to append strip to
 * @param {string} options.gameId - Game identifier for persistence
 * @param {number} options.totalLevels - Total number of hand-crafted levels
 * @param {boolean} options.hasEndless - Whether endless mode follows hand-crafted levels
 * @param {boolean} options.hasDaily - Whether daily challenge is available
 * @param {boolean} options.dailyCompleted - Whether today's daily is completed
 * @param {Function} options.onLevelSelect - Callback(levelIndex) when a level is selected
 * @param {Function} options.onDailySelect - Callback() when daily challenge is tapped
 * @param {Function} options.onEndlessSelect - Callback() when endless mode is tapped
 * @returns {Object} LevelNav instance
 */
export function createLevelNav(options = {}) {
  const {
    container,
    gameId = 'default',
    totalLevels = 1,
    hasEndless = false,
    hasDaily = false,
    dailyCompleted = false,
    onLevelSelect,
    onDailySelect,
    onEndlessSelect,
  } = options;

  injectPulseKeyframes();

  const progress = loadProgress(gameId);
  const currentLevel = loadCurrentLevel(gameId);

  // Calculate unlocked levels: all up to and including the highest completed + 1
  const maxCompleted = Math.max(
    ...Object.keys(progress)
      .filter(k => progress[k] === 'completed')
      .map(Number),
    -1
  );
  const maxUnlocked = Math.min(maxCompleted + 1, totalLevels - 1);

  // Create strip container
  const strip = document.createElement('div');
  strip.className = 'mg-level-nav';
  strip.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: ${STRIP_HEIGHT}px;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    padding: 0 10px;
    z-index: 500;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    touch-action: pan-x;
  `;

  // Hide scrollbar
  const scrollbarHider = document.createElement('style');
  scrollbarHider.textContent = `
    .mg-level-nav::-webkit-scrollbar { display: none; }
    .mg-level-nav { scrollbar-width: none; }
  `;
  document.head.appendChild(scrollbarHider);

  const dotsContainer = document.createElement('div');
  dotsContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: ${DOT_GAP}px;
    padding: ${DOT_GAP}px 0;
    min-width: min-content;
  `;

  // Daily challenge indicator (left end)
  if (hasDaily) {
    const dailyDot = document.createElement('button');
    dailyDot.className = 'mg-level-dot mg-level-daily';
    dailyDot.setAttribute('aria-label', 'Daily Challenge');
    dailyDot.textContent = '★'; // star
    dailyDot.style.cssText = `
      width: ${DOT_SIZE}px;
      height: ${DOT_SIZE}px;
      border-radius: 50%;
      border: 2px solid ${dailyCompleted ? '#009E73' : '#F0E442'};
      background: ${dailyCompleted ? 'rgba(0, 158, 115, 0.3)' : 'rgba(240, 228, 66, 0.3)'};
      color: ${dailyCompleted ? '#009E73' : '#F0E442'};
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.15s ease;
    `;

    dailyDot.addEventListener('click', () => {
      playTap();
      if (onDailySelect) onDailySelect();
    });

    dotsContainer.appendChild(dailyDot);
  }

  // Level dots
  for (let i = 0; i < totalLevels; i++) {
    const dot = document.createElement('button');
    dot.className = 'mg-level-dot';
    dot.setAttribute('aria-label', `Level ${i + 1}`);
    dot.dataset.level = i;

    const isCompleted = progress[i] === 'completed';
    const isSkipped = progress[i] === 'skipped';
    const isCurrent = i === currentLevel;
    const isLocked = i > maxUnlocked;

    let bg, border, color, content;

    if (isCompleted) {
      bg = 'rgba(0, 158, 115, 0.8)';
      border = '#009E73';
      color = '#FFFFFF';
      content = '\u2713'; // checkmark
    } else if (isCurrent) {
      bg = 'rgba(0, 114, 178, 0.3)';
      border = '#0072B2';
      color = '#0072B2';
      content = String(i + 1);
      dot.style.animation = 'mg-level-pulse 2s infinite';
    } else if (isLocked) {
      bg = 'rgba(100, 100, 100, 0.2)';
      border = 'rgba(100, 100, 100, 0.4)';
      color = 'rgba(100, 100, 100, 0.4)';
      content = String(i + 1);
    } else if (isSkipped) {
      bg = 'transparent';
      border = 'rgba(153, 153, 153, 0.6)';
      color = 'rgba(153, 153, 153, 0.6)';
      content = '\u2013'; // dash
    } else {
      bg = 'transparent';
      border = '#56B4E9';
      color = '#56B4E9';
      content = String(i + 1);
    }

    dot.style.cssText = `
      width: ${DOT_SIZE}px;
      height: ${DOT_SIZE}px;
      border-radius: 50%;
      border: 2px solid ${border};
      background: ${bg};
      color: ${color};
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: ${isLocked ? 'default' : 'pointer'};
      flex-shrink: 0;
      transition: transform 0.15s ease;
      ${isLocked ? 'opacity: 0.5;' : ''}
    `;
    dot.textContent = content;

    if (!isLocked) {
      dot.addEventListener('click', () => {
        playTap();
        if (onLevelSelect) {
          if (isCurrent) {
            onLevelSelect(currentLevel, true); // true = restart
          } else {
            onLevelSelect(i, false);
          }
        }
      });
    }

    dotsContainer.appendChild(dot);
  }

  // Endless mode indicator
  if (hasEndless) {
    const endlessDot = document.createElement('button');
    endlessDot.className = 'mg-level-dot mg-level-endless';
    endlessDot.setAttribute('aria-label', 'Endless Mode');
    endlessDot.textContent = '\u221E'; // infinity symbol
    endlessDot.style.cssText = `
      width: ${DOT_SIZE}px;
      height: ${DOT_SIZE}px;
      border-radius: 50%;
      border: 2px solid #CC79A7;
      background: rgba(204, 121, 167, 0.2);
      color: #CC79A7;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.15s ease;
    `;

    endlessDot.addEventListener('click', () => {
      playTap();
      if (onEndlessSelect) onEndlessSelect();
    });

    dotsContainer.appendChild(endlessDot);
  }

  strip.appendChild(dotsContainer);
  container.appendChild(strip);

  // Auto-scroll to current level
  requestAnimationFrame(() => {
    const currentDot = dotsContainer.querySelector(`[data-level="${currentLevel}"]`);
    if (currentDot) {
      currentDot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  });

  // Build instance
  const instance = {
    strip,
    dotsContainer,
    gameId,
    totalLevels,
    hasEndless,
    hasDaily,

    /**
     * Mark a level as completed and advance
     * @param {number} levelIndex - Level that was completed
     */
    completeLevel(levelIndex) {
      const prog = loadProgress(gameId);
      prog[levelIndex] = 'completed';
      saveProgress(gameId, prog);

      const nextLevel = Math.min(levelIndex + 1, totalLevels - 1);
      saveCurrentLevel(gameId, nextLevel);

      instance.refresh();
    },

    /**
     * Mark a level as skipped
     * @param {number} levelIndex - Level that was skipped
     */
    skipLevel(levelIndex) {
      const prog = loadProgress(gameId);
      prog[levelIndex] = 'skipped';
      saveProgress(gameId, prog);

      const nextLevel = Math.min(levelIndex + 1, totalLevels - 1);
      saveCurrentLevel(gameId, nextLevel);

      instance.refresh();
    },

    /**
     * Set the current level without changing progress
     * @param {number} levelIndex - Level to set as current
     */
    setCurrentLevel(levelIndex) {
      saveCurrentLevel(gameId, levelIndex);
      instance.refresh();
    },

    /**
     * Mark daily challenge as completed
     */
    completeDaily() {
      instance.refresh({ dailyCompleted: true });
    },

    /**
     * Refresh the strip UI
     * @param {Object} overrides - Override options (dailyCompleted, etc.)
     */
    refresh(overrides = {}) {
      // Remove old dots
      while (dotsContainer.firstChild) {
        dotsContainer.removeChild(dotsContainer.firstChild);
      }

      const prog = loadProgress(gameId);
      const cur = loadCurrentLevel(gameId);
      const maxComp = Math.max(
        ...Object.keys(prog)
          .filter(k => prog[k] === 'completed')
          .map(Number),
        -1
      );
      const maxUn = Math.min(maxComp + 1, totalLevels - 1);
      const dailyDone = overrides.dailyCompleted !== undefined
        ? overrides.dailyCompleted
        : dailyCompleted;

      // Rebuild daily dot
      if (hasDaily) {
        const dailyDot = document.createElement('button');
        dailyDot.className = 'mg-level-dot mg-level-daily';
        dailyDot.setAttribute('aria-label', 'Daily Challenge');
        dailyDot.textContent = '★';
        dailyDot.style.cssText = `
          width: ${DOT_SIZE}px;
          height: ${DOT_SIZE}px;
          border-radius: 50%;
          border: 2px solid ${dailyDone ? '#009E73' : '#F0E442'};
          background: ${dailyDone ? 'rgba(0, 158, 115, 0.3)' : 'rgba(240, 228, 66, 0.3)'};
          color: ${dailyDone ? '#009E73' : '#F0E442'};
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: transform 0.15s ease;
        `;
        dailyDot.addEventListener('click', () => {
          playTap();
          if (onDailySelect) onDailySelect();
        });
        dotsContainer.appendChild(dailyDot);
      }

      // Rebuild level dots
      for (let i = 0; i < totalLevels; i++) {
        const dot = document.createElement('button');
        dot.className = 'mg-level-dot';
        dot.setAttribute('aria-label', `Level ${i + 1}`);
        dot.dataset.level = i;

        const isComp = prog[i] === 'completed';
        const isSkip = prog[i] === 'skipped';
        const isCur = i === cur;
        const isLock = i > maxUn;

        let bg, border, color, content;

        if (isComp) {
          bg = 'rgba(0, 158, 115, 0.8)';
          border = '#009E73';
          color = '#FFFFFF';
          content = '\u2713';
        } else if (isCur) {
          bg = 'rgba(0, 114, 178, 0.3)';
          border = '#0072B2';
          color = '#0072B2';
          content = String(i + 1);
          dot.style.animation = 'mg-level-pulse 2s infinite';
        } else if (isLock) {
          bg = 'rgba(100, 100, 100, 0.2)';
          border = 'rgba(100, 100, 100, 0.4)';
          color = 'rgba(100, 100, 100, 0.4)';
          content = String(i + 1);
        } else if (isSkip) {
          bg = 'transparent';
          border = 'rgba(153, 153, 153, 0.6)';
          color = 'rgba(153, 153, 153, 0.6)';
          content = '\u2013';
        } else {
          bg = 'transparent';
          border = '#56B4E9';
          color = '#56B4E9';
          content = String(i + 1);
        }

        dot.style.cssText = `
          width: ${DOT_SIZE}px;
          height: ${DOT_SIZE}px;
          border-radius: 50%;
          border: 2px solid ${border};
          background: ${bg};
          color: ${color};
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: ${isLock ? 'default' : 'pointer'};
          flex-shrink: 0;
          transition: transform 0.15s ease;
          ${isLock ? 'opacity: 0.5;' : ''}
        `;
        dot.textContent = content;

        if (!isLock) {
          dot.addEventListener('click', () => {
            playTap();
            if (onLevelSelect) {
              if (isCur) {
                onLevelSelect(cur, true);
              } else {
                onLevelSelect(i, false);
              }
            }
          });
        }

        dotsContainer.appendChild(dot);
      }

      // Rebuild endless dot
      if (hasEndless) {
        const endlessDot = document.createElement('button');
        endlessDot.className = 'mg-level-dot mg-level-endless';
        endlessDot.setAttribute('aria-label', 'Endless Mode');
        endlessDot.textContent = '\u221E';
        endlessDot.style.cssText = `
          width: ${DOT_SIZE}px;
          height: ${DOT_SIZE}px;
          border-radius: 50%;
          border: 2px solid #CC79A7;
          background: rgba(204, 121, 167, 0.2);
          color: #CC79A7;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: transform 0.15s ease;
        `;
        endlessDot.addEventListener('click', () => {
          playTap();
          if (onEndlessSelect) onEndlessSelect();
        });
        dotsContainer.appendChild(endlessDot);
      }

      // Scroll to current
      requestAnimationFrame(() => {
        const curDot = dotsContainer.querySelector(`[data-level="${cur}"]`);
        if (curDot) {
          curDot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      });
    },

    /**
     * Destroy the level nav and remove from DOM
     */
    destroy() {
      if (strip.parentNode) {
        strip.parentNode.removeChild(strip);
      }
      instances.delete(instance);
    },
  };

  instances.add(instance);
  return instance;
}

/**
 * Get progress data for a game (completed/skipped map)
 * @param {string} gameId - Game identifier
 * @returns {Object} Progress map
 */
export function getLevelProgress(gameId) {
  return loadProgress(gameId);
}

/**
 * Reset all progress for a game
 * @param {string} gameId - Game identifier
 */
export function resetLevelProgress(gameId) {
  storage.delete(getProgressKey(gameId));
  storage.delete(`${PROGRESS_KEY_PREFIX}${gameId}:current`);
}

/**
 * Cleanup all level nav instances
 */
export function cleanupAll() {
  for (const inst of instances) {
    inst.destroy();
  }
  instances.clear();
}
