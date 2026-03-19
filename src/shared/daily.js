/**
 * Daily - Daily challenge system
 *
 * Provides:
 * - Daily challenge selection based on date seed
 * - Daily completion tracking
 * - Game-specific daily seed generation
 *
 * Daily challenges are deterministic based on the date,
 * so all players get the same challenge on the same day.
 *
 * Usage:
 *   const challenge = getDailyChallenge();
 *   const seed = getGameDailySeed('pull-the-pin');
 *   if (!isDailyCompleted()) { ... }
 *   completeDailyChallenge();
 */

const STORAGE_KEY = 'mg:daily';

// All available games for daily rotation
const GAMES = [
  'pull-the-pin',
  'water-sort',
  'brain-teaser',
  'parking-escape',
  'save-the-character',
  'merge',
  'satisfying',
  'crowd-runner',
  'bridge-race',
  'giant-runner',
  'jelly-shift',
  'makeover-run'
];

/**
 * Get today's date string as seed
 * @returns {string} YYYY-MM-DD format
 */
export function getTodaySeed() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get daily data from storage
 * @returns {object}
 */
function getDailyData() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { completed: {} };
  } catch {
    return { completed: {} };
  }
}

/**
 * Save daily data to storage
 * @param {object} data
 */
function saveDailyData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or disabled
  }
}

/**
 * Simple seeded PRNG (Mulberry32)
 * @param {number} seed - Numeric seed
 * @returns {function} PRNG function returning 0-1
 */
function createSeededRandom(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convert string seed to numeric hash
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/**
 * Get today's daily challenge game
 * @returns {object} { gameId, level, seed }
 */
export function getDailyChallenge() {
  const seed = getTodaySeed();
  const numericSeed = hashString(seed);
  const random = createSeededRandom(numericSeed);

  // Pick game deterministically
  const gameIndex = Math.floor(random() * GAMES.length);
  const gameId = GAMES[gameIndex];

  // Pick level (1-50 range, games should generate or handle)
  const level = Math.floor(random() * 50) + 1;

  return {
    gameId,
    level,
    seed
  };
}

/**
 * Get game-specific daily seed for procedural generation
 * @param {string} gameId - Game identifier
 * @returns {string} Seed string for the game
 */
export function getGameDailySeed(gameId) {
  const today = getTodaySeed();
  return `${today}:${gameId}`;
}

/**
 * Get numeric seed for procedural generation
 * @param {string} gameId
 * @returns {number}
 */
export function getGameDailyNumericSeed(gameId) {
  return hashString(getGameDailySeed(gameId));
}

/**
 * Check if today's daily challenge is completed
 * @returns {boolean}
 */
export function isDailyCompleted() {
  const data = getDailyData();
  const today = getTodaySeed();
  return data.completed[today] === true;
}

/**
 * Check if a specific game's daily is completed
 * @param {string} gameId
 * @returns {boolean}
 */
export function isGameDailyCompleted(gameId) {
  const data = getDailyData();
  const today = getTodaySeed();
  const key = `${today}:${gameId}`;
  return data.completed[key] === true;
}

/**
 * Mark daily challenge as completed
 * @param {string} [gameId] - Optional game ID for game-specific tracking
 */
export function completeDailyChallenge(gameId = null) {
  const data = getDailyData();
  const today = getTodaySeed();

  // Mark general daily
  data.completed[today] = true;

  // Mark game-specific if provided
  if (gameId) {
    const key = `${today}:${gameId}`;
    data.completed[key] = true;
  }

  saveDailyData(data);
}

/**
 * Get daily challenge stats
 * @returns {object} { totalCompleted, currentStreak, lastCompletedDate }
 */
export function getDailyStats() {
  const data = getDailyData();
  const dates = Object.keys(data.completed)
    .filter(k => !k.includes(':')) // Only date entries
    .sort();

  const totalCompleted = dates.length;

  // Calculate streak
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    if (data.completed[dateStr]) {
      streak++;
    } else if (i > 0) {
      // Streak broken (allow today to not be completed yet)
      break;
    }
  }

  return {
    totalCompleted,
    currentStreak: streak,
    lastCompletedDate: dates[dates.length - 1] || null
  };
}

/**
 * Get upcoming daily challenges for preview
 * @param {number} days - Number of days to preview
 * @returns {array} Array of { date, gameId, level }
 */
export function getUpcomingDailies(days = 7) {
  const result = [];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const numericSeed = hashString(dateStr);
    const random = createSeededRandom(numericSeed);

    const gameIndex = Math.floor(random() * GAMES.length);
    const gameId = GAMES[gameIndex];
    const level = Math.floor(random() * 50) + 1;

    result.push({
      date: dateStr,
      gameId,
      level,
      isToday: i === 0
    });
  }

  return result;
}

/**
 * Get all available games for daily rotation
 * @returns {string[]}
 */
export function getDailyGames() {
  return [...GAMES];
}

export default {
  getTodaySeed,
  getDailyChallenge,
  getGameDailySeed,
  getGameDailyNumericSeed,
  isDailyCompleted,
  isGameDailyCompleted,
  completeDailyChallenge,
  getDailyStats,
  getUpcomingDailies,
  getDailyGames
};
