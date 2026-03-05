/**
 * Main.js - Landing Page Entry Point
 *
 * Initializes the game directory landing page
 */

import { Storage } from './shared/storage.js';
import { Meta } from './shared/meta.js';

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  console.log('Mobile Gaming loaded');

  // Load and display player stats
  const stats = Storage.get('stats', { xp: 0, gamesPlayed: 0 });
  const level = Meta.getLevel(stats.xp);

  // Update profile link with level badge (optional enhancement)
  const profileLink = document.querySelector('.profile-link');
  if (profileLink && level > 1) {
    profileLink.innerHTML = `👤 Level ${level}`;
  }

  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered:', reg.scope))
      .catch(err => console.log('Service Worker registration failed:', err));
  }
});
