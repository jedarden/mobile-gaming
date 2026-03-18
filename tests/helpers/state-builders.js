/**
 * Factory functions for creating game states in tests
 *
 * Provides consistent state builders that make tests more readable
 * and maintainable. Each builder function creates a fresh game state
 * with sensible defaults.
 */

/**
 * Create a basic game state
 *
 * @param {Object} options - State overrides
 * @returns {Object} Game state
 */
export function createGameState(options = {}) {
  return {
    status: 'playing',
    score: 0,
    moves: 0,
    startTime: Date.now(),
    level: 1,
    ...options
  };
}

/**
 * Create a win state
 *
 * @param {Object} options - State overrides
 * @returns {Object} Game state with win status
 */
export function createWinState(options = {}) {
  return createGameState({
    status: 'won',
    score: 100,
    moves: options.moves || 5,
    timeSpent: options.timeSpent || 10000,
    ...options
  });
}

/**
 * Create a loss state
 *
 * @param {Object} options - State overrides
 * @returns {Object} Game state with loss status
 */
export function createLossState(options = {}) {
  return createGameState({
    status: 'lost',
    score: 0,
    moves: options.moves || 3,
    timeSpent: options.timeSpent || 8000,
    ...options
  });
}

/**
 * Create a paused state
 *
 * @param {Object} options - State overrides
 * @returns {Object} Game state with paused status
 */
export function createPausedState(options = {}) {
  return createGameState({
    status: 'paused',
    ...options
  });
}

/**
 * Create a Pull the Pin level state
 *
 * @param {Object} options - Level overrides
 * @returns {Object} Pull the Pin level state
 */
export function createPullThePinLevel(options = {}) {
  return {
    version: 1,
    id: options.id || 'test-level-1',
    title: options.title || 'Test Level',
    difficulty: options.difficulty || 1,
    elements: options.elements || [],
    hero: { x: 100, y: 300, radius: 15 },
    goal: { x: 300, y: 500, type: 'bucket' },
    goblin: { x: 300, y: 450, radius: 12 },
    ...options
  };
}

/**
 * Create a Water Sort level state
 *
 * @param {Object} options - Level overrides
 * @returns {Object} Water Sort level state
 */
export function createWaterSortLevel(options = {}) {
  return {
    version: 1,
    id: options.id || 'ws-test-1',
    title: options.title || 'Test Level',
    difficulty: options.difficulty || 1,
    tubes: options.tubes || [
      { colors: ['red', 'red', 'red', 'red'], capacity: 4 },
      { colors: ['blue', 'blue', 'blue', 'blue'], capacity: 4 },
      { colors: [], capacity: 4 }
    ],
    maxMoves: options.maxMoves || 10,
    ...options
  };
}

/**
 * Create a Brain Teaser level state
 *
 * @param {Object} options - Level overrides
 * @returns {Object} Brain Teaser level state
 */
export function createBrainTeaserLevel(options = {}) {
  return {
    version: 1,
    id: options.id || 'bt-test-1',
    title: options.title || 'Test Level',
    difficulty: options.difficulty || 1,
    puzzle: options.puzzle || {
      type: 'connect',
      elements: []
    },
    targetMoves: options.targetMoves || 5,
    ...options
  };
}

/**
 * Create a Parking Escape level state
 *
 * @param {Object} options - Level overrides
 * @returns {Object} Parking Escape level state
 */
export function createParkingEscapeLevel(options = {}) {
  return {
    version: 1,
    id: options.id || 'pe-test-1',
    title: options.title || 'Test Level',
    difficulty: options.difficulty || 1,
    grid: {
      width: 6,
      height: 6,
      vehicles: options.vehicles || [
        { id: 'hero', type: 'hero', x: 2, y: 2, width: 2, height: 1, orientation: 'horizontal' }
      ],
      exit: { x: 5, y: 2 }
    },
    targetMoves: options.targetMoves || 10,
    ...options
  };
}

/**
 * Create a level progress entry
 *
 * @param {Object} options - Progress overrides
 * @returns {Object} Level progress
 */
export function createLevelProgress(options = {}) {
  return {
    levelId: options.levelId || 'test-level-1',
    completed: options.completed !== undefined ? options.completed : false,
    bestScore: options.bestScore || 0,
    bestMoves: options.bestMoves || null,
    bestTime: options.bestTime || null,
    attempts: options.attempts || 0,
    lastPlayed: options.lastPlayed || null,
    ...options
  };
}

/**
 * Create player profile
 *
 * @param {Object} options - Profile overrides
 * @returns {Object} Player profile
 */
export function createPlayerProfile(options = {}) {
  return {
    version: 1,
    createdAt: options.createdAt || Date.now(),
    totalGamesPlayed: options.totalGamesPlayed || 0,
    totalWins: options.totalWins || 0,
    favoriteGame: options.favoriteGame || null,
    achievements: options.achievements || [],
    settings: options.settings || {
      soundEnabled: true,
      hapticEnabled: true,
      colorBlindMode: false,
      darkMode: null
    },
    ...options
  };
}

/**
 * Create history state entry
 *
 * @param {Object} options - History overrides
 * @returns {Object} History state entry
 */
export function createHistoryState(options = {}) {
  return {
    timestamp: options.timestamp || Date.now(),
    action: options.action || 'move',
    data: options.data || {},
    previousState: options.previousState || null,
    ...options
  };
}

/**
 * Create a daily challenge state
 *
 * @param {Object} options - Challenge overrides
 * @returns {Object} Daily challenge state
 */
export function createDailyChallenge(options = {}) {
  const today = new Date();
  const dateStr = options.date || today.toISOString().split('T')[0];

  return {
    date: dateStr,
    gameId: options.gameId || 'pull-the-pin',
    levelId: options.levelId || 'daily-1',
    completed: options.completed || false,
    attempts: options.attempts || 0,
    bestScore: options.bestScore || null,
    seed: options.seed || dateStr,
    ...options
  };
}

/**
 * Create an infinite mode session
 *
 * @param {Object} options - Session overrides
 * @returns {Object} Infinite mode session
 */
export function createInfiniteSession(options = {}) {
  return {
    gameId: options.gameId || 'pull-the-pin',
    startLevel: options.startLevel || 1,
    currentLevel: options.currentLevel || 1,
    score: options.score || 0,
    lives: options.lives !== undefined ? options.lives : 3,
    seed: options.seed || 'infinite-' + Date.now(),
    startTime: options.startTime || Date.now(),
    ...options
  };
}

/**
 * Create level metadata
 *
 * @param {Object} options - Metadata overrides
 * @returns {Object} Level metadata
 */
export function createLevelMetadata(options = {}) {
  return {
    id: options.id || 'test-level-1',
    gameId: options.gameId || 'pull-the-pin',
    title: options.title || 'Test Level',
    difficulty: options.difficulty || 1,
    isHandcrafted: options.isHandcrafted !== undefined ? options.isHandcrafted : true,
    isDaily: options.isDaily || false,
    averageCompletionTime: options.averageCompletionTime || null,
    completionRate: options.completionRate || null,
    ...options
  };
}
