/**
 * Save the Character - Main Game Logic
 *
 * Orchestrates the survival puzzle game with:
 * - Game state management
 * - Canvas rendering
 * - User input handling
 * - Level progression
 * - Integration with shared systems
 */

import { initStorage, getGameStats, updateGameStats } from '../../shared/storage.js';
import { awardLevelComplete } from '../../shared/meta.js';
import { initAccessibility, announce, isReducedMotionEnabled } from '../../shared/accessibility.js';
import { haptic } from '../../shared/haptics.js';
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

// Game constants
const GAME_ID = 'save-the-character';
const LEVELS_URL = './levels.json';
const ANIMATION_DURATION = 800; // ms for choice reveal animation
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
    this.state = null;
    this.renderer = null;
    this.input = null;

    // Animation state
    this.animationFrame = null;
    this.animationStartTime = null;
    this.resultDisplayTime = null;

    // Bind methods
    this.update = this.update.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  /**
   * Initialize the game
   * @param {HTMLElement} container - Container element for the game
   */
  async init(container) {
    try {
      this.container = container;

      // Find or create canvas
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

      // Load levels
      await this.loadLevels();

      // Create renderer
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

      // Load saved progress
      this.loadProgress();

      // Setup event listeners
      this.setupEventListeners();

      // Start game
      this.startLevel(this.currentLevelIndex);

      // Start game loop
      this.startGameLoop();

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
    this.animationStartTime = null;
    this.resultDisplayTime = null;

    // Update input state reference
    if (this.input) {
      this.input.updateState(this.state);
    }

    // Resize and render
    this.handleResize();
    this.render();

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

    // Press feedback
    if (this.renderer.setPressedChoice) this.renderer.setPressedChoice(choiceIndex);

    // Start animation
    this.animationStartTime = performance.now();
    this.renderer.setAnimationProgress(0);

    // Update input state
    this.input.updateState(this.state);

    announce(`Selected: ${choice.label}`);
  }

  /**
   * Handle choice hover
   */
  handleChoiceHover(choiceIndex) {
    this.renderer.setHoveredChoice(choiceIndex);
    this.render();
  }

  /**
   * Start the game loop
   */
  startGameLoop() {
    this.animationFrame = requestAnimationFrame(this.update);
  }

  /**
   * Main update loop
   */
  update(timestamp) {
    // Continue loop
    this.animationFrame = requestAnimationFrame(this.update);

    // Handle animation state
    if (isAnimating(this.state) && this.animationStartTime) {
      const elapsed = timestamp - this.animationStartTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      this.renderer.setAnimationProgress(progress);
      this.render();

      // Animation complete
      if (progress >= 1) {
        this.state = resolveChoice(this.state);
        this.input.updateState(this.state);
        this.resultDisplayTime = timestamp;

        if (isWon(this.state)) {
          if (this.renderer.triggerWinEffect) this.renderer.triggerWinEffect();
          this.handleWin();
        } else if (isLost(this.state)) {
          if (this.renderer.triggerLoseEffect) this.renderer.triggerLoseEffect();
          this.handleLose();
        }
      }
    }

    // Handle result display and progression
    if ((isWon(this.state) || isLost(this.state)) && this.resultDisplayTime) {
      const elapsed = timestamp - this.resultDisplayTime;

      if (elapsed >= RESULT_DISPLAY_DURATION) {
        if (isWon(this.state)) {
          this.nextLevel();
        } else {
          this.retryLevel();
        }
      }
    }
  }

  /**
   * Render the game
   */
  render() {
    if (this.state && this.renderer) {
      this.renderer.render(this.state);
    }
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
      this.render();
    }
  }

  /**
   * Teardown the game
   */
  teardown() {
    // Stop game loop
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Destroy input handler
    if (this.input) {
      this.input.destroy();
      this.input = null;
    }

    // Remove event listeners
    window.removeEventListener('resize', this.handleResize);

    // Clear state
    this.state = null;
    this.renderer = null;

    console.log('Save the Character torn down');
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
