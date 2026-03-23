/**
 * Analytics — Unit Tests
 *
 * Tests event appending, retrieval, LRU eviction, and clearAnalytics.
 * The DOM dashboard (renderDashboard) is omitted — it's a visual tool
 * with no testable return value.
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock localStorage ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ─── Mock capabilities (no real browser checks in node) ───────────────────────

vi.mock('../../src/shared/capabilities.js', () => ({
  getCapabilities: vi.fn(() => ({ canvas2d: true, webgl: false, touch: false })),
}));

import {
  trackGameStart,
  trackLevelComplete,
  trackLevelAbandon,
  trackSessionStart,
  trackSessionEnd,
  trackFeatureUse,
  getEvents,
  clearAnalytics,
} from '../../src/shared/analytics.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clear() {
  clearAnalytics();
}

// ─── clearAnalytics / getEvents baseline ──────────────────────────────────────

describe('clearAnalytics', () => {
  beforeEach(clear);

  it('starts with zero events', () => {
    expect(getEvents()).toHaveLength(0);
  });

  it('removes all events', () => {
    trackGameStart({ gameId: 'water-sort', levelId: 1 });
    clearAnalytics();
    expect(getEvents()).toHaveLength(0);
  });
});

// ─── trackGameStart ───────────────────────────────────────────────────────────

describe('trackGameStart', () => {
  beforeEach(clear);

  it('appends a game_start event', () => {
    trackGameStart({ gameId: 'water-sort', levelId: 'ws-001' });
    const events = getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('game_start');
    expect(events[0].gameId).toBe('water-sort');
    expect(events[0].levelId).toBe('ws-001');
  });

  it('defaults source to "hub"', () => {
    trackGameStart({ gameId: 'water-sort', levelId: 1 });
    expect(getEvents()[0].source).toBe('hub');
  });

  it('records provided source', () => {
    trackGameStart({ gameId: 'water-sort', levelId: 1, source: 'daily' });
    expect(getEvents()[0].source).toBe('daily');
  });

  it('records a numeric timestamp', () => {
    trackGameStart({ gameId: 'water-sort', levelId: 1 });
    expect(typeof getEvents()[0].timestamp).toBe('number');
  });

  it('accumulates multiple events', () => {
    trackGameStart({ gameId: 'water-sort', levelId: 1 });
    trackGameStart({ gameId: 'pull-the-pin', levelId: 2 });
    expect(getEvents()).toHaveLength(2);
  });
});

// ─── trackLevelComplete ───────────────────────────────────────────────────────

describe('trackLevelComplete', () => {
  beforeEach(clear);

  it('appends a level_complete event with all fields', () => {
    trackLevelComplete({ gameId: 'water-sort', levelId: 'ws-001', moves: 12, time: 30000 });
    const [e] = getEvents();
    expect(e.event).toBe('level_complete');
    expect(e.gameId).toBe('water-sort');
    expect(e.levelId).toBe('ws-001');
    expect(e.moves).toBe(12);
    expect(e.time).toBe(30000);
  });

  it('defaults hintsUsed and retries to 0', () => {
    trackLevelComplete({ gameId: 'water-sort', levelId: 1, moves: 5, time: 10000 });
    const [e] = getEvents();
    expect(e.hintsUsed).toBe(0);
    expect(e.retries).toBe(0);
  });

  it('records provided hintsUsed and optimalMoves', () => {
    trackLevelComplete({ gameId: 'water-sort', levelId: 1, moves: 10, time: 15000, hintsUsed: 2, optimalMoves: 7 });
    const [e] = getEvents();
    expect(e.hintsUsed).toBe(2);
    expect(e.optimalMoves).toBe(7);
  });
});

// ─── trackLevelAbandon ────────────────────────────────────────────────────────

describe('trackLevelAbandon', () => {
  beforeEach(clear);

  it('appends a level_abandon event', () => {
    trackLevelAbandon({ gameId: 'parking-escape', levelId: 'pe-005' });
    const [e] = getEvents();
    expect(e.event).toBe('level_abandon');
    expect(e.gameId).toBe('parking-escape');
  });

  it('defaults reason to "quit"', () => {
    trackLevelAbandon({ gameId: 'parking-escape', levelId: 1 });
    expect(getEvents()[0].reason).toBe('quit');
  });

  it('defaults movesAtAbandon and timeAtAbandon to 0 when omitted', () => {
    trackLevelAbandon({ gameId: 'parking-escape', levelId: 1 });
    const [e] = getEvents();
    expect(e.movesAtAbandon).toBe(0);
    expect(e.timeAtAbandon).toBe(0);
  });

  it('records provided reason', () => {
    trackLevelAbandon({ gameId: 'parking-escape', levelId: 1, reason: 'skip' });
    expect(getEvents()[0].reason).toBe('skip');
  });

  it('records movesAtAbandon and timeAtAbandon', () => {
    trackLevelAbandon({ gameId: 'water-sort', levelId: 1, movesAtAbandon: 5, timeAtAbandon: 12000 });
    const [e] = getEvents();
    expect(e.movesAtAbandon).toBe(5);
    expect(e.timeAtAbandon).toBe(12000);
  });
});

// ─── trackSessionStart ────────────────────────────────────────────────────────

describe('trackSessionStart', () => {
  beforeEach(clear);

  it('appends a session_start event', () => {
    trackSessionStart();
    const events = getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('session_start');
  });

  it('includes a capabilities field', () => {
    trackSessionStart();
    expect(getEvents()[0].capabilities).toBeDefined();
  });
});

// ─── trackSessionEnd ──────────────────────────────────────────────────────────

describe('trackSessionEnd', () => {
  beforeEach(clear);

  it('appends a session_end event', () => {
    trackSessionEnd({ gamesPlayed: 2, levelsCompleted: 5, totalTime: 60000 });
    const [e] = getEvents();
    expect(e.event).toBe('session_end');
    expect(e.gamesPlayed).toBe(2);
    expect(e.levelsCompleted).toBe(5);
    expect(e.totalTime).toBe(60000);
  });

  it('defaults all fields to 0', () => {
    trackSessionEnd();
    const [e] = getEvents();
    expect(e.gamesPlayed).toBe(0);
    expect(e.levelsCompleted).toBe(0);
    expect(e.totalTime).toBe(0);
  });
});

// ─── trackFeatureUse ──────────────────────────────────────────────────────────

describe('trackFeatureUse', () => {
  beforeEach(clear);

  it('appends a feature_use event', () => {
    trackFeatureUse('hint');
    const [e] = getEvents();
    expect(e.event).toBe('feature_use');
    expect(e.feature).toBe('hint');
  });

  it('merges extra context into the event', () => {
    trackFeatureUse('share', { gameId: 'water-sort', platform: 'clipboard' });
    const [e] = getEvents();
    expect(e.gameId).toBe('water-sort');
    expect(e.platform).toBe('clipboard');
  });

  it('works without extra context', () => {
    expect(() => trackFeatureUse('undo')).not.toThrow();
    expect(getEvents()[0].feature).toBe('undo');
  });
});

// ─── LRU eviction (MAX_EVENTS = 500) ─────────────────────────────────────────

describe('LRU eviction', () => {
  beforeEach(clear);

  it('does not exceed 500 events', () => {
    for (let i = 0; i < 520; i++) {
      trackGameStart({ gameId: 'water-sort', levelId: i });
    }
    const events = getEvents();
    expect(events.length).toBeLessThanOrEqual(500);
  });

  it('keeps the most recent events when evicting', () => {
    for (let i = 0; i < 510; i++) {
      trackGameStart({ gameId: 'water-sort', levelId: i });
    }
    const events = getEvents();
    // The oldest events (low levelId) should have been dropped
    const ids = events.map(e => e.levelId);
    expect(ids).not.toContain(0);
    expect(ids).toContain(509);
  });
});

// ─── event ordering ───────────────────────────────────────────────────────────

describe('event ordering', () => {
  beforeEach(clear);

  it('preserves insertion order', () => {
    trackGameStart({ gameId: 'water-sort', levelId: 1 });
    trackLevelComplete({ gameId: 'water-sort', levelId: 1, moves: 5, time: 8000 });
    trackSessionEnd({ levelsCompleted: 1 });

    const events = getEvents();
    expect(events[0].event).toBe('game_start');
    expect(events[1].event).toBe('level_complete');
    expect(events[2].event).toBe('session_end');
  });
});

// ─── persistence across calls ─────────────────────────────────────────────────

describe('persistence', () => {
  beforeEach(clear);

  it('events persist across multiple getEvents calls', () => {
    trackGameStart({ gameId: 'water-sort', levelId: 1 });
    getEvents(); // read once
    expect(getEvents()).toHaveLength(1);
  });

  it('getEvents does not modify the stored event list', () => {
    trackGameStart({ gameId: 'water-sort', levelId: 1 });
    const events = getEvents();
    events.push({ event: 'injected' });
    // The injected event should not appear in the next read
    expect(getEvents()).toHaveLength(1);
  });
});

// ─── storage error resilience ─────────────────────────────────────────────────

describe('storage error resilience', () => {
  beforeEach(clear);

  it('getEvents returns empty array when localStorage has invalid JSON', () => {
    localStorageMock.setItem('mg:global:analytics', '{ corrupted: json }');
    expect(getEvents()).toEqual([]);
  });

  it('trackGameStart does not throw when both write attempts hit quota', () => {
    localStorageMock.setItem
      .mockImplementationOnce(() => { throw new Error('QuotaExceededError'); })
      .mockImplementationOnce(() => { throw new Error('QuotaExceededError'); });
    expect(() => trackGameStart({ gameId: 'test', levelId: 1 })).not.toThrow();
  });

  it('retries with trimmed events when first write fails', () => {
    for (let i = 0; i < 20; i++) {
      trackGameStart({ gameId: 'test', levelId: i });
    }
    // First write attempt throws, retry uses original store implementation
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => trackGameStart({ gameId: 'test', levelId: 20 })).not.toThrow();
    // After trimming and retrying, stored events are fewer than 21
    expect(getEvents().length).toBeLessThan(21);
  });
});
