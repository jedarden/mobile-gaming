/**
 * Daily.js - Daily Challenge Seeding
 *
 * Generates deterministic daily challenge seeds for:
 * - Consistent daily puzzles across all players
 * - Timezone-aware daily reset
 * - Seed derivation for game-specific generators
 */

import { mulberry32 } from './rng.js';

export const Daily = {
  /**
   * Get the seed for today's daily challenge
   * @param {string} gameId - Game identifier (e.g., 'water-sort')
   * @param {Date} [date=new Date()] - Date to get seed for
   * @returns {number} 32-bit seed for PRNG
   */
  getDailySeed(gameId, date = new Date()) {
    const dateStr = this.getDateString(date);
    const combined = `${gameId}-${dateStr}`;

    // Hash the combined string to a number
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  },

  /**
   * Get date string in YYYY-MM-DD format (UTC)
   * @param {Date} date
   * @returns {string}
   */
  getDateString(date) {
    return date.toISOString().split('T')[0];
  },

  /**
   * Get a seeded PRNG for today's daily challenge
   * @param {string} gameId
   * @returns {Function} Seeded random function
   */
  getDailyRNG(gameId) {
    const seed = this.getDailySeed(gameId);
    return mulberry32(seed);
  }
};

export default Daily;
