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
});

// ─── steer ───────────────────────────────────────────────────────────────────

describe('steer', () => {
  it('adds delta to x', () => {
    const state = createInitialState(SIMPLE_LEVEL);
    const next  = steer(state, 0.3);
    expect(next.x).toBeCloseTo(0.3);
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
});

// ─── optimalPath / worstPath ──────────────────────────────────────────────────

describe('optimalPath', () => {
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
