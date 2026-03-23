/**
 * Pull the Pin - State Management
 *
 * Pure functions for pin-removal physics puzzle:
 * - Pin and ball management
 * - Physics simulation (gravity, collision)
 * - Win/lose condition checking
 */

// Physics constants
export const GRAVITY = 0.3;
export const DAMPING = 0.7;
export const DT = 1 / 60;
export const MAX_TICKS = 2000;
export const BALL_RADIUS = 12;
export const PRECISION = 2; // Decimal places for deterministic physics

/**
 * Round a number to specified decimal places for deterministic physics
 */
function roundTo(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Create initial game state from level data
 *
 * @param {Object} level - Level definition
 * @returns {Object} Initial game state
 */
export function createInitialState(level) {
  return {
    pins: level.pins.map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      removed: false,
      removing: false
    })),
    balls: level.balls.map(b => ({
      id: b.id,
      x: b.x,
      y: b.y,
      vx: 0,
      vy: 0,
      color: b.color,
      settled: false,
      lost: false,
      cupId: null
    })),
    cups: level.cups.map(c => ({
      id: c.id,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height || 60,
      acceptColor: c.acceptColor,
      captured: []
    })),
    channels: level.channels.map(ch => ({
      segments: ch.segments.map(s => ({ x1: s[0], y1: s[1], x2: s[2], y2: s[3] })),
      blockedByPin: ch.blockedByPin || null
    })),
    gravity: level.gravity || GRAVITY,
    status: 'playing', // 'playing' | 'won' | 'lost' | 'animating'
    tick: 0,
    removedPins: []
  };
}

/**
 * Get a pin by ID
 */
export function getPin(state, pinId) {
  return state.pins.find(p => p.id === pinId) || null;
}

/**
 * Check if a channel is blocked by a pin
 */
export function isChannelBlocked(state, channel) {
  if (!channel.blockedByPin) return false;
  const pin = getPin(state, channel.blockedByPin);
  return pin && !pin.removed;
}

/**
 * Get all active (non-blocked) channel segments
 */
export function getActiveChannels(state) {
  return state.channels
    .filter(ch => !isChannelBlocked(state, ch))
    .flatMap(ch => ch.segments);
}

/**
 * Calculate distance from point to line segment
 * Returns the closest point on the segment
 */
function pointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return { x: x1, y: y1, dist: Math.sqrt((px - x1) ** 2 + (py - y1) ** 2) };
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  const dist = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);

  return { x: closestX, y: closestY, dist, t };
}

/**
 * Reflect velocity off a wall segment
 */
function reflectVelocity(vx, vy, nx, ny) {
  const dot = vx * nx + vy * ny;
  return {
    vx: roundTo(vx - 2 * dot * nx, PRECISION),
    vy: roundTo(vy - 2 * dot * ny, PRECISION)
  };
}

/**
 * Check ball collision with channel walls and reflect
 */
function collideWithChannels(ball, channels) {
  let { x, y, vx, vy } = ball;

  for (const seg of channels) {
    const closest = pointToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);

    if (closest.dist < BALL_RADIUS) {
      // Calculate normal (perpendicular to segment)
      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len;
      const ny = dx / len;

      // Push ball out of wall
      const overlap = BALL_RADIUS - closest.dist;
      x = roundTo(x + nx * overlap, PRECISION);
      y = roundTo(y + ny * overlap, PRECISION);

      // Reflect velocity
      const reflected = reflectVelocity(vx, vy, nx, ny);
      vx = roundTo(reflected.vx * DAMPING, PRECISION);
      vy = roundTo(reflected.vy * DAMPING, PRECISION);
    }
  }

  return { x, y, vx, vy };
}

/**
 * Check if ball is inside a cup's capture zone
 */
function checkCupCapture(ball, cup) {
  const captureZone = {
    left: cup.x,
    right: cup.x + cup.width,
    top: cup.y,
    bottom: cup.y + cup.height
  };

  return ball.x > captureZone.left &&
         ball.x < captureZone.right &&
         ball.y > captureZone.top &&
         ball.y < captureZone.bottom;
}

/**
 * Simulate one physics tick
 * Advances all unsettled balls by one step
 *
 * @param {Object} state - Current game state
 * @returns {Object} New state after one tick
 */
export function simulateStep(state) {
  if (state.status !== 'animating' && state.status !== 'playing') {
    return state;
  }

  const channels = getActiveChannels(state);
  const newBalls = state.balls.map(ball => {
    if (ball.settled || ball.lost) return ball;

    let { x, y, vx, vy } = ball;

    // Apply gravity
    vy = roundTo(vy + state.gravity, PRECISION);

    // Move ball
    x = roundTo(x + vx, PRECISION);
    y = roundTo(y + vy, PRECISION);

    // Collide with channels
    const collided = collideWithChannels({ x, y, vx, vy }, channels);
    x = collided.x;
    y = collided.y;
    vx = collided.vx;
    vy = collided.vy;

    // Check cup capture
    for (const cup of state.cups) {
      if (checkCupCapture({ x, y }, cup)) {
        return {
          ...ball,
          x, y, vx, vy,
          settled: true,
          cupId: cup.id
        };
      }
    }

    // Check out of bounds (below screen)
    if (y > 600) {
      return { ...ball, x, y, vx, vy, lost: true };
    }

    return { ...ball, x, y, vx, vy };
  });

  // Update cup captures
  const newCups = state.cups.map(cup => ({
    ...cup,
    captured: newBalls
      .filter(b => b.settled && b.cupId === cup.id)
      .map(b => ({ id: b.id, color: b.color }))
  }));

  return {
    ...state,
    balls: newBalls,
    cups: newCups,
    tick: state.tick + 1
  };
}

/**
 * Run physics simulation to completion
 * Returns final state after all balls settle or max ticks reached
 *
 * @param {Object} state - Current state
 * @returns {Object} Final state
 */
export function simulateToCompletion(state) {
  let current = { ...state, status: 'animating' };

  for (let i = 0; i < MAX_TICKS; i++) {
    current = simulateStep(current);

    // Check if all balls are done
    const allDone = current.balls.every(b => b.settled || b.lost);
    if (allDone) break;
  }

  return { ...current, status: checkWin(current) };
}

/**
 * Remove a pin and unblock associated channels
 *
 * @param {Object} state - Current state
 * @param {string} pinId - Pin to remove
 * @returns {Object} New state with pin removed
 */
export function removePin(state, pinId) {
  const pin = getPin(state, pinId);
  if (!pin || pin.removed) return state;

  const newPins = state.pins.map(p =>
    p.id === pinId ? { ...p, removed: true, removing: true } : p
  );

  return {
    ...state,
    pins: newPins,
    removedPins: [...state.removedPins, pinId],
    status: 'animating'
  };
}

/**
 * Check win condition
 *
 * @param {Object} state - Game state
 * @returns {string} 'won' | 'lost' | 'playing'
 */
export function checkWin(state) {
  // Check for loss: any ball lost or in wrong cup
  for (const ball of state.balls) {
    if (ball.lost) return 'lost';

    if (ball.settled && ball.cupId) {
      const cup = state.cups.find(c => c.id === ball.cupId);
      if (cup && cup.acceptColor !== ball.color) {
        return 'lost';
      }
    }
  }

  // Check for win: all balls settled in correct cups
  const allSettled = state.balls.every(b => b.settled);
  if (allSettled) return 'won';

  // Check if simulation is still running
  const allDone = state.balls.every(b => b.settled || b.lost);
  if (!allDone) return 'animating';

  return 'playing';
}

/**
 * Get remaining pins (not yet removed)
 */
export function getRemainingPins(state) {
  return state.pins.filter(p => !p.removed);
}

/**
 * Clone state for history/undo
 */
export function cloneState(state) {
  return {
    pins: state.pins.map(p => ({ ...p })),
    balls: state.balls.map(b => ({ ...b })),
    cups: state.cups.map(c => ({
      ...c,
      captured: [...c.captured]
    })),
    channels: state.channels.map(ch => ({
      segments: ch.segments.map(s => ({ ...s })),
      blockedByPin: ch.blockedByPin
    })),
    gravity: state.gravity,
    status: state.status,
    tick: state.tick,
    removedPins: [...state.removedPins]
  };
}

/**
 * Check if level is still solvable (for hint system)
 * A level is unsolvable if removing any remaining pin causes a ball to be lost
 */
export function isStillSolvable(state) {
  const remaining = getRemainingPins(state);

  for (const pin of remaining) {
    const afterRemove = removePin(state, pin.id);
    const finalState = simulateToCompletion(afterRemove);

    if (finalState.status !== 'lost') {
      return true; // At least one pin can lead to a non-loss
    }
  }

  return remaining.length === 0; // Only solvable if no pins left
}

export default {
  GRAVITY,
  DAMPING,
  DT,
  MAX_TICKS,
  BALL_RADIUS,
  createInitialState,
  getPin,
  isChannelBlocked,
  getActiveChannels,
  simulateStep,
  simulateToCompletion,
  removePin,
  checkWin,
  getRemainingPins,
  cloneState,
  isStillSolvable
};
