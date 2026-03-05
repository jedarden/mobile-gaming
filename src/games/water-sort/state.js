/**
 * Water Sort - State Management
 *
 * Manages game state for the water sort puzzle:
 * - Tubes with colored liquid layers
 * - Pour operations and validation
 * - Win condition checking
 * - Undo history
 */

/**
 * Create initial game state from level data
 */
export function createInitialState(level) {
  return {
    tubes: level.tubes.map(tube => [...tube]), // Deep copy
    moves: 0,
    won: false,
    levelId: level.id,
    optimal: level.optimal,
    capacity: 4, // Standard tube capacity
    selectedTube: null,
    pourPreview: null
  };
}

/**
 * Clone state for undo history
 */
export function cloneState(state) {
  return {
    ...state,
    tubes: state.tubes.map(tube => [...tube]),
    selectedTube: null,
    pourPreview: null
  };
}

/**
 * Get the top color of a tube (or null if empty)
 */
export function getTopColor(tube) {
  if (tube.length === 0) return null;
  return tube[tube.length - 1];
}

/**
 * Count consecutive top colors (how much can be poured)
 */
export function countTopColors(tube) {
  if (tube.length === 0) return 0;
  
  const topColor = tube[tube.length - 1];
  let count = 0;
  
  for (let i = tube.length - 1; i >= 0; i--) {
    if (tube[i] === topColor) {
      count++;
    } else {
      break;
    }
  }
  
  return count;
}

/**
 * Check if a pour is valid
 */
export function canPour(state, fromIndex, toIndex) {
  if (fromIndex === toIndex) return false;
  
  const fromTube = state.tubes[fromIndex];
  const toTube = state.tubes[toIndex];
  
  // Can't pour from empty tube
  if (fromTube.length === 0) return false;
  
  // Can't pour to full tube
  if (toTube.length >= state.capacity) return false;
  
  const topColor = getTopColor(fromTube);
  const targetTop = getTopColor(toTube);
  
  // Can pour to empty tube or same color
  return targetTop === null || targetTop === topColor;
}

/**
 * Calculate how much liquid can be poured
 */
export function getPourAmount(state, fromIndex, toIndex) {
  if (!canPour(state, fromIndex, toIndex)) return 0;
  
  const fromTube = state.tubes[fromIndex];
  const toTube = state.tubes[toIndex];
  
  const topCount = countTopColors(fromTube);
  const availableSpace = state.capacity - toTube.length;
  
  return Math.min(topCount, availableSpace);
}

/**
 * Execute a pour operation
 */
export function executePour(state, fromIndex, toIndex) {
  if (!canPour(state, fromIndex, toIndex)) return false;
  
  const amount = getPourAmount(state, fromIndex, toIndex);
  if (amount === 0) return false;
  
  const fromTube = state.tubes[fromIndex];
  const toTube = state.tubes[toIndex];
  const color = getTopColor(fromTube);
  
  // Remove from source
  for (let i = 0; i < amount; i++) {
    fromTube.pop();
  }
  
  // Add to target
  for (let i = 0; i < amount; i++) {
    toTube.push(color);
  }
  
  state.moves++;
  state.selectedTube = null;
  state.pourPreview = null;
  
  return true;
}

/**
 * Check if a tube is complete (all same color or empty)
 */
export function isTubeComplete(tube, capacity) {
  if (tube.length === 0) return true;
  if (tube.length !== capacity) return false;
  
  const color = tube[0];
  return tube.every(c => c === color);
}

/**
 * Check win condition (all tubes complete)
 */
export function checkWin(state) {
  return state.tubes.every(tube => isTubeComplete(tube, state.capacity));
}

/**
 * Count completed tubes
 */
export function countCompletedTubes(state) {
  return state.tubes.filter(tube => isTubeComplete(tube, state.capacity)).length;
}

/**
 * Count non-empty tubes
 */
export function countNonEmptyTubes(state) {
  return state.tubes.filter(tube => tube.length > 0).length;
}

/**
 * Get hint for next move
 */
export function getHint(state) {
  // If game is already won, no hint needed
  if (checkWin(state)) {
    return null;
  }

  // Find a valid move that makes progress
  for (let from = 0; from < state.tubes.length; from++) {
    const fromTube = state.tubes[from];
    if (fromTube.length === 0) continue;
    
    const topColor = getTopColor(fromTube);
    const topCount = countTopColors(fromTube);
    
    // Try to find a matching tube
    for (let to = 0; to < state.tubes.length; to++) {
      if (from === to) continue;
      
      const toTube = state.tubes[to];
      
      // Skip if can't pour
      if (!canPour(state, from, to)) continue;
      
      // Prefer pouring onto same color
      if (toTube.length > 0 && getTopColor(toTube) === topColor) {
        // Check if this move helps complete a tube
        const space = state.capacity - toTube.length;
        if (space >= topCount && toTube.every(c => c === topColor || c === undefined)) {
          return {
            from,
            to,
            message: `Pour ${topColor} from tube ${from + 1} to tube ${to + 1}`
          };
        }
      }
      
      // Empty tube as backup
      if (toTube.length === 0) {
        return {
          from,
          to,
          message: `Pour ${topColor} from tube ${from + 1} to empty tube ${to + 1}`
        };
      }
    }
  }
  
  return null;
}

/**
 * Calculate stars based on moves vs optimal
 */
export function calculateStars(moves, optimal) {
  if (moves <= optimal) return 3;
  if (moves <= optimal * 1.5) return 2;
  if (moves <= optimal * 2) return 1;
  return 0;
}

/**
 * Create undo history manager
 */
export function createHistory(maxSize = 50) {
  const history = [];
  let index = -1;
  
  return {
    push(state) {
      // Remove any future states
      history.splice(index + 1);
      history.push(cloneState(state));
      
      // Limit size
      if (history.length > maxSize) {
        history.shift();
      } else {
        index++;
      }
    },
    
    undo() {
      if (index > 0) {
        index--;
        return cloneState(history[index]);
      }
      return null;
    },
    
    canUndo() {
      return index > 0;
    },
    
    clear() {
      history.length = 0;
      index = -1;
    },
    
    get size() {
      return history.length;
    }
  };
}
