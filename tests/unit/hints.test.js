/**
 * Hints System — Unit Tests
 *
 * Tests for hint token management (daily replenishment, spending, adding)
 * and createHintSession (progressive reveal, worker communication, idle timer).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock StorageManager ───────────────────────────────────────────────────────

let _store = {};

vi.mock('../../src/shared/storage.js', () => ({
  StorageManager: class MockStorageManager {
    get(key, def = null) {
      return key in _store ? _store[key] : def;
    }
    set(key, val) {
      _store[key] = val;
      return true;
    }
  },
}));

import {
  getHintTokens,
  spendHintToken,
  addHintTokens,
  createHintSession,
} from '../../src/shared/hints.js';

// ─── Worker mock factory ───────────────────────────────────────────────────────

function makeWorkerMock() {
  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
    respond(data) {
      if (this.onmessage) this.onmessage({ data });
    },
  };
}

let fakeWorker = null;

function installWorkerMock() {
  global.Worker = vi.fn(() => {
    fakeWorker = makeWorkerMock();
    return fakeWorker;
  });
}

// ─── Token Management ─────────────────────────────────────────────────────────

describe('getHintTokens', () => {
  beforeEach(() => {
    _store = {};
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 5 (TOKENS_PER_DAY) when no stored data', () => {
    expect(getHintTokens()).toBe(5);
  });

  it('returns stored count for current day', () => {
    _store['hint-tokens'] = { date: '2026-03-22', count: 3 };
    expect(getHintTokens()).toBe(3);
  });

  it('replenishes to 5 when date is stale', () => {
    _store['hint-tokens'] = { date: '2026-03-21', count: 1 };
    expect(getHintTokens()).toBe(5);
  });

  it('updates stored date after replenishment', () => {
    _store['hint-tokens'] = { date: '2026-03-20', count: 0 };
    getHintTokens();
    expect(_store['hint-tokens'].date).toBe('2026-03-22');
    expect(_store['hint-tokens'].count).toBe(5);
  });

  it('persists the initial token grant', () => {
    getHintTokens();
    expect(_store['hint-tokens']).toEqual({ date: '2026-03-22', count: 5 });
  });
});

describe('spendHintToken', () => {
  beforeEach(() => {
    _store = {};
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true and decrements count from default', () => {
    expect(spendHintToken()).toBe(true);
    expect(_store['hint-tokens'].count).toBe(4);
  });

  it('returns false when token count is 0', () => {
    _store['hint-tokens'] = { date: '2026-03-22', count: 0 };
    expect(spendHintToken()).toBe(false);
  });

  it('does not change count when returning false', () => {
    _store['hint-tokens'] = { date: '2026-03-22', count: 0 };
    spendHintToken();
    expect(_store['hint-tokens'].count).toBe(0);
  });

  it('can spend down to zero then blocks', () => {
    _store['hint-tokens'] = { date: '2026-03-22', count: 1 };
    expect(spendHintToken()).toBe(true);
    expect(_store['hint-tokens'].count).toBe(0);
    expect(spendHintToken()).toBe(false);
  });
});

describe('addHintTokens', () => {
  beforeEach(() => {
    _store = {};
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds to the default daily balance', () => {
    addHintTokens(3);
    expect(_store['hint-tokens'].count).toBe(8); // 5 default + 3
  });

  it('adds to a partial balance', () => {
    _store['hint-tokens'] = { date: '2026-03-22', count: 2 };
    addHintTokens(3);
    expect(_store['hint-tokens'].count).toBe(5);
  });

  it('works with a zero balance', () => {
    _store['hint-tokens'] = { date: '2026-03-22', count: 0 };
    addHintTokens(2);
    expect(_store['hint-tokens'].count).toBe(2);
  });
});

// ─── createHintSession ────────────────────────────────────────────────────────

describe('createHintSession', () => {
  let session;
  let onHighlight, onShowMove, onAutoPlay, onTokensEmpty, onWorkerError;

  function makeSession(overrides = {}) {
    onHighlight = vi.fn();
    onShowMove = vi.fn();
    onAutoPlay = vi.fn();
    onTokensEmpty = vi.fn();
    onWorkerError = vi.fn();

    return createHintSession({
      gameId: 'water-sort',
      level: { id: 'ws-test-1' },
      getState: () => ({
        tubes: [['red', 'blue'], ['blue', 'red']],
        maxSegments: 2,
      }),
      onHighlight,
      onShowMove,
      onAutoPlay,
      onTokensEmpty,
      onWorkerError,
      ...overrides,
    });
  }

  const MOVES = [{ from: 0, to: 1 }, { from: 1, to: 2 }];

  beforeEach(() => {
    _store = {};
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22'));
    installWorkerMock();
    fakeWorker = null;
    session = makeSession();
  });

  afterEach(() => {
    session?.destroy();
    vi.useRealTimers();
  });

  // ── API shape ──────────────────────────────────────────────────────────────

  it('exposes showHint, reset, onUserInput, destroy', () => {
    expect(typeof session.showHint).toBe('function');
    expect(typeof session.reset).toBe('function');
    expect(typeof session.onUserInput).toBe('function');
    expect(typeof session.destroy).toBe('function');
  });

  it('starts at level 0', () => {
    expect(session.level).toBe(0);
  });

  it('starts with null moves', () => {
    expect(session.moves).toBeNull();
  });

  it('tokens getter returns current balance', () => {
    _store['hint-tokens'] = { date: '2026-03-22', count: 3 };
    expect(session.tokens).toBe(3);
  });

  // ── showHint → worker communication ───────────────────────────────────────

  it('showHint() level 1 returns true and creates a worker', () => {
    const result = session.showHint();
    expect(result).toBe(true);
    expect(global.Worker).toHaveBeenCalledOnce();
  });

  it('showHint() posts the correct message to the worker', () => {
    session.showHint();
    expect(fakeWorker.postMessage).toHaveBeenCalledWith({
      gameId: 'water-sort',
      state: { tubes: [['red', 'blue'], ['blue', 'red']], maxSegments: 2 },
      level: { id: 'ws-test-1' },
    });
  });

  it('does not post a second message while a request is pending', () => {
    session.showHint(); // level 1 — pending
    session.showHint(); // level 2 — still pending, should not re-post
    expect(fakeWorker.postMessage).toHaveBeenCalledOnce();
  });

  // ── progressive reveal ─────────────────────────────────────────────────────

  it('calls onHighlight when worker responds at level 1', () => {
    session.showHint();
    fakeWorker.respond({ moves: MOVES });
    expect(onHighlight).toHaveBeenCalledWith({ move: MOVES[0], level: 1 });
    expect(onShowMove).not.toHaveBeenCalled();
    expect(onAutoPlay).not.toHaveBeenCalled();
  });

  it('calls onHighlight + onShowMove at level 2', () => {
    session.showHint();                    // level 1
    fakeWorker.respond({ moves: MOVES }); // moves cached, onHighlight fired
    session.showHint();                    // level 2, moves cached → immediate

    expect(onHighlight).toHaveBeenCalledTimes(2);
    expect(onShowMove).toHaveBeenCalledWith({ move: MOVES[0], level: 2 });
    expect(onAutoPlay).not.toHaveBeenCalled();
  });

  it('calls all three callbacks at level 3', () => {
    session.showHint();
    fakeWorker.respond({ moves: MOVES });
    session.showHint(); // level 2
    session.showHint(); // level 3 — spends token

    expect(onHighlight).toHaveBeenCalledTimes(3);
    expect(onShowMove).toHaveBeenCalledTimes(2);
    expect(onAutoPlay).toHaveBeenCalledWith({ move: MOVES[0] });
  });

  it('level 3 deducts one token', () => {
    session.showHint();
    fakeWorker.respond({ moves: MOVES });
    session.showHint();
    session.showHint(); // level 3

    expect(_store['hint-tokens'].count).toBe(4); // 5 - 1
  });

  it('level 3 calls onTokensEmpty and returns false when no tokens', () => {
    _store['hint-tokens'] = { date: '2026-03-22', count: 0 };
    session.showHint();
    fakeWorker.respond({ moves: MOVES });
    session.showHint(); // level 2

    const result = session.showHint(); // level 3 — no tokens
    expect(result).toBe(false);
    expect(onTokensEmpty).toHaveBeenCalledOnce();
    expect(onAutoPlay).not.toHaveBeenCalled();
    expect(session.level).toBe(2); // stays at 2
  });

  it('returns false when called beyond level 3', () => {
    session.showHint();
    fakeWorker.respond({ moves: MOVES });
    session.showHint();
    session.showHint(); // level 3

    const result = session.showHint(); // level 4 — beyond max
    expect(result).toBe(false);
    expect(session.level).toBe(3);
  });

  // ── worker error handling ──────────────────────────────────────────────────

  it('calls onWorkerError when worker message contains error', () => {
    session.showHint();
    fakeWorker.respond({ error: 'Solver could not find a solution' });
    expect(onWorkerError).toHaveBeenCalledWith('Solver could not find a solution');
  });

  it('calls onWorkerError on worker onerror event', () => {
    session.showHint();
    fakeWorker.onerror({ message: 'Worker crashed' });
    expect(onWorkerError).toHaveBeenCalledWith('Worker crashed');
  });

  // ── caching ────────────────────────────────────────────────────────────────

  it('reuses cached moves without re-posting to worker', () => {
    session.showHint();
    fakeWorker.respond({ moves: MOVES });

    const callsBefore = fakeWorker.postMessage.mock.calls.length;
    session.showHint(); // level 2 — cached
    session.showHint(); // level 3 — cached
    expect(fakeWorker.postMessage.mock.calls.length).toBe(callsBefore);
  });

  it('stores moves after worker response', () => {
    session.showHint();
    fakeWorker.respond({ moves: MOVES });
    expect(session.moves).toEqual(MOVES);
  });

  // ── reset ──────────────────────────────────────────────────────────────────

  it('reset clears level and moves', () => {
    session.showHint();
    fakeWorker.respond({ moves: MOVES });
    expect(session.level).toBe(1);

    session.reset();
    expect(session.level).toBe(0);
    expect(session.moves).toBeNull();
  });

  it('after reset, showHint re-fetches solution', () => {
    session.showHint();
    fakeWorker.respond({ moves: MOVES });
    session.reset();

    session.showHint(); // should re-post
    expect(fakeWorker.postMessage).toHaveBeenCalledTimes(2);
  });

  // ── idle timer ─────────────────────────────────────────────────────────────

  it('idle timer fires after 15s and pre-fetches solution', () => {
    expect(fakeWorker).toBeNull(); // not yet created
    vi.advanceTimersByTime(15_000);
    expect(fakeWorker).not.toBeNull();
    expect(fakeWorker.postMessage).toHaveBeenCalledOnce();
  });

  it('idle timer does not fire before 15s', () => {
    vi.advanceTimersByTime(14_999);
    expect(fakeWorker).toBeNull();
  });

  it('idle timer does not pre-fetch if a hint is already shown', () => {
    session.showHint();                    // level 1 shown
    fakeWorker.respond({ moves: MOVES }); // moves cached
    const w = fakeWorker;

    vi.advanceTimersByTime(15_000); // timer fires but currentLevel > 0 — no re-fetch
    expect(w.postMessage).toHaveBeenCalledOnce(); // only the original request
  });

  it('onUserInput resets idle timer', () => {
    vi.advanceTimersByTime(10_000);
    session.onUserInput(); // resets timer

    vi.advanceTimersByTime(10_000); // 10s since reset — timer not fired yet
    expect(fakeWorker).toBeNull();

    vi.advanceTimersByTime(5_000); // 15s since reset — fires now
    expect(fakeWorker).not.toBeNull();
  });

  // ── destroy ────────────────────────────────────────────────────────────────

  it('destroy terminates the worker', () => {
    session.showHint();
    const w = fakeWorker;
    session.destroy();
    expect(w.terminate).toHaveBeenCalledOnce();
  });

  it('destroy clears the idle timer (no worker created after destroy)', () => {
    session.destroy();
    vi.advanceTimersByTime(30_000); // should not fire — timer was cleared
    expect(fakeWorker).toBeNull();
  });
});
