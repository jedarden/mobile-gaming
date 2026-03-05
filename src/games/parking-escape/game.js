/**
 * Parking Escape - Main Game Logic
 *
 * Orchestrates the Parking Escape puzzle game with:
 * - Game state management
 * - Canvas rendering
 * - Drag input handling
 * - Level progression
 * - Integration with shared systems
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete, getLevelInfo } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { getDailyChallenge, completeDailyChallenge, getGameDailySeed, isDailyCompleted } from '../../shared/daily.js';
import { createRNG } from '../../shared/rng.js';

import {
  createInitialState,
  cloneState,
  getCarAt,
  canMoveTo,
  checkWin,
  moveCar,
  getHint,
  createHistory,
  calculateStars
} from './state.js';

import { createRenderer } from './renderer.js';
import { createDragInput } from './input.js';
import { audio } from './audio.js';

// Game constants
const GAME_ID = 'parking-escape';
const LEVELS_URL = './levels.json';

class ParkingEscapeGame {
  constructor() {
    // DOM elements
    this.canvas = document.getElementById('game-canvas');
    this.levelDisplay = document.getElementById('level-display');
    this.movesDisplay = document.getElementById('moves-display');
    this.optimalDisplay = document.getElementById('optimal-display');
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
    this.dragInput = null;

    // Daily challenge
    this.isDailyMode = false;
    this.dailySeed = null;

    // Bind methods
    this.handleResize = this.handleResize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Initialize the game
   */
  async init() {
    try {
      // Initialize storage and accessibility
      await initStorage();
      initAccessibility();

      // Initialize audio
      audio.init();
      audio.setVolume(getSettings().soundEnabled ? 0.5 : 0);

      // Load levels
      await this.loadLevels();

      // Create renderer
      this.renderer = createRenderer(this.canvas);
      this.renderer.setReducedMotion(isReducedMotionEnabled());

      // Create drag input handler
      this.dragInput = createDragInput({
        canvas: this.canvas,
        renderer: this.renderer,
        audio: audio,
        getState: () => this.state,
        onDragStart: (carId) => this.handleDragStart(carId),
        onDragMove: (data) => this.handleDragMove(data),
        onDragEnd: (data) => this.handleDragEnd(data),
        onTap: (car) => this.handleTap(car)
      });
      this.dragInput.init();

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

      console.log('Parking Escape initialized');
    } catch (error) {
      console.error('Failed to initialize Parking Escape:', error);
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
      optimal: 2,
      gridSize: 6,
      exit: { x: 6, y: 2 },
      cars: [
        { id: 'target', x: 0, y: 2, length: 2, orientation: 'horizontal', color: 'red' },
        { id: 'car1', x: 2, y: 0, length: 2, orientation: 'vertical', color: 'blue' },
        { id: 'car2', x: 2, y: 3, length: 3, orientation: 'vertical', color: 'green' },
        { id: 'car3', x: 3, y: 2, length: 2, orientation: 'horizontal', color: 'yellow' }
      ]
    };
  }

  /**
   * Generate daily challenge level
   */
  generateDailyLevel() {
    const rng = createRNG(this.dailySeed);
    const gridSize = 6;
    const numCars = rng.int(6, 10);

    // Place target car
    const targetY = rng.int(0, gridSize - 1);
    const cars = [{
      id: 'target',
      x: 0,
      y: targetY,
      length: 2,
      orientation: 'horizontal',
      color: 'red'
    }];

    // Place blocking cars
    const colors = ['blue', 'green', 'yellow', 'purple', 'orange'];
    const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

    // Mark target car cells
    for (let i = 0; i < 2; i++) {
      grid[targetY][i] = 'target';
    }

    for (let i = 0; i < numCars; i++) {
      const color = colors[i % colors.length];
      const length = rng.int(2, 3);
      const orientation = rng.int(0, 1) === 0 ? 'horizontal' : 'vertical';

      // Try to place car
      let placed = false;
      for (let attempt = 0; attempt < 50 && !placed; attempt++) {
        const x = rng.int(0, gridSize - 1);
        const y = rng.int(0, gridSize - 1);

        // Check if fits
        let canPlace = true;
        const cells = [];

        for (let j = 0; j < length; j++) {
          const cx = orientation === 'horizontal' ? x + j : x;
          const cy = orientation === 'vertical' ? y + j : y;

          if (cx >= gridSize || cy >= gridSize || grid[cy][cx]) {
            canPlace = false;
            break;
          }
          cells.push({ x: cx, y: cy });
        }

        // Don't block target row completely
        if (orientation === 'vertical' && y === targetY) {
          canPlace = false;
        }

        if (canPlace) {
          cars.push({
            id: `car${i + 1}`,
            x,
            y,
            length,
            orientation,
            color
          });

          cells.forEach(c => grid[c.y][c.x] = `car${i + 1}`);
          placed = true;
        }
      }
    }

    this.levels = [{
      id: 'daily',
      difficulty: 0.5,
      optimal: numCars * 2,
      gridSize,
      exit: { x: gridSize, y: targetY },
      cars
    }];
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
    // Keyboard
    document.addEventListener('keydown', this.handleKeyDown);

    // Resize
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
      audio.setVolume(e.target.checked ? 0.5 : 0);
    });

    document.getElementById('setting-haptic').addEventListener('change', (e) => {
      updateSettings({ hapticEnabled: e.target.checked });
      this.dragInput.setHapticFeedback(e.target.checked);
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
    announce(`Level ${index + 1} started. ${level.cars.length} cars. Guide the red car to the exit.`);
  }

  /**
   * Restart current level
   */
  restartLevel() {
    this.startLevel(this.currentLevelIndex);
    audio.playSelect();
  }

  /**
   * Handle drag start
   */
  handleDragStart(carId) {
    this.state.draggingCar = carId;
    this.render();
  }

  /**
   * Handle drag move
   */
  handleDragMove(data) {
    const { carId, position, collisions, isValid } = data;

    // Update state with drag position
    this.state.dragPosition = position;
    this.state.collisionPreview = collisions;

    this.render();
  }

  /**
   * Handle drag end
   */
  async handleDragEnd(data) {
    const { carId, position, moved, cancelled } = data;

    // Clear drag state
    this.state.draggingCar = null;
    this.state.dragPosition = null;
    this.state.collisionPreview = null;

    if (cancelled || !moved) {
      this.render();
      return;
    }

    const car = this.state.cars.find(c => c.id === carId);
    if (!car) return;

    // Save history before move
    this.history.push(cloneState(this.state));

    // Execute move
    if (moveCar(this.state, carId, position.x, position.y)) {
      // Check win
      if (checkWin(this.state)) {
        this.handleWin();
      }
    }

    this.updateUI();
    this.render();
  }

  /**
   * Handle tap on car (non-drag)
   */
  handleTap(car) {
    // Select car for visual feedback
    this.state.selectedCar = car.id;
    audio.playSelect();
    this.render();

    // Clear selection after a moment
    setTimeout(() => {
      if (this.state.selectedCar === car.id) {
        this.state.selectedCar = null;
        this.render();
      }
    }, 500);
  }

  /**
   * Handle win condition
   */
  async handleWin() {
    this.state.won = true;
    const level = this.levels[this.currentLevelIndex];
    const stars = calculateStars(this.state.moves, level.optimal);

    audio.playWin();

    // Animate target car exiting
    const targetCar = this.state.cars.find(c => c.id === 'target');
    if (targetCar) {
      await this.renderer.animateExit(targetCar, this.renderer.scale, () => {});
      audio.playExit();
    }

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

    announce(`Level complete! ${this.state.moves} moves. ${stars} stars!`);
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

    const level = this.levels[this.currentLevelIndex];
    document.getElementById('stats-summary').textContent =
      `Completed in ${this.state.moves} moves (min: ${level.optimal})`;

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
    if (!this.history.canUndo() || this.state.animating) return;

    const prevState = this.history.undo();
    if (prevState) {
      this.state = prevState;
      this.updateUI();
      this.render();
      audio.playSelect();
    }
  }

  /**
   * Show hint
   */
  showHint() {
    const hint = getHint(this.state);
    if (hint) {
      // Highlight the hint car
      this.state.selectedCar = hint.car.id;
      this.render();

      // Flash effect
      const carElement = this.canvas;
      carElement.classList.add('hint-active');
      setTimeout(() => carElement.classList.remove('hint-active'), 3000);

      announce(hint.message);
      audio.playSelect();
    }
  }

  /**
   * Previous level
   */
  prevLevel() {
    if (this.currentLevelIndex > 0) {
      this.startLevel(this.currentLevelIndex - 1);
      audio.playSelect();
    }
  }

  /**
   * Next level
   */
  nextLevel() {
    if (this.currentLevelIndex < this.levels.length - 1) {
      this.startLevel(this.currentLevelIndex + 1);
      audio.playSelect();
    }
  }

  /**
   * Toggle sound
   */
  toggleSound() {
    const muted = audio.toggleMute();
    this.btnSound.innerHTML = muted ? '<span aria-hidden="true">🔇</span>' : '<span aria-hidden="true">🔊</span>';
    updateSettings({ soundEnabled: !muted });
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
   * Handle keyboard input
   */
  handleKeyDown(e) {
    if (this.state.animating || this.state.won) return;

    switch (e.key) {
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.undo();
        }
        break;
      case 'r':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.restartLevel();
        }
        break;
      case 'h':
        this.showHint();
        break;
      case 'Escape':
        this.state.selectedCar = null;
        this.render();
        break;
    }
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
      this.renderer.render(this.state, this.renderer.scale);
    }
  }

  /**
   * Update UI elements
   */
  updateUI() {
    const level = this.levels[this.currentLevelIndex];

    this.levelDisplay.textContent = this.isDailyMode ? 'Daily' : this.currentLevelIndex + 1;
    this.movesDisplay.textContent = this.state.moves;
    this.optimalDisplay.textContent = level.optimal;

    const levelText = this.isDailyMode ? 'Daily Challenge' : `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;
    this.levelProgress.textContent = levelText;

    // Update buttons
    this.btnUndo.disabled = !this.history.canUndo();
    this.btnPrev.disabled = this.currentLevelIndex === 0;
    this.btnNext.disabled = this.currentLevelIndex >= this.levels.length - 1;
  }
}

// Initialize game on load
document.addEventListener('DOMContentLoaded', () => {
  const game = new ParkingEscapeGame();
  game.init();
});

export { ParkingEscapeGame };
export default ParkingEscapeGame;
