/**
 * State URL — Unit Tests
 *
 * Tests for encode/decode roundtrip, URL format, length limits, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeState,
  decodeState,
  isStateHash,
  encodedLength,
} from '../../src/shared/state-url.js';

// ─── Sample states ─────────────────────────────────────────────────────────────

const WATER_SORT_STATE = {
  levelId: 'ws-001',
  tubes: [
    { colors: ['red', 'blue', 'green', 'yellow'], capacity: 4 },
    { colors: ['blue', 'red', 'yellow', 'green'], capacity: 4 },
    { colors: ['green', 'yellow', 'red', 'blue'], capacity: 4 },
    { colors: [], capacity: 4 },
    { colors: [], capacity: 4 },
  ],
  moves: 0,
  maxMoves: 20,
  status: 'playing',
};

const PARKING_ESCAPE_STATE = {
  levelId: 'pe-001',
  vehicles: [
    { id: 'v0', x: 2, y: 2, length: 2, dir: 'H', color: '#e74c3c' },
    { id: 'v1', x: 0, y: 0, length: 3, dir: 'V', color: '#3498db' },
    { id: 'v2', x: 4, y: 0, length: 2, dir: 'H', color: '#2ecc71' },
  ],
  moves: 3,
  status: 'playing',
};

const BRAIN_TEASER_STATE = {
  levelId: 'bt-001',
  type: 'tap',
  completed: ['elem-1', 'elem-2'],
  attempts: 1,
  status: 'playing',
};

const CROWD_RUNNER_STATE = {
  levelId: 'cr-001',
  crowdSize: 23,
  gatesCleared: [0, 1],
  position: 142.5,
  status: 'playing',
};

// ─── Roundtrip tests ───────────────────────────────────────────────────────────

describe('State URL — encode/decode roundtrip', () => {
  it('roundtrips Water Sort state', () => {
    const hash = encodeState('water-sort', WATER_SORT_STATE);
    const decoded = decodeState(hash);
    expect(decoded).not.toBeNull();
    expect(decoded.gameId).toBe('water-sort');
    expect(decoded.version).toBe(1);
    expect(decoded.state).toEqual(WATER_SORT_STATE);
  });

  it('roundtrips Parking Escape state', () => {
    const hash = encodeState('parking-escape', PARKING_ESCAPE_STATE);
    const decoded = decodeState(hash);
    expect(decoded.gameId).toBe('parking-escape');
    expect(decoded.state).toEqual(PARKING_ESCAPE_STATE);
  });

  it('roundtrips Brain Teaser state', () => {
    const hash = encodeState('brain-teaser', BRAIN_TEASER_STATE);
    const decoded = decodeState(hash);
    expect(decoded.gameId).toBe('brain-teaser');
    expect(decoded.state).toEqual(BRAIN_TEASER_STATE);
  });

  it('roundtrips Crowd Runner state', () => {
    const hash = encodeState('crowd-runner', CROWD_RUNNER_STATE);
    const decoded = decodeState(hash);
    expect(decoded.gameId).toBe('crowd-runner');
    expect(decoded.state).toEqual(CROWD_RUNNER_STATE);
  });

  it('roundtrips empty state object', () => {
    const hash = encodeState('water-sort', {});
    const decoded = decodeState(hash);
    expect(decoded.state).toEqual({});
  });

  it('roundtrips null state', () => {
    const hash = encodeState('water-sort', null);
    const decoded = decodeState(hash);
    expect(decoded.state).toBeNull();
  });

  it('roundtrips array state', () => {
    const arr = [1, 2, 3, 'a', { nested: true }];
    const hash = encodeState('merge-games', arr);
    const decoded = decodeState(hash);
    expect(decoded.state).toEqual(arr);
  });

  it('preserves custom version number', () => {
    const hash = encodeState('water-sort', WATER_SORT_STATE, 3);
    const decoded = decodeState(hash);
    expect(decoded.version).toBe(3);
  });
});

// ─── URL format ───────────────────────────────────────────────────────────────

describe('State URL — hash format', () => {
  it('starts with #s=', () => {
    const hash = encodeState('water-sort', WATER_SORT_STATE);
    expect(hash.startsWith('#s=')).toBe(true);
  });

  it('contains gameId in hash', () => {
    const hash = encodeState('parking-escape', PARKING_ESCAPE_STATE);
    expect(hash).toContain('parking-escape');
  });

  it('contains version number in hash', () => {
    const hash = encodeState('water-sort', WATER_SORT_STATE);
    // Format: #s=<gameId>.<version>.<b64>
    const parts = hash.slice(3).split('.');
    expect(parts.length).toBeGreaterThanOrEqual(3);
    expect(parseInt(parts[1])).toBe(1);
  });

  it('uses URL-safe characters only (no +, /, = outside base64url)', () => {
    const hash = encodeState('water-sort', WATER_SORT_STATE);
    // Fragment can contain any chars, but base64url section should be URL-safe
    const b64Part = hash.split('.').slice(2).join('.');
    expect(b64Part).not.toMatch(/[+/=]/);
  });
});

// ─── URL length ───────────────────────────────────────────────────────────────

describe('State URL — length constraints', () => {
  it('Water Sort state fits well under 2000 chars', () => {
    const len = encodedLength('water-sort', WATER_SORT_STATE);
    expect(len).toBeLessThan(500);
  });

  it('Parking Escape state fits under 2000 chars', () => {
    const len = encodedLength('parking-escape', PARKING_ESCAPE_STATE);
    expect(len).toBeLessThan(500);
  });

  it('large state with many moves stays under 2000 chars', () => {
    const largeState = {
      levelId: 'ws-gen-hard-0-50',
      tubes: Array.from({ length: 10 }, (_, i) => ({
        colors: ['red', 'blue', 'green', 'yellow'].slice(0, (i % 4) + 1),
        capacity: 4,
      })),
      moves: 50,
      moveHistory: Array.from({ length: 50 }, (_, i) => ({ from: i % 5, to: (i + 1) % 5 })),
      status: 'playing',
    };
    const len = encodedLength('water-sort', largeState);
    expect(len).toBeLessThan(2000);
  });
});

// ─── isStateHash ──────────────────────────────────────────────────────────────

describe('isStateHash', () => {
  it('returns true for valid state hashes', () => {
    const hash = encodeState('water-sort', WATER_SORT_STATE);
    expect(isStateHash(hash)).toBe(true);
  });

  it('returns false for empty hash', () => {
    expect(isStateHash('')).toBe(false);
    expect(isStateHash(null)).toBe(false);
  });

  it('returns false for non-state hashes', () => {
    expect(isStateHash('#level=5')).toBe(false);
    expect(isStateHash('#/home')).toBe(false);
    expect(isStateHash('#')).toBe(false);
  });

  it('works with hash that lacks leading #', () => {
    const hash = encodeState('water-sort', {});
    const withoutHash = hash.slice(1);
    expect(isStateHash(withoutHash)).toBe(true);
  });
});

// ─── decodeState error handling ───────────────────────────────────────────────

describe('decodeState — invalid inputs', () => {
  it('returns null for null', () => {
    expect(decodeState(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodeState('')).toBeNull();
  });

  it('returns null for non-state hash', () => {
    expect(decodeState('#level=5')).toBeNull();
  });

  it('returns null for truncated hash', () => {
    expect(decodeState('#s=water-sort')).toBeNull();
    expect(decodeState('#s=water-sort.1')).toBeNull();
  });

  it('returns null for corrupted base64', () => {
    expect(decodeState('#s=water-sort.1.!!!invalid!!!')).toBeNull();
  });

  it('returns null for wrong number of segments', () => {
    expect(decodeState('#s=nodots')).toBeNull();
  });
});

// ─── encodeState validation ───────────────────────────────────────────────────

describe('encodeState — validation', () => {
  it('throws on missing gameId', () => {
    expect(() => encodeState('', {})).toThrow();
    expect(() => encodeState(null, {})).toThrow();
  });

  it('throws on non-string gameId', () => {
    expect(() => encodeState(123, {})).toThrow();
  });
});
