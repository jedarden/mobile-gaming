/**
 * Brain Teaser - Main Game Logic
 *
 * Orchestrates the Brain Teaser puzzle game with:
 * - Puzzle state management
 * - Canvas rendering with animations
 * - User input handling for tap/drag/sequence
 * - Level progression
 * - Integration with shared systems
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';

import {
  createInitialState,
  applyAction,
  getHint,
  validatePuzzle
} from './state.js';

import { createRenderer } from './renderer.js';
import { createInput } from './input.js';
import { audio } from './audio.js';
import { haptic } from '../../shared/haptics.js';
import { recordLevel } from '../../shared/adaptive.js';
import { createHintSession, getHintTokens } from '../../shared/hints.js';

// Game constants
const GAME_ID = 'brain-teaser';
const LEVELS_URL = './levels.json';

class BrainTeaserGame {
  constructor() {
    // DOM elements
    this.canvas = document.getElementById('game-canvas');
    this.levelDisplay = document.getElementById('level-display');
    this.attemptsDisplay = document.getElementById('attempts-display');
    this.levelProgress = document.getElementById('level-progress');
    this.hintText = document.getElementById('hint-text');

    // Buttons
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
    this.puzzles = [];
    this.currentPuzzleIndex = 0;
    this.state = null;
    this.renderer = null;
    this.input = null;
    this.hintSession = null;

    // Interaction state
    this.animating = false;

    // Bind methods
    this.handleCanvasClick = this.handleCanvasClick.bind(this);
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

      // Load puzzles
      await this.loadPuzzles();

      // Create renderer
      this.renderer = createRenderer(this.canvas);
      this.renderer.setReducedMotion(isReducedMotionEnabled());

      // Create input handler
      this.input = createInput({
        canvas: this.canvas,
        renderer: this.renderer,
        getState: () => this.state,
        onTapAction: (element, action) => this.handleAction(action),
        onDragStart: (element) => this.handleDragStart(element),
        onDragMove: (element, dx, dy) => this.handleDragMove(element, dx, dy),
        onDragEnd: (source, target) => this.handleDragEnd(source, target)
      });

      // Load saved progress
      this.loadProgress();

      // Setup event listeners
      this.setupEventListeners();

      // Start game
      this.startPuzzle(this.currentPuzzleIndex);

      console.log('Brain Teaser initialized');
    } catch (error) {
      console.error('Failed to initialize Brain Teaser:', error);
    }
  }

  /**
   * Load puzzles from JSON
   */
  async loadPuzzles() {
    try {
      const response = await fetch(LEVELS_URL);
      this.puzzles = await response.json();

      // Validate all puzzles
      this.puzzles.forEach((puzzle, i) => {
        const validation = validatePuzzle(puzzle);
        if (!validation.valid) {
          console.warn(`Puzzle ${i} (${puzzle.id}) has issues:`, validation.errors);
        }
      });
    } catch (error) {
      console.error('Failed to load puzzles:', error);
      // Fallback to embedded puzzle
      this.puzzles = [this.getDefaultPuzzle()];
    }
  }

  /**
   * Get default fallback puzzle
   */
  getDefaultPuzzle() {
    return {
      id: 'bt-default',
      title: 'Find the Ball',
      prompt: 'Which cup is hiding the ball?',
      type: 'tap',
      elements: [
        { id: 'cup1', type: 'cup', x: 50, y: 250, w: 80, h: 100, clickable: true },
        { id: 'cup2', type: 'cup', x: 155, y: 250, w: 80, h: 100, clickable: true },
        { id: 'cup3', type: 'cup', x: 260, y: 250, w: 80, h: 100, clickable: true },
        { id: 'ball', type: 'ball', x: 180, y: 330, w: 30, h: 30, hidden: true, zIndex: -1 }
      ],
      solution: { action: 'tap', targetId: 'cup2' },
      decoyActions: [
        { action: 'tap', targetId: 'cup1', response: 'shake', message: 'Not here!' },
        { action: 'tap', targetId: 'cup3', response: 'shake', message: 'Try again!' }
      ],
      hint: 'Look closely at the shadows',
      difficulty: 1
    };
  }

  /**
   * Load saved progress
   */
  loadProgress() {
    const stats = getGameStats(GAME_ID);
    this.currentPuzzleIndex = Math.min(stats.lastLevel || 0, this.puzzles.length - 1);
  }

  /**
   * Save progress
   */
  async saveProgress() {
    await updateGameStats(GAME_ID, {
      lastLevel: this.currentPuzzleIndex
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Canvas events
    this.canvas.addEventListener('click', this.handleCanvasClick);
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('keydown', this.handleKeyDown);

    // Buttons
    this.btnHint.addEventListener('click', () => this.showHint());
    this.btnRestart.addEventListener('click', () => this.restartPuzzle());
    this.btnPrev.addEventListener('click', () => this.prevPuzzle());
    this.btnNext.addEventListener('click', () => this.nextPuzzle());
    this.btnSound.addEventListener('click', () => this.toggleSound());
    this.btnSettings.addEventListener('click', () => this.showSettings());

    // Win overlay buttons
    document.getElementById('btn-replay').addEventListener('click', () => {
      this.hideWinOverlay();
      this.restartPuzzle();
    });
    document.getElementById('btn-next-level').addEventListener('click', () => {
      this.hideWinOverlay();
      this.nextPuzzle();
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

    // Initialize input
    this.input.init();
  }

  /**
   * Start a puzzle
   */
  startPuzzle(index) {
    if (index < 0 || index >= this.puzzles.length) return;

    this.levelStartTime = Date.now();
    if (index !== this.currentPuzzleIndex) this.levelRetries = 0;
    this.currentPuzzleIndex = index;
    const puzzle = this.puzzles[index];

    // Create initial state
    this.state = createInitialState(puzzle);

    // Reset interaction state
    this.animating = false;

    // Reset hint session
    if (this.hintSession) this.hintSession.destroy();
    if (this.renderer) this.renderer.setHintTarget(null);
    this.hintSession = createHintSession({
      gameId: GAME_ID,
      level: puzzle,
      getState: () => this.state,
      onHighlight: ({ move }) => {
        // For drag actions highlight the source (what to pick up); for tap highlight the target
        const hintId = (move.action === 'drag' && move.sourceId) ? move.sourceId : move.targetId;
        if (this.renderer) this.renderer.setHintTarget(hintId);
        // Also show text hint
        this.showTextHint();
      },
      onShowMove: ({ move }) => {
        // At level 2, show the destination/target regardless of action type
        if (this.renderer) this.renderer.setHintTarget(move.targetId);
        this.showTextHint();
      },
      onAutoPlay: ({ move }) => {
        if (this.renderer) this.renderer.setHintTarget(null);
        this.handleAction(move);
      },
      onTokensEmpty: () => { this.updateHintButton(); },
    });
    this.updateHintButton();

    // Resize and render
    this.handleResize();
    this.updateUI();

    // Announce for screen readers
    announce(`Puzzle ${index + 1}: ${puzzle.title}. ${puzzle.prompt}`);
  }

  /**
   * Restart current puzzle
   */
  restartPuzzle() {
    this.levelRetries = (this.levelRetries || 0) + 1;
    if (this.hintSession) this.hintSession.reset();
    this.startPuzzle(this.currentPuzzleIndex);
    audio.playSelect();
  }

  /**
   * Handle canvas click (backup for input handler)
   */
  handleCanvasClick(e) {
    if (this.animating || this.state.status === 'solved') return;

    e.preventDefault();
    audio.resume();
  }

  /**
   * Handle player action
   */
  async handleAction(action) {
    if (this.animating || this.state.status === 'solved') return;

    // Clear hint highlight on any player action
    if (this.renderer) this.renderer.setHintTarget(null);

    this.animating = true;
    audio.resume();

    // Apply action to state
    const newState = applyAction(this.state, action);
    this.state = newState;

    // Handle result
    if (newState.status === 'solved') {
      await this.handleSolved();
    } else if (newState.animation) {
      // Play decoy animation
      this.render();
      haptic('error');
      await this.renderer.playAnimation(newState.animation);
      this.state = { ...this.state, animation: null };
    }

    this.animating = false;
    this.render();
    this.updateUI();
  }

  /**
   * Handle drag start
   */
  handleDragStart(_element) {
    if (this.animating || this.state.status === 'solved') return;
    audio.playSelect();
  }

  /**
   * Handle drag move
   */
  handleDragMove(_element, _dx, _dy) {
    // Could add visual feedback here
  }

  /**
   * Handle drag end
   */
  handleDragEnd(source, target) {
    if (this.animating || this.state.status === 'solved') return;

    const action = {
      action: 'drag',
      sourceId: source.id,
      targetId: target.id
    };

    this.handleAction(action);
  }

  /**
   * Handle puzzle solved
   */
  async handleSolved() {
    audio.playWin();
    haptic('win');

    // Record adaptive difficulty signal
    recordLevel(GAME_ID, { retryCount: this.levelRetries || 0, solveTime: Date.now() - (this.levelStartTime || Date.now()), hintUsage: this.hintSession?.level ?? 0 }, { won: true });

    // Update stats
    await updateGameStats(GAME_ID, {
      played: 1,
      completed: 1
    });

    // Award XP
    await awardLevelComplete(GAME_ID, 1, { attempts: this.state.attempts });

    // Save progress
    await this.saveProgress();

    // Play celebration animation
    await this.renderer.playAnimation({ type: 'celebration' });

    // Show win overlay
    this.showWinOverlay();

    announce(`Puzzle solved! ${this.state.attempts} attempts.`);
  }

  /**
   * Show win overlay
   */
  showWinOverlay() {
    document.getElementById('puzzle-title').textContent = this.state.puzzle.title;
    document.getElementById('attempts-summary').textContent =
      `Solved in ${this.state.attempts + 1} ${this.state.attempts === 0 ? 'try' : 'tries'}!`;

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
   * Show next progressive hint level via shared hint session.
   */
  showHint() {
    if (this.hintSession) this.hintSession.showHint();
    this.updateHintButton();
  }

  /**
   * Show text hint from puzzle definition (used by hint session callbacks).
   */
  showTextHint() {
    const hint = getHint(this.state);
    if (hint) {
      this.hintText.textContent = hint;
      this.hintText.classList.add('visible');
      setTimeout(() => this.hintText.classList.remove('visible'), 3000);
      audio.playSelect();
      announce(`Hint: ${hint}`);
    }
  }

  /**
   * Update hint button label with remaining token count.
   */
  updateHintButton() {
    if (!this.btnHint) return;
    const tokens = getHintTokens();
    this.btnHint.textContent = `Hint (${tokens})`;
    this.btnHint.disabled = tokens <= 0;
  }

  /**
   * Previous puzzle
   */
  prevPuzzle() {
    if (this.currentPuzzleIndex > 0) {
      this.startPuzzle(this.currentPuzzleIndex - 1);
      audio.playSelect();
    }
  }

  /**
   * Next puzzle
   */
  nextPuzzle() {
    if (this.currentPuzzleIndex < this.puzzles.length - 1) {
      this.startPuzzle(this.currentPuzzleIndex + 1);
      audio.playSelect();
    }
  }

  /**
   * Toggle sound
   */
  toggleSound() {
    const muted = audio.toggleMute();
    const span = this.btnSound.querySelector('span[aria-hidden="true"]') || document.createElement('span');
    span.setAttribute('aria-hidden', 'true');
    span.textContent = muted ? '🔇' : '🔊';
    if (!span.parentElement) {
      this.btnSound.appendChild(span);
    }
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
    if (this.animating) return;

    switch (e.key) {
      case 'r':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.restartPuzzle();
        }
        break;
      case 'h':
        this.showHint();
        break;
      case 'ArrowLeft':
        this.prevPuzzle();
        break;
      case 'ArrowRight':
        this.nextPuzzle();
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
    this.levelDisplay.textContent = this.currentPuzzleIndex + 1;
    this.attemptsDisplay.textContent = this.state.attempts;
    this.levelProgress.textContent = `Puzzle ${this.currentPuzzleIndex + 1} / ${this.puzzles.length}`;

    // Update buttons
    this.btnPrev.disabled = this.currentPuzzleIndex === 0;
    this.btnNext.disabled = this.currentPuzzleIndex >= this.puzzles.length - 1;
  }
}

// Initialize game on load
document.addEventListener('DOMContentLoaded', () => {
  const game = new BrainTeaserGame();
  game.init();
});

export { BrainTeaserGame };
export default BrainTeaserGame;
