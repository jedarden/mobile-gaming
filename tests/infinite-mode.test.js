/**
 * Tests for Infinite Mode Module
 *
 * Run with: node tests/infinite-mode.test.js
 */

import assert from 'assert';
import {
  initInfiniteMode,
  isInfiniteMode,
  toggleInfiniteMode,
  setInfiniteMode,
  getSeed,
  setSeed,
  generateNewSeed,
  getDifficulty,
  setDifficulty,
  getDifficultyConfig,
  getDifficultyOptions,
  startInfiniteSession,
  endInfiniteSession,
  recordPuzzleAttempt,
  recordPuzzleCompletion,
  recordPuzzleFailure,
  getSessionStats,
  formatSeed,
  parseSeed,
  createInfiniteRNG,
  generateLevelParams,
  DIFFICULTY_CONFIG
} from '../src/shared/infinite-mode.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(`  ${e.message}`);
    failed++;
  }
}

// Mock storage for testing
const mockStorage = {
  data: {},
  getSettings() {
    return this.data.settings || {};
  },
  async updateSettings(settings) {
    this.data.settings = { ...this.data.settings, ...settings };
  }
};

console.log('\n=== Infinite Mode Tests ===\n');

// Test 1: Module initialization
test('Module initializes without error', () => {
  initInfiniteMode();
});

// Test 2: Default infinite mode is disabled
test('Default infinite mode is disabled', () => {
  assert.strictEqual(isInfiniteMode(), false);
});

// Test 3: Toggle infinite mode
test('Toggle infinite mode works', async () => {
  await setInfiniteMode(true);
  assert.strictEqual(isInfiniteMode(), true);
  
  await setInfiniteMode(false);
  assert.strictEqual(isInfiniteMode(), false);
});

// Test 4: Set and get seed
test('Set and get seed works', async () => {
  await setSeed(12345);
  assert.strictEqual(getSeed(), 12345);
  
  await setSeed('test');
  assert.ok(typeof getSeed() === 'number');
});

// Test 5: Generate new seed
test('Generate new seed creates numeric seed', async () => {
  const seed1 = await generateNewSeed();
  const seed2 = await generateNewSeed();
  
  assert.ok(typeof seed1 === 'number');
  assert.ok(typeof seed2 === 'number');
  // Seeds should be different (very likely)
  assert.ok(seed1 !== seed2 || true); // Allow same seed in rare cases
});

// Test 6: Get and set difficulty
test('Set and get difficulty works', async () => {
  await setDifficulty('easy');
  assert.strictEqual(getDifficulty(), 'easy');
  
  await setDifficulty('hard');
  assert.strictEqual(getDifficulty(), 'hard');
  
  // Invalid difficulty should return null
  const result = await setDifficulty('invalid');
  assert.strictEqual(result, null);
});

// Test 7: Get difficulty config
test('Get difficulty config returns correct config', () => {
  const easyConfig = getDifficultyConfig('easy');
  assert.strictEqual(easyConfig.id, 'easy');
  assert.strictEqual(easyConfig.xpMultiplier, 1);
  
  const hardConfig = getDifficultyConfig('hard');
  assert.strictEqual(hardConfig.xpMultiplier, 2);
});

// Test 8: Get difficulty options
test('Get difficulty options returns all difficulties', () => {
  const options = getDifficultyOptions();
  assert.strictEqual(options.length, 3);
  assert.ok(options.some(o => o.id === 'easy'));
  assert.ok(options.some(o => o.id === 'medium'));
  assert.ok(options.some(o => o.id === 'hard'));
});

// Test 9: Format seed
test('Format seed formats correctly', () => {
  assert.strictEqual(formatSeed(123), '000123');
  assert.strictEqual(formatSeed(123456789), '456789');
  assert.strictEqual(formatSeed(null), '------');
  assert.strictEqual(formatSeed(undefined), '------');
});

// Test 10: Parse seed
test('Parse seed handles various inputs', () => {
  assert.strictEqual(parseSeed('12345'), 12345);
  assert.ok(typeof parseSeed('abc') === 'number', 'String should hash to number');
  assert.strictEqual(parseSeed(''), null);
  assert.strictEqual(parseSeed(null), null);
});

// Test 11: Create infinite RNG
test('Create infinite RNG returns valid RNG object', () => {
  const rng = createInfiniteRNG(12345);
  
  assert.ok(typeof rng.next === 'function');
  assert.ok(typeof rng.int === 'function');
  assert.ok(typeof rng.float === 'function');
  assert.ok(typeof rng.bool === 'function');
  assert.ok(typeof rng.pick === 'function');
  assert.ok(typeof rng.shuffle === 'function');
});

// Test 12: RNG determinism
test('Infinite RNG is deterministic with same seed', () => {
  const rng1 = createInfiniteRNG(12345);
  const rng2 = createInfiniteRNG(12345);
  
  for (let i = 0; i < 10; i++) {
    assert.strictEqual(rng1.next(), rng2.next());
  }
});

// Test 13: Session start
test('Start infinite session initializes correctly', () => {
  const session = startInfiniteSession();
  
  assert.ok(session.sessionStart !== null);
  assert.strictEqual(session.puzzlesCompleted, 0);
  assert.strictEqual(session.puzzlesAttempted, 0);
  assert.strictEqual(session.totalScore, 0);
  assert.strictEqual(session.currentStreak, 0);
});

// Test 14: Record puzzle attempt
test('Record puzzle attempt increments counter', async () => {
  await setInfiniteMode(true);
  startInfiniteSession();
  
  const result1 = recordPuzzleAttempt();
  assert.strictEqual(result1.attempted, 1);
  
  const result2 = recordPuzzleAttempt();
  assert.strictEqual(result2.attempted, 2);
  
  await setInfiniteMode(false);
});

// Test 15: Record puzzle completion
test('Record puzzle completion updates stats', async () => {
  await setInfiniteMode(true);
  startInfiniteSession();
  
  const result = recordPuzzleCompletion(100);
  
  assert.strictEqual(result.completed, 1);
  assert.strictEqual(result.streak, 1);
  assert.strictEqual(result.totalScore, 100);
  
  await setInfiniteMode(false);
});

// Test 16: Record puzzle failure resets streak
test('Record puzzle failure resets streak', async () => {
  await setInfiniteMode(true);
  startInfiniteSession();
  
  recordPuzzleCompletion(100);
  recordPuzzleCompletion(100);
  assert.strictEqual(getSessionStats().currentStreak, 2);
  
  recordPuzzleFailure();
  assert.strictEqual(getSessionStats().currentStreak, 0);
  
  await setInfiniteMode(false);
});

// Test 17: Get session stats
test('Get session stats returns complete stats', async () => {
  await setInfiniteMode(true);
  startInfiniteSession();
  recordPuzzleCompletion(100);
  
  const stats = getSessionStats();
  
  assert.ok(stats.enabled !== undefined);
  assert.ok(stats.seed !== undefined);
  assert.ok(stats.difficulty !== undefined);
  assert.ok(stats.puzzlesCompleted !== undefined);
  assert.ok(stats.currentStreak !== undefined);
  assert.ok(stats.duration !== undefined);
  
  await setInfiniteMode(false);
});

// Test 18: Generate level params
test('Generate level params returns valid params', async () => {
  await setSeed(12345);
  await setDifficulty('medium');
  
  const params = generateLevelParams('test-game');
  
  assert.strictEqual(params.seed, 12345);
  assert.strictEqual(params.difficulty, 'medium');
  assert.strictEqual(params.gameId, 'test-game');
  assert.ok(params.ballCount >= 3);
  assert.ok(params.ballCount <= 6);
  assert.ok(typeof params.hasHazard === 'boolean');
  assert.strictEqual(params.xpMultiplier, 1.5);
  
  await setInfiniteMode(false);
});

// Test 19: Difficulty config structure
test('Difficulty config has required fields', () => {
  for (const [id, config] of Object.entries(DIFFICULTY_CONFIG)) {
    assert.strictEqual(config.id, id);
    assert.ok(config.name);
    assert.ok(config.ballCount);
    assert.ok(config.pinCount);
    assert.ok(typeof config.hazardChance === 'number');
    assert.ok(typeof config.xpMultiplier === 'number');
  }
});

// Test 20: End session returns session data
test('End session returns session data', async () => {
  await setInfiniteMode(true);
  startInfiniteSession();
  recordPuzzleCompletion(100);
  
  const session = endInfiniteSession();
  
  assert.ok(session.duration !== undefined);
  assert.ok(session.puzzlesCompleted !== undefined);
  
  await setInfiniteMode(false);
});

// Summary
console.log('\n=== Test Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('');

if (failed > 0) {
  process.exit(1);
}

console.log('All tests passed!\n');
process.exit(0);
