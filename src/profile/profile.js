/**
 * Profile Page Logic
 *
 * Displays player statistics and progression
 */

import { Meta } from '../shared/meta.js';
import { Storage } from '../shared/storage.js';

// Initialize profile page
function init() {
  const stats = Storage.get('stats', { xp: 0, gamesPlayed: 0 });

  // Update level display
  const level = Meta.getLevel(stats.xp);
  document.getElementById('player-level').textContent = level;
  document.getElementById('total-xp').textContent = stats.xp;
  document.getElementById('games-played').textContent = stats.gamesPlayed;

  // Update progress bar
  const progress = Meta.getLevelProgress(stats.xp);
  document.getElementById('level-progress').style.width = `${progress.progress * 100}%`;
  document.getElementById('xp-current').textContent = progress.current;
  document.getElementById('xp-needed').textContent = progress.needed;
}

// Run on load
init();
