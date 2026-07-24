/**
 * Shared Test Utilities
 *
 * Consolidated test helpers, mock factories, and setup functions
 * to reduce redundancy across test files.
 */

import { vi } from 'vitest';

// ─── Mock Utilities ─────────────────────────────────────────────────────────────

/**
 * Creates a mock localStorage with full spy capabilities
 * @returns {Object} Mock localStorage with getItem, setItem, removeItem, clear spies
 */
export function createMockLocalStorage() {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    _store: store, // Expose for direct inspection in tests
  };
}

/**
 * Sets up global localStorage mock
 * Call this in beforeAll() to set up localStorage for all tests
 */
export function setupMockLocalStorage() {
  const mock = createMockLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: mock, writable: true });
  return mock;
}

/**
 * Creates a mock DOM element for event testing
 * @returns {Object} Mock element with event listener capabilities
 */
export function createMockElement() {
  const listeners = {};
  return {
    style: {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 390, height: 844 };
    },
    addEventListener(type, fn, options) {
      (listeners[type] = listeners[type] || []).push({ fn, options });
    },
    removeEventListener(type, fn) {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter(l => l.fn !== fn);
      }
    },
    _listeners: listeners,
    _getListenerCount() {
      return Object.values(listeners).reduce((sum, arr) => sum + arr.length, 0);
    }
  };
}

/**
 * Creates a mock mouse event
 * @param {string} type - Event type (e.g., 'mousedown', 'mouseup')
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Object} Mock mouse event
 */
export function createMouseEvent(type, x, y) {
  return { type, clientX: x, clientY: y, preventDefault() {} };
}

/**
 * Creates a mock touch event
 * @param {string} type - Event type (e.g., 'touchstart', 'touchend')
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Object} Mock touch event
 */
export function createTouchEvent(type, x, y) {
  return {
    type,
    touches: type === 'touchend' ? [] : [{ clientX: x, clientY: y }],
    changedTouches: [{ clientX: x, clientY: y }],
    preventDefault() {}
  };
}

// ─── Time/Date Utilities ────────────────────────────────────────────────────────

/**
 * Sets the current system time for date-dependent tests
 * @param {string} isoDate - ISO date string (e.g., '2026-03-22')
 */
export function setDate(isoDate) {
  vi.setSystemTime(new Date(isoDate + 'T12:00:00Z'));
}

/**
 * Resets system time to real time
 */
export function resetDate() {
  vi.useRealTimers();
}

// ─── Test Setup Helpers ─────────────────────────────────────────────────────────

/**
 * Sets up fake timers for time-dependent tests
 * Call in beforeEach() and pair with resetTimers() in afterEach()
 */
export function setupFakeTimers() {
  vi.useFakeTimers();
}

/**
 * Resets timers to real time
 * Call in afterEach() after using setupFakeTimers()
 */
export function resetTimers() {
  vi.useRealTimers();
}

/**
 * Clears all mocks and timers
 * Use in afterEach() for comprehensive cleanup
 */
export function clearAllMocks() {
  vi.clearAllMocks();
  vi.restoreAllMocks();
}

/**
 * Resets modules to force re-import
 * Use in beforeEach() when testing singletons or module-level state
 */
export function resetModules() {
  vi.resetModules();
}

// ─── Level/Test Data Utilities ─────────────────────────────────────────────────

/**
 * Creates a basic test level structure
 * @param {Object} overrides - Properties to override in the base level
 * @returns {Object} Test level object
 */
export function createTestLevel(overrides = {}) {
  return {
    id: 'test-level-1',
    speed: 2.0,
    walls: [
      { z: 30, hole: { shape: 'tall', width: 0.6, height: 1.67 } },
      { z: 60, hole: { shape: 'wide', width: 1.67, height: 0.6 } }
    ],
    ...overrides
  };
}

/**
 * Creates a test wall with a hole
 * @param {number} z - Z position
 * @param {string} shape - Hole shape ('tall', 'wide', 'plus')
 * @param {number} width - Hole width
 * @param {number} height - Hole height
 * @returns {Object} Test wall object
 */
export function createTestWall(z, shape = 'tall', width = 0.6, height = 1.67) {
  return { z, hole: { shape, width, height } };
}

/**
 * Creates a test game state
 * @param {Object} overrides - Properties to override in base state
 * @returns {Object} Test state object
 */
export function createTestState(overrides = {}) {
  return {
    blob: { z: 0, width: 1.0, height: 1.0, targetWidth: 1.0 },
    speed: 2.0,
    score: 0,
    status: 'running',
    time: 0,
    walls: [],
    wallsPassed: 0,
    totalWalls: 0,
    ...overrides
  };
}

// ─── Generator Mock Utilities ───────────────────────────────────────────────────

/**
 * Creates a deterministic mock generator
 * @param {Function} generateFn - Function that returns level or null
 * @returns {Object} Mock generator with generateLevel spy
 */
export function createMockGenerator(generateFn = null) {
  if (generateFn) {
    return { generateLevel: vi.fn(generateFn) };
  }
  // Default: always returns a valid level
  return {
    generateLevel: vi.fn((seed, difficulty, index = 0) => ({
      id: `mock-${seed}-${difficulty}`,
      seed,
      difficulty,
      index,
      valid: true
    }))
  };
}

/**
 * Creates a generator that fails on specific seeds
 * @param {Array<number>} failureSeeds - Seeds that should return null
 * @returns {Object} Mock generator
 */
export function createFailingMockGenerator(failureSeeds = []) {
  return {
    generateLevel: vi.fn((seed, difficulty, index = 0) => {
      if (failureSeeds.includes(seed)) return null;
      return { id: `mock-${seed}-${difficulty}`, seed, difficulty, index, valid: true };
    })
  };
}

// ─── Audio Context Mock ─────────────────────────────────────────────────────────

/**
 * Creates a mock AudioContext
 * @param {string} initialState - Initial state ('suspended' or 'running')
 * @returns {Object} Mock AudioContext
 */
export function createMockAudioContext(initialState = 'suspended') {
  return {
    state: initialState,
    resume: vi.fn(async function() {
      this.state = 'running';
      return Promise.resolve();
    }),
    createOscillator: vi.fn(() => ({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { value: 0 }
    })),
    createGain: vi.fn(() => ({
      connect: vi.fn(),
      gain: { value: 0 }
    })),
    currentTime: 0
  };
}

// ─── Assertion Helpers ──────────────────────────────────────────────────────────

/**
 * Asserts that an object has all expected properties
 * @param {Object} obj - Object to check
 * @param {Array<string>} props - Required properties
 */
export function expectHasProperties(obj, props) {
  for (const prop of props) {
    expect(obj).toHaveProperty(prop);
  }
}

/**
 * Asserts that a value is within a range (inclusive)
 * @param {number} value - Value to check
 * @param {number} min - Minimum expected value
 * @param {number} max - Maximum expected value
 */
export function expectInRange(value, min, max) {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

/**
 * Creates a test suite with common setup/teardown
 * @param {Object} options - Setup options
 * @returns {Object} Test helpers object
 */
export function createTestSuite(options = {}) {
  const {
    useFakeTimers: needsFakeTimers = false,
    useMockStorage: needsMockStorage = false,
    beforeEach: customBeforeEach = null,
    afterEach: customAfterEach = null,
  } = options;

  const helpers = {};

  if (needsFakeTimers) {
    helpers.setupTimers = setupFakeTimers;
    helpers.resetTimers = resetTimers;
  }

  if (needsMockStorage) {
    helpers.mockStorage = setupMockLocalStorage();
  }

  if (customBeforeEach) {
    helpers.beforeEach = customBeforeEach;
  }

  if (customAfterEach) {
    helpers.afterEach = customAfterEach;
  }

  return helpers;
}

// ─── Module Re-export for Convenience ───────────────────────────────────────────

export { vi };
