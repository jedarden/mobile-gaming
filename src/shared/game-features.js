/**
 * Game Features Integration Module
 *
 * Provides a unified API for integrating game-level features:
 * - GIF Export with recording
 * - Adaptive Difficulty
 * - Visual Undo Timeline
 * - Infinite Mode
 *
 * Usage:
 * ```javascript
 * import { createGameFeatures } from '../../shared/game-features.js';
 *
 * const features = createGameFeatures({
 *   gameId: 'pull-the-pin',
 *   renderFrame: (canvas, state) => { ... },
 *   availableLevels: levels
 * });
 *
 * // Start recording for GIF export
 * features.startRecording();
 * features.captureFrame(state);
 *
 * // On level complete
 * const gif = await features.stopAndExportGIF();
 * await features.shareGIF(gif, levelInfo);
 *
 * // Get adaptive level recommendation
 * const nextLevel = features.selectNextLevel();
 * ```
 */

import { GIFExporter, createGIFExporter } from './gif-export.js';
import { getAdaptiveDifficulty, createAdaptiveDifficulty } from './adaptive-difficulty.js';
import { createUndoTimeline } from './undo-timeline.js';
import { History } from './history.js';
import { Share } from './share.js';

/**
 * Game Features Manager
 */
export class GameFeatures {
  constructor(options = {}) {
    this.gameId = options.gameId || 'unknown-game';
    this.renderFrame = options.renderFrame;
    this.availableLevels = options.availableLevels || [];

    // Initialize subsystems
    this.adaptiveDifficulty = createAdaptiveDifficulty(this.gameId);
    this.history = new History(options.maxHistory || 50);
    this.undoTimeline = null;
    this.gifExporter = null;

    // State
    this.recording = false;
    this.recordedStates = [];
    this.currentLevel = null;
    this.levelStartTime = null;
  }

  /**
   * Initialize all features
   */
  async init(options = {}) {
    const {
      undoTimelineContainer,
      undoThumbnailRenderer,
      gifWidth = 400,
      gifHeight = 600
    } = options;

    // Initialize adaptive difficulty
    await this.adaptiveDifficulty.init(this.gameId);

    // Initialize undo timeline if container provided
    if (undoTimelineContainer) {
      this.undoTimeline = createUndoTimeline({
        container: undoTimelineContainer,
        renderThumbnail: undoThumbnailRenderer || this.renderFrame,
        onStateChange: (state, index) => {
          if (options.onStateChange) {
            options.onStateChange(state, index);
          }
        }
      });
    }

    // Initialize GIF exporter
    this.gifExporter = createGIFExporter({
      width: gifWidth,
      height: gifHeight,
      renderFrame: this.renderFrame
    });

    return this;
  }

  // ==================== History & Undo ====================

  /**
   * Push state to history
   */
  pushState(state) {
    this.history.push(state);

    if (this.recording) {
      this.recordedStates.push(state);
    }

    if (this.undoTimeline) {
      this.undoTimeline.refresh();
    }
  }

  /**
   * Undo to previous state
   */
  undo() {
    if (!this.history.canUndo()) return null;

    const state = this.history.undo();

    if (this.undoTimeline) {
      this.undoTimeline.setPosition(this.history.position);
    }

    return state;
  }

  /**
   * Redo to next state
   */
  redo() {
    if (!this.history.canRedo()) return null;

    const state = this.history.redo();

    if (this.undoTimeline) {
      this.undoTimeline.setPosition(this.history.position);
    }

    return state;
  }

  /**
   * Jump to specific history state
   */
  jumpToState(index) {
    const state = this.history.jumpTo(index);

    if (this.undoTimeline) {
      this.undoTimeline.setPosition(index);
    }

    return state;
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history.clear();
    this.recordedStates = [];

    if (this.undoTimeline) {
      this.undoTimeline.updateTimeline();
    }
  }

  // ==================== GIF Export ====================

  /**
   * Start recording for GIF export
   */
  startRecording() {
    this.recording = true;
    this.recordedStates = [];

    // Capture initial state
    if (this.history.current()) {
      this.recordedStates.push(this.history.current());
    }

    this.gifExporter.startRecording();
  }

  /**
   * Capture current state for GIF
   */
  captureFrame(state, delayMs = 500) {
    if (this.recording) {
      this.recordedStates.push(state);
      this.gifExporter.captureState(state, delayMs);
    }
  }

  /**
   * Stop recording and generate GIF
   */
  async stopAndExportGIF(options = {}) {
    this.recording = false;
    return this.gifExporter.stopAndGenerate(options);
  }

  /**
   * Share GIF using Web Share API or download
   */
  async shareGIF(blob, levelInfo = {}) {
    return Share.shareGIF(blob, {
      gameId: this.gameId,
      levelId: levelInfo.id || this.currentLevel?.id,
      moves: levelInfo.moves,
      title: levelInfo.title
    });
  }

  /**
   * Preview GIF in modal
   */
  previewGIF(blob) {
    return this.gifExporter.previewGIF(blob);
  }

  /**
   * Get recorded states (for custom processing)
   */
  getRecordedStates() {
    return [...this.recordedStates];
  }

  // ==================== Adaptive Difficulty ====================

  /**
   * Start a level (for tracking)
   */
  startLevel(level) {
    this.currentLevel = level;
    this.levelStartTime = Date.now();
    this.clearHistory();

    // Push initial state
    if (level.initialState) {
      this.pushState(level.initialState);
    }
  }

  /**
   * Record level completion
   */
  async recordCompletion(result) {
    const completionData = {
      levelId: this.currentLevel?.id || result.levelId,
      moves: result.moves,
      optimalMoves: result.optimalMoves || this.currentLevel?.optimalMoves || result.moves,
      timeMs: result.timeMs || (this.levelStartTime ? Date.now() - this.levelStartTime : 0),
      expectedTimeMs: result.expectedTimeMs || this.currentLevel?.expectedTime || 60000,
      usedHint: result.usedHint || false,
      stars: result.stars || 0
    };

    return this.adaptiveDifficulty.recordCompletion(completionData);
  }

  /**
   * Record level failure
   */
  async recordFailure(levelId, attempts = 1) {
    return this.adaptiveDifficulty.recordFailure(levelId || this.currentLevel?.id, attempts);
  }

  /**
   * Record level abandonment
   */
  async recordAbandon(levelId) {
    const timePlayed = this.levelStartTime ? Date.now() - this.levelStartTime : 0;
    return this.adaptiveDifficulty.recordAbandon(levelId || this.currentLevel?.id, timePlayed);
  }

  /**
   * Select next level using adaptive difficulty
   */
  selectNextLevel(completedIds = new Set()) {
    return this.adaptiveDifficulty.selectNextLevel(this.availableLevels, {
      completedIds,
      preferUnplayed: true
    });
  }

  /**
   * Get level recommendation
   */
  getLevelRecommendation(completedIds = new Set()) {
    return this.adaptiveDifficulty.getRecommendation(this.availableLevels, {
      completedIds
    });
  }

  /**
   * Get current difficulty metrics
   */
  getDifficultyMetrics() {
    return this.adaptiveDifficulty.getMetrics();
  }

  /**
   * Get target difficulty (0-1)
   */
  getTargetDifficulty() {
    return this.adaptiveDifficulty.getTargetDifficulty();
  }

  /**
   * Check if adaptive difficulty is enabled
   */
  isAdaptiveEnabled() {
    return this.adaptiveDifficulty.isEnabled();
  }

  /**
   * Enable/disable adaptive difficulty
   */
  async setAdaptiveEnabled(enabled) {
    return this.adaptiveDifficulty.setEnabled(enabled);
  }

  // ==================== Utility ====================

  /**
   * Set available levels
   */
  setAvailableLevels(levels) {
    this.availableLevels = levels;
  }

  /**
   * Get current level
   */
  getCurrentLevel() {
    return this.currentLevel;
  }

  /**
   * Check if currently recording
   */
  isRecording() {
    return this.recording;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.undoTimeline) {
      this.undoTimeline.cleanup();
    }
    this.clearHistory();
    this.recordedStates = [];
  }
}

/**
 * Create a GameFeatures instance
 */
export function createGameFeatures(options) {
  return new GameFeatures(options);
}

/**
 * Quick setup function for common game configuration
 */
export async function setupGameFeatures(config) {
  const {
    gameId,
    canvas,
    availableLevels,
    onUndo,
    container
  } = config;

  // Create thumbnail renderer from canvas
  const renderThumbnail = (state, thumbCanvas, scale) => {
    const ctx = thumbCanvas.getContext('2d');
    // Scale to fit thumbnail
    const scaleX = thumbCanvas.width / canvas.width;
    const scaleY = thumbCanvas.height / canvas.height;
    const s = Math.min(scaleX, scaleY);

    ctx.save();
    ctx.scale(s, s);
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
  };

  const features = createGameFeatures({
    gameId,
    renderFrame: renderThumbnail,
    availableLevels
  });

  await features.init({
    undoTimelineContainer: container?.undoTimeline,
    undoThumbnailRenderer: renderThumbnail,
    gifWidth: canvas.width,
    gifHeight: canvas.height,
    onStateChange: onUndo
  });

  return features;
}

export default {
  GameFeatures,
  createGameFeatures,
  setupGameFeatures
};
