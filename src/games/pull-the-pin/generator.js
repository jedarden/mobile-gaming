/**
 * Pull the Pin - Procedural Level Generator
 *
 * Generates solvable puzzles with:
 * - Seeded RNG for reproducible daily challenges
 * - Varying difficulty levels (easy/medium/hard)
 * - Physics validation to ensure solvability
 * - Diverse level layouts and configurations
 */

import { createRNG } from '../../shared/rng.js';
import { PhysicsEngine, BALL_TYPES } from './state.js';

// Grid constants
const GRID = {
  width: 300,
  height: 400,
  margin: 40,
  wallThickness: 3
};

// Generation presets by difficulty
const DIFFICULTY_PRESETS = {
  easy: {
    ballCount: { min: 2, max: 4 },
    pinCount: { min: 1, max: 2 },
    hazardChance: 0.15,
    hazardCount: { min: 0, max: 1 },
    platformChance: 0.3,
    multiGoalChance: 0,
    complexLayoutChance: 0.1,
    minRequiredBallsRatio: 1.0,
    maxAttempts: 20
  },
  medium: {
    ballCount: { min: 3, max: 6 },
    pinCount: { min: 2, max: 4 },
    hazardChance: 0.35,
    hazardCount: { min: 0, max: 2 },
    platformChance: 0.5,
    multiGoalChance: 0.2,
    complexLayoutChance: 0.4,
    minRequiredBallsRatio: 0.8,
    maxAttempts: 25
  },
  hard: {
    ballCount: { min: 5, max: 8 },
    pinCount: { min: 3, max: 6 },
    hazardChance: 0.55,
    hazardCount: { min: 1, max: 3 },
    platformChance: 0.7,
    multiGoalChance: 0.35,
    complexLayoutChance: 0.6,
    minRequiredBallsRatio: 0.7,
    maxAttempts: 30
  }
};

// Template patterns for structured layouts
const LAYOUT_TEMPLATES = {
  funnel: {
    name: 'funnel',
    wallAngles: [-0.3, 0.3],
    pinRows: 2
  },
  cascade: {
    name: 'cascade',
    wallAngles: [0.2, -0.2],
    pinRows: 3
  },
  zigzag: {
    name: 'zigzag',
    wallAngles: [0, 0],
    pinRows: 4
  },
  split: {
    name: 'split',
    wallAngles: [-0.4, 0.4],
    pinRows: 2
  }
};

/**
 * Create a level generator instance
 * @param {Object} options - Generator options
 * @returns {Object} Generator with methods
 */
export function createGenerator(options = {}) {
  const physics = new PhysicsEngine();
  let lastGeneratedLevel = null;

  /**
   * Generate a level from a seed
   * @param {number} seed - RNG seed for reproducibility
   * @param {string} difficulty - 'easy', 'medium', or 'hard'
   * @returns {Object} Generated level data
   */
  function generate(seed, difficulty = 'medium') {
    const rng = createRNG(seed);
    const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.medium;

    // Try to generate a valid level
    const maxAttempts = preset.maxAttempts;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Create a new RNG for each attempt with a derived seed
      const attemptSeed = seed + attempt * 1000;
      const attemptRng = createRNG(attemptSeed);

      const level = generateLevel(attemptRng, preset, difficulty);

      // Validate the level
      if (validateLevel(level)) {
        lastGeneratedLevel = level;
        return level;
      }
    }

    // Fallback to a simple guaranteed-solvable level
    console.warn('Failed to generate valid level, using fallback');
    return generateFallbackLevel(seed, difficulty);
  }

  /**
   * Generate a daily challenge level
   * @param {number} dailySeed - Daily seed from the game
   * @returns {Object} Generated level for daily challenge
   */
  function generateDaily(dailySeed) {
    // Daily challenges use medium difficulty with some hard elements
    const rng = createRNG(dailySeed);
    const level = generateLevel(rng, DIFFICULTY_PRESETS.medium, 'medium');
    level.id = `daily_${dailySeed}`;
    level.isDaily = true;
    return level;
  }

  /**
   * Internal level generation
   */
  function generateLevel(rng, preset, difficulty) {
    // Choose layout template
    const useTemplate = rng.bool(preset.complexLayoutChance);
    const template = useTemplate ? rng.pick(Object.values(LAYOUT_TEMPLATES)) : null;

    // Generate core components
    const walls = generateWalls(rng, template);
    const balls = generateBalls(rng, preset, walls);
    const pins = generatePins(rng, preset, balls, walls, template);
    const hazards = generateHazards(rng, preset, pins, walls);
    const goals = generateGoals(rng, preset, balls, hazards, walls);

    // Calculate required balls
    const requiredBalls = Math.ceil(balls.length * preset.minRequiredBallsRatio);

    return {
      id: `gen_${Date.now()}_${rng.int(1000, 9999)}`,
      grid: { width: GRID.width, height: GRID.height },
      balls,
      pins,
      hazards,
      goals,
      walls,
      requiredBalls,
      difficulty,
      generated: true
    };
  }

  /**
   * Generate boundary walls
   */
  function generateWalls(rng, template) {
    const walls = [];
    const margin = GRID.margin;

    // Left wall
    walls.push({
      x1: margin,
      y1: margin,
      x2: margin,
      y2: GRID.height - margin
    });

    // Right wall
    walls.push({
      x1: GRID.width - margin,
      y1: margin,
      x2: GRID.width - margin,
      y2: GRID.height - margin
    });

    // Optional: add internal platforms/walls based on template
    if (template) {
      const centerY = GRID.height / 2;

      // Add angled internal walls
      if (template.wallAngles && template.wallAngles.length > 0) {
        template.wallAngles.forEach((angle, index) => {
          const xOffset = index === 0 ? margin + 40 : GRID.width - margin - 80;
          const wallLength = 60;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);

          walls.push({
            x1: xOffset,
            y1: centerY - wallLength / 2 * cos,
            x2: xOffset + wallLength * cos,
            y2: centerY + wallLength / 2 * cos
          });
        });
      }
    }

    // Random platforms for harder difficulties
    if (rng.bool(0.3)) {
      const platformY = rng.float(200, 280);
      const platformWidth = rng.float(40, 80);
      const platformX = rng.float(margin + 20, GRID.width - margin - platformWidth - 20);

      walls.push({
        x1: platformX,
        y1: platformY,
        x2: platformX + platformWidth,
        y2: platformY
      });
    }

    return walls;
  }

  /**
   * Generate balls at the top of the level
   */
  function generateBalls(rng, preset, walls) {
    const balls = [];
    const count = rng.int(preset.ballCount.min, preset.ballCount.max);
    const types = Object.keys(BALL_TYPES);

    // Find safe spawn area (between walls)
    const leftWall = walls.find(w => w.x1 === GRID.margin)?.x1 || GRID.margin;
    const rightWall = walls.find(w => w.x1 === GRID.width - GRID.margin)?.x1 || GRID.width - GRID.margin;
    const spawnWidth = rightWall - leftWall - 30;

    // Distribute balls across the top
    for (let i = 0; i < count; i++) {
      const spacing = spawnWidth / (count + 1);
      const x = leftWall + 15 + spacing * (i + 1) + rng.float(-10, 10);
      const y = rng.float(45, 80);

      balls.push({
        id: `ball_${i}`,
        x: Math.max(leftWall + 20, Math.min(rightWall - 20, x)),
        y,
        radius: 12,
        type: rng.pick(types)
      });
    }

    return balls;
  }

  /**
   * Generate pins to support the balls
   */
  function generatePins(rng, preset, balls, walls, template) {
    const pins = [];
    const count = rng.int(preset.pinCount.min, preset.pinCount.max);

    // Find boundaries
    const leftWall = GRID.margin;
    const rightWall = GRID.width - GRID.margin;

    // Create pin rows
    const rows = Math.ceil(count / 2);
    const rowSpacing = Math.min(70, (GRID.height - 150) / (rows + 1));

    for (let row = 0; row < rows; row++) {
      const pinsInRow = row === 0 ? Math.ceil(count / 2) : Math.floor(count / 2);
      const baseY = 110 + row * rowSpacing;

      for (let col = 0; col < pinsInRow; col++) {
        const spacing = (rightWall - leftWall - 60) / (pinsInRow + 1);
        const x = leftWall + 30 + spacing * (col + 1) + rng.float(-15, 15);
        const y = baseY + rng.float(-10, 10);

        // Ensure pin is within bounds
        if (x < leftWall + 30 || x > rightWall - 30) continue;

        pins.push({
          id: `pin_${pins.length}`,
          x: Math.max(leftWall + 30, Math.min(rightWall - 30, x)),
          y,
          length: rng.float(60, 90),
          angle: rng.float(-0.25, 0.25)
        });
      }
    }

    // Ensure at least one pin below each ball cluster
    const avgBallX = balls.reduce((sum, b) => sum + b.x, 0) / balls.length;
    const minBallY = Math.min(...balls.map(b => b.y));

    // Check if there's a pin below the balls
    const hasPinBelowBalls = pins.some(p => p.y > minBallY + 20);
    if (!hasPinBelowBalls && pins.length < count) {
      pins.push({
        id: `pin_${pins.length}`,
        x: avgBallX,
        y: minBallY + 50,
        length: 80,
        angle: 0
      });
    }

    return pins;
  }

  /**
   * Generate hazards (lava, spikes)
   */
  function generateHazards(rng, preset, pins, walls) {
    const hazards = [];

    if (!rng.bool(preset.hazardChance)) {
      return hazards;
    }

    const count = rng.int(preset.hazardCount.min, preset.hazardCount.max);
    const leftWall = GRID.margin;
    const rightWall = GRID.width - GRID.margin;

    // Find lowest pin to place hazards below
    const lowestPin = pins.length > 0
      ? Math.max(...pins.map(p => p.y)) + 60
      : 200;

    for (let i = 0; i < count; i++) {
      const hazardWidth = rng.float(50, 90);
      const x = rng.float(leftWall + 20, rightWall - hazardWidth - 20);
      const y = rng.float(lowestPin, GRID.height - 100);

      hazards.push({
        id: `hazard_${i}`,
        type: rng.bool(0.7) ? 'lava' : 'spikes',
        x,
        y,
        width: hazardWidth,
        height: 25
      });
    }

    return hazards;
  }

  /**
   * Generate goal zones
   */
  function generateGoals(rng, preset, balls, hazards, walls) {
    const goals = [];
    const leftWall = GRID.margin;
    const rightWall = GRID.width - GRID.margin;

    // Determine goal count
    const goalCount = rng.bool(preset.multiGoalChance) ? 2 : 1;

    // Place goals at the bottom
    const goalY = GRID.height - GRID.margin - 30;
    const goalHeight = 30;

    if (goalCount === 1) {
      // Single centered goal
      const goalWidth = Math.min(120, (rightWall - leftWall) * 0.5);
      const goalX = (GRID.width - goalWidth) / 2;

      goals.push({
        id: 'goal_0',
        x: goalX,
        y: goalY,
        width: goalWidth,
        height: goalHeight,
        required: balls.length
      });
    } else {
      // Two goals
      const goalWidth = 70;
      const spacing = (rightWall - leftWall - goalWidth * 2) / 3;

      goals.push({
        id: 'goal_0',
        x: leftWall + spacing,
        y: goalY,
        width: goalWidth,
        height: goalHeight,
        required: Math.ceil(balls.length / 2)
      });

      goals.push({
        id: 'goal_1',
        x: rightWall - spacing - goalWidth,
        y: goalY,
        width: goalWidth,
        height: goalHeight,
        required: Math.floor(balls.length / 2)
      });
    }

    return goals;
  }

  /**
   * Validate that a level is solvable
   */
  function validateLevel(level) {
    // Basic structural validation
    if (!level.balls || level.balls.length === 0) return false;
    if (!level.pins || level.pins.length === 0) return false;
    if (!level.goals || level.goals.length === 0) return false;

    // Check ball positions are within bounds
    for (const ball of level.balls) {
      if (ball.x < GRID.margin + ball.radius ||
          ball.x > GRID.width - GRID.margin - ball.radius) {
        return false;
      }
      if (ball.y < 20 || ball.y > 100) {
        return false;
      }
    }

    // Check pins are within bounds
    for (const pin of level.pins) {
      if (pin.x < GRID.margin + 20 ||
          pin.x > GRID.width - GRID.margin - 20) {
        return false;
      }
    }

    // Check goals are at the bottom
    for (const goal of level.goals) {
      if (goal.y < GRID.height - 100) {
        return false;
      }
    }

    // Simulate physics to check if balls can reach goals
    return simulateSolvability(level);
  }

  /**
   * Simulate level to check if it's solvable
   */
  function simulateSolvability(level) {
    // Create a copy of the level state
    const balls = level.balls.map(b => ({
      ...b,
      vx: 0,
      vy: 0,
      collected: false,
      destroyed: false
    }));

    const pins = level.pins.map(p => ({ ...p, removed: false }));
    const walls = level.walls;
    const hazards = level.hazards;
    const goals = level.goals;

    // Simulate with all pins removed
    for (const pin of pins) {
      pin.removed = true;
    }

    // Run physics simulation for a limited time
    const maxSteps = 300; // ~5 seconds at 60fps
    let step = 0;

    while (step < maxSteps) {
      // Update physics
      physics.update(balls, walls, pins);

      // Check hazard collisions
      for (const ball of balls) {
        if (ball.collected || ball.destroyed) continue;

        for (const hazard of hazards) {
          if (checkCollision(ball, hazard)) {
            ball.destroyed = true;
          }
        }
      }

      // Check goal collisions
      for (const ball of balls) {
        if (ball.collected || ball.destroyed) continue;

        for (const goal of goals) {
          if (checkCollision(ball, goal)) {
            ball.collected = true;
          }
        }
      }

      // Check if simulation should end
      const activeBalls = balls.filter(b => !b.collected && !b.destroyed);
      const allSettled = activeBalls.every(b =>
        Math.abs(b.vx) < 0.1 && Math.abs(b.vy) < 0.1
      );
      const outOfBounds = activeBalls.filter(b => b.y > GRID.height + 50);

      if (activeBalls.length === 0 || (allSettled && outOfBounds.length === activeBalls.length)) {
        break;
      }

      step++;
    }

    // Count collected balls
    const collected = balls.filter(b => b.collected).length;
    const destroyed = balls.filter(b => b.destroyed).length;

    // Level is solvable if at least half the balls can be collected
    // and not all balls are destroyed
    const solvable = collected >= Math.ceil(level.requiredBalls * 0.5) &&
                     destroyed < balls.length;

    return solvable;
  }

  /**
   * Check collision between ball and rectangular area
   */
  function checkCollision(ball, rect) {
    return ball.x > rect.x &&
           ball.x < rect.x + rect.width &&
           ball.y > rect.y &&
           ball.y < rect.y + rect.height;
  }

  /**
   * Generate a fallback guaranteed-solvable level
   */
  function generateFallbackLevel(seed, difficulty) {
    const rng = createRNG(seed);
    const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.medium;

    const ballCount = rng.int(2, 3);
    const balls = [];
    const types = Object.keys(BALL_TYPES);

    for (let i = 0; i < ballCount; i++) {
      balls.push({
        id: `ball_${i}`,
        x: 150 + (i - ballCount / 2) * 30,
        y: 50 + i * 15,
        radius: 12,
        type: rng.pick(types)
      });
    }

    return {
      id: `fallback_${seed}`,
      grid: { width: GRID.width, height: GRID.height },
      balls,
      pins: [
        { id: 'pin_0', x: 150, y: 100, length: 80, angle: 0 }
      ],
      hazards: [],
      goals: [
        { id: 'goal_0', x: 100, y: 350, width: 100, height: 40, required: ballCount }
      ],
      walls: [
        { x1: 50, y1: 30, x2: 50, y2: 340 },
        { x1: 250, y1: 30, x2: 250, y2: 340 }
      ],
      requiredBalls: ballCount,
      difficulty,
      generated: true,
      fallback: true
    };
  }

  /**
   * Get the last generated level
   */
  function getLastGenerated() {
    return lastGeneratedLevel;
  }

  /**
   * Get available difficulty presets
   */
  function getDifficultyPresets() {
    return { ...DIFFICULTY_PRESETS };
  }

  return {
    generate,
    generateDaily,
    validateLevel,
    getLastGenerated,
    getDifficultyPresets
  };
}

// Default export with a default generator instance
const defaultGenerator = createGenerator();

// Named exports for constants
export { GRID, DIFFICULTY_PRESETS };

export default {
  createGenerator,
  generate: (seed, difficulty) => defaultGenerator.generate(seed, difficulty),
  generateDaily: (seed) => defaultGenerator.generateDaily(seed),
  validateLevel: (level) => defaultGenerator.validateLevel(level),
  DIFFICULTY_PRESETS,
  GRID
};
