/**
 * Crowd Runner - Game Lifecycle
 *
 * Orchestrates state, renderer, and input.
 * Follows the same pattern as giant-runner/game.js.
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { initLifecycle, setupVisibilityHandler, pause, showResumeOverlay, resume, ready } from '../../shared/lifecycle.js';

import {
  createInitialState,
  advance,
  steer,
  isGameOver,
  calculateStars
} from './state.js';

import { createRenderer } from './renderer.js';
import { createInput }    from './input.js';
import { haptic } from '../../shared/haptics.js';
import { playSound, setSoundEnabled, resumeAudio } from '../../shared/audio.js';
import { recordLevel } from '../../shared/adaptive.js';
import { createRetryOverlay, ResultType } from '../../shared/retry.js';
import { quickShare, generateShareText } from '../../shared/share.js';
import { createSolveRecorder } from '../../shared/gameplay-share.js';
import { getGameDailySeed, getGameDailyNumericSeed, completeDailyChallenge } from '../../shared/daily.js';
import { generateLevel } from './generator.js';

const GAME_ID   = 'crowd-runner';
const LEVELS_URL = './levels.json';
const FIXED_DT   = 1 / 60;
const STATE_KEY  = `mg:${GAME_ID}:state`;

class CrowdRunnerGame {
  constructor() {
    this.container    = document.getElementById('game-container');
    this.crowdDisplay = document.getElementById('crowd-display');
    this.levelDisplay = document.getElementById('level-display');
    this.levelProgress = document.getElementById('level-progress');

    this.btnRestart  = document.getElementById('btn-restart');
    this.btnPrev     = document.getElementById('btn-prev');
    this.btnNext     = document.getElementById('btn-next');
    this.btnSettings = document.getElementById('btn-settings');

    this.winOverlay      = document.getElementById('win-overlay');
    this.settingsOverlay = document.getElementById('settings-overlay');

    this.levels           = [];
    this.currentLevelIndex = 0;

    // Daily challenge mode (reachable via ?daily=true)
    this.isDailyMode = false;
    this.dailySeed = null;
    this.state            = null;
    this.renderer         = null;
    this.input            = null;

    this.lastTime    = 0;
    this.accumulator = 0;
    this.animId      = null;
    this.isRunning   = false;

    // Shared win/loss retry overlay (created per level)
    this.retryOverlay = null;
    this.lastStars    = 0;

    this.gameLoop    = this.gameLoop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  async init() {
    try {
      await initStorage();
      initAccessibility();

      // Gate synthesized SFX on the persisted sound setting
      setSoundEnabled(getSettings().soundEnabled);

      // Initialize lifecycle system
      initLifecycle({
        container: this.container,
        onSave: () => this.saveGameState(),
        onRestore: () => this.restoreGameState(),
        onPause: () => this.pauseGame(),
        onResume: () => this.resumeGame(),
        loadingOverlay: true,
        errorBoundary: true
      });

      await this.loadLevels();

      this.renderer = createRenderer(this.container);
      this.renderer.init();
      this.renderer.setReducedMotion(isReducedMotionEnabled());

      this.input = createInput({
        element: this.renderer.canvas,
        onSteer: delta => this.handleSteer(delta)
      });
      this.input.init();

      this.loadProgress();

      // Daily challenge mode (?daily=true) — build today's seeded level.
      const urlParams = new URLSearchParams(window.location.search);
      this.isDailyMode = urlParams.get('daily') === 'true';
      if (this.isDailyMode) {
        this.dailySeed = getGameDailySeed(GAME_ID);
        this.generateDailyLevel();
      }

      this.setupEventListeners();

      // Setup visibility handler for auto-pause on tab switch
      setupVisibilityHandler();

      this.startLevel(this.currentLevelIndex);

      // Passive gameplay recording for "Share your solve" (Phase 6.5).
      this.initSolveRecorder();

      // Mark game as ready
      ready();
    } catch (err) {
      console.error('Failed to initialize Crowd Runner:', err);
    }
  }

  /**
   * Start passive gameplay capture so the win overlay's Share action can
   * attach a recorded clip (shared/gameplay-share.js). Best-effort.
   */
  initSolveRecorder() {
    this.solveRecorder = createSolveRecorder({
      canvas: this.renderer.canvas,
      gameName: 'Crowd Runner',
    });
    this.solveRecorder.start();
    // Exposed for e2e verification of the record-and-share wiring.
    if (typeof window !== 'undefined') window.__solveRecorder = this.solveRecorder;
  }

  async loadLevels() {
    try {
      const res = await fetch(LEVELS_URL);
      this.levels = await res.json();
    } catch {
      this.levels = [this.defaultLevel()];
    }
  }

  defaultLevel() {
    return {
      id: 'fallback',
      startingCrowd: 10,
      courseLength: 400,
      speed: 1.8,
      gates: [
        { z: 80,  left: { op: '+', value: 10 }, right: { op: '−', value: 3 } },
        { z: 200, left: { op: '×', value: 2 },  right: { op: '+', value: 5 } },
        { z: 300, left: { op: '+', value: 20 }, right: { op: '÷', value: 2 } }
      ],
      boss: { size: 40 }
    };
  }

  loadProgress() {
    const stats = getGameStats(GAME_ID);
    this.currentLevelIndex = Math.min(stats.lastLevel || 0, this.levels.length - 1);
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

  async saveProgress() {
    await updateGameStats(GAME_ID, { lastLevel: this.currentLevelIndex });
  }

  setupEventListeners() {
    window.addEventListener('resize', this.handleResize);

    this.btnRestart.addEventListener('click',  () => this.restartLevel());
    this.btnPrev.addEventListener('click',     () => this.prevLevel());
    this.btnNext.addEventListener('click',     () => this.nextLevel());
    this.btnSettings.addEventListener('click', () => this.showSettings());

    document.getElementById('btn-replay').addEventListener('click', () => {
      this.hideWinOverlay();
      this.restartLevel();
    });
    document.getElementById('btn-next-level').addEventListener('click', () => {
      this.hideWinOverlay();
      this.nextLevel();
    });
    document.getElementById('btn-close-settings').addEventListener('click', () => {
      this.hideSettings();
    });

    document.getElementById('setting-sound').addEventListener('change', e => {
      updateSettings({ soundEnabled: e.target.checked });
      setSoundEnabled(e.target.checked);
    });
    document.getElementById('setting-haptic').addEventListener('change', e => {
      updateSettings({ hapticEnabled: e.target.checked });
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

    this.state       = createInitialState(level);
    this.initRetryOverlay(index);
    this.lastTime    = 0;
    this.accumulator = 0;
    this.isRunning   = true;

    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = requestAnimationFrame(this.gameLoop);

    this.renderer.resetLevel();
    this.handleResize();
    this.updateUI();

    announce(`Level ${index + 1}. Starting crowd: ${level.startingCrowd}. Beat the boss of ${level.boss.size}!`);
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
        // Prefer a recorded run clip with a burned-in outro card; fall back to
        // a text-only share if passive capture never started.
        if (this.solveRecorder && this.solveRecorder.isCapturing()) {
          this.solveRecorder.shareSolve({ stats, url: window.location.href });
        } else {
          quickShare({
            title: 'Crowd Runner',
            text: generateShareText({
              gameName: 'Crowd Runner',
              stars: stats.stars,
            }),
            url: window.location.href,
          });
        }
      },
    });
  }

  gameLoop(timestamp) {
    if (!this.isRunning) return;

    if (this.lastTime === 0) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.accumulator += dt;

    while (this.accumulator >= FIXED_DT && this.state && !isGameOver(this.state)) {
      const beforeCrossed = this.state.gates.filter(g => g.crossed).length;
      this.state = advance(this.state, FIXED_DT);
      if (this.state.gates.filter(g => g.crossed).length > beforeCrossed) {
        // Gate-cross SFX (gated by the shared soundEnabled setting)
        resumeAudio();
        playSound('pop');
      }
      this.accumulator -= FIXED_DT;
    }

    if (this.state && isGameOver(this.state)) {
      this.handleGameEnd();
      return;
    }

    if (this.state) {
      this.renderer.render(this.state);
      this.updateUI();
    }

    if (this.isRunning) {
      this.animId = requestAnimationFrame(this.gameLoop);
    }
  }

  handleSteer(delta) {
    if (!this.state || isGameOver(this.state)) return;
    // First steer gesture unlocks the AudioContext for SFX
    resumeAudio();
    this.state = steer(this.state, delta);
  }

  async handleGameEnd() {
    this.isRunning = false;

    // Render final frame
    if (this.state) this.renderer.render(this.state);
    this.updateUI();

    if (this.state.status === 'won') {
      const stars = calculateStars(this.state.crowdSize, this.state.boss.size);

      this.renderer.animateResult(true, async () => {
        recordLevel(GAME_ID, { retryCount: this.levelRetries || 0, solveTime: Date.now() - (this.levelStartTime || Date.now()) }, { won: true });
        await updateGameStats(GAME_ID, { played: 1, completed: 1, stars });
        await awardLevelComplete(GAME_ID, stars, { levelId: this.currentLevelIndex });
        if (this.isDailyMode) completeDailyChallenge(GAME_ID);
        await this.saveProgress();
        haptic('win');
        this.lastStars = stars;
        this.retryOverlay.show(ResultType.WIN, { stars });
        announce(`Victory! Your crowd of ${this.state.crowdSize} defeated the boss! ${stars} star${stars !== 1 ? 's' : ''}!`);
      });
    } else {
      this.renderer.animateResult(false, () => {
        recordLevel(GAME_ID, { retryCount: this.levelRetries || 0, solveTime: Date.now() - (this.levelStartTime || Date.now()) }, { won: false });
        this.retryOverlay.show(ResultType.LOSS, {});
        announce(`Defeated! Your crowd of ${this.state.crowdSize} was too small for the boss of ${this.state.boss.size}.`);
      });
    }
  }

  restartLevel() { this.levelRetries = (this.levelRetries || 0) + 1; this.startLevel(this.currentLevelIndex); }
  prevLevel()    { if (this.currentLevelIndex > 0) this.startLevel(this.currentLevelIndex - 1); }
  nextLevel()    { if (this.currentLevelIndex < this.levels.length - 1) this.startLevel(this.currentLevelIndex + 1); }

  handleResize() {
    const rect = this.container.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
    if (this.state) this.renderer.render(this.state);
  }

  updateUI() {
    if (!this.state) return;
    this.crowdDisplay.textContent = this.state.crowdSize;
    this.levelDisplay.textContent = this.isDailyMode ? 'Daily' : this.currentLevelIndex + 1;
    this.levelProgress.textContent = this.isDailyMode
      ? 'Daily Challenge'
      : `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;
    this.btnPrev.disabled = this.currentLevelIndex === 0;
    this.btnNext.disabled = this.currentLevelIndex >= this.levels.length - 1;
  }

  showWinOverlay(stars) {
    const title = document.getElementById('win-title');
    title.textContent = 'Level Complete!';
    title.className = 'overlay-title win';

    const starEls = document.querySelectorAll('#stars-display .star');
    starEls.forEach((el, i) => el.classList.toggle('filled', i < stars));

    document.getElementById('stats-summary').textContent =
      `Crowd: ${this.state.crowdSize} vs Boss: ${this.state.boss.size}`;
    document.getElementById('btn-next-level').style.display = '';

    this.winOverlay.classList.add('active');
    this.winOverlay.setAttribute('aria-hidden', 'false');
  }

  showLoseOverlay() {
    const title = document.getElementById('win-title');
    title.textContent = 'Defeated!';
    title.className = 'overlay-title lose';

    document.getElementById('stars-display').innerHTML = '';
    document.getElementById('stats-summary').textContent =
      `Crowd: ${this.state.crowdSize} — Boss needed: ${this.state.boss.size + 1}`;
    document.getElementById('btn-next-level').style.display = 'none';

    this.winOverlay.classList.add('active');
    this.winOverlay.setAttribute('aria-hidden', 'false');
  }

  hideWinOverlay() {
    this.winOverlay.classList.remove('active');
    this.winOverlay.setAttribute('aria-hidden', 'true');
    // Reset stars for next time
    const starEls = document.querySelectorAll('#stars-display .star');
    if (!starEls.length) {
      document.getElementById('stars-display').innerHTML =
        '<span class="star" aria-hidden="true">&#9733;</span>'.repeat(3);
    }
  }

  showSettings() {
    const s = getSettings();
    document.getElementById('setting-sound').checked  = s.soundEnabled;
    document.getElementById('setting-haptic').checked = s.hapticEnabled;
    document.getElementById('setting-motion').checked = s.reducedMotion;
    this.settingsOverlay.classList.add('active');
    this.settingsOverlay.setAttribute('aria-hidden', 'false');
  }

  hideSettings() {
    this.settingsOverlay.classList.remove('active');
    this.settingsOverlay.setAttribute('aria-hidden', 'true');
  }

  destroy() {
    this.isRunning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.input)    this.input.destroy();
    if (this.renderer) this.renderer.destroy();
  }

  /**
   * Save current game state for lifecycle pause/resume
   * Persists level index, level retry count, and current run state
   */
  saveGameState() {
    try {
      const gameState = {
        currentLevelIndex: this.currentLevelIndex,
        levelRetries: this.levelRetries || 0,
        isDailyMode: this.isDailyMode,
        // Store a snapshot of the current level for restoration
        level: this.levels[this.currentLevelIndex],
        // We don't persist the full in-game state because runner games
        // reset on resume — player gets a fresh attempt at the same level
      };
      localStorage.setItem(STATE_KEY, JSON.stringify(gameState));
    } catch (e) {
      console.warn('Failed to save game state:', e);
    }
  }

  /**
   * Restore game state after lifecycle resume
   * Restores level progress and restarts the level
   */
  restoreGameState() {
    try {
      const saved = localStorage.getItem(STATE_KEY);
      if (saved) {
        const gameState = JSON.parse(saved);
        this.currentLevelIndex = gameState.currentLevelIndex;
        this.levelRetries = gameState.levelRetries || 0;
        this.isDailyMode = gameState.isDailyMode || false;

        // Restore daily seed if needed
        if (this.isDailyMode) {
          this.dailySeed = getGameDailySeed(GAME_ID);
        }
      }
    } catch (e) {
      console.warn('Failed to restore game state:', e);
    }
  }

  /**
   * Pause the game's RAF loop
   * Called by lifecycle.pause()
   */
  pauseGame() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  /**
   * Resume the game's RAF loop
   * Called by lifecycle.resume()
   */
  resumeGame() {
    this.isRunning = true;
    this.lastTime = 0;
    this.accumulator = 0;
    this.animId = requestAnimationFrame(this.gameLoop);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const game = new CrowdRunnerGame();
  game.init();
});

export { CrowdRunnerGame };
export default CrowdRunnerGame;
