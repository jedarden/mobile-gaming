/**
 * Hub page - Main entry point for mobile games
 *
 * Features:
 * - Game card filtering by category
 * - Quick Play: opens random uncompleted level from any game
 * - Daily Challenge banner with dynamic link
 * - Progress tracking via shared storage module
 */

import { getGameStats } from '../shared/storage.js';
import {
  getDailyChallenge,
  isDailyCompleted
} from '../shared/daily.js';

// Game metadata for quick play and daily challenge
const GAMES = [
  { id: 'bus-jam', title: 'Bus Jam', category: 'puzzle' },
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

/**
 * Get games with uncompleted levels
 * Uses shared storage to check progress
 */
function getGamesWithUncompletedLevels() {
  const result = [];
  for (const game of GAMES) {
    const stats = getGameStats(game.id);
    // Game is "uncompleted" if played count is less than some threshold
    // or if we track total levels vs completed levels
    if (stats.played === 0 || stats.completed < stats.played) {
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
 * Opens random uncompleted level from any game
 */
function initQuickPlay() {
  const btn = document.getElementById('quickPlayBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const availableGames = getGamesWithUncompletedLevels();

    if (availableGames.length === 0) {
      // All games have been played, pick random
      const randomGame = GAMES[Math.floor(Math.random() * GAMES.length)];
      navigateToGame(randomGame.id);
    } else {
      // Pick random from available games
      const randomGame = availableGames[Math.floor(Math.random() * availableGames.length)];
      navigateToGame(randomGame.id);
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

  const challenge = getDailyChallenge();
  const game = GAMES.find(g => g.id === challenge.gameId);
  const isCompleted = isDailyCompleted();

  if (game) {
    subtitle.textContent = `${game.title} - ${isCompleted ? 'Completed!' : 'Play now'}`;
    banner.href = `/${challenge.gameId}/?daily=${challenge.seed}`;
  }

  // Update banner style based on completion
  if (isCompleted) {
    banner.classList.add('completed');
    const icon = banner.querySelector('.banner-icon');
    if (icon) icon.textContent = '✓';
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
