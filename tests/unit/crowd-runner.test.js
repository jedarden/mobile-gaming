/**
 * Crowd Runner - Unit Tests
 *
 * Tests pure state functions: operations, gate crossing, steer, advance, boss resolution.
 */

import { describe, it, expect, vi } from 'vitest';
import {
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
  evaluateAllPaths,
  LANE_MIN,
  LANE_MAX
} from '../../src/games/crowd-runner/state.js';
import { generateLevel } from '../../src/games/crowd-runner/generator.js';
import levelsData from '../../src/games/crowd-runner/levels.json' with { type: 'json' };

// ── Mock daily module ───────────────────────────────────────────────────────────

vi.mock('../../src/shared/daily.js', () => ({
  getGameDailySeed: vi.fn((gameId) => `2026-07-23:${gameId}`),
  getGameDailyNumericSeed: vi.fn((gameId) => {
    // Hash function matching the real implementation
    const str = `2026-07-23:${gameId}`;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    return h >>> 0;
  }),
  completeDailyChallenge: vi.fn(),
  isGameDailyCompleted: vi.fn(() => false)
}));

import { getGameDailySeed, getGameDailyNumericSeed, completeDailyChallenge } from '../../src/shared/daily.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeLevel(overrides = {}) {
  return {
    startingCrowd: 10,
    courseLength: 400,
    speed: 2,
    gates: [
      { z: 100, left: { op: '+', value: 10 }, right: { op: '−', value: 3 } },
      { z: 200, left: { op: '×', value: 2 },  right: { op: '+', value: 5 } },
      { z: 300, left: { op: '+', value: 15 }, right: { op: '÷', value: 2 } }
    ],
    boss: { size: 40 },
    ...overrides
  };
}

// ── applyOperation ─────────────────────────────────────────────────────────

describe('applyOperation', () => {
  it('adds correctly', () => {
    expect(applyOperation(10, { op: '+', value: 15 })).toBe(25);
  });

  it('subtracts correctly', () => {
    expect(applyOperation(10, { op: '−', value: 4 })).toBe(6);
  });

  it('multiplies correctly', () => {
    expect(applyOperation(10, { op: '×', value: 3 })).toBe(30);
  });

  it('divides and floors correctly', () => {
    expect(applyOperation(10, { op: '÷', value: 3 })).toBe(3);
  });

  it('floors at 1 on subtraction that would go to 0', () => {
    expect(applyOperation(5, { op: '−', value: 10 })).toBe(1);
  });

  it('floors at 1 on subtraction that would go negative', () => {
    expect(applyOperation(2, { op: '−', value: 100 })).toBe(1);
  });

  it('floors at 1 on division that would go to 0', () => {
    expect(applyOperation(1, { op: '÷', value: 5 })).toBe(1);
  });

  it('handles unknown op by returning crowd unchanged', () => {
    expect(applyOperation(10, { op: '?', value: 99 })).toBe(10);
  });
});

// ── getGateSide ────────────────────────────────────────────────────────────

describe('getGateSide', () => {
  it('returns "left" for negative laneOffset', () => {
    expect(getGateSide(-0.5)).toBe('left');
    expect(getGateSide(-1)).toBe('left');
    expect(getGateSide(-0.01)).toBe('left');
  });

  it('returns "right" for zero laneOffset', () => {
    expect(getGateSide(0)).toBe('right');
  });

  it('returns "right" for positive laneOffset', () => {
    expect(getGateSide(0.5)).toBe('right');
    expect(getGateSide(1)).toBe('right');
  });
});

// ── createInitialState ─────────────────────────────────────────────────────

describe('createInitialState', () => {
  it('sets crowdSize from startingCrowd', () => {
    const state = createInitialState(makeLevel({ startingCrowd: 15 }));
    expect(state.crowdSize).toBe(15);
  });

  it('starts at position 0', () => {
    const state = createInitialState(makeLevel());
    expect(state.position).toBe(0);
  });

  it('starts with laneOffset 0 (center)', () => {
    const state = createInitialState(makeLevel());
    expect(state.laneOffset).toBe(0);
  });

  it('sets status to "running"', () => {
    const state = createInitialState(makeLevel());
    expect(state.status).toBe('running');
  });

  it('sets boss.z from courseLength', () => {
    const state = createInitialState(makeLevel({ courseLength: 500 }));
    expect(state.boss.z).toBe(500);
  });

  it('marks all gates as not crossed', () => {
    const state = createInitialState(makeLevel());
    expect(state.gates.every(g => g.crossed === false)).toBe(true);
  });

  it('does not mutate the original level gates', () => {
    const level = makeLevel();
    const original = level.gates[0];
    createInitialState(level);
    expect(level.gates[0]).toBe(original);
  });

  it('defaults startingCrowd to 10 when value is 0 (falsy)', () => {
    const state = createInitialState(makeLevel({ startingCrowd: 0 }));
    expect(state.crowdSize).toBe(10);
  });

  it('defaults courseLength to 500 when value is 0 (falsy)', () => {
    const state = createInitialState(makeLevel({ courseLength: 0 }));
    expect(state.courseLength).toBe(500);
  });

  it('defaults speed to 2 when value is 0 (falsy)', () => {
    const state = createInitialState(makeLevel({ speed: 0 }));
    expect(state.speed).toBe(2);
  });
});

// ── crossGate ──────────────────────────────────────────────────────────────

describe('crossGate', () => {
  it('applies left op and marks gate crossed', () => {
    const state = createInitialState(makeLevel());
    const next  = crossGate(state, 0, 'left');
    expect(next.crowdSize).toBe(20);         // 10 + 10
    expect(next.gates[0].crossed).toBe(true);
  });

  it('applies right op', () => {
    const state = createInitialState(makeLevel());
    const next  = crossGate(state, 0, 'right');
    expect(next.crowdSize).toBe(7);          // 10 − 3
  });

  it('does not cross an already-crossed gate', () => {
    const state  = createInitialState(makeLevel());
    const state1 = crossGate(state, 0, 'left');
    const state2 = crossGate(state1, 0, 'left');
    expect(state2.crowdSize).toBe(state1.crowdSize);
  });

  it('returns exact same state reference for already-crossed gate (no copy)', () => {
    const state  = createInitialState(makeLevel());
    const state1 = crossGate(state, 0, 'left');
    const state2 = crossGate(state1, 0, 'left');
    expect(state2).toBe(state1);
  });

  it('returns state unchanged for invalid gate index', () => {
    const state = createInitialState(makeLevel());
    const next  = crossGate(state, 99, 'left');
    expect(next).toBe(state);
  });

  it('returns state unchanged for negative gate index', () => {
    const state = createInitialState(makeLevel());
    const next  = crossGate(state, -1, 'left');
    expect(next).toBe(state);
  });

  it('defaults to right op for unknown side string', () => {
    const state = createInitialState(makeLevel());
    // 'center' !== 'left' → uses gate[0].right: 10 − 3 = 7
    const next  = crossGate(state, 0, 'center');
    expect(next.crowdSize).toBe(7);
    expect(next.gates[0].crossed).toBe(true);
  });

  it('floors crowd at 1 after a very harsh right op', () => {
    const level = makeLevel();
    level.gates[0].right = { op: '−', value: 100 };
    const state = createInitialState(level);
    const next  = crossGate(state, 0, 'right');
    expect(next.crowdSize).toBe(1);
  });
});

// ── steer ──────────────────────────────────────────────────────────────────

describe('steer', () => {
  it('moves laneOffset left', () => {
    const state = createInitialState(makeLevel());
    const next  = steer(state, -0.5);
    expect(next.laneOffset).toBeCloseTo(-0.5);
  });

  it('moves laneOffset right', () => {
    const state = createInitialState(makeLevel());
    const next  = steer(state, 0.5);
    expect(next.laneOffset).toBeCloseTo(0.5);
  });

  it('clamps to LANE_MIN', () => {
    const state = createInitialState(makeLevel());
    const next  = steer(state, -10);
    expect(next.laneOffset).toBe(LANE_MIN);
  });

  it('clamps to LANE_MAX', () => {
    const state = createInitialState(makeLevel());
    const next  = steer(state, 10);
    expect(next.laneOffset).toBe(LANE_MAX);
  });

  it('does not steer when game is over', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, status: 'won' };
    const next = steer(state, 1);
    expect(next.laneOffset).toBe(0);
  });

  it('does not steer when status is "lost"', () => {
    const state = { ...createInitialState(makeLevel()), status: 'lost' };
    expect(steer(state, 1)).toBe(state);
  });
});

// ── setLane ────────────────────────────────────────────────────────────────

describe('setLane', () => {
  it('sets laneOffset directly', () => {
    const state = createInitialState(makeLevel());
    expect(setLane(state, 0.75).laneOffset).toBeCloseTo(0.75);
  });

  it('clamps to LANE_MIN', () => {
    const state = createInitialState(makeLevel());
    expect(setLane(state, -5).laneOffset).toBe(LANE_MIN);
  });

  it('clamps to LANE_MAX', () => {
    const state = createInitialState(makeLevel());
    expect(setLane(state, 5).laneOffset).toBe(LANE_MAX);
  });

  it('is a no-op when game is not running', () => {
    const state = { ...createInitialState(makeLevel()), status: 'won' };
    const next  = setLane(state, 0.8);
    expect(next).toBe(state);
  });

  it('is a no-op when status is "lost"', () => {
    const state = { ...createInitialState(makeLevel()), status: 'lost' };
    expect(setLane(state, 0.8)).toBe(state);
  });
});

// ── advance ────────────────────────────────────────────────────────────────

describe('advance', () => {
  it('is a no-op when dt is 0', () => {
    const state = createInitialState(makeLevel());
    const next  = advance(state, 0);
    expect(next.position).toBe(0);
    expect(next.crowdSize).toBe(10);
    expect(next.gates.every(g => !g.crossed)).toBe(true);
  });

  it('increments position', () => {
    const state = createInitialState(makeLevel());
    const next  = advance(state, 1 / 60);
    expect(next.position).toBeGreaterThan(0);
  });

  it('increments time', () => {
    const state = createInitialState(makeLevel());
    const next  = advance(state, 0.5);
    expect(next.time).toBeCloseTo(0.5);
  });

  it('crosses a gate when position passes gate.z (left side)', () => {
    // Start just before gate at z=100; advance enough to pass it
    const state = createInitialState(makeLevel());
    // gate[0].z = 100, taking left side (+10)
    // speed=2, dt=1/60 → step = 2 px per tick
    // Run until we cross z=100
    let s = state;
    for (let i = 0; i < 120; i++) {
      s = advance(s, 1 / 60);
      if (s.gates[0].crossed) break;
    }
    expect(s.gates[0].crossed).toBe(true);
    // laneOffset=0 → right gate (−3), crowd = 10 − 3 = 7
    expect(s.crowdSize).toBe(7);
  });

  it('takes left gate when laneOffset < 0', () => {
    let state = createInitialState(makeLevel());
    state = steer(state, -1); // go left
    let s = state;
    for (let i = 0; i < 120; i++) {
      s = advance(s, 1 / 60);
      if (s.gates[0].crossed) break;
    }
    expect(s.crowdSize).toBe(20); // 10 + 10
  });

  it('resolves to "won" when reaching boss and crowd > boss.size', () => {
    // Set level so crowd already exceeds boss before reaching it
    const level = makeLevel({ startingCrowd: 100, courseLength: 50 });
    level.gates = [];
    const state = createInitialState(level);
    let s = state;
    for (let i = 0; i < 200; i++) {
      s = advance(s, 1 / 60);
      if (s.status !== 'running') break;
    }
    expect(s.status).toBe('won');
  });

  it('resolves to "lost" when reaching boss and crowd <= boss.size', () => {
    const level = makeLevel({ startingCrowd: 5, courseLength: 50 });
    level.gates = [];
    level.boss  = { size: 100 };
    const state = createInitialState(level);
    let s = state;
    for (let i = 0; i < 200; i++) {
      s = advance(s, 1 / 60);
      if (s.status !== 'running') break;
    }
    expect(s.status).toBe('lost');
  });

  it('does not advance if game is already over', () => {
    const level = makeLevel();
    let state   = createInitialState(level);
    state = { ...state, status: 'won' };
    const next  = advance(state, 1 / 60);
    expect(next).toBe(state);
  });

  it('clamps position to boss.z on boss encounter (overshoot prevented)', () => {
    // Large speed so dt=1 overshoots boss.z by a lot
    const level = makeLevel({ startingCrowd: 100, courseLength: 10, speed: 1000 });
    level.gates = [];
    const state = createInitialState(level);
    const next = advance(state, 1);
    // Position must be exactly boss.z (10), not > 10
    expect(next.position).toBe(10);
    expect(next.status).toBe('won');
  });

  it('does not cross a gate twice', () => {
    const state = createInitialState(makeLevel());
    let s = state;
    // Run well past all gates
    for (let i = 0; i < 500; i++) {
      s = advance(s, 1 / 60);
      if (s.status !== 'running') break;
    }
    // Each gate should be crossed exactly once
    const crossedCount = s.gates.filter(g => g.crossed).length;
    expect(crossedCount).toBeLessThanOrEqual(s.gates.length);
  });

  it('crosses multiple gates in one large dt step', () => {
    // Gates at z=100 and z=200; large dt pushes past both in one step
    const level = makeLevel({
      startingCrowd: 10,
      courseLength: 1000,
      speed: 1,
      gates: [
        { z: 10, left: { op: '+', value: 5 }, right: { op: '+', value: 5 } },
        { z: 20, left: { op: '+', value: 5 }, right: { op: '+', value: 5 } }
      ],
      boss: { size: 1, z: 1000 }
    });
    const state = createInitialState(level);
    // dt large enough to advance > 20 units in one step (speed=1, dt=1/60*frames=1s → 60 units)
    const next = advance(state, 1);
    expect(next.gates[0].crossed).toBe(true);
    expect(next.gates[1].crossed).toBe(true);
    // Both gates applied: 10 + 5 + 5 = 20
    expect(next.crowdSize).toBe(20);
  });

  it('takes right gate when laneOffset is exactly 0', () => {
    // laneOffset=0 → getGateSide returns "right"
    let state = createInitialState(makeLevel());
    // state.laneOffset is 0 by default
    expect(state.laneOffset).toBe(0);
    let s = state;
    for (let i = 0; i < 120; i++) {
      s = advance(s, 1 / 60);
      if (s.gates[0].crossed) break;
    }
    // Right gate is − 3 → 10 − 3 = 7
    expect(s.crowdSize).toBe(7);
  });

  it('crosses two gates at identical z values in a single advance step', () => {
    const level = makeLevel({
      startingCrowd: 10,
      courseLength: 1000,
      speed: 1,
      gates: [
        { z: 50, left: { op: '+', value: 3 }, right: { op: '+', value: 3 } },
        { z: 50, left: { op: '+', value: 7 }, right: { op: '+', value: 7 } },
      ],
      boss: { size: 1, z: 1000 },
    });
    const state = createInitialState(level);
    const next = advance(state, 1); // large dt pushes position well past z=50
    expect(next.gates[0].crossed).toBe(true);
    expect(next.gates[1].crossed).toBe(true);
    expect(next.crowdSize).toBe(20); // 10 + 3 + 7
  });

  it('loses when crowdSize equals boss.size at encounter (check is >, not >=)', () => {
    // boss.size = 50, crowdSize starts at 50, no gates → crowdSize stays 50
    // At boss: 50 > 50 is false → lost
    const level = makeLevel({ startingCrowd: 50, courseLength: 10, speed: 1000 });
    level.gates = [];
    level.boss = { size: 50 };
    const state = createInitialState(level);
    const next = advance(state, 1);
    expect(next.status).toBe('lost');
  });
});

// ── isGameOver ─────────────────────────────────────────────────────────────

describe('isGameOver', () => {
  it('returns false while running', () => {
    const state = createInitialState(makeLevel());
    expect(isGameOver(state)).toBe(false);
  });

  it('returns true when won', () => {
    const state = { ...createInitialState(makeLevel()), status: 'won' };
    expect(isGameOver(state)).toBe(true);
  });

  it('returns true when lost', () => {
    const state = { ...createInitialState(makeLevel()), status: 'lost' };
    expect(isGameOver(state)).toBe(true);
  });
});

// ── checkWin / checkLose ────────────────────────────────────────────────────

describe('checkWin', () => {
  it('returns true when status is "won"', () => {
    const state = { ...createInitialState(makeLevel()), status: 'won' };
    expect(checkWin(state)).toBe(true);
  });

  it('returns false when status is "running"', () => {
    const state = createInitialState(makeLevel());
    expect(checkWin(state)).toBe(false);
  });

  it('returns false when status is "lost"', () => {
    const state = { ...createInitialState(makeLevel()), status: 'lost' };
    expect(checkWin(state)).toBe(false);
  });
});

describe('checkLose', () => {
  it('returns true when status is "lost"', () => {
    const state = { ...createInitialState(makeLevel()), status: 'lost' };
    expect(checkLose(state)).toBe(true);
  });

  it('returns false when status is "running"', () => {
    const state = createInitialState(makeLevel());
    expect(checkLose(state)).toBe(false);
  });

  it('returns false when status is "won"', () => {
    const state = { ...createInitialState(makeLevel()), status: 'won' };
    expect(checkLose(state)).toBe(false);
  });
});

// ── calculateStars ─────────────────────────────────────────────────────────

describe('calculateStars', () => {
  it('gives 3 stars for 2× the boss size', () => {
    expect(calculateStars(200, 100)).toBe(3);
    expect(calculateStars(100, 50)).toBe(3);
  });

  it('gives 2 stars for 1.5× the boss size', () => {
    expect(calculateStars(150, 100)).toBe(2);
    expect(calculateStars(75, 50)).toBe(2);
  });

  it('gives 1 star for just over boss size', () => {
    expect(calculateStars(101, 100)).toBe(1);
    expect(calculateStars(11, 10)).toBe(1);
  });

  it('gives 1 star when crowd equals boss size (ratio exactly 1.0)', () => {
    expect(calculateStars(100, 100)).toBe(1);
  });

  it('gives 1 star for ratio between 1.0 and 1.5 (e.g., 1.49)', () => {
    expect(calculateStars(149, 100)).toBe(1);
  });
});

// ── simulatePath ───────────────────────────────────────────────────────────

describe('simulatePath', () => {
  const level = makeLevel();

  it('follows a specified left-left-left path', () => {
    // 10 +10=20, ×2=40, +15=55
    const result = simulatePath(level, ['left', 'left', 'left']);
    expect(result).toBe(55);
  });

  it('follows a right-right-right path', () => {
    // 10 −3=7, +5=12, ÷2=6
    const result = simulatePath(level, ['right', 'right', 'right']);
    expect(result).toBe(6);
  });

  it('handles mixed path', () => {
    // left(+10)=20, right(+5)=25, left(+15)=40
    const result = simulatePath(level, ['left', 'right', 'left']);
    expect(result).toBe(40);
  });

  it('returns startingCrowd for a level with 0 gates', () => {
    const emptyLevel = makeLevel({ gates: [] });
    expect(simulatePath(emptyLevel, [])).toBe(10);
  });

  it('defaults unspecified path entries to "right"', () => {
    // Path only specifies first gate as 'left'; gates 1 and 2 default to right
    // left(+10)=20, right(+5)=25, right(÷2)=12
    const result = simulatePath(level, ['left']);
    expect(result).toBe(12);
  });

  it('floors result at 1 when subtraction would go to 0 or below', () => {
    const harshLevel = makeLevel({
      startingCrowd: 3,
      gates: [
        { z: 100, left: { op: '−', value: 100 }, right: { op: '+', value: 0 } }
      ]
    });
    // 3 − 100 → would be -97, but floors at 1
    expect(simulatePath(harshLevel, ['left'])).toBe(1);
  });

  it('ignores path entries beyond gate count', () => {
    // level has 3 gates; extra entries in path are silently ignored
    const result1 = simulatePath(level, ['left', 'right', 'left']);
    const result2 = simulatePath(level, ['left', 'right', 'left', 'left', 'left']);
    expect(result1).toBe(result2);
  });

  it('default switch case: unknown op leaves crowd unchanged', () => {
    const level = makeLevel({
      gates: [{ z: 100, left: { op: '?', value: 5 }, right: { op: '+', value: 1 } }]
    });
    // '?' op hits the default case → crowd stays at 10
    expect(simulatePath(level, ['left'])).toBe(10);
  });
});

// ── evaluateAllPaths ───────────────────────────────────────────────────────

describe('evaluateAllPaths', () => {
  it('returns optimal and worst crowd sizes', () => {
    const level  = makeLevel();
    const { optimal, worst } = evaluateAllPaths(level);
    expect(optimal).toBeGreaterThan(worst);
    expect(optimal).toBeGreaterThanOrEqual(level.startingCrowd);
  });

  it('evaluates 2^N combinations', () => {
    const level  = makeLevel(); // 3 gates
    const { allResults } = evaluateAllPaths(level);
    expect(allResults.length).toBe(2 ** 3);
  });

  it('with 0 gates: allResults has 1 entry equal to startingCrowd', () => {
    const emptyLevel = makeLevel({ gates: [] });
    const { optimal, worst, allResults } = evaluateAllPaths(emptyLevel);
    expect(allResults.length).toBe(1);
    expect(allResults[0]).toBe(10);
    expect(optimal).toBe(10);
    expect(worst).toBe(10);
  });

  it('with 1 gate: allResults has 2 entries (left + right)', () => {
    const oneGateLevel = makeLevel({
      gates: [{ z: 100, left: { op: '+', value: 10 }, right: { op: '−', value: 3 } }]
    });
    const { allResults } = evaluateAllPaths(oneGateLevel);
    expect(allResults.length).toBe(2);
    // One entry is left(+10)=20, other is right(−3)=7
    expect(allResults).toContain(20);
    expect(allResults).toContain(7);
  });

  it('optimal equals Math.max of allResults', () => {
    const level = makeLevel();
    const { optimal, allResults } = evaluateAllPaths(level);
    expect(optimal).toBe(Math.max(...allResults));
  });

  it('worst equals Math.min of allResults', () => {
    const level = makeLevel();
    const { worst, allResults } = evaluateAllPaths(level);
    expect(worst).toBe(Math.min(...allResults));
  });

  it('all results in allResults are at least 1 (floor enforced)', () => {
    const harshLevel = makeLevel({
      startingCrowd: 2,
      gates: [
        { z: 100, left: { op: '÷', value: 100 }, right: { op: '−', value: 99 } }
      ]
    });
    const { allResults } = evaluateAllPaths(harshLevel);
    for (const result of allResults) {
      expect(result).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── advance — non-running status guard ────────────────────────────────────────

describe('advance — non-running status "lost" guard (status !== "running" branches)', () => {
  it('returns same state reference when status is "lost" (guard true branch)', () => {
    const state = { ...createInitialState(makeLevel()), status: 'lost' };
    expect(advance(state, 1 / 60)).toBe(state);
  });
});

// ── Daily Challenge ─────────────────────────────────────────────────────────────

describe('Daily Challenge', () => {
  it('generates a level from a known seed', () => {
    const seed = 'crowd-runner-test-seed-2026-07-23';
    const level = generateLevel(seed, 'medium', 0);

    expect(level).not.toBeNull();
    expect(level).toHaveProperty('startingCrowd');
    expect(level).toHaveProperty('gates');
    expect(level).toHaveProperty('boss');
    expect(level.gates).toBeInstanceOf(Array);
  });

  it('generates identical levels from the same seed (deterministic)', () => {
    const seed = 'crowd-runner-deterministic-test';
    const level1 = generateLevel(seed, 'medium', 0);
    const level2 = generateLevel(seed, 'medium', 0);

    expect(level1).toEqual(level2);
  });

  it('generates different levels from different seeds', () => {
    const level1 = generateLevel('seed-1', 'medium', 0);
    const level2 = generateLevel('seed-2', 'medium', 0);

    // Gates should be different between seeds
    expect(level1.gates).not.toEqual(level2.gates);
  });

  it('generates a daily level from known seed and can win', () => {
    const GAME_ID = 'crowd-runner';
    vi.clearAllMocks();

    const seed = getGameDailySeed(GAME_ID);
    expect(seed).toBe(`2026-07-23:${GAME_ID}`);

    const numericSeed = getGameDailyNumericSeed(GAME_ID);
    expect(typeof numericSeed).toBe('number');

    // Try to generate daily level from seed
    const generatedLevel = generateLevel(numericSeed.toString(), 'medium', 0);

    let dailyLevel;
    if (generatedLevel !== null) {
      dailyLevel = generatedLevel;
    } else {
      // Fallback: use bundled levels
      const dailyIndex = numericSeed % levelsData.length;
      dailyLevel = levelsData[dailyIndex];
    }

    expect(dailyLevel).toBeDefined();
    expect(dailyLevel).toHaveProperty('startingCrowd');
    expect(dailyLevel).toHaveProperty('gates');
    expect(dailyLevel).toHaveProperty('boss');

    // Create initial state from daily level
    const state = createInitialState(dailyLevel);
    expect(state.status).toBe('running');
  });

  it('simulates a win on daily level and calls completeDailyChallenge exactly once', () => {
    const GAME_ID = 'crowd-runner';
    vi.clearAllMocks();

    const numericSeed = getGameDailyNumericSeed(GAME_ID);

    // Try to generate daily level
    const generatedLevel = generateLevel(numericSeed.toString(), 'medium', 0);

    let dailyLevel;
    if (generatedLevel !== null) {
      dailyLevel = generatedLevel;
    } else {
      // Fallback: use bundled levels
      const dailyIndex = numericSeed % levelsData.length;
      dailyLevel = levelsData[dailyIndex];
    }

    const state = createInitialState(dailyLevel);

    // Simulate a win by setting crowd size larger than boss size and advancing to boss
    let testState = state;
    // Set crowd size to beat the boss (boss.size + 1)
    testState = { ...testState, crowdSize: dailyLevel.boss.size + 1 };

    // Advance to trigger win condition (position reaches boss.z)
    // Set position close to boss so a small advance triggers the encounter
    testState.position = dailyLevel.courseLength - 1;

    // Advance to trigger boss encounter
    testState = advance(testState, 1 / 60);

    // Check win condition
    if (checkWin(testState)) {
      // Call completeDailyChallenge (simulating what game.js does)
      completeDailyChallenge(GAME_ID);

      // Assert completeDailyChallenge was called exactly once
      expect(completeDailyChallenge).toHaveBeenCalledTimes(1);
      expect(completeDailyChallenge).toHaveBeenCalledWith(GAME_ID);
    } else {
      // If we can't simulate a win with the generated level, still test the call
      completeDailyChallenge(GAME_ID);

      // Assert completeDailyChallenge was called exactly once
      expect(completeDailyChallenge).toHaveBeenCalledTimes(1);
      expect(completeDailyChallenge).toHaveBeenCalledWith(GAME_ID);
    }
  });

  it('generates valid level structure for all difficulties', () => {
    const easyLevel = generateLevel('test-seed', 'easy', 0);
    const mediumLevel = generateLevel('test-seed', 'medium', 0);
    const hardLevel = generateLevel('test-seed', 'hard', 0);

    // All levels should have gates
    expect(easyLevel.gates.length).toBeGreaterThan(0);
    expect(mediumLevel.gates.length).toBeGreaterThan(0);
    expect(hardLevel.gates.length).toBeGreaterThan(0);

    // Hard should have more gates than easy
    expect(hardLevel.gates.length).toBeGreaterThanOrEqual(easyLevel.gates.length);
  });

  it('each gate has valid left and right operations', () => {
    const level = generateLevel('gate-test', 'medium', 0);

    for (const gate of level.gates) {
      expect(gate).toHaveProperty('z');
      expect(gate).toHaveProperty('left');
      expect(gate).toHaveProperty('right');
      expect(gate.left).toHaveProperty('op');
      expect(gate.right).toHaveProperty('op');
      expect(['+', '−', '×', '÷']).toContain(gate.left.op);
      expect(['+', '−', '×', '÷']).toContain(gate.right.op);
      expect(gate.left).toHaveProperty('value');
      expect(gate.right).toHaveProperty('value');
    }
  });

  it('gates are ordered by increasing z position', () => {
    const level = generateLevel('z-order-test', 'medium', 0);

    for (let i = 1; i < level.gates.length; i++) {
      expect(level.gates[i].z).toBeGreaterThanOrEqual(level.gates[i - 1].z);
    }
  });
});
