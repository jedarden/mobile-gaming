/**
 * Parking Escape - Game Logic
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { createInitialState, applyMove, getAllMoves } from './state.js';
import { createRenderer } from './renderer.js';
import { createInput } from './input.js';

const GAME_ID = 'parking-escape';
const LEVELS_URL = './levels.json';

class ParkingEscapeGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.levelDisplay = document.getElementById('level-display');
    this.movesDisplay = document.getElementById('moves-display');
    this.bestDisplay = document.getElementById('best-display');
    this.levelProgress = document.getElementById('level-progress');
    this.btnUndo = document.getElementById('btn-undo');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnPrev = document.getElementById('btn-prev');
    this.btnNext = document.getElementById('btn-next');
    this.btnSound = document.getElementById('btn-sound');
    this.btnSettings = document.getElementById('btn-settings');
    this.winOverlay = document.getElementById('win-overlay');
    this.settingsOverlay = document.getElementById('settings-overlay');

    this.levels = [];
    this.currentLevelIndex = 0;
    this.state = null;
    this.history = [];  // stack of states for undo
    this.renderer = null;
    this.input = null;
    this._rafId = null;

    this.handleResize = this.handleResize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this._loop = this._loop.bind(this);
  }

  async init() {
    await initStorage();

    const res = await fetch(LEVELS_URL);
    this.levels = await res.json();

    this.renderer = createRenderer(this.canvas);

    this.input = createInput({
      canvas: this.canvas,
      renderer: this.renderer,
      getState: () => this.state,
      onMove: (vehicleId, direction, distance) => this.handleMove(vehicleId, direction, distance),
      onUndo: () => this.undo()
    });
    this.input.init();

    const stats = getGameStats(GAME_ID);
    this.currentLevelIndex = Math.min(stats.lastLevel || 0, this.levels.length - 1);

    window.addEventListener('resize', this.handleResize);
    document.addEventListener('keydown', this.handleKeyDown);

    this.setupButtons();
    this.startLevel(this.currentLevelIndex);
    this._rafId = requestAnimationFrame(this._loop);
  }

  _loop() {
    if (this.state && this.renderer) {
      this.renderer.render(this.state, null, this._selectedId);
    }
    this._rafId = requestAnimationFrame(this._loop);
  }

  setupButtons() {
    this.btnUndo.addEventListener('click', () => this.undo());
    this.btnRestart.addEventListener('click', () => this.restartLevel());
    this.btnPrev.addEventListener('click', () => this.prevLevel());
    this.btnNext.addEventListener('click', () => this.nextLevel());
    this.btnSound.addEventListener('click', () => this.toggleSound());
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
    document.getElementById('setting-haptic').addEventListener('change', e =>
      updateSettings({ hapticEnabled: e.target.checked }));
    document.getElementById('setting-motion').addEventListener('change', e => {
      updateSettings({ reducedMotion: e.target.checked });
      this.renderer.setReducedMotion(e.target.checked);
    });
  }

  startLevel(index) {
    if (index < 0 || index >= this.levels.length) return;
    this.currentLevelIndex = index;
    const level = this.levels[index];
    this.state = createInitialState(level);
    this.history = [];
    this.handleResize();
    this.updateUI();
    this.render();
  }

  restartLevel() { this.startLevel(this.currentLevelIndex); }
  prevLevel() { if (this.currentLevelIndex > 0) this.startLevel(this.currentLevelIndex - 1); }
  nextLevel() { if (this.currentLevelIndex < this.levels.length - 1) this.startLevel(this.currentLevelIndex + 1); }

  handleMove(vehicleId, direction, distance) {
    if (!this.state || this.state.status !== 'playing') return;

    // Validate move exists
    const moves = getAllMoves(this.state);
    const valid = moves.find(m => m.vehicleId === vehicleId && m.direction === direction && m.distance === distance);
    if (!valid) {
      // Try smaller distances
      for (let d = distance - 1; d >= 1; d--) {
        const v2 = moves.find(m => m.vehicleId === vehicleId && m.direction === direction && m.distance === d);
        if (v2) { distance = d; break; }
        if (d === 1) {
          // Blocked — screen shake
          if (this.renderer && this.renderer.shake) this.renderer.shake(250, 3);
          this.render(); return;
        }
      }
    }

    // Track old position for slide animation
    const vehicle = this.state.vehicles.find(v => v.id === vehicleId);
    const oldX = vehicle ? vehicle.x : 0;
    const oldY = vehicle ? vehicle.y : 0;

    this.history.push(this.state);
    this.state = applyMove(this.state, vehicleId, direction, distance);
    this.updateUI();
    this.render();

    // Trigger slide animation
    if (vehicle && this.renderer && this.renderer.animateSlide) {
      const newVehicle = this.state.vehicles.find(v => v.id === vehicleId);
      if (newVehicle) {
        this.renderer.animateSlide(vehicleId, oldX, oldY, newVehicle.x, newVehicle.y, distance);
      }
    }

    if (this.state.status === 'won') {
      // Hero exited — spawn particle burst
      if (this.renderer && this.renderer.onHeroExit) {
        const exitRow = this.state.grid.exit ? this.state.grid.exit.y : 2;
        this.renderer.onHeroExit(exitRow);
      }
      setTimeout(() => this.handleWin(), 600);
    }
  }

  undo() {
    if (this.history.length === 0) return;
    this.state = this.history.pop();
    this.updateUI();
    this.render();
  }

  async handleWin() {
    const level = this.levels[this.currentLevelIndex];
    const moves = this.state.moves;
    const stars = moves <= level.targetMoves ? 3 : moves <= level.targetMoves * 1.5 ? 2 : 1;

    await updateGameStats(GAME_ID, {
      lastLevel: this.currentLevelIndex,
      played: 1,
      completed: 1,
      stars
    });
    await awardLevelComplete(GAME_ID, stars, { levelId: this.currentLevelIndex, moves });

    const starsDisplay = document.getElementById('stars-display');
    starsDisplay.querySelectorAll('.star').forEach((el, i) => {
      el.classList.toggle('filled', i < stars);
    });
    document.getElementById('stats-summary').textContent = `Escaped in ${moves} move${moves !== 1 ? 's' : ''}!`;
    this.winOverlay.classList.add('active');
    this.winOverlay.setAttribute('aria-hidden', 'false');
  }

  handleResize() {
    if (this.state && this.renderer) {
      this.renderer.resize(this.state);
      this.render();
    }
  }

  render() {
    if (this.state && this.renderer) this.renderer.render(this.state, null);
  }

  updateUI() {
    if (!this.state) return;
    this.levelDisplay.textContent = this.currentLevelIndex + 1;
    this.movesDisplay.textContent = this.state.moves;
    const level = this.levels[this.currentLevelIndex];
    this.bestDisplay.textContent = level.targetMoves || '-';
    this.levelProgress.textContent = `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;
    this.btnUndo.disabled = this.history.length === 0;
    this.btnPrev.disabled = this.currentLevelIndex === 0;
    this.btnNext.disabled = this.currentLevelIndex >= this.levels.length - 1;
  }

  toggleSound() {
    const s = getSettings();
    updateSettings({ soundEnabled: !s.soundEnabled });
    this.btnSound.innerHTML = s.soundEnabled ? '<span aria-hidden="true">🔇</span>' : '<span aria-hidden="true">🔊</span>';
  }

  showSettings() {
    const s = getSettings();
    document.getElementById('setting-sound').checked = s.soundEnabled;
    document.getElementById('setting-haptic').checked = s.hapticEnabled;
    document.getElementById('setting-motion').checked = s.reducedMotion;
    this.settingsOverlay.classList.add('active');
    this.settingsOverlay.setAttribute('aria-hidden', 'false');
  }

  handleKeyDown(e) {
    if (!this.state || this.state.status !== 'playing') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') { e.preventDefault(); this.restartLevel(); }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const game = new ParkingEscapeGame();
  game.init();
});

export { ParkingEscapeGame };
export default ParkingEscapeGame;
