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
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { isColorBlindEnabled } from '../../shared/color-blind.js';
import { completeDailyChallenge, getGameDailySeed } from '../../shared/daily.js';

import {
  createInitialState,
  cloneState,
  canPour,
  pour,
  topGroupSize,
  topColor,
  checkWin,
  isStuck,
  createGameHistory,
  calculateStars,
  isTubeComplete
} from './state.js';

import { createRenderer } from './renderer.js';
import { createInput } from './input.js';
import { generateLevel } from './generator.js';
import { haptic } from '../../shared/haptics.js';
import { recordLevel } from '../../shared/adaptive.js';
import { createHintSession, getHintTokens } from '../../shared/hints.js';

// Game constants
const GAME_ID = 'water-sort';
const LEVELS_URL = './levels.json';

class WaterSortGame {
  constructor() {
    // DOM elements
    this.canvas = document.getElementById('game-canvas');
    this.levelDisplay = document.getElementById('level-display');
    this.movesDisplay = document.getElementById('moves-display');
    this.tubesDisplay = document.getElementById('tubes-display');
    this.levelProgress = document.getElementById('level-progress');

    // Buttons
    this.btnUndo = document.getElementById('btn-undo');
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
    this.history = null;
    this.renderer = null;
    this.input = null;

    // Interaction state
    this.selectedTube = null;
    this.animating = false;

    // Daily challenge
    this.isDailyMode = false;
    this.dailySeed = null;

    // Hint session
    this.hintSession = null;

    // Bind methods
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  /**
   * Initialize the game
   */
  async init() {
    try {
      await initStorage();
      initAccessibility();

      // Load levels
      await this.loadLevels();

      // Create renderer
      this.renderer = createRenderer(this.canvas);
      this.renderer.setReducedMotion(isReducedMotionEnabled());
      this.renderer.setColorBlindMode(isColorBlindEnabled());

      // Create input handler
      this.input = createInput({
        canvas: this.canvas,
        renderer: this.renderer,
        onTubeTap: (idx) => this.handleTubeTap(idx)
      });
      this.input.init();

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
      this.levels = [this.getDefaultLevel()];
    }
  }

  /**
   * Get default fallback level
   */
  getDefaultLevel() {
    return {
      id: 'ws-001',
      difficulty: 0.05,
      optimal: 2,
      tubes: [
        ['red', 'blue', 'red', 'blue'],
        ['blue', 'red', 'blue', 'red'],
        []
      ],
      maxSegments: 4
    };
  }

  /**
   * Generate daily challenge level
   */
  generateDailyLevel() {
    const level = generateLevel(this.dailySeed, 0.5);
    if (level) {
      this.levels = [level];
    }
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
    this.btnRestart.addEventListener('click', () => this.restartLevel());

    const hintBtn = document.getElementById('btn-hint');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => {
        if (this.hintSession) this.hintSession.showHint();
        this.updateHintButton();
      });
    }
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

    document.getElementById('setting-color-blind').addEventListener('change', (e) => {
      updateSettings({ colorBlind: e.target.checked });
      this.renderer.setColorBlindMode(e.target.checked);
      this.render();
    });
  }

  /**
   * Start a level
   */
  startLevel(index) {
    if (index < 0 || index >= this.levels.length) return;

    if (index !== this.currentLevelIndex) this.levelRetries = 0;
    this.currentLevelIndex = index;
    const level = this.levels[index];

    this.state = createInitialState(level);
    this.history = createGameHistory(100);
    this.history.push(cloneState(this.state));

    if (this.hintSession) { this.hintSession.destroy(); }
    if (this.renderer) this.renderer.setHintTube(null);
    const rawLevel = this.levels[index];
    this.hintSession = createHintSession({
      gameId: GAME_ID,
      level: rawLevel,
      getState: () => ({ tubes: this.state.tubes.map(t => [...t.segments]), maxSegments: this.state.maxSegments }),
      onHighlight: ({ move }) => {
        this.renderer.setHintTube(move.from);
        this.render();
      },
      onShowMove: ({ move }) => {
        this.renderer.setHintTube(move.from);
        this.render();
      },
      onAutoPlay: ({ move }) => {
        this.renderer.setHintTube(null);
        this.executePour(move.from, move.to);
      },
      onTokensEmpty: () => {
        this.updateHintButton();
      },
    });
    this.updateHintButton();

    this.selectedTube = null;
    this.animating = false;
    this.levelStartTime = Date.now();
    this.levelUndos = 0;

    this.handleResize();
    this.updateUI();

    const colorCount = new Set(
      level.tubes.flat().filter(c => c)
    ).size;

    announce(`Level ${index + 1}. ${colorCount} colors, ${level.tubes.length} tubes.`);
  }

  /**
   * Restart current level
   */
  restartLevel() {
    this.levelRetries = (this.levelRetries || 0) + 1;
    this.startLevel(this.currentLevelIndex);
  }

  updateHintButton() {
    const btn = document.getElementById('btn-hint');
    if (!btn) return;
    const tokens = getHintTokens();
    btn.textContent = `Hint (${tokens})`;
    btn.disabled = tokens <= 0;
  }

  /**
   * Handle tube tap
   */
  handleTubeTap(tubeIdx) {
    if (this.animating || !this.state || this.state.status === 'won' || this.state.status === 'stuck') return;

    if (this.selectedTube === null) {
      // Select tube (only if not empty and not complete)
      const tube = this.state.tubes[tubeIdx];
      if (tube.segments.length === 0) return;
      if (isTubeComplete(this.state, tubeIdx)) return;

      this.selectedTube = tubeIdx;
      this.state.selectedTube = tubeIdx;
      this.render();
      return;
    }

    if (this.selectedTube === tubeIdx) {
      // Deselect
      this.selectedTube = null;
      this.state.selectedTube = null;
      this.render();
      return;
    }

    // Attempt pour
    if (canPour(this.state, this.selectedTube, tubeIdx)) {
      this.renderer.setHintTube(null);
      this.executePour(this.selectedTube, tubeIdx);
    } else {
      // Invalid move - switch selection to new tube
      const tube = this.state.tubes[tubeIdx];
      if (tube.segments.length > 0 && !isTubeComplete(this.state, tubeIdx)) {
        this.selectedTube = tubeIdx;
        this.state.selectedTube = tubeIdx;
      } else {
        this.selectedTube = null;
        this.state.selectedTube = null;
      }
      this.render();
    }
  }

  /**
   * Execute a pour with animation
   */
  async executePour(fromIdx, toIdx) {
    this.animating = true;

    const fromTube = this.state.tubes[fromIdx];
    const color = topColor(fromTube);
    const count = Math.min(
      topGroupSize(fromTube),
      this.state.maxSegments - this.state.tubes[toIdx].segments.length
    );

    // Save pre-pour state for animation
    const prePourState = this.state;

    // Push to history before modifying state
    this.history.push(cloneState(this.state));

    // Apply pour
    this.state = pour(this.state, fromIdx, toIdx);
    haptic('tap');
    this.selectedTube = null;

    // Animate
    await this.renderer.animatePour(fromIdx, toIdx, count, color, prePourState);

    // Trigger scale-pop if destination tube is now complete
    if (isTubeComplete(this.state, toIdx)) {
      haptic('collect');
      this.renderer.triggerTubePop(toIdx);
    }

    // Check win
    if (checkWin(this.state)) {
      this.state.status = 'won';
      haptic('win');
      this.handleWin();
    } else if (isStuck(this.state)) {
      haptic('fail');
      this.state.status = 'stuck';
      announce('No moves left. Use undo or restart.');
      recordLevel(GAME_ID, {
        retryCount: this.levelRetries || 0,
        solveTime: Date.now() - (this.levelStartTime || Date.now()),
        undoRate: this.state.moves > 0 ? (this.levelUndos || 0) / this.state.moves : 0,
        hintUsage: this.hintSession?.level ?? 0,
      }, { won: false, daily: this.isDailyMode });
    }

    this.animating = false;
    this.updateUI();
    this.render();
  }

  /**
   * Handle win condition
   */
  async handleWin() {
    const level = this.levels[this.currentLevelIndex];
    const stars = calculateStars(this.state.moves, level.optimal);
    const solveTime = Date.now() - (this.levelStartTime || Date.now());
    const undoRate = this.state.moves > 0 ? (this.levelUndos || 0) / this.state.moves : 0;

    recordLevel(GAME_ID, {
      retryCount: this.levelRetries || 0,
      solveTime,
      undoRate,
      hintUsage: this.hintSession?.level ?? 0,
    }, { won: true, daily: this.isDailyMode });

    await updateGameStats(GAME_ID, {
      played: 1,
      completed: 1,
      stars: stars
    });

    await awardLevelComplete(GAME_ID, stars, { moves: this.state.moves });

    if (this.isDailyMode) {
      completeDailyChallenge(GAME_ID);
    }

    await this.saveProgress();

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
    if (!this.history || !this.history.canUndo() || this.animating) return;

    const prevState = this.history.undo();
    if (prevState) {
      this.levelUndos = (this.levelUndos || 0) + 1;
      this.state = { ...prevState, selectedTube: null };
      this.selectedTube = null;
      this.state.status = 'playing';
      this.updateUI();
      this.render();
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
    const muted = settings.soundEnabled;
    updateSettings({ soundEnabled: !muted });
    this.btnSound.innerHTML = muted
      ? '<span aria-hidden="true">🔇</span>'
      : '<span aria-hidden="true">🔊</span>';
  }

  /**
   * Show settings
   */
  showSettings() {
    const settings = getSettings();
    document.getElementById('setting-sound').checked = settings.soundEnabled;
    document.getElementById('setting-haptic').checked = settings.hapticEnabled;
    document.getElementById('setting-motion').checked = settings.reducedMotion;
    document.getElementById('setting-color-blind').checked = settings.colorBlind;

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
    if (this.animating || !this.state || this.state.status === 'won' || this.state.status === 'stuck') return;

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
      case 'Escape':
        this.selectedTube = null;
        if (this.state) this.state.selectedTube = null;
        this.render();
        break;
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    if (this.state && this.renderer) {
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
    if (!this.state) return;

    this.levelDisplay.textContent = this.isDailyMode ? 'Daily' : this.currentLevelIndex + 1;
    this.movesDisplay.textContent = this.state.moves;

    const nonEmptyTubes = this.state.tubes.filter(t => t.segments.length > 0).length;
    this.tubesDisplay.textContent = `${nonEmptyTubes}`;

    const levelText = this.isDailyMode ? 'Daily Challenge' : `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;
    this.levelProgress.textContent = levelText;

    this.btnUndo.disabled = !this.history || !this.history.canUndo();
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
