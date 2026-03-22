/**
 * Brain Teaser - Unit Tests
 *
 * Tests for state management and action handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState,
  applyAction,
  cloneState,
  getHint,
  validatePuzzle,
  getElement,
  getInteractiveElements,
  isRevealed,
  resetSequence,
  revealElement
} from '../../src/games/brain-teaser/state.js';

import { createMockContext } from '../helpers/mock-canvas.js';

describe('Brain Teaser State', () => {
  let mockPuzzle;

  beforeEach(() => {
    mockPuzzle = {
      id: 'test-001',
      title: 'Test Puzzle',
      prompt: 'Tap the correct circle',
      type: 'tap',
      elements: [
        { id: 'circle1', type: 'circle', x: 50, y: 200, w: 60, h: 60, clickable: true },
        { id: 'circle2', type: 'circle', x: 150, y: 200, w: 60, h: 60, clickable: true },
        { id: 'circle3', type: 'circle', x: 250, y: 200, w: 60, h: 60, clickable: true }
      ],
      solution: { action: 'tap', targetId: 'circle2' },
      decoyActions: [
        { action: 'tap', targetId: 'circle1', response: 'shake', message: 'Not this one!' },
        { action: 'tap', targetId: 'circle3', response: 'shake', message: 'Try again!' }
      ],
      hint: 'The middle one is correct',
      difficulty: 1
    };
  });

  describe('createInitialState', () => {
    it('should create state from puzzle', () => {
      const state = createInitialState(mockPuzzle);

      expect(state.puzzle.id).toBe('test-001');
      expect(state.puzzle.title).toBe('Test Puzzle');
      expect(state.puzzle.elements).toHaveLength(3);
      expect(state.interactions).toEqual([]);
      expect(state.status).toBe('playing');
      expect(state.attempts).toBe(0);
    });

    it('should copy puzzle elements', () => {
      const state = createInitialState(mockPuzzle);

      // Verify elements are copied
      expect(state.puzzle.elements[0]).toEqual(mockPuzzle.elements[0]);
      expect(state.puzzle.elements).not.toBe(mockPuzzle.elements);
    });
  });

  describe('applyAction', () => {
    it('should solve puzzle with correct tap action', () => {
      const state = createInitialState(mockPuzzle);
      const action = { action: 'tap', targetId: 'circle2' };

      const newState = applyAction(state, action);

      expect(newState.status).toBe('solved');
      expect(newState.animation).not.toBeNull();
      expect(newState.animation.type).toBe('celebration');
    });

    it('should trigger decoy animation on wrong tap', () => {
      const state = createInitialState(mockPuzzle);
      const action = { action: 'tap', targetId: 'circle1' };

      const newState = applyAction(state, action);

      expect(newState.status).toBe('playing');
      expect(newState.attempts).toBe(1);
      expect(newState.animation).not.toBeNull();
      expect(newState.animation.type).toBe('shake');
    });

    it('should increment attempts for each decoy hit', () => {
      let state = createInitialState(mockPuzzle);

      state = applyAction(state, { action: 'tap', targetId: 'circle1' });
      expect(state.attempts).toBe(1);

      state = applyAction(state, { action: 'tap', targetId: 'circle3' });
      expect(state.attempts).toBe(2);
    });

    it('should solve puzzle after decoy attempts', () => {
      let state = createInitialState(mockPuzzle);

      // Apply decoy first
      state = applyAction(state, { action: 'tap', targetId: 'circle1' });
      expect(state.status).toBe('playing');

      // Apply solution
      state = applyAction(state, { action: 'tap', targetId: 'circle2' });
      expect(state.status).toBe('solved');
    });

    it('should not process actions after solved', () => {
      let state = createInitialState(mockPuzzle);

      // Solve puzzle
      state = applyAction(state, { action: 'tap', targetId: 'circle2' });
      expect(state.status).toBe('solved');

      // Try another action
      const newState = applyAction(state, { action: 'tap', targetId: 'circle1' });
      expect(newState.status).toBe('solved');
    });

    it('should record interaction history', () => {
      const state = createInitialState(mockPuzzle);

      const state2 = applyAction(state, { action: 'tap', targetId: 'circle1' });
      expect(state2.interactions).toHaveLength(1);

      const state3 = applyAction(state2, { action: 'tap', targetId: 'circle2' });
      expect(state3.interactions).toHaveLength(2);
    });
  });

  describe('cloneState', () => {
    it('should create deep copy of state', () => {
      const state = createInitialState(mockPuzzle);
      state.revealedElements.push('circle1');

      const cloned = cloneState(state);

      expect(cloned).not.toBe(state);
      expect(cloned.puzzle).not.toBe(state.puzzle);
      expect(cloned.puzzle.elements).not.toBe(state.puzzle.elements);
      expect(cloned.revealedElements).toEqual(['circle1']);

      // Modify original shouldn't affect clone
      state.revealedElements.push('circle2');
      expect(cloned.revealedElements).toEqual(['circle1']);
    });
  });

  describe('getHint', () => {
    it('should return hint from puzzle', () => {
      const state = createInitialState(mockPuzzle);
      const hint = getHint(state);

      expect(hint).toBe('The middle one is correct');
    });

    it('should return null if no hint', () => {
      const noHintPuzzle = { ...mockPuzzle, hint: undefined };
      const state = createInitialState(noHintPuzzle);
      const hint = getHint(state);

      expect(hint).toBeNull();
    });
  });

  describe('validatePuzzle', () => {
    it('should validate a correct puzzle', () => {
      const result = validatePuzzle(mockPuzzle);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing id', () => {
      const invalidPuzzle = { ...mockPuzzle, id: undefined };
      const result = validatePuzzle(invalidPuzzle);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing puzzle id');
    });

    it('should detect invalid solution reference', () => {
      const invalidPuzzle = {
        ...mockPuzzle,
        solution: { action: 'tap', targetId: 'nonexistent' }
      };
      const result = validatePuzzle(invalidPuzzle);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('not found in elements'))).toBe(true);
    });

    it('should detect invalid puzzle type', () => {
      const invalidPuzzle = { ...mockPuzzle, type: 'invalid' };
      const result = validatePuzzle(invalidPuzzle);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid puzzle type'))).toBe(true);
    });
  });

  describe('Drag Actions', () => {
    it('should solve drag puzzle with correct drag action', () => {
      const dragPuzzle = {
        id: 'drag-001',
        title: 'Drag Test',
        prompt: 'Drag the key to the door',
        type: 'drag',
        elements: [
          { id: 'key', type: 'key', x: 50, y: 200, w: 40, h: 40, draggable: true },
          { id: 'door', type: 'door', x: 200, y: 150, w: 80, h: 120 }
        ],
        solution: { action: 'drag', sourceId: 'key', targetId: 'door' },
        decoyActions: [],
        difficulty: 1
      };

      const state = createInitialState(dragPuzzle);
      const action = { action: 'drag', sourceId: 'key', targetId: 'door' };

      const newState = applyAction(state, action);

      expect(newState.status).toBe('solved');
    });
  });

  describe('Sequence Actions', () => {
    it('should track sequence progress', () => {
        const seqPuzzle = {
          id: 'seq-001',
          title: 'Sequence Test',
          prompt: 'Tap in order: 1, 2, 3',
          type: 'sequence',
          elements: [
            { id: 'btn1', type: 'rect', x: 50, y: 200, w: 60, h: 60, clickable: true, label: '1' },
            { id: 'btn2', type: 'rect', x: 150, y: 200, w: 60, h: 60, clickable: true, label: '2' },
            { id: 'btn3', type: 'rect', x: 250, y: 200, w: 60, h: 60, clickable: true, label: '3' }
          ],
          solution: { action: 'sequence', steps: ['btn1', 'btn2', 'btn3'] },
          decoyActions: [],
          difficulty: 1
        };

        let state = createInitialState(seqPuzzle);

        // First tap
        state = applyAction(state, { action: 'tap', targetId: 'btn1' });
        expect(state.currentSequence).toEqual(['btn1']);
        expect(state.status).toBe('playing');

        // Second tap
        state = applyAction(state, { action: 'tap', targetId: 'btn2' });
        expect(state.currentSequence).toEqual(['btn1', 'btn2']);

        // Third tap - should solve
        state = applyAction(state, { action: 'tap', targetId: 'btn3' });
        expect(state.status).toBe('solved');
      expect(state.currentSequence).toEqual(['btn1', 'btn2', 'btn3']);
    });

    it('should reset sequence on wrong step', () => {
      const seqPuzzle = {
        id: 'seq-002',
        title: 'Sequence Reset Test',
        prompt: 'Tap in order: A, B, C',
        type: 'sequence',
        elements: [
          { id: 'a', type: 'rect', x: 50, y: 200, w: 60, h: 60, clickable: true, label: 'A' },
          { id: 'b', type: 'rect', x: 150, y: 200, w: 60, h: 60, clickable: true, label: 'B' },
          { id: 'c', type: 'rect', x: 250, y: 200, w: 60, h: 60, clickable: true, label: 'C' }
          ],
          solution: { action: 'sequence', steps: ['a', 'b', 'c'] },
          decoyActions: [],
          difficulty: 1
        };

        let state = createInitialState(seqPuzzle);

        // Correct first tap
        state = applyAction(state, { action: 'tap', targetId: 'a' });
        expect(state.currentSequence).toEqual(['a']);

        // Wrong second tap (should reset)
        state = applyAction(state, { action: 'tap', targetId: 'c' });
        expect(state.currentSequence).toEqual([]);
        expect(state.attempts).toBe(1);
      expect(state.animation.type).toBe('shake');
    });
  });
});

describe('getElement', () => {
  let mockPuzzle;
  beforeEach(() => {
    mockPuzzle = {
      id: 'test-001',
      title: 'Test',
      prompt: 'Tap the correct circle',
      type: 'tap',
      elements: [
        { id: 'circle1', type: 'circle', x: 50, y: 200, w: 60, h: 60, clickable: true },
        { id: 'circle2', type: 'circle', x: 150, y: 200, w: 60, h: 60, clickable: true }
      ],
      solution: { action: 'tap', targetId: 'circle2' },
      decoyActions: [],
      difficulty: 1
    };
  });

  it('returns element by id', () => {
    const state = createInitialState(mockPuzzle);
    const el = getElement(state, 'circle1');
    expect(el).not.toBeNull();
    expect(el.id).toBe('circle1');
  });

  it('returns element with correct properties', () => {
    const state = createInitialState(mockPuzzle);
    const el = getElement(state, 'circle2');
    expect(el.x).toBe(150);
    expect(el.clickable).toBe(true);
  });

  it('returns null for unknown id', () => {
    const state = createInitialState(mockPuzzle);
    expect(getElement(state, 'nonexistent')).toBeNull();
  });

  it('returns null for empty string id', () => {
    const state = createInitialState(mockPuzzle);
    expect(getElement(state, '')).toBeNull();
  });
});

describe('getInteractiveElements', () => {
  it('returns all clickable elements', () => {
    const puzzle = {
      id: 'g1', title: 'T', prompt: 'P', type: 'tap',
      elements: [
        { id: 'a', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true },
        { id: 'b', type: 'circle', x: 100, y: 0, w: 60, h: 60, clickable: true },
        { id: 'c', type: 'circle', x: 200, y: 0, w: 60, h: 60, clickable: true }
      ],
      solution: { action: 'tap', targetId: 'a' },
      decoyActions: [],
      difficulty: 1
    };
    const state = createInitialState(puzzle);
    expect(getInteractiveElements(state)).toHaveLength(3);
  });

  it('includes draggable elements', () => {
    const puzzle = {
      id: 'g2', title: 'T', prompt: 'P', type: 'drag',
      elements: [
        { id: 'key', type: 'key', x: 0, y: 0, w: 40, h: 40, draggable: true },
        { id: 'door', type: 'door', x: 100, y: 0, w: 80, h: 80 }
      ],
      solution: { action: 'drag', sourceId: 'key', targetId: 'door' },
      decoyActions: [],
      difficulty: 1
    };
    const state = createInitialState(puzzle);
    const interactive = getInteractiveElements(state);
    expect(interactive.some(e => e.id === 'key')).toBe(true);
  });

  it('excludes hidden non-interactive elements', () => {
    const puzzle = {
      id: 'g3', title: 'T', prompt: 'P', type: 'tap',
      elements: [
        { id: 'visible', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true },
        { id: 'hidden', type: 'label', x: 0, y: 100, w: 60, h: 60, hidden: true }
      ],
      solution: { action: 'tap', targetId: 'visible' },
      decoyActions: [],
      difficulty: 1
    };
    const state = createInitialState(puzzle);
    const interactive = getInteractiveElements(state);
    expect(interactive.some(e => e.id === 'hidden')).toBe(false);
  });

  it('returns empty array when no interactive elements', () => {
    const puzzle = {
      id: 'g4', title: 'T', prompt: 'P', type: 'tap',
      elements: [
        { id: 'bg', type: 'rect', x: 0, y: 0, w: 300, h: 300, hidden: true }
      ],
      solution: { action: 'tap', targetId: 'bg' },
      decoyActions: [],
      difficulty: 1
    };
    const state = createInitialState(puzzle);
    expect(getInteractiveElements(state)).toHaveLength(0);
  });
});

describe('isRevealed', () => {
  let state;
  beforeEach(() => {
    const puzzle = {
      id: 'r1', title: 'T', prompt: 'P', type: 'tap',
      elements: [
        { id: 'a', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true }
      ],
      solution: { action: 'tap', targetId: 'a' },
      decoyActions: [],
      difficulty: 1
    };
    state = createInitialState(puzzle);
  });

  it('returns false for unrevealed element', () => {
    expect(isRevealed(state, 'a')).toBe(false);
  });

  it('returns true after revealElement', () => {
    const next = revealElement(state, 'a');
    expect(isRevealed(next, 'a')).toBe(true);
  });

  it('returns false for other elements when one is revealed', () => {
    const next = revealElement(state, 'a');
    expect(isRevealed(next, 'b')).toBe(false);
  });

  it('returns false on fresh state regardless of element id', () => {
    expect(isRevealed(state, 'nonexistent')).toBe(false);
  });
});

describe('resetSequence', () => {
  let state;
  beforeEach(() => {
    const puzzle = {
      id: 's1', title: 'T', prompt: 'P', type: 'sequence',
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, clickable: true },
        { id: 'b', type: 'rect', x: 100, y: 0, w: 60, h: 60, clickable: true }
      ],
      solution: { action: 'sequence', steps: ['a', 'b'] },
      decoyActions: [],
      difficulty: 1
    };
    state = createInitialState(puzzle);
  });

  it('clears currentSequence', () => {
    const withSeq = { ...state, currentSequence: ['a', 'b'] };
    expect(resetSequence(withSeq).currentSequence).toEqual([]);
  });

  it('clears animation', () => {
    const withAnim = { ...state, animation: { type: 'shake', message: 'wrong' } };
    expect(resetSequence(withAnim).animation).toBeNull();
  });

  it('preserves status', () => {
    const withSeq = { ...state, currentSequence: ['a'], status: 'playing' };
    expect(resetSequence(withSeq).status).toBe('playing');
  });

  it('preserves attempts count', () => {
    const withAttempts = { ...state, currentSequence: ['a'], attempts: 5 };
    expect(resetSequence(withAttempts).attempts).toBe(5);
  });

  it('resets empty sequence without error', () => {
    expect(() => resetSequence(state)).not.toThrow();
    expect(resetSequence(state).currentSequence).toEqual([]);
  });
});

describe('revealElement', () => {
  let state;
  beforeEach(() => {
    const puzzle = {
      id: 'rv1', title: 'T', prompt: 'P', type: 'tap',
      elements: [
        { id: 'x', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true },
        { id: 'y', type: 'circle', x: 100, y: 0, w: 60, h: 60, clickable: true }
      ],
      solution: { action: 'tap', targetId: 'x' },
      decoyActions: [],
      difficulty: 1
    };
    state = createInitialState(puzzle);
  });

  it('adds element to revealedElements', () => {
    const next = revealElement(state, 'x');
    expect(next.revealedElements).toContain('x');
  });

  it('returns same reference if already revealed', () => {
    const s1 = revealElement(state, 'x');
    const s2 = revealElement(s1, 'x');
    expect(s2).toBe(s1);
  });

  it('does not duplicate revealed ids', () => {
    const s1 = revealElement(state, 'x');
    const s2 = revealElement(s1, 'x');
    expect(s2.revealedElements.filter(id => id === 'x')).toHaveLength(1);
  });

  it('can reveal multiple different elements', () => {
    const s1 = revealElement(state, 'x');
    const s2 = revealElement(s1, 'y');
    expect(s2.revealedElements).toContain('x');
    expect(s2.revealedElements).toContain('y');
    expect(s2.revealedElements).toHaveLength(2);
  });

  it('does not mutate original revealedElements', () => {
    revealElement(state, 'x');
    expect(state.revealedElements).toHaveLength(0);
  });
});
