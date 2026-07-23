/**
 * Save the Character - Main Game Logic
 *
 * Orchestrates the survival puzzle game with:
 * - Game state management
 * - Phaser rendering
 * - User input handling
 * - Level progression
 * - Integration with shared systems
 */

import { initStorage, getSettings, updateSettings, getGameStats, updateGameStats, set as storageSet, get as storageGet } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { haptic } from '../../shared/haptics.js';
import { playSound, setSoundEnabled, resumeAudio } from '../../shared/audio.js';
import { recordLevel } from '../../shared/adaptive.js';

import {
  createInitialState,
  selectChoice,
  resolveChoice,
  getScenarioTitle,
  getThreat,
  getChoices,
  isChoosing,
  isAnimating,
  isWon,
  isLost
} from './state.js';

import { createRenderer } from './renderer.js';
import { createInput } from './input.js';
import { getGameDailyNumericSeed, completeDailyChallenge } from '../../shared/daily.js';
import { setupPuzzleVisibilityHandler } from '../../shared/lifecycle.js';

// Game constants
const GAME_ID = 'save-the-character';
const LEVELS_URL = './levels.json';
const STATE_KEY = `mg:${GAME_ID}:progress`;
const RESULT_DISPLAY_DURATION = 1500; // ms to show result before progression

/**
 * Save the Character Game class
 */
class SaveTheCharacterGame {
  constructor() {
    // DOM elements
    this.canvas = null;
    this.container = null;

    // Game state
    this.levels = [];
    this.currentLevelIndex = 0;

    // Daily challenge mode (reachable via ?daily=true)
    this.isDailyMode = false;
    this.state = null;
    this.renderer = null;
    this.input = null;

    // Animation state
    this.resultDisplayTime = null;

    // Bind methods
    this.handleResize = this.handleResize.bind(this);
  }

  /**
   * Initialize the game
   * @param {HTMLElement} container - Container element for the game
   */
  async init(container) {
    try {
      this.container = container;

      // Find or create canvas (for container reference)
      this.canvas = container.querySelector('#game-canvas');
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'game-canvas';
        this.canvas.setAttribute('aria-label', 'Save the Character game');
        container.appendChild(this.canvas);
      }

      // Initialize storage and accessibility
      await initStorage();
      initAccessibility();

      // Gate synthesized SFX on the persisted sound setting
      setSoundEnabled(getSettings().soundEnabled);
      this.syncSoundIcon();

      // Load levels
      await this.loadLevels();

      // Create initial state BEFORE renderer (needed for Phaser scene init)
      this.loadProgress();

      // Daily challenge mode (?daily=true). Save the Character has no procedural
      // generator, so the plan's fallback applies:
      // levelIndex = seed % levels.length.
      const urlParams = new URLSearchParams(window.location.search);
      this.isDailyMode = urlParams.get('daily') === 'true';
      if (this.isDailyMode) this.generateDailyLevel();

      const level = this.levels[this.currentLevelIndex];
      this.state = createInitialState(level);

      // Create renderer with Phaser
      this.renderer = createRenderer(this.canvas);
      this.renderer.setReducedMotion(isReducedMotionEnabled());

      // Create input handler
      this.input = createInput({
        canvas: this.canvas,
        renderer: this.renderer,
        onChoiceSelect: (index) => this.handleChoiceSelect(index),
        onChoiceHover: (index) => this.handleChoiceHover(index)
      });
      this.input.init();

      // Initialize Phaser with callbacks
      this.renderer.init(this.state, {
        onChoiceSelect: (index) => this.handleChoiceSelect(index),
        onChoiceHover: (index) => this.handleChoiceHover(index),
        onAnimationComplete: () => this.handleAnimationComplete()
      });

      // Setup event listeners
      this.setupEventListeners();

      // Start game
      this.startLevel(this.currentLevelIndex);

      // Setup visibility handler for state persistence on backgrounding
      setupPuzzleVisibilityHandler({
        onSave: () => this.saveGameState()
      });

      // Check for persisted state and restore it
      this.restoreGameState();

      console.log('Save the Character initialized');
    } catch (error) {
      console.error('Failed to initialize Save the Character:', error);
      throw error;
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
      // Fallback to embedded level
      this.levels = [this.getDefaultLevel()];
    }
  }

  /**
   * Get default fallback level
   */
  getDefaultLevel() {
    return {
      id: 'stc-001',
      title: 'Character on a cliff',
      threat: 'The character is standing on a crumbling cliff edge about to fall!',
      choices: [
        { id: 'jump', label: 'Jump into the water below', correct: true },
        { id: 'climb', label: 'Climb up the loose rocks', correct: false },
        { id: 'stand', label: 'Stand still and wait for help', correct: false }
      ]
    };
  }

  /**
   * Load saved progress
   */
  loadProgress() {
    const stats = getGameStats(GAME_ID);
    this.currentLevelIndex = Math.min(stats.lastLevel || 0, this.levels.length - 1);
  }

  /**
   * Select today's daily scenario deterministically. Save the Character has no
   * procedural generator, so the plan's fallback applies:
   * levelIndex = seed % levels.length.
   */
  generateDailyLevel() {
    if (!this.levels.length) return;
    const seed = getGameDailyNumericSeed(GAME_ID);
    this.currentLevelIndex = seed % this.levels.length;
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
   * Setup event listeners
   */
  setupEventListeners() {
    window.addEventListener('resize', this.handleResize);

    const btnSound = document.getElementById('btn-sound');
    if (btnSound) {
      btnSound.addEventListener('click', () => this.toggleSound());
    }
  }

  /**
   * Toggle sound on/off and persist the setting
   */
  toggleSound() {
    const enabled = !getSettings().soundEnabled;
    updateSettings({ soundEnabled: enabled });
    setSoundEnabled(enabled);
    this.syncSoundIcon();
  }

  /**
   * Reflect the persisted sound setting in the header toggle icon
   */
  syncSoundIcon() {
    const btnSound = document.getElementById('btn-sound');
    if (!btnSound) return;
    const enabled = getSettings().soundEnabled;
    btnSound.innerHTML = enabled
      ? '<span aria-hidden="true">🔊</span>'
      : '<span aria-hidden="true">🔇</span>';
  }

  /**
   * Start a level
   */
  startLevel(index) {
    if (index < 0 || index >= this.levels.length) return;

    this.levelStartTime = Date.now();
    if (index !== this.currentLevelIndex) this.levelRetries = 0;
    this.currentLevelIndex = index;
    const level = this.levels[index];

    // Create initial state
    this.state = createInitialState(level);

    // Reset animation state
    this.resultDisplayTime = null;

    // Update renderer with new state
    if (this.renderer) {
      this.renderer.render(this.state);
    }

    // Update input state reference
    if (this.input) {
      this.input.updateState(this.state);
    }

    // Announce for screen readers
    announce(`Scenario ${index + 1}: ${getScenarioTitle(this.state)}. ${getThreat(this.state)}`);
  }

  /**
   * Handle choice selection
   */
  handleChoiceSelect(choiceIndex) {
    if (!isChoosing(this.state)) return;

    const choices = getChoices(this.state);
    const choice = choices[choiceIndex];
    if (!choice) return;

    // Select the choice
    this.state = selectChoice(this.state, choice.id);

    // Choice-tap SFX (gated by the shared soundEnabled setting)
    resumeAudio();
    playSound('tap');

    // Press feedback
    if (this.renderer.setPressedChoice) this.renderer.setPressedChoice(choiceIndex);

    // Update renderer state
    this.renderer.render(this.state);

    // Start animation in Phaser scene
    this.renderer.startAnimation();

    // Update input state
    this.input.updateState(this.state);

    announce(`Selected: ${choice.label}`);
  }

  /**
   * Handle animation complete callback from Phaser scene
   */
  handleAnimationComplete() {
    if (!isAnimating(this.state)) return;

    // Resolve the choice
    this.state = resolveChoice(this.state);
    this.input.updateState(this.state);
    this.resultDisplayTime = Date.now();

    if (isWon(this.state)) {
      this.renderer.triggerWinEffect();
      this.handleWin();
    } else if (isLost(this.state)) {
      this.renderer.triggerLoseEffect();
      this.handleLose();
    }

    // Update renderer with resolved state
    this.renderer.render(this.state);

    // Schedule progression
    setTimeout(() => {
      if (isWon(this.state)) {
        this.nextLevel();
      } else if (isLost(this.state)) {
        this.retryLevel();
      }
    }, RESULT_DISPLAY_DURATION);
  }

  /**
   * Handle choice hover
   */
  handleChoiceHover(choiceIndex) {
    this.renderer.setHoveredChoice(choiceIndex);
  }

  /**
   * Handle win condition
   */
  async handleWin() {
    // Record adaptive difficulty signal
    recordLevel(GAME_ID, { retryCount: this.levelRetries || 0, solveTime: Date.now() - (this.levelStartTime || Date.now()) }, { won: true });

    // Update stats
    await updateGameStats(GAME_ID, {
      played: 1,
      completed: 1
    });

    // Award XP
    await awardLevelComplete(GAME_ID, 1, { scenario: this.currentLevelIndex + 1 });

    // Mark today's daily challenge complete (once per daily-mode win)
    if (this.isDailyMode) completeDailyChallenge(GAME_ID);

    // Save progress
    await this.saveProgress();

    haptic('win');
    announce('Correct! The character is saved!');
  }

  /**
   * Handle lose condition
   */
  handleLose() {
    recordLevel(GAME_ID, { retryCount: this.levelRetries || 0, solveTime: Date.now() - (this.levelStartTime || Date.now()) }, { won: false });
    haptic('fail');
    announce('Wrong choice! The character was not saved. Try again!');
  }

  /**
   * Advance to next level
   */
  nextLevel() {
    if (this.currentLevelIndex < this.levels.length - 1) {
      this.startLevel(this.currentLevelIndex + 1);
    } else {
      // Game complete - loop back or show completion
      announce('Congratulations! You completed all scenarios!');
      this.startLevel(0);
    }
  }

  /**
   * Retry current level
   */
  retryLevel() {
    this.levelRetries = (this.levelRetries || 0) + 1;
    this.startLevel(this.currentLevelIndex);
  }

  /**
   * Handle window resize
   */
  handleResize() {
    if (this.renderer) {
      this.renderer.resize();
    }
  }

  /**
   * Teardown the game
   */
  teardown() {
    // Destroy input handler
    if (this.input) {
      this.input.destroy();
      this.input = null;
    }

    // Remove event listeners
    window.removeEventListener('resize', this.handleResize);

    // Destroy Phaser renderer
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }

    // Clear state
    this.state = null;

    console.log('Save the Character torn down');
  }

  /**
   * Save current game state for persistence on backgrounding
   * Persists level index, scenario id, and current selection state
   */
  saveGameState() {
    try {
      if (!this.state || this.state.status === 'won' || this.state.status === 'lost') {
        // Don't persist completed games
        storageSet(STATE_KEY, null);
        return;
      }

      const gameState = {
        currentLevelIndex: this.currentLevelIndex,
        isDailyMode: this.isDailyMode,
        scenario: {
          id: this.state.scenario.id,
          title: this.state.scenario.title,
          threat: this.state.scenario.threat,
          choices: this.state.scenario.choices.map(c => ({ ...c }))
        },
        selectedChoice: this.state.selectedChoice ? { ...this.state.selectedChoice } : null,
        status: this.state.status,
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
        scenario: {
          id: saved.scenario.id,
          title: saved.scenario.title,
          threat: saved.scenario.threat,
          choices: saved.scenario.choices.map(c => ({ ...c }))
        },
        selectedChoice: saved.selectedChoice ? { ...saved.selectedChoice } : null,
        status: saved.status || 'choosing',
      };

      // Update renderer with restored state
      this.renderer.render(this.state);

      // Update input state
      if (this.input) {
        this.input.updateState(this.state);
      }

      // Clear the saved state after restoration
      storageSet(STATE_KEY, null);

      return true;
    } catch (e) {
      // Silently fail if restoration fails
      return false;
    }
  }
}

// Game instance for standalone mode
let gameInstance = null;

/**
 * Initialize the game (exported for lifecycle integration)
 * @param {HTMLElement} container - Container element
 */
export async function init(container) {
  if (gameInstance) {
    gameInstance.teardown();
  }
  gameInstance = new SaveTheCharacterGame();
  await gameInstance.init(container);
  return gameInstance;
}

/**
 * Teardown the game (exported for lifecycle integration)
 */
export function teardown() {
  if (gameInstance) {
    gameInstance.teardown();
    gameInstance = null;
  }
}

// Auto-initialize in standalone mode
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.game-board') || document.body;
    init(container).catch(console.error);
  });
}

export { SaveTheCharacterGame };
export default SaveTheCharacterGame;
