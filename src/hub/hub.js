/**
 * Hub page - Main entry point for mobile games
 *
 * Features:
 * - Game card filtering by category
 * - Quick Play: opens random uncompleted level from any game
 * - Daily Challenge banner with dynamic link
 * - Progress tracking via localStorage
 */

// Game metadata for quick play and daily challenge
const GAMES = [
  { id: 'pull-the-pin', title: 'Pull the Pin', category: 'puzzle' },
  { id: 'water-sort', title: 'Water Sort', category: 'puzzle' },
  { id: 'brain-teaser', title: 'Brain Teaser', category: 'puzzle' },
  { id: 'parking-escape', title: 'Parking Escape', category: 'puzzle' },
  { id: 'save-the-character', title: 'Save the Character', category: 'puzzle' },
  { id: 'merge', title: 'Merge', category: 'puzzle' },
  { id: 'satisfying', title: 'Satisfying', category: 'simulation' },
  { id: 'crowd-runner', title: 'Crowd Runner', category: 'arcade' },
  { id: 'bridge-race', title: 'Bridge Race', category: 'arcade' },
  { id: 'giant-runner', title: 'Giant Runner', category: 'arcade' },
  { id: 'jelly-shift', title: 'Jelly Shift', category: 'arcade' },
  { id: 'makeover-run', title: 'Makeover Run', category: 'arcade' }
];

// Storage key prefix
const STORAGE_PREFIX = 'mg:hub:';

/**
 * Get a value from localStorage
 */
function storageGet(key) {
  try {
    const value = localStorage.getItem(STORAGE_PREFIX + key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

/**
 * Set a value in localStorage
 */
function storageSet(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or disabled
  }
}

/**
 * Get today's daily challenge seed
 * Uses date string as seed for consistent daily challenge
 */
function getDailyChallengeSeed() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Simple seeded PRNG for daily challenge selection
 * Mulberry32 algorithm
 */
function seededRandom(seed) {
  // Convert string seed to numeric
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }

  // Mulberry32
  let t = h += 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Get today's daily challenge game
 */
function getDailyChallengeGame() {
  const seed = getDailyChallengeSeed();
  const random = seededRandom(seed);
  const index = Math.floor(random * GAMES.length);
  return GAMES[index];
}

/**
 * Check if daily challenge is completed today
 */
function isDailyChallengeCompleted() {
  const completedDate = storageGet('dailyChallengeCompleted');
  const today = getDailyChallengeSeed();
  return completedDate === today;
}

/**
 * Mark daily challenge as completed
 */
function markDailyChallengeCompleted() {
  storageSet('dailyChallengeCompleted', getDailyChallengeSeed());
}

/**
 * Get all games with uncompleted levels
 */
function getGamesWithUncompletedLevels() {
  const result = [];
  for (const game of GAMES) {
    const progress = storageGet(`progress:${game.id}`);
    if (!progress || progress.completedLevels < progress.totalLevels) {
      result.push(game);
    }
  }
  return result;
}

/**
 * Navigate to a game with optional level parameter
 */
function navigateToGame(gameId, level = null) {
  let url = `/${gameId}/`;
  if (level !== null) {
    url += `?level=${level}`;
  }
  window.location.href = url;
}

/**
 * Initialize filter tabs
 */
function initFilterTabs() {
  const tabs = document.querySelectorAll('.filter-tab');
  const cards = document.querySelectorAll('.game-card');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const filter = tab.dataset.filter;

      // Filter cards
      cards.forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });
}

/**
 * Initialize Quick Play button
 */
function initQuickPlay() {
  const btn = document.getElementById('quickPlayBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const availableGames = getGamesWithUncompletedLevels();

    if (availableGames.length === 0) {
      // All games completed, pick random
      const randomGame = GAMES[Math.floor(Math.random() * GAMES.length)];
      navigateToGame(randomGame.id);
    } else {
      // Pick random from available games
      const randomGame = availableGames[Math.floor(Math.random() * availableGames.length)];

      // Try to find next uncompleted level
      const progress = storageGet(`progress:${randomGame.id}`);
      const nextLevel = progress ? progress.completedLevels + 1 : 1;

      navigateToGame(randomGame.id, nextLevel);
    }
  });
}

/**
 * Initialize Daily Challenge banner
 */
function initDailyChallenge() {
  const banner = document.getElementById('dailyChallengeBanner');
  const subtitle = document.getElementById('dailyChallengeSubtitle');

  if (!banner || !subtitle) return;

  const game = getDailyChallengeGame();
  const isCompleted = isDailyChallengeCompleted();

  subtitle.textContent = `${game.title} - ${isCompleted ? 'Completed!' : 'Play now'}`;
  banner.href = `/${game.id}/?daily=${getDailyChallengeSeed()}`;

  // Update banner style based on completion
  if (isCompleted) {
    banner.style.background = 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)';
    banner.querySelector('.banner-icon').textContent = '✓';
  }
}

/**
 * Initialize all features
 */
function init() {
  initFilterTabs();
  initQuickPlay();
  initDailyChallenge();
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
