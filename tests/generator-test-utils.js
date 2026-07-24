/**
 * Generator Test Utilities
 *
 * Shared utilities for testing level generators.
 * Provides common fixtures, validation helpers, and test patterns.
 */

// ─── Generator Fixtures ───────────────────────────────────────────────────────────

/**
 * Standard hole templates for testing
 */
export const HOLE_TEMPLATES = {
  tall: [
    { shape: 'tall', width: 0.4, height: 2.5 },
    { shape: 'tall', width: 0.5, height: 2.0 },
    { shape: 'tall', width: 0.6, height: 1.67 },
    { shape: 'tall', width: 0.7, height: 1.43 },
    { shape: 'tall', width: 0.8, height: 1.25 },
  ],
  wide: [
    { shape: 'wide', width: 2.5, height: 0.4 },
    { shape: 'wide', width: 2.0, height: 0.5 },
    { shape: 'wide', width: 1.67, height: 0.6 },
    { shape: 'wide', width: 1.43, height: 0.7 },
    { shape: 'wide', width: 1.25, height: 0.8 },
  ],
  plus: [
    { shape: 'plus', widthH: 0.5, heightH: 2.5, widthV: 2.5, heightV: 0.5 },
    { shape: 'plus', widthH: 0.6, heightH: 2.0, widthV: 2.0, heightV: 0.6 },
    { shape: 'plus', widthH: 0.7, heightH: 1.8, widthV: 1.8, heightV: 0.7 },
    { shape: 'plus', widthH: 0.8, heightH: 1.5, widthV: 1.5, heightV: 0.8 },
  ],
};

/**
 * Difficulty configurations for testing
 */
export const DIFFICULTY_CONFIGS = {
  easy: { wallCount: [6, 8], speed: 1.8 },
  medium: { wallCount: [8, 12], speed: 2.0 },
  hard: { wallCount: [10, 15], speed: 2.2 },
};

// ─── Validation Helpers ────────────────────────────────────────────────────────────

/**
 * Checks if a level has valid basic structure
 * @param {Object} level - Level object to validate
 * @returns {Object} Validation result with valid flag and errors array
 */
export function validateLevelStructure(level) {
  const errors = [];

  if (!level || typeof level !== 'object') {
    return { valid: false, errors: ['Level is not an object'] };
  }

  if (!level.id) {
    errors.push('Missing id');
  }

  if (!Array.isArray(level.walls)) {
    errors.push('Missing walls array');
  }

  if (typeof level.speed !== 'number') {
    errors.push('Missing or invalid speed');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates wall structure
 * @param {Object} wall - Wall object to validate
 * @returns {Object} Validation result
 */
export function validateWallStructure(wall) {
  const errors = [];

  if (!wall || typeof wall !== 'object') {
    return { valid: false, errors: ['Wall is not an object'] };
  }

  if (typeof wall.z !== 'number') {
    errors.push('Missing or invalid wall.z');
  }

  if (!wall.hole || typeof wall.hole !== 'object') {
    errors.push('Missing or invalid wall.hole');
  } else {
    if (!wall.hole.shape) {
      errors.push('Missing hole.shape');
    }

    // Shape-specific validation
    if (wall.hole.shape === 'tall' || wall.hole.shape === 'wide') {
      if (typeof wall.hole.width !== 'number') {
        errors.push(`Missing hole.width for ${wall.hole.shape}`);
      }
      if (typeof wall.hole.height !== 'number') {
        errors.push(`Missing hole.height for ${wall.hole.shape}`);
      }
    } else if (wall.hole.shape === 'plus') {
      if (typeof wall.hole.widthH !== 'number') {
        errors.push('Missing hole.widthH for plus');
      }
      if (typeof wall.hole.heightH !== 'number') {
        errors.push('Missing hole.heightH for plus');
      }
      if (typeof wall.hole.widthV !== 'number') {
        errors.push('Missing hole.widthV for plus');
      }
      if (typeof wall.hole.heightV !== 'number') {
        errors.push('Missing hole.heightV for plus');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Checks if walls are properly ordered by z position
 * @param {Array} walls - Array of wall objects
 * @returns {boolean} True if walls are in increasing z order
 */
export function areWallsOrdered(walls) {
  for (let i = 1; i < walls.length; i++) {
    if (walls[i].z <= walls[i - 1].z) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if all walls in a level have valid structure
 * @param {Object} level - Level object
 * @returns {Object} Validation result with wall-specific errors
 */
export function validateAllWalls(level) {
  if (!Array.isArray(level.walls)) {
    return { valid: false, errors: ['Level has no walls array'] };
  }

  const allErrors = [];
  level.walls.forEach((wall, index) => {
    const validation = validateWallStructure(wall);
    if (!validation.valid) {
      allErrors.push(`Wall ${index}: ${validation.errors.join(', ')}`);
    }
  });

  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
}

// ─── Generator Testing Patterns ─────────────────────────────────────────────────

/**
 * Tests generator determinism for a given seed
 * @param {Function} generateLevel - Generator function
 * @param {number|string} seed - Test seed
 * @param {string} difficulty - Test difficulty
 * @returns {boolean} True if generator is deterministic
 */
export function testDeterminism(generateLevel, seed, difficulty = 'medium') {
  const level1 = generateLevel(seed, difficulty);
  const level2 = generateLevel(seed, difficulty);
  return JSON.stringify(level1) === JSON.stringify(level2);
}

/**
 * Tests that different seeds produce different levels
 * @param {Function} generateLevel - Generator function
 * @param {string} difficulty - Test difficulty
 * @returns {boolean} True if seeds produce different levels
 */
export function testSeedVariation(generateLevel, difficulty = 'medium') {
  const level1 = generateLevel(100, difficulty);
  const level2 = generateLevel(200, difficulty);
  return JSON.stringify(level1) !== JSON.stringify(level2);
}

/**
 * Tests wall count ranges for a difficulty
 * @param {Function} generateLevel - Generator function
 * @param {string} difficulty - Difficulty to test
 * @param {number} minWalls - Expected minimum walls
 * @param {number} maxWalls - Expected maximum walls
 * @param {number} testSeeds - Number of seeds to test
 * @returns {Object} Test results
 */
export function testWallCountRange(generateLevel, difficulty, minWalls, maxWalls, testSeeds = 10) {
  const results = {
    valid: true,
    outOfRange: [],
    tested: testSeeds
  };

  for (let seed = 1; seed <= testSeeds; seed++) {
    const level = generateLevel(seed, difficulty);
    if (level.walls.length < minWalls || level.walls.length > maxWalls) {
      results.valid = false;
      results.outOfRange.push({ seed, count: level.walls.length });
    }
  }

  return results;
}

/**
 * Tests that a generator produces valid levels
 * @param {Function} generateLevel - Generator function
 * @param {string} difficulty - Difficulty to test
 * @param {number} iterations - Number of levels to generate
 * @returns {Object} Validation results
 */
export function testGeneratorValidity(generateLevel, difficulty, iterations = 10) {
  const results = {
    allValid: true,
    totalTests: iterations,
    validCount: 0,
    invalidLevels: []
  };

  for (let i = 1; i <= iterations; i++) {
    const level = generateLevel(i, difficulty);
    const structureValidation = validateLevelStructure(level);
    const wallsValidation = validateAllWalls(level);

    if (structureValidation.valid && wallsValidation.valid && areWallsOrdered(level.walls)) {
      results.validCount++;
    } else {
      results.allValid = false;
      results.invalidLevels.push({
        seed: i,
        structureErrors: structureValidation.errors,
        wallErrors: wallsValidation.errors
      });
    }
  }

  return results;
}

/**
 * Runs a comprehensive generator test suite
 * @param {Function} generateLevel - Generator function to test
 * @param {Object} options - Test options
 * @returns {Object} Complete test results
 */
export function runGeneratorTestSuite(generateLevel, options = {}) {
  const {
    difficulties = ['easy', 'medium', 'hard'],
    iterations = 10,
    testDeterminism = true,
    testVariation = true,
    testValidity = true,
  } = options;

  const results = {
    passed: true,
    tests: {}
  };

  if (testDeterminism) {
    results.tests.determinism = difficulties.map(diff =>
      testDeterminism(generateLevel, 42, diff)
    );
  }

  if (testVariation) {
    results.tests.variation = difficulties.map(diff =>
      testSeedVariation(generateLevel, diff)
    );
  }

  if (testValidity) {
    results.tests.validity = {};
    for (const diff of difficulties) {
      results.tests.validity[diff] = testGeneratorValidity(generateLevel, diff, iterations);
    }
  }

  // Check if all tests passed
  for (const testType in results.tests) {
    if (Array.isArray(results.tests[testType])) {
      if (!results.tests[testType].every(r => r === true)) {
        results.passed = false;
      }
    } else if (typeof results.tests[testType] === 'object') {
      for (const diff in results.tests[testType]) {
        if (!results.tests[testType][diff].allValid) {
          results.passed = false;
        }
      }
    }
  }

  return results;
}

// ─── Mock Generators ─────────────────────────────────────────────────────────────

/**
 * Creates a predictable mock generator
 * @param {Function} levelFactory - Function that creates level objects
 * @returns {Object} Mock generator
 */
export function createPredictableGenerator(levelFactory) {
  let callCount = 0;
  return {
    generateLevel: vi.fn((seed, difficulty, index = 0) => {
      callCount++;
      return levelFactory(seed, difficulty, index, callCount);
    })
  };
}

/**
 * Creates a generator that returns the same level each time
 * @param {Object} staticLevel - Level to return
 * @returns {Object} Mock generator
 */
export function createStaticGenerator(staticLevel) {
  return {
    generateLevel: vi.fn(() => ({ ...staticLevel }))
  };
}

/**
 * Creates a generator that fails after N calls
 * @param {number} failAfter - Number of successful calls before failures
 * @param {Object} levelTemplate - Template for successful levels
 * @returns {Object} Mock generator
 */
export function createFailingGenerator(failAfter, levelTemplate) {
  let callCount = 0;
  return {
    generateLevel: vi.fn((seed, difficulty) => {
      callCount++;
      if (callCount > failAfter) return null;
      return { ...levelTemplate, id: `level-${callCount}`, seed, difficulty };
    })
  };
}

// ─── Performance Testing ────────────────────────────────────────────────────────

/**
 * Benchmarks a generator's performance
 * @param {Function} generateLevel - Generator to benchmark
 * @param {string} difficulty - Difficulty to test
 * @param {number} iterations - Number of levels to generate
 * @returns {Object} Performance metrics
 */
export function benchmarkGenerator(generateLevel, difficulty = 'medium', iterations = 100) {
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    generateLevel(i, difficulty);
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;

  return {
    totalTime: totalTime.toFixed(2) + 'ms',
    avgTime: (totalTime / iterations).toFixed(2) + 'ms',
    levelsPerSecond: Math.round(iterations / (totalTime / 1000))
  };
}
