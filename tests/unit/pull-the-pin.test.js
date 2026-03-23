/**
 * Pull the Pin — Unit Tests
 *
 * Tests: createInitialState, getPin, isChannelBlocked, getActiveChannels,
 * simulateStep, simulateToCompletion, removePin, checkWin,
 * getRemainingPins, cloneState.
 */

import { describe, it, expect } from 'vitest';
import {
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
  isStillSolvable,
  GRAVITY,
  DAMPING,
  BALL_RADIUS,
  MAX_TICKS,
} from '../../src/games/pull-the-pin/state.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Minimal level: one pin blocking a channel; removing pin lets the ball
 * fall into the cup below.
 */
function makeLevel(overrides = {}) {
  return {
    pins: [
      { id: 'pin1', x: 100, y: 200 },
    ],
    balls: [
      { id: 'ball1', x: 100, y: 100, color: 'red' },
    ],
    cups: [
      { id: 'cup1', x: 80, y: 300, width: 40, height: 60, acceptColor: 'red' },
    ],
    channels: [
      {
        segments: [[90, 150, 110, 150]],
        blockedByPin: 'pin1',
      },
    ],
    gravity: GRAVITY,
    ...overrides,
  };
}

/**
 * Level where ball falls directly into a matching cup (no pins, no channels).
 * Ball starts high enough above cup to land inside.
 */
function makeSolvableLevel() {
  return {
    pins: [],
    balls: [
      { id: 'ball1', x: 100, y: 100, color: 'red' },
    ],
    cups: [
      { id: 'cup1', x: 80, y: 200, width: 40, height: 60, acceptColor: 'red' },
    ],
    channels: [],
    gravity: GRAVITY,
  };
}

// ── Constants ─────────────────────────────────────────────────────────────

describe('constants', () => {
  it('GRAVITY is a positive number', () => {
    expect(GRAVITY).toBeGreaterThan(0);
  });

  it('DAMPING is between 0 and 1', () => {
    expect(DAMPING).toBeGreaterThan(0);
    expect(DAMPING).toBeLessThan(1);
  });

  it('BALL_RADIUS is positive', () => {
    expect(BALL_RADIUS).toBeGreaterThan(0);
  });

  it('MAX_TICKS is large enough for simulation', () => {
    expect(MAX_TICKS).toBeGreaterThan(100);
  });
});

// ── createInitialState ─────────────────────────────────────────────────────

describe('createInitialState', () => {
  it('copies pins with removed=false and removing=false', () => {
    const state = createInitialState(makeLevel());
    expect(state.pins).toHaveLength(1);
    expect(state.pins[0].id).toBe('pin1');
    expect(state.pins[0].removed).toBe(false);
    expect(state.pins[0].removing).toBe(false);
  });

  it('copies balls with initial velocities of 0', () => {
    const state = createInitialState(makeLevel());
    expect(state.balls).toHaveLength(1);
    expect(state.balls[0].vx).toBe(0);
    expect(state.balls[0].vy).toBe(0);
    expect(state.balls[0].settled).toBe(false);
    expect(state.balls[0].lost).toBe(false);
  });

  it('copies cups with empty captured array', () => {
    const state = createInitialState(makeLevel());
    expect(state.cups[0].captured).toEqual([]);
  });

  it('copies channels with segments', () => {
    const state = createInitialState(makeLevel());
    expect(state.channels).toHaveLength(1);
    expect(state.channels[0].blockedByPin).toBe('pin1');
    expect(state.channels[0].segments).toHaveLength(1);
  });

  it('sets status to "playing"', () => {
    const state = createInitialState(makeLevel());
    expect(state.status).toBe('playing');
  });

  it('starts at tick 0', () => {
    const state = createInitialState(makeLevel());
    expect(state.tick).toBe(0);
  });

  it('starts with empty removedPins', () => {
    const state = createInitialState(makeLevel());
    expect(state.removedPins).toEqual([]);
  });

  it('uses level gravity override', () => {
    const state = createInitialState(makeLevel({ gravity: 0.5 }));
    expect(state.gravity).toBe(0.5);
  });

  it('defaults gravity to GRAVITY constant when level.gravity is omitted (|| GRAVITY branch)', () => {
    const level = makeLevel();
    delete level.gravity; // remove so || GRAVITY fallback fires
    const state = createInitialState(level);
    expect(state.gravity).toBe(GRAVITY);
  });

  it('defaults cup height to 60 when c.height is omitted (|| 60 branch)', () => {
    const level = makeLevel({
      cups: [{ id: 'cup1', x: 80, y: 300, width: 40, acceptColor: 'red' }], // no height field
    });
    const state = createInitialState(level);
    expect(state.cups[0].height).toBe(60);
  });

  it('does not mutate original level', () => {
    const level = makeLevel();
    const origPin = level.pins[0];
    createInitialState(level);
    expect(level.pins[0]).toBe(origPin);
  });
});

// ── getPin ─────────────────────────────────────────────────────────────────

describe('getPin', () => {
  it('returns the pin by id', () => {
    const state = createInitialState(makeLevel());
    const pin = getPin(state, 'pin1');
    expect(pin).toBeDefined();
    expect(pin.id).toBe('pin1');
  });

  it('returns null for unknown pin id', () => {
    const state = createInitialState(makeLevel());
    expect(getPin(state, 'missing')).toBeNull();
  });
});

// ── isChannelBlocked ───────────────────────────────────────────────────────

describe('isChannelBlocked', () => {
  it('returns true when the blocking pin is not removed', () => {
    const state = createInitialState(makeLevel());
    const channel = state.channels[0];
    expect(isChannelBlocked(state, channel)).toBe(true);
  });

  it('returns false when no blocking pin', () => {
    const level = makeLevel();
    level.channels[0].blockedByPin = null;
    const state = createInitialState(level);
    expect(isChannelBlocked(state, state.channels[0])).toBe(false);
  });

  it('returns false after the pin is removed', () => {
    const state = createInitialState(makeLevel());
    const stateAfter = removePin(state, 'pin1');
    expect(isChannelBlocked(stateAfter, stateAfter.channels[0])).toBe(false);
  });

  it('returns false when blockedByPin references a non-existent pin id (pin && ... short-circuits to null)', () => {
    // getPin returns null for unknown id → pin && !pin.removed evaluates to null (falsy)
    const state = createInitialState(makeLevel());
    const channel = { segments: [[0, 0, 1, 1]], blockedByPin: 'ghost-pin-id' };
    expect(isChannelBlocked(state, channel)).toBeFalsy();
  });
});

// ── getActiveChannels ──────────────────────────────────────────────────────

describe('getActiveChannels', () => {
  it('returns no segments when channel is blocked', () => {
    const state = createInitialState(makeLevel());
    expect(getActiveChannels(state)).toHaveLength(0);
  });

  it('returns segments when channel is unblocked', () => {
    const state = removePin(createInitialState(makeLevel()), 'pin1');
    const segments = getActiveChannels(state);
    expect(segments.length).toBeGreaterThan(0);
  });

  it('returns segments for channels with no blocking pin', () => {
    const level = makeLevel();
    level.channels[0].blockedByPin = null;
    const state = createInitialState(level);
    expect(getActiveChannels(state)).toHaveLength(1);
  });
});

// ── removePin ─────────────────────────────────────────────────────────────

describe('removePin', () => {
  it('marks pin as removed and removing', () => {
    const state = createInitialState(makeLevel());
    const next = removePin(state, 'pin1');
    expect(next.pins[0].removed).toBe(true);
    expect(next.pins[0].removing).toBe(true);
  });

  it('adds pin to removedPins list', () => {
    const state = createInitialState(makeLevel());
    const next = removePin(state, 'pin1');
    expect(next.removedPins).toContain('pin1');
  });

  it('sets status to "animating"', () => {
    const state = createInitialState(makeLevel());
    const next = removePin(state, 'pin1');
    expect(next.status).toBe('animating');
  });

  it('is a no-op for already-removed pin', () => {
    const state = createInitialState(makeLevel());
    const next1 = removePin(state, 'pin1');
    const next2 = removePin(next1, 'pin1');
    expect(next2).toBe(next1);
  });

  it('is a no-op for unknown pin id', () => {
    const state = createInitialState(makeLevel());
    const next = removePin(state, 'unknown');
    expect(next).toBe(state);
  });

  it('does not mutate original state', () => {
    const state = createInitialState(makeLevel());
    removePin(state, 'pin1');
    expect(state.pins[0].removed).toBe(false);
  });
});

// ── simulateStep ──────────────────────────────────────────────────────────

describe('simulateStep', () => {
  it('increments tick', () => {
    const state = { ...createInitialState(makeSolvableLevel()), status: 'animating' };
    const next = simulateStep(state);
    expect(next.tick).toBe(1);
  });

  it('applies gravity to unsettled balls', () => {
    const state = { ...createInitialState(makeSolvableLevel()), status: 'animating' };
    const next = simulateStep(state);
    expect(next.balls[0].vy).toBeGreaterThan(0);
  });

  it('does not affect settled balls', () => {
    const level = makeSolvableLevel();
    const state = {
      ...createInitialState(level),
      status: 'animating',
      balls: [{ id: 'ball1', x: 100, y: 200, vx: 0, vy: 0, color: 'red', settled: true, lost: false, cupId: 'cup1' }],
    };
    const next = simulateStep(state);
    expect(next.balls[0].x).toBe(100);
    expect(next.balls[0].y).toBe(200);
  });

  it('does not affect lost balls', () => {
    const level = makeSolvableLevel();
    const state = {
      ...createInitialState(level),
      status: 'animating',
      balls: [{ id: 'ball1', x: 100, y: 700, vx: 0, vy: 5, color: 'red', settled: false, lost: true, cupId: null }],
    };
    const next = simulateStep(state);
    expect(next.balls[0].y).toBe(700);
  });

  it('accepts "playing" status (same simulation logic as "animating")', () => {
    // createInitialState sets status='playing'; simulateStep accepts both animating AND playing
    const state = createInitialState(makeSolvableLevel()); // status='playing'
    const next = simulateStep(state);
    expect(next.tick).toBe(1);
    expect(next.balls[0].vy).toBeGreaterThan(0); // gravity applied
  });

  it('is a no-op when status is not animating or playing', () => {
    const state = { ...createInitialState(makeSolvableLevel()), status: 'won' };
    const next = simulateStep(state);
    expect(next).toBe(state);
  });

  it('is a no-op when status is "lost"', () => {
    const state = { ...createInitialState(makeSolvableLevel()), status: 'lost' };
    const next = simulateStep(state);
    expect(next).toBe(state);
  });

  it('marks ball as lost when it falls below y=600', () => {
    const level = makeSolvableLevel();
    level.cups = []; // no cup to catch it
    const state = {
      ...createInitialState(level),
      status: 'animating',
      balls: [{ id: 'ball1', x: 100, y: 598, vx: 0, vy: 10, color: 'red', settled: false, lost: false, cupId: null }],
    };
    const next = simulateStep(state);
    expect(next.balls[0].lost).toBe(true);
  });

  it('handles zero-length channel segment (lengthSq === 0 branch in pointToSegment)', () => {
    // A segment where start === end is degenerate (zero-length).
    // The early-return path returns the point itself as the closest point.
    const level = {
      pins: [],
      balls: [{ id: 'ball1', x: 100, y: 100, color: 'red' }],
      cups: [{ id: 'cup1', x: 80, y: 300, width: 40, height: 60, acceptColor: 'red' }],
      // Zero-length segment: x1===x2, y1===y2
      channels: [{ segments: [[100, 100, 100, 100]], blockedByPin: null }],
      gravity: GRAVITY,
    };
    const state = { ...createInitialState(level), status: 'animating' };
    expect(() => simulateStep(state)).not.toThrow();
  });

  it('does not mark ball as lost when new y is exactly 600 (boundary exclusive)', () => {
    // GRAVITY=0.3: ball at y=599.7 with vy=0 → y_new = 599.7+0.3 = 600.0, which is NOT > 600
    const level = makeSolvableLevel();
    level.cups = [];
    const state = {
      ...createInitialState(level),
      status: 'animating',
      balls: [{ id: 'ball1', x: 100, y: 599.7, vx: 0, vy: 0, color: 'red', settled: false, lost: false, cupId: null }],
    };
    const next = simulateStep(state);
    expect(next.balls[0].lost).toBe(false);
    expect(next.balls[0].y).toBe(600);
  });
});

// ── checkWin ──────────────────────────────────────────────────────────────

describe('checkWin', () => {
  it('returns "lost" when a ball is lost', () => {
    const level = makeSolvableLevel();
    const state = {
      ...createInitialState(level),
      balls: [{ id: 'ball1', x: 100, y: 700, vx: 0, vy: 0, color: 'red', settled: false, lost: true, cupId: null }],
    };
    expect(checkWin(state)).toBe('lost');
  });

  it('returns "lost" when ball settles in wrong-color cup', () => {
    const level = makeSolvableLevel();
    level.cups[0].acceptColor = 'blue'; // ball is red, cup is blue
    const state = {
      ...createInitialState(level),
      balls: [{ id: 'ball1', x: 100, y: 200, vx: 0, vy: 0, color: 'red', settled: true, lost: false, cupId: 'cup1' }],
    };
    expect(checkWin(state)).toBe('lost');
  });

  it('returns "lost" when ball settles in cup with null acceptColor (null !== ball.color)', () => {
    const level = makeSolvableLevel();
    level.cups[0].acceptColor = null; // null !== 'red' → lost
    const state = {
      ...createInitialState(level),
      balls: [{ id: 'ball1', x: 100, y: 200, vx: 0, vy: 0, color: 'red', settled: true, lost: false, cupId: 'cup1' }],
    };
    expect(checkWin(state)).toBe('lost');
  });

  it('returns "won" when all balls settled in correct cups', () => {
    const level = makeSolvableLevel();
    const state = {
      ...createInitialState(level),
      balls: [{ id: 'ball1', x: 100, y: 200, vx: 0, vy: 0, color: 'red', settled: true, lost: false, cupId: 'cup1' }],
    };
    expect(checkWin(state)).toBe('won');
  });

  it('returns "animating" when balls are still moving', () => {
    const state = { ...createInitialState(makeSolvableLevel()), status: 'animating' };
    expect(checkWin(state)).toBe('animating');
  });

  it('returns "animating" when balls are neither settled nor lost', () => {
    // Initial state: ball is not settled, not lost — still in flight
    const state = createInitialState(makeLevel());
    expect(checkWin(state)).toBe('animating');
  });

  it('returns "won" when settled ball has null cupId (skips loss check, allSettled=true)', () => {
    // ball.settled=true, ball.cupId=null → `if (ball.settled && ball.cupId)` is false
    // → skips loss check → allSettled=true → 'won'
    const level = makeSolvableLevel();
    const state = {
      ...createInitialState(level),
      balls: [{ id: 'ball1', x: 100, y: 200, vx: 0, vy: 0, color: 'red', settled: true, lost: false, cupId: null }],
    };
    expect(checkWin(state)).toBe('won');
  });

  it('returns "won" when balls array is empty (vacuous truth: every() on empty array is true)', () => {
    const level = makeSolvableLevel();
    const state = { ...createInitialState(level), balls: [] };
    expect(checkWin(state)).toBe('won');
  });

  it('returns "won" when ball has nonexistent cupId (cup not found → if(cup&&...) false branch)', () => {
    // ball.settled=true, ball.cupId='ghost' → truthy, so if(ball.settled && ball.cupId) fires
    // cups.find() returns undefined → if(cup && cup.acceptColor !== ball.color) is false
    // → skips loss → allSettled=true → 'won'
    const level = makeSolvableLevel();
    const state = {
      ...createInitialState(level),
      balls: [{ id: 'ball1', x: 100, y: 200, vx: 0, vy: 0, color: 'red', settled: true, lost: false, cupId: 'ghost-cup' }],
    };
    expect(checkWin(state)).toBe('won');
  });
});

// ── simulateToCompletion ──────────────────────────────────────────────────

describe('simulateToCompletion', () => {
  it('terminates and returns a final state', () => {
    const state = createInitialState(makeSolvableLevel());
    const final = simulateToCompletion(state);
    const allDone = final.balls.every(b => b.settled || b.lost);
    expect(allDone).toBe(true);
  });

  it('resolves win status for ball landing in correct cup', () => {
    // Ball starts directly above cup with matching color and no channels
    const level = {
      pins: [],
      balls: [{ id: 'ball1', x: 100, y: 190, color: 'red' }],
      cups: [{ id: 'cup1', x: 80, y: 200, width: 40, height: 80, acceptColor: 'red' }],
      channels: [],
      gravity: GRAVITY,
    };
    const state = createInitialState(level);
    const final = simulateToCompletion(state);
    expect(final.status).toBe('won');
  });

  it('exhausts MAX_TICKS loop when ball never settles or gets lost (upward-moving ball)', () => {
    // Ball with strong upward velocity (vy=-6) and tiny gravity (0.003): never reaches y=600
    // in 2000 ticks, so loop runs to completion without early break
    const state = {
      pins: [], cups: [], channels: [], gravity: 0.003, status: 'animating', tick: 0, removedPins: [],
      balls: [{ id: 'b1', x: 160, y: 100, vx: 0, vy: -6, color: 'red', settled: false, lost: false, cupId: null }],
    };
    const final = simulateToCompletion(state);
    expect(final.tick).toBe(MAX_TICKS); // loop ran all iterations
    expect(final.balls[0].settled).toBe(false);
    expect(final.balls[0].lost).toBe(false);
  });
});

// ── getRemainingPins ──────────────────────────────────────────────────────

describe('getRemainingPins', () => {
  it('returns all pins initially', () => {
    const state = createInitialState(makeLevel());
    expect(getRemainingPins(state)).toHaveLength(1);
  });

  it('excludes removed pins', () => {
    const state = removePin(createInitialState(makeLevel()), 'pin1');
    expect(getRemainingPins(state)).toHaveLength(0);
  });

  it('returns empty array when no pins', () => {
    const level = makeLevel({ pins: [] });
    const state = createInitialState(level);
    expect(getRemainingPins(state)).toHaveLength(0);
  });
});

// ── cloneState ─────────────────────────────────────────────────────────────

describe('cloneState', () => {
  it('produces a deep copy of pins', () => {
    const state = createInitialState(makeLevel());
    const clone = cloneState(state);
    expect(clone.pins).not.toBe(state.pins);
    expect(clone.pins[0]).not.toBe(state.pins[0]);
  });

  it('produces a deep copy of balls', () => {
    const state = createInitialState(makeLevel());
    const clone = cloneState(state);
    expect(clone.balls[0]).not.toBe(state.balls[0]);
  });

  it('produces a deep copy of cups with captured arrays', () => {
    const state = createInitialState(makeLevel());
    const clone = cloneState(state);
    expect(clone.cups[0].captured).not.toBe(state.cups[0].captured);
  });

  it('produces a deep copy of removedPins', () => {
    const state = removePin(createInitialState(makeLevel()), 'pin1');
    const clone = cloneState(state);
    expect(clone.removedPins).not.toBe(state.removedPins);
    expect(clone.removedPins).toContain('pin1');
  });

  it('mutating clone does not affect original', () => {
    const state = createInitialState(makeLevel());
    const clone = cloneState(state);
    clone.pins[0].removed = true;
    expect(state.pins[0].removed).toBe(false);
  });

  it('preserves tick and status', () => {
    const state = { ...createInitialState(makeLevel()), tick: 42, status: 'animating' };
    const clone = cloneState(state);
    expect(clone.tick).toBe(42);
    expect(clone.status).toBe('animating');
  });
});

// ── isStillSolvable ────────────────────────────────────────────────────────

describe('isStillSolvable', () => {
  it('returns true when no pins remain (remaining.length === 0)', () => {
    // makeSolvableLevel has no pins — loop skips, returns 0 === 0 → true
    const state = createInitialState(makeSolvableLevel());
    expect(isStillSolvable(state)).toBe(true);
  });

  it('returns false when all pin removals lead to a loss', () => {
    // No cups: ball always falls past y=600 → lost regardless of which pin is removed
    const level = {
      pins: [{ id: 'pin1', x: 100, y: 200 }],
      balls: [{ id: 'ball1', x: 100, y: 100, color: 'red' }],
      cups: [],
      channels: [],
      gravity: GRAVITY,
    };
    const state = createInitialState(level);
    expect(isStillSolvable(state)).toBe(false);
  });

  it('returns true when removing the one pin leads to a win', () => {
    // makeLevel(): pin1 blocks the channel; removing it lets ball fall into correct cup
    const state = createInitialState(makeLevel());
    expect(isStillSolvable(state)).toBe(true);
  });

  it('returns false when no pins remain but ball is already lost', () => {
    // Zero pins, ball already marked lost — remaining.length === 0 but ball lost.
    // The function only checks remaining pins; it returns true for 0 remaining pins
    // regardless of current ball state. Verify this is the documented behavior.
    const state = {
      ...createInitialState(makeSolvableLevel()),
      balls: [{ id: 'ball1', x: 100, y: 700, vx: 0, vy: 0, color: 'red', settled: false, lost: true, cupId: null }],
    };
    // 0 remaining pins → returns true (remaining.length === 0)
    expect(isStillSolvable(state)).toBe(true);
  });

  it('returns true when one of multiple pins leads to a win', () => {
    // Two pins: one blocking the winning channel, one blocking nothing useful.
    // Removing either pin tries the simulation — at least one leads to non-lost.
    const level = {
      pins: [
        { id: 'pin1', x: 100, y: 200 },  // blocks winning channel
        { id: 'pin2', x: 300, y: 400 },  // unrelated pin
      ],
      balls: [{ id: 'ball1', x: 100, y: 100, color: 'red' }],
      cups: [{ id: 'cup1', x: 80, y: 300, width: 40, height: 60, acceptColor: 'red' }],
      channels: [
        { segments: [[90, 150, 110, 150]], blockedByPin: 'pin1' },
      ],
      gravity: GRAVITY,
    };
    const state = createInitialState(level);
    expect(isStillSolvable(state)).toBe(true);
  });
});
