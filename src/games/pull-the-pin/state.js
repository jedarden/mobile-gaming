/**
 * Pull the Pin - State Management & Physics Engine
 *
 * Manages game state including:
 * - Ball physics with gravity, bounce, and friction
 * - Pin mechanics (removal triggers physics)
 * - Wall collisions using line segment intersection
 * - Hazard and goal detection
 * - Win/lose conditions
 */

import { History } from '../../shared/history.js';

// Ball colors/types
export const BALL_TYPES = {
  gold: { color: '#FFD700', gradient: ['#FFD700', '#FFA500'], points: 10 },
  silver: { color: '#C0C0C0', gradient: ['#E8E8E8', '#A0A0A0'], points: 5 },
  bronze: { color: '#CD7F32', gradient: ['#CD7F32', '#8B4513'], points: 3 }
};

// Physics constants
const PHYSICS = {
  gravity: 0.4,
  friction: 0.995,
  bounce: 0.6,
  minVelocity: 0.01,
  maxVelocity: 20
};

/**
 * Custom Physics Engine
 * Handles ball movement, collisions, and responses
 */
export class PhysicsEngine {
  constructor() {
    this.gravity = PHYSICS.gravity;
    this.friction = PHYSICS.friction;
    this.bounce = PHYSICS.bounce;
  }

  /**
   * Update physics for all balls
   */
  update(balls, walls, pins, dt = 1) {
    const activeBalls = balls.filter(b => !b.collected && !b.destroyed);

    for (const ball of activeBalls) {
      // Apply gravity
      ball.vy += this.gravity * dt;

      // Apply friction
      ball.vx *= this.friction;
      ball.vy *= this.friction;

      // Clamp velocity
      ball.vx = Math.max(-PHYSICS.maxVelocity, Math.min(PHYSICS.maxVelocity, ball.vx));
      ball.vy = Math.max(-PHYSICS.maxVelocity, Math.min(PHYSICS.maxVelocity, ball.vy));

      // Update position
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Collide with walls
      for (const wall of walls) {
        this.handleWallCollision(ball, wall);
      }

      // Collide with pins (that are not removed)
      for (const pin of pins) {
        if (!pin.removed) {
          this.handlePinCollision(ball, pin);
        }
      }

      // Ball-to-ball collisions
      for (const other of activeBalls) {
        if (other !== ball) {
          this.handleBallCollision(ball, other);
        }
      }
    }
  }

  /**
   * Handle collision between ball and wall segment
   */
  handleWallCollision(ball, wall) {
    const collision = this.circleLineIntersect(ball, wall);
    if (collision) {
      this.resolveCollision(ball, collision);
    }
  }

  /**
   * Handle collision between ball and pin
   */
  handlePinCollision(ball, pin) {
    // Pin is a line segment
    const wall = this.pinToWall(pin);
    const collision = this.circleLineIntersect(ball, wall);
    if (collision) {
      this.resolveCollision(ball, collision);
    }
  }

  /**
   * Convert pin to wall segment for collision
   */
  pinToWall(pin) {
    const halfLength = pin.length / 2;
    const cos = Math.cos(pin.angle);
    const sin = Math.sin(pin.angle);
    return {
      x1: pin.x - halfLength * cos,
      y1: pin.y - halfLength * sin,
      x2: pin.x + halfLength * cos,
      y2: pin.y + halfLength * sin
    };
  }

  /**
   * Handle ball-to-ball collision
   */
  handleBallCollision(ball1, ball2) {
    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = ball1.radius + ball2.radius;

    if (dist < minDist && dist > 0) {
      // Normalize collision vector
      const nx = dx / dist;
      const ny = dy / dist;

      // Relative velocity
      const dvx = ball1.vx - ball2.vx;
      const dvy = ball1.vy - ball2.vy;

      // Relative velocity along collision normal
      const dvn = dvx * nx + dvy * ny;

      // Don't resolve if balls moving apart
      if (dvn > 0) return;

      // Impulse (equal mass)
      const impulse = -dvn * this.bounce;

      // Apply impulse
      ball1.vx += impulse * nx;
      ball1.vy += impulse * ny;
      ball2.vx -= impulse * nx;
      ball2.vy -= impulse * ny;

      // Separate balls
      const overlap = minDist - dist;
      ball1.x -= overlap * 0.5 * nx;
      ball1.y -= overlap * 0.5 * ny;
      ball2.x += overlap * 0.5 * nx;
      ball2.y += overlap * 0.5 * ny;
    }
  }

  /**
   * Check if circle intersects line segment
   * Returns collision info or null
   */
  circleLineIntersect(ball, wall) {
    const { x1, y1, x2, y2 } = wall;

    // Vector from p1 to ball
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - ball.x;
    const fy = y1 - ball.y;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - ball.radius * ball.radius;

    let discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return null;

    discriminant = Math.sqrt(discriminant);

    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    // Check if intersection is within segment
    if (t1 >= 0 && t1 <= 1) {
      const ix = x1 + t1 * dx;
      const iy = y1 + t1 * dy;
      return this.createCollision(ball, ix, iy, dx, dy);
    }

    if (t2 >= 0 && t2 <= 1) {
      const ix = x1 + t2 * dx;
      const iy = y1 + t2 * dy;
      return this.createCollision(ball, ix, iy, dx, dy);
    }

    // Check endpoints
    const d1 = Math.sqrt((ball.x - x1) ** 2 + (ball.y - y1) ** 2);
    const d2 = Math.sqrt((ball.x - x2) ** 2 + (ball.y - y2) ** 2);

    if (d1 < ball.radius) {
      return this.createCollision(ball, x1, y1, dx, dy);
    }
    if (d2 < ball.radius) {
      return this.createCollision(ball, x2, y2, dx, dy);
    }

    return null;
  }

  /**
   * Create collision response object
   */
  createCollision(ball, ix, iy, dx, dy) {
    // Calculate normal (perpendicular to wall)
    const len = Math.sqrt(dx * dx + dy * dy);
    let nx = -dy / len;
    let ny = dx / len;

    // Make sure normal points towards ball center
    const toBallX = ball.x - ix;
    const toBallY = ball.y - iy;
    if (nx * toBallX + ny * toBallY < 0) {
      nx = -nx;
      ny = -ny;
    }

    // Calculate penetration depth
    const dist = Math.sqrt(toBallX ** 2 + toBallY ** 2);
    const penetration = ball.radius - dist;

    return {
      x: ix,
      y: iy,
      nx,
      ny,
      penetration: Math.max(0, penetration)
    };
  }

  /**
   * Resolve collision by reflecting velocity and pushing out
   */
  resolveCollision(ball, collision) {
    const { nx, ny, penetration } = collision;

    // Push ball out of penetration
    if (penetration > 0) {
      ball.x += nx * penetration;
      ball.y += ny * penetration;
    }

    // Reflect velocity along normal
    const dot = ball.vx * nx + ball.vy * ny;

    // Only reflect if moving into the wall
    if (dot < 0) {
      ball.vx -= 2 * dot * nx * this.bounce;
      ball.vy -= 2 * dot * ny * this.bounce;
    }
  }
}

/**
 * Create initial game state from level data
 */
export function createInitialState(level) {
  return {
    balls: level.balls.map(b => ({
      ...b,
      vx: 0,
      vy: 0,
      collected: false,
      destroyed: false
    })),
    pins: level.pins.map(p => ({ ...p, removed: false, removing: false })),
    hazards: level.hazards.map(h => ({ ...h })),
    goals: level.goals.map(g => ({ ...g, collected: 0 })),
    walls: level.walls.map(w => ({ ...w })),
    physicsState: 'paused', // 'paused' | 'running'
    pinsRemaining: level.pins.length,
    requiredBalls: level.requiredBalls || level.balls.length,
    moves: 0,
    won: false,
    lost: false,
    score: 0
  };
}

/**
 * Remove a pin by ID
 */
export function removePin(state, pinId) {
  const pin = state.pins.find(p => p.id === pinId);
  if (!pin || pin.removed || pin.removing) return false;

  pin.removing = true;
  state.moves++;
  state.pinsRemaining--;

  // Physics will start after pin removal animation
  return true;
}

/**
 * Complete pin removal (after animation)
 */
export function completePinRemoval(state, pinId) {
  const pin = state.pins.find(p => p.id === pinId);
  if (!pin) return;

  pin.removed = true;
  pin.removing = false;

  // Start physics if any pins removed
  if (state.physicsState === 'paused') {
    state.physicsState = 'running';
  }
}

/**
 * Check if ball is in hazard
 */
export function checkHazardCollision(ball, hazard) {
  switch (hazard.type) {
    case 'lava':
    case 'spikes':
      return (
        ball.x > hazard.x &&
        ball.x < hazard.x + hazard.width &&
        ball.y > hazard.y &&
        ball.y < hazard.y + hazard.height
      );
    default:
      return false;
  }
}

/**
 * Check if ball is in goal
 */
export function checkGoalCollision(ball, goal) {
  return (
    ball.x > goal.x &&
    ball.x < goal.x + goal.width &&
    ball.y > goal.y &&
    ball.y < goal.y + goal.height
  );
}

/**
 * Update game state (called each frame)
 */
export function updateState(state, physics) {
  if (state.physicsState !== 'running') return;

  // Update physics
  physics.update(state.balls, state.walls, state.pins);

  // Check hazard collisions
  for (const ball of state.balls) {
    if (ball.collected || ball.destroyed) continue;

    for (const hazard of state.hazards) {
      if (checkHazardCollision(ball, hazard)) {
        ball.destroyed = true;
        break;
      }
    }
  }

  // Check goal collisions
  for (const ball of state.balls) {
    if (ball.collected || ball.destroyed) continue;

    for (const goal of state.goals) {
      if (checkGoalCollision(ball, goal)) {
        ball.collected = true;
        goal.collected++;
        state.score += BALL_TYPES[ball.type]?.points || 10;
        break;
      }
    }
  }

  // Check win/lose conditions
  checkWinLose(state);
}

/**
 * Check win/lose conditions
 */
export function checkWinLose(state) {
  // Count active balls (not collected, not destroyed, still moving)
  const activeBalls = state.balls.filter(b => !b.collected && !b.destroyed);

  // Check if all balls have settled
  const allSettled = activeBalls.every(b =>
    Math.abs(b.vx) < 0.1 && Math.abs(b.vy) < 0.1
  );

  // Check if balls are out of bounds (fell off screen)
  const outOfBounds = activeBalls.filter(b => b.y > 500);

  // Count collected
  const collected = state.balls.filter(b => b.collected).length;
  const destroyed = state.balls.filter(b => b.destroyed).length;

  // Win: enough balls collected
  if (collected >= state.requiredBalls) {
    state.won = true;
    state.physicsState = 'paused';
    return;
  }

  // Lose: too many destroyed or all balls done but not enough collected
  const remaining = state.balls.length - collected - destroyed;
  if (remaining + collected < state.requiredBalls) {
    state.lost = true;
    state.physicsState = 'paused';
    return;
  }

  // If all pins removed and all balls settled/out of bounds, check final state
  if (state.pinsRemaining === 0 && (activeBalls.length === 0 || (allSettled && outOfBounds.length === activeBalls.length))) {
    if (collected < state.requiredBalls) {
      state.lost = true;
      state.physicsState = 'paused';
    }
  }
}

/**
 * Clone state for history
 */
export function cloneState(state) {
  return {
    balls: state.balls.map(b => ({ ...b })),
    pins: state.pins.map(p => ({ ...p })),
    hazards: state.hazards.map(h => ({ ...h })),
    goals: state.goals.map(g => ({ ...g })),
    walls: state.walls.map(w => ({ ...w })),
    physicsState: state.physicsState,
    pinsRemaining: state.pinsRemaining,
    requiredBalls: state.requiredBalls,
    moves: state.moves,
    won: state.won,
    lost: state.lost,
    score: state.score
  };
}

/**
 * Create history manager
 */
export function createHistory(maxDepth = 50) {
  return new History(maxDepth);
}

/**
 * Calculate stars based on balls collected
 */
export function calculateStars(collected, required, total) {
  const ratio = collected / required;
  if (ratio >= 1.5) return 3; // Collected more than required
  if (ratio >= 1) return 2;   // Met requirement
  return 1;                    // Below requirement (shouldn't happen in win)
}

/**
 * Get hint - find a pin to remove
 */
export function getHint(state) {
  // Find pins that haven't been removed
  const availablePins = state.pins.filter(p => !p.removed && !p.removing);

  if (availablePins.length === 0) return null;

  // Simple hint: suggest the first available pin
  // (A smarter hint would simulate physics)
  const pin = availablePins[0];
  return {
    type: 'pin',
    pin,
    message: `Try removing the pin at (${Math.round(pin.x)}, ${Math.round(pin.y)})`
  };
}

export default {
  PhysicsEngine,
  BALL_TYPES,
  createInitialState,
  removePin,
  completePinRemoval,
  checkHazardCollision,
  checkGoalCollision,
  updateState,
  checkWinLose,
  cloneState,
  createHistory,
  calculateStars,
  getHint
};
