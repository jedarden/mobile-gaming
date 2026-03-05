/**
 * Tests for Game History module (undo/redo)
 *
 * Run with: node tests/history.test.js
 */

import assert from 'assert';
import { History, GameHistory } from '../src/shared/history.js';

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

console.log('\n=== Game History Tests ===\n');

// Test 1: Basic push and undo
test('Push and undo returns previous state', () => {
  const history = new History();
  history.push({ value: 1 });
  history.push({ value: 2 });
  history.push({ value: 3 });

  const state = history.undo();
  assert.deepStrictEqual(state, { value: 2 }, 'Undo should return previous state');
});

// Test 2: Basic redo
test('Redo returns next state', () => {
  const history = new History();
  history.push({ value: 1 });
  history.push({ value: 2 });
  history.undo();

  const state = history.redo();
  assert.deepStrictEqual(state, { value: 2 }, 'Redo should return next state');
});

// Test 3: Undo returns null at beginning
test('Undo returns null at beginning', () => {
  const history = new History();
  history.push({ value: 1 });

  const state = history.undo();
  assert.strictEqual(state, null, 'Undo at first state should return null');
});

// Test 4: Redo returns null at end
test('Redo returns null at end', () => {
  const history = new History();
  history.push({ value: 1 });

  const state = history.redo();
  assert.strictEqual(state, null, 'Redo at end should return null');
});

// Test 5: Branching truncates future states
test('Branching truncates future states after undo', () => {
  const history = new History();
  history.push({ value: 1 });
  history.push({ value: 2 });
  history.push({ value: 3 });
  history.undo(); // Back to 2
  history.push({ value: 4 }); // Should truncate 3

  assert.strictEqual(history.length, 3, 'History should have 3 states');
  assert.deepStrictEqual(history.current(), { value: 4 }, 'Current should be new state');

  // Redo should return null since we branched
  assert.strictEqual(history.redo(), null, 'Redo should return null after branching');
});

// Test 6: Max size enforcement
test('Max size is enforced', () => {
  const history = new History(5); // Max 5 states

  for (let i = 0; i < 10; i++) {
    history.push({ value: i });
  }

  assert.strictEqual(history.length, 5, 'History should be trimmed to max size');

  // First state should be value 5 (0-4 were trimmed)
  const firstState = history.jumpTo(0);
  assert.deepStrictEqual(firstState, { value: 5 }, 'Oldest state should be trimmed');
});

// Test 7: Deep cloning - mutations don't affect history
test('Mutations to returned state do not affect history', () => {
  const history = new History();
  history.push({ nested: { value: 1 } });

  const state1 = history.current();
  state1.nested.value = 999; // Mutate the returned state

  const state2 = history.current();
  assert.deepStrictEqual(state2.nested.value, 1, 'History should not be affected by mutations');
});

// Test 8: canUndo is accurate
test('canUndo returns correct boolean', () => {
  const history = new History();

  assert.strictEqual(history.canUndo(), false, 'Empty history should not allow undo');

  history.push({ value: 1 });
  assert.strictEqual(history.canUndo(), false, 'Single state should not allow undo');

  history.push({ value: 2 });
  assert.strictEqual(history.canUndo(), true, 'Multiple states should allow undo');

  history.undo();
  assert.strictEqual(history.canUndo(), false, 'At first state, undo not available');
});

// Test 9: canRedo is accurate
test('canRedo returns correct boolean', () => {
  const history = new History();
  history.push({ value: 1 });
  history.push({ value: 2 });

  assert.strictEqual(history.canRedo(), false, 'At end of history, redo not available');

  history.undo();
  assert.strictEqual(history.canRedo(), true, 'After undo, redo should be available');

  history.redo();
  assert.strictEqual(history.canRedo(), false, 'At end again, redo not available');
});

// Test 10: jumpTo navigates correctly
test('jumpTo navigates to specific index', () => {
  const history = new History();
  history.push({ value: 'a' });
  history.push({ value: 'b' });
  history.push({ value: 'c' });
  history.push({ value: 'd' });

  const state = history.jumpTo(1);
  assert.deepStrictEqual(state, { value: 'b' }, 'jumpTo should return correct state');
  assert.strictEqual(history.position, 1, 'Position should be updated');

  // Verify current() returns same state
  assert.deepStrictEqual(history.current(), { value: 'b' }, 'current() should match');
});

// Test 11: jumpTo returns null for invalid index
test('jumpTo returns null for invalid index', () => {
  const history = new History();
  history.push({ value: 1 });

  assert.strictEqual(history.jumpTo(-1), null, 'Negative index should return null');
  assert.strictEqual(history.jumpTo(999), null, 'Out of bounds should return null');
});

// Test 12: current() returns current state
test('current() returns current state without navigation', () => {
  const history = new History();
  history.push({ value: 1 });
  history.push({ value: 2 });
  history.push({ value: 3 });

  history.undo(); // Now at state 2
  assert.deepStrictEqual(history.current(), { value: 2 }, 'current() should return state at position');
});

// Test 13: current() returns null for empty history
test('current() returns null for empty history', () => {
  const history = new History();
  assert.strictEqual(history.current(), null, 'Empty history should return null');
});

// Test 14: getTimeline returns all states with metadata
test('getTimeline returns complete timeline', () => {
  const history = new History();
  history.push({ value: 'a' });
  history.push({ value: 'b' });
  history.push({ value: 'c' });
  history.undo(); // At 'b'

  const timeline = history.getTimeline();

  assert.strictEqual(timeline.length, 3, 'Timeline should have 3 entries');
  assert.strictEqual(timeline[0].index, 0, 'First entry index should be 0');
  assert.deepStrictEqual(timeline[0].state, { value: 'a' }, 'First state should be a');
  assert.strictEqual(timeline[0].isCurrent, false, 'First is not current');

  assert.strictEqual(timeline[1].isCurrent, true, 'Second is current');
  assert.strictEqual(timeline[2].isCurrent, false, 'Third is not current');
});

// Test 15: getTimeline states are cloned
test('getTimeline states are deep cloned', () => {
  const history = new History();
  history.push({ nested: { value: 1 } });

  const timeline = history.getTimeline();
  timeline[0].state.nested.value = 999; // Mutate

  const timeline2 = history.getTimeline();
  assert.strictEqual(timeline2[0].state.nested.value, 1, 'Timeline states should be cloned');
});

// Test 16: clear() resets history
test('clear() resets history completely', () => {
  const history = new History();
  history.push({ value: 1 });
  history.push({ value: 2 });
  history.undo();

  history.clear();

  assert.strictEqual(history.length, 0, 'Length should be 0');
  assert.strictEqual(history.position, -1, 'Position should be -1');
  assert.strictEqual(history.current(), null, 'current() should return null');
  assert.strictEqual(history.canUndo(), false, 'canUndo should be false');
  assert.strictEqual(history.canRedo(), false, 'canRedo should be false');
});

// Test 17: length getter
test('length getter returns correct count', () => {
  const history = new History();

  assert.strictEqual(history.length, 0, 'Empty history length should be 0');

  history.push({ value: 1 });
  assert.strictEqual(history.length, 1, 'After one push, length should be 1');

  history.push({ value: 2 });
  assert.strictEqual(history.length, 2, 'After two pushes, length should be 2');
});

// Test 18: Complex state with arrays
test('Handles complex state with arrays', () => {
  const history = new History();
  history.push({
    items: [1, 2, 3],
    metadata: { name: 'test' }
  });

  history.push({
    items: [1, 2, 3, 4],
    metadata: { name: 'test2' }
  });

  const state = history.undo();
  assert.deepStrictEqual(state.items, [1, 2, 3], 'Array should be preserved');
  assert.deepStrictEqual(state.metadata.name, 'test', 'Nested object should be preserved');
});

// Test 19: Multiple undo/redo cycles
test('Multiple undo/redo cycles work correctly', () => {
  const history = new History();
  history.push({ step: 1 });
  history.push({ step: 2 });
  history.push({ step: 3 });
  history.push({ step: 4 });
  history.push({ step: 5 });

  // Undo to step 3
  assert.deepStrictEqual(history.undo(), { step: 4 });
  assert.deepStrictEqual(history.undo(), { step: 3 });

  // Redo to step 4
  assert.deepStrictEqual(history.redo(), { step: 4 });

  // Undo all the way to step 1
  assert.deepStrictEqual(history.undo(), { step: 3 });
  assert.deepStrictEqual(history.undo(), { step: 2 });
  assert.deepStrictEqual(history.undo(), { step: 1 });
  assert.strictEqual(history.undo(), null); // Can't go further

  // Redo all the way to step 5
  assert.deepStrictEqual(history.redo(), { step: 2 });
  assert.deepStrictEqual(history.redo(), { step: 3 });
  assert.deepStrictEqual(history.redo(), { step: 4 });
  assert.deepStrictEqual(history.redo(), { step: 5 });
  assert.strictEqual(history.redo(), null); // Can't go further
});

// Test 20: GameHistory alias
test('GameHistory is an alias for History', () => {
  const history = new GameHistory();
  history.push({ value: 1 });

  assert.strictEqual(history.length, 1, 'GameHistory should work like History');
});

// Test 21: Position getter
test('position getter returns current index', () => {
  const history = new History();
  assert.strictEqual(history.position, -1, 'Empty history position is -1');

  history.push({ value: 1 });
  assert.strictEqual(history.position, 0, 'After first push, position is 0');

  history.push({ value: 2 });
  assert.strictEqual(history.position, 1, 'After second push, position is 1');

  history.undo();
  assert.strictEqual(history.position, 0, 'After undo, position is 0');
});

// Test 22: Push after clear works
test('Push after clear works correctly', () => {
  const history = new History();
  history.push({ value: 1 });
  history.push({ value: 2 });
  history.clear();
  history.push({ value: 3 });

  assert.strictEqual(history.length, 1, 'After clear and push, length should be 1');
  assert.deepStrictEqual(history.current(), { value: 3 }, 'Current should be new state');
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
