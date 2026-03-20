/**
 * Jelly Shift - State Management
 *
 * Pure functions for game state with:
 * - Blob shape (width/height with area preservation)
 * - Wall collision detection
 * - Speed escalation
 * - Score tracking
 */

import { History } from '../../shared/history.js';

// Shape constraints
export const MIN_WIDTH = 0.3;
export const MAX_WIDTH = 3.0;
export const BLOB_AREA = 1.0;
export const RESHAPE_SPEED = 8.0; // units per second

// Speed constants
export const BASE_SPEED = 2.0;
export const SPEED_INCREMENT = 0.0005; // per second of gameplay

// Collision margin
export const WALL_COLLISION_Z_THRESHOLD = 0.5;

/**
 * Create initial game state from level data
 */
export function createInitialState(level) {
  return {
    blob: {
      z: 0,
      width: 1.0,
      height: 1.0,
      targetWidth: 1.0
    },
    walls: level.walls.map(w => ({ ...w, passed: false })),
    speed: level.speed || BASE_SPEED,
    score: 0,
    status: 'running',
    time: 0,
    wallsPassed: 0,
    totalWalls: level.walls.length
  };
}

/**
 * Advance game state by delta time
 * Increments blob z position and escalates speed
 */
export function advance(state, dt) {
  if (state.status !== 'running') return state;

  const newSpeed = state.speed + SPEED_INCREMENT * dt;
  const newZ = state.blob.z + newSpeed * dt * 60;

  // Smoothly interpolate blob width toward target
  const widthDiff = state.blob.targetWidth - state.blob.width;
  const maxChange = RESHAPE_SPEED * dt;
  let newWidth;

  if (Math.abs(widthDiff) <= maxChange) {
    newWidth = state.blob.targetWidth;
  } else {
    newWidth = state.blob.width + Math.sign(widthDiff) * maxChange;
  }

  // Clamp width
  newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
  const newHeight = BLOB_AREA / newWidth;

  // Check if passed all walls
  if (state.walls.every(w => w.passed) || newZ >= (state.walls.length > 0 ? state.walls[state.walls.length - 1].z + 20 : 100)) {
    return {
      ...state,
      blob: { ...state.blob, z: newZ, width: newWidth, height: newHeight },
      speed: newSpeed,
      score: state.score + Math.floor(newZ),
      status: 'won',
      time: state.time + dt
    };
  }

  return {
    ...state,
    blob: { ...state.blob, z: newZ, width: newWidth, height: newHeight },
    speed: newSpeed,
    score: state.score + Math.floor(newSpeed * dt * 60),
    time: state.time + dt
  };
}

/**
 * Reshape blob by adjusting target width
 * Drag up (negative dy) = tall+narrow, drag down (positive dy) = wide+flat
 */
export function reshape(state, widthDelta) {
  if (state.status !== 'running') return state;

  const newTargetWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, state.blob.targetWidth + widthDelta));

  return {
    ...state,
    blob: {
      ...state.blob,
      targetWidth: newTargetWidth
    }
  };
}

/**
 * Check if a blob with given dimensions fits through a hole
 * Returns { fits: boolean, margin: number } where margin is the minimum clearance
 */
export function fitsHole(blobWidth, blobHeight, hole) {
  if (hole.shape === 'tall' || hole.shape === 'wide') {
    // Simple rectangular hole
    const widthFits = blobWidth <= hole.width;
    const heightFits = blobHeight <= hole.height;

    if (!widthFits || !heightFits) {
      return { fits: false, margin: 0 };
    }

    const marginW = hole.width - blobWidth;
    const marginH = hole.height - blobHeight;
    return { fits: true, margin: Math.min(marginW, marginH) };
  }

  if (hole.shape === 'plus') {
    // Compound shape: union of horizontal and vertical rectangles
    // Horizontal: widthH x heightH, centered
    // Vertical: widthV x heightV, centered
    const fitsH = blobWidth <= hole.widthH && blobHeight <= hole.heightH;
    const fitsV = blobWidth <= hole.widthV && blobHeight <= hole.heightV;

    if (fitsH || fitsV) {
      const margins = [];
      if (fitsH) margins.push(Math.min(hole.widthH - blobWidth, hole.heightH - blobHeight));
      if (fitsV) margins.push(Math.min(hole.widthV - blobWidth, hole.heightV - blobHeight));
      return { fits: true, margin: Math.max(...margins) };
    }

    return { fits: false, margin: 0 };
  }

  return { fits: false, margin: 0 };
}

/**
 * Check collision with a specific wall
 * Returns 'pass', 'fail', or 'none'
 */
export function checkWallCollision(state, wallIdx) {
  if (wallIdx < 0 || wallIdx >= state.walls.length) return 'none';
  const wall = state.walls[wallIdx];
  if (wall.passed) return 'none';

  // Check if blob has reached the wall
  if (state.blob.z < wall.z - WALL_COLLISION_Z_THRESHOLD) return 'none';

  const result = fitsHole(state.blob.width, state.blob.height, wall.hole);
  if (result.fits) {
    return 'pass';
  }
  return 'fail';
}

/**
 * Process wall pass
 */
export function passWall(state, wallIdx) {
  if (wallIdx < 0 || wallIdx >= state.walls.length) return state;

  const newWalls = [...state.walls];
  newWalls[wallIdx] = { ...newWalls[wallIdx], passed: true };

  return {
    ...state,
    walls: newWalls,
    wallsPassed: state.wallsPassed + 1,
    score: state.score + 100
  };
}

/**
 * Process wall fail (blob hits wall)
 */
export function failWall(state) {
  return {
    ...state,
    status: 'dead'
  };
}

/**
 * Check all walls for collisions
 * Returns array of wall indices that need processing
 */
export function checkAllCollisions(state) {
  const results = [];
  for (let i = 0; i < state.walls.length; i++) {
    const wall = state.walls[i];
    if (wall.passed) continue;
    if (state.blob.z >= wall.z - WALL_COLLISION_Z_THRESHOLD) {
      const collision = checkWallCollision(state, i);
      if (collision !== 'none') {
        results.push({ wallIdx: i, result: collision });
      }
    }
  }
  return results;
}

/**
 * Check if game is over
 */
export function isGameOver(state) {
  return state.status === 'dead' || state.status === 'won';
}

/**
 * Calculate stars based on score
 */
export function calculateStars(state) {
  const maxScore = state.totalWalls * 100 + Math.floor(state.walls[state.walls.length - 1]?.z || 100);
  const ratio = state.score / maxScore;
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

/**
 * Clone state for history
 */
export function cloneState(state) {
  return {
    blob: { ...state.blob },
    walls: state.walls.map(w => ({ ...w })),
    speed: state.speed,
    score: state.score,
    status: state.status,
    time: state.time,
    wallsPassed: state.wallsPassed,
    totalWalls: state.totalWalls
  };
}

/**
 * Create history manager
 */
export function createGameHistory(maxDepth = 50) {
  return new History(maxDepth);
}

/**
 * Validate level data
 */
export function validateLevel(level) {
  const errors = [];

  if (!level.id) errors.push('Missing id');
  if (!level.walls || !Array.isArray(level.walls)) errors.push('Missing walls array');

  if (level.walls) {
    level.walls.forEach((wall, i) => {
      if (wall.z === undefined) errors.push(`Wall ${i}: missing z`);
      if (!wall.hole) errors.push(`Wall ${i}: missing hole`);

      if (wall.hole) {
        if (!wall.hole.shape) errors.push(`Wall ${i}: missing hole.shape`);
        if (wall.hole.shape === 'tall' || wall.hole.shape === 'wide') {
          if (wall.hole.width === undefined) errors.push(`Wall ${i}: missing hole.width`);
          if (wall.hole.height === undefined) errors.push(`Wall ${i}: missing hole.height`);
        }
        if (wall.hole.shape === 'plus') {
          if (wall.hole.widthH === undefined) errors.push(`Wall ${i}: missing hole.widthH`);
          if (wall.hole.heightH === undefined) errors.push(`Wall ${i}: missing hole.heightH`);
          if (wall.hole.widthV === undefined) errors.push(`Wall ${i}: missing hole.widthV`);
          if (wall.hole.heightV === undefined) errors.push(`Wall ${i}: missing hole.heightV`);
        }
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

export default {
  MIN_WIDTH,
  MAX_WIDTH,
  BLOB_AREA,
  RESHAPE_SPEED,
  BASE_SPEED,
  SPEED_INCREMENT,
  WALL_COLLISION_Z_THRESHOLD,
  createInitialState,
  advance,
  reshape,
  fitsHole,
  checkWallCollision,
  passWall,
  failWall,
  checkAllCollisions,
  isGameOver,
  calculateStars,
  cloneState,
  createGameHistory,
  validateLevel
};
