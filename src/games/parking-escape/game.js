/**
 * Parking Escape - Game Logic
 *
 * Migrated to Phaser 3. The render loop is now handled by the Phaser Scene.
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { createInitialState, applyMove, getAllMoves } from './state.js';
import { createRenderer } from './renderer.js';
import { createInput } from './input.js';
import { haptic } from '../../shared/haptics.js';
import { recordLevel } from '../../shared/adaptive.js';
import { createHintSession, getHintTokens } from '../../shared/hints.js';
import { playSound, setSoundEnabled, resumeAudio } from '../../shared/audio.js';
import { createLevelNav } from '../../shared/level-nav.js';
import { createRetryOverlay, ResultType } from '../../shared/retry.js';
import { quickShare, generateShareText } from '../../shared/share.js';
import { encodeState, decodeState, isStateHash } from '../../shared/state-url.js';
import { getGameDailySeed, getGameDailyNumericSeed, completeDailyChallenge } from '../../shared/daily.js';
import { generateLevel } from './generator.js';

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

    // Daily challenge mode (reachable via ?daily=true)
    this.isDailyMode = false;
    this.dailySeed = null;

    this.history = [];  // stack of states for undo
    this.hintSession = null;
    this.renderer = null;
    this.input = null;
    this._selectedId = null;

    // Shared win/loss retry overlay (created per level)
    this.retryOverlay = null;
    this.lastStars = 0;

    this.handleResize = this.handleResize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  async init() {
    await initStorage();
    initAccessibility();

    // Gate synthesized SFX on the persisted sound setting
    setSoundEnabled(getSettings().soundEnabled);

    const res = await fetch(LEVELS_URL);
    this.levels = await res.json();

    // A shared puzzle link (#s=...) takes precedence over saved progress.
    const shared = this.readSharedState();

    // Daily challenge mode (?daily=true) — build today's seeded level. A shared
    // puzzle link takes precedence over the daily challenge.
    const urlParams = new URLSearchParams(window.location.search);
    this.isDailyMode = !shared && urlParams.get('daily') === 'true';
    if (this.isDailyMode) {
      this.dailySeed = getGameDailySeed(GAME_ID);
      this.generateDailyLevel();
    }

    // Initialize state before renderer (needed for Phaser scene init)
    const stats = getGameStats(GAME_ID);
    this.currentLevelIndex = shared
      ? Math.min(Math.max(shared.levelIndex | 0, 0), this.levels.length - 1)
      : Math.min(stats.lastLevel || 0, this.levels.length - 1);
    const level = this.levels[this.currentLevelIndex];
    this.state = createInitialState(level);

    this.renderer = createRenderer(this.canvas);
    this.renderer.setReducedMotion(isReducedMotionEnabled());

    this.input = createInput({
      canvas: this.canvas,
      renderer: this.renderer,
      getState: () => this.state,
      onMove: (vehicleId, direction, distance) => this.handleMove(vehicleId, direction, distance),
      onUndo: () => this.undo()
    });

    window.addEventListener('resize', this.handleResize);
    document.addEventListener('keydown', this.handleKeyDown);

    this.setupButtons();

    // Level-select strip (must exist before startLevel so the board sizes
    // around it)
    this.initLevelNav();

    // Now start the level (state already created)
    this.startLevel(this.currentLevelIndex);

    // Hydrate the board from a shared puzzle link, if one was provided.
    if (shared) this.applySharedState(shared);

    // Initialize input after renderer is ready
    this.input.init();
  }

  /**
   * Build today's daily-challenge level from the seeded generator and make it
   * the only level (currentLevelIndex stays 0).
   */
  generateDailyLevel() {
    const level = generateLevel(this.dailySeed);
    if (level) {
      this.levels = [level];
    } else {
      // Generator produced nothing solvable for today's seed; fall back to a
      // deterministic bundled level so the daily is identical for everyone.
      this.levels = [this.levels[getGameDailyNumericSeed(GAME_ID) % this.levels.length]];
    }
  }

  setupButtons() {
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
    document.getElementById('setting-haptic').addEventListener('change', e =>
      updateSettings({ hapticEnabled: e.target.checked }));
    document.getElementById('setting-motion').addEventListener('change', e => {
      updateSettings({ reducedMotion: e.target.checked });
      this.renderer.setReducedMotion(e.target.checked);
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
      onLevelSelect: (index, restart) => {
        if (restart) {
          this.restartLevel();
        } else {
          this.startLevel(index);
          this.levelNav.setCurrentLevel(index);
        }
      },
    });
    this.levelNav.strip.style.position = 'relative';
    this.levelNav.strip.style.flexShrink = '0';
    window.dispatchEvent(new Event('resize'));
  }

  startLevel(index) {
    if (index < 0 || index >= this.levels.length) return;
    const isRetry = index === this.currentLevelIndex && this.levelStartTime > 0;
    if (isRetry) this.levelRetries = (this.levelRetries || 0) + 1;
    else this.levelRetries = 0;
    this.currentLevelIndex = index;
    this.levelStartTime = Date.now();
    this.levelUndos = 0;
    const level = this.levels[index];
    this.state = createInitialState(level);
    this.history = [];

    // Reset hint session for new level
    if (this.hintSession) { this.hintSession.destroy(); }
    if (this.renderer) this.renderer.setHintVehicle(null);
    this.hintSession = createHintSession({
      gameId: GAME_ID,
      level: level,
      getState: () => this.state,
      onHighlight: ({ move }) => {
        this.renderer.setHintVehicle(move.vehicleId);
        this.render();
      },
      onShowMove: ({ move }) => {
        this.renderer.setHintVehicle(move.vehicleId);
        this.render();
      },
      onAutoPlay: ({ move }) => {
        this.renderer.setHintVehicle(null);
        this.handleMove(move.vehicleId, move.direction, move.distance);
      },
      onTokensEmpty: () => {
        this.updateHintButton();
      },
    });
    this.updateHintButton();
    this.initRetryOverlay(index);

    this.handleResize();
    this.updateUI();
    this.render();
    announce(`Level ${index + 1}. Slide vehicles to clear a path for the exit car.`);
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
      onHint: () => {
        this.restartLevel();
        if (this.hintSession) this.hintSession.showHint();
        this.updateHintButton();
      },
      onShare: (stats) => {
        quickShare({
          title: 'Parking Escape',
          text: generateShareText({
            gameName: 'Parking Escape',
            moves: stats.moves,
            time: stats.time,
            stars: stats.stars,
          }),
          url: window.location.href,
        });
      },
    });
  }

  restartLevel() {
    if (this.hintSession) this.hintSession.reset();
    this.startLevel(this.currentLevelIndex);
  }
  prevLevel() { if (this.currentLevelIndex > 0) this.startLevel(this.currentLevelIndex - 1); }
  nextLevel() { if (this.currentLevelIndex < this.levels.length - 1) this.startLevel(this.currentLevelIndex + 1); }

  updateHintButton() {
    const btn = document.getElementById('btn-hint');
    if (!btn) return;
    const tokens = getHintTokens();
    btn.textContent = `Hint (${tokens})`;
    btn.disabled = tokens <= 0;
  }

  /**
   * Serialize the current puzzle state for a shareable URL (shared/state-url.js).
   * Vehicle objects carry all geometry (orientation/width/height/type), so the
   * board can be reconstructed from them plus the level's grid.
   */
  serializeState() {
    return {
      levelIndex: this.currentLevelIndex,
      vehicles: this.state.vehicles.map(v => ({ ...v })),
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
      // Clipboard access can be denied; the hash is still shareable.
    }
    announce(copied ? 'Puzzle link copied to clipboard.' : 'Puzzle link added to the address bar.');
  }

  /**
   * Read a shared puzzle state from window.location.hash, if present and valid.
   * @returns {{levelIndex:number, vehicles:Array, moves:number}|null}
   */
  readSharedState() {
    const hash = window.location.hash;
    if (!isStateHash(hash)) return null;
    const decoded = decodeState(hash);
    if (!decoded || decoded.gameId !== GAME_ID) return null;
    const s = decoded.state;
    if (!s || !Array.isArray(s.vehicles)) return null;
    return s;
  }

  /**
   * Replace the current board with a decoded shared state. The grid (exit,
   * dimensions) comes from the already-loaded level for this.currentLevelIndex.
   */
  applySharedState(shared) {
    this.state = {
      grid: this.state.grid,
      vehicles: shared.vehicles.map(v => ({ ...v })),
      moves: shared.moves ?? 0,
      status: 'playing',
    };
    this.history = [];
    this.handleResize();
    this.updateUI();
    this.render();
    announce('Resumed a shared puzzle.');
  }

  handleMove(vehicleId, direction, distance) {
    if (!this.state || this.state.status !== 'playing') return;
    if (this.renderer) this.renderer.setHintVehicle(null);

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
          haptic('error');
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
    haptic('tap');
    // Vehicle-move SFX (gated by the shared soundEnabled setting)
    resumeAudio();
    playSound('slide');
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
      haptic('win');
      setTimeout(() => this.handleWin(), 600);
    }
  }

  undo() {
    if (this.history.length === 0) return;
    this.state = this.history.pop();
    this.levelUndos = (this.levelUndos || 0) + 1;
    this.updateUI();
    this.render();
  }

  async handleWin() {
    const level = this.levels[this.currentLevelIndex];
    const moves = this.state.moves;
    const stars = moves <= level.targetMoves ? 3 : moves <= level.targetMoves * 1.5 ? 2 : 1;
    this.lastStars = stars;
    const solveTime = Date.now() - (this.levelStartTime || Date.now());

    recordLevel(GAME_ID, {
      retryCount: this.levelRetries || 0,
      solveTime,
      hintUsage: this.hintSession?.level ?? 0,
      undoRate: this.state.moves > 0 ? (this.levelUndos || 0) / this.state.moves : 0,
    }, { won: true });

    await updateGameStats(GAME_ID, {
      lastLevel: this.currentLevelIndex,
      played: 1,
      completed: 1,
      stars
    });
    await awardLevelComplete(GAME_ID, stars, { levelId: this.currentLevelIndex, moves });

    // Mark today's daily challenge complete (once per daily-mode win)
    if (this.isDailyMode) completeDailyChallenge(GAME_ID);

    // Advance the level-select strip: mark this level complete, unlock + advance
    if (this.levelNav) this.levelNav.completeLevel(this.currentLevelIndex);

    const optimality = level.targetMoves
      ? Math.round(Math.min(100, (level.targetMoves / Math.max(1, moves)) * 100))
      : undefined;
    this.retryOverlay.show(ResultType.WIN, {
      moves,
      time: Math.round(solveTime / 1000),
      optimality,
      stars,
    });
    announce(`Escaped in ${moves} move${moves !== 1 ? 's' : ''}! ${stars} star${stars !== 1 ? 's' : ''}!`);
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
    this.levelDisplay.textContent = this.isDailyMode ? 'Daily' : this.currentLevelIndex + 1;
    this.movesDisplay.textContent = this.state.moves;
    const level = this.levels[this.currentLevelIndex];
    this.bestDisplay.textContent = level.targetMoves || '-';
    this.levelProgress.textContent = this.isDailyMode
      ? 'Daily Challenge'
      : `Level ${this.currentLevelIndex + 1} / ${this.levels.length}`;
    this.btnUndo.disabled = this.history.length === 0;
    this.btnPrev.disabled = this.currentLevelIndex === 0;
    this.btnNext.disabled = this.currentLevelIndex >= this.levels.length - 1;
  }

  toggleSound() {
    const s = getSettings();
    updateSettings({ soundEnabled: !s.soundEnabled });
    setSoundEnabled(!s.soundEnabled);
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
  // Exposed for e2e tests (shareable-state round-trip).
  window.__peGame = game;
  game.init();
});

export { ParkingEscapeGame };
export default ParkingEscapeGame;
