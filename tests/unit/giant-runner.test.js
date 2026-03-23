/**
 * Giant Runner — Unit Tests
 *
 * Tests pure state functions: createInitialState, advance, collect,
 * hitObstacle, startBoss, resolveBoss, steer, collision detection,
 * win/lose, calculateStars, cloneState.
 */

import { describe, it, expect } from 'vitest';
import {
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
  createGameHistory,
  MIN_SCALE,
  DEFAULT_START_SCALE,
  LANE_MIN,
  LANE_MAX,
  PLAYER_COLORS,
  COLLECTIBLE_COLORS,
} from '../../src/games/giant-runner/state.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeLevel(overrides = {}) {
  return {
    startScale: 1.0,
    playerColor: 'blue',
    courseLength: 400,
    speed: 3,
    collectibles: [
      { x: 0, z: 100, value: 0.5, color: 'blue' },
      { x: 1, z: 200, value: 0.3, color: 'red' },
    ],
    obstacles: [
      { x: 0, z: 150, width: 1.0 },
    ],
    boss: { z: 400, scale: 1.5 },
    ...overrides,
  };
}

// ── Constants ─────────────────────────────────────────────────────────────

describe('constants', () => {
  it('MIN_SCALE is positive and small', () => {
    expect(MIN_SCALE).toBeGreaterThan(0);
    expect(MIN_SCALE).toBeLessThan(1);
  });

  it('DEFAULT_START_SCALE is 1.0', () => {
    expect(DEFAULT_START_SCALE).toBe(1.0);
  });

  it('LANE_MIN is negative', () => {
    expect(LANE_MIN).toBeLessThan(0);
  });

  it('LANE_MAX is positive', () => {
    expect(LANE_MAX).toBeGreaterThan(0);
  });

  it('PLAYER_COLORS has at least 3 colors', () => {
    expect(Object.keys(PLAYER_COLORS).length).toBeGreaterThanOrEqual(3);
  });

  it('COLLECTIBLE_COLORS includes blue and red', () => {
    expect(COLLECTIBLE_COLORS.blue).toBeDefined();
    expect(COLLECTIBLE_COLORS.red).toBeDefined();
  });
});

// ── createInitialState ─────────────────────────────────────────────────────

describe('createInitialState', () => {
  it('sets player scale from level startScale', () => {
    const state = createInitialState(makeLevel({ startScale: 2.0 }));
    expect(state.player.scale).toBe(2.0);
  });

  it('defaults player scale to DEFAULT_START_SCALE', () => {
    const level = makeLevel();
    delete level.startScale;
    const state = createInitialState(level);
    expect(state.player.scale).toBe(DEFAULT_START_SCALE);
  });

  it('sets player color from level', () => {
    const state = createInitialState(makeLevel({ playerColor: 'red' }));
    expect(state.player.color).toBe('red');
  });

  it('defaults player color to blue', () => {
    const level = makeLevel();
    delete level.playerColor;
    const state = createInitialState(level);
    expect(state.player.color).toBe('blue');
  });

  it('starts player at position (0, 0)', () => {
    const state = createInitialState(makeLevel());
    expect(state.player.x).toBe(0);
    expect(state.player.z).toBe(0);
  });

  it('sets status to "running"', () => {
    const state = createInitialState(makeLevel());
    expect(state.status).toBe('running');
  });

  it('starts time at 0', () => {
    const state = createInitialState(makeLevel());
    expect(state.time).toBe(0);
  });

  it('copies collectibles and marks them not collected', () => {
    const state = createInitialState(makeLevel());
    expect(state.collectibles).toHaveLength(2);
    expect(state.collectibles.every(c => c.collected === false)).toBe(true);
  });

  it('copies obstacles and marks them not hit', () => {
    const state = createInitialState(makeLevel());
    expect(state.obstacles).toHaveLength(1);
    expect(state.obstacles[0].hit).toBe(false);
  });

  it('handles level with no obstacles', () => {
    const level = makeLevel();
    delete level.obstacles;
    const state = createInitialState(level);
    expect(state.obstacles).toEqual([]);
  });

  it('handles level with no collectibles', () => {
    const level = makeLevel();
    level.collectibles = [];
    const state = createInitialState(level);
    expect(state.collectibles).toEqual([]);
  });

  it('does not mutate original collectibles', () => {
    const level = makeLevel();
    const orig = level.collectibles[0];
    createInitialState(level);
    expect(level.collectibles[0]).toBe(orig);
  });

  it('sets courseLength from level', () => {
    const state = createInitialState(makeLevel({ courseLength: 600 }));
    expect(state.courseLength).toBe(600);
  });

  it('defaults courseLength to 400 when not provided', () => {
    const level = makeLevel();
    delete level.courseLength;
    const state = createInitialState(level);
    expect(state.courseLength).toBe(400);
  });

  it('defaults speed to 3 when not provided', () => {
    const level = makeLevel();
    delete level.speed;
    const state = createInitialState(level);
    expect(state.speed).toBe(3);
  });
});

// ── advance ────────────────────────────────────────────────────────────────

describe('advance', () => {
  it('increments player z position', () => {
    const state = createInitialState(makeLevel());
    const next = advance(state, 1 / 60);
    expect(next.player.z).toBeGreaterThan(0);
  });

  it('increments time', () => {
    const state = createInitialState(makeLevel());
    const next = advance(state, 0.5);
    expect(next.time).toBe(0.5);
  });

  it('does not advance when status is not "running"', () => {
    const state = { ...createInitialState(makeLevel()), status: 'won' };
    const next = advance(state, 1 / 60);
    expect(next).toBe(state);
  });

  it('transitions to boss_fight when reaching boss.z', () => {
    const level = makeLevel({ speed: 1000, courseLength: 50 });
    level.boss = { z: 10, scale: 1.5 };
    level.collectibles = [];
    level.obstacles = [];
    const state = createInitialState(level);
    const next = advance(state, 1);
    expect(next.status).toBe('boss_fight');
  });

  it('clamps player.z to boss.z on boss encounter', () => {
    const level = makeLevel({ speed: 1000 });
    level.boss = { z: 5, scale: 1.5 };
    level.collectibles = [];
    level.obstacles = [];
    const state = createInitialState(level);
    const next = advance(state, 1);
    expect(next.player.z).toBe(5);
  });

  it('does not mutate original state', () => {
    const state = createInitialState(makeLevel());
    const origZ = state.player.z;
    advance(state, 1);
    expect(state.player.z).toBe(origZ);
  });
});

// ── steer ─────────────────────────────────────────────────────────────────

describe('steer', () => {
  it('moves player x by delta', () => {
    const state = createInitialState(makeLevel());
    const next = steer(state, 1.0);
    expect(next.player.x).toBe(1.0);
  });

  it('clamps to LANE_MAX', () => {
    const state = createInitialState(makeLevel());
    const next = steer(state, 100);
    expect(next.player.x).toBe(LANE_MAX);
  });

  it('clamps to LANE_MIN', () => {
    const state = createInitialState(makeLevel());
    const next = steer(state, -100);
    expect(next.player.x).toBe(LANE_MIN);
  });

  it('does not steer when game is over', () => {
    const state = { ...createInitialState(makeLevel()), status: 'won' };
    const next = steer(state, 2);
    expect(next.player.x).toBe(0);
  });

  it('does not steer when boss_fight', () => {
    const state = { ...createInitialState(makeLevel()), status: 'boss_fight' };
    const next = steer(state, 2);
    expect(next.player.x).toBe(0);
  });

  it('does not mutate original state', () => {
    const state = createInitialState(makeLevel());
    steer(state, 1);
    expect(state.player.x).toBe(0);
  });
});

// ── collect ────────────────────────────────────────────────────────────────

describe('collect', () => {
  it('grows scale when color matches player', () => {
    const level = makeLevel();
    level.collectibles = [{ x: 0, z: 100, value: 0.5, color: 'blue' }];
    const state = createInitialState(level);
    const next = collect(state, 0);
    expect(next.player.scale).toBeCloseTo(1.5);
  });

  it('shrinks scale when color does not match', () => {
    const level = makeLevel();
    level.collectibles = [{ x: 0, z: 100, value: 0.5, color: 'red' }];
    const state = createInitialState(level);
    const next = collect(state, 0);
    expect(next.player.scale).toBeCloseTo(0.5);
  });

  it('marks collectible as collected', () => {
    const state = createInitialState(makeLevel());
    const next = collect(state, 0);
    expect(next.collectibles[0].collected).toBe(true);
  });

  it('value=0 on matching color leaves scale unchanged (scaleDelta=0, no penalty branch)', () => {
    const level = makeLevel();
    level.collectibles = [{ x: 0, z: 100, value: 0, color: 'blue' }];
    const state = createInitialState(level);
    const next = collect(state, 0);
    expect(next.player.scale).toBeCloseTo(1.0); // 1.0 + 0 = 1.0
    expect(next.collectibles[0].collected).toBe(true);
  });

  it('does not re-collect an already collected item', () => {
    const state = createInitialState(makeLevel());
    const next1 = collect(state, 0);
    const scaleBefore = next1.player.scale;
    const next2 = collect(next1, 0);
    expect(next2.player.scale).toBe(scaleBefore);
  });

  it('floors scale at MIN_SCALE after wrong-color penalty', () => {
    const level = makeLevel();
    level.startScale = MIN_SCALE + 0.01;
    level.collectibles = [{ x: 0, z: 100, value: 1.0, color: 'red' }];
    const state = createInitialState(level);
    const next = collect(state, 0);
    expect(next.player.scale).toBe(MIN_SCALE);
  });

  it('returns unchanged state for invalid index', () => {
    const state = createInitialState(makeLevel());
    const next = collect(state, 99);
    expect(next).toBe(state);
  });

  it('returns unchanged state for negative index (< 0 branch)', () => {
    const state = createInitialState(makeLevel());
    expect(collect(state, -1)).toBe(state);
  });

  it('does not mutate original state', () => {
    const state = createInitialState(makeLevel());
    const origScale = state.player.scale;
    collect(state, 0);
    expect(state.player.scale).toBe(origScale);
  });
});

// ── hitObstacle ────────────────────────────────────────────────────────────

describe('hitObstacle', () => {
  it('reduces player scale by 0.2', () => {
    const state = createInitialState(makeLevel());
    const next = hitObstacle(state, 0);
    expect(next.player.scale).toBeCloseTo(0.8);
  });

  it('marks obstacle as hit', () => {
    const state = createInitialState(makeLevel());
    const next = hitObstacle(state, 0);
    expect(next.obstacles[0].hit).toBe(true);
  });

  it('does not re-hit an already hit obstacle', () => {
    const state = createInitialState(makeLevel());
    const next1 = hitObstacle(state, 0);
    const scaleBefore = next1.player.scale;
    const next2 = hitObstacle(next1, 0);
    expect(next2.player.scale).toBe(scaleBefore);
  });

  it('floors scale at MIN_SCALE', () => {
    const level = makeLevel({ startScale: MIN_SCALE + 0.1 });
    const state = createInitialState(level);
    const next = hitObstacle(state, 0);
    expect(next.player.scale).toBe(MIN_SCALE);
  });

  it('reduces scale to intermediate value when well above MIN_SCALE', () => {
    // scale 0.5 − 0.2 = 0.3, which is above MIN_SCALE
    const level = makeLevel({ startScale: 0.5 });
    const state = createInitialState(level);
    const next = hitObstacle(state, 0);
    expect(next.player.scale).toBeCloseTo(0.3);
  });

  it('returns unchanged state for invalid index', () => {
    const state = createInitialState(makeLevel());
    const next = hitObstacle(state, 99);
    expect(next).toBe(state);
  });

  it('returns unchanged state for negative index (< 0 branch)', () => {
    const state = createInitialState(makeLevel());
    const next = hitObstacle(state, -1);
    expect(next).toBe(state);
  });

  it('returns unchanged state when no obstacles array', () => {
    const level = makeLevel();
    delete level.obstacles;
    const state = createInitialState(level);
    const next = hitObstacle(state, 0);
    expect(next).toBe(state);
  });
});

// ── startBoss / resolveBoss ────────────────────────────────────────────────

describe('startBoss', () => {
  it('transitions from "running" to "boss_fight"', () => {
    const state = createInitialState(makeLevel());
    const next = startBoss(state);
    expect(next.status).toBe('boss_fight');
  });

  it('is a no-op when not "running"', () => {
    const state = { ...createInitialState(makeLevel()), status: 'boss_fight' };
    const next = startBoss(state);
    expect(next).toBe(state);
  });
});

describe('resolveBoss', () => {
  it('returns "won" when player scale > boss scale', () => {
    const state = {
      ...createInitialState(makeLevel()),
      status: 'boss_fight',
      player: { ...createInitialState(makeLevel()).player, scale: 2.0 },
    };
    const next = resolveBoss(state);
    expect(next.status).toBe('won');
  });

  it('returns "lost" when player scale <= boss scale', () => {
    const level = makeLevel();
    level.boss = { z: 400, scale: 5.0 };
    const state = { ...createInitialState(level), status: 'boss_fight' };
    const next = resolveBoss(state);
    expect(next.status).toBe('lost');
  });

  it('returns "lost" when player scale equals boss scale (condition is >, not >=)', () => {
    const level = makeLevel();
    level.boss = { z: 400, scale: 2.0 };
    const state = {
      ...createInitialState(level),
      status: 'boss_fight',
      player: { ...createInitialState(level).player, scale: 2.0 },
    };
    const next = resolveBoss(state);
    expect(next.status).toBe('lost');
  });

  it('is a no-op when not in boss_fight', () => {
    const state = createInitialState(makeLevel()); // status: 'running'
    const next = resolveBoss(state);
    expect(next).toBe(state);
  });
});

// ── collision detection ────────────────────────────────────────────────────

describe('checkCollectibleCollisions', () => {
  it('returns empty array when no collectibles overlap', () => {
    const state = createInitialState(makeLevel());
    // Player at z=0, collectibles at z=100, 200 — far away
    const collisions = checkCollectibleCollisions(state);
    expect(collisions).toHaveLength(0);
  });

  it('returns index when player overlaps collectible', () => {
    const level = makeLevel();
    level.collectibles = [{ x: 0, z: 0, value: 0.5, color: 'blue' }];
    const state = createInitialState(level);
    // Player at x=0,z=0, collectible at x=0,z=0 — direct overlap
    const collisions = checkCollectibleCollisions(state);
    expect(collisions).toContain(0);
  });

  it('ignores already-collected items', () => {
    const level = makeLevel();
    level.collectibles = [{ x: 0, z: 0, value: 0.5, color: 'blue' }];
    const state = createInitialState(level);
    const stateCollected = collect(state, 0);
    const collisions = checkCollectibleCollisions(stateCollected);
    expect(collisions).not.toContain(0);
  });
});

describe('checkObstacleCollisions', () => {
  it('returns empty array when no obstacles overlap', () => {
    const state = createInitialState(makeLevel());
    // Player at z=0, obstacle at z=150 — far away
    const collisions = checkObstacleCollisions(state);
    expect(collisions).toHaveLength(0);
  });

  it('returns empty array when obstacles array is absent', () => {
    const level = makeLevel();
    delete level.obstacles;
    const state = createInitialState(level);
    const collisions = checkObstacleCollisions(state);
    expect(collisions).toHaveLength(0);
  });

  it('ignores already-hit obstacles', () => {
    const level = makeLevel();
    level.obstacles = [{ x: 0, z: 0, width: 5.0 }];
    const state = createInitialState(level);
    const stateHit = hitObstacle(state, 0);
    const collisions = checkObstacleCollisions(stateHit);
    expect(collisions).not.toContain(0);
  });

  it('returns obstacle index when player overlaps it', () => {
    // Player at z=0, x=0; obstacle at z=0, x=0, width=5 — direct overlap
    const level = makeLevel();
    level.obstacles = [{ x: 0, z: 0, width: 5.0 }];
    const state = createInitialState(level); // player at z=0, x=0
    const collisions = checkObstacleCollisions(state);
    expect(collisions).toContain(0);
    expect(collisions).toHaveLength(1);
  });
});

// ── win / lose / isGameOver ────────────────────────────────────────────────

describe('checkWin / checkLose / isGameOver', () => {
  it('checkWin returns true when status is "won"', () => {
    const state = { ...createInitialState(makeLevel()), status: 'won' };
    expect(checkWin(state)).toBe(true);
  });

  it('checkWin returns false otherwise', () => {
    expect(checkWin(createInitialState(makeLevel()))).toBe(false);
  });

  it('checkLose returns true when status is "lost"', () => {
    const state = { ...createInitialState(makeLevel()), status: 'lost' };
    expect(checkLose(state)).toBe(true);
  });

  it('checkLose returns false otherwise', () => {
    expect(checkLose(createInitialState(makeLevel()))).toBe(false);
  });

  it('isGameOver returns false while running', () => {
    expect(isGameOver(createInitialState(makeLevel()))).toBe(false);
  });

  it('isGameOver returns true when won', () => {
    expect(isGameOver({ ...createInitialState(makeLevel()), status: 'won' })).toBe(true);
  });

  it('isGameOver returns true when lost', () => {
    expect(isGameOver({ ...createInitialState(makeLevel()), status: 'lost' })).toBe(true);
  });
});

// ── calculateStars ─────────────────────────────────────────────────────────

describe('calculateStars', () => {
  it('gives 3 stars when playerScale >= 1.5x bossScale', () => {
    expect(calculateStars(3.0, 2.0)).toBe(3);
    expect(calculateStars(1.5, 1.0)).toBe(3);
  });

  it('gives 2 stars when playerScale is between 1.2x and 1.5x bossScale', () => {
    expect(calculateStars(1.2, 1.0)).toBe(2);
    expect(calculateStars(1.4, 1.0)).toBe(2);
  });

  it('gives 1 star when playerScale is just above bossScale', () => {
    expect(calculateStars(1.1, 1.0)).toBe(1);
    expect(calculateStars(1.01, 1.0)).toBe(1);
  });
});

// ── cloneState ─────────────────────────────────────────────────────────────

describe('cloneState', () => {
  it('produces a deep copy of player', () => {
    const state = createInitialState(makeLevel());
    const clone = cloneState(state);
    expect(clone.player).not.toBe(state.player);
    expect(clone.player.scale).toBe(state.player.scale);
  });

  it('produces a deep copy of collectibles', () => {
    const state = createInitialState(makeLevel());
    const clone = cloneState(state);
    expect(clone.collectibles).not.toBe(state.collectibles);
    expect(clone.collectibles[0]).not.toBe(state.collectibles[0]);
  });

  it('produces a deep copy of obstacles', () => {
    const state = createInitialState(makeLevel());
    const clone = cloneState(state);
    expect(clone.obstacles).not.toBe(state.obstacles);
  });

  it('mutating clone does not affect original', () => {
    const state = createInitialState(makeLevel());
    const clone = cloneState(state);
    clone.player.scale = 99;
    expect(state.player.scale).toBe(1.0);
  });
});

describe('createGameHistory', () => {
  it('returns an object with push, undo, and canUndo', () => {
    const h = createGameHistory();
    expect(typeof h.push).toBe('function');
    expect(typeof h.undo).toBe('function');
    expect(typeof h.canUndo).toBe('function');
  });

  it('canUndo is false on an empty history', () => {
    expect(createGameHistory().canUndo()).toBe(false);
  });

  it('canUndo is false after a single push (no previous state)', () => {
    const h = createGameHistory();
    h.push({ player: { scale: 1 } });
    expect(h.canUndo()).toBe(false);
  });

  it('canUndo is true after two pushes', () => {
    const h = createGameHistory();
    h.push({ player: { scale: 1 } });
    h.push({ player: { scale: 1.5 } });
    expect(h.canUndo()).toBe(true);
  });

  it('undo returns the previous state', () => {
    const h = createGameHistory();
    const s1 = createInitialState(makeLevel());
    const s2 = cloneState(s1);
    s2.player.scale = 2.0;
    h.push(s1);
    h.push(s2);
    const restored = h.undo();
    expect(restored.player.scale).toBe(s1.player.scale);
  });

  it('undo returns null when nothing to undo', () => {
    const h = createGameHistory();
    expect(h.undo()).toBeNull();
  });

  it('respects custom maxDepth — evicts oldest when full', () => {
    const h = createGameHistory(3);
    h.push('a');
    h.push('b');
    h.push('c');
    h.push('d'); // 'd' evicts 'a'
    // can undo at most maxDepth−1 = 2 times
    h.undo(); // back to 'c'
    h.undo(); // back to 'b'
    expect(h.canUndo()).toBe(false); // 'a' was evicted
  });
});
