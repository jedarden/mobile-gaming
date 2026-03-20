/**
 * Brain Teaser - State Management
 *
 * Pure state functions for lateral-thinking puzzles.
 * Each puzzle has one correct solution and optional decoy actions.
 */

/**
 * Create initial game state from puzzle data
 *
 * @param {Object} puzzle - Puzzle definition from levels.json
 * @returns {Object} Initial game state
 */
export function createInitialState(puzzle) {
  return {
    puzzle: {
      id: puzzle.id,
      title: puzzle.title,
      prompt: puzzle.prompt,
      type: puzzle.type,
      elements: puzzle.elements.map(e => ({ ...e })),
      solution: { ...puzzle.solution },
      decoyActions: puzzle.decoyActions ? puzzle.decoyActions.map(d => ({ ...d })) : [],
      hint: puzzle.hint,
      showBanner: puzzle.showBanner || false,
      difficulty: puzzle.difficulty || 1
    },
    interactions: [],
    status: 'playing',
    attempts: 0,
    revealedElements: [],
    currentSequence: [],
    animation: null
  };
}

/**
 * Check if two actions match
 *
 * @param {Object} action1 - First action
 * @param {Object} action2 - Second action
 * @returns {boolean} True if actions match
 */
function actionsMatch(action1, action2) {
  if (action1.action !== action2.action) return false;

  switch (action1.action) {
    case 'tap':
      return action1.targetId === action2.targetId;

    case 'drag':
      return action1.sourceId === action2.sourceId &&
             action1.targetId === action2.targetId;

    case 'sequence':
      if (!action1.steps || !action2.steps) return false;
      if (action1.steps.length !== action2.steps.length) return false;
      return action1.steps.every((step, i) => step === action2.steps[i]);

    default:
      return false;
  }
}

/**
 * Find matching decoy action
 *
 * @param {Object} action - Player action
 * @param {Array} decoyActions - List of decoy actions
 * @returns {Object|null} Matching decoy or null
 */
function findDecoy(action, decoyActions) {
  if (!decoyActions || !Array.isArray(decoyActions)) return null;

  return decoyActions.find(decoy => actionsMatch(action, decoy));
}

/**
 * Get element by ID from puzzle
 *
 * @param {Object} state - Game state
 * @param {string} elementId - Element ID to find
 * @returns {Object|null} Element or null
 */
export function getElement(state, elementId) {
  return state.puzzle.elements.find(e => e.id === elementId) || null;
}

/**
 * Get all visible/clickable elements
 *
 * @param {Object} state - Game state
 * @returns {Array} List of interactive elements
 */
export function getInteractiveElements(state) {
  return state.puzzle.elements.filter(e =>
    e.clickable || e.draggable || !e.hidden
  );
}

/**
 * Check if element is revealed
 *
 * @param {Object} state - Game state
 * @param {string} elementId - Element ID
 * @returns {boolean} True if revealed
 */
export function isRevealed(state, elementId) {
  return state.revealedElements.includes(elementId);
}

/**
 * Apply a player action to the state
 *
 * @param {Object} state - Current game state
 * @param {Object} action - Player action { action: 'tap'|'drag'|'sequence', ... }
 * @returns {Object} New state with updated status
 */
export function applyAction(state, action) {
  // Don't process actions if already solved
  if (state.status === 'solved') {
    return { ...state, animation: null };
  }

  const newState = {
    ...state,
    puzzle: { ...state.puzzle },
    interactions: [...state.interactions, { ...action, timestamp: Date.now() }],
    animation: null
  };

  // Check if action matches solution
  if (actionsMatch(action, state.puzzle.solution)) {
    newState.status = 'solved';
    newState.animation = { type: 'celebration', target: action };
    return newState;
  }

  // Check if action matches a decoy
  const decoy = findDecoy(action, state.puzzle.decoyActions);
  if (decoy) {
    newState.attempts++;
    newState.animation = {
      type: decoy.response || 'shake',
      target: action.targetId || action.sourceId,
      message: decoy.message
    };
    return newState;
  }

  // Handle sequence building
  if (state.puzzle.type === 'sequence') {
    const newSequence = [...state.currentSequence];

    if (action.action === 'tap' && action.targetId) {
      newSequence.push(action.targetId);
      newState.currentSequence = newSequence;

      // Check if sequence matches so far
      const solutionSteps = state.puzzle.solution.steps || [];
      const isPrefix = solutionSteps.slice(0, newSequence.length)
        .every((step, i) => step === newSequence[i]);

      if (!isPrefix) {
        // Wrong sequence - reset
        newState.attempts++;
        newState.animation = { type: 'shake', message: 'Wrong sequence!' };
        newState.currentSequence = [];
      } else if (newSequence.length === solutionSteps.length) {
        // Complete sequence - already checked above, but this handles edge case
        newState.status = 'solved';
        newState.animation = { type: 'celebration', target: action };
      }
    }
  }

  // Irrelevant action - no state change
  return newState;
}

/**
 * Reset current sequence (for sequence-type puzzles)
 *
 * @param {Object} state - Current state
 * @returns {Object} State with cleared sequence
 */
export function resetSequence(state) {
  return {
    ...state,
    currentSequence: [],
    animation: null
  };
}

/**
 * Reveal a hidden element
 *
 * @param {Object} state - Current state
 * @param {string} elementId - Element to reveal
 * @returns {Object} State with element revealed
 */
export function revealElement(state, elementId) {
  if (state.revealedElements.includes(elementId)) {
    return state;
  }

  return {
    ...state,
    revealedElements: [...state.revealedElements, elementId]
  };
}

/**
 * Clone state for history
 *
 * @param {Object} state - State to clone
 * @returns {Object} Deep clone of state
 */
export function cloneState(state) {
  return {
    puzzle: {
      ...state.puzzle,
      elements: state.puzzle.elements.map(e => ({ ...e })),
      solution: { ...state.puzzle.solution },
      decoyActions: state.puzzle.decoyActions.map(d => ({ ...d }))
    },
    interactions: state.interactions.map(i => ({ ...i })),
    status: state.status,
    attempts: state.attempts,
    revealedElements: [...state.revealedElements],
    currentSequence: [...state.currentSequence],
    animation: state.animation ? { ...state.animation } : null
  };
}

/**
 * Get hint text for puzzle
 *
 * @param {Object} state - Game state
 * @returns {string|null} Hint text or null
 */
export function getHint(state) {
  return state.puzzle.hint || null;
}

/**
 * Validate a puzzle definition
 *
 * @param {Object} puzzle - Puzzle to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validatePuzzle(puzzle) {
  const errors = [];

  // Required fields
  if (!puzzle.id) errors.push('Missing puzzle id');
  if (!puzzle.title) errors.push('Missing puzzle title');
  if (!puzzle.prompt) errors.push('Missing puzzle prompt');
  if (!puzzle.type) errors.push('Missing puzzle type');
  if (!puzzle.solution) errors.push('Missing puzzle solution');

  // Validate type
  if (puzzle.type && !['tap', 'drag', 'sequence'].includes(puzzle.type)) {
    errors.push(`Invalid puzzle type: ${puzzle.type}`);
  }

  // Validate solution
  if (puzzle.solution) {
    if (!puzzle.solution.action) {
      errors.push('Solution missing action type');
    }

    if (puzzle.solution.action === 'tap' && !puzzle.solution.targetId) {
      errors.push('Tap solution missing targetId');
    }

    if (puzzle.solution.action === 'drag') {
      if (!puzzle.solution.sourceId) errors.push('Drag solution missing sourceId');
      if (!puzzle.solution.targetId) errors.push('Drag solution missing targetId');
    }

    if (puzzle.solution.action === 'sequence') {
      if (!puzzle.solution.steps || !Array.isArray(puzzle.solution.steps)) {
        errors.push('Sequence solution missing steps array');
      }
    }
  }

  // Validate elements
  if (!puzzle.elements || !Array.isArray(puzzle.elements)) {
    errors.push('Missing or invalid elements array');
  } else {
    const elementIds = new Set();
    puzzle.elements.forEach((el, i) => {
      if (!el.id) errors.push(`Element ${i} missing id`);
      if (elementIds.has(el.id)) errors.push(`Duplicate element id: ${el.id}`);
      elementIds.add(el.id);
    });

    // Validate solution references valid elements
    if (puzzle.solution) {
      if (puzzle.solution.targetId && !elementIds.has(puzzle.solution.targetId)) {
        errors.push(`Solution targetId "${puzzle.solution.targetId}" not found in elements`);
      }
      if (puzzle.solution.sourceId && !elementIds.has(puzzle.solution.sourceId)) {
        errors.push(`Solution sourceId "${puzzle.solution.sourceId}" not found in elements`);
      }
      if (puzzle.solution.steps) {
        puzzle.solution.steps.forEach(stepId => {
          if (!elementIds.has(stepId)) {
            errors.push(`Sequence step "${stepId}" not found in elements`);
          }
        });
      }
    }

    // Validate decoy references
    if (puzzle.decoyActions) {
      puzzle.decoyActions.forEach((decoy, i) => {
        if (decoy.targetId && !elementIds.has(decoy.targetId)) {
          errors.push(`Decoy ${i} targetId "${decoy.targetId}" not found in elements`);
        }
        if (decoy.sourceId && !elementIds.has(decoy.sourceId)) {
          errors.push(`Decoy ${i} sourceId "${decoy.sourceId}" not found in elements`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  createInitialState,
  applyAction,
  getElement,
  getInteractiveElements,
  isRevealed,
  resetSequence,
  revealElement,
  cloneState,
  getHint,
  validatePuzzle
};
