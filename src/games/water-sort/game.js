/**
 * Water Sort - Main Game Logic
 *
 * Orchestrates the Water Sort puzzle game with:
 * - Game state management
 * - Canvas rendering
 * - User input handling
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
  canPour,
  getPourAmount,
  executePour,
  checkWin,
  countCompletedTubes,
  isTubeComplete,
  getHint,
  calculateStars,
  createHistory
} from './state.js';

import { createRenderer } from './renderer.js';
import { audio } from './audio.js';

// Game constants
const GAME_ID = 'water-sort';
const LEVELS_URL = './levels.json';

class WaterSortGame {
  constructor() {
    // DOM elements
    this.canvas = document.getElementById('game-canvas');
    this.levelDisplay = document.getElementById('level-display');
    this.movesDisplay = document.getElementById('moves-display');
    this.completedDisplay = document.getElementById('completed-display');
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

    // Interaction state
    this.animating = false;

    // Daily challenge
    this.isDailyMode = false;
    this.dailySeed = null;

    // Bind methods
    this.handleCanvasClick = this.handleCanvasClick.bind(this);
    this.handleCanvasMove = this.handleCanvasMove.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
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

      // Initialize audio
      audio.init();
      audio.setVolume(getSettings().soundEnabled ? 0.5 : 0);

      // Load levels
      await this.loadLevels();

      // Create renderer
      this.renderer = createRenderer(this.canvas);
      this.renderer.setReducedMotion(isReducedMotionEnabled());

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

      console.log('Water Sort initialized');
    } catch (error) {
      console.error('Failed to initialize Water Sort:', error);
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
      tubes: [
        ['red', 'red', 'blue', 'blue'],
        ['blue', 'blue', 'red', 'red'],
        [],
        []
      ]
    };
  }

  /**
   * Generate daily challenge level
   */
  generateDailyLevel() {
    const rng = createRNG(this.dailySeed);
    const numColors = rng.int(3, 5);
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
    const selectedColors = colors.slice(0, numColors);
    
    const tubes = [];
    const capacity = 4;
    
    // Create filled tubes
    for (let i = 0; i < numColors; i++) {
      const tube = [];
      for (let j = 0; j < capacity; j++) {
        tube.push(selectedColors[i]);
      }
      tubes.push(tube);
    }
    
    // Shuffle by making random valid moves
    for (let move = 0; move < 100; move++) {
      const nonEmptyTubes = tubes.map((t, i) => ({ tube: t, index: i }))
        .filter(({ tube }) => tube.length > 0);
      
      if (nonEmptyTubes.length === 0) break;
      
      const { tube: fromTube, index: fromIndex } = nonEmptyTubes[rng.int(0, nonEmptyTubes.length - 1)];
      const nonFullTubes = tubes.map((t, i) => ({ tube: t, index: i }))
        .filter(({ tube, index }) => tube.length < capacity && index !== fromIndex);
      
      if (nonFullTubes.length === 0) break;
      
      const { index: toIndex } = nonFullTubes[rng.int(0, nonFullTubes.length - 1)];
      const toTube = tubes[toIndex];
      
      // Move one segment
      toTube.push(fromTube.pop());
    }
    
    // Add empty tubes
    tubes.push([], []);
    
    this.levels = [{
      id: 'daily',
      difficulty: 0.5,
      optimal: numColors * 4,
      tubes
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
    // Canvas events
    this.canvas.addEventListener('click', this.handleCanvasClick);
    this.canvas.addEventListener('mousemove', this.handleCanvasMove);
    this.canvas.addEventListener('touchstart', this.handleCanvasClick, { passive: false });

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

    // Reset interaction state
    this.animating = false;

    // Resize and render
    this.handleResize();
    this.updateUI();

    // Announce for screen readers
    const numTubes = this.state.tubes.length;
    const nonEmptyTubes = this.state.tubes.filter(t => t.length > 0).length;
    announce(`Level ${index + 1} started. ${nonEmptyTubes} tubes with colored liquid to sort.`);
  }

  /**
   * Restart current level
   */
  restartLevel() {
    this.startLevel(this.currentLevelIndex);
    audio.playSelect();
  }

  /**
   * Handle canvas click
   */
  handleCanvasClick(e) {
    if (this.animating || this.state.won) return;

    e.preventDefault();

    // Initialize audio on first interaction
    audio.resume();

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;

    const tubeIndex = this.renderer.getTubeAtPosition(canvasX, canvasY, this.state);

    if (tubeIndex !== null) {
      this.handleTubeClick(tubeIndex);
    }
  }

  /**
   * Handle click on a tube
   */
  handleTubeClick(tubeIndex) {
    // No tube selected - select this one
    if (this.state.selectedTube === null) {
      // Can only select non-empty tubes
      if (this.state.tubes[tubeIndex].length > 0) {
        this.state.selectedTube = tubeIndex;
        audio.playSelect();
        this.render();
      }
      return;
    }

    // Clicked same tube - deselect
    if (this.state.selectedTube === tubeIndex) {
      this.state.selectedTube = null;
      this.state.pourPreview = null;
      this.render();
      return;
    }

    // Try to pour
    if (canPour(this.state, this.state.selectedTube, tubeIndex)) {
      this.executePour(this.state.selectedTube, tubeIndex);
    } else {
      // Invalid pour - maybe select new tube instead
      if (this.state.tubes[tubeIndex].length > 0) {
        this.state.selectedTube = tubeIndex;
        audio.playSelect();
      } else {
        // Invalid move - play shake sound and animate
        audio.playShake();
        this.renderer.shake();
      }
      this.render();
    }
  }

  /**
   * Handle canvas mouse move for preview
   */
  handleCanvasMove(e) {
    if (this.animating || this.state.won || this.state.selectedTube === null) return;

    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const tubeIndex = this.renderer.getTubeAtPosition(canvasX, canvasY, this.state);

    if (tubeIndex !== null && tubeIndex !== this.state.selectedTube) {
      if (canPour(this.state, this.state.selectedTube, tubeIndex)) {
        this.state.pourPreview = {
          from: this.state.selectedTube,
          to: tubeIndex,
          amount: getPourAmount(this.state, this.state.selectedTube, tubeIndex)
        };
      } else {
        this.state.pourPreview = null;
      }
    } else {
      this.state.pourPreview = null;
    }

    this.render();
  }

  /**
   * Execute a pour operation
   */
  async executePour(fromIndex, toIndex) {
    this.animating = true;
    this.history.push(cloneState(this.state));

    // Track tube completion before pour
    const completedBefore = countCompletedTubes(this.state);

    // Animate pour
    await this.renderer.animatePour(this.state, fromIndex, toIndex, () => {
      executePour(this.state, fromIndex, toIndex);
      audio.playPour();
    });

    // Check for newly completed tubes
    const completedAfter = countCompletedTubes(this.state);
    if (completedAfter > completedBefore) {
      audio.playComplete();
    }

    // Check win
    if (checkWin(this.state)) {
      this.handleWin();
    }

    this.animating = false;
    this.updateUI();
    this.render();
  }

  /**
   * Handle win condition
   */
  async handleWin() {
    this.state.won = true;
    const level = this.levels[this.currentLevelIndex];
    const stars = calculateStars(this.state.moves, level.optimal);

    audio.playWin();

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

    document.getElementById('stats-summary').textContent =
      `Completed in ${this.state.moves} moves!`;

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
    if (!this.history.canUndo() || this.animating) return;

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
      // Highlight the source tube
      this.state.selectedTube = hint.from;
      this.render();

      announce(hint.message);
      audio.playSelect();
    } else {
      announce('No hint available');
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
    if (this.animating || this.state.won) return;

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
        this.state.selectedTube = null;
        this.state.pourPreview = null;
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
      this.renderer.render(this.state);
    }
  }

  /**
   * Update UI elements
   */
  updateUI() {
    const level = this.levels[this.currentLevelIndex];

    this.levelDisplay.textContent = this.isDailyMode ? 'Daily' : this.currentLevelIndex + 1;
    this.movesDisplay.textContent = this.state.moves;
    this.completedDisplay.textContent = countCompletedTubes(this.state);

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
  const game = new WaterSortGame();
  game.init();
});

export { WaterSortGame };
export default WaterSortGame;
