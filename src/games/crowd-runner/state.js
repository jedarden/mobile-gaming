/**
 * Crowd Runner - State Management
 *
 * Pure functions for game state. No DOM or rendering imports.
 *
 * State model:
 * {
 *   crowdSize: number,       // current crowd count (>= 1)
 *   position: number,        // z distance along course
 *   laneOffset: number,      // -1 (left) to 1 (right)
 *   courseLength: number,
 *   gates: Array<{z, left, right, crossed}>,
 *   boss: { z, size },
 *   speed: number,
 *   status: "running" | "won" | "lost",
 *   time: number
 * }
 */

export const LANE_MIN = -1;
export const LANE_MAX = 1;

/**
 * Create initial game state from level data
 */
export function createInitialState(level) {
  return {
    crowdSize: level.startingCrowd || 10,
    position: 0,
    laneOffset: 0,
    courseLength: level.courseLength || 500,
    gates: level.gates.map(g => ({ ...g, crossed: false })),
    boss: { z: level.courseLength || 500, size: level.boss.size },
    speed: level.speed || 2,
    status: 'running',
    time: 0
  };
}

/**
 * Apply a gate operation to crowd size.
 * Operations: +, −, ×, ÷
 * Result is floored at 1 (crowd can never reach 0).
 */
export function applyOperation(crowdSize, op) {
  let result;
  switch (op.op) {
    case '+':  result = crowdSize + op.value; break;
    case '−':  result = crowdSize - op.value; break;
    case '×':  result = crowdSize * op.value; break;
    case '÷':  result = Math.floor(crowdSize / op.value); break;
    default:   result = crowdSize;
  }
  return Math.max(1, result);
}

/**
 * Returns which side of a gate the crowd takes based on laneOffset.
 * laneOffset < 0 → 'left'; laneOffset >= 0 → 'right'
 */
export function getGateSide(laneOffset) {
  return laneOffset < 0 ? 'left' : 'right';
}

/**
 * Apply a single gate crossing to state (used for testing / external callers).
 */
export function crossGate(state, gateIdx, side) {
  const gate = state.gates[gateIdx];
  if (!gate || gate.crossed) return state;

  const op = side === 'left' ? gate.left : gate.right;
  const newCrowdSize = applyOperation(state.crowdSize, op);
  const newGates = state.gates.map((g, i) =>
    i === gateIdx ? { ...g, crossed: true } : g
  );

  return { ...state, crowdSize: newCrowdSize, gates: newGates };
}

/**
 * Advance game state by delta time (seconds).
 * Handles gate crossings and boss encounter.
 */
export function advance(state, dt) {
  if (state.status !== 'running') return state;

  const newPos = state.position + state.speed * dt * 60;
  const newTime = state.time + dt;
  const side = getGateSide(state.laneOffset);

  // Process gate crossings in z order
  let crowdSize = state.crowdSize;
  const gates = state.gates.map(gate => {
    if (!gate.crossed && newPos >= gate.z) {
      crowdSize = applyOperation(crowdSize, gate[side]);
      return { ...gate, crossed: true };
    }
    return gate;
  });

  // Check if reached boss
  if (newPos >= state.boss.z) {
    const won = crowdSize > state.boss.size;
    return {
      ...state,
      crowdSize,
      gates,
      position: state.boss.z,
      status: won ? 'won' : 'lost',
      time: newTime
    };
  }

  return { ...state, crowdSize, gates, position: newPos, time: newTime };
}

/**
 * Steer the crowd left or right.
 * delta is added to laneOffset, clamped to [-1, 1].
 */
export function steer(state, delta) {
  if (state.status !== 'running') return state;
  const newOffset = Math.max(LANE_MIN, Math.min(LANE_MAX, state.laneOffset + delta));
  return { ...state, laneOffset: newOffset };
}

/**
 * Set lane offset directly (from drag position).
 */
export function setLane(state, offset) {
  if (state.status !== 'running') return state;
  const clamped = Math.max(LANE_MIN, Math.min(LANE_MAX, offset));
  return { ...state, laneOffset: clamped };
}

export function isGameOver(state) {
  return state.status === 'won' || state.status === 'lost';
}

export function checkWin(state) {
  return state.status === 'won';
}

export function checkLose(state) {
  return state.status === 'lost';
}

/**
 * Stars: 3 if crowd >= 2× boss, 2 if >= 1.5×, 1 if > boss.
 */
export function calculateStars(crowdSize, bossSize) {
  const ratio = crowdSize / bossSize;
  if (ratio >= 2) return 3;
  if (ratio >= 1.5) return 2;
  return 1;
}

/**
 * Calculate crowd size after taking a specific path through gates.
 * path: array of 'left' | 'right' (one per gate).
 */
export function simulatePath(level, path) {
  let crowd = level.startingCrowd || 10;
  for (let i = 0; i < level.gates.length; i++) {
    const gate = level.gates[i];
    const side = path[i] || 'right';
    const op = gate[side];
    let result;
    switch (op.op) {
      case '+': result = crowd + op.value; break;
      case '−': result = crowd - op.value; break;
      case '×': result = crowd * op.value; break;
      case '÷': result = Math.floor(crowd / op.value); break;
      default:  result = crowd;
    }
    crowd = Math.max(1, result);
  }
  return crowd;
}

/**
 * Evaluate all 2^N gate combinations.
 * Returns { optimal, worst, allResults } where allResults is array of crowd sizes.
 */
export function evaluateAllPaths(level) {
  const n = level.gates.length;
  const allResults = [];
  let optimal = -Infinity;
  let worst = Infinity;

  for (let mask = 0; mask < (1 << n); mask++) {
    const path = [];
    for (let i = 0; i < n; i++) {
      path.push((mask >> i) & 1 ? 'right' : 'left');
    }
    const crowd = simulatePath(level, path);
    allResults.push(crowd);
    if (crowd > optimal) optimal = crowd;
    if (crowd < worst) worst = crowd;
  }

  return { optimal, worst, allResults };
}

export default {
  LANE_MIN,
  LANE_MAX,
  createInitialState,
  applyOperation,
  getGateSide,
  crossGate,
  advance,
  steer,
  setLane,
  isGameOver,
  checkWin,
  checkLose,
  calculateStars,
  simulatePath,
  evaluateAllPaths
};
