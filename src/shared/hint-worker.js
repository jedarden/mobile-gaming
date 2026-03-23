/**
 * Hint Worker
 *
 * Runs game-specific solvers in a Web Worker to avoid blocking the main thread.
 *
 * Message in:  { gameId: string, state: Object, level: Object }
 * Message out: { moves: Array } or { error: string }
 *
 * Supported games:
 *   - 'parking-escape': BFS solver, returns [{vehicleId, direction, distance}]
 *   - 'water-sort':     BFS solver, returns [{from, to}]
 *   - 'pull-the-pin':   BFS over pin removals, returns [{pinId}]
 *   - 'brain-teaser':   reads solution from level, returns [{action, targetId}]
 *   - 'merge-games':    greedy best-merge, returns [{r1, c1, r2, c2}]
 */

// ─── Parking Escape Solver ────────────────────────────────────────────────────

function solveParking(state) {
  // Reconstruct a level-like object from the current state (vehicles at current positions)
  const level = {
    grid: {
      width: state.grid.width,
      height: state.grid.height,
      vehicles: state.vehicles.map(v => ({ ...v })),
      exit: { ...state.grid.exit }
    }
  };

  // BFS over vehicle positions
  const GRID = level.grid.width;
  const EXIT_Y = level.grid.exit.y;
  const EXIT_X = level.grid.exit.x ?? GRID;
  const MAX_MOVES = 40;

  function buildKey(vehicles) {
    return vehicles.map(v => `${v.id}:${v.x},${v.y}`).sort().join('|');
  }

  function buildOcc(vehicles, _w, _h) {
    const occ = {};
    for (const v of vehicles) {
      if (v.orientation === 'horizontal') {
        for (let dx = 0; dx < v.width; dx++) occ[`${v.y},${v.x + dx}`] = v.id;
      } else {
        for (let dy = 0; dy < v.height; dy++) occ[`${v.y + dy},${v.x}`] = v.id;
      }
    }
    return occ;
  }

  function getMoves(vehicles, gridW, gridH) {
    const occ = buildOcc(vehicles, gridW, gridH);
    const moves = [];
    for (const v of vehicles) {
      if (v.orientation === 'horizontal') {
        for (let d = 1; v.x + v.width - 1 + d < gridW; d++) {
          if (occ[`${v.y},${v.x + v.width - 1 + d}`]) break;
          moves.push({ vehicleId: v.id, direction: 'right', distance: d });
        }
        for (let d = 1; v.x - d >= 0; d++) {
          if (occ[`${v.y},${v.x - d}`]) break;
          moves.push({ vehicleId: v.id, direction: 'left', distance: d });
        }
      } else {
        for (let d = 1; v.y + v.height - 1 + d < gridH; d++) {
          if (occ[`${v.y + v.height - 1 + d},${v.x}`]) break;
          moves.push({ vehicleId: v.id, direction: 'down', distance: d });
        }
        for (let d = 1; v.y - d >= 0; d++) {
          if (occ[`${v.y - d},${v.x}`]) break;
          moves.push({ vehicleId: v.id, direction: 'up', distance: d });
        }
      }
    }
    return moves;
  }

  function applyMove(vehicles, move) {
    return vehicles.map(v => {
      if (v.id !== move.vehicleId) return v;
      const nv = { ...v };
      if (move.direction === 'right') nv.x += move.distance;
      else if (move.direction === 'left') nv.x -= move.distance;
      else if (move.direction === 'down') nv.y += move.distance;
      else if (move.direction === 'up') nv.y -= move.distance;
      return nv;
    });
  }

  function isWon(vehicles) {
    const hero = vehicles.find(v => v.type === 'hero');
    if (!hero) return false;
    return hero.x + hero.width >= EXIT_X && hero.y === EXIT_Y;
  }

  const initVehicles = level.grid.vehicles;
  if (isWon(initVehicles)) return [];

  const queue = [{ vehicles: initVehicles, path: [] }];
  const visited = new Set([buildKey(initVehicles)]);

  while (queue.length > 0) {
    const { vehicles, path } = queue.shift();
    if (path.length >= MAX_MOVES) continue;

    for (const move of getMoves(vehicles, GRID, GRID)) {
      const next = applyMove(vehicles, move);
      const key = buildKey(next);
      if (visited.has(key)) continue;
      visited.add(key);

      const newPath = [...path, move];
      if (isWon(next)) return newPath;
      queue.push({ vehicles: next, path: newPath });
    }
  }

  return null;
}

// ─── Water Sort Solver ────────────────────────────────────────────────────────

function solveWaterSort(state) {
  const { tubes, maxSegments } = state;

  function topColor(tube) { return tube.length > 0 ? tube[tube.length - 1] : null; }
  function topGroupSize(tube) {
    if (!tube.length) return 0;
    const c = tube[tube.length - 1];
    let n = 0;
    for (let i = tube.length - 1; i >= 0; i--) { if (tube[i] === c) n++; else break; }
    return n;
  }
  function isFull(tube) { return tube.length === maxSegments; }
  function isSingleColor(tube) { return tube.length > 0 && tube.every(s => s === tube[0]); }

  function isWon(ts) {
    return ts.every(t => t.length === 0 || (isFull(t) && isSingleColor(t)));
  }

  function canPour(ts, from, to) {
    if (from === to) return false;
    const f = ts[from], t = ts[to];
    if (f.length === 0) return false;
    if (isFull(t)) return false;
    if (isSingleColor(f) && isFull(f)) return false; // already complete
    const ft = topColor(f), tt = topColor(t);
    if (tt !== null && tt !== ft) return false;
    return true;
  }

  function applyPour(ts, from, to) {
    const result = ts.map(t => [...t]);
    const group = topGroupSize(result[from]);
    const space = maxSegments - result[to].length;
    const count = Math.min(group, space);
    const moved = result[from].splice(result[from].length - count, count);
    result[to].push(...moved);
    return result;
  }

  function keyOf(ts) { return ts.map(t => t.join(',')).join('|'); }

  if (isWon(tubes)) return [];

  const queue = [{ tubes, path: [] }];
  const visited = new Set([keyOf(tubes)]);

  while (queue.length > 0) {
    const { tubes: cur, path } = queue.shift();
    if (path.length > 200) continue;

    for (let from = 0; from < cur.length; from++) {
      for (let to = 0; to < cur.length; to++) {
        if (!canPour(cur, from, to)) continue;
        const next = applyPour(cur, from, to);
        const key = keyOf(next);
        if (visited.has(key)) continue;
        visited.add(key);
        const newPath = [...path, { from, to }];
        if (isWon(next)) return newPath;
        queue.push({ tubes: next, path: newPath });
      }
    }
  }

  return null;
}

// ─── Pull the Pin Solver ──────────────────────────────────────────────────────

function solvePullThePin(state) {
  // Return the IDs of unpulled pins in the order they should be removed
  const remainingPins = (state.pins || []).filter(p => !p.removed);
  if (remainingPins.length === 0) return [];

  // Simple heuristic: suggest removing the pin that unblocks the most channels
  // A full BFS would be expensive; for hints we provide one-step guidance
  const channelsByPin = {};
  for (const channel of (state.channels || [])) {
    if (channel.blockedByPin) {
      const pid = channel.blockedByPin;
      channelsByPin[pid] = (channelsByPin[pid] || 0) + 1;
    }
  }

  // Sort pins by how many channels they block (most-blocking first)
  const sorted = [...remainingPins].sort((a, b) => {
    return (channelsByPin[b.id] || 0) - (channelsByPin[a.id] || 0);
  });

  return sorted.map(p => ({ pinId: p.id }));
}

// ─── Merge Games Solver ───────────────────────────────────────────────────────

function solveMergeGames(state) {
  const { grid, width, height, task } = state;
  if (!task) return null;

  const targetTier = task.targetTier;
  const pairs = [];

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!grid[r][c]) continue;
      const tier = grid[r][c];
      // Right neighbor
      if (c + 1 < width && grid[r][c + 1] === tier) {
        pairs.push({ r1: r, c1: c, r2: r, c2: c + 1, resultTier: tier + 1 });
      }
      // Down neighbor
      if (r + 1 < height && grid[r + 1][c] === tier) {
        pairs.push({ r1: r, c1: c, r2: r + 1, c2: c, resultTier: tier + 1 });
      }
    }
  }

  if (pairs.length === 0) return null;

  // Prefer the merge that produces the result closest to (but not exceeding) targetTier
  pairs.sort((a, b) => {
    const distA = Math.abs(a.resultTier - targetTier);
    const distB = Math.abs(b.resultTier - targetTier);
    if (distA !== distB) return distA - distB;
    // Among equal distances, prefer higher resulting tier
    return b.resultTier - a.resultTier;
  });

  const best = pairs[0];
  return [{ r1: best.r1, c1: best.c1, r2: best.r2, c2: best.c2 }];
}

// ─── Brain Teaser ─────────────────────────────────────────────────────────────

function solveBrainTeaser(level) {
  if (!level || !level.solution) return null;
  return [level.solution];
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

self.onmessage = function ({ data }) {
  const { gameId, state, level } = data;

  try {
    let moves = null;

    switch (gameId) {
      case 'parking-escape':
        moves = solveParking(state);
        break;
      case 'water-sort':
        moves = solveWaterSort(state);
        break;
      case 'pull-the-pin':
        moves = solvePullThePin(state);
        break;
      case 'brain-teaser':
        moves = solveBrainTeaser(level);
        break;
      case 'merge-games':
        moves = solveMergeGames(state);
        break;
      default:
        self.postMessage({ error: `No solver for game: ${gameId}` });
        return;
    }

    if (moves === null) {
      self.postMessage({ error: 'Solver could not find a solution' });
    } else {
      self.postMessage({ moves });
    }
  } catch (err) {
    self.postMessage({ error: err.message });
  }
};
