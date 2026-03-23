/**
 * Satisfying ASMR - Game Logic
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { createInitialState, cleanArea, getProgress, isComplete } from './state.js';
import { createRenderer } from './renderer.js';
import { createInput } from './input.js';

const GAME_ID = 'satisfying-asmr';
const LEVELS_URL = './levels.json';
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
    this.state = null;
    this.renderer = null;
    this.input = null;
    this.rafId = null;
    this.dirty = false; // needs re-render

    this.handleResize = this.handleResize.bind(this);
  }

  async init() {
    await initStorage();
    const res = await fetch(LEVELS_URL);
    this.levels = await res.json();

    this.renderer = createRenderer(this.canvas);

    this.input = createInput({
      canvas: this.canvas,
      onSpray: (px, py) => this.handleSpray(px, py)
    });
    this.input.init();

    const stats = getGameStats(GAME_ID);
    this.currentLevelIndex = Math.min(stats.lastLevel || 0, this.levels.length - 1);

    window.addEventListener('resize', this.handleResize);
    this.setupButtons();
    this.startLevel(this.currentLevelIndex);
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
    document.getElementById('setting-sound').addEventListener('change', e =>
      updateSettings({ soundEnabled: e.target.checked }));
    document.getElementById('setting-motion').addEventListener('change', e =>
      updateSettings({ reducedMotion: e.target.checked }));
  }

  startLevel(index) {
    if (index < 0 || index >= this.levels.length) return;
    this.currentLevelIndex = index;
    const level = this.levels[index];
    this.state = createInitialState(level);
    this.handleResize();
    // Build initial dirt layer
    this.renderer.buildDirtLayer(this.state.cells, this.state.width, this.state.height);
    this.updateUI();
    this.renderer.render(this.state);
  }

  restartLevel() { this.startLevel(this.currentLevelIndex); }
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
    if (this.renderer.spawnDebris) this.renderer.spawnDebris(px, py);
    this.updateUI();

    if (isComplete(this.state)) {
      if (this.renderer.triggerCompletionSparkle) this.renderer.triggerCompletionSparkle();
      setTimeout(() => this.handleWin(), 800);
    }
  }

  async handleWin() {
    const pct = Math.round(getProgress(this.state) * 100);
    await updateGameStats(GAME_ID, { lastLevel: this.currentLevelIndex, played: 1, completed: 1, stars: 3 });
    await awardLevelComplete(GAME_ID, 3, { levelId: this.currentLevelIndex });
    document.getElementById('stats-summary').textContent = `${pct}% of surface cleaned!`;
    this.winOverlay.classList.add('active');
    this.winOverlay.setAttribute('aria-hidden', 'false');
  }

  handleResize() {
    if (this.state && this.renderer) {
      this.renderer.resize(this.state);
      this.renderer.buildDirtLayer(this.state.cells, this.state.width, this.state.height);
      this.renderer.render(this.state);
    }
  }

  updateUI() {
    if (!this.state) return;
    const level = this.levels[this.currentLevelIndex];
    const pct = Math.round(getProgress(this.state) * 100);
    this.levelDisplay.textContent = this.currentLevelIndex + 1;
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
}

document.addEventListener('DOMContentLoaded', () => {
  const game = new SatisfyingGame();
  game.init();
});

export { SatisfyingGame };
export default SatisfyingGame;
