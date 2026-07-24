/**
 * Level Loading Utilities
 *
 * Efficient level loading with caching to reduce redundant file I/O.
 * Provides centralized level data access for all test files.
 */

// Level cache to avoid redundant file loading
const levelCache = new Map();

/**
 * Clears the level cache
 * Call this in afterEach() if tests modify level data
 */
export function clearLevelCache() {
  levelCache.clear();
}

/**
 * Loads levels for a specific game with caching
 * @param {string} gameName - Name of the game (e.g., 'jelly-shift')
 * @returns {Promise<Array>} Array of level objects
 */
export async function loadLevels(gameName) {
  if (levelCache.has(gameName)) {
    return levelCache.get(gameName);
  }

  try {
    const levels = await import(`../src/games/${gameName}/levels.json`, {
      with: { type: 'json' }
    });
    levelCache.set(gameName, levels.default || levels);
    return levels.default || levels;
  } catch (error) {
    throw new Error(`Failed to load levels for ${gameName}: ${error.message}`);
  }
}

/**
 * Loads a single level by index with caching
 * @param {string} gameName - Name of the game
 * @param {number} index - Level index (0-based)
 * @returns {Promise<Object>} Level object
 */
export async function loadLevel(gameName, index) {
  const levels = await loadLevels(gameName);
  return levels[index];
}

/**
 * Loads a random level with caching
 * @param {string} gameName - Name of the game
 * @returns {Promise<Object>} Random level object
 */
export async function loadRandomLevel(gameName) {
  const levels = await loadLevels(gameName);
  const index = Math.floor(Math.random() * levels.length);
  return levels[index];
}

/**
 * Gets level count without loading full data
 * @param {string} gameName - Name of the game
 * @returns {Promise<number>} Number of levels
 */
export async function getLevelCount(gameName) {
  const levels = await loadLevels(gameName);
  return levels.length;
}

/**
 * Preloads levels for multiple games
 * Useful in beforeAll() to avoid lazy loading during tests
 * @param {Array<string>} gameNames - Array of game names to preload
 * @returns {Promise<void>}
 */
export async function preloadLevels(gameNames) {
  await Promise.all(gameNames.map(loadLevels));
}

/**
 * Creates a level fixture for testing
 * @param {string} gameName - Name of the game
 * @param {Object} overrides - Properties to override
 * @returns {Promise<Object>} Level object with overrides applied
 */
export async function createLevelFixture(gameName, overrides = {}) {
  const levels = await loadLevels(gameName);
  const baseLevel = levels[0]; // Use first level as base
  return { ...baseLevel, ...overrides };
}

/**
 * Gets all game names that have levels
 * @returns {Array<string>} Array of game names
 */
export function getGameNames() {
  return [
    'water-sort',
    'parking-escape',
    'pull-the-pin',
    'merge-games',
    'crowd-runner',
    'giant-runner',
    'jelly-shift',
    'makeover-run',
    'bridge-race',
    'satisfying-asmr',
    'brain-teaser',
    'save-the-character',
    'color-blind',
    'bus-jam',
    'endless',
    'daily',
    'quick-play',
    'retry',
    'share',
    'ad-compositor',
    'migrations'
  ];
}

/**
 * Checks if a game has levels
 * @param {string} gameName - Name of the game
 * @returns {Promise<boolean>} True if game has levels
 */
export async function hasLevels(gameName) {
  try {
    const levels = await loadLevels(gameName);
    return levels && levels.length > 0;
  } catch {
    return false;
  }
}

// Export cache for testing purposes
export { levelCache };
