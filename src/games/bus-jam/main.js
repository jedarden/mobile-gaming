/**
 * Bus Jam - Entry Point
 *
 * Bootstraps the Bus Jam game by importing the game module
 * and initializing shared systems (storage, accessibility, lifecycle).
 */

import { BusJamGame } from './game.js';

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[bus-jam] Initializing...');
  const game = new BusJamGame();
  game.init();
});
