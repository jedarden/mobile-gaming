/**
 * RNG.js - Seeded Pseudo-Random Number Generator
 *
 * Provides deterministic random number generation using Mulberry32 algorithm.
 * Essential for:
 * - Reproducible daily challenges
 * - Consistent puzzle generation
 * - Test determinism
 */

/**
 * Mulberry32 PRNG - Fast, high-quality 32-bit generator
 * @param {number} seed - Initial seed value
 * @returns {Function} Random number generator function
 */
export function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded random generator with utility methods
 * @param {number} seed
 * @returns {Object} RNG with utility methods
 */
export function createRNG(seed) {
  const next = mulberry32(seed);

  return {
    /** Get next random float [0, 1) */
    next,

    /** Get random integer in range [min, max] */
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },

    /** Get random float in range [min, max) */
    float(min, max) {
      return next() * (max - min) + min;
    },

    /** Get random boolean with optional probability */
    bool(probability = 0.5) {
      return next() < probability;
    },

    /** Pick random element from array */
    pick(array) {
      return array[Math.floor(next() * array.length)];
    },

    /** Shuffle array in place using Fisher-Yates */
    shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
  };
}

export default { mulberry32, createRNG };
