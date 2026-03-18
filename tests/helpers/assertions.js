/**
 * Custom assertions for game state validation
 *
 * Provides Vitest-compatible assertion helpers that make tests
 * more readable and provide better error messages.
 */

import { expect } from 'vitest';

/**
 * Assert that a game state is valid
 *
 * @param {Object} state - Game state to validate
 * @param {string} message - Optional message
 */
export function assertValidGameState(state, message) {
  expect(state, message).toBeDefined();
  expect(state, message).toHaveProperty('status');
  expect(state.status, message).toMatch(/^(playing|won|lost|paused)$/);
  expect(state, message).toHaveProperty('score');
  expect(state.score, message).toBeGreaterThanOrEqual(0);
  expect(state, message).toHaveProperty('moves');
  expect(state.moves, message).toBeGreaterThanOrEqual(0);
}

/**
 * Assert that a level has valid structure
 *
 * @param {Object} level - Level to validate
 * @param {string} gameType - Game type for specific validation
 * @param {string} message - Optional message
 */
export function assertValidLevel(level, gameType, message) {
  expect(level, message).toBeDefined();
  expect(level, message).toHaveProperty('version');
  expect(level, message).toHaveProperty('id');
  expect(level, message).toHaveProperty('title');
  expect(level, message).toHaveProperty('difficulty');
  expect(level.difficulty, message).toBeGreaterThan(0);

  // Game-specific validation
  switch (gameType) {
    case 'pull-the-pin':
      assertValidPullThePinLevel(level, message);
      break;
    case 'water-sort':
      assertValidWaterSortLevel(level, message);
      break;
    case 'brain-teaser':
      assertValidBrainTeaserLevel(level, message);
      break;
    case 'parking-escape':
      assertValidParkingEscapeLevel(level, message);
      break;
  }
}

/**
 * Assert Pull the Pin level is valid
 *
 * @param {Object} level - Level to validate
 * @param {string} message - Optional message
 */
function assertValidPullThePinLevel(level, message) {
  expect(level, message).toHaveProperty('hero');
  expect(level.hero, message).toMatchObject({
    x: expect.any(Number),
    y: expect.any(Number),
    radius: expect.any(Number)
  });
  expect(level.hero.x, message).toBeGreaterThanOrEqual(0);
  expect(level.hero.y, message).toBeGreaterThanOrEqual(0);
  expect(level.hero.radius, message).toBeGreaterThan(0);

  expect(level, message).toHaveProperty('goal');
  expect(level.goal, message).toHaveProperty('type');

  expect(level, message).toHaveProperty('goblin');
  expect(level.goblin, message).toMatchObject({
    x: expect.any(Number),
    y: expect.any(Number),
    radius: expect.any(Number)
  });
}

/**
 * Assert Water Sort level is valid
 *
 * @param {Object} level - Level to validate
 * @param {string} message - Optional message
 */
function assertValidWaterSortLevel(level, message) {
  expect(level, message).toHaveProperty('tubes');
  expect(Array.isArray(level.tubes), message).toBe(true);
  expect(level.tubes, message).toHaveLength.greaterThan(0);

  for (const tube of level.tubes) {
    expect(tube, message).toHaveProperty('colors');
    expect(Array.isArray(tube.colors), message).toBe(true);
    expect(tube, message).toHaveProperty('capacity');
    expect(tube.capacity, message).toBeGreaterThan(0);
    expect(tube.colors.length, message).toBeLessThanOrEqual(tube.capacity);
  }

  expect(level, message).toHaveProperty('maxMoves');
  expect(level.maxMoves, message).toBeGreaterThan(0);
}

/**
 * Assert Brain Teaser level is valid
 *
 * @param {Object} level - Level to validate
 * @param {string} message - Optional message
 */
function assertValidBrainTeaserLevel(level, message) {
  expect(level, message).toHaveProperty('puzzle');
  expect(level.puzzle, message).toHaveProperty('type');

  expect(level, message).toHaveProperty('targetMoves');
  expect(level.targetMoves, message).toBeGreaterThan(0);
}

/**
 * Assert Parking Escape level is valid
 *
 * @param {Object} level - Level to validate
 * @param {string} message - Optional message
 */
function assertValidParkingEscapeLevel(level, message) {
  expect(level, message).toHaveProperty('grid');
  expect(level.grid, message).toMatchObject({
    width: expect.any(Number),
    height: expect.any(Number),
    vehicles: expect.any(Array)
  });

  expect(level.grid.width, message).toBeGreaterThan(0);
  expect(level.grid.height, message).toBeGreaterThan(0);
  expect(level.grid.vehicles.length, message).toBeGreaterThan(0);

  // Check hero vehicle exists
  const hero = level.grid.vehicles.find(v => v.type === 'hero');
  expect(hero, message).toBeDefined();

  expect(level, message).toHaveProperty('targetMoves');
  expect(level.targetMoves, message).toBeGreaterThan(0);
}

/**
 * Assert that storage value is properly wrapped
 *
 * @param {*} value - Value to check
 * @param {string} message - Optional message
 */
export function assertStorageWrapper(value, message) {
  expect(value, message).toBeDefined();
  expect(value, message).toHaveProperty('v');
  expect(typeof value.v, message).toBe('number');
  expect(value, message).toHaveProperty('data');
}

/**
 * Assert that a color is valid
 *
 * @param {Object|string} color - Color to validate
 * @param {string} message - Optional message
 */
export function assertValidColor(color, message) {
  if (typeof color === 'string') {
    expect(color, message).toMatch(/^#[0-9A-Fa-f]{6}$/);
  } else {
    expect(color, message).toHaveProperty('hex');
    expect(color.hex, message).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(color, message).toHaveProperty('name');
    expect(color, message).toHaveProperty('rgb');
    expect(color.rgb, message).toMatchObject({
      r: expect.any(Number),
      g: expect.any(Number),
      b: expect.any(Number)
    });
  }
}

/**
 * Assert that RNG output is in valid range
 *
 * @param {number} value - Value to check
 * @param {number} min - Minimum (inclusive)
 * @param {number} max - Maximum (inclusive/exclusive depending on type)
 * @param {boolean} inclusiveMax - Whether max is inclusive
 * @param {string} message - Optional message
 */
export function assertRngRange(value, min, max, inclusiveMax = false, message) {
  expect(value, message).toBeGreaterThanOrEqual(min);
  if (inclusiveMax) {
    expect(value, message).toBeLessThanOrEqual(max);
  } else {
    expect(value, message).toBeLessThan(max);
  }
}

/**
 * Assert that a point is within bounds
 *
 * @param {Object} point - Point with x, y properties
 * @param {number} width - Bounds width
 * @param {number} height - Bounds height
 * @param {string} message - Optional message
 */
export function assertPointInBounds(point, width, height, message) {
  expect(point, message).toHaveProperty('x');
  expect(point, message).toHaveProperty('y');
  expect(point.x, message).toBeGreaterThanOrEqual(0);
  expect(point.x, message).toBeLessThan(width);
  expect(point.y, message).toBeGreaterThanOrEqual(0);
  expect(point.y, message).toBeLessThan(height);
}

/**
 * Assert that a collision body is valid
 *
 * @param {Object} body - Collision body
 * @param {string} message - Optional message
 */
export function assertValidBody(body, message) {
  expect(body, message).toBeDefined();
  expect(body, message).toHaveProperty('x');
  expect(body, message).toHaveProperty('y');

  if (body.radius !== undefined) {
    expect(body.radius, message).toBeGreaterThan(0);
  }

  if (body.width !== undefined) {
    expect(body.width, message).toBeGreaterThan(0);
  }

  if (body.height !== undefined) {
    expect(body.height, message).toBeGreaterThan(0);
  }
}

/**
 * Assert that level progress is valid
 *
 * @param {Object} progress - Progress to validate
 * @param {string} message - Optional message
 */
export function assertValidProgress(progress, message) {
  expect(progress, message).toBeDefined();
  expect(progress, message).toHaveProperty('levelId');
  expect(progress.levelId, message).toBeTruthy();
  expect(progress, message).toHaveProperty('completed');
  expect(typeof progress.completed, message).toBe('boolean');
  expect(progress, message).toHaveProperty('bestScore');
  expect(progress.bestScore, message).toBeGreaterThanOrEqual(0);
  expect(progress, message).toHaveProperty('attempts');
  expect(progress.attempts, message).toBeGreaterThanOrEqual(0);
}

/**
 * Assert that history entry is valid
 *
 * @param {Object} entry - History entry
 * @param {string} message - Optional message
 */
export function assertValidHistoryEntry(entry, message) {
  expect(entry, message).toBeDefined();
  expect(entry, message).toHaveProperty('timestamp');
  expect(entry.timestamp, message).toBeGreaterThan(0);
  expect(entry, message).toHaveProperty('action');
  expect(typeof entry.action, message).toBe('string');
  expect(entry.action, message).toBeTruthy();
}

/**
 * Assert that migration result is valid
 *
 * @param {Object} result - Migration result
 * @param {number} expectedVersion - Expected version after migration
 * @param {string} message - Optional message
 */
export function assertMigrationResult(result, expectedVersion, message) {
  expect(result, message).toBeDefined();
  expect(result, message).toHaveProperty('version');
  expect(result.version, message).toBe(expectedVersion);
  expect(result, message).toHaveProperty('data');
}

/**
 * Assert canvas dimensions are correct
 *
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {number} expectedWidth - Expected logical width
 * @param {number} expectedHeight - Expected logical height
 * @param {number} dpr - Device pixel ratio
 * @param {string} message - Optional message
 */
export function assertCanvasSize(canvas, expectedWidth, expectedHeight, dpr = 1, message) {
  expect(canvas, message).toBeDefined();
  expect(canvas.width, message).toBe(expectedWidth * dpr);
  expect(canvas.height, message).toBe(expectedHeight * dpr);
  expect(canvas.style.width, message).toBe(`${expectedWidth}px`);
  expect(canvas.style.height, message).toBe(`${expectedHeight}px`);
}
