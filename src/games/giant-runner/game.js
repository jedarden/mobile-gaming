/**
 * Giant Runner - Main Game Logic
 *
 * Orchestrates the Giant Runner auto-runner game with:
 * - Game state management
 * - Three.js rendering
 * - User input handling
 * - Level progression
 * - Integration with shared systems
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { getGameDailySeed } from '../../shared/daily.js';

import {
  createInitialState,
  advance,
  collect,
  hitObstacle,
  steer,
  checkCollectibleCollisions,
  checkObstacleCollisions,
  resolveBoss,
  isGameOver,
  calculateStars
} from './state.js';

import { createRenderer } from './renderer.js';
import { createInput } from './input.js';

// Game constants
const GAME_ID = 'giant-runner';
const LEVELS_URL = './levels.json';
const FIXED_DT = 1 / 60; // Fixed timestep for physics

class GiantRunnerGame {
  constructor() {
    // DOM elements
    this.container = document.getElementById('game-container');
    this.levelDisplay = document.getElementById('level-display');
    this.scaleDisplay = document.getElementById('scale-display');
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

    // Daily challenge
    this.isDailyMode = false;
    this.dailySeed = null;

    // Bind methods
    this.gameLoop = this.gameLoop.bind(this);
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

      // Create renderer
      this.renderer = createRenderer(this.container);
      this.renderer.init();
      this.renderer.setReducedMotion(isReducedMotionEnabled());

      // Create input handler
      this.input = createInput({
        element: this.renderer.canvas,
        onSteer: (xDelta) => this.handleSteer(xDelta)
      });
      this.input.init();

      // Check for daily mode
      const urlParams = new URLSearchParams(window.location.search);
      this.isDailyMode = urlParams.get('daily') === 'true';

      if (this.isDailyMode) {
        this.dailySeed = getGameDailySeed(GAME_ID);
      }

      // Load saved progress
      this.loadProgress();

      // Setup event listeners
      this.setupEventListeners();

      // Start game
      this.startLevel(this.currentLevelIndex);

      console.log('Giant Runner initialized');
    } catch (error) {
      console.error('Failed to initialize Giant Runner:', error);
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
      courseLength: 200,
      startScale: 1.0,
      playerColor: 'blue',
      speed: 3,
      collectibles: [
        { x: -1, z: 30, color: 'blue', value: 0.1 },
        { x: 0, z: 50, color: 'blue', value: 0.1 },
        { x: 1, z: 70, color: 'red', value: -0.05 },
        { x: -1, z: 90, color: 'blue', value: 0.1 },
        { x: 0, z: 110, color: 'blue', value: 0.1 },
        { x: 1, z: 130, color: 'blue', value: 0.1 },
        { x: -1, z: 150, color: 'blue', value: 0.1 },
        { x: 0, z: 170, color: 'blue', value: 0.1 }
      ],
      obstacles: [
        { x: 0, z: 60, width: 1.5 },
        { x: 0, z: 120, width: 1.5 }
      ],
      boss: { z: 200, scale: 1.5 }
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
    // Resize
    window.addEventListener('resize', this.handleResize);

    // Buttons
    this.btnRestart.addEventListener('click', () => this.restartLevel());
    this.btnPrev.addEventListener('click', () => this.prevLevel());
    this.btnNext.addEventListener('click', () => this.nextLevel());
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

    // Reset game loop
    this.lastTime = 0;
    this.accumulator = 0;

    // Start game loop
    this.isRunning = true;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.animationId = requestAnimationFrame(this.gameLoop);

    // Resize and render
    this.handleResize();
    this.updateUI();

    // Announce for screen readers
    announce(`Level ${index + 1} started. Collect ${level.playerColor} orbs to grow and defeat the boss!`);
  }

  /**
   * Main game loop
   */
  gameLoop(timestamp) {
    if (!this.isRunning) return;

    // Calculate delta time
    if (this.lastTime === 0) {
      this.lastTime = timestamp;
    }
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); // Cap at 100ms
    this.lastTime = timestamp;

    // Fixed timestep physics
    this.accumulator += dt;

    while (this.accumulator >= FIXED_DT && this.state && !isGameOver(this.state)) {
      // Advance game state
      this.state = advance(this.state, FIXED_DT);

      // Check collectible collisions
      const collectibleCollisions = checkCollectibleCollisions(this.state);
      for (const idx of collectibleCollisions) {
        this.state = collect(this.state, idx);
      }

      // Check obstacle collisions
      const obstacleCollisions = checkObstacleCollisions(this.state);
      for (const idx of obstacleCollisions) {
        this.state = hitObstacle(this.state, idx);
      }

      this.accumulator -= FIXED_DT;
    }

    // Check for boss fight transition
    if (this.state && this.state.status === 'boss_fight') {
      this.state = resolveBoss(this.state);
      this.handleGameEnd();
    }

    // Render
    if (this.state) {
      this.renderer.render(this.state);
      this.updateUI();
    }

    // Continue loop
    if (this.isRunning) {
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
  }

  /**
   * Handle steering input
   */
  handleSteer(xDelta) {
    if (!this.state || isGameOver(this.state)) return;
    this.state = steer(this.state, xDelta);
  }

  /**
   * Handle game end
   */
  async handleGameEnd() {
    this.isRunning = false;

    if (this.state.status === 'won') {
      const level = this.levels[this.currentLevelIndex];
      const stars = calculateStars(this.state.player.scale, level.boss.scale);

      // Animate boss fight
      this.renderer.animateBossFight(true, async () => {
        // Update stats
        await updateGameStats(GAME_ID, {
          played: 1,
          completed: 1,
          stars: stars
        });

        // Award XP
        await awardLevelComplete(GAME_ID, stars, { finalScale: this.state.player.scale });

        // Save progress
        await this.saveProgress();

        // Show win overlay
        this.showWinOverlay(stars);
        announce(`Victory! You defeated the boss! ${stars} stars!`);
      });
    } else {
      // Animate loss
      this.renderer.animateBossFight(false, () => {
        this.showLoseOverlay();
        announce('Defeat! The boss was too powerful. Try again!');
      });
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

    this.levelDisplay.textContent = this.isDailyMode ? 'Daily' : this.currentLevelIndex + 1;
    this.scaleDisplay.textContent = this.state.player.scale.toFixed(2);

    const levelText = this.isDailyMode ? 'Daily Challenge' : `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;
    this.levelProgress.textContent = levelText;

    // Update buttons
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
      `Final scale: ${this.state.player.scale.toFixed(2)}x`;

    this.winOverlay.classList.add('active');
    this.winOverlay.setAttribute('aria-hidden', 'false');
  }

  /**
   * Show lose overlay
   */
  showLoseOverlay() {
    const title = document.getElementById('win-title');
    title.textContent = 'Defeat!';
    title.classList.remove('win');
    title.classList.add('lose');

    document.getElementById('stats-summary').textContent =
      `Final scale: ${this.state.player.scale.toFixed(2)}x (Boss: ${this.state.boss.scale}x)`;

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

    // Reset for next time
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
  }
}

// Initialize game on load
document.addEventListener('DOMContentLoaded', () => {
  const game = new GiantRunnerGame();
  game.init();
});

export { GiantRunnerGame };
export default GiantRunnerGame;
