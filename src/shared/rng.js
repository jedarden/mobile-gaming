/**
 * Seeded random number generator
 *
 * Mulberry32 PRNG implementation for deterministic random sequences.
 * Useful for reproducible game states, level generation, and testing.
 */

/**
 * Create a seeded random number generator using Mulberry32 algorithm
 *
 * @param {number} seed - The seed value (integer)
 * @returns {Object} RNG instance with next(), nextInt(), shuffle(), pick()
 */
export function createRng(seed) {
  // Ensure seed is an integer
  let state = Math.floor(seed) >>> 0;

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
   * @returns {*} Random element from array
   */
  function pick(arr) {
    if (arr.length === 0) return undefined;
    return arr[nextInt(0, arr.length - 1)];
  }

  return { next, nextInt, shuffle, pick };
}

/**
 * Create an RNG from a string seed
 * Converts string to numeric seed using simple hash
 *
 * @param {string} seedString - String to convert to seed
 * @returns {Object} RNG instance
 */
export function createRngFromString(seedString) {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash >>> 0; // Convert to unsigned 32-bit integer
  }
  return createRng(hash);
}

/**
 * Default RNG instance using current time as seed
 * Changes on each module load
 */
export const defaultRng = createRng(Date.now());

/**
 * Quick access to unseeded random values
 */
export const random = {
  /** @returns {number} Random float in [0, 1) */
  next: () => defaultRng.next(),

  /** @param {number} min @param {number} max @returns {number} Random integer */
  int: (min, max) => defaultRng.nextInt(min, max),

  /** @param {Array} arr @returns {Array} Shuffled copy */
  shuffle: (arr) => defaultRng.shuffle(arr),

  /** @param {Array} arr @returns {*} Random element */
  pick: (arr) => defaultRng.pick(arr),
};
