/**
 * Pull the Pin - Main Game Logic
 *
 * Orchestrates the Pull the Pin puzzle game with:
 * - Game state management
 * - Canvas rendering
 * - User input handling
 * - Level progression
 * - Infinite mode integration
 * - Integration with shared systems
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete, getLevelInfo } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { getDailyChallenge, completeDailyChallenge, getGameDailySeed, isDailyCompleted } from '../../shared/daily.js';
import { createRNG } from '../../shared/rng.js';

import {
  initInfiniteMode,
  isInfiniteMode,
  toggleInfiniteMode,
  setInfiniteMode,
  getSeed,
  setSeed,
  generateNewSeed,
  getDifficulty,
  setDifficulty,
  getDifficultyConfig,
  getDifficultyOptions,
  startInfiniteSession,
  endInfiniteSession,
  recordPuzzleAttempt,
  recordPuzzleCompletion,
  recordPuzzleFailure,
  getSessionStats,
  formatSeed,
  parseSeed,
  createInfiniteRNG,
  generateLevelParams,
  DIFFICULTY_CONFIG
} from '../../shared/infinite-mode.js';

import {
  createInitialState,
  cloneState,
  removePin,
  completePinRemoval,
  checkWinLose,
  updateState,
  createHistory,
  calculateStars,
  getHint,
  PhysicsEngine,
  BALL_TYPES
} from './state.js';

import { createRenderer } from './renderer.js';
import * as audio from './audio.js';
import { createUndoTimeline } from '../../shared/undo-timeline.js';

// Game constants
const GAME_ID = 'pull-the-pin';
const LEVELS_URL = './levels.json';

class PullThePinGame {
  constructor() {
    // DOM elements
    this.canvas = document.getElementById('game-canvas');
    this.levelDisplay = document.getElementById('level-display');
    this.movesDisplay = document.getElementById('moves-display');
    this.ballsDisplay = document.getElementById('balls-display');
    this.levelProgress = document.getElementById('level-progress');

    // Buttons
    this.btnUndo = document.getElementById('btn-undo');
    this.btnHint = document.getElementById('btn-hint');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnPrev = document.getElementById('btn-prev');
    this.btnNext = document.getElementById('btn-next');
    this.btnSound = document.getElementById('btn-sound');
    this.btnSettings = document.getElementById('btn-settings');

    // Infinite mode elements
    this.infinitePanel = document.getElementById('infinite-panel');
    this.infiniteToggle = document.getElementById('infinite-toggle');
    this.infiniteControls = document.getElementById('infinite-controls');
    this.seedInput = document.getElementById('seed-input');
    this.btnNewSeed = document.getElementById('btn-new-seed');
    this.btnShareSeed = document.getElementById('btn-share-seed');
    this.difficultyBtns = document.querySelectorAll('.difficulty-btn');
    this.levelNav = document.getElementById('level-nav');
    this.nextPuzzleSection = document.getElementById('next-puzzle-section');
    this.btnNextPuzzle = document.getElementById('btn-next-puzzle');
    
    // Session stats elements
    this.statCompleted = document.getElementById('stat-completed');
    this.statStreak = document.getElementById('stat-streak');
    this.statTime = document.getElementById('stat-time');
    this.btnResetStats = document.getElementById('btn-reset-stats');

    // Overlays
    this.winOverlay = document.getElementById('win-overlay');
    this.loseOverlay = document.getElementById('lose-overlay');
    this.settingsOverlay = document.getElementById('settings-overlay');

    // Undo timeline
    this.undoTimelineContainer = document.getElementById('undo-timeline-container');
    this.undoTimeline = null;

    // Game state
    this.levels = [];
    this.currentLevelIndex = 0;
    this.state = null;
    this.history = createHistory(50);
    this.renderer = null;
    this.physics = new PhysicsEngine();

    // Animation state
    this.animating = false;
    this.gameLoop = null;

    // Daily challenge
    this.isDailyMode = false;
    this.dailySeed = null;

    // Bind methods
    this.handleCanvasClick = this.handleCanvasClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.update = this.update.bind(this);
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

      // Initialize infinite mode
      initInfiniteMode();

      // Load levels
      await this.loadLevels();

      // Create renderer
      this.renderer = createRenderer(this.canvas);
      this.renderer.setReducedMotion(isReducedMotionEnabled());

      // Initialize undo timeline
      this.initUndoTimeline();

      // Check for daily mode
      const urlParams = new URLSearchParams(window.location.search);
      this.isDailyMode = urlParams.get('daily') === 'true';
      
      // Check for shared seed in URL
      const sharedSeed = urlParams.get('seed');
      if (sharedSeed) {
        await setSeed(sharedSeed);
        await setInfiniteMode(true);
      }

      if (this.isDailyMode) {
        this.dailySeed = getGameDailySeed(GAME_ID);
        this.generateDailyLevel();
      }

      // Load saved progress
      this.loadProgress();

      // Setup event listeners
      this.setupEventListeners();
      this.setupInfiniteModeListeners();

      // Start game
      if (isInfiniteMode()) {
        this.startInfinitePuzzle();
        this.updateInfiniteModeUI();
      } else {
        this.startLevel(this.currentLevelIndex);
      }

      // Update session stats display
      this.updateSessionStatsDisplay();

      console.log('Pull the Pin initialized');
    } catch (error) {
      console.error('Failed to initialize Pull the Pin:', error);
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
      // Fallback to embedded levels
      this.levels = this.getDefaultLevels();
    }
  }

  /**
   * Get default fallback levels
   */
  getDefaultLevels() {
    return [
      {
        id: 1,
        grid: { width: 300, height: 400 },
        balls: [
          { id: 'b1', x: 150, y: 50, radius: 12, type: 'gold' },
          { id: 'b2', x: 150, y: 80, radius: 12, type: 'gold' }
        ],
        pins: [
          { id: 'p1', x: 150, y: 120, length: 80, angle: 0 }
        ],
        hazards: [],
        goals: [
          { id: 'g1', x: 100, y: 350, width: 100, height: 40, required: 2 }
        ],
        walls: [
          { x1: 50, y1: 100, x2: 50, y2: 300 },
          { x1: 250, y1: 100, x2: 250, y2: 300 }
        ],
        requiredBalls: 2
      }
    ];
  }

  /**
   * Initialize the undo timeline component
   */
  initUndoTimeline() {
    // Create thumbnail renderer function
    const renderThumbnail = (state, canvas, scale) => {
      const ctx = canvas.getContext('2d');
      const width = 40;
      const height = 60;

      // Clear canvas
      ctx.clearRect(0, 0, width * 2, height * 2);

      // Draw background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, width, height);

      // Calculate scale to fit game state in thumbnail
      const thumbScale = Math.min(width / 300, height / 400) * 2;

      ctx.save();
      ctx.scale(thumbScale, thumbScale);

      // Draw simplified game state
      this.renderThumbnailState(ctx, state, thumbScale);

      ctx.restore();
    };

    // Create timeline instance
    this.undoTimeline = createUndoTimeline({
      container: this.undoTimelineContainer,
      renderThumbnail,
      onStateChange: (state, index) => {
        // Restore state from timeline
        this.state = state;
        this.updateUI();
        this.render();
        audio.playPinRemove();
        announce(`Jumped to move ${index + 1}`);
      },
      thumbnailWidth: 40,
      thumbnailHeight: 60,
      maxThumbnails: 15
    });
  }

  /**
   * Render simplified game state for thumbnail
   */
  renderThumbnailState(ctx, state, scale) {
    // Draw walls
    ctx.strokeStyle = '#4A4A5A';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const wall of state.walls) {
      ctx.beginPath();
      ctx.moveTo(wall.x1 * scale, wall.y1 * scale);
      ctx.lineTo(wall.x2 * scale, wall.y2 * scale);
      ctx.stroke();
    }

    // Draw hazards (simplified)
    for (const hazard of state.hazards) {
      ctx.fillStyle = hazard.type === 'lava' ? '#FF4500' : '#444';
      ctx.fillRect(
        hazard.x * scale,
        hazard.y * scale,
        hazard.width * scale,
        hazard.height * scale
      );
    }

    // Draw goals (simplified)
    for (const goal of state.goals) {
      ctx.fillStyle = '#00C853';
      ctx.globalAlpha = 0.7;
      ctx.fillRect(
        goal.x * scale,
        goal.y * scale,
        goal.width * scale,
        goal.height * scale
      );
      ctx.globalAlpha = 1;
    }

    // Draw pins (simplified)
    for (const pin of state.pins) {
      if (pin.removed) continue;

      const x = pin.x * scale;
      const y = pin.y * scale;
      const length = pin.length * scale;
      const halfLength = length / 2;
      const cos = Math.cos(pin.angle);
      const sin = Math.sin(pin.angle);

      ctx.strokeStyle = pin.removing ? '#FF6B6B' : '#C0C0C0';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - halfLength * cos, y - halfLength * sin);
      ctx.lineTo(x + halfLength * cos, y + halfLength * sin);
      ctx.stroke();
    }

    // Draw balls (simplified)
    for (const ball of state.balls) {
      if (ball.collected || ball.destroyed) continue;

      const x = ball.x * scale;
      const y = ball.y * scale;
      const r = ball.radius * scale;

      // Simple gradient
      const gradient = ctx.createRadialGradient(
        x - r * 0.3, y - r * 0.3, 0,
        x, y, r
      );

      const ballType = BALL_TYPES[ball.type] || BALL_TYPES.gold;
      gradient.addColorStop(0, ballType.gradient[0]);
      gradient.addColorStop(1, ballType.color);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Generate daily challenge level
   */
  generateDailyLevel() {
    const rng = createRNG(this.dailySeed);
    const level = this.generateRandomLevel(rng, 0.5);
    level.id = 'daily';
    this.levels = [level];
  }

  /**
   * Generate random level using RNG and difficulty
   */
  generateRandomLevel(rng, difficulty = 0.5) {
    const difficultyConfig = getDifficultyConfig() || DIFFICULTY_CONFIG.medium;
    
    const gridWidth = 300;
    const gridHeight = 400;
    
    // Generate balls
    const ballCount = rng.int(difficultyConfig.ballCount.min, difficultyConfig.ballCount.max);
    const balls = [];
    const ballTypes = ['gold', 'silver', 'bronze'];
    
    for (let i = 0; i < ballCount; i++) {
      balls.push({
        id: `ball_${i}`,
        x: rng.float(80, gridWidth - 80),
        y: rng.float(40, 100),
        radius: 12,
        type: rng.pick(ballTypes)
      });
    }

    // Generate pins
    const pinCount = rng.int(difficultyConfig.pinCount.min, difficultyConfig.pinCount.max);
    const pins = [];
    
    for (let i = 0; i < pinCount; i++) {
      const y = 120 + i * 60;
      pins.push({
        id: `pin_${i}`,
        x: rng.float(100, gridWidth - 100),
        y: rng.float(y, y + 30),
        length: rng.float(60, 100),
        angle: rng.float(-0.3, 0.3)
      });
    }

    // Generate hazards (optional)
    const hazards = [];
    if (rng.bool(difficultyConfig.hazardChance)) {
      hazards.push({
        id: 'hazard_1',
        type: 'lava',
        x: rng.float(50, gridWidth - 150),
        y: rng.float(250, 300),
        width: rng.float(60, 100),
        height: 30
      });
    }

    // Generate goal
    const goal = {
      id: 'goal_1',
      x: gridWidth / 2 - 50,
      y: gridHeight - 50,
      width: 100,
      height: 40,
      required: ballCount
    };

    // Generate walls (boundary walls)
    const walls = [
      { x1: 30, y1: 30, x2: 30, y2: gridHeight - 60 },
      { x1: gridWidth - 30, y1: 30, x2: gridWidth - 30, y2: gridHeight - 60 }
    ];

    return {
      id: `infinite_${Date.now()}`,
      grid: { width: gridWidth, height: gridHeight },
      balls,
      pins,
      hazards,
      goals: [goal],
      walls,
      requiredBalls: ballCount
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
    // Canvas events
    this.canvas.addEventListener('click', this.handleCanvasClick);
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
      if (isInfiniteMode()) {
        this.startNextInfinitePuzzle();
      } else {
        this.nextLevel();
      }
    });

    // Lose overlay
    document.getElementById('btn-retry').addEventListener('click', () => {
      this.hideLoseOverlay();
      this.restartLevel();
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
   * Setup infinite mode event listeners
   */
  setupInfiniteModeListeners() {
    // Toggle infinite mode
    this.infiniteToggle.addEventListener('change', async (e) => {
      await setInfiniteMode(e.target.checked);
      this.updateInfiniteModeUI();
      
      if (e.target.checked) {
        this.startInfinitePuzzle();
      } else {
        this.startLevel(this.currentLevelIndex);
      }
    });

    // Seed input
    this.seedInput.addEventListener('change', async (e) => {
      const seed = parseSeed(e.target.value);
      if (seed !== null) {
        await setSeed(seed);
        if (isInfiniteMode()) {
          this.startInfinitePuzzle();
        }
      }
    });

    this.seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.target.blur();
      }
    });

    // New seed button
    this.btnNewSeed.addEventListener('click', async () => {
      await generateNewSeed();
      this.seedInput.value = formatSeed(getSeed());
      if (isInfiniteMode()) {
        this.startInfinitePuzzle();
      }
    });

    // Share seed button
    this.btnShareSeed.addEventListener('click', () => {
      this.shareSeed();
    });

    // Difficulty buttons
    this.difficultyBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const difficulty = btn.dataset.difficulty;
        await setDifficulty(difficulty);
        this.updateDifficultyUI();
        
        // Generate new level with new difficulty
        if (isInfiniteMode()) {
          this.startInfinitePuzzle();
        }
      });
    });

    // Reset stats button
    this.btnResetStats.addEventListener('click', () => {
      startInfiniteSession();
      this.updateSessionStatsDisplay();
    });

    // Next puzzle button
    this.btnNextPuzzle.addEventListener('click', () => {
      this.startNextInfinitePuzzle();
    });

    // Listen for infinite mode changes from other sources
    window.addEventListener('infiniteModeChanged', (e) => {
      this.infiniteToggle.checked = e.detail.enabled;
      this.updateInfiniteModeUI();
    });
  }

  /**
   * Update infinite mode UI state
   */
  updateInfiniteModeUI() {
    const enabled = isInfiniteMode();
    
    // Update panel
    this.infinitePanel.classList.toggle('active', enabled);
    this.infiniteControls.style.display = enabled ? 'block' : 'none';
    this.infiniteToggle.checked = enabled;
    
    // Update seed input
    this.seedInput.value = formatSeed(getSeed());
    
    // Update difficulty
    this.updateDifficultyUI();
    
    // Show/hide level nav vs next puzzle button
    this.levelNav.style.display = enabled ? 'none' : 'flex';
    this.nextPuzzleSection.style.display = enabled ? 'flex' : 'none';
    
    // Update level display
    if (enabled) {
      this.levelDisplay.textContent = '∞';
      this.levelProgress.textContent = 'Infinite Mode';
    }
  }

  /**
   * Update difficulty button UI
   */
  updateDifficultyUI() {
    const currentDifficulty = getDifficulty();
    this.difficultyBtns.forEach(btn => {
      const isSelected = btn.dataset.difficulty === currentDifficulty;
      btn.classList.toggle('selected', isSelected);
      btn.setAttribute('aria-checked', isSelected);
    });
  }

  /**
   * Update session stats display
   */
  updateSessionStatsDisplay() {
    const stats = getSessionStats();
    this.statCompleted.textContent = stats.puzzlesCompleted;
    this.statStreak.textContent = stats.currentStreak;
    this.statTime.textContent = stats.durationFormatted;
  }

  /**
   * Share seed via clipboard
   */
  async shareSeed() {
    const seed = getSeed();
    const url = `${window.location.origin}${window.location.pathname}?seed=${seed}`;
    
    try {
      await navigator.clipboard.writeText(url);
      this.showCopiedToast('Link copied!');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showCopiedToast('Link copied!');
    }
  }

  /**
   * Show copied toast notification
   */
  showCopiedToast(message) {
    const existing = document.querySelector('.seed-copied-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'seed-copied-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 2000);
  }

  /**
   * Start infinite mode puzzle
   */
  startInfinitePuzzle() {
    startInfiniteSession();
    recordPuzzleAttempt();

    const rng = createInfiniteRNG();
    const level = this.generateRandomLevel(rng);

    this.state = createInitialState(level);
    this.history.clear();
    this.history.push(cloneState(this.state));

    this.animating = false;

    this.handleResize();
    this.updateUI();
    this.startGameLoop();

    // Update undo timeline
    if (this.undoTimeline) {
      this.undoTimeline.setHistory(this.history);
    }

    announce(`Infinite puzzle started. Difficulty: ${getDifficulty()}`);
  }

  /**
   * Start next infinite puzzle
   */
  startNextInfinitePuzzle() {
    this.hideWinOverlay();
    this.startInfinitePuzzle();
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
    this.startGameLoop();

    // Update undo timeline
    if (this.undoTimeline) {
      this.undoTimeline.setHistory(this.history);
    }

    // Announce for screen readers
    announce(`Level ${index + 1} started. ${level.balls.length} balls, ${level.pins.length} pins.`);
  }

  /**
   * Start game loop
   */
  startGameLoop() {
    if (this.gameLoop) {
      cancelAnimationFrame(this.gameLoop);
    }
    this.gameLoop = requestAnimationFrame(this.update);
  }

  /**
   * Update game state (called each frame)
   */
  update() {
    if (this.state && !this.state.won && !this.state.lost) {
      updateState(this.state, this.physics);
      this.render();
      this.updateUI();
    }
    
    this.gameLoop = requestAnimationFrame(this.update);
  }

  /**
   * Restart current level
   */
  restartLevel() {
    if (isInfiniteMode()) {
      this.startInfinitePuzzle();
    } else {
      this.startLevel(this.currentLevelIndex);
    }
    audio.playPinRemove();
  }

  /**
   * Handle canvas click
   */
  handleCanvasClick(e) {
    if (this.animating || (this.state && (this.state.won || this.state.lost))) return;

    e.preventDefault();

    // Initialize audio on first interaction
    audio.init();

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;

    // Check if clicked on a pin
    const pin = this.renderer.getPinAtPosition(this.state, canvasX, canvasY);
    
    if (pin) {
      this.removePin(pin);
    }
  }

  /**
   * Remove a pin
   */
  async removePin(pin) {
    if (!removePin(this.state, pin.id)) return;

    this.history.push(cloneState(this.state));

    // Update undo timeline
    if (this.undoTimeline) {
      this.undoTimeline.refresh();
    }

    audio.playPinRemove();

    // Animate pin removal
    await this.renderer.animatePinRemoval(pin);
    completePinRemoval(this.state, pin.id);

    this.updateUI();
    this.render();
  }

  /**
   * Handle keyboard input
   */
  handleKeyDown(e) {
    if (this.animating || (this.state && (this.state.won || this.state.lost))) return;

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
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    if (this.state) {
      const level = this.levels[this.currentLevelIndex] || {
        grid: { width: 300, height: 400 }
      };
      this.renderer.resize(level.grid?.width || 300, level.grid?.height || 400);
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

    const level = this.levels[this.currentLevelIndex];
    const collected = this.state.balls.filter(b => b.collected).length;
    const active = this.state.balls.filter(b => !b.collected && !b.destroyed).length;
    const destroyed = this.state.balls.filter(b => b.destroyed).length;

    if (!isInfiniteMode()) {
      this.levelDisplay.textContent = this.isDailyMode ? 'Daily' : this.currentLevelIndex + 1;
      this.levelProgress.textContent = this.isDailyMode 
        ? 'Daily Challenge' 
        : `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;
    }

    this.movesDisplay.textContent = this.state.moves;
    this.ballsDisplay.textContent = active;

    // Update buttons
    this.btnUndo.disabled = !this.history.canUndo();
    if (!isInfiniteMode()) {
      this.btnPrev.disabled = this.currentLevelIndex === 0;
      this.btnNext.disabled = this.currentLevelIndex >= this.levels.length - 1;
    }

    // Check for win/lose
    if (this.state.won && !this.winOverlay.classList.contains('active')) {
      this.handleWin();
    } else if (this.state.lost && !this.loseOverlay.classList.contains('active')) {
      this.handleLose();
    }

    // Update session stats in infinite mode
    if (isInfiniteMode()) {
      this.updateSessionStatsDisplay();
    }
  }

  /**
   * Handle win condition
   */
  async handleWin() {
    const collected = this.state.balls.filter(b => b.collected).length;
    const total = this.state.balls.length;
    const stars = calculateStars(collected, this.state.requiredBalls, total);

    audio.playVictory();

    // Record completion in infinite mode
    if (isInfiniteMode()) {
      recordPuzzleCompletion(this.state.score);
      this.updateSessionStatsDisplay();
      
      // Update win overlay for infinite mode
      document.getElementById('btn-next-level').textContent = 'Next Puzzle →';
    } else {
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
      
      // Update win overlay for normal mode
      document.getElementById('btn-next-level').textContent = 'Next Level';
    }

    // Show win overlay
    this.showWinOverlay(stars, collected, total);

    announce(`Level complete! ${collected} balls collected. ${stars} stars!`);
  }

  /**
   * Handle lose condition
   */
  handleLose() {
    audio.playFailure();

    // Record failure in infinite mode
    if (isInfiniteMode()) {
      recordPuzzleFailure();
      this.updateSessionStatsDisplay();
    }

    // Show lose overlay
    this.showLoseOverlay();

    announce('Level failed. Try again!');
  }

  /**
   * Show win overlay
   */
  showWinOverlay(stars, collected, total) {
    const starsDisplay = document.getElementById('stars-display');
    const starElements = starsDisplay.querySelectorAll('.star');

    starElements.forEach((star, i) => {
      star.classList.toggle('filled', i < stars);
    });

    document.getElementById('stats-summary').textContent =
      `${collected}/${total} balls collected! Score: ${this.state.score}`;

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
   * Show lose overlay
   */
  showLoseOverlay() {
    const collected = this.state.balls.filter(b => b.collected).length;
    const destroyed = this.state.balls.filter(b => b.destroyed).length;
    
    document.getElementById('lose-summary').textContent =
      `${destroyed} balls lost. ${collected} collected.`;

    this.loseOverlay.classList.add('active');
    this.loseOverlay.setAttribute('aria-hidden', 'false');
  }

  /**
   * Hide lose overlay
   */
  hideLoseOverlay() {
    this.loseOverlay.classList.remove('active');
    this.loseOverlay.setAttribute('aria-hidden', 'true');
  }

  /**
   * Undo last move
   */
  undo() {
    if (!this.history.canUndo() || this.animating) return;

    const prevState = this.history.undo();
    if (prevState) {
      this.state = prevState;
      // Update undo timeline
      if (this.undoTimeline) {
        this.undoTimeline.setPosition(this.history.position);
      }
      this.updateUI();
      this.render();
      audio.playPinRemove();
    }
  }

  /**
   * Show hint
   */
  showHint() {
    const hint = getHint(this.state);
    if (hint) {
      // Flash the hint pin
      const pin = hint.pin;
      if (pin) {
        pin.highlighted = true;
        this.render();
        setTimeout(() => {
          pin.highlighted = false;
          this.render();
        }, 2000);
      }

      announce(hint.message);
      audio.playPinRemove();
    }
  }

  /**
   * Previous level
   */
  prevLevel() {
    if (this.currentLevelIndex > 0) {
      this.startLevel(this.currentLevelIndex - 1);
      audio.playPinRemove();
    }
  }

  /**
   * Next level
   */
  nextLevel() {
    if (this.currentLevelIndex < this.levels.length - 1) {
      this.startLevel(this.currentLevelIndex + 1);
      audio.playPinRemove();
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
}

// Initialize game on load
document.addEventListener('DOMContentLoaded', () => {
  const game = new PullThePinGame();
  game.init();
});

export { PullThePinGame };
export default PullThePinGame;
