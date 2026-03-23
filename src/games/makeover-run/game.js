/**
 * Makeover Run - Game Lifecycle
 *
 * Orchestrates state, renderer, and input.
 * Pattern follows crowd-runner/game.js.
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';

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

const GAME_ID   = 'makeover-run';
const LEVELS_URL = './levels.json';
const FIXED_DT   = 1 / 60;

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
    this.state             = null;
    this.renderer          = null;
    this.input             = null;

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
      this.setupEventListeners();
      this.startLevel(this.currentLevelIndex);
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

    this.currentLevelIndex = index;
    const level = this.levels[index];

    this.state       = createInitialState(level);
    this.lastTime    = 0;
    this.accumulator = 0;
    this.isRunning   = true;

    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = requestAnimationFrame(this.gameLoop);

    this.renderer.resetLevel();
    this.handleResize();
    this.updateUI();

    announce(`Level ${index + 1}. Run the makeover runway!`);
  }

  gameLoop(timestamp) {
    if (!this.isRunning) return;

    if (this.lastTime === 0) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.accumulator += dt;

    while (this.accumulator >= FIXED_DT && this.state) {
      if (this.state.status === 'running') {
        this.state = advance(this.state, FIXED_DT);
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
      await updateGameStats(GAME_ID, { played: 1, completed: 1, stars });
      await awardLevelComplete(GAME_ID, stars, { levelId: this.currentLevelIndex, score });
      await this.saveProgress();
      haptic('win');
      this.showWinOverlay(stars, score);
      announce(`Runway complete! Score: ${score} out of 12. ${stars} star${stars !== 1 ? 's' : ''}!`);
    });
  }

  restartLevel() { this.startLevel(this.currentLevelIndex); }
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
    this.levelDisplay.textContent  = this.currentLevelIndex + 1;
    this.levelProgress.textContent = `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;
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
