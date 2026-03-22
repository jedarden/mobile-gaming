/**
 * History — Unit Tests
 *
 * Tests for createHistory() factory and History class: push, undo,
 * canUndo, current, clear, maxDepth enforcement, and redo-branch truncation.
 */

import { describe, it, expect } from 'vitest';
import { createHistory, History } from '../../src/shared/history.js';

// ─── createHistory ────────────────────────────────────────────────────────────

describe('createHistory — initial state', () => {
  it('starts with length 0 and position -1', () => {
    const h = createHistory();
    expect(h.length).toBe(0);
    expect(h.position).toBe(-1);
  });

  it('current() returns null when empty', () => {
    expect(createHistory().current()).toBe(null);
  });

  it('canUndo() returns false when empty', () => {
    expect(createHistory().canUndo()).toBe(false);
  });

  it('undo() returns null when empty', () => {
    expect(createHistory().undo()).toBe(null);
  });
});

describe('createHistory — push', () => {
  it('sets current to the pushed value', () => {
    const h = createHistory();
    h.push('first');
    expect(h.current()).toBe('first');
    expect(h.length).toBe(1);
    expect(h.position).toBe(0);
  });

  it('canUndo is false after a single push (no previous state)', () => {
    const h = createHistory();
    h.push('a');
    expect(h.canUndo()).toBe(false);
  });

  it('canUndo is true after two pushes', () => {
    const h = createHistory();
    h.push('a');
    h.push('b');
    expect(h.canUndo()).toBe(true);
  });

  it('tracks multiple pushes correctly', () => {
    const h = createHistory();
    h.push('a');
    h.push('b');
    h.push('c');
    expect(h.length).toBe(3);
    expect(h.position).toBe(2);
    expect(h.current()).toBe('c');
  });

  it('stores complex objects by reference', () => {
    const h = createHistory();
    const state = { x: 1, items: [1, 2, 3] };
    h.push(state);
    expect(h.current()).toBe(state);
  });
});

describe('createHistory — undo', () => {
  it('returns the previous state', () => {
    const h = createHistory();
    h.push('a');
    h.push('b');
    expect(h.undo()).toBe('a');
    expect(h.current()).toBe('a');
    expect(h.position).toBe(0);
  });

  it('can undo through multiple states', () => {
    const h = createHistory();
    h.push('a');
    h.push('b');
    h.push('c');
    expect(h.undo()).toBe('b');
    expect(h.undo()).toBe('a');
    expect(h.canUndo()).toBe(false);
  });

  it('returns null when nothing to undo', () => {
    const h = createHistory();
    h.push('only');
    expect(h.undo()).toBe(null);
    expect(h.current()).toBe('only');
  });

  it('canUndo becomes false at the oldest state', () => {
    const h = createHistory();
    h.push('a');
    h.push('b');
    h.undo();
    expect(h.canUndo()).toBe(false);
  });
});

describe('createHistory — push after undo truncates redo branch', () => {
  it('removes forward states when pushing after undo', () => {
    const h = createHistory();
    h.push('a');
    h.push('b');
    h.push('c');
    h.undo(); // back to 'b'
    h.push('d');
    // Stack is now ['a', 'b', 'd'] — 'c' was discarded
    expect(h.length).toBe(3);
    expect(h.current()).toBe('d');
  });

  it('undo after new push goes to the state before the new push', () => {
    const h = createHistory();
    h.push('a');
    h.push('b');
    h.undo(); // back to 'a'
    h.push('c');
    expect(h.undo()).toBe('a');
    expect(h.canUndo()).toBe(false);
  });

  it('branched push does not retain the undone future', () => {
    const h = createHistory();
    h.push(1);
    h.push(2);
    h.push(3);
    h.undo();
    h.undo(); // at 1
    h.push(99);
    // Stack: [1, 99]
    expect(h.length).toBe(2);
    expect(h.current()).toBe(99);
    expect(h.undo()).toBe(1);
  });
});

describe('createHistory — maxDepth enforcement', () => {
  it('does not exceed maxDepth entries', () => {
    const h = createHistory(3);
    for (let i = 0; i < 10; i++) h.push(i);
    expect(h.length).toBe(3);
  });

  it('oldest entry is evicted when maxDepth is exceeded', () => {
    const h = createHistory(2);
    h.push('a');
    h.push('b');
    h.push('c'); // evicts 'a'
    expect(h.undo()).toBe('b');
    expect(h.canUndo()).toBe(false);
  });

  it('allows exactly maxDepth - 1 undos after overflow', () => {
    const h = createHistory(4);
    for (let i = 0; i < 10; i++) h.push(i);
    let undoCount = 0;
    while (h.canUndo()) { h.undo(); undoCount++; }
    expect(undoCount).toBe(3); // maxDepth - 1
  });

  it('current state is always the last pushed after overflow', () => {
    const h = createHistory(3);
    h.push('x');
    h.push('y');
    h.push('z');
    h.push('w');
    expect(h.current()).toBe('w');
  });
});

describe('createHistory — clear', () => {
  it('resets all state', () => {
    const h = createHistory();
    h.push('a');
    h.push('b');
    h.clear();
    expect(h.length).toBe(0);
    expect(h.position).toBe(-1);
    expect(h.current()).toBe(null);
    expect(h.canUndo()).toBe(false);
  });

  it('can push and undo normally after clear', () => {
    const h = createHistory();
    h.push('a');
    h.clear();
    h.push('x');
    h.push('y');
    expect(h.length).toBe(2);
    expect(h.current()).toBe('y');
    expect(h.undo()).toBe('x');
  });
});

// ─── History class ────────────────────────────────────────────────────────────

describe('History class', () => {
  it('starts empty', () => {
    const h = new History();
    expect(h.length).toBe(0);
    expect(h.position).toBe(-1);
    expect(h.current()).toBe(null);
    expect(h.canUndo()).toBe(false);
  });

  it('push and undo work correctly', () => {
    const h = new History();
    h.push('a');
    h.push('b');
    expect(h.canUndo()).toBe(true);
    expect(h.undo()).toBe('a');
    expect(h.current()).toBe('a');
  });

  it('respects maxDepth', () => {
    const h = new History(2);
    h.push('a');
    h.push('b');
    h.push('c');
    expect(h.length).toBe(2);
    expect(h.current()).toBe('c');
    expect(h.undo()).toBe('b');
    expect(h.canUndo()).toBe(false);
  });

  it('clear resets to initial state', () => {
    const h = new History();
    h.push('a');
    h.push('b');
    h.clear();
    expect(h.length).toBe(0);
    expect(h.position).toBe(-1);
    expect(h.current()).toBe(null);
  });

  it('push after undo truncates redo branch', () => {
    const h = new History();
    h.push('a');
    h.push('b');
    h.push('c');
    h.undo(); // at 'b'
    h.push('x');
    expect(h.length).toBe(3); // ['a', 'b', 'x']
    expect(h.current()).toBe('x');
    expect(h.undo()).toBe('b');
  });

  it('undo returns null when nothing to undo', () => {
    const h = new History();
    expect(h.undo()).toBe(null);
    h.push('only');
    expect(h.undo()).toBe(null);
  });

  it('position tracks pointer correctly', () => {
    const h = new History();
    expect(h.position).toBe(-1);
    h.push('a');
    expect(h.position).toBe(0);
    h.push('b');
    expect(h.position).toBe(1);
    h.undo();
    expect(h.position).toBe(0);
  });
});
