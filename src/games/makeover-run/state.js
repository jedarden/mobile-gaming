/**
 * Makeover Run - State Management
 *
 * Pure functions for game state. No DOM or rendering imports.
 *
 * State model:
 * {
 *   x: number,              // lateral position, -1 (left) to 1 (right)
 *   z: number,              // forward progress along course
 *   appearance: {
 *     hair: 0-3,            // 0 = messy, 3 = perfect
 *     outfit: 0-3,          // 0 = torn, 3 = elegant
 *     makeup: 0-3,          // 0 = none, 3 = full glam
 *     accessories: 0-3      // 0 = none, 3 = fully accessorized
 *   },
 *   score: number,          // sum of appearance values (0–12)
 *   maxScore: 12,
 *   courseLength: number,
 *   stations: Array<Station>,
 *   speed: number,
 *   status: "running" | "judging" | "complete",
 *   stars: number           // set when status === "complete"
 * }
 *
 * Station (positive):
 *   { z, x, type: "hair"|"outfit"|"makeup"|"accessories", upgrade: 1-3, positive: true }
 *
 * Station (negative):
 *   { z, x, type: "mud", downgrade: "hair"|..., amount: 1-3, positive: false }
 */

export const LANE_MIN = -1;
export const LANE_MAX = 1;
export const HIT_THRESHOLD = 0.7;
export const CATEGORIES = ['hair', 'outfit', 'makeup', 'accessories'];
export const MAX_PER_CATEGORY = 3;
export const MAX_SCORE = CATEGORIES.length * MAX_PER_CATEGORY; // 12

/**
 * Create initial game state from level data.
 */
export function createInitialState(level) {
  return {
    x: 0,
    z: 0,
    appearance: { hair: 0, outfit: 0, makeup: 0, accessories: 0 },
    score: 0,
    maxScore: MAX_SCORE,
    courseLength: level.courseLength || 300,
    stations: level.stations.map(s => ({ ...s, triggered: false })),
    speed: level.speed || 2,
    status: 'running',
    stars: 0
  };
}

/**
 * Apply a single station effect to state.
 * Positive: set category to max(current, station.upgrade) — never downgrades.
 * Negative: reduce category by amount, floor at 0.
 */
export function hitStation(state, stationIdx) {
  const station = state.stations[stationIdx];
  if (!station || station.triggered) return state;

  const appearance = { ...state.appearance };

  if (station.positive) {
    const cat = station.type;
    appearance[cat] = Math.min(MAX_PER_CATEGORY, Math.max(appearance[cat], station.upgrade));
  } else {
    const cat = station.downgrade || station.type;
    appearance[cat] = Math.max(0, appearance[cat] - (station.amount || 1));
  }

  const score = CATEGORIES.reduce((sum, cat) => sum + appearance[cat], 0);
  const stations = state.stations.map((s, i) =>
    i === stationIdx ? { ...s, triggered: true } : s
  );

  return { ...state, appearance, score, stations };
}

/**
 * Steer the character left or right.
 * delta is added to x, clamped to [-1, 1].
 */
export function steer(state, delta) {
  if (state.status !== 'running') return state;
  const newX = Math.max(LANE_MIN, Math.min(LANE_MAX, state.x + delta));
  return { ...state, x: newX };
}

/**
 * Set character x position directly (from drag).
 */
export function setX(state, x) {
  if (state.status !== 'running') return state;
  return { ...state, x: Math.max(LANE_MIN, Math.min(LANE_MAX, x)) };
}

/**
 * Advance game state by delta time (seconds).
 * Handles station hits and course completion.
 */
export function advance(state, dt) {
  if (state.status !== 'running') return state;

  const newZ = state.z + state.speed * dt * 60;
  let current = { ...state, z: newZ };

  // Process station hits in z order
  for (let idx = 0; idx < state.stations.length; idx++) {
    const station = current.stations[idx];
    if (!station.triggered && newZ >= station.z) {
      if (Math.abs(current.x - station.x) < HIT_THRESHOLD) {
        current = hitStation(current, idx);
      } else {
        // Mark as passed without hit
        const stations = current.stations.map((s, i) =>
          i === idx ? { ...s, triggered: true } : s
        );
        current = { ...current, stations };
      }
    }
  }

  // Check course complete
  if (newZ >= current.courseLength) {
    return { ...current, z: current.courseLength, status: 'judging' };
  }

  return current;
}

/**
 * Finalize judging: calculate stars and transition to 'complete'.
 * Called by game.js when the judging overlay is done.
 */
export function judge(state) {
  if (state.status !== 'judging') return state;
  const stars = calculateStars(state.score, state.maxScore);
  return { ...state, status: 'complete', stars };
}

/**
 * Calculate star rating from score/maxScore.
 * < 33%: 1 star, 33–66%: 2 stars, ≥ 67%: 3 stars
 */
export function calculateStars(score, maxScore) {
  const pct = score / maxScore;
  if (pct >= 0.67) return 3;
  if (pct >= 0.33) return 2;
  return 1;
}

export function isRunning(state)  { return state.status === 'running'; }
export function isJudging(state)  { return state.status === 'judging'; }
export function isGameOver(state) { return state.status === 'complete'; }

/**
 * Simulate following a specific path through the level.
 * pathChoices: array of x values (-1 or 1), one per unique z group (sorted ascending).
 * Returns { score, stars, appearance }.
 */
export function simulatePath(level, pathChoices) {
  const appearance = { hair: 0, outfit: 0, makeup: 0, accessories: 0 };
  const zSet = [...new Set(level.stations.map(s => s.z))].sort((a, b) => a - b);

  for (let i = 0; i < zSet.length; i++) {
    const z = zSet[i];
    const playerX = pathChoices[i] !== undefined ? pathChoices[i] : 0;
    const stationsAtZ = level.stations.filter(s => s.z === z);

    stationsAtZ.forEach(station => {
      if (Math.abs(playerX - station.x) < HIT_THRESHOLD) {
        if (station.positive) {
          const cat = station.type;
          appearance[cat] = Math.min(MAX_PER_CATEGORY, Math.max(appearance[cat], station.upgrade));
        } else {
          const cat = station.downgrade || station.type;
          appearance[cat] = Math.max(0, appearance[cat] - (station.amount || 1));
        }
      }
    });
  }

  const score = CATEGORIES.reduce((sum, cat) => sum + appearance[cat], 0);
  return { score, stars: calculateStars(score, MAX_SCORE), appearance };
}

/**
 * Build optimal path choices: steer to each positive station's x.
 */
export function optimalPath(level) {
  const zSet = [...new Set(level.stations.map(s => s.z))].sort((a, b) => a - b);
  return zSet.map(z => {
    const pos = level.stations.find(s => s.z === z && s.positive);
    return pos ? pos.x : 0;
  });
}

/**
 * Build worst path choices: steer to each negative station's x.
 */
export function worstPath(level) {
  const zSet = [...new Set(level.stations.map(s => s.z))].sort((a, b) => a - b);
  return zSet.map(z => {
    const neg = level.stations.find(s => s.z === z && !s.positive);
    return neg ? neg.x : 0;
  });
}

export default {
  LANE_MIN, LANE_MAX, HIT_THRESHOLD, CATEGORIES, MAX_PER_CATEGORY, MAX_SCORE,
  createInitialState, hitStation, steer, setX, advance, judge,
  calculateStars, isRunning, isJudging, isGameOver,
  simulatePath, optimalPath, worstPath
};
