/**
 * Seeded random number generator using Mulberry32
 *
 * Provides deterministic random sequences for level generation,
 * daily challenges, and reproducible game states. Each instance
 * maintains its own state, allowing multiple independent generators.
 * Accepts both string and numeric seeds.
 */

/**
 * Convert a string seed to a 32-bit unsigned integer using FNV-1a hash
 *
 * @param {string|number} seed - Seed value (string or number)
 * @returns {number} 32-bit unsigned integer hash
 */
function hashSeed(seed) {
  if (typeof seed === 'number') return Math.floor(seed) >>> 0;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/**
 * Create a seeded random number generator using Mulberry32 algorithm
 *
 * Accepts both string and numeric seeds. String seeds are hashed via FNV-1a
 * for good distribution across the 32-bit space.
 *
 * @param {string|number} seed - Seed value (string or number)
 * @returns {{ next: Function, nextInt: Function, shuffle: Function, pick: Function }} RNG instance
 */
export function createRng(seed) {
  let state = hashSeed(seed);

  /**
   * Get next random float in [0, 1)
   * @returns {number} Random float between 0 (inclusive) and 1 (exclusive)
   */
  function next() {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  /**
   * Get next random integer in [min, max]
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (inclusive)
   * @returns {number} Random integer between min and max
   */
  function nextInt(min, max) {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  /**
   * Shuffle an array (returns new array, does not mutate original)
   * Uses Fisher-Yates algorithm
   * @param {Array} arr - Array to shuffle
   * @returns {Array} New shuffled array
   */
  function shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Pick a random element from an array
   * @param {Array} arr - Array to pick from
   * @returns {*} Random element from array, or undefined if empty
   */
  function pick(arr) {
    if (arr.length === 0) return undefined;
    return arr[nextInt(0, arr.length - 1)];
  }

  return { next, nextInt, shuffle, pick };
}
