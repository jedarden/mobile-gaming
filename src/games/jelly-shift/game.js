/**
 * Jelly Shift - Main Game Logic
 *
 * Orchestrates the Jelly Shift auto-runner game with:
 * - Game state management
 * - Three.js rendering
 * - User input handling (drag to reshape)
 * - Wall collision detection
 * - Level progression
 * - Integration with shared systems
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { initSwipeNav, saveGameState, getSavedGameState } from '../../shared/swipe-nav.js';

import {
  createInitialState,
  advance,
  reshape,
  checkAllCollisions,
  passWall,
  failWall,
  isGameOver,
  calculateStars
} from './state.js';

import { createRenderer } from './renderer.js';
import { createInput } from './input.js';
import { haptic } from '../../shared/haptics.js';

const GAME_ID   = 'jelly-shift';
const LEVELS_URL = './levels.json';
const FIXED_DT   = 1 / 60;

class JellyShiftGame {
  constructor() {
    // DOM elements
    this.container = document.getElementById('game-container');
    this.scoreDisplay = document.getElementById('score-display');
    this.speedDisplay = document.getElementById('speed-display');
    this.levelProgress = document.getElementById('level-progress');

    // Buttons
    this.btnRestart = document.getElementById('btn-restart');
    this.btnPrev = document.getElementById('btn-prev');
    this.btnNext = document.getElementById('btn-next');
    this.btnSettings = document.getElementById('btn-settings');

    // Overlays
    this.winOverlay = document.getElementById('win-overlay');
    this.settingsOverlay = document.getElementById('settings-overlay');

    // Game state
    this.levels = [];
    this.currentLevelIndex = 0;
    this.state = null;
    this.renderer = null;
    this.input = null;

    // Game loop
    this.lastTime = 0;
    this.accumulator = 0;
    this.animationId = null;
    this.isRunning = false;

    // Swipe navigation cleanup
    this.cleanupSwipeNav = null;
  }

  /**
   * Initialize the game
   */
  async init() {
    try {
      await initStorage();
      initAccessibility();

      await this.loadLevels();

      this.renderer = createRenderer(this.container);
      this.renderer.init();
      this.renderer.setReducedMotion(isReducedMotionEnabled());

      this.input = createInput({
        element: this.renderer.canvas,
        onReshape: (widthDelta) => this.handleReshape(widthDelta)
      });
      this.input.init();

      this.loadProgress();
      this.setupEventListeners();

      // Initialize swipe navigation
      this.cleanupSwipeNav = initSwipeNav({
        currentGameId: GAME_ID,
        container: document.body,
        onSaveState: () => this.getStateForSwipeNav(),
        onLoadGame: (gameId) => this.handleSwipeNavLoad(gameId),
        onRestoreState: (state) => this.restoreStateFromSwipeNav(state)
      });

      // Check for saved state from swipe navigation
      const savedState = getSavedGameState(GAME_ID);
      if (savedState) {
        this.restoreStateFromSwipeNav(savedState);
      }

      this.startLevel(this.currentLevelIndex);

      console.log('Jelly Shift initialized');
    } catch (error) {
      console.error('Failed to initialize Jelly Shift:', error);
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
      speed: 2.0,
      walls: [
        { z: 30, hole: { shape: 'tall', width: 1.0, height: 1.0 } },
        { z: 60, hole: { shape: 'wide', width: 1.0, height: 1.0 } },
        { z: 90, hole: { shape: 'tall', width: 0.7, height: 1.43 } },
        { z: 120, hole: { shape: 'wide', width: 1.43, height: 0.7 } }
      ]
    };
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
    window.addEventListener('resize', this.handleResize.bind(this));

    this.btnRestart.addEventListener('click', () => this.restartLevel());
    this.btnPrev.addEventListener('click', () => this.prevLevel());
    this.btnNext.addEventListener('click', () => this.nextLevel());
    this.btnSettings.addEventListener('click', () => this.showSettings());

    document.getElementById('btn-replay').addEventListener('click', () => {
      this.hideWinOverlay();
      this.restartLevel();
    });
    document.getElementById('btn-next-level').addEventListener('click', () => {
      this.hideWinOverlay();
      this.nextLevel();
    });

    document.getElementById('btn-close-settings').addEventListener('click', () => {
      this.hideSettings();
    });

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

    this.state = createInitialState(level);

    this.lastTime = 0;
    this.accumulator = 0;
    this.isRunning = true;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.animationId = requestAnimationFrame(this.gameLoop.bind(this));

    this.handleResize();
    this.updateUI();

    announce(`Level ${index + 1} started. Drag up and down to reshape the jelly blob!`);
  }

  /**
   * Main game loop
   */
  gameLoop(timestamp) {
    if (!this.isRunning) return;

    if (this.lastTime === 0) {
      this.lastTime = timestamp;
    }
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    // Process keyboard input
    if (this.input) {
      this.input.processKeys(dt);
    }

    // Fixed timestep physics
    this.accumulator += dt;

    while (this.accumulator >= FIXED_DT && this.state && !isGameOver(this.state)) {
      this.state = advance(this.state, FIXED_DT);

      // Check wall collisions
      const collisions = checkAllCollisions(this.state);
      for (const collision of collisions) {
        if (collision.result === 'pass') {
          this.state = passWall(this.state, collision.wallIdx);
          const wall = this.state.walls[collision.wallIdx];
          const holeColor = wall.hole.shape === 'tall' ? 0x4ecdc4
            : wall.hole.shape === 'wide' ? 0xff6b6b : 0xffd93d;
          this.renderer.triggerSquish();
          haptic('tap');
          this.renderer.spawnParticles(
            { x: 0, y: 0, z: wall.z },
            holeColor
          );
        } else if (collision.result === 'fail') {
          this.state = failWall(this.state);
          this.renderer.triggerSplat();
          haptic('fail');
        }
      }

      this.accumulator -= FIXED_DT;
    }

    // Check game end
    if (this.state && isGameOver(this.state)) {
      this.handleGameEnd();
    }

    // Render
    if (this.state) {
      this.renderer.render(this.state, dt);
      this.updateUI();
    }

    if (this.isRunning) {
      this.animationId = requestAnimationFrame(this.gameLoop.bind(this));
    }
  }

  /**
   * Handle reshape input
   */
  handleReshape(widthDelta) {
    if (!this.state || isGameOver(this.state)) return;
    this.state = reshape(this.state, widthDelta);
  }

  /**
   * Handle game end
   */
  async handleGameEnd() {
    this.isRunning = false;

    if (this.state.status === 'won') {
      const stars = calculateStars(this.state);

      // Continue rendering for a moment to show completion
      setTimeout(async () => {
        await updateGameStats(GAME_ID, {
          played: 1,
          completed: 1,
          stars: stars
        });

        await awardLevelComplete(GAME_ID, stars, {
          wallsPassed: this.state.wallsPassed,
          finalScore: this.state.score
        });

        await this.saveProgress();

        haptic('win');
        this.showWinOverlay(stars);
        announce(`Level Complete! ${stars} stars! Score: ${this.state.score}`);
      }, 500);
    } else {
      setTimeout(() => {
        this.showLoseOverlay();
        announce(`Splat! You hit wall ${this.state.wallsPassed + 1}. Score: ${this.state.score}`);
      }, 1000);
    }
  }

  /**
   * Restart current level
   */
  restartLevel() {
    this.startLevel(this.currentLevelIndex);
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
   * Handle window resize
   */
  handleResize() {
    const rect = this.container.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
    if (this.state) {
      this.renderer.render(this.state);
    }
  }

  /**
   * Update UI elements
   */
  updateUI() {
    if (!this.state) return;

    this.scoreDisplay.textContent = this.state.score;
    this.speedDisplay.textContent = this.state.speed.toFixed(1);
    this.levelProgress.textContent = `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;

    this.btnPrev.disabled = this.currentLevelIndex === 0;
    this.btnNext.disabled = this.currentLevelIndex >= this.levels.length - 1;
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
      `Score: ${this.state.score} | Walls: ${this.state.wallsPassed}/${this.state.totalWalls}`;

    this.winOverlay.classList.add('active');
    this.winOverlay.setAttribute('aria-hidden', 'false');
  }

  /**
   * Show lose overlay
   */
  showLoseOverlay() {
    const title = document.getElementById('win-title');
    title.textContent = 'Splat!';
    title.classList.remove('win');
    title.classList.add('lose');

    document.getElementById('stats-summary').textContent =
      `Score: ${this.state.score} | Walls: ${this.state.wallsPassed}/${this.state.totalWalls}`;

    document.getElementById('btn-next-level').style.display = 'none';

    this.winOverlay.classList.add('active');
    this.winOverlay.setAttribute('aria-hidden', 'false');
  }

  /**
   * Hide win overlay
   */
  hideWinOverlay() {
    this.winOverlay.classList.remove('active');
    this.winOverlay.setAttribute('aria-hidden', 'true');

    const title = document.getElementById('win-title');
    title.textContent = 'Level Complete!';
    title.classList.remove('lose');
    title.classList.add('win');
    document.getElementById('btn-next-level').style.display = '';
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
   * Destroy the game
   */
  destroy() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.input) {
      this.input.destroy();
    }
    if (this.renderer) {
      this.renderer.destroy();
    }
    if (this.cleanupSwipeNav) {
      this.cleanupSwipeNav();
    }
  }

  /**
   * Get current state for swipe navigation
   */
  getStateForSwipeNav() {
    if (!this.state) return null;
    return {
      levelIndex: this.currentLevelIndex,
      score: this.state.score,
      speed: this.state.speed,
      wallsPassed: this.state.wallsPassed,
      blobShape: {
        width: this.state.blob.width,
        height: this.state.blob.height
      }
    };
  }

  /**
   * Restore state from swipe navigation
   */
  restoreStateFromSwipeNav(savedState) {
    if (!savedState) return;
    this.currentLevelIndex = savedState.levelIndex || 0;
    // State will be restored when startLevel is called
  }

  /**
   * Handle swipe navigation load (navigate to another game)
   */
  handleSwipeNavLoad(_gameId) {
    // Save current state before navigating away
    const state = this.getStateForSwipeNav();
    if (state) {
      saveGameState(GAME_ID, state);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const game = new JellyShiftGame();
  game.init();
});

export { JellyShiftGame };
export default JellyShiftGame;
