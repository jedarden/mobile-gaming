/**
 * Merge Games - Game Logic
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { haptic } from '../../shared/haptics.js';
import { recordLevel } from '../../shared/adaptive.js';
import { createHintSession, getHintTokens } from '../../shared/hints.js';
import { createInitialState, applyMerge } from './state.js';
import { createRenderer } from './renderer.js';
import { createInput } from './input.js';

const GAME_ID = 'merge-games';
const LEVELS_URL = './levels.json';

class MergeGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.levelDisplay = document.getElementById('level-display');
    this.movesDisplay = document.getElementById('moves-display');
    this.goalDisplay = document.getElementById('goal-display');
    this.levelProgress = document.getElementById('level-progress');
    this.taskText = document.getElementById('task-text');
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
    this.hintSession = null;
    this.handleResize = this.handleResize.bind(this);
  }

  async init() {
    await initStorage();
    initAccessibility();
    const res = await fetch(LEVELS_URL);
    this.levels = await res.json();

    this.renderer = createRenderer(this.canvas);
    this.renderer.setReducedMotion(isReducedMotionEnabled());
    this.input = createInput({
      canvas: this.canvas,
      renderer: this.renderer,
      getState: () => this.state,
      onMerge: (r1, c1, r2, c2) => this.handleMerge(r1, c1, r2, c2)
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
    const hintBtn = document.getElementById('btn-hint');
    if (hintBtn) hintBtn.addEventListener('click', () => {
      if (this.hintSession) this.hintSession.showHint();
    });
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
    this.state = createInitialState(level);

    // Reset hint session
    if (this.hintSession) { this.hintSession.destroy(); }
    this.hintSession = createHintSession({
      gameId: GAME_ID,
      level,
      getState: () => this.state,
      onHighlight: ({ move }) => {
        if (this.renderer) this.renderer.setHintCells(move.r1, move.c1, move.r2, move.c2);
        this.render();
      },
      onShowMove: ({ move }) => {
        if (this.renderer) this.renderer.setHintCells(move.r1, move.c1, move.r2, move.c2);
        this.render();
      },
      onAutoPlay: ({ move }) => {
        if (this.renderer) this.renderer.setHintCells(null, null, null, null);
        this.handleMerge(move.r1, move.c1, move.r2, move.c2);
      },
      onTokensEmpty: () => { this.updateHintButton(); },
    });
    this.updateHintButton();

    this.handleResize();
    this.updateUI();
    this.render();
    announce(`Level ${index + 1}. Merge tiles to reach Tier ${level.task.targetTier}.`);
  }

  updateHintButton() {
    const btn = document.getElementById('btn-hint');
    if (!btn) return;
    const tokens = getHintTokens();
    btn.textContent = `Hint (${tokens})`;
    btn.disabled = tokens <= 0;
  }

  restartLevel() {
    this.levelRetries = (this.levelRetries || 0) + 1;
    if (this.hintSession) this.hintSession.reset();
    this.startLevel(this.currentLevelIndex);
  }
  prevLevel() { if (this.currentLevelIndex > 0) this.startLevel(this.currentLevelIndex - 1); }
  nextLevel() { if (this.currentLevelIndex < this.levels.length - 1) this.startLevel(this.currentLevelIndex + 1); }

  handleMerge(r1, c1, r2, c2) {
    if (!this.state || this.state.status !== 'playing') return;
    const next = applyMerge(this.state, r1, c1, r2, c2);
    if (next === this.state) return; // invalid
    // Clear hint after any move
    if (this.renderer) this.renderer.setHintCells(null, null, null, null);
    const newTier = next.grid[r2][c2];
    this.state = next;
    this.updateUI();
    // Spawn burst first so the loop captures it on the same render frame
    if (this.renderer && this.renderer.spawnMergeBurst) {
      this.renderer.spawnMergeBurst(r2, c2, newTier);
    }
    this.render();
    haptic('merge');
    if (this.state.status === 'won') {
      haptic('win');
      setTimeout(() => this.handleWin(), 250);
    }
  }

  async handleWin() {
    recordLevel(GAME_ID, { retryCount: this.levelRetries || 0, solveTime: Date.now() - (this.levelStartTime || Date.now()) }, { won: true });
    const moves = this.state.moves;
    const level = this.levels[this.currentLevelIndex];
    const stars = moves <= 5 ? 3 : moves <= 10 ? 2 : 1;
    await updateGameStats(GAME_ID, { lastLevel: this.currentLevelIndex, played: 1, completed: 1, stars });
    await awardLevelComplete(GAME_ID, stars, { levelId: this.currentLevelIndex, moves });
    document.getElementById('stars-display').querySelectorAll('.star').forEach((el, i) => {
      el.classList.toggle('filled', i < stars);
    });
    document.getElementById('stats-summary').textContent = `Reached Tier ${level.task.targetTier} in ${moves} merge${moves !== 1 ? 's' : ''}!`;
    this.winOverlay.classList.add('active');
    this.winOverlay.setAttribute('aria-hidden', 'false');
    announce(`Level complete! Reached Tier ${level.task.targetTier} in ${moves} merge${moves !== 1 ? 's' : ''}. ${stars} star${stars !== 1 ? 's' : ''}!`);
  }

  handleResize() {
    if (this.state && this.renderer) { this.renderer.resize(this.state); this.render(); }
  }

  render() {
    if (this.state && this.renderer) this.renderer.render(this.state, null);
  }

  updateUI() {
    if (!this.state) return;
    const level = this.levels[this.currentLevelIndex];
    this.levelDisplay.textContent = this.currentLevelIndex + 1;
    this.movesDisplay.textContent = this.state.moves;
    this.goalDisplay.textContent = `T${level.task.targetTier}×${level.task.targetCount}`;
    this.levelProgress.textContent = `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;
    this.taskText.textContent = `Merge tiles to reach Tier ${level.task.targetTier}` +
      (level.task.targetCount > 1 ? ` × ${level.task.targetCount}` : '');
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
  const game = new MergeGame();
  game.init();
});

export { MergeGame };
export default MergeGame;
