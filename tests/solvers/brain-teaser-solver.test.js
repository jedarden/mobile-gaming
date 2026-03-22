/**
 * Brain Teaser - Solver Test
 *
 * Automated solver that reads solutions from JSON and validates
 * that applyAction correctly handles solutions and decoys.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createInitialState, applyAction, validatePuzzle } from '../../src/games/brain-teaser/state.js';

// Import puzzles directly
import puzzles from '../../src/games/brain-teaser/levels.json';

describe('Brain Teaser Solver', () => {
  describe('Puzzle Validation', () => {
    it('should validate all puzzles', () => {
      puzzles.forEach((puzzle, index) => {
        const validation = validatePuzzle(puzzle);
        expect(validation.valid, `Puzzle ${index} (${puzzle.id}): ${validation.errors.join(', ')}`).toBe(true);
      });
    });

    it('should have unique puzzle IDs', () => {
      const ids = puzzles.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid solution element references', () => {
      puzzles.forEach((puzzle, index) => {
        const elementIds = new Set(puzzle.elements.map(e => e.id));

        if (puzzle.solution.targetId) {
          expect(elementIds.has(puzzle.solution.targetId),
            `Puzzle ${index} (${puzzle.id}): solution targetId not found in elements`).toBe(true);
        }

        if (puzzle.solution.sourceId) {
          expect(elementIds.has(puzzle.solution.sourceId),
            `Puzzle ${index} (${puzzle.id}): solution sourceId not found in elements`).toBe(true);
        }

        if (puzzle.solution.steps) {
          puzzle.solution.steps.forEach((stepId, stepIndex) => {
            expect(elementIds.has(stepId),
              `Puzzle ${index} (${puzzle.id}): solution step ${stepIndex} "${stepId}" not found in elements`).toBe(true);
          });
        }
      });
    });
  });

  describe('Solution Verification', () => {
    it('should solve all tap-type puzzles with correct solution', () => {
      const tapPuzzles = puzzles.filter(p => p.type === 'tap');

      tapPuzzles.forEach(puzzle => {
        const state = createInitialState(puzzle);
        expect(state.status).toBe('playing');

        const newState = applyAction(state, puzzle.solution);
        expect(newState.status).toBe('solved');
      });
    });

    it('should solve all drag-type puzzles with correct solution', () => {
      const dragPuzzles = puzzles.filter(p => p.type === 'drag');

      dragPuzzles.forEach(puzzle => {
        const state = createInitialState(puzzle);
        expect(state.status).toBe('playing');

        const newState = applyAction(state, puzzle.solution);
        expect(newState.status).toBe('solved');
      });
    });

    it('should solve all sequence-type puzzles with correct solution', () => {
      const sequencePuzzles = puzzles.filter(p => p.type === 'sequence');

      sequencePuzzles.forEach(puzzle => {
        const state = createInitialState(puzzle);
        expect(state.status).toBe('playing');

        // Apply sequence step by step
        let currentState = state;
        const steps = puzzle.solution.steps;

        steps.forEach((stepId, index) => {
          const action = { action: 'tap', targetId: stepId };
          currentState = applyAction(currentState, action);

          // Last step should solve the puzzle
          if (index === steps.length - 1) {
            expect(currentState.status).toBe('solved');
          } else {
            // Intermediate steps should keep playing
            expect(currentState.status).toBe('playing');
          }
        });
      });
    });
  });

  describe('Decoy Handling', () => {
    it('should not solve puzzles when decoy actions are applied', () => {
      puzzles.forEach(puzzle => {
        if (!puzzle.decoyActions || puzzle.decoyActions.length === 0) return;

        const state = createInitialState(puzzle);

        puzzle.decoyActions.forEach(decoy => {
          const newState = applyAction(createInitialState(puzzle), decoy);
          expect(newState.status).toBe('playing');
          expect(newState.attempts).toBeGreaterThan(0);
        });
      });
    });

    it('should increment attempts on decoy action', () => {
      puzzles.forEach(puzzle => {
        if (!puzzle.decoyActions || puzzle.decoyActions.length === 0) return;

        const state = createInitialState(puzzle);
        const initialAttempts = state.attempts;

        const newState = applyAction(state, puzzle.decoyActions[0]);
        expect(newState.attempts).toBe(initialAttempts + 1);
      });
    });

    it('should set animation on decoy action', () => {
      puzzles.forEach(puzzle => {
        if (!puzzle.decoyActions || puzzle.decoyActions.length === 0) return;

        const state = createInitialState(puzzle);
        const newState = applyAction(state, puzzle.decoyActions[0]);

        expect(newState.animation).not.toBeNull();
        expect(newState.animation.type).toBe(puzzle.decoyActions[0].response || 'shake');
      });
    });

    it('should still solve puzzle after decoy attempts', () => {
      puzzles.forEach(puzzle => {
        const state = createInitialState(puzzle);

        // Apply all decoys
        let currentState = state;
        if (puzzle.decoyActions) {
          puzzle.decoyActions.forEach(decoy => {
            currentState = applyAction(currentState, decoy);
          });
        }

        // Apply solution - should still solve
        const solvedState = applyAction(currentState, puzzle.solution);
        expect(solvedState.status).toBe('solved');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle irrelevant actions without state change', () => {
      const puzzle = puzzles[0];
      const state = createInitialState(puzzle);

      // Apply an action that doesn't match solution or decoys
      const irrelevantAction = { action: 'tap', targetId: 'nonexistent' };
      const newState = applyAction(state, irrelevantAction);

      expect(newState.status).toBe('playing');
      expect(newState.attempts).toBe(state.attempts);
    });

    it('should not process actions after solved', () => {
      const puzzle = puzzles.find(p => p.type === 'tap');
      const state = createInitialState(puzzle);

      // Solve the puzzle
      const solvedState = applyAction(state, puzzle.solution);
      expect(solvedState.status).toBe('solved');

      // Try another action
      const newState = applyAction(solvedState, puzzle.solution);
      expect(newState.status).toBe('solved');
      expect(newState.animation).toBeNull();
    });

    it('should track interaction history', () => {
      const puzzle = puzzles.find(p => p.type === 'tap');
      const state = createInitialState(puzzle);

      const newState = applyAction(state, puzzle.solution);

      expect(newState.interactions).toHaveLength(1);
      expect(newState.interactions[0]).toMatchObject(puzzle.solution);
    });
  });

  describe('Sequence Puzzles', () => {
    it('should reset sequence on wrong step', () => {
      const puzzle = puzzles.find(p => p.type === 'sequence');
      if (!puzzle) return;

      const state = createInitialState(puzzle);

      // Apply wrong first step (if there are multiple options)
      const wrongStep = { action: 'tap', targetId: puzzle.solution.steps[puzzle.solution.steps.length - 1] };
      const newState = applyAction(state, wrongStep);

      // Should either stay playing with reset sequence or increment attempts
      expect(newState.status).toBe('playing');
    });

    it('should track current sequence progress', () => {
      const puzzle = puzzles.find(p => p.type === 'sequence');
      if (!puzzle) return;

      let state = createInitialState(puzzle);

      // Apply correct first step
      const firstStep = { action: 'tap', targetId: puzzle.solution.steps[0] };
      state = applyAction(state, firstStep);

      expect(state.currentSequence).toHaveLength(1);
      expect(state.currentSequence[0]).toBe(puzzle.solution.steps[0]);
    });
  });
});

// ── Per-level individual solvability tests ─────────────────────────────────────
//
// One test per puzzle. Makes failures immediately visible by ID instead of
// requiring a forEach loop message to identify the broken level.

describe('Individual level solvability', () => {
  for (const puzzle of puzzles) {
    if (puzzle.type === 'tap') {
      it(`${puzzle.id} (tap) — solution produces solved state`, () => {
        const state = createInitialState(puzzle);
        expect(state.status).toBe('playing');
        const next = applyAction(state, puzzle.solution);
        expect(next.status).toBe('solved');
      });
    } else if (puzzle.type === 'drag') {
      it(`${puzzle.id} (drag) — solution produces solved state`, () => {
        const state = createInitialState(puzzle);
        expect(state.status).toBe('playing');
        const next = applyAction(state, puzzle.solution);
        expect(next.status).toBe('solved');
      });
    } else if (puzzle.type === 'sequence') {
      it(`${puzzle.id} (sequence) — applying all steps produces solved state`, () => {
        let state = createInitialState(puzzle);
        expect(state.status).toBe('playing');
        const steps = puzzle.solution.steps;
        for (let i = 0; i < steps.length; i++) {
          state = applyAction(state, { action: 'tap', targetId: steps[i] });
          if (i < steps.length - 1) {
            expect(state.status).toBe('playing');
          }
        }
        expect(state.status).toBe('solved');
      });
    }
  }
});
