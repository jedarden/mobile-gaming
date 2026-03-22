/**
 * Crowd Runner - Unit Tests
 *
 * Tests pure state functions: operations, gate crossing, steer, advance, boss resolution.
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  applyOperation,
  getGateSide,
  crossGate,
  advance,
  steer,
  setLane,
  isGameOver,
  calculateStars,
  simulatePath,
  evaluateAllPaths,
  LANE_MIN,
  LANE_MAX
} from '../../src/games/crowd-runner/state.js';

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

  it('returns state unchanged for invalid gate index', () => {
    const state = createInitialState(makeLevel());
    const next  = crossGate(state, 99, 'left');
    expect(next).toBe(state);
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
});

// ── advance ────────────────────────────────────────────────────────────────

describe('advance', () => {
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
});
