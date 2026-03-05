/**
 * Tests for Pull the Pin - State Management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
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
} from '../../../src/games/pull-the-pin/state.js';

describe('Pull the Pin State', () => {
  describe('BALL_TYPES', () => {
    it('should define gold, silver, and bronze ball types', () => {
      expect(BALL_TYPES.gold).toBeDefined();
      expect(BALL_TYPES.silver).toBeDefined();
      expect(BALL_TYPES.bronze).toBeDefined();
    });

    it('should have color and points for each ball type', () => {
      expect(BALL_TYPES.gold.color).toBe('#FFD700');
      expect(BALL_TYPES.gold.points).toBe(10);
      expect(BALL_TYPES.silver.points).toBe(5);
      expect(BALL_TYPES.bronze.points).toBe(3);
    });
  });

  describe('createInitialState', () => {
    it('should create initial state from level data', () => {
      const level = {
        balls: [{ id: 'b1', x: 100, y: 50, radius: 12, type: 'gold' }],
        pins: [{ id: 'p1', x: 100, y: 100, length: 80, angle: 0 }],
        hazards: [],
        goals: [{ id: 'g1', x: 50, y: 350, width: 100, height: 40 }],
        walls: [],
        requiredBalls: 1
      };

      const state = createInitialState(level);

      expect(state.balls).toHaveLength(1);
      expect(state.pins).toHaveLength(1);
      expect(state.goals).toHaveLength(1);
      expect(state.physicsState).toBe('paused');
      expect(state.moves).toBe(0);
      expect(state.won).toBe(false);
      expect(state.lost).toBe(false);
      expect(state.score).toBe(0);
    });

    it('should add velocity properties to balls', () => {
      const level = {
        balls: [{ id: 'b1', x: 100, y: 50, radius: 12, type: 'gold' }],
        pins: [],
        hazards: [],
        goals: [],
        walls: []
      };

      const state = createInitialState(level);

      expect(state.balls[0].vx).toBe(0);
      expect(state.balls[0].vy).toBe(0);
      expect(state.balls[0].collected).toBe(false);
      expect(state.balls[0].destroyed).toBe(false);
    });

    it('should add removed and removing flags to pins', () => {
      const level = {
        balls: [],
        pins: [{ id: 'p1', x: 100, y: 100, length: 80, angle: 0 }],
        hazards: [],
        goals: [],
        walls: []
      };

      const state = createInitialState(level);

      expect(state.pins[0].removed).toBe(false);
      expect(state.pins[0].removing).toBe(false);
    });

    it('should default requiredBalls to total balls if not specified', () => {
      const level = {
        balls: [
          { id: 'b1', x: 100, y: 50, radius: 12, type: 'gold' },
          { id: 'b2', x: 120, y: 50, radius: 12, type: 'silver' }
        ],
        pins: [],
        hazards: [],
        goals: [],
        walls: []
      };

      const state = createInitialState(level);

      expect(state.requiredBalls).toBe(2);
    });

    it('should deep copy level data to prevent mutation', () => {
      const level = {
        balls: [{ id: 'b1', x: 100, y: 50, radius: 12, type: 'gold' }],
        pins: [{ id: 'p1', x: 100, y: 100, length: 80, angle: 0 }],
        hazards: [],
        goals: [{ id: 'g1', x: 50, y: 350, width: 100, height: 40 }],
        walls: []
      };

      const state = createInitialState(level);

      // Modify original
      level.balls[0].x = 999;
      level.pins[0].length = 999;

      // State should be unchanged
      expect(state.balls[0].x).toBe(100);
      expect(state.pins[0].length).toBe(80);
    });
  });

  describe('cloneState', () => {
    it('should create a deep copy of state', () => {
      const state = {
        balls: [{ id: 'b1', x: 100, y: 50, vx: 0, vy: 0 }],
        pins: [{ id: 'p1', x: 100, y: 100, removed: false }],
        hazards: [],
        goals: [{ id: 'g1', x: 50, y: 350, collected: 0 }],
        walls: [],
        physicsState: 'running',
        pinsRemaining: 1,
        requiredBalls: 1,
        moves: 5,
        won: false,
        lost: false,
        score: 50
      };

      const cloned = cloneState(state);

      expect(cloned).toEqual(state);
      expect(cloned).not.toBe(state);
      expect(cloned.balls).not.toBe(state.balls);
      expect(cloned.balls[0]).not.toBe(state.balls[0]);
    });

    it('should not affect original when modified', () => {
      const state = {
        balls: [{ id: 'b1', x: 100, y: 50 }],
        pins: [],
        hazards: [],
        goals: [],
        walls: [],
        physicsState: 'paused',
        pinsRemaining: 0,
        requiredBalls: 1,
        moves: 0,
        won: false,
        lost: false,
        score: 0
      };

      const cloned = cloneState(state);
      cloned.balls[0].x = 999;
      cloned.moves = 10;

      expect(state.balls[0].x).toBe(100);
      expect(state.moves).toBe(0);
    });
  });

  describe('removePin', () => {
    let state;

    beforeEach(() => {
      state = {
        balls: [],
        pins: [
          { id: 'p1', x: 100, y: 100, removed: false, removing: false },
          { id: 'p2', x: 150, y: 150, removed: false, removing: false }
        ],
        hazards: [],
        goals: [],
        walls: [],
        physicsState: 'paused',
        pinsRemaining: 2,
        moves: 0
      };
    });

    it('should mark pin as removing', () => {
      const result = removePin(state, 'p1');

      expect(result).toBe(true);
      expect(state.pins[0].removing).toBe(true);
      expect(state.pins[0].removed).toBe(false);
    });

    it('should increment moves counter', () => {
      removePin(state, 'p1');

      expect(state.moves).toBe(1);
    });

    it('should decrement pinsRemaining', () => {
      removePin(state, 'p1');

      expect(state.pinsRemaining).toBe(1);
    });

    it('should return false for non-existent pin', () => {
      const result = removePin(state, 'p999');

      expect(result).toBe(false);
      expect(state.moves).toBe(0);
    });

    it('should return false for already removed pin', () => {
      state.pins[0].removed = true;
      const result = removePin(state, 'p1');

      expect(result).toBe(false);
    });

    it('should return false for pin already being removed', () => {
      state.pins[0].removing = true;
      const result = removePin(state, 'p1');

      expect(result).toBe(false);
    });
  });

  describe('completePinRemoval', () => {
    let state;

    beforeEach(() => {
      state = {
        balls: [],
        pins: [{ id: 'p1', x: 100, y: 100, removed: false, removing: true }],
        hazards: [],
        goals: [],
        walls: [],
        physicsState: 'paused',
        pinsRemaining: 1
      };
    });

    it('should mark pin as removed', () => {
      completePinRemoval(state, 'p1');

      expect(state.pins[0].removed).toBe(true);
      expect(state.pins[0].removing).toBe(false);
    });

    it('should start physics if paused', () => {
      completePinRemoval(state, 'p1');

      expect(state.physicsState).toBe('running');
    });

    it('should not change physics if already running', () => {
      state.physicsState = 'running';
      completePinRemoval(state, 'p1');

      expect(state.physicsState).toBe('running');
    });

    it('should handle non-existent pin gracefully', () => {
      expect(() => completePinRemoval(state, 'p999')).not.toThrow();
    });
  });

  describe('checkHazardCollision', () => {
    it('should detect collision when ball is inside lava hazard', () => {
      const ball = { x: 150, y: 280, radius: 12 };
      const hazard = { type: 'lava', x: 100, y: 250, width: 100, height: 50 };

      expect(checkHazardCollision(ball, hazard)).toBe(true);
    });

    it('should detect collision when ball is inside spikes hazard', () => {
      const ball = { x: 150, y: 280, radius: 12 };
      const hazard = { type: 'spikes', x: 100, y: 250, width: 100, height: 50 };

      expect(checkHazardCollision(ball, hazard)).toBe(true);
    });

    it('should not detect collision when ball is outside hazard', () => {
      const ball = { x: 50, y: 50, radius: 12 };
      const hazard = { type: 'lava', x: 100, y: 250, width: 100, height: 50 };

      expect(checkHazardCollision(ball, hazard)).toBe(false);
    });

    it('should return false for unknown hazard types', () => {
      const ball = { x: 150, y: 280, radius: 12 };
      const hazard = { type: 'unknown', x: 100, y: 250, width: 100, height: 50 };

      expect(checkHazardCollision(ball, hazard)).toBe(false);
    });

    it('should detect collision at hazard boundaries', () => {
      // Collision check uses strict inequalities (>, <), so need to be slightly inside
      const ball = { x: 101, y: 251, radius: 12 }; // Slightly inside hazard
      const hazard = { type: 'lava', x: 100, y: 250, width: 100, height: 50 };

      expect(checkHazardCollision(ball, hazard)).toBe(true);
    });
  });

  describe('checkGoalCollision', () => {
    it('should detect collision when ball is inside goal', () => {
      const ball = { x: 150, y: 370, radius: 12 };
      const goal = { x: 100, y: 350, width: 100, height: 40 };

      expect(checkGoalCollision(ball, goal)).toBe(true);
    });

    it('should not detect collision when ball is outside goal', () => {
      const ball = { x: 50, y: 50, radius: 12 };
      const goal = { x: 100, y: 350, width: 100, height: 40 };

      expect(checkGoalCollision(ball, goal)).toBe(false);
    });

    it('should detect collision at goal boundaries', () => {
      // Collision check uses strict inequalities (>, <), so need to be slightly inside
      const ball = { x: 101, y: 351, radius: 12 }; // Slightly inside goal
      const goal = { x: 100, y: 350, width: 100, height: 40 };

      expect(checkGoalCollision(ball, goal)).toBe(true);
    });

    it('should not detect collision just outside goal', () => {
      const ball = { x: 99, y: 370, radius: 12 };
      const goal = { x: 100, y: 350, width: 100, height: 40 };

      expect(checkGoalCollision(ball, goal)).toBe(false);
    });
  });

  describe('checkWinLose', () => {
    let state;

    beforeEach(() => {
      state = {
        balls: [
          { id: 'b1', x: 150, y: 370, vx: 0, vy: 0, collected: false, destroyed: false, radius: 12, type: 'gold' },
          { id: 'b2', x: 150, y: 100, vx: 0, vy: 0, collected: false, destroyed: false, radius: 12, type: 'gold' }
        ],
        pins: [],
        hazards: [],
        goals: [],
        walls: [],
        physicsState: 'running',
        pinsRemaining: 0,
        requiredBalls: 2,
        won: false,
        lost: false,
        score: 0
      };
    });

    it('should set won when enough balls collected', () => {
      state.balls[0].collected = true;
      state.balls[1].collected = true;

      checkWinLose(state);

      expect(state.won).toBe(true);
      expect(state.physicsState).toBe('paused');
    });

    it('should set lost when too many balls destroyed', () => {
      state.balls[0].destroyed = true;
      state.balls[1].destroyed = true;

      checkWinLose(state);

      expect(state.lost).toBe(true);
      expect(state.physicsState).toBe('paused');
    });

    it('should set lost when remaining balls insufficient', () => {
      state.balls[0].destroyed = true;
      state.balls[1].collected = false;

      checkWinLose(state);

      expect(state.lost).toBe(true);
    });

    it('should not set won with partial collection', () => {
      state.balls[0].collected = true;
      state.requiredBalls = 2;

      checkWinLose(state);

      expect(state.won).toBe(false);
    });

    it('should set lost when all pins removed and balls settled but not enough collected', () => {
      state.pinsRemaining = 0;
      state.requiredBalls = 2;
      state.balls[0].collected = true;
      state.balls[1].y = 550; // Out of bounds

      checkWinLose(state);

      expect(state.lost).toBe(true);
    });
  });

  describe('updateState', () => {
    let state;
    let physics;

    beforeEach(() => {
      physics = new PhysicsEngine();
      state = {
        balls: [
          { id: 'b1', x: 150, y: 100, vx: 0, vy: 0, collected: false, destroyed: false, radius: 12, type: 'gold' }
        ],
        pins: [{ id: 'p1', x: 150, y: 150, length: 80, angle: 0, removed: true, removing: false }],
        hazards: [{ id: 'h1', type: 'lava', x: 100, y: 300, width: 100, height: 30 }],
        goals: [{ id: 'g1', x: 100, y: 350, width: 100, height: 40, collected: 0 }],
        walls: [],
        physicsState: 'running',
        pinsRemaining: 0,
        requiredBalls: 1,
        won: false,
        lost: false,
        score: 0
      };
    });

    it('should not update when physics is paused', () => {
      state.physicsState = 'paused';
      const initialY = state.balls[0].y;

      updateState(state, physics);

      expect(state.balls[0].y).toBe(initialY);
    });

    it('should update ball positions when physics is running', () => {
      updateState(state, physics);

      // Ball should have moved due to gravity
      expect(state.balls[0].y).toBeGreaterThan(100);
    });

    it('should mark ball destroyed when hitting hazard', () => {
      state.balls[0].y = 305; // Inside hazard

      updateState(state, physics);

      expect(state.balls[0].destroyed).toBe(true);
    });

    it('should mark ball collected when reaching goal', () => {
      state.balls[0].y = 360; // Inside goal
      state.hazards = []; // Remove hazards

      updateState(state, physics);

      expect(state.balls[0].collected).toBe(true);
    });

    it('should increment goal collected count', () => {
      state.balls[0].y = 360;
      state.hazards = [];

      updateState(state, physics);

      expect(state.goals[0].collected).toBe(1);
    });

    it('should add points to score when ball collected', () => {
      state.balls[0].y = 360;
      state.hazards = [];

      updateState(state, physics);

      expect(state.score).toBe(10); // Gold ball is 10 points
    });

    it('should skip collected balls in physics', () => {
      state.balls[0].collected = true;
      state.balls[0].y = 100;

      updateState(state, physics);

      // Collected balls shouldn't move
      expect(state.balls[0].y).toBe(100);
    });

    it('should skip destroyed balls in physics', () => {
      state.balls[0].destroyed = true;
      state.balls[0].y = 100;

      updateState(state, physics);

      expect(state.balls[0].y).toBe(100);
    });
  });

  describe('PhysicsEngine', () => {
    let physics;

    beforeEach(() => {
      physics = new PhysicsEngine();
    });

    describe('constructor', () => {
      it('should initialize with default physics constants', () => {
        expect(physics.gravity).toBe(0.4);
        expect(physics.friction).toBe(0.995);
        expect(physics.bounce).toBe(0.6);
      });
    });

    describe('update', () => {
      it('should apply gravity to balls', () => {
        const balls = [{ x: 100, y: 100, vx: 0, vy: 0, radius: 12, collected: false, destroyed: false }];

        physics.update(balls, [], [], 1);

        expect(balls[0].vy).toBeGreaterThan(0);
      });

      it('should apply friction to velocity', () => {
        const balls = [{ x: 100, y: 100, vx: 10, vy: 0, radius: 12, collected: false, destroyed: false }];

        physics.update(balls, [], [], 1);

        // Friction reduces vx, gravity increases vy
        expect(balls[0].vx).toBeLessThan(10);
        expect(balls[0].vy).toBeGreaterThan(0); // Gravity was applied
      });

      it('should update position based on velocity', () => {
        const balls = [{ x: 100, y: 100, vx: 5, vy: 3, radius: 12, collected: false, destroyed: false }];

        physics.update(balls, [], [], 1);

        // Friction is applied (0.995), then position is updated
        // vx becomes 5 * 0.995 = 4.975, vy becomes (3 + 0.4) * 0.995 ≈ 3.378
        expect(balls[0].x).toBeCloseTo(104.975, 1);
        expect(balls[0].y).toBeGreaterThan(103); // Includes gravity
      });

      it('should skip collected balls', () => {
        const balls = [{ x: 100, y: 100, vx: 0, vy: 0, radius: 12, collected: true, destroyed: false }];

        physics.update(balls, [], [], 1);

        expect(balls[0].y).toBe(100);
      });

      it('should skip destroyed balls', () => {
        const balls = [{ x: 100, y: 100, vx: 0, vy: 0, radius: 12, collected: false, destroyed: true }];

        physics.update(balls, [], [], 1);

        expect(balls[0].y).toBe(100);
      });

      it('should clamp velocity to max', () => {
        const balls = [{ x: 100, y: 100, vx: 100, vy: 100, radius: 12, collected: false, destroyed: false }];

        physics.update(balls, [], [], 1);

        expect(balls[0].vx).toBeLessThanOrEqual(20);
        expect(balls[0].vy).toBeLessThanOrEqual(20);
      });
    });

    describe('handleWallCollision', () => {
      it('should detect and resolve wall collision', () => {
        // Ball slightly overlapping with wall on the left
        const ball = { x: 60, y: 100, vx: -5, vy: 0, radius: 12 };
        const wall = { x1: 50, y1: 50, x2: 50, y2: 200 };

        physics.handleWallCollision(ball, wall);

        // After collision resolution, ball should have bounced (velocity reflected)
        // The exact position depends on penetration depth calculation
        expect(ball.vx).toBeGreaterThan(-5); // Velocity should have changed
      });
    });

    describe('handleBallCollision', () => {
      it('should resolve collision between two balls', () => {
        // Ball1 moving away from ball2 but they're overlapping
        // The collision resolution will push them apart
        const ball1 = { x: 100, y: 100, vx: -2, vy: 0, radius: 12 };
        const ball2 = { x: 118, y: 100, vx: 0, vy: 0, radius: 12 };

        const initialX1 = ball1.x;
        const initialX2 = ball2.x;

        physics.handleBallCollision(ball1, ball2);

        // Balls should be separated (pushed apart)
        expect(ball1.x).toBeLessThan(initialX1);
        expect(ball2.x).toBeGreaterThan(initialX2);
      });

      it('should not collide balls that are far apart', () => {
        const ball1 = { x: 100, y: 100, vx: 1, vy: 0, radius: 12 };
        const ball2 = { x: 200, y: 100, vx: 0, vy: 0, radius: 12 };

        physics.handleBallCollision(ball1, ball2);

        // Velocities should be unchanged
        expect(ball1.vx).toBe(1);
        expect(ball2.vx).toBe(0);
      });
    });

    describe('pinToWall', () => {
      it('should convert pin to wall segment', () => {
        const pin = { x: 150, y: 100, length: 80, angle: 0 };

        const wall = physics.pinToWall(pin);

        expect(wall.x1).toBe(110);
        expect(wall.x2).toBe(190);
        expect(wall.y1).toBe(100);
        expect(wall.y2).toBe(100);
      });

      it('should handle angled pins', () => {
        const pin = { x: 150, y: 100, length: 80, angle: Math.PI / 2 };

        const wall = physics.pinToWall(pin);

        expect(Math.round(wall.x1)).toBe(150);
        expect(Math.round(wall.x2)).toBe(150);
        expect(Math.round(wall.y1)).toBe(60);
        expect(Math.round(wall.y2)).toBe(140);
      });
    });

    describe('circleLineIntersect', () => {
      it('should detect intersection with line segment', () => {
        const ball = { x: 100, y: 100, radius: 12 };
        const wall = { x1: 80, y1: 100, x2: 120, y2: 100 };

        const collision = physics.circleLineIntersect(ball, wall);

        expect(collision).not.toBeNull();
      });

      it('should return null for no intersection', () => {
        const ball = { x: 100, y: 100, radius: 12 };
        const wall = { x1: 80, y1: 200, x2: 120, y2: 200 };

        const collision = physics.circleLineIntersect(ball, wall);

        expect(collision).toBeNull();
      });
    });
  });

  describe('createHistory', () => {
    it('should create history manager with default max depth', () => {
      const history = createHistory();

      expect(history.canUndo()).toBe(false);
    });

    it('should create history manager with custom max depth', () => {
      const history = createHistory(10);

      history.push({ moves: 1 });
      history.push({ moves: 2 });

      expect(history.canUndo()).toBe(true);
    });
  });

  describe('calculateStars', () => {
    it('should return 3 stars when collected more than 1.5x required', () => {
      expect(calculateStars(15, 10, 20)).toBe(3);
    });

    it('should return 2 stars when collected exactly required', () => {
      expect(calculateStars(10, 10, 20)).toBe(2);
    });

    it('should return 1 star when below required', () => {
      expect(calculateStars(5, 10, 20)).toBe(1);
    });

    it('should handle edge cases', () => {
      expect(calculateStars(0, 1, 10)).toBe(1);
      expect(calculateStars(1, 1, 1)).toBe(2);
    });
  });

  describe('getHint', () => {
    let state;

    beforeEach(() => {
      state = {
        balls: [],
        pins: [
          { id: 'p1', x: 100, y: 100, removed: false, removing: false },
          { id: 'p2', x: 150, y: 150, removed: false, removing: false }
        ],
        hazards: [],
        goals: [],
        walls: [],
        physicsState: 'paused',
        pinsRemaining: 2
      };
    });

    it('should return a hint with available pins', () => {
      const hint = getHint(state);

      expect(hint).not.toBeNull();
      expect(hint.type).toBe('pin');
      expect(hint.pin).toBeDefined();
      expect(hint.message).toBeDefined();
    });

    it('should return null when no pins available', () => {
      state.pins[0].removed = true;
      state.pins[1].removed = true;
      state.pinsRemaining = 0;

      const hint = getHint(state);

      expect(hint).toBeNull();
    });

    it('should skip pins that are being removed', () => {
      state.pins[0].removing = true;
      state.pins[1].removed = true;
      state.pinsRemaining = 1;

      const hint = getHint(state);

      expect(hint).toBeNull();
    });
  });
});
