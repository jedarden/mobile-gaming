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
import { initLifecycle, setupVisibilityHandler, pause, showResumeOverlay, resume, ready } from '../../shared/lifecycle.js';
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
import { playSound, setSoundEnabled, resumeAudio } from '../../shared/audio.js';
import { recordLevel } from '../../shared/adaptive.js';
import { createRetryOverlay, ResultType } from '../../shared/retry.js';
import { quickShare, generateShareText } from '../../shared/share.js';
import { getGameDailySeed, getGameDailyNumericSeed, completeDailyChallenge } from '../../shared/daily.js';
import { generateLevel } from './generator.js';

const GAME_ID   = 'jelly-shift';
const LEVELS_URL = './levels.json';
const FIXED_DT   = 1 / 60;
const STATE_KEY  = `mg:${GAME_ID}:state`;

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

    // Daily challenge mode (reachable via ?daily=true)
    this.isDailyMode = false;
    this.dailySeed = null;
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

    // Shared win/loss retry overlay (created per level)
    this.retryOverlay = null;
    this.lastStars = 0;
  }

  /**
   * Initialize the game
   */
  async init() {
    try {
      await initStorage();
      initAccessibility();

      // Gate synthesized SFX on the persisted sound setting
      setSoundEnabled(getSettings().soundEnabled);

      // Initialize lifecycle system
      initLifecycle({
        container: this.container,
        onSave: () => this.saveGameStateForPause(),
        onRestore: () => this.restoreGameStateFromPause(),
        onPause: () => this.pauseGame(),
        onResume: () => this.resumeGame(),
        loadingOverlay: true,
        errorBoundary: true
      });

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

      // Setup visibility handler for auto-pause on tab switch
      setupVisibilityHandler();

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

      // Daily challenge mode (?daily=true) — build today's seeded level.
      const urlParams = new URLSearchParams(window.location.search);
      this.isDailyMode = urlParams.get('daily') === 'true';
      if (this.isDailyMode) {
        this.dailySeed = getGameDailySeed(GAME_ID);
        this.generateDailyLevel();
      }

      this.startLevel(this.currentLevelIndex);

      // Mark game as ready
      ready();

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
   * Build today's daily-challenge level from the seeded generator and make it
   * the only level (currentLevelIndex reset to 0).
   */
  generateDailyLevel() {
    const level = generateLevel(this.dailySeed);
    if (level) {
      this.levels = [level];
      this.currentLevelIndex = 0;
    } else {
      // Generator produced nothing solvable for today's seed; fall back to a
      // deterministic bundled level so the daily is identical for everyone.
      const idx = getGameDailyNumericSeed(GAME_ID) % this.levels.length;
      this.levels = [this.levels[idx]];
      this.currentLevelIndex = 0;
    }
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
      setSoundEnabled(e.target.checked);
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

    this.levelStartTime = Date.now();
    if (index !== this.currentLevelIndex) this.levelRetries = 0;
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

    this.initRetryOverlay(index);

    this.handleResize();
    this.updateUI();

    announce(`Level ${index + 1} started. Drag up and down to reshape the jelly blob!`);
  }

  /**
   * (Re)create the shared win/loss retry overlay for the given level.
   * A fresh instance per level scopes the persisted failure count to
   * gameId:levelIndex.
   */
  initRetryOverlay(index) {
    if (this.retryOverlay) this.retryOverlay.destroy();
    this.retryOverlay = createRetryOverlay({
      container: document.body,
      gameId: GAME_ID,
      levelIndex: index,
      onRetry: () => this.restartLevel(),
      onNext: () => this.nextLevel(),
      onSkip: () => this.nextLevel(),
      onHint: () => this.restartLevel(),
      onShare: (stats) => {
        quickShare({
          title: 'Jelly Shift',
          text: generateShareText({
            gameName: 'Jelly Shift',
            stars: stats.stars,
          }),
          url: window.location.href,
        });
      },
    });
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
          // Wall-pass SFX (gated by the shared soundEnabled setting)
          playSound('bounce');
          this.renderer.spawnParticles(
            { x: 0, y: 0, z: wall.z },
            holeColor
          );
        } else if (collision.result === 'fail') {
          this.state = failWall(this.state);
          this.renderer.triggerSplat();
          haptic('fail');
          // Wall-fail SFX (gated by the shared soundEnabled setting)
          playSound('fail');
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
    // First reshape gesture unlocks the AudioContext for SFX
    resumeAudio();
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
        recordLevel(GAME_ID, { retryCount: this.levelRetries || 0, solveTime: Date.now() - (this.levelStartTime || Date.now()) }, { won: true });
        await updateGameStats(GAME_ID, {
          played: 1,
          completed: 1,
          stars: stars
        });

        await awardLevelComplete(GAME_ID, stars, {
          wallsPassed: this.state.wallsPassed,
          finalScore: this.state.score
        });

        if (this.isDailyMode) completeDailyChallenge(GAME_ID);

        await this.saveProgress();

        haptic('win');
        this.lastStars = stars;
        this.retryOverlay.show(ResultType.WIN, { stars });
        announce(`Level Complete! ${stars} stars! Score: ${this.state.score}`);
      }, 500);
    } else {
      setTimeout(() => {
        recordLevel(GAME_ID, { retryCount: this.levelRetries || 0, solveTime: Date.now() - (this.levelStartTime || Date.now()) }, { won: false });
        this.retryOverlay.show(ResultType.LOSS, {});
        announce(`Splat! You hit wall ${this.state.wallsPassed + 1}. Score: ${this.state.score}`);
      }, 1000);
    }
  }

  /**
   * Restart current level
   */
  restartLevel() {
    this.levelRetries = (this.levelRetries || 0) + 1;
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
    this.levelProgress.textContent = this.isDailyMode
      ? 'Daily Challenge'
      : `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;

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

  /**
   * Save current game state for lifecycle pause/resume
   * Persists level index, level retry count, and current run state
   */
  saveGameStateForPause() {
    try {
      const gameState = {
        currentLevelIndex: this.currentLevelIndex,
        levelRetries: this.levelRetries || 0,
        isDailyMode: this.isDailyMode,
        // Store a snapshot of the current level for restoration
        level: this.levels[this.currentLevelIndex],
        // We don't persist the full in-game state because runner games
        // reset on resume — player gets a fresh attempt at the same level
      };
      localStorage.setItem(STATE_KEY, JSON.stringify(gameState));
    } catch (e) {
      console.warn('Failed to save game state:', e);
    }
  }

  /**
   * Restore game state after lifecycle resume
   * Restores level progress and restarts the level
   */
  restoreGameStateFromPause() {
    try {
      const saved = localStorage.getItem(STATE_KEY);
      if (saved) {
        const gameState = JSON.parse(saved);
        this.currentLevelIndex = gameState.currentLevelIndex;
        this.levelRetries = gameState.levelRetries || 0;
        this.isDailyMode = gameState.isDailyMode || false;

        // Restore daily seed if needed
        if (this.isDailyMode) {
          this.dailySeed = getGameDailySeed(GAME_ID);
        }
      }
    } catch (e) {
      console.warn('Failed to restore game state:', e);
    }
  }

  /**
   * Pause the game's RAF loop
   * Called by lifecycle.pause()
   */
  pauseGame() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Resume the game's RAF loop
   * Called by lifecycle.resume()
   */
  resumeGame() {
    this.isRunning = true;
    this.lastTime = 0;
    this.accumulator = 0;
    this.animationId = requestAnimationFrame(this.gameLoop.bind(this));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const game = new JellyShiftGame();
  game.init();
});

export { JellyShiftGame };
export default JellyShiftGame;
