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
import { completeDailyChallenge, getGameDailySeed, isGameDailyCompleted } from '../../shared/daily.js';
import { createLevelNav } from '../../shared/level-nav.js';

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
import { playSound, setSoundEnabled, resumeAudio } from '../../shared/audio.js';
import { recordLevel } from '../../shared/adaptive.js';
import { createHintSession, getHintTokens } from '../../shared/hints.js';
import { createRetryOverlay, ResultType } from '../../shared/retry.js';
import { quickShare, generateShareText } from '../../shared/share.js';
import { encodeState, decodeState, isStateHash } from '../../shared/state-url.js';
import { createSolveRecorder } from '../../shared/gameplay-share.js';
import { setupPuzzleVisibilityHandler } from '../../shared/lifecycle.js';
import { set as storageSet, get as storageGet } from '../../shared/storage.js';

// Game constants
const GAME_ID = 'water-sort';
const LEVELS_URL = './levels.json';
const STATE_KEY = `mg:${GAME_ID}:progress`;

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

    // Shared win/loss/stuck retry overlay (created per level)
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
      await initStorage();
      initAccessibility();

      // Gate synthesized SFX on the persisted sound setting
      setSoundEnabled(getSettings().soundEnabled);

      // Load levels
      await this.loadLevels();

      // A shared puzzle link (#s=...) takes precedence over daily/saved progress.
      const shared = this.readSharedState();

      // Check for daily mode
      const urlParams = new URLSearchParams(window.location.search);
      this.isDailyMode = !shared && urlParams.get('daily') === 'true';

      if (this.isDailyMode) {
        this.dailySeed = getGameDailySeed(GAME_ID);
        this.generateDailyLevel();
      }

      if (shared) {
        // Resume the level the shared state belongs to.
        this.currentLevelIndex = Math.min(
          Math.max(shared.levelIndex | 0, 0),
          this.levels.length - 1
        );
      } else {
        // Load saved progress
        this.loadProgress();
      }

      // Create initial state first (needed for Phaser scene)
      const level = this.levels[this.currentLevelIndex];
      this.state = createInitialState(level);

      // Create renderer (Phaser game initialized with initial state)
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

      // Setup event listeners
      this.setupEventListeners();

      // Level-select strip (must exist before startLevel so the board sizes
      // around it)
      this.initLevelNav();

      // Start game
      this.startLevel(this.currentLevelIndex);

      // Hydrate the board from a shared puzzle link, if one was provided.
      if (shared) this.applySharedState(shared);

      // Passive gameplay recording for "Share your solve" (Phase 6.5).
      this.initSolveRecorder();

      // Setup visibility handler for state persistence on backgrounding
      setupPuzzleVisibilityHandler({
        onSave: () => this.saveGameState()
      });

      // Check for persisted state and restore it
      this.restoreGameState();

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

    const shareBtn = document.getElementById('btn-share');
    if (shareBtn) shareBtn.addEventListener('click', () => this.shareState());

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
      setSoundEnabled(e.target.checked);
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
    this.initRetryOverlay(index);

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
   * (Re)create the shared win/loss/stuck retry overlay for the given level.
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
      onRetry: () => this.restartLevel(),
      onNext: () => this.nextLevel(),
      onSkip: () => this.nextLevel(),
      onHint: () => {
        this.restartLevel();
        if (this.hintSession) this.hintSession.showHint();
        this.updateHintButton();
      },
      onShare: (stats) => {
        // Prefer a recorded gameplay clip with a burned-in outro card; fall
        // back to a text-only share if capture never started.
        if (this.solveRecorder && this.solveRecorder.isCapturing()) {
          this.solveRecorder.shareSolve({ stats, url: window.location.href });
        } else {
          quickShare({
            title: 'Water Sort',
            text: generateShareText({
              gameName: 'Water Sort',
              moves: stats.moves,
              time: stats.time,
              stars: stats.stars,
            }),
            url: window.location.href,
          });
        }
      },
      // Puzzle games can dead-end: offer an undo back to the last good state.
      onUndo: () => this.undo(),
    });
  }

  /**
   * Start passive gameplay capture so the win overlay's Share action can
   * attach a recorded clip (shared/gameplay-share.js). Best-effort: any
   * failure is swallowed there and Share falls back to text-only.
   */
  initSolveRecorder() {
    this.solveRecorder = createSolveRecorder({
      canvas: this.canvas,
      gameName: 'Water Sort',
    });
    this.solveRecorder.start();
    // Exposed for e2e verification of the record-and-share wiring.
    if (typeof window !== 'undefined') window.__solveRecorder = this.solveRecorder;
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
   * Serialize the current puzzle state for a shareable URL (shared/state-url.js).
   * Only the fields needed to reconstruct the board are included.
   */
  serializeState() {
    return {
      levelIndex: this.currentLevelIndex,
      tubes: this.state.tubes.map(t => [...t.segments]),
      maxSegments: this.state.maxSegments,
      moves: this.state.moves,
    };
  }

  /**
   * Encode the current puzzle into a #s=… link, put it in the address bar and
   * copy it to the clipboard so it can be shared / resumed later.
   */
  async shareState() {
    if (!this.state) return;
    const hash = encodeState(GAME_ID, this.serializeState());
    window.location.hash = hash;
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        copied = true;
      }
    } catch {
      // Clipboard access can be denied (permissions/insecure context); the hash
      // is still in the address bar and shareable.
    }
    announce(copied ? 'Puzzle link copied to clipboard.' : 'Puzzle link added to the address bar.');
  }

  /**
   * Read a shared puzzle state from window.location.hash, if present and valid.
   * @returns {{levelIndex:number, tubes:string[][], maxSegments:number, moves:number}|null}
   */
  readSharedState() {
    const hash = window.location.hash;
    if (!isStateHash(hash)) return null;
    const decoded = decodeState(hash);
    if (!decoded || decoded.gameId !== GAME_ID) return null;
    const s = decoded.state;
    if (!s || !Array.isArray(s.tubes)) return null;
    return s;
  }

  /**
   * Replace the current board with a decoded shared state.
   */
  applySharedState(shared) {
    this.state = {
      tubes: shared.tubes.map((segments, i) => ({ id: i, segments: [...segments] })),
      maxSegments: shared.maxSegments ?? this.state.maxSegments,
      moves: shared.moves ?? 0,
      selectedTube: null,
      status: 'playing',
    };
    this.history = createGameHistory(100);
    this.history.push(cloneState(this.state));
    this.selectedTube = null;
    this.animating = false;
    this.handleResize();
    this.updateUI();
    this.render();
    announce('Resumed a shared puzzle.');
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
    // Pour SFX (gated by the shared soundEnabled setting)
    resumeAudio();
    playSound('whoosh');
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
      // Auto-show the shared overlay in its stuck variant (Undo / Restart).
      this.retryOverlay.show(ResultType.STUCK, { moves: this.state.moves });
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
    this.lastStars = stars;
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

    // Advance the level-select strip: mark this level complete, unlock + advance
    if (this.levelNav) {
      if (this.isDailyMode) {
        this.levelNav.completeDaily();
      } else {
        this.levelNav.completeLevel(this.currentLevelIndex);
      }
    }

    const optimality = level.optimal
      ? Math.round(Math.min(100, (level.optimal / Math.max(1, this.state.moves)) * 100))
      : undefined;
    this.retryOverlay.show(ResultType.WIN, {
      moves: this.state.moves,
      time: Math.round(solveTime / 1000),
      optimality,
      stars,
    });

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
    setSoundEnabled(!muted);
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

  /**
   * Save current game state for persistence on backgrounding
   * Persists level index, tubes, moves, history, and selection state
   */
  saveGameState() {
    try {
      if (!this.state || this.state.status === 'won' || this.state.status === 'stuck') {
        // Don't persist completed or stuck games
        storageSet(STATE_KEY, null);
        return;
      }

      const gameState = {
        currentLevelIndex: this.currentLevelIndex,
        isDailyMode: this.isDailyMode,
        tubes: this.state.tubes.map(t => ({ id: t.id, segments: [...t.segments] })),
        maxSegments: this.state.maxSegments,
        moves: this.state.moves,
        selectedTube: this.state.selectedTube,
        // Save history state for undo functionality
        historyDepth: this.history ? this.history.depth() : 0,
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
        tubes: saved.tubes.map((t, i) => ({ id: t.id, segments: [...t.segments] })),
        maxSegments: saved.maxSegments,
        moves: saved.moves || 0,
        selectedTube: saved.selectedTube ?? null,
        status: 'playing',
      };

      // Recreate history to the saved depth
      if (this.history && saved.historyDepth > 0) {
        this.history = createGameHistory(100);
        // Push current state as base
        this.history.push(cloneState(this.state));
      }

      this.selectedTube = null;
      this.animating = false;

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
  const game = new WaterSortGame();
  // Exposed for e2e tests (shareable-state round-trip).
  window.__wsGame = game;
  game.init();
});

export { WaterSortGame };
export default WaterSortGame;
