/**
 * Makeover Run - Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  LANE_MIN, LANE_MAX, HIT_THRESHOLD, CATEGORIES, MAX_PER_CATEGORY, MAX_SCORE,
  createInitialState, hitStation, steer, setX, advance, judge,
  calculateStars, isRunning, isJudging, isGameOver,
  simulatePath, optimalPath, worstPath
} from '../../src/games/makeover-run/state.js';
import { generateLevel } from '../../src/games/makeover-run/generator.js';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const SIMPLE_LEVEL = {
  courseLength: 200,
  speed: 2.0,
  stations: [
    { z: 50, x: -1, type: 'hair',   upgrade: 2, positive: true  },
    { z: 50, x:  1, type: 'mud', downgrade: 'outfit',  amount: 1, positive: false },
    { z: 100, x: 1, type: 'outfit', upgrade: 2, positive: true  },
    { z: 100, x: -1, type: 'mud', downgrade: 'hair',   amount: 1, positive: false },
    { z: 150, x: -1, type: 'makeup', upgrade: 3, positive: true  },
    { z: 150, x:  1, type: 'mud', downgrade: 'accessories', amount: 1, positive: false },
    { z: 180, x:  1, type: 'accessories', upgrade: 3, positive: true  },
    { z: 180, x: -1, type: 'mud', downgrade: 'outfit', amount: 1, positive: false }
  ]
};

// ─── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('LANE_MIN = -1, LANE_MAX = 1', () => {
    expect(LANE_MIN).toBe(-1);
    expect(LANE_MAX).toBe(1);
  });

  it('HIT_THRESHOLD = 0.7', () => {
    expect(HIT_THRESHOLD).toBe(0.7);
  });

  it('CATEGORIES has 4 entries', () => {
    expect(CATEGORIES).toEqual(['hair', 'outfit', 'makeup', 'accessories']);
  });

  it('MAX_PER_CATEGORY = 3, MAX_SCORE = 12', () => {
    expect(MAX_PER_CATEGORY).toBe(3);
    expect(MAX_SCORE).toBe(12);
  });
});

// ─── createInitialState ───────────────────────────────────────────────────────

describe('createInitialState', () => {
  it('initializes x=0, z=0', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(state.x).toBe(0);
    expect(state.z).toBe(0);
  });

  it('appearance all zeros', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(state.appearance).toEqual({ hair: 0, outfit: 0, makeup: 0, accessories: 0 });
    expect(state.score).toBe(0);
    expect(state.maxScore).toBe(12);
  });

  it('status is running', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(state.status).toBe('running');
  });

  it('copies courseLength and speed from level', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(state.courseLength).toBe(200);
    expect(state.speed).toBe(2.0);
  });

  it('stations marked triggered=false', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    state.stations.forEach(s => expect(s.triggered).toBe(false));
  });

  it('defaults courseLength=300 if not provided', () => {
    const state = createInitialState({ stations: [] });
    expect(state.courseLength).toBe(300);
  });

  it('defaults speed=2 when level.speed is not provided', () => {
    const state = createInitialState({ stations: [] }); // no speed property
    expect(state.speed).toBe(2);
  });
});

// ─── hitStation ──────────────────────────────────────────────────────────────

describe('hitStation', () => {
  it('positive station upgrades category using max(current, upgrade)', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next  = hitStation(state, 0); // hair upgrade:2
    expect(next.appearance.hair).toBe(2);
    expect(next.score).toBe(2);
  });

  it('positive upgrade is max(current, upgrade) — never decreases', () => {
    let state = createInitialState(SIMPLE_LEVEL);
    state = { ...state, appearance: { ...state.appearance, hair: 3 } };
    state = { ...state, score: 3 };
    const next = hitStation(state, 0); // hair upgrade:2 — should stay at 3
    expect(next.appearance.hair).toBe(3);
  });

  it('positive appearance is capped at MAX_PER_CATEGORY (3)', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    // Inject a station with upgrade:5 (invalid, but test the cap)
    const modState = {
      ...state,
      stations: [{ z: 10, x: -1, type: 'hair', upgrade: 5, positive: true, triggered: false }]
    };
    const next = hitStation(modState, 0);
    expect(next.appearance.hair).toBe(3);
  });

  it('negative station reduces downgrade category', () => {
    let state = createInitialState(SIMPLE_LEVEL);
    // Give outfit some value first
    state = { ...state, appearance: { ...state.appearance, outfit: 2 }, score: 2 };
    const next = hitStation(state, 1); // mud, downgrade: outfit, amount:1
    expect(next.appearance.outfit).toBe(1);
    expect(next.score).toBe(1);
  });

  it('negative downgrade floors at 0', () => {
    const state = createInitialState(SIMPLE_LEVEL); // outfit = 0
    const next  = hitStation(state, 1); // mud, downgrade:outfit, amount:1
    expect(next.appearance.outfit).toBe(0);
  });

  it('returns same state if station already triggered', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const triggered = { ...state, stations: state.stations.map((s, i) => i === 0 ? { ...s, triggered: true } : s) };
    const next = hitStation(triggered, 0);
    expect(next).toBe(triggered);
  });

  it('marks station as triggered', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next  = hitStation(state, 0);
    expect(next.stations[0].triggered).toBe(true);
    expect(next.stations[1].triggered).toBe(false);
  });

  it('score equals sum of all appearance values', () => {
    let state = createInitialState(SIMPLE_LEVEL);
    state = hitStation(state, 0); // hair → 2
    state = hitStation(state, 2); // outfit → 2
    expect(state.score).toBe(state.appearance.hair + state.appearance.outfit +
      state.appearance.makeup + state.appearance.accessories);
    expect(state.score).toBe(4);
  });

  it('returns same state for out-of-bounds index', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(hitStation(state, 99)).toBe(state);
    expect(hitStation(state, -1)).toBe(state);
  });

  it('uses station.type when downgrade is absent on a negative station', () => {
    // negative station without downgrade → `cat = station.type`
    const modState = {
      ...createInitialState(SIMPLE_LEVEL),
      appearance: { hair: 2, outfit: 0, makeup: 0, accessories: 0 },
      score: 2,
      stations: [{ z: 10, x: 0, type: 'hair', positive: false, triggered: false }]
    };
    const next = hitStation(modState, 0);
    expect(next.appearance.hair).toBe(1); // 2 - (amount||1) = 2 - 1 = 1
  });

  it('amount=0 (falsy) falls back to || 1, reducing by 1 not 0', () => {
    // station.amount || 1 → 0 || 1 = 1, so reduces by 1 despite amount being 0
    const modState = {
      ...createInitialState(SIMPLE_LEVEL),
      appearance: { hair: 3, outfit: 0, makeup: 0, accessories: 0 },
      score: 3,
      stations: [{ z: 10, x: 0, type: 'hair', positive: false, amount: 0, triggered: false }]
    };
    const next = hitStation(modState, 0);
    expect(next.appearance.hair).toBe(2); // 3 - (0||1) = 3 - 1 = 2
  });

  it('reduces by station.amount when amount > 1', () => {
    const modState = {
      ...createInitialState(SIMPLE_LEVEL),
      appearance: { hair: 3, outfit: 0, makeup: 0, accessories: 0 },
      score: 3,
      stations: [{ z: 10, x: 0, type: 'hair', positive: false, amount: 2, triggered: false }]
    };
    const next = hitStation(modState, 0);
    expect(next.appearance.hair).toBe(1); // 3 - 2 = 1
  });
});

// ─── steer ───────────────────────────────────────────────────────────────────

describe('steer', () => {
  it('adds delta to x', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next  = steer(state, 0.3);
    expect(next.x).toBeCloseTo(0.3);
  });

  it('accumulates from current x position', () => {
    const state = { ...createInitialState(SIMPLE_LEVEL), x: 0.5 };
    const next  = steer(state, 0.2);
    expect(next.x).toBeCloseTo(0.7);
  });

  it('clamps x to LANE_MIN', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next  = steer(state, -5);
    expect(next.x).toBe(LANE_MIN);
  });

  it('clamps x to LANE_MAX', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next  = steer(state, 5);
    expect(next.x).toBe(LANE_MAX);
  });

  it('does nothing when status !== running', () => {
    const state = { ...createInitialState(SIMPLE_LEVEL), status: 'judging' };
    const next  = steer(state, 0.5);
    expect(next.x).toBe(0);
  });
});

// ─── setX ─────────────────────────────────────────────────────────────────────

describe('setX', () => {
  it('sets x directly', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(setX(state, 0.5).x).toBeCloseTo(0.5);
  });

  it('clamps to [-1, 1]', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    expect(setX(state, -3).x).toBe(-1);
    expect(setX(state,  3).x).toBe(1);
  });

  it('noop when not running', () => {
    const state = { ...createInitialState(SIMPLE_LEVEL), status: 'complete' };
    expect(setX(state, 0.5).x).toBe(0);
  });
});

// ─── advance ─────────────────────────────────────────────────────────────────

describe('advance', () => {
  it('dt=0 does not advance z', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next  = advance(state, 0);
    expect(next.z).toBe(0);
  });

  it('moves z forward by speed * dt * 60', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next  = advance(state, 1 / 60);
    expect(next.z).toBeCloseTo(2.0); // speed=2.0, dt=1/60, 2.0*1=2.0
  });

  it('does nothing when not running', () => {
    const state = { ...createInitialState(SIMPLE_LEVEL), status: 'judging' };
    const next  = advance(state, 1 / 60);
    expect(next.z).toBe(0);
  });

  it('returns exact same state reference when not running (identity check)', () => {
    const state = { ...createInitialState(SIMPLE_LEVEL), status: 'complete' };
    expect(advance(state, 1 / 60)).toBe(state);
  });

  it('hits station when x is within threshold', () => {
    const state = { ...createInitialState(SIMPLE_LEVEL), x: -1, z: 49 };
    // After 1 frame at speed=2, z ≈ 51 — passes station at z=50
    const next = advance(state, 1 / 60);
    expect(next.appearance.hair).toBe(2); // hit the hair upgrade station
  });

  it('does not hit station when x is out of threshold', () => {
    const state = { ...createInitialState(SIMPLE_LEVEL), x: 0, z: 49 };
    const next  = advance(state, 1 / 60);
    // Character at x=0, stations at x=-1 and x=1; |0 - (-1)| = 1 > 0.7 → no hit
    expect(next.appearance.hair).toBe(0);
    expect(next.appearance.outfit).toBe(0);
  });

  it('marks station triggered when passed without hit', () => {
    const state = { ...createInitialState(SIMPLE_LEVEL), x: 0, z: 49 };
    const next  = advance(state, 1 / 60);
    // Both stations at z=50 should be triggered (passed without hit)
    expect(next.stations[0].triggered).toBe(true);
    expect(next.stations[1].triggered).toBe(true);
  });

  it('transitions to judging when z >= courseLength', () => {
    const state = { ...createInitialState(SIMPLE_LEVEL), z: 199 };
    const next  = advance(state, 1 / 60);
    expect(next.status).toBe('judging');
    expect(next.z).toBe(200);
  });

  it('does not advance z past courseLength', () => {
    const state = { ...createInitialState(SIMPLE_LEVEL), z: 199 };
    const next  = advance(state, 10); // large dt
    expect(next.z).toBe(200);
  });

  it('does not re-apply already-triggered stations', () => {
    const state = {
      ...createInitialState(SIMPLE_LEVEL),
      x: -1,
      z: 49,
      stations: SIMPLE_LEVEL.stations.map(s => s.z === 50 ? { ...s, triggered: true } : { ...s, triggered: false })
    };
    const next = advance(state, 1 / 60);
    expect(next.appearance.hair).toBe(0);
  });
});

// ─── judge ───────────────────────────────────────────────────────────────────

describe('judge', () => {
  it('transitions judging → complete and sets stars', () => {
    const state = { ...createInitialState(SIMPLE_LEVEL), status: 'judging', score: 10 };
    const next  = judge(state);
    expect(next.status).toBe('complete');
    expect(next.stars).toBe(3);
  });

  it('score=0 produces 1 star', () => {
    const state = { ...createInitialState(SIMPLE_LEVEL), status: 'judging', score: 0 };
    const next  = judge(state);
    expect(next.status).toBe('complete');
    expect(next.stars).toBe(1);
  });

  it('noop when not judging', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next  = judge(state);
    expect(next.status).toBe('running');
  });
});

// ─── calculateStars ───────────────────────────────────────────────────────────

describe('calculateStars', () => {
  it('3 stars when score/maxScore >= 0.67', () => {
    expect(calculateStars(9, 12)).toBe(3);  // 75% ≥ 67%
    expect(calculateStars(12, 12)).toBe(3); // 100%
  });

  it('2 stars when 0.33 <= score/maxScore < 0.67', () => {
    expect(calculateStars(4, 12)).toBe(2);  // 33.3%
    expect(calculateStars(8, 12)).toBe(2);  // 66.7% < 67%
  });

  it('1 star when score/maxScore < 0.33', () => {
    expect(calculateStars(0, 12)).toBe(1);
    expect(calculateStars(3, 12)).toBe(1);  // 25%
  });

  it('boundary: score=0 → 1 star', () => {
    expect(calculateStars(0, 12)).toBe(1);
  });

  it('exact 0.67 boundary gives 3 stars (>= is inclusive)', () => {
    expect(calculateStars(67, 100)).toBe(3);
  });

  it('exact 0.33 boundary gives 2 stars (>= is inclusive)', () => {
    expect(calculateStars(33, 100)).toBe(2);
  });

  it('just below 0.33 gives 1 star', () => {
    expect(calculateStars(32, 100)).toBe(1);
  });
});

// ─── Status helpers ───────────────────────────────────────────────────────────

describe('status helpers', () => {
  it('isRunning', () => {
    expect(isRunning(createInitialState(SIMPLE_LEVEL))).toBe(true);
    expect(isRunning({ status: 'judging' })).toBe(false);
    expect(isRunning({ status: 'complete' })).toBe(false);
  });

  it('isJudging', () => {
    expect(isJudging({ status: 'judging' })).toBe(true);
    expect(isJudging(createInitialState(SIMPLE_LEVEL))).toBe(false);
  });

  it('isGameOver', () => {
    expect(isGameOver({ status: 'complete' })).toBe(true);
    expect(isGameOver(createInitialState(SIMPLE_LEVEL))).toBe(false);
  });
});

// ─── simulatePath ─────────────────────────────────────────────────────────────

describe('simulatePath', () => {
  it('all positives → max score', () => {
    const path   = optimalPath(SIMPLE_LEVEL);
    const result = simulatePath(SIMPLE_LEVEL, path);
    // hair=2, outfit=2, makeup=3, accessories=3 → 10
    expect(result.score).toBe(10);
    expect(result.stars).toBe(3);
  });

  it('all negatives from zero → score stays 0', () => {
    const path   = worstPath(SIMPLE_LEVEL);
    const result = simulatePath(SIMPLE_LEVEL, path);
    expect(result.score).toBe(0);
    expect(result.stars).toBe(1);
  });

  it('mixed path gives intermediate result', () => {
    // steer to positive for z=50 (x=-1: hair+2), negative for z=100 (x=-1: mud/hair)
    const zSet = [...new Set(SIMPLE_LEVEL.stations.map(s => s.z))].sort((a, b) => a - b);
    // z=50 positive at x=-1, z=100 positive at x=1, z=150 positive at x=-1, z=180 positive at x=1
    const path = [
      -1,  // z=50:  choose positive (hair+2)
      -1,  // z=100: choose negative (mud/hair) → hair=max(2-1,0)=1
      -1,  // z=150: choose positive (makeup+3)
       1   // z=180: choose positive (accessories+3)
    ];
    const result = simulatePath(SIMPLE_LEVEL, path);
    // hair=1, outfit=0, makeup=3, accessories=3 → 7
    expect(result.score).toBe(7);
  });

  it('empty path choices default to x=0 (hits nothing)', () => {
    const result = simulatePath(SIMPLE_LEVEL, []);
    expect(result.score).toBe(0);
  });

  it('treats undefined path entries the same as explicit 0', () => {
    const sparse   = [undefined, -1, undefined, 1];
    const explicit = [0,        -1, 0,         1];
    const r1 = simulatePath(SIMPLE_LEVEL, sparse);
    const r2 = simulatePath(SIMPLE_LEVEL, explicit);
    expect(r1.score).toBe(r2.score);
    expect(r1.stars).toBe(r2.stars);
  });

  it('level with no stations returns score=0, stars=1', () => {
    const emptyLevel = { courseLength: 100, speed: 1.0, stations: [] };
    const result = simulatePath(emptyLevel, []);
    expect(result.score).toBe(0);
    expect(result.stars).toBe(1);
  });
});

// ─── optimalPath / worstPath ──────────────────────────────────────────────────

describe('optimalPath', () => {
  it('returns 0 for a z-group with no positive station', () => {
    const level = { courseLength: 100, speed: 1, stations: [
      { z: 50, x: 1, type: 'mud', downgrade: 'hair', amount: 1, positive: false },
    ]};
    expect(optimalPath(level)).toEqual([0]);
  });

  it('returns one x per unique z group', () => {
    const path = optimalPath(SIMPLE_LEVEL);
    const zCount = new Set(SIMPLE_LEVEL.stations.map(s => s.z)).size;
    expect(path).toHaveLength(zCount);
  });

  it('each choice matches a positive station x at that z', () => {
    const path = optimalPath(SIMPLE_LEVEL);
    const zSet = [...new Set(SIMPLE_LEVEL.stations.map(s => s.z))].sort((a, b) => a - b);
    path.forEach((x, i) => {
      const z   = zSet[i];
      const pos = SIMPLE_LEVEL.stations.find(s => s.z === z && s.positive);
      expect(x).toBe(pos.x);
    });
  });
});

describe('worstPath', () => {
  it('returns 0 for a z-group with no negative station', () => {
    const level = { courseLength: 100, speed: 1, stations: [
      { z: 50, x: -1, type: 'hair', upgrade: 2, positive: true },
    ]};
    expect(worstPath(level)).toEqual([0]);
  });

  it('returns one x per unique z group', () => {
    const path = worstPath(SIMPLE_LEVEL);
    const zCount = new Set(SIMPLE_LEVEL.stations.map(s => s.z)).size;
    expect(path).toHaveLength(zCount);
  });

  it('each choice matches a negative station x at that z', () => {
    const path = worstPath(SIMPLE_LEVEL);
    const zSet = [...new Set(SIMPLE_LEVEL.stations.map(s => s.z))].sort((a, b) => a - b);
    path.forEach((x, i) => {
      const z   = zSet[i];
      const neg = SIMPLE_LEVEL.stations.find(s => s.z === z && !s.positive);
      expect(x).toBe(neg.x);
    });
  });
});

// ─── Appearance invariants ────────────────────────────────────────────────────

describe('appearance invariants', () => {
  it('appearance values stay in [0, 3] after multiple upgrades', () => {
    let state = createInitialState(SIMPLE_LEVEL);
    state = hitStation(state, 0); // hair → 2
    state = hitStation(state, 2); // outfit → 2
    state = hitStation(state, 4); // makeup → 3
    state = hitStation(state, 6); // accessories → 3
    CATEGORIES.forEach(cat => {
      expect(state.appearance[cat]).toBeGreaterThanOrEqual(0);
      expect(state.appearance[cat]).toBeLessThanOrEqual(3);
    });
  });

  it('appearance values stay >= 0 after multiple downgrades', () => {
    let state = createInitialState(SIMPLE_LEVEL); // all 0
    // Hit negative stations — floor stays at 0
    state = hitStation(state, 1); // mud/outfit → max(0-1,0)=0
    state = hitStation(state, 3); // mud/hair   → max(0-1,0)=0
    CATEGORIES.forEach(cat => {
      expect(state.appearance[cat]).toBeGreaterThanOrEqual(0);
    });
  });
});

// ── Daily Challenge ─────────────────────────────────────────────────────────────

describe('Daily Challenge', () => {
  it('generates a level from a known seed', () => {
    const seed = 'makeover-run-test-seed-2026-07-23';
    const level = generateLevel(seed, 'easy', 0);

    // Generator always returns a level object
    expect(level).not.toBeNull();
    expect(typeof level).toBe('object');

    expect(level).toHaveProperty('stations');
    expect(level).toHaveProperty('courseLength');
    expect(level).toHaveProperty('speed');
    expect(level.stations).toBeInstanceOf(Array);
    expect(level.stations.length).toBeGreaterThan(0);
  });

  it('generates identical levels from the same seed (deterministic)', () => {
    const seed = 'makeover-run-deterministic-test';
    const level1 = generateLevel(seed, 'easy', 0);
    const level2 = generateLevel(seed, 'easy', 0);

    expect(level1).toEqual(level2);
  });

  it('generates different levels from different seeds', () => {
    const level1 = generateLevel('seed-1', 'easy', 0);
    const level2 = generateLevel('seed-2', 'easy', 0);

    // Different seeds should produce different stations
    expect(level1.stations).not.toEqual(level2.stations);
  });

  it('returns a level with valid structure for all difficulties', () => {
    const easyLevel = generateLevel('test-seed', 'easy', 0);
    const mediumLevel = generateLevel('test-seed', 'medium', 0);
    const hardLevel = generateLevel('test-seed', 'hard', 0);

    // All levels should have stations
    expect(easyLevel.stations.length).toBeGreaterThan(0);
    expect(mediumLevel.stations.length).toBeGreaterThan(0);
    expect(hardLevel.stations.length).toBeGreaterThan(0);

    // Hard should have more stations than easy
    expect(hardLevel.stations.length).toBeGreaterThanOrEqual(easyLevel.stations.length);
  });

  it('each station has valid properties', () => {
    const level = generateLevel('station-test', 'easy', 0);

    for (const station of level.stations) {
      expect(station).toHaveProperty('z');
      expect(station).toHaveProperty('x');
      expect(station).toHaveProperty('positive');
      expect(station.z).toBeGreaterThan(0);
      expect([-1, 1]).toContain(station.x);
    }
  });

  it('stations are ordered by increasing z position', () => {
    const level = generateLevel('z-order-test', 'easy', 0);

    for (let i = 1; i < level.stations.length; i++) {
      expect(level.stations[i].z).toBeGreaterThanOrEqual(level.stations[i - 1].z);
    }
  });

  it('has both positive and negative stations', () => {
    const level = generateLevel('station-pairs-test', 'easy', 0);

    const positives = level.stations.filter(s => s.positive);
    const negatives = level.stations.filter(s => !s.positive);

    expect(positives.length).toBeGreaterThan(0);
    expect(negatives.length).toBeGreaterThan(0);
  });

  it('positive stations upgrade valid categories', () => {
    const level = generateLevel('categories-test', 'easy', 0);

    const positives = level.stations.filter(s => s.positive);

    for (const station of positives) {
      expect(station).toHaveProperty('type');
      expect(CATEGORIES).toContain(station.type);
      expect(station).toHaveProperty('upgrade');
      expect([2, 3]).toContain(station.upgrade);
    }
  });

  it('simulates a win with daily challenge seed', () => {
    const seed = 'makeover-run-win-test';
    const level = generateLevel(seed, 'easy', 0);

    // Create initial state
    let state = createInitialState(level);

    // Simulate always steering left (toward positive stations)
    const TICKS_TO_FINISH = 300;

    for (let i = 0; i < TICKS_TO_FINISH; i++) {
      if (isGameOver(state)) break;
      if (isJudging(state)) {
        state = judge(state);
        break;
      }

      state = advance(state, 1/60);

      // Steer left (negative delta) toward positive stations
      state = steer(state, -0.5);
    }

    // After finishing course, should be in judging or complete
    expect(state.status === 'judging' || state.status === 'complete').toBe(true);
  });

  it('optimal path achieves 3 stars', () => {
    const level = generateLevel('optimal-test', 'easy', 0);

    // Create state and always steer toward positive stations
    let state = createInitialState(level);
    const TICKS_TO_FINISH = 300;

    for (let i = 0; i < TICKS_TO_FINISH; i++) {
      if (isGameOver(state)) break;
      if (isJudging(state)) {
        state = judge(state);
        break;
      }

      state = advance(state, 1/60);

      // Steer left (toward positive stations at x=-1)
      state = steer(state, -0.5);
    }

    expect(state.status).toBe('complete');
    expect(state.stars).toBeGreaterThanOrEqual(3);
  });
});
