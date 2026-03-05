/**
 * Seeded PRNG (Pseudo-Random Number Generator)
 *
 * Uses the Mulberry32 algorithm - chosen for:
 * - Fast execution
 * - Good statistical properties
 * - Small code footprint
 * - JavaScript-friendly (uses 32-bit operations)
 *
 * Deterministic random number generation is essential for:
 * - Daily challenges (same seed = same puzzle worldwide)
 * - Infinite mode (shareable seeds)
 * - Reproducible testing
 * - Level generation consistency
 */

/**
 * Create a seeded PRNG using Mulberry32 algorithm
 * @param {number} seed - Initial seed value
 * @returns {function} Random number generator that returns values in [0, 1)
 */
export function createRNG(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Generate random integer in range [min, max]
 * @param {function} rng - PRNG function from createRNG
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer in the specified range
 */
export function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Shuffle array in place using Fisher-Yates algorithm
 * @param {function} rng - PRNG function from createRNG
 * @param {Array} array - Array to shuffle
 * @returns {Array} The same array (shuffled in place)
 */
export function shuffle(rng, array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Pick random element from array
 * @param {function} rng - PRNG function from createRNG
 * @param {Array} array - Source array
 * @returns {*} Random element from the array
 */
export function randomChoice(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

/**
 * Generate weighted random choice
 * @param {function} rng - PRNG function from createRNG
 * @param {Array} items - Array of { item, weight } objects
 * @returns {*} Selected item based on weights
 */
export function weightedChoice(rng, items) {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let threshold = rng() * total;

  for (const { item, weight } of items) {
    threshold -= weight;
    if (threshold <= 0) return item;
  }

  return items[items.length - 1].item;
}
