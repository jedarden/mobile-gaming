/**
 * Bus Jam - Main Game Logic
 *
 * Orchestrates the Bus Jam puzzle game with:
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
  getBusAt,
  getStopAt,
  isRoad,
  isExit,
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
import { audio } from './audio.js';

// Game constants
const GAME_ID = 'bus-jam';
const LEVELS_URL = './levels.json';

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
    this.selectedBus = null;
    this.pathPreview = null;
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
    this.selectedBus = null;
    this.pathPreview = null;
    this.animating = false;

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

    const scale = this.renderer.scale;
    const gridPos = this.renderer.canvasToGrid(canvasX, canvasY, scale);

    this.handleClickAt(gridPos.x, gridPos.y);
  }

  /**
   * Handle click at grid position
   */
  handleClickAt(gridX, gridY) {
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
   * Handle canvas mouse move for path preview
   */
  handleCanvasMove(e) {
    if (this.animating || this.state.won || !this.selectedBus) return;

    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const scale = this.renderer.scale;
    const gridPos = this.renderer.canvasToGrid(canvasX, canvasY, scale);

    const bus = this.state.buses.find(b => b.id === this.selectedBus);
    if (!bus) return;

    // Update path preview
    if (isRoad(this.state, gridPos.x, gridPos.y) && !getBusAt(this.state, gridPos.x, gridPos.y)) {
      const path = findPath(this.state, bus, gridPos.x, gridPos.y);
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
    const level = this.levels[this.currentLevelIndex];

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
}

// Initialize game on load
document.addEventListener('DOMContentLoaded', () => {
  const game = new BusJamGame();
  game.init();
});

export { BusJamGame };
export default BusJamGame;
