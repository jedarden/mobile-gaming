/**
 * Makeover Run - Game Lifecycle
 *
 * Orchestrates state, renderer, and input.
 * Pattern follows crowd-runner/game.js.
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
  isJudging,
  judge,
  CATEGORIES
} from './state.js';

import { createRenderer } from './renderer.js';
import { createInput }    from './input.js';
import { haptic } from '../../shared/haptics.js';
import { playSound, setSoundEnabled, resumeAudio } from '../../shared/audio.js';
import { recordLevel } from '../../shared/adaptive.js';
import { createRetryOverlay, ResultType } from '../../shared/retry.js';
import { quickShare, generateShareText } from '../../shared/share.js';
import { getGameDailySeed, getGameDailyNumericSeed, completeDailyChallenge } from '../../shared/daily.js';
import { generateLevel } from './generator.js';

const GAME_ID   = 'makeover-run';
const LEVELS_URL = './levels.json';
const FIXED_DT   = 1 / 60;
const STATE_KEY  = `mg:${GAME_ID}:state`;

// Category display names for before/after overlay
const CAT_LABELS = {
  hair: 'Hair',
  outfit: 'Outfit',
  makeup: 'Makeup',
  accessories: 'Accessories'
};

const TIER_NAMES = ['Basic', 'Cute', 'Stylish', 'Glam'];

class MakeoverRunGame {
  constructor() {
    this.container     = document.getElementById('game-container');
    this.scoreDisplay  = document.getElementById('score-display');
    this.levelDisplay  = document.getElementById('level-display');
    this.levelProgress = document.getElementById('level-progress');

    this.btnRestart  = document.getElementById('btn-restart');
    this.btnPrev     = document.getElementById('btn-prev');
    this.btnNext     = document.getElementById('btn-next');
    this.btnSettings = document.getElementById('btn-settings');

    this.winOverlay      = document.getElementById('win-overlay');
    this.settingsOverlay = document.getElementById('settings-overlay');

    this.levels            = [];
    this.currentLevelIndex = 0;

    // Daily challenge mode (reachable via ?daily=true)
    this.isDailyMode = false;
    this.dailySeed = null;
    this.state             = null;
    this.renderer          = null;
    this.input             = null;

    this.lastTime    = 0;
    this.accumulator = 0;
    this.animId      = null;
    this.isRunning   = false;

    // Shared win/loss retry overlay (created per level)
    this.retryOverlay = null;
    this.lastStars    = 0;

    this.gameLoop     = this.gameLoop.bind(this);
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

      // Mark game as ready
      ready();
    } catch (err) {
      console.error('Failed to initialize Makeover Run:', err);
    }
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
      courseLength: 400,
      speed: 2.0,
      stations: [
        { z: 60,  x: -1, type: 'hair',        upgrade: 1, positive: true  },
        { z: 60,  x:  1, type: 'mud', downgrade: 'hair', amount: 1, positive: false },
        { z: 130, x: -1, type: 'outfit',       upgrade: 1, positive: true  },
        { z: 130, x:  1, type: 'mud', downgrade: 'outfit', amount: 1, positive: false },
        { z: 200, x: -1, type: 'makeup',       upgrade: 1, positive: true  },
        { z: 200, x:  1, type: 'mud', downgrade: 'makeup', amount: 1, positive: false },
        { z: 270, x: -1, type: 'accessories',  upgrade: 2, positive: true  },
        { z: 270, x:  1, type: 'mud', downgrade: 'accessories', amount: 1, positive: false },
        { z: 330, x:  1, type: 'hair',         upgrade: 2, positive: true  },
        { z: 330, x: -1, type: 'mud', downgrade: 'hair', amount: 1, positive: false }
      ]
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
    this.lastTime    = 0;
    this.accumulator = 0;
    this.isRunning   = true;

    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = requestAnimationFrame(this.gameLoop);

    this.renderer.resetLevel();
    this.initRetryOverlay(index);
    this.handleResize();
    this.updateUI();

    announce(`Level ${index + 1}. Run the makeover runway!`);
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
          title: 'Makeover Run',
          text: generateShareText({
            gameName: 'Makeover Run',
            stars: stats.stars,
          }),
          url: window.location.href,
        });
      },
    });
  }

  gameLoop(timestamp) {
    if (!this.isRunning) return;

    if (this.lastTime === 0) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.accumulator += dt;

    while (this.accumulator >= FIXED_DT && this.state) {
      if (this.state.status === 'running') {
        const beforeTriggered = this.state.stations.filter(st => st.triggered).length;
        this.state = advance(this.state, FIXED_DT);
        if (this.state.stations.filter(st => st.triggered).length > beforeTriggered) {
          // Station-hit SFX (gated by the shared soundEnabled setting)
          resumeAudio();
          playSound('collect');
        }
      }
      this.accumulator -= FIXED_DT;
    }

    if (this.state) {
      this.renderer.render(this.state);
      this.updateUI();
    }

    // Handle judging phase: transition to complete
    if (this.state && isJudging(this.state)) {
      this.handleJudging();
      return;
    }

    if (this.state && isGameOver(this.state)) {
      return; // handled by handleJudging
    }

    if (this.isRunning) {
      this.animId = requestAnimationFrame(this.gameLoop);
    }
  }

  handleSteer(delta) {
    if (!this.state || this.state.status !== 'running') return;
    // First steer gesture unlocks the AudioContext for SFX
    resumeAudio();
    this.state = steer(this.state, delta);
  }

  async handleJudging() {
    this.isRunning = false;

    // Finalize score
    this.state = judge(this.state);
    if (this.state) this.renderer.render(this.state);

    const score = this.state.score;
    const stars = this.state.stars;

    this.renderer.animateWin(async () => {
      recordLevel(GAME_ID, { retryCount: this.levelRetries || 0, solveTime: Date.now() - (this.levelStartTime || Date.now()) }, { won: true });
      await updateGameStats(GAME_ID, { played: 1, completed: 1, stars });
      await awardLevelComplete(GAME_ID, stars, { levelId: this.currentLevelIndex, score });
      if (this.isDailyMode) completeDailyChallenge(GAME_ID);
      await this.saveProgress();
      haptic('win');
      this.lastStars = stars;
      this.retryOverlay.show(ResultType.WIN, { stars });
      announce(`Runway complete! Score: ${score} out of 12. ${stars} star${stars !== 1 ? 's' : ''}!`);
    });
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
    const score = this.state.score;
    this.scoreDisplay.textContent  = score;
    this.levelDisplay.textContent  = this.isDailyMode ? 'Daily' : this.currentLevelIndex + 1;
    this.levelProgress.textContent = this.isDailyMode
      ? 'Daily Challenge'
      : `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;
    this.btnPrev.disabled = this.currentLevelIndex === 0;
    this.btnNext.disabled = this.currentLevelIndex >= this.levels.length - 1;
  }

  showWinOverlay(stars, score) {
    const title = document.getElementById('win-title');
    title.textContent  = 'Makeover Complete!';
    title.className    = 'overlay-title win';

    const starEls = document.querySelectorAll('#stars-display .star');
    starEls.forEach((el, i) => el.classList.toggle('filled', i < stars));

    // Before/after comparison
    const app    = this.state.appearance;
    const before = { hair: 0, outfit: 0, makeup: 0, accessories: 0 };
    let compHTML = '<div class="before-after">';
    compHTML += '<div class="ba-col"><div class="ba-label">Before</div>';
    CATEGORIES.forEach(cat => {
      compHTML += `<div class="ba-row"><span>${CAT_LABELS[cat]}</span><span>${TIER_NAMES[before[cat]]}</span></div>`;
    });
    compHTML += '</div>';
    compHTML += '<div class="ba-col"><div class="ba-label">After</div>';
    CATEGORIES.forEach(cat => {
      compHTML += `<div class="ba-row improved"><span>${CAT_LABELS[cat]}</span><span>${TIER_NAMES[app[cat]]}</span></div>`;
    });
    compHTML += '</div></div>';

    document.getElementById('stats-summary').innerHTML =
      `Score: ${score} / 12${compHTML}`;

    document.getElementById('btn-next-level').style.display =
      this.currentLevelIndex < this.levels.length - 1 ? '' : 'none';

    this.winOverlay.classList.add('active');
    this.winOverlay.setAttribute('aria-hidden', 'false');
  }

  hideWinOverlay() {
    this.winOverlay.classList.remove('active');
    this.winOverlay.setAttribute('aria-hidden', 'true');
    // Restore stars for next use
    const sd = document.getElementById('stars-display');
    if (!sd.querySelector('.star')) {
      sd.innerHTML = '<span class="star" aria-hidden="true">&#9733;</span>'.repeat(3);
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

  destroy() {
    this.isRunning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.input)    this.input.destroy();
    if (this.renderer) this.renderer.destroy();
    window.removeEventListener('resize', this.handleResize);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const game = new MakeoverRunGame();
  game.init();
});

export { MakeoverRunGame };
export default MakeoverRunGame;
