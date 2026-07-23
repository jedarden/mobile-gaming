/**
 * Brain Teaser - Unit Tests
 *
 * Tests for state management and action handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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

    it('records irrelevant tap action without changing status or attempts', () => {
      // circle3 is not in decoyActions, not the solution — completely irrelevant
      const state = createInitialState({ ...mockPuzzle, decoyActions: [] });
      const next = applyAction(state, { action: 'tap', targetId: 'circle1' });
      expect(next.status).toBe('playing');
      expect(next.attempts).toBe(0);
      expect(next.interactions).toHaveLength(1);
    });

    it('uses custom decoy response type for animation', () => {
      const puzzle = {
        ...mockPuzzle,
        decoyActions: [
          { action: 'tap', targetId: 'circle1', response: 'bounce', message: 'Nope!' }
        ]
      };
      const state = createInitialState(puzzle);
      const next = applyAction(state, { action: 'tap', targetId: 'circle1' });
      expect(next.animation.type).toBe('bounce');
    });

    it('defaults animation type to "shake" when decoy has no response property (|| fallback)', () => {
      // Decoy without a response field → decoy.response is undefined → || 'shake' fires
      const puzzle = {
        ...mockPuzzle,
        decoyActions: [
          { action: 'tap', targetId: 'circle1', message: 'Nope!' }
          // No response property — exercises: type: decoy.response || 'shake'
        ]
      };
      const state = createInitialState(puzzle);
      const next = applyAction(state, { action: 'tap', targetId: 'circle1' });
      expect(next.animation.type).toBe('shake');
    });

    it('uses action.sourceId as animation target when action.targetId is absent (|| false arm)', () => {
      // drag decoy with no targetId matches drag action with no targetId
      // → action.targetId is undefined (falsy) → action.targetId || action.sourceId fires the || arm
      const dragPuzzle = {
        id: 'drag-decoy-001',
        title: 'Drag Decoy Test',
        prompt: 'Drag something',
        type: 'drag',
        elements: [
          { id: 'key', type: 'rect', x: 50, y: 200, w: 40, h: 40, draggable: true },
          { id: 'door', type: 'rect', x: 200, y: 150, w: 80, h: 120 }
        ],
        solution: { action: 'drag', sourceId: 'key', targetId: 'door' },
        decoyActions: [{ action: 'drag', sourceId: 'key' }], // no targetId on decoy
        difficulty: 1
      };
      const state = createInitialState(dragPuzzle);
      // action also has no targetId — both undefined → actionsMatch fires → decoy found
      const next = applyAction(state, { action: 'drag', sourceId: 'key' });
      // action.targetId is undefined (falsy) → || action.sourceId → 'key'
      expect(next.animation.target).toBe('key');
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

    it('should detect missing title', () => {
      const result = validatePuzzle({ ...mockPuzzle, title: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing puzzle title');
    });

    it('should detect missing prompt', () => {
      const result = validatePuzzle({ ...mockPuzzle, prompt: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing puzzle prompt');
    });

    it('should detect missing type', () => {
      const result = validatePuzzle({ ...mockPuzzle, type: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing puzzle type');
    });

    it('should detect drag solution missing sourceId', () => {
      const result = validatePuzzle({
        ...mockPuzzle,
        type: 'drag',
        solution: { action: 'drag', targetId: 'circle1' }
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('sourceId'))).toBe(true);
    });

    it('should detect drag solution missing targetId', () => {
      const result = validatePuzzle({
        ...mockPuzzle,
        type: 'drag',
        solution: { action: 'drag', sourceId: 'circle1' }
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('targetId'))).toBe(true);
    });

    it('should detect sequence solution missing steps array', () => {
      const result = validatePuzzle({
        ...mockPuzzle,
        type: 'sequence',
        solution: { action: 'sequence' }
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('steps'))).toBe(true);
    });

    it('should detect tap solution missing targetId', () => {
      // solution.action='tap' but no targetId — line 273-275 in state.js
      const result = validatePuzzle({
        ...mockPuzzle,
        solution: { action: 'tap' }, // no targetId
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('targetid'))).toBe(true);
    });

    it('rejects puzzle with non-array elements (truthy but not an array)', () => {
      const result = validatePuzzle({ ...mockPuzzle, elements: {} });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing or invalid elements array'))).toBe(true);
    });

    it('should detect duplicate element ids', () => {
      const result = validatePuzzle({
        ...mockPuzzle,
        elements: [
          { id: 'dup', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true },
          { id: 'dup', type: 'circle', x: 100, y: 0, w: 60, h: 60, clickable: true }
        ],
        solution: { action: 'tap', targetId: 'dup' }
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate element id'))).toBe(true);
    });

    it('should detect sequence step not found in elements', () => {
      const result = validatePuzzle({
        ...mockPuzzle,
        type: 'sequence',
        solution: { action: 'sequence', steps: ['circle1', 'ghost-id'] }
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('"ghost-id"') && e.includes('not found'))).toBe(true);
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
      expect(state.animation.message).toBe('Wrong sequence!');
    });

    it('non-tap action on sequence puzzle does not add to sequence', () => {
      const seqPuzzle = {
        id: 'seq-003',
        title: 'Non-tap Test',
        prompt: 'Tap in order',
        type: 'sequence',
        elements: [
          { id: 'x', type: 'rect', x: 50, y: 200, w: 60, h: 60, clickable: true }
        ],
        solution: { action: 'sequence', steps: ['x'] },
        decoyActions: [],
        difficulty: 1
      };
      const state = createInitialState(seqPuzzle);
      const next = applyAction(state, { action: 'drag', sourceId: 'x', targetId: 'y' });
      expect(next.currentSequence).toEqual([]);
      expect(next.status).toBe('playing');
    });

    it('tap action without targetId does not add to sequence (action.action==="tap" && action.targetId false arm)', () => {
      // action.action === 'tap' (first condition true) but action.targetId is undefined (second condition false)
      // → if(action.action === 'tap' && action.targetId) evaluates to false → sequence unchanged
      const seqPuzzle = {
        id: 'seq-004',
        title: 'Tap No Target',
        prompt: 'Tap in order',
        type: 'sequence',
        elements: [
          { id: 'x', type: 'rect', x: 50, y: 200, w: 60, h: 60, clickable: true }
        ],
        solution: { action: 'sequence', steps: ['x'] },
        decoyActions: [],
        difficulty: 1
      };
      const state = createInitialState(seqPuzzle);
      // tap action with no targetId — the && short-circuits on falsy targetId
      const next = applyAction(state, { action: 'tap' }); // targetId undefined
      expect(next.currentSequence).toEqual([]);
      expect(next.status).toBe('playing');
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

describe('createInitialState edge cases', () => {
  it('falls back to difficulty 1 when difficulty is 0', () => {
    const puzzle = {
      id: 'e1', title: 'T', prompt: 'P', type: 'tap',
      elements: [{ id: 'a', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true }],
      solution: { action: 'tap', targetId: 'a' },
      decoyActions: [],
      difficulty: 0,
    };
    const state = createInitialState(puzzle);
    expect(state.puzzle.difficulty).toBe(1);
  });

  it('uses empty decoyActions array when decoyActions is null', () => {
    const puzzle = {
      id: 'e2', title: 'T', prompt: 'P', type: 'tap',
      elements: [{ id: 'a', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true }],
      solution: { action: 'tap', targetId: 'a' },
      decoyActions: null,
    };
    const state = createInitialState(puzzle);
    expect(state.puzzle.decoyActions).toEqual([]);
  });
});

describe('getInteractiveElements additional cases', () => {
  it('includes element with hidden: false even when not clickable or draggable', () => {
    const puzzle = {
      id: 'gi1', title: 'T', prompt: 'P', type: 'tap',
      elements: [
        { id: 'label', type: 'label', x: 0, y: 0, w: 100, h: 30, hidden: false },
      ],
      solution: { action: 'tap', targetId: 'label' },
      decoyActions: [],
      difficulty: 1,
    };
    const state = createInitialState(puzzle);
    // !hidden = !false = true → included
    expect(getInteractiveElements(state).some(e => e.id === 'label')).toBe(true);
  });
});

describe('applyAction when already solved', () => {
  it('sets animation to null when action arrives after solve', () => {
    const puzzle = {
      id: 's1', title: 'T', prompt: 'P', type: 'tap',
      elements: [{ id: 'circle1', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true }],
      solution: { action: 'tap', targetId: 'circle1' },
      decoyActions: [],
      difficulty: 1,
    };
    const state = createInitialState(puzzle);
    const solved = applyAction(state, { action: 'tap', targetId: 'circle1' });
    expect(solved.status).toBe('solved');
    // Give solved state a non-null animation then apply another action
    const withAnim = { ...solved, animation: { type: 'celebration', target: {} } };
    const again = applyAction(withAnim, { action: 'tap', targetId: 'circle1' });
    expect(again.animation).toBeNull();
    expect(again.status).toBe('solved');
  });
});

describe('validatePuzzle decoy reference validation', () => {
  const basePuzzle = {
    id: 'd1', title: 'T', prompt: 'P', type: 'tap',
    elements: [
      { id: 'circle1', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true },
    ],
    solution: { action: 'tap', targetId: 'circle1' },
  };

  it('validatePuzzle passes when decoyActions is null (if(puzzle.decoyActions) false branch — skip loop)', () => {
    const result = validatePuzzle({ ...basePuzzle, decoyActions: null });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects decoy targetId not found in elements', () => {
    const result = validatePuzzle({
      ...basePuzzle,
      decoyActions: [{ action: 'tap', targetId: 'ghost' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('"ghost"') && e.includes('not found'))).toBe(true);
  });

  it('accepts decoy with valid element reference', () => {
    const result = validatePuzzle({
      ...basePuzzle,
      decoyActions: [{ action: 'tap', targetId: 'circle1', response: 'shake', message: 'Nope' }],
    });
    expect(result.valid).toBe(true);
  });

  it('detects decoy sourceId not found in elements (drag decoy missing source)', () => {
    const dragBasePuzzle = {
      id: 'd2', title: 'T', prompt: 'P', type: 'drag',
      elements: [
        { id: 'key', type: 'rect', x: 0, y: 0, w: 40, h: 40, draggable: true },
        { id: 'door', type: 'rect', x: 100, y: 0, w: 40, h: 40 },
      ],
      solution: { action: 'drag', sourceId: 'key', targetId: 'door' },
    };
    const result = validatePuzzle({
      ...dragBasePuzzle,
      decoyActions: [{ action: 'drag', sourceId: 'ghost-source', targetId: 'door' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('ghost-source') && e.includes('not found'))).toBe(true);
  });
});

describe('actionsMatch — default switch branch', () => {
  it('unknown action type (e.g. "rotate") does not solve the puzzle even when types match', () => {
    const puzzle = {
      id: 'rot-001', title: 'T', prompt: 'P', type: 'tap',
      elements: [{ id: 'el1', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true }],
      solution: { action: 'rotate', targetId: 'el1' },
      decoyActions: [],
      difficulty: 1,
    };
    const state = createInitialState(puzzle);
    // Both action and solution have action='rotate'; actionsMatch hits default → false
    const next = applyAction(state, { action: 'rotate', targetId: 'el1' });
    expect(next.status).not.toBe('solved');
  });
});

describe('actionsMatch — sequence action missing steps (!action1.steps || !action2.steps branch)', () => {
  it('does not solve puzzle when user action has action="sequence" but no steps field', () => {
    const puzzle = {
      id: 'seq-ms-001', title: 'T', prompt: 'P', type: 'sequence',
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, clickable: true },
        { id: 'b', type: 'rect', x: 70, y: 0, w: 60, h: 60, clickable: true },
      ],
      solution: { action: 'sequence', steps: ['a', 'b'] },
      decoyActions: [],
      difficulty: 1,
    };
    const state = createInitialState(puzzle);
    // action has action='sequence' but no steps → actionsMatch hits !action1.steps → returns false
    const next = applyAction(state, { action: 'sequence' });
    expect(next.status).not.toBe('solved');
  });
});

describe('actionsMatch — sequence step length mismatch (steps.length !== steps.length branch)', () => {
  it('does not solve puzzle when action has correct type but different number of steps (step-length mismatch branch)', () => {
    const puzzle = {
      id: 'seq-len-001', title: 'T', prompt: 'P', type: 'sequence',
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, clickable: true },
        { id: 'b', type: 'rect', x: 70, y: 0, w: 60, h: 60, clickable: true },
        { id: 'c', type: 'rect', x: 140, y: 0, w: 60, h: 60, clickable: true },
      ],
      solution: { action: 'sequence', steps: ['a', 'b'] },
      decoyActions: [],
      difficulty: 1,
    };
    const state = createInitialState(puzzle);
    // action has 3 steps but solution has 2 → length mismatch at line 57 → returns false
    const next = applyAction(state, { action: 'sequence', steps: ['a', 'b', 'c'] });
    expect(next.status).not.toBe('solved');
  });
});

// ── actionsMatch — sequence happy path (auto-play scenario) ──────────────────
// The hint system's onAutoPlay sends a full {action:'sequence', steps:[...]} to
// applyAction. This exercises the actionsMatch 'sequence' case returning true —
// the path that is NOT covered by individual-tap sequence tests above.

describe('actionsMatch — sequence happy path (direct sequence action solves puzzle)', () => {
  const seqPuzzle = {
    id: 'seq-ap-001', title: 'T', prompt: 'P', type: 'sequence',
    elements: [
      { id: 'x', type: 'rect', x: 0, y: 0, w: 60, h: 60, clickable: true },
      { id: 'y', type: 'rect', x: 70, y: 0, w: 60, h: 60, clickable: true },
    ],
    solution: { action: 'sequence', steps: ['x', 'y'] },
    decoyActions: [],
    difficulty: 1,
  };

  it('solves puzzle when a full matching sequence action is applied directly (actionsMatch returns true)', () => {
    const state = createInitialState(seqPuzzle);
    // Mimics the auto-play path: hint system sends the complete solution object
    const next = applyAction(state, { action: 'sequence', steps: ['x', 'y'] });
    expect(next.status).toBe('solved');
    expect(next.animation.type).toBe('celebration');
  });

  it('does not solve when same-length steps differ in content (actionsMatch every() returns false)', () => {
    const state = createInitialState(seqPuzzle);
    // Same length as solution (['x','y']) but different step → every() fails → returns false
    const next = applyAction(state, { action: 'sequence', steps: ['x', 'z'] });
    expect(next.status).not.toBe('solved');
  });
});

describe('findDecoy — non-array truthy decoyActions (!Array.isArray branch)', () => {
  it('applyAction handles non-array decoyActions gracefully (findDecoy returns null)', () => {
    // Manually build a state bypassing createInitialState to set decoyActions to an object
    const state = {
      puzzle: {
        id: 'nd-001', title: 'T', prompt: 'P', type: 'tap',
        elements: [{ id: 'el1', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true }],
        solution: { action: 'tap', targetId: 'different-el' },
        decoyActions: { length: 0 }, // truthy non-array object
        hint: undefined, showBanner: false, difficulty: 1,
      },
      interactions: [], status: 'playing', attempts: 0,
      revealedElements: [], currentSequence: [], animation: null,
    };
    // findDecoy receives non-array → returns null → no decoy branch taken
    const next = applyAction(state, { action: 'tap', targetId: 'el1' });
    expect(next.status).toBe('playing'); // not solved (wrong target), not a decoy error
    expect(next.attempts).toBe(0);      // decoy path not taken
  });
});

// ── createInitialState — showBanner || false default ──────────────────────────

describe('createInitialState — showBanner || false default (|| operator branches)', () => {
  it('defaults showBanner to false when puzzle has no showBanner property (|| false fallback branch)', () => {
    const puzzle = {
      id: 'sb-test', title: 'T', prompt: 'P', type: 'tap',
      elements: [{ id: 'a', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true }],
      solution: { action: 'tap', targetId: 'a' },
      decoyActions: [],
    };
    const state = createInitialState(puzzle);
    expect(state.puzzle.showBanner).toBe(false);
  });

  it('preserves showBanner: true when puzzle explicitly sets it (|| short-circuits on truthy)', () => {
    const puzzle = {
      id: 'sb-true', title: 'T', prompt: 'P', type: 'tap',
      elements: [{ id: 'a', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true }],
      solution: { action: 'tap', targetId: 'a' },
      decoyActions: [],
      showBanner: true,
    };
    const state = createInitialState(puzzle);
    expect(state.puzzle.showBanner).toBe(true);
  });
});

// ── validatePuzzle — missing solution ─────────────────────────────────────────

describe('validatePuzzle — missing solution (if(!puzzle.solution) branch)', () => {
  it('reports error when solution is undefined (if(!puzzle.solution) true branch)', () => {
    const result = validatePuzzle({
      id: 'vs-001', title: 'T', prompt: 'P', type: 'tap',
      elements: [{ id: 'a', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true }],
      solution: undefined,
      decoyActions: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing puzzle solution');
  });
});

// ── validatePuzzle — sequence steps truthy non-array ─────────────────────────

describe('validatePuzzle — sequence steps truthy non-array (!Array.isArray true arm)', () => {
  it('rejects sequence puzzle when steps is a truthy non-array object', () => {
    // steps is a truthy object (not an array) →
    // !puzzle.solution.steps is false, !Array.isArray(steps) is true → "missing steps array" pushed
    // Using { forEach: () => {} } so the later steps.forEach call at line 308 doesn't crash
    const result = validatePuzzle({
      id: 'seq-nonarr-001', title: 'T', prompt: 'P', type: 'sequence',
      elements: [{ id: 'a', type: 'circle', x: 0, y: 0, w: 60, h: 60, clickable: true }],
      solution: { action: 'sequence', steps: { forEach: () => {} } },
      decoyActions: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('steps'))).toBe(true);
  });
});

// ── validatePuzzle — solution.sourceId not found in elements ──────────────────
// state.js line 305-306: separate branch for sourceId reference check.
// Existing tests cover targetId-not-found and missing-sourceId, but not the
// case where sourceId is present but references a non-existent element.

describe('validatePuzzle — solution sourceId not found in elements (if(sourceId && !has) branch)', () => {
  it('reports error when drag solution sourceId refers to an element not in elements array', () => {
    const result = validatePuzzle({
      id: 'drag-src-001', title: 'T', prompt: 'P', type: 'drag',
      elements: [
        { id: 'key', type: 'rect', x: 0, y: 0, w: 40, h: 40, draggable: true },
        { id: 'door', type: 'rect', x: 100, y: 0, w: 40, h: 40 },
      ],
      // sourceId exists but refers to 'ghost-key' which is not in elements
      solution: { action: 'drag', sourceId: 'ghost-key', targetId: 'door' },
      decoyActions: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('ghost-key') && e.includes('not found'))).toBe(true);
  });
});

// ── Daily Challenge ─────────────────────────────────────────────────────────────

// Mock the daily module
vi.mock('../../src/shared/daily.js', () => ({
  getGameDailySeed: vi.fn((gameId) => `2026-07-23:${gameId}`),
  getGameDailyNumericSeed: vi.fn((gameId) => {
    // Hash function matching the real implementation
    const str = `2026-07-23:${gameId}`;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    return h >>> 0;
  }),
  completeDailyChallenge: vi.fn(),
  isGameDailyCompleted: vi.fn(() => false)
}));

import { getGameDailySeed, getGameDailyNumericSeed, completeDailyChallenge } from '../../src/shared/daily.js';
import puzzles from '../../src/games/brain-teaser/levels.json' with { type: 'json' };

describe('Daily Challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a daily puzzle from a known seed', () => {
    const GAME_ID = 'brain-teaser';
    const seed = getGameDailySeed(GAME_ID);

    // Mock returns deterministic seed
    expect(seed).toBe(`2026-07-23:${GAME_ID}`);

    // Compute numeric seed
    const numericSeed = getGameDailyNumericSeed(GAME_ID);
    expect(typeof numericSeed).toBe('number');

    // Select daily level: levelIndex = seed % puzzles.length
    const dailyIndex = numericSeed % puzzles.length;
    const dailyPuzzle = puzzles[dailyIndex];

    expect(dailyPuzzle).toBeDefined();
    expect(dailyPuzzle).toHaveProperty('id');
    expect(dailyPuzzle).toHaveProperty('title');
    expect(dailyPuzzle).toHaveProperty('prompt');
    expect(dailyPuzzle).toHaveProperty('type');
    expect(dailyPuzzle).toHaveProperty('elements');
    expect(dailyPuzzle).toHaveProperty('solution');
  });

  it('generates the same daily puzzle for the same seed', () => {
    const GAME_ID = 'brain-teaser';

    const seed1 = getGameDailySeed(GAME_ID);
    const numericSeed1 = getGameDailyNumericSeed(GAME_ID);
    const dailyIndex1 = numericSeed1 % puzzles.length;
    const puzzle1 = puzzles[dailyIndex1];

    const seed2 = getGameDailySeed(GAME_ID);
    const numericSeed2 = getGameDailyNumericSeed(GAME_ID);
    const dailyIndex2 = numericSeed2 % puzzles.length;
    const puzzle2 = puzzles[dailyIndex2];

    // Same seed should produce the same puzzle
    expect(seed1).toBe(seed2);
    expect(numericSeed1).toBe(numericSeed2);
    expect(dailyIndex1).toBe(dailyIndex2);
    expect(puzzle1).toEqual(puzzle2);
  });

  it('can create initial state from daily puzzle', () => {
    const GAME_ID = 'brain-teaser';
    const numericSeed = getGameDailyNumericSeed(GAME_ID);
    const dailyIndex = numericSeed % puzzles.length;
    const dailyPuzzle = puzzles[dailyIndex];

    const state = createInitialState(dailyPuzzle);

    expect(state.puzzle.id).toBe(dailyPuzzle.id);
    expect(state.status).toBe('playing');
    expect(state.attempts).toBe(0);
  });

  it('simulates a win on daily puzzle and calls completeDailyChallenge exactly once', () => {
    const GAME_ID = 'brain-teaser';
    const numericSeed = getGameDailyNumericSeed(GAME_ID);
    const dailyIndex = numericSeed % puzzles.length;
    const dailyPuzzle = puzzles[dailyIndex];

    const state = createInitialState(dailyPuzzle);

    // Find the solution action for this puzzle
    const solution = dailyPuzzle.solution;
    let finalState = state;

    // Apply the solution action based on puzzle type
    if (solution.action === 'tap') {
      finalState = applyAction(state, { action: 'tap', targetId: solution.targetId });
    } else if (solution.action === 'drag') {
      finalState = applyAction(state, { action: 'drag', sourceId: solution.sourceId, targetId: solution.targetId });
    } else if (solution.action === 'sequence') {
      // For sequence puzzles, apply each step
      let currentState = state;
      for (const step of solution.steps) {
        currentState = applyAction(currentState, { action: 'tap', targetId: step });
      }
      finalState = currentState;
    }

    // Verify win condition
    expect(finalState.status).toBe('solved');

    // Call completeDailyChallenge (simulating what game.js does)
    completeDailyChallenge(GAME_ID);

    // Assert completeDailyChallenge was called exactly once
    expect(completeDailyChallenge).toHaveBeenCalledTimes(1);
    expect(completeDailyChallenge).toHaveBeenCalledWith(GAME_ID);
  });
});
