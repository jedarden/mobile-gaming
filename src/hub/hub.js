/**
 * Hub page - Main entry point for mobile games
 *
 * Features:
 * - Game card filtering by category
 * - Quick Play: intelligent game selection based on play history
 * - Daily Challenge banner with dynamic link
 * - Progress tracking via shared storage module
 */

import { getGameStats } from '../shared/storage.js';
import {
  getDailyChallenge,
  isDailyCompleted
} from '../shared/daily.js';
import {
  pickGame,
  getTopCandidates,
  getGameUrl,
  getAvailableGames
} from '../shared/quick-play.js';

// Game metadata for daily challenge (full list)
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
 * Preload top candidate games for instant Quick Play
 * Adds modulepreload links for the top 2 games
 */
function preloadTopCandidates() {
  const candidates = getTopCandidates();

  candidates.forEach(({ gameId }) => {
    // Create preload link for game module
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = `/src/games/${gameId}/game.js`;
    document.head.appendChild(link);
  });
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
 * Uses intelligent game selection based on play history
 */
function initQuickPlay() {
  const btn = document.getElementById('quickPlayBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const { gameId, level } = pickGame();
    window.location.href = getGameUrl(gameId, level);
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
  preloadTopCandidates();
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
