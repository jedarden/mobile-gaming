/**
 * Game lifecycle management
 *
 * Handles loading states, pause/resume, and error boundaries.
 * Integrates with audio and canvas modules.
 */

import { suspendAudio, resumeAudio } from './audio.js';
import { set as storageSet } from './storage.js';

// State tracking
let currentState = 'loading';
let rafId = null;
let loadingOverlay = null;
let resumeOverlay = null;
let errorOverlay = null;
let canvasContainer = null;
let gameStateSaveCallback = null;
let gameStateRestoreCallback = null;
let onPauseCallback = null;
let onResumeCallback = null;
// Whether to install the global window error/unhandledrejection boundary on ready()
let installErrorBoundary = true;

/**
 * Initialize lifecycle system
 * Should be called once when the game starts
 *
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.container - Container element for overlays
 * @param {Function} options.onSave - Callback to save game state
 * @param {Function} options.onRestore - Callback to restore game state
 * @param {Function} options.onPause - Callback to freeze the game's own RAF/scene loop
 * @param {Function} options.onResume - Callback to restart the game's own RAF/scene loop
 * @param {boolean} [options.loadingOverlay=true] - Create the loading overlay
 * @param {boolean} [options.errorBoundary=true] - Install the global error boundary on ready()
 */
export function initLifecycle(options = {}) {
  canvasContainer = options.container || document.body;
  gameStateSaveCallback = options.onSave;
  gameStateRestoreCallback = options.onRestore;
  onPauseCallback = options.onPause || null;
  onResumeCallback = options.onResume || null;
  installErrorBoundary = options.errorBoundary !== false;

  // Create overlays (resume overlay is always created — it is the pause UI;
  // loading/error overlays are optional so games can opt out)
  _createOverlays({
    loading: options.loadingOverlay !== false,
    error: options.errorBoundary !== false,
  });
}

/**
 * Create overlay elements
 *
 * @param {Object} opts - Which overlays to create
 * @param {boolean} opts.loading - Create the loading overlay
 * @param {boolean} opts.error - Create the error overlay
 */
function _createOverlays({ loading = true, error = true } = {}) {
  // Loading overlay
  if (loading) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'mg-loading';
    loadingOverlay.className = 'mg-overlay';
    loadingOverlay.innerHTML = `
      <div class="mg-spinner"></div>
      <div class="mg-loading-text">Loading...</div>
    `;
    loadingOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: var(--mg-bg, #1a1a2e); display: flex;
      flex-direction: column; align-items: center; justify-content: center;
      z-index: 1000; transition: opacity 0.3s ease;
    `;
    canvasContainer.appendChild(loadingOverlay);
  }

  // Resume overlay
  resumeOverlay = document.createElement('div');
  resumeOverlay.id = 'mg-resume';
  resumeOverlay.className = 'mg-overlay mg-hidden';
  resumeOverlay.innerHTML = `
    <div class="mg-resume-content">
      <div class="mg-resume-icon">⏸</div>
      <div class="mg-resume-text">Paused</div>
      <button class="mg-resume-btn">Tap to Continue</button>
    </div>
  `;
  resumeOverlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.8); display: flex;
    align-items: center; justify-content: center;
    z-index: 999; opacity: 0; pointer-events: none;
    transition: opacity 0.2s ease;
  `;
  canvasContainer.appendChild(resumeOverlay);

  // Error overlay
  if (error) {
    errorOverlay = document.createElement('div');
    errorOverlay.id = 'mg-error';
    errorOverlay.className = 'mg-overlay mg-hidden';
    errorOverlay.innerHTML = `
      <div class="mg-error-content">
        <div class="mg-error-icon">⚠️</div>
        <div class="mg-error-text">Something went wrong</div>
        <button class="mg-error-btn">Restart Game</button>
      </div>
    `;
    errorOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.9); display: flex;
      align-items: center; justify-content: center;
      z-index: 1001; opacity: 0; pointer-events: none;
      transition: opacity 0.3s ease;
    `;
    canvasContainer.appendChild(errorOverlay);
  }

  // Resume button handler
  resumeOverlay.querySelector('.mg-resume-btn').addEventListener('click', resume);
}

/**
 * Mark the game as ready (crossfade from loading)
 * Call this when your game is fully initialized
 */
export function ready() {
  currentState = 'running';

  if (loadingOverlay) {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      if (loadingOverlay.parentNode) {
        loadingOverlay.style.display = 'none';
      }
    }, 300);
  }

  // Setup error boundary
  if (installErrorBoundary) {
    _setupErrorBoundary();
  }
}

/**
 * Setup global error handling
 */
function _setupErrorBoundary() {
  window.addEventListener('error', (e) => {
    handleError(e.error || new Error(e.message));
  });

  window.addEventListener('unhandledrejection', (e) => {
    handleError(e.reason || new Error('Unhandled promise rejection'));
  });
}

/**
 * Pause the game
 * Saves state, freezes RAF, suspends audio
 */
export function pause() {
  if (currentState !== 'running') return;

  currentState = 'paused';

  // Save game state
  if (gameStateSaveCallback) {
    try {
      gameStateSaveCallback();
    } catch (e) {
      console.warn('Failed to save game state on pause:', e);
    }
  }

  // Cancel any pending RAF
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Suspend audio
  suspendAudio();

  // Show resume overlay
  if (resumeOverlay) {
    resumeOverlay.style.opacity = '1';
    resumeOverlay.style.pointerEvents = 'auto';
  }

  // Freeze the game's own RAF/scene loop
  if (onPauseCallback) {
    try {
      onPauseCallback();
    } catch (e) {
      console.warn('onPause callback failed:', e);
    }
  }
}

/**
 * Show the resume overlay (call when page becomes visible again)
 */
export function showResumeOverlay() {
  if (currentState === 'running') {
    pause();
  }
}

/**
 * Resume the game
 * Restarts RAF, resumes audio
 */
export function resume() {
  if (currentState !== 'paused') return;

  currentState = 'running';

  // Hide resume overlay
  if (resumeOverlay) {
    resumeOverlay.style.opacity = '0';
    resumeOverlay.style.pointerEvents = 'none';
  }

  // Resume audio (needs user interaction)
  resumeAudio();

  // Restore game state if needed
  if (gameStateRestoreCallback) {
    try {
      gameStateRestoreCallback();
    } catch (e) {
      console.warn('Failed to restore game state:', e);
    }
  }

  // Restart the game's own RAF/scene loop
  if (onResumeCallback) {
    try {
      onResumeCallback();
    } catch (e) {
      console.warn('onResume callback failed:', e);
    }
  }
}

/**
 * Handle an error
 * Shows error overlay with restart option
 *
 * @param {Error} error - The error that occurred
 */
export function handleError(error) {
  console.error('Game error:', error);

  currentState = 'error';

  // Cancel RAF
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Show error overlay
  if (errorOverlay) {
    errorOverlay.style.opacity = '1';
    errorOverlay.style.pointerEvents = 'auto';

    const restartBtn = errorOverlay.querySelector('.mg-error-btn');
    restartBtn.onclick = () => {
      window.location.reload();
    };
  }
}

/**
 * Get current lifecycle state
 * @returns {string} State: 'loading', 'running', 'paused', 'error'
 */
export function getState() {
  return currentState;
}

/**
 * Check if game is currently running
 * @returns {boolean}
 */
export function isRunning() {
  return currentState === 'running';
}

/**
 * Check if game is paused
 * @returns {boolean}
 */
export function isPaused() {
  return currentState === 'paused';
}

/**
 * Wrapper for requestAnimationFrame that tracks the ID
 * Call this instead of window.requestAnimationFrame
 *
 * @param {Function} callback - Frame callback
 * @returns {number} RAF ID
 */
export function requestAnimationFrame(callback) {
  if (currentState !== 'running') {
    return null;
  }

  rafId = window.requestAnimationFrame((time) => {
    if (currentState === 'running') {
      callback(time);
    }
  });

  return rafId;
}

/**
 * Cancel the tracked RAF
 */
export function cancelTrackedRAF() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

/**
 * Setup page visibility handler for auto-pause
 * Call this to enable automatic pause/resume on tab switching
 */
export function setupVisibilityHandler() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause();
    } else {
      showResumeOverlay();
    }
  });
}

/**
 * Setup page visibility handler for untimed puzzle games.
 *
 * Puzzle games have no game clock, so backgrounding cannot advance state and
 * no resume overlay is needed (per plan). On hide we only persist the current
 * in-progress state (via the provided onSave callback, typically writing to
 * shared/storage.js) so it survives mobile tab eviction. On return to the tab
 * the player simply continues — nothing is shown.
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onSave - Callback to persist current state when hidden
 */
export function setupPuzzleVisibilityHandler(options = {}) {
  const onSave = options.onSave;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && typeof onSave === 'function') {
      try {
        onSave();
      } catch (e) {
        console.warn('Failed to persist puzzle state on hide:', e);
      }
    }
  });
}

/**
 * Cleanup lifecycle resources
 */
export function cleanup() {
  if (loadingOverlay && loadingOverlay.parentNode) {
    loadingOverlay.parentNode.removeChild(loadingOverlay);
  }
  if (resumeOverlay && resumeOverlay.parentNode) {
    resumeOverlay.parentNode.removeChild(resumeOverlay);
  }
  if (errorOverlay && errorOverlay.parentNode) {
    errorOverlay.parentNode.removeChild(errorOverlay);
  }

  cancelTrackedRAF();
}
