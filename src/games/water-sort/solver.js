/**
 * Water Sort - BFS Solver
 *
 * Solver to verify levels are solvable and find optimal solution:
 * - Uses BFS to find shortest solution path
 * - Returns solvability status and number of moves
 */

/**
 * Check if a level is solvable using BFS
 * @param {Array} tubes - Initial tube state
 * @param {number} capacity - Tube capacity (default 4)
 * @param {number} maxMoves - Maximum moves to search (default 100)
 * @returns {Object} Result with solvable flag and moves
 */
export function isSolvable(tubes, capacity = 4, maxMoves = 100) {
  // Check if already won
  if (isWon(tubes, capacity)) {
    return { solvable: true, moves: 0 };
  }

  // BFS setup
  const queue = [{ state: tubes.map(t => [...t]), moves: 0 }];
  const visited = new Set();
  visited.add(stateToString(tubes));

  while (queue.length > 0 && queue[0].moves < maxMoves) {
    const current = queue.shift();
    const stateKey = stateToString(current.state);

    if (visited.has(stateKey)) continue;
    visited.add(stateKey);

    // Check win
    if (isWon(current.state, capacity)) {
      return { solvable: true, moves: current.moves };
    }

    // Generate all possible moves
    const moves = getValidMoves(current.state, capacity);

    for (const move of moves) {
      const newState = applyMove(current.state, move);
      const newStateKey = stateToString(newState);

      if (!visited.has(newStateKey)) {
        queue.push({ state: newState, moves: current.moves + 1 });
      }
    }
  }

  // No solution found
  return { solvable: false, moves: maxMoves };
}

/**
 * Check if state is won
 */
function isWon(tubes, capacity) {
  if (tubes.length === 0) return true;


  return tubes.every(tube => isTubeComplete(tube, capacity));
}

/**
 * Check if a tube is complete
 */
function isTubeComplete(tube, capacity) {
  if (tube.length === 0) return true;
  if (tube.length !== capacity) return false;
  return tube.every(color => color === tube[0]);
}
/**
 * Get all valid moves from current state
 */
function getValidMoves(tubes, capacity) {
  const moves = [];

  for (let from = 0; from < tubes.length; from++) {
    const fromTube = tubes[from];
    if (fromTube.length === 0) continue;

    const topColor = fromTube[fromTube.length - 1];
    const topCount = countTopColors(fromTube);
    const availableSpace = capacity - fromTube.length;

    for (let to = 0; to < tubes.length; to++) {
      if (from === to) continue;

      const toTube = tubes[to];
      if (toTube.length >= capacity) continue;

      const destTop = toTube.length > 0 ? toTube[toTube.length - 1] : null;
      if (destTop === null || destTop === topColor) {
        const amount = Math.min(topCount, capacity - toTube.length);
        if (amount > 0) {
          moves.push({ from, to, amount });
        }
      }
    }
  }

  return moves;
}

/**
 * Apply a move and return new state
 */
function applyMove(tubes, move) {
  const { from, to, amount } = move;
  const newState = tubes.map(t => [...t]);
  const color = newState[from][newState[from].length - 1];

  for (let i = 0; i < amount; i++) {
    newState[from].pop();
  }

  for (let i = 0; i < amount; i++) {
    newState[to].push(color);
  }

  return newState;
}

/**
 * Count consecutive top colors
 */
function countTopColors(tube) {
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
  }
  return count;
}
/**
 * Convert state to string for visited set
 */
function stateToString(tubes) {
  return tubes.map(t => t.join(',')).join('|');
}
