/**
 * Quick Play - Intelligent game selection algorithm
 *
 * One tap → playing. No game selection, no level selection, no menus.
 *
 * Scoring factors:
 * - recencyPenalty: games played recently score lower (encourage variety)
 * - varietyBonus: never-played games score highest (encourage exploration)
 * - difficultyMatch: retry rate 10-30% scores highest (flow zone)
 */

import { storage } from './storage.js';

// Play history key in storage
const PLAY_HISTORY_KEY = 'playHistory';

// Scoring weights
const WEIGHTS = {
  recencyPenalty: 30,    // Max penalty for recent play
  varietyBonus: 50,      // Bonus for never-played games
  difficultyMatch: 40    // Max bonus for flow zone difficulty
};

// Time thresholds
const RECENCY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Game registry with level counts (for determining next unsolved level)
// This is a subset of games that are implemented and have levels
const GAME_REGISTRY = [
  { id: 'water-sort', title: 'Water Sort', category: 'puzzle', totalLevels: 10 },
  { id: 'brain-teaser', title: 'Brain Teaser', category: 'puzzle', totalLevels: 10 },
  { id: 'jelly-shift', title: 'Jelly Shift', category: 'arcade', totalLevels: 10 },
  { id: 'giant-runner', title: 'Giant Runner', category: 'arcade', totalLevels: 10 },
  { id: 'bus-jam', title: 'Bus Jam', category: 'puzzle', totalLevels: 10 },
  { id: 'save-the-character', title: 'Save the Character', category: 'puzzle', totalLevels: 10 }
];

/**
 * Get play history from storage
 * @returns {Object} Play history keyed by gameId
 */
export function getPlayHistory() {
  return storage.get(PLAY_HISTORY_KEY, {});
}

/**
 * Record a play session in history
 * @param {string} gameId - Game identifier
 * @param {Object} sessionData - Session data (completed, solveTime, retries)
 */
export function recordPlaySession(gameId, sessionData = {}) {
  const history = getPlayHistory();

  const existing = history[gameId] || {
    lastPlayed: null,
    sessions: 0,
    completed: 0,
    totalSolveTime: 0,
    totalRetries: 0
  };

  const updated = {
    ...existing,
    lastPlayed: Date.now(),
    sessions: existing.sessions + 1,
    completed: existing.completed + (sessionData.completed ? 1 : 0),
    totalSolveTime: existing.totalSolveTime + (sessionData.solveTime || 0),
    totalRetries: existing.totalRetries + (sessionData.retries || 0)
  };

  history[gameId] = updated;
  storage.set(PLAY_HISTORY_KEY, history);

  return updated;
}

/**
 * Calculate recency penalty
 * Lower score for games played recently
 * @param {Object} gameHistory - Game's play history
 * @returns {number} Penalty score (0 to -WEIGHTS.recencyPenalty)
 */
export function calculateRecencyPenalty(gameHistory) {
  if (!gameHistory || !gameHistory.lastPlayed) {
    return 0;
  }

  const timeSincePlay = Date.now() - gameHistory.lastPlayed;

  if (timeSincePlay >= RECENCY_WINDOW_MS) {
    return 0;
  }

  // Linear decay: full penalty at 0ms, 0 penalty at RECENCY_WINDOW_MS
  const penaltyRatio = 1 - (timeSincePlay / RECENCY_WINDOW_MS);
  return -WEIGHTS.recencyPenalty * penaltyRatio;
}

/**
 * Calculate variety bonus
 * Higher score for games never played
 * @param {Object} gameHistory - Game's play history
 * @returns {number} Bonus score (0 to WEIGHTS.varietyBonus)
 */
export function calculateVarietyBonus(gameHistory) {
  if (!gameHistory || gameHistory.sessions === 0) {
    return WEIGHTS.varietyBonus;
  }

  // Diminishing bonus based on play count
  // Fewer plays = higher bonus
  const sessionPenalty = Math.min(gameHistory.sessions * 5, WEIGHTS.varietyBonus);
  return WEIGHTS.varietyBonus - sessionPenalty;
}

/**
 * Calculate difficulty match score
 * Games with 10-30% retry rate score highest (flow zone)
 * @param {Object} gameHistory - Game's play history
 * @returns {number} Difficulty score (0 to WEIGHTS.difficultyMatch)
 */
export function calculateDifficultyMatch(gameHistory) {
  if (!gameHistory || gameHistory.sessions === 0) {
    // New game - assume good difficulty match
    return WEIGHTS.difficultyMatch * 0.8;
  }

  const totalAttempts = gameHistory.sessions + gameHistory.totalRetries;
  if (totalAttempts === 0) {
    return WEIGHTS.difficultyMatch * 0.8;
  }

  // Retry rate: proportion of extra attempts beyond first
  const retryRate = gameHistory.totalRetries / totalAttempts;

  // Flow zone is 10-30% retry rate
  // Too easy (< 10%) = lower score
  // Flow zone (10-30%) = highest score
  // Too hard (> 30%) = lower score

  if (retryRate >= 0.1 && retryRate <= 0.3) {
    // In flow zone - full points
    return WEIGHTS.difficultyMatch;
  }

  if (retryRate < 0.1) {
    // Too easy - reduce score based on how easy
    return WEIGHTS.difficultyMatch * (0.5 + retryRate * 5);
  }

  // Too hard - reduce score based on how hard
  // Cap at 0.9 to avoid division issues
  const adjustedRate = Math.min(retryRate, 0.9);
  return WEIGHTS.difficultyMatch * (1 - (adjustedRate - 0.3));
}

/**
 * Calculate total score for a game
 * @param {string} gameId - Game identifier
 * @param {Object} history - Full play history
 * @returns {number} Total score
 */
export function calculateGameScore(gameId, history) {
  const gameHistory = history[gameId];

  const recencyPenalty = calculateRecencyPenalty(gameHistory);
  const varietyBonus = calculateVarietyBonus(gameHistory);
  const difficultyMatch = calculateDifficultyMatch(gameHistory);

  return recencyPenalty + varietyBonus + difficultyMatch;
}

/**
 * Pick the best game to play based on play history
 * @returns {Object} Selected game with id and level
 */
export function pickGame() {
  const history = getPlayHistory();
  const availableGames = getAvailableGames();

  if (availableGames.length === 0) {
    // Fallback: water-sort level 1
    return { gameId: 'water-sort', level: 1 };
  }

  // Check if this is first visit (no history at all)
  const hasAnyHistory = Object.keys(history).length > 0;
  if (!hasAnyHistory) {
    // First visit - default to Water Sort level 1
    return { gameId: 'water-sort', level: 1 };
  }

  // Score all available games
  const scored = availableGames.map(game => ({
    game,
    score: calculateGameScore(game.id, history)
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Pick highest scoring game
  const selected = scored[0].game;

  // Determine next unsolved level
  const level = getNextUnsolvedLevel(selected.id, history);

  return {
    gameId: selected.id,
    level
  };
}

/**
 * Get list of available games
 * @returns {Array} Available games from registry
 */
export function getAvailableGames() {
  return [...GAME_REGISTRY];
}

/**
 * Get top candidate games for preloading
 * Returns the top 2 games by score
 * @returns {Array} Array of {gameId, level} for top candidates
 */
export function getTopCandidates() {
  const history = getPlayHistory();
  const availableGames = getAvailableGames();

  if (availableGames.length === 0) {
    return [{ gameId: 'water-sort', level: 1 }];
  }

  // Check if first visit
  const hasAnyHistory = Object.keys(history).length > 0;
  if (!hasAnyHistory) {
    return [
      { gameId: 'water-sort', level: 1 },
      { gameId: 'brain-teaser', level: 1 }
    ];
  }

  // Score all games
  const scored = availableGames.map(game => ({
    gameId: game.id,
    level: getNextUnsolvedLevel(game.id, history),
    score: calculateGameScore(game.id, history)
  }));

  // Sort by score descending and take top 2
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 2).map(({ gameId, level }) => ({ gameId, level }));
}

/**
 * Get the next unsolved level for a game
 * @param {string} gameId - Game identifier
 * @param {Object} history - Full play history
 * @returns {number} Level number (1-indexed)
 */
export function getNextUnsolvedLevel(gameId, history) {
  const game = GAME_REGISTRY.find(g => g.id === gameId);
  if (!game) return 1;

  const gameHistory = history[gameId];

  if (!gameHistory || gameHistory.completed === 0) {
    // Never completed any levels - start at 1
    return 1;
  }

  // Next level is one after last completed
  const nextLevel = gameHistory.completed + 1;

  // Cap at total levels
  if (nextLevel > game.totalLevels) {
    return game.totalLevels;
  }

  return nextLevel;
}

/**
 * Get URL for a game with optional level
 * @param {string} gameId - Game identifier
 * @param {number} [level] - Optional level number
 * @returns {string} Game URL
 */
export function getGameUrl(gameId, level) {
  let url = `/${gameId}/`;
  if (level && level > 1) {
    url += `?level=${level}`;
  }
  return url;
}

/**
 * Navigate to quick play selection
 * Picks the best game and navigates to it
 */
export function navigateToQuickPlay() {
  const { gameId, level } = pickGame();
  window.location.href = getGameUrl(gameId, level);
}

// Export game registry for external use
export { GAME_REGISTRY };
