/**
 * Giant Runner - State Management
 *
 * Manages game state including:
 * - Player position and scale
 * - Collectibles and obstacles
 * - Boss fight logic
 * - Win/lose conditions
 */

import { History } from '../../shared/history.js';

// Player colors
export const PLAYER_COLORS = {
  blue: '#4DABF7',
  red: '#FF6B6B',
  green: '#69DB7C',
  yellow: '#FFD93D',
  purple: '#B197FC',
  orange: '#FFA94D'
};

// Collectible colors (wrong colors)
export const COLLECTIBLE_COLORS = {
  blue: '#4DABF7',
  red: '#FF6B6B',
  green: '#69DB7C',
  yellow: '#FFD93D',
  purple: '#B197FC',
  orange: '#FFA94D'
};

// Scale constants
export const MIN_SCALE = 0.1;
export const DEFAULT_START_SCALE = 1.0;

// Lane bounds
export const LANE_MIN = -2.5;
export const LANE_MAX = 2.5;

/**
 * Create initial game state from level data
 */
export function createInitialState(level) {
  return {
    player: {
      x: 0,
      z: 0,
      scale: level.startScale || DEFAULT_START_SCALE,
      color: level.playerColor || 'blue',
      renderScale: level.startScale || DEFAULT_START_SCALE
    },
    courseLength: level.courseLength || 400,
    collectibles: level.collectibles.map(c => ({ ...c, collected: false })),
    obstacles: level.obstacles ? level.obstacles.map(o => ({ ...o, hit: false })) : [],
    boss: { ...level.boss },
    speed: level.speed || 3,
    status: 'running',
    time: 0
  };
}

/**
 * Advance game state by delta time
 * Returns updated state with player z position incremented
 */
export function advance(state, dt) {
  if (state.status !== 'running') return state;

  const newZ = state.player.z + state.speed * dt * 60;

  // Check if reached boss
  if (newZ >= state.boss.z) {
    return {
      ...state,
      player: { ...state.player, z: state.boss.z },
      status: 'boss_fight',
      time: state.time + dt
    };
  }

  return {
    ...state,
    player: { ...state.player, z: newZ },
    time: state.time + dt
  };
}

/**
 * Collect a collectible
 * Matching color: +value to scale
 * Wrong color: -value to scale (floor at MIN_SCALE)
 */
export function collect(state, collectibleIdx) {
  if (collectibleIdx < 0 || collectibleIdx >= state.collectibles.length) return state;

  const collectible = state.collectibles[collectibleIdx];
  if (collectible.collected) return state;

  let scaleDelta = collectible.value;
  if (collectible.color !== state.player.color) {
    // Wrong color - negate the value (treat as penalty)
    scaleDelta = -Math.abs(collectible.value);
  }

  const newScale = Math.max(MIN_SCALE, state.player.scale + scaleDelta);

  const newCollectibles = [...state.collectibles];
  newCollectibles[collectibleIdx] = { ...collectible, collected: true };

  return {
    ...state,
    player: {
      ...state.player,
      scale: newScale
    },
    collectibles: newCollectibles
  };
}

/**
 * Hit an obstacle
 * Reduces scale by 0.2 (floor at MIN_SCALE)
 */
export function hitObstacle(state, obstacleIdx) {
  if (!state.obstacles || obstacleIdx < 0 || obstacleIdx >= state.obstacles.length) return state;

  const obstacle = state.obstacles[obstacleIdx];
  if (obstacle.hit) return state;

  const newScale = Math.max(MIN_SCALE, state.player.scale - 0.2);

  const newObstacles = state.obstacles.map((o, i) =>
    i === obstacleIdx ? { ...o, hit: true } : o
  );

  return {
    ...state,
    player: {
      ...state.player,
      scale: newScale
    },
    obstacles: newObstacles
  };
}

/**
 * Start boss fight (transition to boss_fight status)
 */
export function startBoss(state) {
  if (state.status !== 'running') return state;

  return {
    ...state,
    status: 'boss_fight'
  };
}

/**
 * Resolve boss fight
 * Player wins if player.scale > boss.scale
 */
export function resolveBoss(state) {
  if (state.status !== 'boss_fight') return state;

  const won = state.player.scale > state.boss.scale;

  return {
    ...state,
    status: won ? 'won' : 'lost'
  };
}

/**
 * Steer player left or right
 * xDelta is the change in x position
 */
export function steer(state, xDelta) {
  if (state.status !== 'running') return state;

  const newX = Math.max(LANE_MIN, Math.min(LANE_MAX, state.player.x + xDelta));

  return {
    ...state,
    player: {
      ...state.player,
      x: newX
    }
  };
}

/**
 * Check for collisions with collectibles
 * Returns indices of collectibles that should be collected
 */
export function checkCollectibleCollisions(state) {
  const collisions = [];
  const playerRadius = 0.5 * state.player.scale;
  const collectRadius = 0.3;

  state.collectibles.forEach((collectible, idx) => {
    if (collectible.collected) return;

    // Check if player z has passed collectible z (within collision window)
    const zDiff = Math.abs(state.player.z - collectible.z);
    const xDiff = Math.abs(state.player.x - collectible.x);

    if (zDiff < (playerRadius + collectRadius) && xDiff < (playerRadius + collectRadius)) {
      collisions.push(idx);
    }
  });

  return collisions;
}

/**
 * Check for collisions with obstacles
 * Returns indices of obstacles that should be hit
 */
export function checkObstacleCollisions(state) {
  if (!state.obstacles) return [];

  const collisions = [];
  const playerRadius = 0.5 * state.player.scale;

  state.obstacles.forEach((obstacle, idx) => {
    if (obstacle.hit) return;

    const zDiff = Math.abs(state.player.z - obstacle.z);
    const xDiff = Math.abs(state.player.x - obstacle.x);
    const obstacleHalfWidth = obstacle.width / 2;

    if (zDiff < playerRadius && xDiff < (playerRadius + obstacleHalfWidth)) {
      collisions.push(idx);
    }
  });

  return collisions;
}

/**
 * Check if level is complete
 */
export function checkWin(state) {
  return state.status === 'won';
}

/**
 * Check if level is lost
 */
export function checkLose(state) {
  return state.status === 'lost';
}

/**
 * Check if game is over (won or lost)
 */
export function isGameOver(state) {
  return state.status === 'won' || state.status === 'lost';
}

/**
 * Calculate stars based on final scale vs boss scale
 */
export function calculateStars(playerScale, bossScale) {
  const ratio = playerScale / bossScale;
  if (ratio >= 1.5) return 3;
  if (ratio >= 1.2) return 2;
  return 1;
}

/**
 * Clone state for history
 */
export function cloneState(state) {
  return {
    player: { ...state.player },
    courseLength: state.courseLength,
    collectibles: state.collectibles.map(c => ({ ...c })),
    obstacles: state.obstacles ? state.obstacles.map(o => ({ ...o })) : [],
    boss: { ...state.boss },
    speed: state.speed,
    status: state.status,
    time: state.time
  };
}

/**
 * Create history manager
 */
export function createGameHistory(maxDepth = 50) {
  return new History(maxDepth);
}

export default {
  PLAYER_COLORS,
  COLLECTIBLE_COLORS,
  MIN_SCALE,
  DEFAULT_START_SCALE,
  LANE_MIN,
  LANE_MAX,
  createInitialState,
  advance,
  collect,
  hitObstacle,
  startBoss,
  resolveBoss,
  steer,
  checkCollectibleCollisions,
  checkObstacleCollisions,
  checkWin,
  checkLose,
  isGameOver,
  calculateStars,
  cloneState,
  createGameHistory
};
