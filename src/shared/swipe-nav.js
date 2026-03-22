/**
 * Swipe Navigation Between Games
 *
 * Swipe left/right to switch games directly without returning to hub.
 *
 * Features:
 * - Edge-initiated swipe (within 40px of screen edge) OR two-finger horizontal swipe
 * - 80px horizontal displacement + velocity > 0.5px/ms threshold
 * - 300ms ease-out transition animation
 * - Adjacent game preloading for fast transitions
 * - State preservation via localStorage
 * - Game ring indicator with tap-to-jump
 */

import { storage } from './storage.js';

// Configuration
const CONFIG = {
  edgeThreshold: 40,      // Pixels from edge to trigger edge swipe
  swipeThreshold: 80,     // Minimum horizontal displacement
  velocityThreshold: 0.5, // Minimum velocity (px/ms)
  transitionDuration: 300 // Transition animation duration (ms)
};

// Storage key for game ring order
const GAME_RING_KEY = 'gameRing';
const GAME_STATE_KEY = 'gameState';

// Default game ring order (matches hub display order)
const DEFAULT_GAME_RING = [
  { id: 'pull-the-pin', title: 'Pull the Pin', icon: 'pin' },
  { id: 'water-sort', title: 'Water Sort', icon: 'droplet' },
  { id: 'brain-teaser', title: 'Brain Teaser', icon: 'brain' },
  { id: 'save-the-character', title: 'Save the Character', icon: 'character' },
  { id: 'bus-jam', title: 'Bus Jam', icon: 'bus' },
  { id: 'jelly-shift', title: 'Jelly Shift', icon: 'jelly' },
  { id: 'giant-runner', title: 'Giant Runner', icon: 'giant' },
  { id: 'crowd-runner', title: 'Crowd Runner', icon: 'crowd' },
  { id: 'bridge-race', title: 'Bridge Race', icon: 'bridge' },
  { id: 'makeover-run', title: 'Makeover Run', icon: 'makeover' }
];

// State - lazy-initialized on first access to avoid module-load-time storage calls
let gameRing = null;
let currentGameIndex = 0;
let isTransitioning = false;
let gestureState = null;
let indicatorElement = null;
let cleanupCallbacks = [];

/**
 * Initialize swipe navigation
 *
 * @param {Object} options - Configuration options
 * @param {string} options.currentGameId - Current game identifier
 * @param {HTMLElement} options.container - Container element for game canvas
 * @param {Function} options.onSaveState - Callback to save current game state
 * @param {Function} options.onLoadGame - Callback to load a new game
 * @param {Function} options.onRestoreState - Callback to restore game state
 * @returns {Function} Cleanup function
 */
export function initSwipeNav(options = {}) {
  const {
    currentGameId,
    container = document.body,
    onSaveState,
    onLoadGame,
    onRestoreState
  } = options;

  // Load game ring order
  gameRing = loadGameRing();
  currentGameIndex = gameRing.findIndex(g => g.id === currentGameId);
  if (currentGameIndex === -1) currentGameIndex = 0;

  // Create indicator
  indicatorElement = createIndicator(container);

  // Setup gesture detection
  const gestureCleanup = setupGestureDetection(container, {
    onSwipeStart: (direction) => handleSwipeStart(direction, { onSaveState }),
    onSwipeMove: (dx, progress) => handleSwipeMove(dx, progress),
    onSwipeEnd: (direction, velocity) => handleSwipeEnd(direction, velocity, { onLoadGame, onRestoreState }),
    onSwipeCancel: () => handleSwipeCancel()
  });

  cleanupCallbacks.push(gestureCleanup);

  // Preload adjacent games
  preloadAdjacentGames();

  // Return cleanup function
  return () => {
    cleanupCallbacks.forEach(cb => cb());
    cleanupCallbacks = [];
    if (indicatorElement && indicatorElement.parentNode) {
      indicatorElement.parentNode.removeChild(indicatorElement);
    }
  };
}

/**
 * Load game ring order from storage
 * @returns {Array} Game ring array
 */
export function loadGameRing() {
  const stored = storage.get(GAME_RING_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    // Merge stored order with default (in case new games added)
    const storedIds = new Set(stored.map(g => g.id));
    const newGames = DEFAULT_GAME_RING.filter(g => !storedIds.has(g.id));
    return [...stored, ...newGames];
  }
  return [...DEFAULT_GAME_RING];
}

/**
 * Save game ring order to storage
 * @param {Array} ring - Game ring array
 */
export function saveGameRing(ring) {
  storage.set(GAME_RING_KEY, ring);
  gameRing = ring;
}

/**
 * Get current game ring
 * @returns {Array} Game ring array
 */
export function getGameRing() {
  if (!gameRing) gameRing = loadGameRing();
  return [...gameRing];
}

/**
 * Get adjacent game indices (with wrap-around)
 * @param {number} index - Current index
 * @returns {Object} { left, right } indices
 */
export function getAdjacentIndices(index) {
  if (!gameRing) gameRing = loadGameRing();
  const len = gameRing.length;
  return {
    left: (index - 1 + len) % len,
    right: (index + 1) % len
  };
}

/**
 * Preload adjacent games using modulepreload
 */
function preloadAdjacentGames() {
  const { left, right } = getAdjacentIndices(currentGameIndex);

  [left, right].forEach(idx => {
    const game = gameRing[idx];
    if (!game) return;

    // Check if already preloaded
    const existingPreload = document.querySelector(
      `link[rel="modulepreload"][href*="/${game.id}/game.js"]`
    );
    if (existingPreload) return;

    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = `/src/games/${game.id}/game.js`;
    document.head.appendChild(link);
  });
}

/**
 * Create game ring indicator element
 * @param {HTMLElement} container - Container element
 * @returns {HTMLElement} Indicator element
 */
function createIndicator(container) {
  const indicator = document.createElement('div');
  indicator.id = 'swipe-nav-indicator';
  indicator.className = 'swipe-nav-indicator';
  indicator.setAttribute('role', 'tablist');
  indicator.setAttribute('aria-label', 'Game navigation');

  // Create inner strip
  const strip = document.createElement('div');
  strip.className = 'swipe-nav-strip';

  // Create game icons
  gameRing.forEach((game, idx) => {
    const btn = document.createElement('button');
    btn.className = 'swipe-nav-icon';
    btn.dataset.gameId = game.id;
    btn.dataset.index = idx;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-label', game.title);
    btn.setAttribute('aria-selected', idx === currentGameIndex ? 'true' : 'false');

    // Icon placeholder (colored circle)
    const iconInner = document.createElement('span');
    iconInner.className = 'swipe-nav-icon-inner';
    iconInner.textContent = game.title.charAt(0);
    btn.appendChild(iconInner);

    // Progress indicator
    const progress = document.createElement('span');
    progress.className = 'swipe-nav-progress';
    btn.appendChild(progress);

    // Tap to jump
    btn.addEventListener('click', () => handleIconTap(idx));

    strip.appendChild(btn);
  });

  indicator.appendChild(strip);
  container.appendChild(indicator);

  // Update current game highlighting
  updateIndicatorHighlight();

  // Inject styles if not already present
  injectStyles();

  return indicator;
}

/**
 * Update indicator highlighting
 */
function updateIndicatorHighlight() {
  if (!indicatorElement) return;

  const icons = indicatorElement.querySelectorAll('.swipe-nav-icon');
  icons.forEach((icon, idx) => {
    const isSelected = idx === currentGameIndex;
    icon.classList.toggle('active', isSelected);
    icon.setAttribute('aria-selected', isSelected ? 'true' : 'false');

    // Check for saved state
    const hasState = hasSavedState(gameRing[idx].id);
    icon.classList.toggle('has-progress', hasState);
  });

  // Scroll active icon into view
  const activeIcon = indicatorElement.querySelector('.swipe-nav-icon.active');
  if (activeIcon && activeIcon.scrollIntoView) {
    activeIcon.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

/**
 * Handle icon tap
 * @param {number} targetIndex - Target game index
 */
function handleIconTap(targetIndex) {
  if (isTransitioning || targetIndex === currentGameIndex) return;

  // Navigate directly to game
  const game = gameRing[targetIndex];
  window.location.href = `/${game.id}/`;
}

/**
 * Inject CSS styles for indicator
 */
function injectStyles() {
  if (document.getElementById('swipe-nav-styles')) return;

  const style = document.createElement('style');
  style.id = 'swipe-nav-styles';
  style.textContent = `
    .swipe-nav-indicator {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 32px;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 100;
      display: flex;
      align-items: center;
      padding: 0 8px;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .swipe-nav-indicator::-webkit-scrollbar {
      display: none;
    }
    .swipe-nav-strip {
      display: flex;
      gap: 8px;
      padding: 4px 0;
    }
    .swipe-nav-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: none;
      background: rgba(255, 255, 255, 0.3);
      cursor: pointer;
      position: relative;
      flex-shrink: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease, background 0.2s ease;
    }
    .swipe-nav-icon:hover {
      transform: scale(1.1);
    }
    .swipe-nav-icon.active {
      background: #fff;
      transform: scale(1.2);
    }
    .swipe-nav-icon.active .swipe-nav-icon-inner {
      color: #333;
    }
    .swipe-nav-icon-inner {
      font-size: 10px;
      font-weight: bold;
      color: rgba(255, 255, 255, 0.9);
      pointer-events: none;
    }
    .swipe-nav-progress {
      position: absolute;
      bottom: -2px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #4ecdc4;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .swipe-nav-icon.has-progress .swipe-nav-progress {
      opacity: 1;
    }
    .swipe-nav-transition-container {
      position: fixed;
      top: 32px;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: hidden;
      z-index: 99;
    }
    .swipe-nav-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      transition: transform 0.3s ease-out;
      will-change: transform;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Setup gesture detection for swipe navigation
 *
 * @param {HTMLElement} element - Element to listen on
 * @param {Object} callbacks - Callback functions
 * @returns {Function} Cleanup function
 */
function setupGestureDetection(element, callbacks) {
  const {
    onSwipeStart,
    onSwipeMove,
    onSwipeEnd,
    onSwipeCancel
  } = callbacks;

  gestureState = {
    isActive: false,
    isSwipe: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
    touchCount: 0,
    direction: null,
    isEdgeSwipe: false
  };

  const getEventCoords = (e) => {
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        count: e.touches.length
      };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY,
        count: 1
      };
    }
    return {
      x: e.clientX,
      y: e.clientY,
      count: 1
    };
  };

  const handleStart = (e) => {
    const coords = getEventCoords(e);
    const rect = element.getBoundingClientRect();

    gestureState = {
      isActive: true,
      isSwipe: false,
      startX: coords.x - rect.left,
      startY: coords.y - rect.top,
      currentX: coords.x - rect.left,
      currentY: coords.y - rect.top,
      startTime: Date.now(),
      touchCount: coords.count,
      direction: null,
      isEdgeSwipe: false
    };

    // Check for edge swipe
    const screenWidth = rect.width;
    if (gestureState.startX <= CONFIG.edgeThreshold) {
      gestureState.isEdgeSwipe = true;
      gestureState.direction = 'right'; // Swipe from left edge = go right
    } else if (gestureState.startX >= screenWidth - CONFIG.edgeThreshold) {
      gestureState.isEdgeSwipe = true;
      gestureState.direction = 'left'; // Swipe from right edge = go left
    }
  };

  const handleMove = (e) => {
    if (!gestureState.isActive) return;

    const coords = getEventCoords(e);
    const rect = element.getBoundingClientRect();

    gestureState.currentX = coords.x - rect.left;
    gestureState.currentY = coords.y - rect.top;
    gestureState.touchCount = coords.count;

    const dx = gestureState.currentX - gestureState.startX;
    const dy = gestureState.currentY - gestureState.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Check if horizontal swipe is dominant
    const isHorizontal = absDx > absDy && absDx > 20;

    // Determine if this should trigger navigation
    // Either: edge swipe OR two-finger horizontal swipe
    const shouldTrigger = gestureState.isEdgeSwipe ||
      (gestureState.touchCount >= 2 && isHorizontal);

    if (shouldTrigger && absDx > 10) {
      // Update direction based on movement
      if (dx > 0) {
        gestureState.direction = 'left'; // Swipe right = go to previous (left) game
      } else {
        gestureState.direction = 'right'; // Swipe left = go to next (right) game
      }

      if (!gestureState.isSwipe) {
        gestureState.isSwipe = true;
        onSwipeStart(gestureState.direction);
      }

      const progress = Math.min(absDx / CONFIG.swipeThreshold, 1);
      onSwipeMove(dx, progress);

      // Prevent in-game gesture handling
      e.preventDefault();
    }
  };

  const handleEnd = (e) => {
    if (!gestureState.isActive) return;

    const dx = gestureState.currentX - gestureState.startX;
    const duration = Date.now() - gestureState.startTime;
    const velocity = Math.abs(dx) / duration; // px/ms

    if (gestureState.isSwipe) {
      // Check if threshold met
      if (Math.abs(dx) >= CONFIG.swipeThreshold && velocity >= CONFIG.velocityThreshold) {
        onSwipeEnd(gestureState.direction, velocity);
      } else {
        onSwipeCancel();
      }
    }

    gestureState.isActive = false;
    gestureState.isSwipe = false;
  };

  const handleCancel = () => {
    if (gestureState.isSwipe) {
      onSwipeCancel();
    }
    gestureState.isActive = false;
    gestureState.isSwipe = false;
  };

  // Add event listeners
  element.addEventListener('mousedown', handleStart, { passive: true });
  element.addEventListener('mousemove', handleMove, { passive: false });
  element.addEventListener('mouseup', handleEnd, { passive: true });
  element.addEventListener('mouseleave', handleCancel, { passive: true });

  element.addEventListener('touchstart', handleStart, { passive: true });
  element.addEventListener('touchmove', handleMove, { passive: false });
  element.addEventListener('touchend', handleEnd, { passive: true });
  element.addEventListener('touchcancel', handleCancel, { passive: true });

  // Return cleanup function
  return () => {
    element.removeEventListener('mousedown', handleStart);
    element.removeEventListener('mousemove', handleMove);
    element.removeEventListener('mouseup', handleEnd);
    element.removeEventListener('mouseleave', handleCancel);
    element.removeEventListener('touchstart', handleStart);
    element.removeEventListener('touchmove', handleMove);
    element.removeEventListener('touchend', handleEnd);
    element.removeEventListener('touchcancel', handleCancel);
  };
}

/**
 * Handle swipe start
 * @param {string} direction - Swipe direction
 * @param {Object} options - Options
 */
function handleSwipeStart(direction, { onSaveState }) {
  if (isTransitioning) return;

  // Save current game state
  if (onSaveState) {
    const state = onSaveState();
    if (state) {
      saveGameState(gameRing[currentGameIndex].id, state);
    }
  }

  // Start preloading adjacent game state
  const { left, right } = getAdjacentIndices(currentGameIndex);
  const targetIndex = direction === 'left' ? left : right;
  const targetGame = gameRing[targetIndex];

  if (targetGame) {
    // Signal that we're preparing to switch
    document.dispatchEvent(new CustomEvent('swipenav:prepare', {
      detail: { gameId: targetGame.id, direction }
    }));
  }
}

/**
 * Handle swipe move
 * @param {number} dx - Horizontal displacement
 * @param {number} progress - Progress (0-1)
 */
function handleSwipeMove(dx, progress) {
  if (isTransitioning) return;

  // Update indicator scroll position
  if (indicatorElement) {
    const strip = indicatorElement.querySelector('.swipe-nav-strip');
    if (strip) {
      const iconWidth = 32; // 24px icon + 8px gap
      strip.style.transform = `translateX(${dx * 0.3}px)`;
    }
  }

  // Dispatch progress event
  document.dispatchEvent(new CustomEvent('swipenav:progress', {
    detail: { dx, progress }
  }));
}

/**
 * Handle swipe end
 * @param {string} direction - Swipe direction
 * @param {number} velocity - Swipe velocity
 * @param {Object} options - Options
 */
function handleSwipeEnd(direction, velocity, { onLoadGame, onRestoreState }) {
  if (isTransitioning) return;

  isTransitioning = true;

  // Determine target game
  const { left, right } = getAdjacentIndices(currentGameIndex);
  const targetIndex = direction === 'left' ? left : right;
  const targetGame = gameRing[targetIndex];

  if (!targetGame) {
    isTransitioning = false;
    return;
  }

  // Dispatch navigation event
  document.dispatchEvent(new CustomEvent('swipenav:navigate', {
    detail: {
      fromGameId: gameRing[currentGameIndex].id,
      toGameId: targetGame.id,
      direction,
      velocity
    }
  }));

  // Navigate to target game
  // In a full SPA implementation, we'd do in-page transitions
  // For now, we navigate to the game URL
  setTimeout(() => {
    window.location.href = `/${targetGame.id}/`;
  }, 50);
}

/**
 * Handle swipe cancel
 */
function handleSwipeCancel() {
  // Reset indicator position
  if (indicatorElement) {
    const strip = indicatorElement.querySelector('.swipe-nav-strip');
    if (strip) {
      strip.style.transform = '';
    }
  }

  // Dispatch cancel event
  document.dispatchEvent(new CustomEvent('swipenav:cancel'));

  isTransitioning = false;
}

/**
 * Save game state to storage
 * @param {string} gameId - Game identifier
 * @param {Object} state - Game state to save
 */
export function saveGameState(gameId, state) {
  const allStates = storage.get(GAME_STATE_KEY, {});
  allStates[gameId] = {
    state,
    timestamp: Date.now()
  };
  storage.set(GAME_STATE_KEY, allStates);
}

/**
 * Get saved game state from storage
 * @param {string} gameId - Game identifier
 * @returns {Object|null} Saved state or null
 */
export function getSavedGameState(gameId) {
  const allStates = storage.get(GAME_STATE_KEY, {});
  const saved = allStates[gameId];
  return saved ? saved.state : null;
}

/**
 * Check if a game has saved state
 * @param {string} gameId - Game identifier
 * @returns {boolean} True if saved state exists
 */
export function hasSavedState(gameId) {
  const allStates = storage.get(GAME_STATE_KEY, {});
  return gameId in allStates;
}

/**
 * Clear saved game state
 * @param {string} gameId - Game identifier
 */
export function clearSavedGameState(gameId) {
  const allStates = storage.get(GAME_STATE_KEY, {});
  delete allStates[gameId];
  storage.set(GAME_STATE_KEY, allStates);
}

/**
 * Get current game index
 * @returns {number} Current game index
 */
export function getCurrentGameIndex() {
  return currentGameIndex;
}

/**
 * Set current game index
 * @param {number} index - New index
 */
export function setCurrentGameIndex(index) {
  currentGameIndex = index;
  updateIndicatorHighlight();
}

/**
 * Check if currently transitioning
 * @returns {boolean} True if transitioning
 */
export function isSwipeNavTransitioning() {
  return isTransitioning;
}

/**
 * Detect edge swipe from event
 * @param {HTMLElement} element - Element to check against
 * @param {Event} event - Touch/mouse event
 * @param {number} threshold - Edge threshold in pixels
 * @returns {Object|null} { isEdge, side: 'left'|'right' } or null
 */
export function detectEdgeSwipe(element, event, threshold = CONFIG.edgeThreshold) {
  const rect = element.getBoundingClientRect();
  let clientX;

  if (event.touches && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
  } else if (event.changedTouches && event.changedTouches.length > 0) {
    clientX = event.changedTouches[0].clientX;
  } else {
    clientX = event.clientX;
  }

  const x = clientX - rect.left;

  if (x <= threshold) {
    return { isEdge: true, side: 'left' };
  }
  if (x >= rect.width - threshold) {
    return { isEdge: true, side: 'right' };
  }

  return null;
}

/**
 * Check if event is a two-finger horizontal swipe
 * @param {Event} event - Touch event
 * @returns {boolean} True if two-finger horizontal swipe
 */
export function isTwoFingerHorizontalSwipe(event) {
  if (!event.touches || event.touches.length < 2) {
    return false;
  }

  // This is called during move, so we check if we have 2+ fingers
  return event.touches.length >= 2;
}

/**
 * Reorder game in ring
 * @param {number} fromIndex - Source index
 * @param {number} toIndex - Target index
 */
export function reorderGame(fromIndex, toIndex) {
  if (!gameRing) gameRing = loadGameRing();
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= gameRing.length) return;
  if (toIndex < 0 || toIndex >= gameRing.length) return;

  const [game] = gameRing.splice(fromIndex, 1);
  gameRing.splice(toIndex, 0, game);

  // Update current index if needed
  if (currentGameIndex === fromIndex) {
    currentGameIndex = toIndex;
  } else if (fromIndex < currentGameIndex && toIndex >= currentGameIndex) {
    currentGameIndex--;
  } else if (fromIndex > currentGameIndex && toIndex <= currentGameIndex) {
    currentGameIndex++;
  }

  saveGameRing(gameRing);
  updateIndicatorHighlight();
}

// Export config for testing
export { CONFIG };
