/**
 * Bridge Race - Game Lifecycle
 *
 * Orchestrates state, renderer, and input.
 * Follows giant-runner/game.js pattern.
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';

import {
  createInitialState,
  moveEntity,
  aiTick,
  performProximityActions,
  checkWin,
  isGameOver,
  calculateStars
} from './state.js';

import { createRenderer } from './renderer.js';
import { createInput }    from './input.js';
import { createRng }      from '../../shared/rng.js';
import { haptic } from '../../shared/haptics.js';
import { playSound, setSoundEnabled, resumeAudio } from '../../shared/audio.js';
import { recordLevel } from '../../shared/adaptive.js';
import { createRetryOverlay, ResultType } from '../../shared/retry.js';
import { quickShare, generateShareText } from '../../shared/share.js';
import { getGameDailySeed, getGameDailyNumericSeed, completeDailyChallenge } from '../../shared/daily.js';
import { generateLevel } from './generator.js';

const GAME_ID   = 'bridge-race';
const LEVELS_URL = './levels.json';
const FIXED_DT   = 1 / 60;

class BridgeRaceGame {
  constructor() {
    this.container     = document.getElementById('game-container');
    this.blockDisplay  = document.getElementById('block-count');
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
    this.rng               = createRng(42);

    // Shared win/loss retry overlay (created per level)
    this.retryOverlay = null;
    this.lastStars    = 0;

    this.pendingMove = { dx: 0, dz: 0 };

    this.lastTime    = 0;
    this.accumulator = 0;
    this.animId      = null;
    this.isRunning   = false;

    this.gameLoop     = this.gameLoop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  async init() {
    try {
      await initStorage();
      initAccessibility();

      // Gate synthesized SFX on the persisted sound setting
      setSoundEnabled(getSettings().soundEnabled);

      await this.loadLevels();

      this.renderer = createRenderer(this.container);
      this.renderer.init();
      this.renderer.setReducedMotion(isReducedMotionEnabled());

      this.input = createInput({
        element: this.renderer.canvas,
        onMove: ({ dx, dz }) => {
          this.pendingMove = { dx, dz };
        }
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
      this.startLevel(this.currentLevelIndex);
    } catch (err) {
      console.error('Failed to initialize Bridge Race:', err);
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
      arenaWidth: 24,
      finishZ: 80,
      playerColor: 'blue',
      opponents: [{ color: 'red', x: 6, ai: 'random' }],
      bridges: [
        { z: 30, required: 3 },
        { z: 60, required: 3 }
      ],
      blockPiles: [
        { x: -8, z: 10, color: 'blue', count: 5 },
        { x: 8,  z: 10, color: 'red',  count: 5 },
        { x: 0,  z: 15, color: 'blue', count: 5 }
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
    this.pendingMove = { dx: 0, dz: 0 };
    this.rng         = createRng(index * 137 + 42);

    this.initRetryOverlay(index);

    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = requestAnimationFrame(this.gameLoop);

    this.renderer.resetLevel();
    this.handleResize();
    this.updateUI();

    announce(`Level ${index + 1}. Collect blue blocks and build bridges to the finish!`);
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
      // Runners have no hint system — Hint-then-Retry just retries.
      onHint: () => this.restartLevel(),
      onShare: (stats) => {
        quickShare({
          title: 'Bridge Race',
          text: generateShareText({
            gameName: 'Bridge Race',
            moves: stats.moves,
            time: stats.time,
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

    while (this.accumulator >= FIXED_DT && this.state && !isGameOver(this.state)) {
      this.state = this.tick(this.state, FIXED_DT);
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

  tick(state, dt) {
    let s = state;

    // Move player
    const { dx, dz } = this.pendingMove;
    if (dx !== 0 || dz !== 0) {
      s = moveEntity(s, 'player', dx, dz);
    }

    // AI opponents
    for (let i = 0; i < s.opponents.length; i++) {
      const { dx: adx, dz: adz } = aiTick(s, i, dt, this.rng);
      s = moveEntity(s, i, adx, adz);
    }

    // Proximity actions for all entities
    const beforeBlocks = s.player.blocks;
    const beforeBridges = s.player.bridgesCompleted;
    s = performProximityActions(s, 'player');
    if (s.player.blocks > beforeBlocks) {
      // Block-collect SFX (gated by the shared soundEnabled setting)
      resumeAudio();
      playSound('collect');
    }
    if (s.player.bridgesCompleted > beforeBridges) {
      // Block-place / bridge-built SFX (gated by the shared soundEnabled setting)
      resumeAudio();
      playSound('slide');
    }
    for (let i = 0; i < s.opponents.length; i++) {
      s = performProximityActions(s, i);
    }

    // Advance time
    s = { ...s, time: s.time + dt };

    // Check win/lose
    s = checkWin(s);

    return s;
  }

  async handleGameEnd() {
    this.isRunning = false;

    if (this.state) this.renderer.render(this.state);
    this.updateUI();

    if (this.state.status === 'won') {
      const stars = calculateStars(this.state);

      this.renderer.animateResult(true, async () => {
        recordLevel(GAME_ID, { retryCount: this.levelRetries || 0, solveTime: Date.now() - (this.levelStartTime || Date.now()) }, { won: true });
        await updateGameStats(GAME_ID, { played: 1, completed: 1, stars });
        await awardLevelComplete(GAME_ID, stars, { levelId: this.currentLevelIndex });
        if (this.isDailyMode) completeDailyChallenge(GAME_ID);
        await this.saveProgress();
        haptic('win');
        this.lastStars = stars;
        this.retryOverlay.show(ResultType.WIN, {
          stars,
          time: Math.round((Date.now() - (this.levelStartTime || Date.now())) / 1000),
        });
        announce(`You won! ${stars} star${stars !== 1 ? 's' : ''}! All bridges completed!`);
      });
    } else {
      this.renderer.animateResult(false, () => {
        recordLevel(GAME_ID, { retryCount: this.levelRetries || 0, solveTime: Date.now() - (this.levelStartTime || Date.now()) }, { won: false });
        this.retryOverlay.show(ResultType.LOSS, {});
        announce('An opponent reached the finish first! Try again!');
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
    this.blockDisplay.textContent  = this.state.player.blocks;
    this.levelDisplay.textContent  = this.isDailyMode ? 'Daily' : this.currentLevelIndex + 1;
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
      `Bridges completed: ${this.state.player.bridgesCompleted} / ${this.state.totalBridges}`;
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
      `An opponent crossed the finish line first.`;
    document.getElementById('btn-next-level').style.display = 'none';

    this.winOverlay.classList.add('active');
    this.winOverlay.setAttribute('aria-hidden', 'false');
  }

  hideWinOverlay() {
    this.winOverlay.classList.remove('active');
    this.winOverlay.setAttribute('aria-hidden', 'true');
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
}

document.addEventListener('DOMContentLoaded', () => {
  const game = new BridgeRaceGame();
  game.init();
});

export { BridgeRaceGame };
export default BridgeRaceGame;
