/**
 * Adaptive Difficulty Module - Smart Dynamic Difficulty Adjustment
 *
 * Provides:
 * - Player skill modeling based on performance metrics
 * - Dynamic difficulty adjustment based on player behavior
 * - Level selection optimization
 * - Frustration detection and prevention
 * - Engagement tracking
 */

import { getSettings, updateSettings, getGameStats, updateGameStats } from './storage.js';

// Configuration constants
const CONFIG = {
  // Weights for skill score calculation
  weights: {
    efficiency: 0.4,    // How close to optimal solution
    speed: 0.2,         // Time relative to expected
    consistency: 0.2,   // Variance in performance
    persistence: 0.2    // Completion rate
  },

  // Adjustment thresholds
  adjustment: {
    consecutiveFails: 3,      // Fails before decreasing difficulty
    consecutiveSuccesses: 3,  // Successes before increasing difficulty
    failPenalty: 0.10,        // Decrease per fail streak
    successBonus: 0.10,       // Increase per success streak
    abandonPenalty: 0.05,     // Decrease for abandoning level
    hintPenalty: 0.02,        // Optional small decrease for hints
    maxDifficulty: 1.0,
    minDifficulty: 0.1
  },

  // Skill model parameters
  skill: {
    historySize: 20,          // Number of recent solves to track
    targetBandwidth: 0.15,    // ±15% target difficulty range
    smoothingFactor: 0.3      // EMA smoothing for skill score
  }
};

/**
 * Player skill metrics tracker
 */
class SkillModel {
  constructor() {
    this.recentSolves = [];
    this.abandonCount = 0;
    this.hintCount = 0;
    this.sessionStats = {
      startTime: null,
      levelsPlayed: 0,
      levelsCompleted: 0,
      totalMoves: 0,
      totalTime: 0
    };
    this.skillScore = 0.5; // Start at medium difficulty
    this.targetDifficulty = 0.5;
    this.enabled = true;
  }

  /**
   * Record a level completion
   */
  recordCompletion(result) {
    const {
      levelId,
      moves,
      optimalMoves,
      timeMs,
      expectedTimeMs,
      usedHint = false,
      stars = 0
    } = result;

    // Calculate efficiency (1.0 = optimal, higher = less efficient)
    const efficiency = moves / Math.max(1, optimalMoves);

    // Calculate speed (1.0 = expected, higher = slower)
    const speed = timeMs / Math.max(1, expectedTimeMs);

    // Add to recent solves
    this.recentSolves.push({
      levelId,
      moves,
      optimalMoves,
      timeMs,
      expectedTimeMs,
      efficiency,
      speed,
      usedHint,
      stars,
      timestamp: Date.now()
    });

    // Trim to history size
    if (this.recentSolves.length > CONFIG.skill.historySize) {
      this.recentSolves.shift();
    }

    // Update session stats
    this.sessionStats.levelsCompleted++;
    this.sessionStats.totalMoves += moves;
    this.sessionStats.totalTime += timeMs;

    // Recalculate skill score
    this.updateSkillScore();

    // Check for difficulty adjustment
    this.checkAdjustment();

    if (usedHint) {
      this.hintCount++;
    }

    return this.getSkillScore();
  }

  /**
   * Record a level failure
   */
  recordFailure(levelId, attempts = 1) {
    // Track failure in recent solves
    this.recentSolves.push({
      levelId,
      failed: true,
      attempts,
      timestamp: Date.now()
    });

    if (this.recentSolves.length > CONFIG.skill.historySize) {
      this.recentSolves.shift();
    }

    // Update skill score
    this.updateSkillScore();

    // Check for difficulty adjustment
    this.checkAdjustment();

    return this.getSkillScore();
  }

  /**
   * Record level abandonment
   */
  recordAbandon(levelId, timePlayedMs) {
    this.abandonCount++;
    this.sessionStats.levelsPlayed++;

    // Decrease target difficulty slightly
    this.adjustDifficulty(-CONFIG.adjustment.abandonPenalty);

    return this.getSkillScore();
  }

  /**
   * Calculate current skill score
   */
  updateSkillScore() {
    if (this.recentSolves.length === 0) {
      return this.skillScore;
    }

    const w = CONFIG.weights;

    // Calculate average efficiency (inverted - lower is better)
    const completions = this.recentSolves.filter(s => !s.failed);
    const avgEfficiency = completions.length > 0
      ? completions.reduce((sum, s) => sum + s.efficiency, 0) / completions.length
      : 1.5;

    // Efficiency score: 1.0 at optimal, decreasing for worse
    const efficiencyScore = Math.min(1, 1 / avgEfficiency);

    // Calculate average speed
    const avgSpeed = completions.length > 0
      ? completions.reduce((sum, s) => sum + s.speed, 0) / completions.length
      : 1.5;

    // Speed score: 1.0 at expected time, decreasing for slower
    const speedScore = Math.min(1, 1 / avgSpeed);

    // Calculate consistency (lower variance = higher score)
    const variance = this.calculateVariance();
    const consistencyScore = Math.max(0, 1 - Math.min(1, variance / 10));

    // Calculate persistence (completion rate)
    const failRate = this.recentSolves.filter(s => s.failed).length / this.recentSolves.length;
    const persistenceScore = 1 - failRate;

    // Weighted average
    const rawScore = (
      efficiencyScore * w.efficiency +
      speedScore * w.speed +
      consistencyScore * w.consistency +
      persistenceScore * w.persistence
    );

    // Exponential moving average for smoothing
    this.skillScore = this.skillScore * (1 - CONFIG.skill.smoothingFactor) +
                       rawScore * CONFIG.skill.smoothingFactor;

    return this.skillScore;
  }

  /**
   * Calculate variance in performance
   */
  calculateVariance() {
    const completions = this.recentSolves.filter(s => !s.failed);
    if (completions.length < 2) return 0;

    // Calculate variance of efficiency scores
    const efficiencies = completions.map(s => s.efficiency);
    const mean = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length;
    const variance = efficiencies.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / efficiencies.length;

    return Math.sqrt(variance); // Return standard deviation
  }

  /**
   * Check if difficulty adjustment is needed
   */
  checkAdjustment() {
    const recent = this.recentSolves.slice(-CONFIG.adjustment.consecutiveFails);

    // Check for consecutive failures
    const recentFailures = recent.filter(s => s.failed).length;
    if (recentFailures >= CONFIG.adjustment.consecutiveFails) {
      this.adjustDifficulty(-CONFIG.adjustment.failPenalty);
      return;
    }

    // Check for consecutive 3-star completions
    const recentSuccesses = recent.filter(s => s.stars === 3 && !s.failed);
    if (recentSuccesses.length >= CONFIG.adjustment.consecutiveSuccesses) {
      this.adjustDifficulty(CONFIG.adjustment.successBonus);
      return;
    }
  }

  /**
   * Adjust target difficulty
   */
  adjustDifficulty(delta) {
    this.targetDifficulty = Math.max(
      CONFIG.adjustment.minDifficulty,
      Math.min(CONFIG.adjustment.maxDifficulty, this.targetDifficulty + delta)
    );
  }

  /**
   * Get current skill score (0-1)
   */
  getSkillScore() {
    return Math.max(0, Math.min(1, this.skillScore));
  }

  /**
   * Get target difficulty for next level
   */
  getTargetDifficulty() {
    return this.targetDifficulty;
  }

  /**
   * Get metrics for display
   */
  getMetrics() {
    const completions = this.recentSolves.filter(s => !s.failed);

    return {
      skillScore: Math.round(this.skillScore * 100),
      targetDifficulty: Math.round(this.targetDifficulty * 100),
      recentCompletes: completions.length,
      recentFails: this.recentSolves.filter(s => s.failed).length,
      abandonRate: this.abandonCount / Math.max(1, this.sessionStats.levelsPlayed),
      averageEfficiency: completions.length > 0
        ? (completions.reduce((sum, s) => sum + s.efficiency, 0) / completions.length).toFixed(2)
        : 'N/A',
      averageSpeed: completions.length > 0
        ? (completions.reduce((sum, s) => sum + s.speed, 0) / completions.length).toFixed(2)
        : 'N/A',
      consistency: (1 - Math.min(1, this.calculateVariance() / 10)).toFixed(2)
    };
  }

  /**
   * Reset skill model
   */
  reset() {
    this.recentSolves = [];
    this.abandonCount = 0;
    this.hintCount = 0;
    this.sessionStats = {
      startTime: Date.now(),
      levelsPlayed: 0,
      levelsCompleted: 0,
      totalMoves: 0,
      totalTime: 0
    };
    this.skillScore = 0.5;
    this.targetDifficulty = 0.5;
  }

  /**
   * Export state for persistence
   */
  export() {
    return {
      skillScore: this.skillScore,
      targetDifficulty: this.targetDifficulty,
      recentSolves: this.recentSolves.slice(-10), // Keep last 10 for persistence
      abandonCount: this.abandonCount
    };
  }

  /**
   * Import state from persistence
   */
  import(data) {
    if (data.skillScore !== undefined) this.skillScore = data.skillScore;
    if (data.targetDifficulty !== undefined) this.targetDifficulty = data.targetDifficulty;
    if (data.recentSolves) this.recentSolves = data.recentSolves;
    if (data.abandonCount !== undefined) this.abandonCount = data.abandonCount;
  }
}

/**
 * Level Selector - Selects appropriate levels based on skill
 */
class LevelSelector {
  constructor(skillModel) {
    this.skillModel = skillModel;
    this.levelHistory = new Map(); // levelId -> { playCount, lastPlayed }
  }

  /**
   * Select next level from available levels
   */
  selectNextLevel(availableLevels, options = {}) {
    const {
      excludeCompleted = false,
      preferUnplayed = true,
      completedIds = new Set()
    } = options;

    const targetDifficulty = this.skillModel.getTargetDifficulty();
    const bandwidth = CONFIG.skill.targetBandwidth;

    // Filter levels in target difficulty range
    const suitableLevels = availableLevels.filter(level => {
      // Skip if completed and excluding
      if (excludeCompleted && completedIds.has(level.id)) {
        return false;
      }

      // Check difficulty range
      const difficulty = level.difficulty || 0.5;
      return difficulty >= targetDifficulty - bandwidth &&
             difficulty <= targetDifficulty + bandwidth;
    });

    if (suitableLevels.length === 0) {
      // No levels in range, get closest match
      return this.getClosestLevel(availableLevels, targetDifficulty, completedIds);
    }

    // Sort by preference
    suitableLevels.sort((a, b) => {
      // Prefer unplayed
      if (preferUnplayed) {
        const aPlayed = this.levelHistory.get(a.id)?.playCount || 0;
        const bPlayed = this.levelHistory.get(b.id)?.playCount || 0;
        if (aPlayed !== bPlayed) return aPlayed - bPlayed;
      }

      // Then by closest to target
      const aDiff = Math.abs((a.difficulty || 0.5) - targetDifficulty);
      const bDiff = Math.abs((b.difficulty || 0.5) - targetDifficulty);
      return aDiff - bDiff;
    });

    return suitableLevels[0];
  }

  /**
   * Get level closest to target difficulty
   */
  getClosestLevel(levels, targetDifficulty, completedIds) {
    const uncompleted = levels.filter(l => !completedIds.has(l.id));

    if (uncompleted.length === 0) {
      // All completed, pick least recently played
      const sorted = [...levels].sort((a, b) => {
        const aTime = this.levelHistory.get(a.id)?.lastPlayed || 0;
        const bTime = this.levelHistory.get(b.id)?.lastPlayed || 0;
        return aTime - bTime;
      });
      return sorted[0];
    }

    // Find closest to target
    return uncompleted.reduce((closest, level) => {
      const levelDiff = Math.abs((level.difficulty || 0.5) - targetDifficulty);
      const closestDiff = Math.abs((closest.difficulty || 0.5) - targetDifficulty);
      return levelDiff < closestDiff ? level : closest;
    });
  }

  /**
   * Record level play
   */
  recordPlay(levelId) {
    const current = this.levelHistory.get(levelId) || { playCount: 0, lastPlayed: 0 };
    this.levelHistory.set(levelId, {
      playCount: current.playCount + 1,
      lastPlayed: Date.now()
    });
  }

  /**
   * Get level recommendation with alternatives
   */
  getRecommendation(availableLevels, options = {}) {
    const selected = this.selectNextLevel(availableLevels, options);

    // Find similar difficulty alternatives
    const alternatives = availableLevels
      .filter(l => l.id !== selected.id)
      .filter(l => {
        const diff = Math.abs((l.difficulty || 0.5) - (selected.difficulty || 0.5));
        return diff < 0.1;
      })
      .slice(0, 3);

    return {
      recommended: selected,
      alternatives,
      targetDifficulty: this.skillModel.getTargetDifficulty(),
      skillScore: this.skillModel.getSkillScore()
    };
  }
}

/**
 * Adaptive Difficulty Manager - Main API
 */
class AdaptiveDifficultyManager {
  constructor() {
    this.skillModel = new SkillModel();
    this.levelSelector = new LevelSelector(this.skillModel);
    this.enabled = true;
    this.gameId = null;
  }

  /**
   * Initialize for a specific game
   */
  async init(gameId) {
    this.gameId = gameId;

    // Load saved state
    const settings = getSettings();
    this.enabled = settings.adaptiveDifficulty !== false;

    // Load persisted skill model
    const stats = getGameStats(gameId);
    if (stats.skillModel) {
      this.skillModel.import(stats.skillModel);
    }

    return this;
  }

  /**
   * Check if adaptive difficulty is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Enable/disable adaptive difficulty
   */
  async setEnabled(enabled) {
    this.enabled = enabled;
    await updateSettings({ adaptiveDifficulty: enabled });
  }

  /**
   * Record level completion
   */
  async recordCompletion(result) {
    if (!this.enabled) return null;

    const skillScore = this.skillModel.recordCompletion(result);
    await this.saveState();

    return {
      skillScore,
      targetDifficulty: this.skillModel.getTargetDifficulty(),
      adjustment: this.detectAdjustment()
    };
  }

  /**
   * Record level failure
   */
  async recordFailure(levelId, attempts = 1) {
    if (!this.enabled) return null;

    const skillScore = this.skillModel.recordFailure(levelId, attempts);
    await this.saveState();

    return {
      skillScore,
      targetDifficulty: this.skillModel.getTargetDifficulty(),
      adjustment: this.detectAdjustment()
    };
  }

  /**
   * Record level abandonment
   */
  async recordAbandon(levelId, timePlayedMs) {
    if (!this.enabled) return null;

    const skillScore = this.skillModel.recordAbandon(levelId, timePlayedMs);
    await this.saveState();

    return {
      skillScore,
      targetDifficulty: this.skillModel.getTargetDifficulty()
    };
  }

  /**
   * Select next level
   */
  selectNextLevel(availableLevels, options = {}) {
    if (!this.enabled) {
      // Return first uncompleted or first level
      const uncompleted = availableLevels.filter(l => !options.completedIds?.has(l.id));
      return uncompleted[0] || availableLevels[0];
    }

    const selected = this.levelSelector.selectNextLevel(availableLevels, options);
    this.levelSelector.recordPlay(selected.id);
    return selected;
  }

  /**
   * Get level recommendation
   */
  getRecommendation(availableLevels, options = {}) {
    if (!this.enabled) {
      return {
        recommended: availableLevels[0],
        alternatives: availableLevels.slice(1, 4),
        targetDifficulty: 0.5,
        skillScore: 0.5
      };
    }

    return this.levelSelector.getRecommendation(availableLevels, options);
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.skillModel.getMetrics(),
      enabled: this.enabled
    };
  }

  /**
   * Get target difficulty (0-1)
   */
  getTargetDifficulty() {
    return this.skillModel.getTargetDifficulty();
  }

  /**
   * Get skill score (0-1)
   */
  getSkillScore() {
    return this.skillModel.getSkillScore();
  }

  /**
   * Detect if difficulty was recently adjusted
   */
  detectAdjustment() {
    const recent = this.skillModel.recentSolves.slice(-5);
    const failures = recent.filter(s => s.failed).length;

    if (failures >= CONFIG.adjustment.consecutiveFails) {
      return { direction: 'down', reason: 'consecutive_failures' };
    }

    const stars3 = recent.filter(s => s.stars === 3).length;
    if (stars3 >= CONFIG.adjustment.consecutiveSuccesses) {
      return { direction: 'up', reason: 'consecutive_successes' };
    }

    return null;
  }

  /**
   * Save state to storage
   */
  async saveState() {
    if (!this.gameId) return;

    await updateGameStats(this.gameId, {
      skillModel: this.skillModel.export()
    });
  }

  /**
   * Reset skill model
   */
  async reset() {
    this.skillModel.reset();
    await this.saveState();
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create adaptive difficulty manager
 */
export function getAdaptiveDifficulty(gameId) {
  if (!instance) {
    instance = new AdaptiveDifficultyManager();
  }
  if (gameId) {
    instance.init(gameId);
  }
  return instance;
}

/**
 * Create a new adaptive difficulty manager (for testing)
 */
export function createAdaptiveDifficulty(gameId) {
  const manager = new AdaptiveDifficultyManager();
  if (gameId) {
    manager.init(gameId);
  }
  return manager;
}

// Export classes for advanced use
export { SkillModel, LevelSelector, AdaptiveDifficultyManager, CONFIG };

export default {
  getAdaptiveDifficulty,
  createAdaptiveDifficulty,
  SkillModel,
  LevelSelector,
  AdaptiveDifficultyManager,
  CONFIG
};
