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
  validatePuzzle
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
