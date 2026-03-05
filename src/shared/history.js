/**
 * History.js - Undo/Redo System
 *
 * Provides state history management with:
 * - Configurable history depth
 * - Undo/redo operations
 * - State snapshots
 * - Timeline navigation
 * - Jump to specific states
 */

/**
 * Deep clone a value using structuredClone with JSON fallback
 * @param {*} value - Value to clone
 * @returns {*} Deep clone of the value
 */
function deepClone(value) {
  // structuredClone is available in modern browsers and Node.js 17+
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  // Fallback for older environments
  return JSON.parse(JSON.stringify(value));
}

export class History {
  constructor(maxDepth = 50) {
    this.history = [];
    this.index = -1;
    this.maxDepth = maxDepth;
  }

  /**
   * Push a new state onto history
   * @param {*} state - State to save (deep cloned)
   */
  push(state) {
    // Remove any redo states (branching)
    this.history = this.history.slice(0, this.index + 1);

    // Add new state (deep clone to prevent mutations)
    this.history.push(deepClone(state));
    this.index++;

    // Trim if over max depth
    if (this.history.length > this.maxDepth) {
      this.history.shift();
      this.index--;
    }
  }

  /**
   * Undo to previous state
   * @returns {*} Previous state or null if at beginning
   */
  undo() {
    if (this.index > 0) {
      this.index--;
      return deepClone(this.history[this.index]);
    }
    return null;
  }

  /**
   * Redo to next state
   * @returns {*} Next state or null if at end
   */
  redo() {
    if (this.index < this.history.length - 1) {
      this.index++;
      return deepClone(this.history[this.index]);
    }
    return null;
  }

  /**
   * Jump to a specific state by index
   * @param {number} idx - Index to jump to
   * @returns {*} State at index or null if invalid
   */
  jumpTo(idx) {
    if (idx >= 0 && idx < this.history.length) {
      this.index = idx;
      return deepClone(this.history[idx]);
    }
    return null;
  }

  /**
   * Get current state without changing position
   * @returns {*} Current state or null if empty
   */
  current() {
    if (this.index >= 0) {
      return deepClone(this.history[this.index]);
    }
    return null;
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this.index > 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this.index < this.history.length - 1;
  }

  /**
   * Get all states for timeline visualization
   * @returns {Array} Array of {index, state, isCurrent} objects
   */
  getTimeline() {
    return this.history.map((state, i) => ({
      index: i,
      state: deepClone(state),
      isCurrent: i === this.index
    }));
  }

  /**
   * Clear all history
   */
  clear() {
    this.history = [];
    this.index = -1;
  }

  /**
   * Get current number of states in history
   * @returns {number}
   */
  get length() {
    return this.history.length;
  }

  /**
   * Get current position index
   * @returns {number}
   */
  get position() {
    return this.index;
  }
}

// Alias for API compatibility
export { History as GameHistory };

export default History;
