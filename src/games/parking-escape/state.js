/**
 * Parking Escape - State Management
 *
 * Pure functions for game state. No DOM or rendering imports.
 *
 * Vehicles slide along their fixed axis (horizontal vehicles move left/right,
 * vertical vehicles move up/down). The hero vehicle must reach the exit.
 *
 * Grid origin: top-left (0, 0). x increases right, y increases down.
 */

/**
 * Create initial game state from level data.
 *
 * @param {Object} level - Level definition
 * @returns {Object} Game state
 */
export function createInitialState(level) {
  const { grid } = level;
  return {
    grid: {
      width: grid.width,
      height: grid.height,
      exit: { ...grid.exit }
    },
    vehicles: grid.vehicles.map(v => ({ ...v })),
    moves: 0,
    status: 'playing'
  };
}

/**
 * Build a 2D occupied map: occ[y][x] = vehicleId or null.
 *
 * @param {Object} state
 * @returns {Array[][]} 2D array
 */
export function buildOccupied(state) {
  const { width, height } = state.grid;
  const occ = Array.from({ length: height }, () => Array(width).fill(null));
  for (const v of state.vehicles) {
    if (v.orientation === 'horizontal') {
      for (let dx = 0; dx < v.width; dx++) {
        if (v.x + dx < width) occ[v.y][v.x + dx] = v.id;
      }
    } else {
      for (let dy = 0; dy < v.height; dy++) {
        if (v.y + dy < height) occ[v.y + dy][v.x] = v.id;
      }
    }
  }
  return occ;
}

/**
 * Get valid moves for a single vehicle.
 *
 * @param {Object} state
 * @param {string} vehicleId
 * @returns {Array} [{direction, distance}]
 */
export function getVehicleMoves(state, vehicleId) {
  const occ = buildOccupied(state);
  const { width, height } = state.grid;
  const v = state.vehicles.find(veh => veh.id === vehicleId);
  if (!v) return [];

  const moves = [];
  if (v.orientation === 'horizontal') {
    for (let d = 1; d <= v.x; d++) {
      if (occ[v.y][v.x - d] !== null) break;
      moves.push({ direction: 'left', distance: d });
    }
    for (let d = 1; v.x + v.width - 1 + d < width; d++) {
      if (occ[v.y][v.x + v.width - 1 + d] !== null) break;
      moves.push({ direction: 'right', distance: d });
    }
  } else {
    for (let d = 1; d <= v.y; d++) {
      if (occ[v.y - d][v.x] !== null) break;
      moves.push({ direction: 'up', distance: d });
    }
    for (let d = 1; v.y + v.height - 1 + d < height; d++) {
      if (occ[v.y + v.height - 1 + d][v.x] !== null) break;
      moves.push({ direction: 'down', distance: d });
    }
  }
  return moves;
}

/**
 * Get all valid moves across all vehicles.
 *
 * @param {Object} state
 * @returns {Array} [{vehicleId, direction, distance}]
 */
export function getAllMoves(state) {
  const moves = [];
  for (const v of state.vehicles) {
    for (const m of getVehicleMoves(state, v.id)) {
      moves.push({ vehicleId: v.id, ...m });
    }
  }
  return moves;
}

/**
 * Apply a move to game state.
 *
 * @param {Object} state
 * @param {string} vehicleId
 * @param {string} direction - 'left'|'right'|'up'|'down'
 * @param {number} distance
 * @returns {Object} New state
 */
export function applyMove(state, vehicleId, direction, distance) {
  const vehicles = state.vehicles.map(v => {
    if (v.id !== vehicleId) return v;
    const u = { ...v };
    if (direction === 'left')  u.x = v.x - distance;
    if (direction === 'right') u.x = v.x + distance;
    if (direction === 'up')    u.y = v.y - distance;
    if (direction === 'down')  u.y = v.y + distance;
    return u;
  });
  const next = { ...state, vehicles, moves: state.moves + 1 };
  return checkWin(next) ? { ...next, status: 'won' } : next;
}

/**
 * Check if the hero can slide to the exit.
 *
 * @param {Object} state
 * @returns {boolean}
 */
export function checkWin(state) {
  const hero = state.vehicles.find(v => v.type === 'hero');
  if (!hero) return false;
  const { exit, width, height } = state.grid;
  const occ = buildOccupied(state);
  const dir = exit.direction || 'right';

  if (dir === 'right') {
    if (hero.y !== exit.y) return false;
    for (let x = hero.x + hero.width; x < width; x++) {
      if (occ[hero.y][x] !== null) return false;
    }
    return true;
  }
  if (dir === 'left') {
    if (hero.y !== exit.y) return false;
    for (let x = 0; x < hero.x; x++) {
      if (occ[hero.y][x] !== null) return false;
    }
    return true;
  }
  if (dir === 'down') {
    if (hero.x !== exit.x) return false;
    for (let y = hero.y + hero.height; y < height; y++) {
      if (occ[y][hero.x] !== null) return false;
    }
    return true;
  }
  if (dir === 'up') {
    if (hero.x !== exit.x) return false;
    for (let y = 0; y < hero.y; y++) {
      if (occ[y][hero.x] !== null) return false;
    }
    return true;
  }
  return false;
}

/**
 * BFS solver: find minimum move count to win.
 * Works entirely with vehicle positions (orientation is fixed per vehicle).
 *
 * @param {Object} level - Level definition (grid + vehicles)
 * @param {number} maxMoves - BFS depth limit (default 40)
 * @returns {{ cost: number, path: Array }|null}
 */
export function solve(level, _maxMoves = 40) {
  const vehicles = level.grid.vehicles;
  const width = level.grid.width;
  const height = level.grid.height;
  const exit = level.grid.exit;
  const exitDir = exit.direction || 'right';

  // Positions array: positions[i] = x for horizontal, y for vertical
  const initPos = vehicles.map(v => v.orientation === 'horizontal' ? v.x : v.y);

  function buildOcc(pos) {
    const occ = Array.from({ length: height }, () => Array(width).fill(-1));
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (v.orientation === 'horizontal') {
        for (let dx = 0; dx < v.width; dx++) {
          const cx = pos[i] + dx;
          if (cx >= 0 && cx < width) occ[v.y][cx] = i;
        }
      } else {
        for (let dy = 0; dy < v.height; dy++) {
          const cy = pos[i] + dy;
          if (cy >= 0 && cy < height) occ[cy][v.x] = i;
        }
      }
    }
    return occ;
  }

  function isWon(pos) {
    const hi = vehicles.findIndex(v => v.type === 'hero');
    if (hi < 0) return false;
    const hv = vehicles[hi];
    const hp = pos[hi];
    const occ = buildOcc(pos);
    if (exitDir === 'right') {
      if (hv.y !== exit.y) return false;
      for (let x = hp + hv.width; x < width; x++) {
        if (occ[hv.y][x] !== -1) return false;
      }
      return true;
    }
    if (exitDir === 'left') {
      if (hv.y !== exit.y) return false;
      for (let x = 0; x < hp; x++) {
        if (occ[hv.y][x] !== -1) return false;
      }
      return true;
    }
    if (exitDir === 'down') {
      if (hv.x !== exit.x) return false;
      for (let y = hp + hv.height; y < height; y++) {
        if (occ[y][hv.x] !== -1) return false;
      }
      return true;
    }
    if (exitDir === 'up') {
      if (hv.x !== exit.x) return false;
      for (let y = 0; y < hp; y++) {
        if (occ[y][hv.x] !== -1) return false;
      }
      return true;
    }
    return false;
  }

  function getMoves(pos) {
    const occ = buildOcc(pos);
    const moves = [];
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const p = pos[i];
      if (v.orientation === 'horizontal') {
        for (let d = 1; d <= p; d++) {
          if (occ[v.y][p - d] !== -1) break;
          moves.push({ i, delta: -d });
        }
        for (let d = 1; p + v.width - 1 + d < width; d++) {
          if (occ[v.y][p + v.width - 1 + d] !== -1) break;
          moves.push({ i, delta: d });
        }
      } else {
        for (let d = 1; d <= p; d++) {
          if (occ[p - d][v.x] !== -1) break;
          moves.push({ i, delta: -d });
        }
        for (let d = 1; p + v.height - 1 + d < height; d++) {
          if (occ[p + v.height - 1 + d][v.x] !== -1) break;
          moves.push({ i, delta: d });
        }
      }
    }
    return moves;
  }

  if (isWon(initPos)) return { cost: 0, path: [] };

  const initKey = initPos.join(',');
  // BFS: store parent info for path reconstruction
  const visited = new Map([[initKey, null]]); // key → {parentKey, move} or null for root
  const queue = [initPos];
  const MAX_STATES = 500000;

  while (queue.length > 0 && visited.size < MAX_STATES) {
    const pos = queue.shift();
    const posKey = pos.join(',');

    for (const move of getMoves(pos)) {
      const newPos = [...pos];
      newPos[move.i] += move.delta;
      const newKey = newPos.join(',');
      if (visited.has(newKey)) continue;

      const v = vehicles[move.i];
      const isHoriz = v.orientation === 'horizontal';
      const dir = move.delta < 0 ? (isHoriz ? 'left' : 'up') : (isHoriz ? 'right' : 'down');
      const dist = Math.abs(move.delta);
      const moveRecord = { vehicleId: v.id, direction: dir, distance: dist };

      visited.set(newKey, { parentKey: posKey, move: moveRecord });

      if (isWon(newPos)) {
        // Reconstruct path
        const path = [];
        let cur = newKey;
        while (visited.get(cur) !== null) {
          const { parentKey, move: m } = visited.get(cur);
          path.unshift(m);
          cur = parentKey;
        }
        return { cost: path.length, path };
      }

      queue.push(newPos);
    }
  }

  return null;
}

export default {
  createInitialState,
  buildOccupied,
  getVehicleMoves,
  getAllMoves,
  applyMove,
  checkWin,
  solve
};
