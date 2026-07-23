/**
 * Bus Jam - Main Game Logic
 *
 * Orchestrates the Bus Jam puzzle game with:
 * - Game state management
 * - Phaser rendering
 * - User input handling via Phaser scene
 * - Level progression
 * - Integration with shared systems
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats, set as storageSet, get as storageGet } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { isColorBlindEnabled } from '../../shared/color-blind.js';
import { getGameDailySeed, completeDailyChallenge } from '../../shared/daily.js';
import { shareDailyResult } from '../../shared/daily-share.js';
import { createRNG } from '../../shared/rng.js';
import { createRetryOverlay, ResultType } from '../../shared/retry.js';
import { quickShare, generateShareText } from '../../shared/share.js';
import { setupPuzzleVisibilityHandler } from '../../shared/lifecycle.js';
import { createLevelNav } from '../../shared/level-nav.js';
import { isGameDailyCompleted } from '../../shared/daily.js';

import {
  createInitialState,
  cloneState,
  getBusAt,
  isRoad,
  findPath,
  canBoard,
  boardPassenger,
  canExit,
  executeExit,
  checkWin,
  countRemainingPassengers,
  getHint,
  calculateStars,
  createHistory
} from './state.js';

import { createRenderer } from './renderer.js';
import { createInput } from './input.js';
import { audio } from './audio.js';
import { haptic } from '../../shared/haptics.js';
import { recordLevel } from '../../shared/adaptive.js';

// Game constants
const GAME_ID = 'bus-jam';
const LEVELS_URL = './levels.json';
const STATE_KEY = `mg:${GAME_ID}:progress`;

class BusJamGame {
  constructor() {
    // DOM elements
    this.canvas = document.getElementById('game-canvas');
    this.levelDisplay = document.getElementById('level-display');
    this.movesDisplay = document.getElementById('moves-display');
    this.passengersDisplay = document.getElementById('passengers-display');
    this.levelProgress = document.getElementById('level-progress');

    // Buttons
    this.btnUndo = document.getElementById('btn-undo');
    this.btnHint = document.getElementById('btn-hint');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnPrev = document.getElementById('btn-prev');
    this.btnNext = document.getElementById('btn-next');
    this.btnSound = document.getElementById('btn-sound');
    this.btnSettings = document.getElementById('btn-settings');
    this.btnShareDaily = document.getElementById('btn-share-daily');

    // Overlays
    this.winOverlay = document.getElementById('win-overlay');
    this.settingsOverlay = document.getElementById('settings-overlay');

    // Game state
    this.levels = [];
    this.currentLevelIndex = 0;
    this.state = null;
    this.history = createHistory(50);
    this.renderer = null;
    this.inputHandler = null;

    // Interaction state
    this.selectedBus = null;
    this.pathPreview = null;
    this.animating = false;

    // Daily challenge
    this.isDailyMode = false;
    this.dailySeed = null;

    // Shared win/loss retry overlay (created per level)
    this.retryOverlay = null;
    this.lastStars = 0;

    // Bind methods
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

      // Check for daily mode
      const urlParams = new URLSearchParams(window.location.search);
      this.isDailyMode = urlParams.get('daily') === 'true';

      if (this.isDailyMode) {
        this.dailySeed = getGameDailySeed(GAME_ID);
        this.generateDailyLevel();
      }

      // Load saved progress
      this.loadProgress();

      // Create initial state BEFORE renderer (needed for Phaser scene init)
      const level = this.levels[this.currentLevelIndex];
      this.state = createInitialState(level);
      this.history.clear();
      this.history.push(cloneState(this.state));

      // Create the shared retry overlay for the initial level (init() does
      // not route through startLevel())
      this.initRetryOverlay(this.currentLevelIndex);

      // Create renderer with state
      this.renderer = createRenderer(this.canvas);
      this.renderer.setReducedMotion(isReducedMotionEnabled());
      this.renderer.setColorBlindMode(isColorBlindEnabled());

      // Create input handler
      this.inputHandler = createInput({
        canvas: this.canvas,
        renderer: this.renderer,
        onCellTap: this.handleClickAt.bind(this),
        onCellHover: this.handleHoverAt.bind(this)
      });
      this.inputHandler.init();

      // Initialize renderer with state and callbacks
      this.renderer.init(this.state, {
        onCellTap: this.handleClickAt.bind(this),
        onCellHover: this.handleHoverAt.bind(this)
      });

      // Resize and initial render
      this.handleResize();

      // Setup event listeners (keyboard and resize only - canvas handled by Phaser)
      this.setupEventListeners();

      // Level-select strip (must exist before the board sizes around it)
      this.initLevelNav();

      // Update UI
      this.updateUI();

      // Announce for screen readers
      announce(`Level ${this.currentLevelIndex + 1} started. ${level.buses.length} buses, ${countRemainingPassengers(this.state)} passengers to pick up.`);

      // Setup visibility handler for state persistence on backgrounding
      setupPuzzleVisibilityHandler({
        onSave: () => this.saveGameState()
      });

      // Check for persisted state and restore it
      this.restoreGameState();

      console.log('Bus Jam initialized');
    } catch (error) {
      console.error('Failed to initialize Bus Jam:', error);
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
      grid: { cols: 5, rows: 5 },
      buses: [
        { id: 'bus1', x: 1, y: 2, color: 'red', passengers: 0, capacity: 3, direction: 'right' }
      ],
      stops: [
        { x: 2, y: 1, color: 'red', waiting: ['red', 'red', 'red'] }
      ],
      exits: [{ x: 4, y: 2 }],
      roads: [[0,2], [1,2], [2,2], [3,2], [4,2], [2,1], [2,3]]
    };
  }

  /**
   * Generate daily challenge level
   */
  generateDailyLevel() {
    const rng = createRNG(this.dailySeed);

    // Generate a random level based on seed
    const gridCols = rng.int(6, 8);
    const gridRows = rng.int(6, 8);
    const numBuses = rng.int(2, 4);
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

    // Generate roads (simple cross pattern with extensions)
    const roads = [];
    const centerX = Math.floor(gridCols / 2);
    const centerY = Math.floor(gridRows / 2);

    // Horizontal road
    for (let x = 0; x < gridCols; x++) {
      roads.push([x, centerY]);
    }

    // Vertical road
    for (let y = 0; y < gridRows; y++) {
      roads.push([centerX, y]);
    }

    // Generate buses and stops
    const buses = [];
    const stops = [];

    for (let i = 0; i < numBuses; i++) {
      const color = colors[i % colors.length];
      const capacity = rng.int(3, 4);

      // Place bus on road
      let busX, busY;
      do {
        busX = rng.int(0, gridCols - 1);
        busY = rng.int(0, gridRows - 1);
      } while (!roads.some(r => r[0] === busX && r[1] === busY) ||
               buses.some(b => b.x === busX && b.y === busY));

      buses.push({
        id: `bus${i + 1}`,
        x: busX,
        y: busY,
        color,
        passengers: 0,
        capacity,
        direction: ['up', 'down', 'left', 'right'][rng.int(0, 3)]
      });

      // Place stop near road
      const stopX = rng.int(0, gridCols - 1);
      const stopY = rng.int(0, gridRows - 1);
      const adjacentRoad = roads.some(r =>
        Math.abs(r[0] - stopX) + Math.abs(r[1] - stopY) === 1
      );

      if (adjacentRoad) {
        stops.push({
          x: stopX,
          y: stopY,
          color,
          waiting: Array(capacity).fill(color)
        });
      }
    }

    // Add exits at road ends
    const exits = [
      { x: gridCols - 1, y: centerY },
      { x: 0, y: centerY }
    ];

    this.levels = [{
      id: 'daily',
      difficulty: 0.5,
      optimal: numBuses * 4,
      grid: { cols: gridCols, rows: gridRows },
      buses,
      stops,
      exits,
      roads
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
   * Build the bottom level-select strip (shared/level-nav.js).
   *
   * The strip is appended to the game column and placed in normal flow (not
   * the default fixed overlay) so it sits below the prev/next row and never
   * covers existing controls.
   */
  initLevelNav() {
    const container = document.querySelector('.game-container') || document.body;
    this.levelNav = createLevelNav({
      container,
      gameId: GAME_ID,
      totalLevels: this.levels.length,
      hasDaily: true,
      dailyCompleted: isGameDailyCompleted(GAME_ID),
      onLevelSelect: (index, restart) => {
        if (restart) {
          this.restartLevel();
        } else {
          this.startLevel(index);
          this.levelNav.setCurrentLevel(index);
        }
      },
      onDailySelect: () => {
        window.location.search = '?daily=true';
      },
    });
    this.levelNav.strip.style.position = 'relative';
    this.levelNav.strip.style.flexShrink = '0';
    window.dispatchEvent(new Event('resize'));
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Keyboard (not handled by Phaser)
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
    this.btnShareDaily.addEventListener('click', () => this.handleShareDaily());

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

    document.getElementById('setting-color-blind').addEventListener('change', (e) => {
      updateSettings({ colorBlind: e.target.checked });
      this.renderer.setColorBlindMode(e.target.checked);
      this.render();
    });
  }

  /**
   * Handle click at grid position
   */
  handleClickAt(gridX, gridY) {
    if (this.animating || this.state.won) return;

    // Initialize audio on first interaction
    audio.resume();

    // Check if clicking on a bus
    const clickedBus = getBusAt(this.state, gridX, gridY);

    if (clickedBus) {
      // Select bus
      if (this.selectedBus === clickedBus.id) {
        // Deselect
        this.selectedBus = null;
        this.pathPreview = null;
      } else {
        // Select new bus
        this.selectedBus = clickedBus.id;
        this.state.selectedBus = clickedBus.id;
        audio.playSelect();
      }
      this.render();
      return;
    }

    // Check if we have a selected bus and clicked on a valid move
    if (this.selectedBus) {
      const bus = this.state.buses.find(b => b.id === this.selectedBus);
      if (!bus) return;

      // Find path to clicked position
      const path = findPath(this.state, bus, gridX, gridY);

      if (path && path.length > 0) {
        // Execute move
        this.executeMove(bus, path);
      } else {
        // Invalid move
        audio.playError();
      }
    }
  }

  /**
   * Handle hover at grid position (for path preview)
   */
  handleHoverAt(gridX, gridY) {
    if (this.animating || this.state.won || !this.selectedBus) return;

    const bus = this.state.buses.find(b => b.id === this.selectedBus);
    if (!bus) return;

    // Update path preview
    if (isRoad(this.state, gridX, gridY) && !getBusAt(this.state, gridX, gridY)) {
      const path = findPath(this.state, bus, gridX, gridY);
      this.pathPreview = path;
    } else {
      this.pathPreview = null;
    }

    this.state.pathPreview = this.pathPreview;
    this.render();
  }

  /**
   * Execute a bus move
   */
  async executeMove(bus, path) {
    this.animating = true;
    this.history.push(cloneState(this.state));

    // Animate movement
    await this.renderer.animateBusMovement(bus, path, this.renderer.scale, () => {
      // Update bus position
      bus.x = path[path.length - 1].x;
      bus.y = path[path.length - 1].y;
      bus.direction = path[path.length - 1].direction;

      this.state.moves++;
      audio.playMove();
    });

    // Check for boarding
    await this.checkBoarding(bus);

    // Check for exit
    await this.checkExit(bus);

    // Check win
    if (checkWin(this.state)) {
      this.handleWin();
    }

    // Clear selection and preview
    this.selectedBus = null;
    this.pathPreview = null;
    this.state.selectedBus = null;
    this.state.pathPreview = null;
    this.animating = false;

    this.updateUI();
    this.render();
  }

  /**
   * Check and execute passenger boarding
   */
  async checkBoarding(bus) {
    while (canBoard(this.state, bus)) {
      const result = boardPassenger(this.state, bus);
      if (!result) break;

      audio.playBoard();
      haptic('collect');
      await this.renderer.animateBoarding(result.stop, bus, this.renderer.scale, () => {});

      // Check if bus is now full
      if (bus.passengers >= bus.capacity) {
        audio.playFull();
      }

      this.render();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Check and execute bus exit
   */
  async checkExit(bus) {
    if (canExit(this.state, bus)) {
      audio.playExit();
      await this.renderer.animateExit(bus, this.state.exits[0], this.renderer.scale, () => {
        executeExit(this.state, bus);
      });
    }
  }

  /**
   * Handle win condition
   */
  async handleWin() {
    haptic('win');
    this.state.won = true;
    const level = this.levels[this.currentLevelIndex];
    const stars = calculateStars(this.state.moves, level.optimal);

    audio.playWin();

    // Record adaptive difficulty signal
    recordLevel(GAME_ID, { retryCount: this.levelRetries || 0, solveTime: Date.now() - (this.levelStartTime || Date.now()) }, { won: true });

    // Update stats
    await updateGameStats(GAME_ID, {
      played: 1,
      completed: 1,
      stars: stars
    });

    // Award XP
    await awardLevelComplete(GAME_ID, stars, { moves: this.state.moves });

    // Mark daily challenge as completed
    if (this.isDailyMode) {
      completeDailyChallenge(GAME_ID);
    }

    // Advance the level-select strip: mark this level complete, unlock + advance
    if (this.levelNav) {
      if (this.isDailyMode) {
        this.levelNav.completeDaily();
      } else {
        this.levelNav.completeLevel(this.currentLevelIndex);
      }
    }

    // Save progress
    await this.saveProgress();

    // Show win overlay via shared universal retry overlay
    this.lastStars = stars;
    const moves = this.state.moves;
    const optimality = level.optimal
      ? Math.round(Math.min(100, (level.optimal / Math.max(1, moves)) * 100))
      : undefined;
    const time = this.levelStartTime
      ? Math.round((Date.now() - this.levelStartTime) / 1000)
      : undefined;
    this.retryOverlay.show(ResultType.WIN, { moves, time, optimality, stars });

    announce(`Level complete! ${this.state.moves} moves. ${stars} stars!`);
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
          title: 'Bus Jam',
          text: generateShareText({
            gameName: 'Bus Jam',
            moves: stats.moves,
            time: stats.time,
            stars: stats.stars,
          }),
          url: window.location.href,
        });
      },
    });
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

    // Show share button in daily mode
    this.btnShareDaily.style.display = this.isDailyMode ? 'inline-flex' : 'none';

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
   * Handle daily challenge share
   */
  async handleShareDaily() {
    const solveTime = this.levelStartTime ? (Date.now() - this.levelStartTime) / 1000 : 0;
    const hintsUsed = this.hintSession?.level ?? 0;

    await shareDailyResult({
      gameId: GAME_ID,
      moves: this.state.moves,
      time: solveTime,
      hints: hintsUsed,
      date: new Date().toISOString().split('T')[0],
      stars: calculateStars(this.state.moves, this.levels[this.currentLevelIndex].optimal)
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

    // Create initial state
    this.state = createInitialState(level);
    this.history.clear();
    this.history.push(cloneState(this.state));

    // Reset interaction state
    this.selectedBus = null;
    this.pathPreview = null;
    this.animating = false;

    // (Re)create the shared retry overlay scoped to this level
    this.initRetryOverlay(index);

    // Resize and render
    this.handleResize();
    this.updateUI();

    // Announce for screen readers
    announce(`Level ${index + 1} started. ${level.buses.length} buses, ${countRemainingPassengers(this.state)} passengers to pick up.`);
  }

  /**
   * Restart current level
   */
  restartLevel() {
    this.levelRetries = (this.levelRetries || 0) + 1;
    this.startLevel(this.currentLevelIndex);
    audio.playSelect();
  }

  /**
   * Undo last move
   */
  undo() {
    if (!this.history.canUndo() || this.animating) return;

    const prevState = this.history.undo();
    if (prevState) {
      this.state = prevState;
      this.selectedBus = null;
      this.pathPreview = null;
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
      // Highlight the hint bus
      this.state.selectedBus = hint.bus.id;
      this.selectedBus = hint.bus.id;
      this.render();

      // Flash the bus
      const busElement = this.canvas;
      busElement.classList.add('hint-active');
      setTimeout(() => busElement.classList.remove('hint-active'), 3000);

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
        this.selectedBus = null;
        this.pathPreview = null;
        this.state.selectedBus = null;
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
    this.levelDisplay.textContent = this.isDailyMode ? 'Daily' : this.currentLevelIndex + 1;
    this.movesDisplay.textContent = this.state.moves;
    this.passengersDisplay.textContent = countRemainingPassengers(this.state);

    const levelText = this.isDailyMode ? 'Daily Challenge' : `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;
    this.levelProgress.textContent = levelText;

    // Update buttons
    this.btnUndo.disabled = !this.history.canUndo();
    this.btnPrev.disabled = this.currentLevelIndex === 0;
    this.btnNext.disabled = this.currentLevelIndex >= this.levels.length - 1;
  }

  /**
   * Save current game state for persistence on backgrounding
   * Persists level index, grid, buses, stops, roads, moves, and selection state
   */
  saveGameState() {
    try {
      if (!this.state || this.state.won) {
        // Don't persist completed games
        storageSet(STATE_KEY, null);
        return;
      }

      const gameState = {
        currentLevelIndex: this.currentLevelIndex,
        isDailyMode: this.isDailyMode,
        grid: { ...this.state.grid },
        buses: this.state.buses.map(b => ({ ...b })),
        stops: this.state.stops.map(s => ({ x: s.x, y: s.y, color: s.color, waiting: [...s.waiting] })),
        exits: this.state.exits.map(e => ({ ...e })),
        roads: Array.from(this.state.roads),
        moves: this.state.moves,
        selectedBus: this.state.selectedBus,
      };
      storageSet(STATE_KEY, gameState);
    } catch (e) {
      // Silently fail if storage is unavailable
    }
  }

  /**
   * Restore game state from localStorage
   * Returns true if state was restored, false otherwise
   */
  restoreGameState() {
    try {
      const saved = storageGet(STATE_KEY, null);
      if (!saved) return false;

      // Only restore if we're on the same level
      if (saved.currentLevelIndex !== this.currentLevelIndex) return false;
      if (saved.isDailyMode !== this.isDailyMode) return false;

      // Restore the game state
      this.state = {
        grid: { ...saved.grid },
        buses: saved.buses.map(b => ({ ...b })),
        stops: saved.stops.map(s => ({ x: s.x, y: s.y, color: s.color, waiting: [...s.waiting] })),
        exits: saved.exits.map(e => ({ ...e })),
        roads: new Set(saved.roads),
        moves: saved.moves || 0,
        selectedBus: saved.selectedBus || null,
        animating: false,
        won: false,
      };

      // Recreate history with restored state as base
      this.history.clear();
      this.history.push(cloneState(this.state));

      // Re-render the restored state
      this.render();
      this.updateUI();

      // Clear the saved state after restoration
      storageSet(STATE_KEY, null);

      return true;
    } catch (e) {
      // Silently fail if restoration fails
      return false;
    }
  }
}

// Initialize game on load
document.addEventListener('DOMContentLoaded', () => {
  const game = new BusJamGame();
  game.init();
});

export { BusJamGame };
export default BusJamGame;
