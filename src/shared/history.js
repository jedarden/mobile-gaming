/**
 * History.js - Undo/Redo System
 *
 * Provides state history management with:
 * - Configurable history depth
 * - Undo/redo operations
 * - State snapshots
 */

export class History {
  constructor(maxDepth = 50) {
    this.history = [];
    this.index = -1;
    this.maxDepth = maxDepth;
  }

  /**
   * Push a new state onto history
   * @param {*} state - State to save
   */
  push(state) {
    // Remove any redo states
    this.history = this.history.slice(0, this.index + 1);

    // Add new state
    this.history.push(this.clone(state));
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
      return this.clone(this.history[this.index]);
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
      return this.clone(this.history[this.index]);
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
   * Clear history
   */
  clear() {
    this.history = [];
    this.index = -1;
  }

  /**
   * Clone state (deep copy)
   * @param {*} state
   * @returns {*}
   */
  clone(state) {
    return JSON.parse(JSON.stringify(state));
  }
}

export default History;
