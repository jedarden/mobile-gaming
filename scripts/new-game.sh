#!/bin/bash
#
# new-game.sh - Game Scaffold Generator
#
# Creates a new game directory with all required files
# Usage: ./scripts/new-game.sh <game-name>
#
# Example:
#   ./scripts/new-game.sh "Color Match"
#   Creates src/games/color-match/
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -lt 1 ]; then
    echo -e "${RED}Error: Missing arguments${NC}"
    echo "Usage: $0 <game-name>"
    echo "Example: $0 \"Color Match\""
    exit 1
fi

GAME_NAME="$1"
# Generate slug from game name (lowercase, hyphens)
GAME_ID=$(echo "$GAME_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
GAME_DIR="src/games/${GAME_ID}"

# Generate PascalCase class name (e.g., "color-match" -> "ColorMatchGame")
GAME_CLASS_NAME=$(echo "$GAME_ID" | sed 's/-\(.\)/\u\1/g' | sed 's/^\(.\)/\u\1/')Game

# Validate game-id format (lowercase, hyphens only)
if [[ ! $GAME_ID =~ ^[a-z]+(-[a-z]+)*$ ]]; then
    echo -e "${RED}Error: Could not generate valid game-id from '$GAME_NAME'${NC}"
    echo "Game ID must be lowercase with hyphens (e.g., color-match)"
    exit 1
fi

# Check if game already exists
if [ -d "$GAME_DIR" ]; then
    echo -e "${RED}Error: Game directory already exists: $GAME_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}Creating new game: ${GAME_NAME} (${GAME_ID})${NC}"
echo ""

# Create directory structure
mkdir -p "$GAME_DIR"
mkdir -p "$GAME_DIR/assets/images"
mkdir -p "$GAME_DIR/assets/audio"
mkdir -p "$GAME_DIR/assets/fonts"

# ============================================
# Create index.html
# ============================================
cat > "$GAME_DIR/index.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${GAME_NAME} - Mobile Gaming</title>

  <!-- PWA Meta Tags -->
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#0f0f23">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="${GAME_NAME}">
  <meta name="description" content="${GAME_NAME} puzzle game">

  <!-- Styles -->
  <link rel="stylesheet" href="../../styles/reset.css">
  <link rel="stylesheet" href="../../styles/variables.css">
  <link rel="stylesheet" href="../../styles/components.css">
  <link rel="stylesheet" href="../../styles/game-shell.css">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a href="../../" class="skip-link">Skip to main content</a>

  <div class="game-container">
    <header class="game-header">
      <a href="../../" class="back-link" aria-label="Back to games">
        <span aria-hidden="true">&larr;</span> Back
      </a>
      <h1>${GAME_NAME}</h1>
      <div class="game-header-controls">
        <button class="game-btn game-btn-icon game-btn-ghost" id="btn-sound" aria-label="Toggle sound" title="Toggle sound">
          <span aria-hidden="true">🔊</span>
        </button>
        <button class="game-btn game-btn-icon game-btn-ghost" id="btn-settings" aria-label="Settings" title="Settings">
          <span aria-hidden="true">⚙️</span>
        </button>
      </div>
    </header>

    <div class="game-stats" role="status" aria-live="polite">
      <div class="game-stat">
        <span class="game-stat-value" id="level-display">1</span>
        <span class="game-stat-label">Level</span>
      </div>
      <div class="game-stat">
        <span class="game-stat-value" id="moves-display">0</span>
        <span class="game-stat-label">Moves</span>
      </div>
      <div class="game-stat">
        <span class="game-stat-value" id="score-display">0</span>
        <span class="game-stat-label">Score</span>
      </div>
    </div>

    <main id="main-content" class="game-board" role="main">
      <canvas id="game-canvas" aria-label="${GAME_NAME} game board"></canvas>
    </main>

    <div class="game-controls">
      <button class="game-btn game-btn-secondary" id="btn-undo" disabled aria-label="Undo last move">
        <span aria-hidden="true">↩</span> Undo
      </button>
      <button class="game-btn game-btn-secondary" id="btn-hint" aria-label="Get hint">
        <span aria-hidden="true">💡</span> Hint
      </button>
      <button class="game-btn game-btn-secondary" id="btn-restart" aria-label="Restart level">
        <span aria-hidden="true">🔄</span> Restart
      </button>
    </div>

    <!-- Level Navigation -->
    <div class="level-nav">
      <button class="game-btn game-btn-ghost" id="btn-prev" aria-label="Previous level">
        <span aria-hidden="true">◀</span> Prev
      </button>
      <span id="level-progress" class="level-progress">Level 1 / 10</span>
      <button class="game-btn game-btn-ghost" id="btn-next" aria-label="Next level">
        Next <span aria-hidden="true">▶</span>
      </button>
    </div>
  </div>

  <!-- Win Overlay -->
  <div class="game-overlay" id="win-overlay" role="dialog" aria-labelledby="win-title" aria-hidden="true">
    <div class="game-overlay-content">
      <h2 class="game-overlay-title win" id="win-title">Level Complete!</h2>
      <div class="stars-display" id="stars-display" aria-label="Rating">
        <span class="star" aria-hidden="true">⭐</span>
        <span class="star" aria-hidden="true">⭐</span>
        <span class="star" aria-hidden="true">⭐</span>
      </div>
      <p class="stats-summary" id="stats-summary">Completed in 5 moves!</p>
      <div class="overlay-buttons">
        <button class="game-btn game-btn-secondary" id="btn-replay">Replay</button>
        <button class="game-btn game-btn-primary" id="btn-next-level">Next Level</button>
      </div>
    </div>
  </div>

  <!-- Settings Modal -->
  <div class="game-overlay" id="settings-overlay" role="dialog" aria-labelledby="settings-title" aria-hidden="true">
    <div class="game-overlay-content settings-content">
      <h2 id="settings-title">Settings</h2>
      <div class="settings-group">
        <label class="setting-item">
          <span>Sound Effects</span>
          <input type="checkbox" id="setting-sound" checked>
        </label>
        <label class="setting-item">
          <span>Haptic Feedback</span>
          <input type="checkbox" id="setting-haptic" checked>
        </label>
        <label class="setting-item">
          <span>Reduced Motion</span>
          <input type="checkbox" id="setting-motion">
        </label>
      </div>
      <button class="game-btn game-btn-primary" id="btn-close-settings">Close</button>
    </div>
  </div>

  <script type="module" src="main.js"></script>
</body>
</html>
EOF

# ============================================
# Create main.js (entry point)
# ============================================
cat > "$GAME_DIR/main.js" << EOF
/**
 * ${GAME_NAME} - Main Entry Point
 *
 * Initializes and orchestrates the game:
 * - Loads levels and saved progress
 * - Sets up renderer, input, and state
 * - Manages game loop and UI updates
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete, getLevelInfo } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { getDailyChallenge, completeDailyChallenge, getGameDailySeed } from '../../shared/daily.js';
import { createRNG } from '../../shared/rng.js';

import { createInitialState, cloneState, checkWin, getHint, calculateStars, createHistory } from './state.js';
import { createRenderer } from './renderer.js';
import { createInputHandler } from './input.js';

// Game constants
const GAME_ID = '${GAME_ID}';
const LEVELS_URL = './levels.json';

class ${GAME_CLASS_NAME} {
  constructor() {
    // DOM elements
    this.canvas = document.getElementById('game-canvas');
    this.levelDisplay = document.getElementById('level-display');
    this.movesDisplay = document.getElementById('moves-display');
    this.scoreDisplay = document.getElementById('score-display');
    this.levelProgress = document.getElementById('level-progress');

    // Buttons
    this.btnUndo = document.getElementById('btn-undo');
    this.btnHint = document.getElementById('btn-hint');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnPrev = document.getElementById('btn-prev');
    this.btnNext = document.getElementById('btn-next');
    this.btnSound = document.getElementById('btn-sound');
    this.btnSettings = document.getElementById('btn-settings');

    // Overlays
    this.winOverlay = document.getElementById('win-overlay');
    this.settingsOverlay = document.getElementById('settings-overlay');

    // Game state
    this.levels = [];
    this.currentLevelIndex = 0;
    this.state = null;
    this.history = createHistory(50);
    this.renderer = null;
    this.input = null;

    // Daily challenge
    this.isDailyMode = false;
    this.dailySeed = null;

    // Bind methods
    this.handleResize = this.handleResize.bind(this);
  }

  /**
   * Initialize the game
   */
  async init() {
    try {
      // Initialize storage and accessibility
      await initStorage();
      initAccessibility();

      // Load levels
      await this.loadLevels();

      // Create renderer and input handler
      this.renderer = createRenderer(this.canvas);
      this.renderer.setReducedMotion(isReducedMotionEnabled());
      this.input = createInputHandler(this.canvas, this.renderer);

      // Check for daily mode
      const urlParams = new URLSearchParams(window.location.search);
      this.isDailyMode = urlParams.get('daily') === 'true';

      if (this.isDailyMode) {
        this.dailySeed = getGameDailySeed(GAME_ID);
        this.generateDailyLevel();
      }

      // Load saved progress
      this.loadProgress();

      // Setup event listeners
      this.setupEventListeners();

      // Start game
      this.startLevel(this.currentLevelIndex);

      console.log('${GAME_NAME} initialized');
    } catch (error) {
      console.error('Failed to initialize ${GAME_NAME}:', error);
    }
  }

  /**
   * Load levels from JSON
   */
  async loadLevels() {
    try {
      const response = await fetch(LEVELS_URL);
      this.levels = await response.json();
    } catch (error) {
      console.error('Failed to load levels:', error);
      // Fallback to embedded level
      this.levels = [this.getDefaultLevel()];
    }
  }

  /**
   * Get default fallback level
   */
  getDefaultLevel() {
    return {
      id: 1,
      difficulty: 0.1,
      optimal: 3,
      // TODO: Add game-specific level structure
    };
  }

  /**
   * Generate daily challenge level
   */
  generateDailyLevel() {
    const rng = createRNG(this.dailySeed);
    // TODO: Implement daily level generation
    this.levels = [this.getDefaultLevel()];
  }

  /**
   * Load saved progress
   */
  loadProgress() {
    const stats = getGameStats(GAME_ID);
    this.currentLevelIndex = Math.min(stats.lastLevel || 0, this.levels.length - 1);
  }

  /**
   * Save progress
   */
  async saveProgress() {
    await updateGameStats(GAME_ID, {
      lastLevel: this.currentLevelIndex
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Input events
    this.input.on('click', (pos) => this.handleClick(pos));
    this.input.on('move', (pos) => this.handleMove(pos));

    // Window resize
    window.addEventListener('resize', this.handleResize);

    // Buttons
    this.btnUndo.addEventListener('click', () => this.undo());
    this.btnHint.addEventListener('click', () => this.showHint());
    this.btnRestart.addEventListener('click', () => this.restartLevel());
    this.btnPrev.addEventListener('click', () => this.prevLevel());
    this.btnNext.addEventListener('click', () => this.nextLevel());
    this.btnSound.addEventListener('click', () => this.toggleSound());
    this.btnSettings.addEventListener('click', () => this.showSettings());

    // Win overlay buttons
    document.getElementById('btn-replay').addEventListener('click', () => {
      this.hideWinOverlay();
      this.restartLevel();
    });
    document.getElementById('btn-next-level').addEventListener('click', () => {
      this.hideWinOverlay();
      this.nextLevel();
    });

    // Settings overlay
    document.getElementById('btn-close-settings').addEventListener('click', () => {
      this.hideSettings();
    });

    // Settings checkboxes
    document.getElementById('setting-sound').addEventListener('change', (e) => {
      updateSettings({ soundEnabled: e.target.checked });
    });

    document.getElementById('setting-haptic').addEventListener('change', (e) => {
      updateSettings({ hapticEnabled: e.target.checked });
    });

    document.getElementById('setting-motion').addEventListener('change', (e) => {
      updateSettings({ reducedMotion: e.target.checked, reducedMotionSetByUser: true });
      this.renderer.setReducedMotion(e.target.checked);
    });
  }

  /**
   * Start a level
   */
  startLevel(index) {
    if (index < 0 || index >= this.levels.length) return;

    this.currentLevelIndex = index;
    const level = this.levels[index];

    // Create initial state
    this.state = createInitialState(level);
    this.history.clear();
    this.history.push(cloneState(this.state));

    // Resize and render
    this.handleResize();
    this.updateUI();

    // Announce for screen readers
    announce(\`Level \${index + 1} started.\`);
  }

  /**
   * Restart current level
   */
  restartLevel() {
    this.startLevel(this.currentLevelIndex);
  }

  /**
   * Handle click/tap input
   */
  handleClick(pos) {
    if (this.state.won) return;

    // TODO: Implement click handling
    console.log('Click at:', pos);

    // Check win
    if (checkWin(this.state)) {
      this.handleWin();
    }
  }

  /**
   * Handle move/hover input
   */
  handleMove(pos) {
    if (this.state.won) return;

    // TODO: Implement move handling for previews, etc.
  }

  /**
   * Handle win condition
   */
  async handleWin() {
    this.state.won = true;
    const level = this.levels[this.currentLevelIndex];
    const stars = calculateStars(this.state.moves, level.optimal);

    // Update stats
    await updateGameStats(GAME_ID, {
      played: 1,
      completed: 1,
      stars: stars
    });

    // Award XP
    await awardLevelComplete(GAME_ID, stars, { moves: this.state.moves });

    // Save progress
    await this.saveProgress();

    // Show win overlay
    this.showWinOverlay(stars);

    announce(\`Level complete! \${this.state.moves} moves. \${stars} stars!\`);
  }

  /**
   * Show win overlay
   */
  showWinOverlay(stars) {
    const starsDisplay = document.getElementById('stars-display');
    const starElements = starsDisplay.querySelectorAll('.star');

    starElements.forEach((star, i) => {
      star.classList.toggle('filled', i < stars);
    });

    document.getElementById('stats-summary').textContent =
      \`Completed in \${this.state.moves} moves!\`;

    this.winOverlay.classList.add('active');
    this.winOverlay.setAttribute('aria-hidden', 'false');
  }

  /**
   * Hide win overlay
   */
  hideWinOverlay() {
    this.winOverlay.classList.remove('active');
    this.winOverlay.setAttribute('aria-hidden', 'true');
  }

  /**
   * Undo last move
   */
  undo() {
    if (!this.history.canUndo()) return;

    const prevState = this.history.undo();
    if (prevState) {
      this.state = prevState;
      this.updateUI();
      this.render();
    }
  }

  /**
   * Show hint
   */
  showHint() {
    const hint = getHint(this.state);
    if (hint) {
      console.log('Hint:', hint.message);
      announce(hint.message);
    }
  }

  /**
   * Previous level
   */
  prevLevel() {
    if (this.currentLevelIndex > 0) {
      this.startLevel(this.currentLevelIndex - 1);
    }
  }

  /**
   * Next level
   */
  nextLevel() {
    if (this.currentLevelIndex < this.levels.length - 1) {
      this.startLevel(this.currentLevelIndex + 1);
    }
  }

  /**
   * Toggle sound
   */
  toggleSound() {
    const settings = getSettings();
    updateSettings({ soundEnabled: !settings.soundEnabled });
    this.btnSound.innerHTML = !settings.soundEnabled
      ? '<span aria-hidden="true">🔊</span>'
      : '<span aria-hidden="true">🔇</span>';
  }

  /**
   * Show settings
   */
  showSettings() {
    const settings = getSettings();
    document.getElementById('setting-sound').checked = settings.soundEnabled;
    document.getElementById('setting-haptic').checked = settings.hapticEnabled;
    document.getElementById('setting-motion').checked = settings.reducedMotion;

    this.settingsOverlay.classList.add('active');
    this.settingsOverlay.setAttribute('aria-hidden', 'false');
  }

  /**
   * Hide settings
   */
  hideSettings() {
    this.settingsOverlay.classList.remove('active');
    this.settingsOverlay.setAttribute('aria-hidden', 'true');
  }

  /**
   * Handle window resize
   */
  handleResize() {
    if (this.state) {
      this.renderer.resize(this.state);
      this.render();
    }
  }

  /**
   * Render the game
   */
  render() {
    if (this.state && this.renderer) {
      this.renderer.render(this.state);
    }
  }

  /**
   * Update UI elements
   */
  updateUI() {
    this.levelDisplay.textContent = this.isDailyMode ? 'Daily' : this.currentLevelIndex + 1;
    this.movesDisplay.textContent = this.state.moves;
    this.scoreDisplay.textContent = this.state.score || 0;

    const levelText = this.isDailyMode
      ? 'Daily Challenge'
      : \`Level \${this.currentLevelIndex + 1} / \${this.levels.length}\`;
    this.levelProgress.textContent = levelText;

    // Update buttons
    this.btnUndo.disabled = !this.history.canUndo();
    this.btnPrev.disabled = this.currentLevelIndex === 0;
    this.btnNext.disabled = this.currentLevelIndex >= this.levels.length - 1;
  }
}

// Initialize game on load
document.addEventListener('DOMContentLoaded', () => {
  const game = new ${GAME_CLASS_NAME}();
  game.init();
});

export { ${GAME_CLASS_NAME} };
export default ${GAME_CLASS_NAME};
EOF

# ============================================
# Create state.js (core logic stub)
# ============================================
cat > "$GAME_DIR/state.js" << EOF
/**
 * ${GAME_NAME} - State Management
 *
 * Manages game state including:
 * - Level data and progress
 * - Move validation and execution
 * - Win condition checking
 * - State cloning for undo/redo
 */

import { History } from '../../shared/history.js';

/**
 * Create initial game state from level data
 */
export function createInitialState(level) {
  return {
    level: level.id,
    difficulty: level.difficulty,
    moves: 0,
    score: 0,
    won: false,
    // TODO: Add game-specific state properties
  };
}

/**
 * Clone state for history (undo/redo)
 */
export function cloneState(state) {
  return {
    ...state,
    // TODO: Deep clone any nested objects/arrays
  };
}

/**
 * Check win condition
 */
export function checkWin(state) {
  // TODO: Implement win condition logic
  return false;
}

/**
 * Get hint for current state
 */
export function getHint(state) {
  // TODO: Implement hint system
  return {
    type: 'info',
    message: 'No hints available yet'
  };
}

/**
 * Calculate stars based on performance
 */
export function calculateStars(moves, optimal) {
  if (moves <= optimal) return 3;
  if (moves <= optimal * 1.5) return 2;
  return 1;
}

/**
 * Create history manager for undo/redo
 */
export function createHistory(maxDepth = 50) {
  return new History(maxDepth);
}

export default {
  createInitialState,
  cloneState,
  checkWin,
  getHint,
  calculateStars,
  createHistory
};
EOF

# ============================================
# Create renderer.js (canvas stub)
# ============================================
cat > "$GAME_DIR/renderer.js" << EOF
/**
 * ${GAME_NAME} - Canvas Renderer
 *
 * Renders the game board with:
 * - Game elements
 * - Animations
 * - Visual feedback
 */

/**
 * Create a renderer instance
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let reducedMotion = false;

  /**
   * Resize canvas to fit container
   */
  function resize(state) {
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();

    // TODO: Calculate dimensions based on game needs
    const padding = 20;
    width = containerRect.width - padding * 2;
    height = containerRect.height - padding * 2;

    // Set canvas size with device pixel ratio
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = \`\${width}px\`;
    canvas.style.height = \`\${height}px\`;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    return { width, height };
  }

  /**
   * Convert screen coordinates to game coordinates
   */
  function screenToGame(x, y) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: x - rect.left,
      y: y - rect.top
    };
  }

  /**
   * Clear the canvas
   */
  function clear() {
    ctx.clearRect(0, 0, width, height);
  }

  /**
   * Draw the full game state
   */
  function render(state) {
    clear();

    // Draw background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // TODO: Implement game-specific rendering

    // Draw placeholder text
    ctx.fillStyle = '#666';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Game board - implement renderer.js', width / 2, height / 2);
  }

  /**
   * Set reduced motion preference
   */
  function setReducedMotion(value) {
    reducedMotion = value;
  }

  return {
    resize,
    render,
    clear,
    screenToGame,
    setReducedMotion,
    get width() { return width; },
    get height() { return height; }
  };
}

export default { createRenderer };
EOF

# ============================================
# Create input.js (input handling stub)
# ============================================
cat > "$GAME_DIR/input.js" << EOF
/**
 * ${GAME_NAME} - Input Handler
 *
 * Handles user input:
 * - Mouse clicks and drags
 * - Touch events
 * - Keyboard shortcuts
 */

/**
 * Create an input handler
 */
export function createInputHandler(canvas, renderer) {
  const listeners = {
    click: [],
    move: [],
    keydown: []
  };

  let isDragging = false;
  let dragStart = null;

  /**
   * Emit an event to all listeners
   */
  function emit(event, data) {
    listeners[event].forEach(callback => callback(data));
  }

  /**
   * Handle mouse/touch start
   */
  function handleStart(e) {
    e.preventDefault();

    const pos = getEventPosition(e);
    isDragging = true;
    dragStart = pos;

    emit('click', pos);
  }

  /**
   * Handle mouse/touch move
   */
  function handleMove(e) {
    const pos = getEventPosition(e);

    if (isDragging) {
      emit('drag', { start: dragStart, current: pos });
    } else {
      emit('move', pos);
    }
  }

  /**
   * Handle mouse/touch end
   */
  function handleEnd(e) {
    if (isDragging && dragStart) {
      const pos = getEventPosition(e);
      emit('dragend', { start: dragStart, end: pos });
    }

    isDragging = false;
    dragStart = null;
  }

  /**
   * Get position from mouse or touch event
   */
  function getEventPosition(e) {
    const rect = canvas.getBoundingClientRect();

    if (e.touches && e.touches.length > 0) {
      return renderer.screenToGame(e.touches[0].clientX, e.touches[0].clientY);
    }

    return renderer.screenToGame(e.clientX, e.clientY);
  }

  /**
   * Handle keyboard input
   */
  function handleKeyDown(e) {
    emit('keydown', { key: e.key, ctrl: e.ctrlKey, meta: e.metaKey });

    // Keyboard shortcuts
    switch (e.key) {
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          emit('undo', {});
        }
        break;
      case 'r':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          emit('restart', {});
        }
        break;
      case 'h':
        emit('hint', {});
        break;
      case 'Escape':
        emit('cancel', {});
        break;
    }
  }

  // Setup event listeners
  canvas.addEventListener('click', handleStart);
  canvas.addEventListener('mousedown', handleStart);
  canvas.addEventListener('mousemove', handleMove);
  canvas.addEventListener('mouseup', handleEnd);
  canvas.addEventListener('mouseleave', handleEnd);

  // Touch events
  canvas.addEventListener('touchstart', handleStart, { passive: false });
  canvas.addEventListener('touchmove', handleMove, { passive: false });
  canvas.addEventListener('touchend', handleEnd);

  // Keyboard
  document.addEventListener('keydown', handleKeyDown);

  return {
    /**
     * Register an event listener
     */
    on(event, callback) {
      if (listeners[event]) {
        listeners[event].push(callback);
      }
    },

    /**
     * Remove an event listener
     */
    off(event, callback) {
      if (listeners[event]) {
        const index = listeners[event].indexOf(callback);
        if (index !== -1) {
          listeners[event].splice(index, 1);
        }
      }
    }
  };
}

export default { createInputHandler };
EOF

# ============================================
# Create styles.css
# ============================================
cat > "$GAME_DIR/styles.css" << EOF
/**
 * ${GAME_NAME} - Game-specific Styles
 *
 * Custom styles for the ${GAME_NAME} puzzle game
 */

/* Game Board Canvas */
#game-canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
  border-radius: var(--radius-lg);
  cursor: pointer;
  touch-action: none;
}

/* Level Navigation */
.level-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  margin-top: var(--space-3);
}

.level-progress {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  font-weight: 500;
}

/* Stars Display */
.stars-display {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  margin: var(--space-4) 0;
}

.stars-display .star {
  font-size: 2rem;
  transition: transform 0.3s ease, opacity 0.3s ease;
  opacity: 0.3;
}

.stars-display .star.filled {
  opacity: 1;
  transform: scale(1.1);
}

/* Stats Summary */
.stats-summary {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-4);
}

/* Overlay Buttons */
.overlay-buttons {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

/* Settings Content */
.settings-content {
  min-width: 280px;
}

.settings-group {
  margin-bottom: var(--space-4);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-bg-card);
  cursor: pointer;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item input[type="checkbox"] {
  width: 20px;
  height: 20px;
  accent-color: var(--color-brand-primary);
}

/* Add game-specific styles below */
EOF

# ============================================
# Create levels.json (empty)
# ============================================
cat > "$GAME_DIR/levels.json" << EOF
[
  {
    "id": 1,
    "difficulty": 0.1,
    "optimal": 3,
    "_comment": "TODO: Add game-specific level structure"
  },
  {
    "id": 2,
    "difficulty": 0.2,
    "optimal": 4,
    "_comment": "TODO: Add game-specific level structure"
  },
  {
    "id": 3,
    "difficulty": 0.3,
    "optimal": 5,
    "_comment": "TODO: Add game-specific level structure"
  }
]
EOF

# ============================================
# Create generator.js (stub)
# ============================================
cat > "$GAME_DIR/generator.js" << EOF
/**
 * ${GAME_NAME} - Level Generator
 *
 * Procedurally generates levels:
 * - Daily challenges
 * - Endless mode levels
 * - Difficulty scaling
 */

import { createRNG } from '../../shared/rng.js';

/**
 * Generate a level based on seed and difficulty
 * @param {string|number} seed - Random seed for reproducibility
 * @param {number} difficulty - Difficulty level (0-1)
 * @returns {object} Generated level data
 */
export function generateLevel(seed, difficulty = 0.5) {
  const rng = createRNG(seed);

  const level = {
    id: typeof seed === 'string' ? seed : \`generated-\${seed}\`,
    difficulty,
    optimal: Math.floor(3 + difficulty * 10),
    // TODO: Add game-specific level generation
  };

  return level;
}

/**
 * Generate a batch of levels for progression
 * @param {number} count - Number of levels to generate
 * @param {number} startDifficulty - Starting difficulty (0-1)
 * @param {number} endDifficulty - Ending difficulty (0-1)
 * @returns {array} Array of generated levels
 */
export function generateLevelBatch(count, startDifficulty = 0.1, endDifficulty = 1.0) {
  const levels = [];

  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1);
    const difficulty = startDifficulty + (endDifficulty - startDifficulty) * progress;
    const seed = \`level-\${i + 1}\`;

    levels.push(generateLevel(seed, difficulty));
  }

  return levels;
}

/**
 * Validate a level is solvable
 * @param {object} level - Level to validate
 * @returns {boolean} Whether the level is solvable
 */
export function validateLevel(level) {
  // TODO: Implement level validation/solvability check
  return true;
}

export default {
  generateLevel,
  generateLevelBatch,
  validateLevel
};
EOF

# ============================================
# Create README.md
# ============================================
cat > "$GAME_DIR/README.md" << EOF
# ${GAME_NAME}

A puzzle game for the Mobile Gaming platform.

## Game Overview

TODO: Describe the game mechanics and objective.

## Files

- \`main.js\` - Entry point, game orchestration
- \`state.js\` - State management, move validation, win conditions
- \`renderer.js\` - Canvas rendering and animations
- \`input.js\` - User input handling (mouse, touch, keyboard)
- \`styles.css\` - Game-specific styles
- \`levels.json\` - Level definitions
- \`generator.js\` - Procedural level generation

## Next Steps

1. **Define Game Mechanics**
   - What is the player's goal?
   - How does the player interact with the game?
   - What makes a move valid or invalid?

2. **Implement State Management** (\`state.js\`)
   - Define state structure
   - Implement move validation
   - Implement win condition check
   - Add hint generation

3. **Implement Rendering** (\`renderer.js\`)
   - Draw game board
   - Draw game pieces/elements
   - Add animations
   - Handle responsive sizing

4. **Implement Input Handling** (\`input.js\`)
   - Handle clicks/taps
   - Handle drag gestures (if needed)
   - Add keyboard shortcuts

5. **Create Levels** (\`levels.json\`)
   - Design level structure
   - Create initial levels (10-30)
   - Test and balance difficulty

6. **Add Audio** (optional)
   - Create \`audio.js\` module
   - Add sound effects
   - Add background music (optional)

7. **Polish**
   - Add particle effects
   - Add UI animations
   - Test on mobile devices
   - Add haptic feedback

## Level Format

TODO: Document the level JSON structure.

\`\`\`json
{
  "id": 1,
  "difficulty": 0.1,
  "optimal": 3,
  "TODO": "Add game-specific properties"
}
\`\`\`

## Shared Modules

The game uses these shared modules from \`src/shared/\`:

- \`storage.js\` - Save/load progress and settings
- \`history.js\` - Undo/redo functionality
- \`accessibility.js\` - Screen reader announcements
- \`rng.js\` - Seeded random number generator
- \`meta.js\` - XP and achievements
- \`daily.js\` - Daily challenges

## Testing

Open the game in a browser:

\`\`\`
http://localhost:5173/src/games/${GAME_ID}/
\`\`\`

## Assets

Place game assets in the \`assets/\` subdirectories:

- \`assets/images/\` - PNG/SVG images
- \`assets/audio/\` - MP3/OGG audio files
- \`assets/fonts/\` - Custom fonts (if needed)
EOF

# Remove .gitkeep if it exists
rm -f "$GAME_DIR/.gitkeep"

# Summary
echo -e "${GREEN}✓ Created game scaffold at $GAME_DIR${NC}"
echo ""
echo -e "${YELLOW}Files created:${NC}"
echo "  - $GAME_DIR/index.html       (Game HTML page)"
echo "  - $GAME_DIR/main.js          (Entry point)"
echo "  - $GAME_DIR/state.js         (State management)"
echo "  - $GAME_DIR/renderer.js      (Canvas renderer)"
echo "  - $GAME_DIR/input.js         (Input handler)"
echo "  - $GAME_DIR/styles.css       (Game styles)"
echo "  - $GAME_DIR/levels.json      (Level definitions)"
echo "  - $GAME_DIR/generator.js     (Level generator)"
echo "  - $GAME_DIR/README.md        (Documentation)"
echo "  - $GAME_DIR/assets/images/   (Image assets)"
echo "  - $GAME_DIR/assets/audio/    (Audio assets)"
echo "  - $GAME_DIR/assets/fonts/    (Font assets)"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Read $GAME_DIR/README.md"
echo "  2. Define game mechanics in state.js"
echo "  3. Implement rendering in renderer.js"
echo "  4. Add levels to levels.json"
echo "  5. Test at: http://localhost:5173/$GAME_DIR/"
