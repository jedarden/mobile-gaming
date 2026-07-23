/**
 * Satisfying ASMR - Game Logic
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats, set as storageSet, get as storageGet } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { haptic } from '../../shared/haptics.js';
import { playSound, setSoundEnabled, resumeAudio } from '../../shared/audio.js';
import { recordLevel } from '../../shared/adaptive.js';
import { createInitialState, cleanArea, getProgress, isComplete } from './state.js';
import { createRenderer } from './renderer.js';
import { createRetryOverlay, ResultType } from '../../shared/retry.js';
import { quickShare, generateShareText } from '../../shared/share.js';
import { getGameDailySeed, getGameDailyNumericSeed, completeDailyChallenge } from '../../shared/daily.js';
import { generateLevel } from './generator.js';
import { setupPuzzleVisibilityHandler } from '../../shared/lifecycle.js';

const GAME_ID = 'satisfying-asmr';
const LEVELS_URL = './levels.json';
const STATE_KEY = `mg:${GAME_ID}:progress`;
const SPRAY_RADIUS = 2; // grid cells

class SatisfyingGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.levelDisplay = document.getElementById('level-display');
    this.progressDisplay = document.getElementById('progress-display');
    this.patternDisplay = document.getElementById('pattern-display');
    this.progressBar = document.getElementById('progress-bar');
    this.levelProgress = document.getElementById('level-progress');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnPrev = document.getElementById('btn-prev');
    this.btnNext = document.getElementById('btn-next');
    this.btnSettings = document.getElementById('btn-settings');
    this.winOverlay = document.getElementById('win-overlay');
    this.settingsOverlay = document.getElementById('settings-overlay');

    this.levels = [];
    this.currentLevelIndex = 0;

    // Daily challenge mode (reachable via ?daily=true)
    this.isDailyMode = false;
    this.dailySeed = null;
    this.state = null;
    this.renderer = null;

    // Shared win/loss retry overlay (created per level)
    this.retryOverlay = null;
    this.lastStars = 0;

    this.handleResize = this.handleResize.bind(this);
  }

  async init() {
    await initStorage();
    initAccessibility();

    // Gate synthesized SFX on the persisted sound setting
    setSoundEnabled(getSettings().soundEnabled);
    const res = await fetch(LEVELS_URL);
    this.levels = await res.json();

    const stats = getGameStats(GAME_ID);
    this.currentLevelIndex = Math.min(stats.lastLevel || 0, this.levels.length - 1);

    // Daily challenge mode (?daily=true) — build today's seeded level.
    const urlParams = new URLSearchParams(window.location.search);
    this.isDailyMode = urlParams.get('daily') === 'true';
    if (this.isDailyMode) {
      this.dailySeed = getGameDailySeed(GAME_ID);
      this.generateDailyLevel();
    }

    // Create renderer (Phaser game initializes here)
    this.renderer = createRenderer(this.canvas);
    this.renderer.setReducedMotion(isReducedMotionEnabled());

    // Set up spray callback for Phaser scene
    this.renderer.setCallbacks({
      onSpray: (px, py) => this.handleSpray(px, py)
    });

    window.addEventListener('resize', this.handleResize);
    this.setupButtons();
    this.startLevel(this.currentLevelIndex);

    // Setup visibility handler for state persistence on backgrounding
    setupPuzzleVisibilityHandler({
      onSave: () => this.saveGameState()
    });

    // Check for persisted state and restore it
    this.restoreGameState();
  }

  setupButtons() {
    this.btnRestart.addEventListener('click', () => this.restartLevel());
    this.btnPrev.addEventListener('click', () => this.prevLevel());
    this.btnNext.addEventListener('click', () => this.nextLevel());
    this.btnSettings.addEventListener('click', () => this.showSettings());
    document.getElementById('btn-replay').addEventListener('click', () => {
      this.winOverlay.classList.remove('active');
      this.winOverlay.setAttribute('aria-hidden', 'true');
      this.restartLevel();
    });
    document.getElementById('btn-next-level').addEventListener('click', () => {
      this.winOverlay.classList.remove('active');
      this.winOverlay.setAttribute('aria-hidden', 'true');
      this.nextLevel();
    });
    document.getElementById('btn-close-settings').addEventListener('click', () => {
      this.settingsOverlay.classList.remove('active');
      this.settingsOverlay.setAttribute('aria-hidden', 'true');
    });
    document.getElementById('setting-sound').addEventListener('change', e => {
      updateSettings({ soundEnabled: e.target.checked });
      setSoundEnabled(e.target.checked);
    });
    document.getElementById('setting-motion').addEventListener('change', e => {
      updateSettings({ reducedMotion: e.target.checked });
      this.renderer.setReducedMotion(e.target.checked);
    });
  }

  startLevel(index) {
    if (index < 0 || index >= this.levels.length) return;
    this.levelStartTime = Date.now();
    if (index !== this.currentLevelIndex) this.levelRetries = 0;
    this.currentLevelIndex = index;
    const level = this.levels[index];

    // Create state BEFORE renderer init (Phaser scene needs state)
    this.state = createInitialState(level);

    // Resize renderer (builds reveal layer, grain, and dirt)
    this.renderer.resize(this.state);

    this.initRetryOverlay(index);

    this.updateUI();
    this.renderer.render(this.state);
    announce(`Level ${index + 1}. Clean the surface by spraying dirty areas.`);
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
          title: 'Satisfying ASMR',
          text: generateShareText({ gameName: 'Satisfying ASMR', stars: stats.stars }),
          url: window.location.href,
        });
      },
    });
  }

  /**
   * Build today's daily-challenge level from the seeded generator and make it
   * the only level (currentLevelIndex reset to 0).
   */
  generateDailyLevel() {
    const level = generateLevel(this.dailySeed);
    if (level) {
      this.levels = [level];
      this.currentLevelIndex = 0;
    } else {
      // Generator produced nothing solvable for today's seed; fall back to a
      // deterministic bundled level so the daily is identical for everyone.
      const idx = getGameDailyNumericSeed(GAME_ID) % this.levels.length;
      this.levels = [this.levels[idx]];
      this.currentLevelIndex = 0;
    }
  }

  restartLevel() { this.levelRetries = (this.levelRetries || 0) + 1; this.startLevel(this.currentLevelIndex); }
  prevLevel() { if (this.currentLevelIndex > 0) this.startLevel(this.currentLevelIndex - 1); }
  nextLevel() { if (this.currentLevelIndex < this.levels.length - 1) this.startLevel(this.currentLevelIndex + 1); }

  handleSpray(px, py) {
    if (!this.state || this.state.status !== 'playing') return;

    const { gc, gr } = this.renderer.pixelToGrid(px, py);
    const next = cleanArea(this.state, gc, gr, SPRAY_RADIUS);
    if (next === this.state) return; // nothing changed

    this.state = next;
    // Erase just the cleaned cells from dirt canvas
    this.renderer.eraseArea(this.state.cells, gc, gr, SPRAY_RADIUS, this.state.width);
    this.renderer.render(this.state);
    haptic('tap');
    // Spray SFX (gated by the shared soundEnabled setting)
    resumeAudio();
    playSound('whoosh');
    this.renderer.spawnDebris(px, py);
    this.updateUI();

    if (isComplete(this.state)) {
      haptic('win');
      this.renderer.triggerCompletionSparkle();
      setTimeout(() => this.handleWin(), 800);
    }
  }

  async handleWin() {
    recordLevel(GAME_ID, { retryCount: this.levelRetries || 0, solveTime: Date.now() - (this.levelStartTime || Date.now()) }, { won: true });
    const pct = Math.round(getProgress(this.state) * 100);
    await updateGameStats(GAME_ID, { lastLevel: this.currentLevelIndex, played: 1, completed: 1, stars: 3 });
    await awardLevelComplete(GAME_ID, 3, { levelId: this.currentLevelIndex });
    if (this.isDailyMode) completeDailyChallenge(GAME_ID);
    document.getElementById('stats-summary').textContent = `${pct}% of surface cleaned!`;
    this.winOverlay.classList.add('active');
    this.winOverlay.setAttribute('aria-hidden', 'false');
    announce(`Sparkling clean! Surface fully cleaned.`);
  }

  handleResize() {
    if (this.state && this.renderer) {
      this.renderer.resize(this.state);
      this.renderer.render(this.state);
    }
  }

  updateUI() {
    if (!this.state) return;
    const level = this.levels[this.currentLevelIndex];
    const pct = Math.round(getProgress(this.state) * 100);
    this.levelDisplay.textContent = this.isDailyMode ? 'Daily' : this.currentLevelIndex + 1;
    this.progressDisplay.textContent = `${pct}%`;
    this.patternDisplay.textContent = level.patternType || '-';
    this.progressBar.style.width = `${pct}%`;
    this.levelProgress.textContent = `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;
    this.btnPrev.disabled = this.currentLevelIndex === 0;
    this.btnNext.disabled = this.currentLevelIndex >= this.levels.length - 1;
  }

  showSettings() {
    const s = getSettings();
    document.getElementById('setting-sound').checked = s.soundEnabled;
    document.getElementById('setting-motion').checked = s.reducedMotion;
    this.settingsOverlay.classList.add('active');
    this.settingsOverlay.setAttribute('aria-hidden', 'false');
  }

  /**
   * Save current game state for persistence on backgrounding
   * Persists level index, cells (progress), cleanedCount, totalDirt, and status
   */
  saveGameState() {
    try {
      if (!this.state || this.state.status === 'won') {
        // Don't persist completed games
        storageSet(STATE_KEY, null);
        return;
      }

      const gameState = {
        currentLevelIndex: this.currentLevelIndex,
        isDailyMode: this.isDailyMode,
        cells: [...this.state.cells],
        width: this.state.width,
        height: this.state.height,
        totalDirt: this.state.totalDirt,
        cleanedCount: this.state.cleanedCount,
        patternType: this.state.patternType,
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
        cells: [...saved.cells],
        width: saved.width,
        height: saved.height,
        totalDirt: saved.totalDirt,
        cleanedCount: saved.cleanedCount,
        patternType: saved.patternType,
        status: 'playing',
      };

      // Re-render the restored state
      this.renderer.render(this.state);
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

document.addEventListener('DOMContentLoaded', () => {
  const game = new SatisfyingGame();
  game.init();
});

export { SatisfyingGame };
export default SatisfyingGame;
