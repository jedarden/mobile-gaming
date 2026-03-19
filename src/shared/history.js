/**
 * History - Generic undo/redo stack for game state
 *
 * Provides a simple history manager for tracking state changes
 * and supporting undo operations. Each game can create its own
 * history instance with configurable depth.
 *
 * Usage:
 *   const history = createHistory(50);
 *   history.push(currentState);
 *   if (history.canUndo()) {
 *     const prevState = history.undo();
 *   }
 */

/**
 * Create a new history manager
 * @param {number} maxDepth - Maximum number of states to keep
 * @returns {object} History manager with push, undo, canUndo, clear methods
 */
export function createHistory(maxDepth = 50) {
  const stack = [];
  let pointer = -1;

  return {
    /**
     * Push a new state onto the history stack
     * Truncates any redo states when pushing after undo
     * @param {*} state - State to save (should be immutable/cloned)
     */
    push(state) {
      // Remove any states after current pointer (redo branch)
      stack.splice(pointer + 1);

      // Add new state
      stack.push(state);

      // Enforce max depth
      if (stack.length > maxDepth) {
        stack.shift();
      } else {
        pointer++;
      }
    },

    /**
     * Undo to previous state
     * @returns {*} Previous state or null if no undo available
     */
    undo() {
      if (!this.canUndo()) return null;
      pointer--;
      return stack[pointer];
    },

    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo() {
      return pointer > 0;
    },

    /**
     * Get current state without modifying pointer
     * @returns {*} Current state or null
     */
    current() {
      return pointer >= 0 ? stack[pointer] : null;
    },

    /**
     * Clear all history
     */
    clear() {
      stack.length = 0;
      pointer = -1;
    },

    /**
     * Get number of states in history
     * @returns {number}
     */
    get length() {
      return stack.length;
    },

    /**
     * Get current pointer position
     * @returns {number}
     */
    get position() {
      return pointer;
    }
  };
}

/**
 * History class for games that need class-based history
 */
export class History {
  constructor(maxDepth = 50) {
    this._stack = [];
    this._pointer = -1;
    this._maxDepth = maxDepth;
  }

  push(state) {
    // Remove any states after current pointer
    this._stack.splice(this._pointer + 1);
    this._stack.push(state);

    if (this._stack.length > this._maxDepth) {
      this._stack.shift();
    } else {
      this._pointer++;
    }
  }

  undo() {
    if (!this.canUndo()) return null;
    this._pointer--;
    return this._stack[this._pointer];
  }

  canUndo() {
    return this._pointer > 0;
  }

  current() {
    return this._pointer >= 0 ? this._stack[this._pointer] : null;
  }

  clear() {
    this._stack.length = 0;
    this._pointer = -1;
  }

  get length() {
    return this._stack.length;
  }

  get position() {
    return this._pointer;
  }
}

export default createHistory;
