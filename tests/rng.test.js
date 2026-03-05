/**
 * Tests for seeded PRNG (Mulberry32)
 *
 * Run with: node tests/rng.test.js
 */

import assert from 'assert';
import { createRNG, randomInt, shuffle, randomChoice, weightedChoice } from '../shared/rng.js';

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

console.log('\n=== Seeded PRNG Tests ===\n');

// Test 1: Determinism - same seed produces identical sequence
test('Same seed produces identical sequence', () => {
  const rng1 = createRNG(12345);
  const rng2 = createRNG(12345);

  for (let i = 0; i < 100; i++) {
    assert.strictEqual(rng1(), rng2(), `Values differ at iteration ${i}`);
  }
});

// Test 2: Different seeds produce different sequences
test('Different seeds produce different sequences', () => {
  const rng1 = createRNG(12345);
  const rng2 = createRNG(54321);

  let differences = 0;
  for (let i = 0; i < 100; i++) {
    if (rng1() !== rng2()) differences++;
  }
  assert.ok(differences > 90, 'Sequences should be mostly different');
});

// Test 3: Output range is [0, 1)
test('Output range is [0, 1)', () => {
  const rng = createRNG(99999);

  for (let i = 0; i < 10000; i++) {
    const value = rng();
    assert.ok(value >= 0, `Value ${value} is less than 0`);
    assert.ok(value < 1, `Value ${value} is greater than or equal to 1`);
  }
});

// Test 4: Uniform distribution over large samples
test('Distribution is uniform over large samples', () => {
  const rng = createRNG(42);
  const buckets = new Array(10).fill(0);
  const samples = 100000;

  for (let i = 0; i < samples; i++) {
    const bucket = Math.floor(rng() * 10);
    buckets[bucket]++;
  }

  // Each bucket should have approximately 10000 items (±500 for variance)
  const expected = samples / 10;
  const tolerance = expected * 0.02; // 2% tolerance

  for (let i = 0; i < 10; i++) {
    assert.ok(
      Math.abs(buckets[i] - expected) < tolerance,
      `Bucket ${i} has ${buckets[i]}, expected ~${expected}`
    );
  }
});

// Test 5: No dependency on Math.random()
test('No dependency on Math.random()', () => {
  const originalRandom = Math.random;
  let mathRandomCalled = false;

  Math.random = () => {
    mathRandomCalled = true;
    return originalRandom();
  };

  const rng = createRNG(111);
  for (let i = 0; i < 100; i++) {
    rng();
  }

  Math.random = originalRandom;

  assert.ok(!mathRandomCalled, 'createRNG should not call Math.random()');
});

// Test 6: randomInt() bounds are correct
test('randomInt() respects bounds [min, max]', () => {
  const rng = createRNG(777);
  const min = 5;
  const max = 10;

  for (let i = 0; i < 1000; i++) {
    const value = randomInt(rng, min, max);
    assert.ok(value >= min, `Value ${value} is less than min ${min}`);
    assert.ok(value <= max, `Value ${value} is greater than max ${max}`);
    assert.ok(Number.isInteger(value), `Value ${value} is not an integer`);
  }
});

// Test 7: randomInt() covers full range
test('randomInt() covers full range', () => {
  const rng = createRNG(888);
  const min = 0;
  const max = 4;
  const seen = new Set();

  for (let i = 0; i < 1000; i++) {
    seen.add(randomInt(rng, min, max));
  }

  for (let i = min; i <= max; i++) {
    assert.ok(seen.has(i), `Value ${i} was never generated`);
  }
});

// Test 8: shuffle() is deterministic
test('shuffle() is deterministic with same seed', () => {
  const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const arr2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  shuffle(createRNG(123), arr1);
  shuffle(createRNG(123), arr2);

  assert.deepStrictEqual(arr1, arr2, 'Same seed should produce same shuffle');
});

// Test 9: shuffle() produces uniform distribution
test('shuffle() produces uniform distribution', () => {
  const original = [1, 2, 3, 4];
  const permutations = new Map();
  const iterations = 10000;

  for (let seed = 0; seed < iterations; seed++) {
    const arr = [...original];
    shuffle(createRNG(seed), arr);
    const key = arr.join(',');
    permutations.set(key, (permutations.get(key) || 0) + 1);
  }

  // With 4 items, there are 24 permutations
  // Each should appear roughly 10000/24 ≈ 417 times
  const expected = iterations / 24;
  const tolerance = expected * 0.15; // 15% tolerance

  assert.ok(
    permutations.size === 24,
    `Expected 24 unique permutations, got ${permutations.size}`
  );

  for (const [perm, count] of permutations) {
    assert.ok(
      Math.abs(count - expected) < tolerance,
      `Permutation ${perm} has ${count} occurrences, expected ~${expected}`
    );
  }
});

// Test 10: shuffle() modifies array in place
test('shuffle() modifies array in place', () => {
  const arr = [1, 2, 3, 4, 5];
  const reference = arr;
  const result = shuffle(createRNG(555), arr);

  assert.strictEqual(arr, reference, 'Original array reference should be preserved');
  assert.strictEqual(result, arr, 'Returned array should be same reference');
});

// Test 11: randomChoice() selects from array
test('randomChoice() selects valid element from array', () => {
  const rng = createRNG(999);
  const arr = ['a', 'b', 'c', 'd', 'e'];

  for (let i = 0; i < 100; i++) {
    const choice = randomChoice(rng, arr);
    assert.ok(arr.includes(choice), `${choice} is not in array`);
  }
});

// Test 12: randomChoice() distribution is uniform
test('randomChoice() distribution is uniform', () => {
  const rng = createRNG(1000);
  const arr = ['a', 'b', 'c'];
  const counts = { a: 0, b: 0, c: 0 };

  for (let i = 0; i < 3000; i++) {
    counts[randomChoice(rng, arr)]++;
  }

  const expected = 1000;
  const tolerance = expected * 0.05; // 5% tolerance

  for (const [item, count] of Object.entries(counts)) {
    assert.ok(
      Math.abs(count - expected) < tolerance,
      `Item ${item} has ${count} occurrences, expected ~${expected}`
    );
  }
});

// Test 13: weightedChoice() respects weights
test('weightedChoice() respects weights', () => {
  const rng = createRNG(2000);
  const items = [
    { item: 'rare', weight: 1 },
    { item: 'uncommon', weight: 3 },
    { item: 'common', weight: 6 }
  ];

  const counts = { rare: 0, uncommon: 0, common: 0 };
  const iterations = 10000;

  for (let i = 0; i < iterations; i++) {
    counts[weightedChoice(rng, items)]++;
  }

  // Expected ratios: rare=10%, uncommon=30%, common=60%
  assert.ok(
    counts.rare < 1500,
    `Rare should be ~10% but got ${counts.rare / iterations * 100}%`
  );
  assert.ok(
    counts.uncommon > 2500 && counts.uncommon < 3500,
    `Uncommon should be ~30% but got ${counts.uncommon / iterations * 100}%`
  );
  assert.ok(
    counts.common > 5500,
    `Common should be ~60% but got ${counts.common / iterations * 100}%`
  );
});

// Test 14: Seed mutation is isolated per RNG instance
test('Seed mutation is isolated per RNG instance', () => {
  const rng1 = createRNG(100);
  const rng2 = createRNG(100);

  // Advance rng1
  rng1(); rng1(); rng1();

  // rng2 should still produce same sequence
  const rng1Value = rng1();
  const rng2Value = rng2();

  // They should be different because rng1 is 4 steps ahead
  assert.notStrictEqual(rng1Value, rng2Value);

  // But creating new RNG with same seed should match original sequence
  const rng3 = createRNG(100);
  const rng4 = createRNG(100);
  assert.strictEqual(rng3(), rng4());
});

// Test 15: Edge case - single element array
test('randomChoice() handles single element array', () => {
  const rng = createRNG(3000);
  const arr = ['only'];

  for (let i = 0; i < 10; i++) {
    assert.strictEqual(randomChoice(rng, arr), 'only');
  }
});

// Test 16: Edge case - empty array (should not throw immediately)
test('shuffle() handles empty array', () => {
  const rng = createRNG(4000);
  const arr = [];

  shuffle(rng, arr);
  assert.deepStrictEqual(arr, []);
});

// Test 17: Edge case - two element array
test('shuffle() handles two element array', () => {
  const rng = createRNG(5000);
  const arr = [1, 2];
  const seen = new Set();

  for (let seed = 0; seed < 100; seed++) {
    const copy = [...arr];
    shuffle(createRNG(seed), copy);
    seen.add(copy.join(','));
  }

  // Should see both [1,2] and [2,1] over multiple seeds
  assert.ok(seen.has('1,2'), 'Should see original order');
  assert.ok(seen.has('2,1'), 'Should see reversed order');
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
