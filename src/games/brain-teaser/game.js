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
import { createLevelNav } from '../../shared/level-nav.js';
import { isGameDailyCompleted } from '../../shared/daily.js';

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
import { createRetryOverlay, ResultType } from '../../shared/retry.js';
import { quickShare, generateShareText } from '../../shared/share.js';
import { getGameDailyNumericSeed, completeDailyChallenge } from '../../shared/daily.js';
import { setupPuzzleVisibilityHandler } from '../../shared/lifecycle.js';
import { set as storageSet, get as storageGet } from '../../shared/storage.js';

// Game constants
const GAME_ID = 'brain-teaser';
const LEVELS_URL = './levels.json';
const STATE_KEY = `mg:${GAME_ID}:progress`;

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

    // Daily challenge mode (reachable via ?daily=true)
    this.isDailyMode = false;
    this.state = null;
    this.renderer = null;
    this.input = null;
    this.hintSession = null;

    // Shared win retry overlay (created per level)
    this.retryOverlay = null;
    this.lastStars = 0;

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

      // Load saved progress
      this.loadProgress();

      // Daily challenge mode (?daily=true). Brain Teaser has no procedural
      // generator, so the daily puzzle is chosen deterministically from the
      // existing set: levelIndex = seed % puzzles.length.
      const urlParams = new URLSearchParams(window.location.search);
      this.isDailyMode = urlParams.get('daily') === 'true';
      if (this.isDailyMode) this.generateDailyLevel();

      // Create initial state first (needed for Phaser scene)
      const puzzle = this.puzzles[this.currentPuzzleIndex];
      this.state = createInitialState(puzzle);

      // Create renderer (Phaser game initialized with initial state)
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
      this.input.init();

      // Setup event listeners
      this.setupEventListeners();

      // Level-select strip (must exist before startPuzzle so the board sizes
      // around it)
      this.initLevelNav();

      // Start game
      this.startPuzzle(this.currentPuzzleIndex);

      // Setup visibility handler for state persistence on backgrounding
      setupPuzzleVisibilityHandler({
        onSave: () => this.saveGameState()
      });

      // Check for persisted state and restore it
      this.restoreGameState();

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
   * Select today's daily puzzle deterministically. Brain Teaser has no
   * procedural generator, so the plan's fallback applies:
   * levelIndex = seed % puzzles.length.
   */
  generateDailyLevel() {
    if (!this.puzzles.length) return;
    const seed = getGameDailyNumericSeed(GAME_ID);
    this.currentPuzzleIndex = seed % this.puzzles.length;
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
      totalLevels: this.puzzles.length,
      hasDaily: true,
      dailyCompleted: isGameDailyCompleted(GAME_ID),
      onLevelSelect: (index, restart) => {
        if (restart) {
          this.restartPuzzle();
        } else {
          this.startPuzzle(index);
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
        // For drag: highlight the source; for sequence: highlight next step; for tap: highlight target
        let hintId;
        if (move.action === 'drag' && move.sourceId) hintId = move.sourceId;
        else if (move.action === 'sequence' && move.steps?.length) {
          const nextIdx = this.state?.currentSequence?.length ?? 0;
          hintId = move.steps[Math.min(nextIdx, move.steps.length - 1)];
        } else hintId = move.targetId;
        if (this.renderer) this.renderer.setHintTarget(hintId);
        // Also show text hint
        this.showTextHint();
      },
      onShowMove: ({ move }) => {
        // At level 2: for sequence show next step, otherwise show target
        let hintId;
        if (move.action === 'sequence' && move.steps?.length) {
          const nextIdx = this.state?.currentSequence?.length ?? 0;
          hintId = move.steps[Math.min(nextIdx, move.steps.length - 1)];
        } else hintId = move.targetId;
        if (this.renderer) this.renderer.setHintTarget(hintId);
        this.showTextHint();
      },
      onAutoPlay: ({ move }) => {
        if (this.renderer) this.renderer.setHintTarget(null);
        this.handleAction(move);
      },
      onTokensEmpty: () => { this.updateHintButton(); },
    });
    this.updateHintButton();
    this.initRetryOverlay(index);

    // Resize and render
    this.handleResize();
    this.updateUI();

    // Announce for screen readers
    announce(`Puzzle ${index + 1}: ${puzzle.title}. ${puzzle.prompt}`);
  }

  /**
   * (Re)create the shared win retry overlay for the given level.
   *
   * A fresh instance per level keeps the persisted failure count scoped to
   * gameId:levelIndex (so "Skip Level" appears after 3 fails on THIS level).
   */
  initRetryOverlay(index) {
    if (this.retryOverlay) this.retryOverlay.destroy();
    this.retryOverlay = createRetryOverlay({
      container: document.body,
      gameId: GAME_ID,
      levelIndex: index,
      onRetry: () => this.restartPuzzle(),
      onNext: () => this.nextPuzzle(),
      onSkip: () => this.nextPuzzle(),
      onHint: () => {
        this.restartPuzzle();
        if (this.hintSession) this.hintSession.showHint();
        this.updateHintButton();
      },
      onShare: (stats) => {
        quickShare({
          title: 'Brain Teaser',
          text: generateShareText({
            gameName: 'Brain Teaser',
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

    // Mark today's daily challenge complete (once per daily-mode win)
    if (this.isDailyMode) completeDailyChallenge(GAME_ID);

    // Save progress
    await this.saveProgress();

    // Advance the level-select strip: mark this level complete, unlock + advance
    if (this.levelNav) {
      if (this.isDailyMode) {
        this.levelNav.completeDaily();
      } else {
        this.levelNav.completeLevel(this.currentPuzzleIndex);
      }
    }

    // Play celebration animation
    await this.renderer.playAnimation({ type: 'celebration' });

    // Show the shared win overlay (attempts as "moves", solve time in seconds).
    const moves = this.state.attempts + 1;
    const solveTime = Date.now() - (this.levelStartTime || Date.now());
    this.retryOverlay.show(ResultType.WIN, {
      moves,
      time: Math.round(solveTime / 1000),
    });

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
    this.levelDisplay.textContent = this.isDailyMode ? 'Daily' : this.currentPuzzleIndex + 1;
    this.attemptsDisplay.textContent = this.state.attempts;
    this.levelProgress.textContent = this.isDailyMode
      ? 'Daily Challenge'
      : `Puzzle ${this.currentPuzzleIndex + 1} / ${this.puzzles.length}`;

    // Update buttons
    this.btnPrev.disabled = this.currentPuzzleIndex === 0;
    this.btnNext.disabled = this.currentPuzzleIndex >= this.puzzles.length - 1;
  }

  /**
   * Save current game state for persistence on backgrounding
   * Persists puzzle index and current attempts
   */
  saveGameState() {
    try {
      if (!this.state || this.state.status === 'solved') {
        // Don't persist solved puzzles
        storageSet(STATE_KEY, null);
        return;
      }

      const gameState = {
        currentPuzzleIndex: this.currentPuzzleIndex,
        isDailyMode: this.isDailyMode,
        attempts: this.state.attempts,
        status: this.state.status,
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

      // Only restore if we're on the same puzzle
      if (saved.currentPuzzleIndex !== this.currentPuzzleIndex) return false;
      if (saved.isDailyMode !== this.isDailyMode) return false;

      // Restore the game state
      this.state.attempts = saved.attempts ?? 0;
      this.state.status = saved.status || 'choosing';

      this.updateUI();
      this.render();

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
  const game = new BrainTeaserGame();
  game.init();
});

export { BrainTeaserGame };
export default BrainTeaserGame;
