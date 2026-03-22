/**
 * Storage — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests StorageManager (get, set, delete, clear, namespacing, versioning, LRU)
 * and the settings/stats convenience helpers (getSettings, updateSettings,
 * getGameStats, updateGameStats).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock localStorage ────────────────────────────────────────────────────────

let _store = {};

const localStorageMock = {
  getItem:    vi.fn((key)        => _store[key] ?? null),
  setItem:    vi.fn((key, value) => { _store[key] = String(value); }),
  removeItem: vi.fn((key)        => { delete _store[key]; }),
  clear:      vi.fn(()           => { _store = {}; }),
  get length()  { return Object.keys(_store).length; },
  key:        vi.fn((i)          => Object.keys(_store)[i] ?? null),
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  StorageManager,
  storage,
  get,
  set,
  del,
  clear,
  isStorageAvailable,
  getSettings,
  updateSettings,
  getGameStats,
  updateGameStats,
} from '../../src/shared/storage.js';

function resetStore() {
  _store = {};
  vi.clearAllMocks();
  // Re-bind the key fn to the new _store
  localStorageMock.getItem.mockImplementation((k)    => _store[k] ?? null);
  localStorageMock.setItem.mockImplementation((k, v) => { _store[k] = String(v); });
  localStorageMock.removeItem.mockImplementation((k) => { delete _store[k]; });
  localStorageMock.clear.mockImplementation(()       => { _store = {}; });
  localStorageMock.key.mockImplementation((i)        => Object.keys(_store)[i] ?? null);
}

beforeEach(() => {
  // Clear in-memory cache first (before resetting the mock), then reset mock
  storage.cache.clear();
  storage.accessOrder = [];
  resetStore();
});

// ─── StorageManager.getNamespacedKey ─────────────────────────────────────────

describe('StorageManager — namespacing', () => {
  it('prefixes keys with "mg:"', () => {
    const sm = new StorageManager();
    expect(sm.getNamespacedKey('foo')).toBe('mg:foo');
  });

  it('set() uses namespaced key in localStorage', () => {
    const sm = new StorageManager();
    sm.set('mykey', 'value');
    expect(_store['mg:mykey']).toBeDefined();
    expect(_store['mykey']).toBeUndefined();
  });

  it('get() reads from namespaced key', () => {
    const sm = new StorageManager();
    sm.set('k', 42);
    // Create fresh manager (no in-memory cache)
    const sm2 = new StorageManager();
    expect(sm2.get('k')).toBe(42);
  });
});

// ─── StorageManager.get / set ─────────────────────────────────────────────────

describe('StorageManager — get', () => {
  it('returns defaultValue when key not present (null default)', () => {
    const sm = new StorageManager();
    expect(sm.get('nonexistent')).toBeNull();
  });

  it('returns custom defaultValue when key not present', () => {
    const sm = new StorageManager();
    expect(sm.get('nonexistent', 99)).toBe(99);
  });

  it('returns stored value', () => {
    const sm = new StorageManager();
    sm.set('x', { hello: 'world' });
    const sm2 = new StorageManager();
    expect(sm2.get('x')).toEqual({ hello: 'world' });
  });

  it('returns defaultValue for version mismatch', () => {
    // Manually write version 2 data when manager expects version 1
    _store['mg:vkey'] = JSON.stringify({ v: 2, data: 'stale' });
    const sm = new StorageManager();
    expect(sm.get('vkey', 'fallback')).toBe('fallback');
  });

  it('uses in-memory cache on second get', () => {
    const sm = new StorageManager();
    sm.set('cached', 'val');
    // Delete from localStorage to confirm cache is used
    delete _store['mg:cached'];
    expect(sm.get('cached')).toBe('val');
  });
});

describe('StorageManager — set', () => {
  it('stores a string value', () => {
    const sm = new StorageManager();
    sm.set('s', 'hello');
    const sm2 = new StorageManager();
    expect(sm2.get('s')).toBe('hello');
  });

  it('stores a number value', () => {
    const sm = new StorageManager();
    sm.set('n', 42);
    const sm2 = new StorageManager();
    expect(sm2.get('n')).toBe(42);
  });

  it('stores an array', () => {
    const sm = new StorageManager();
    sm.set('arr', [1, 2, 3]);
    const sm2 = new StorageManager();
    expect(sm2.get('arr')).toEqual([1, 2, 3]);
  });

  it('stores an object', () => {
    const sm = new StorageManager();
    sm.set('obj', { a: 1, b: 'two' });
    const sm2 = new StorageManager();
    expect(sm2.get('obj')).toEqual({ a: 1, b: 'two' });
  });

  it('overwrites an existing value', () => {
    const sm = new StorageManager();
    sm.set('k', 'first');
    sm.set('k', 'second');
    expect(sm.get('k')).toBe('second');
  });

  it('returns true on success', () => {
    const sm = new StorageManager();
    expect(sm.set('k', 'v')).toBe(true);
  });
});

// ─── StorageManager.delete ────────────────────────────────────────────────────

describe('StorageManager — delete', () => {
  it('removes value from storage', () => {
    const sm = new StorageManager();
    sm.set('toDelete', 'value');
    sm.delete('toDelete');
    expect(sm.get('toDelete')).toBeNull();
  });

  it('removes from localStorage', () => {
    const sm = new StorageManager();
    sm.set('toDelete', 'v');
    sm.delete('toDelete');
    expect(_store['mg:toDelete']).toBeUndefined();
  });

  it('removes from cache', () => {
    const sm = new StorageManager();
    sm.set('toDelete', 'v');
    sm.delete('toDelete');
    // Even without going to localStorage, should return default
    delete _store['mg:toDelete']; // ensure not in storage either
    expect(sm.get('toDelete', 'default')).toBe('default');
  });

  it('is safe to call for non-existent key', () => {
    const sm = new StorageManager();
    expect(() => sm.delete('nonexistent')).not.toThrow();
  });
});

// ─── StorageManager.clear ────────────────────────────────────────────────────

describe('StorageManager — clear', () => {
  it('removes all namespaced keys', () => {
    const sm = new StorageManager();
    sm.set('a', 1);
    sm.set('b', 2);
    sm.clear();
    expect(sm.get('a')).toBeNull();
    expect(sm.get('b')).toBeNull();
  });

  it('does not remove non-namespaced keys', () => {
    const sm = new StorageManager();
    _store['other:key'] = 'should-remain';
    sm.set('mg-key', 'value');
    sm.clear();
    expect(_store['other:key']).toBe('should-remain');
  });
});

// ─── Convenience exports (get/set/del/clear) ──────────────────────────────────

describe('module-level get/set/del/clear', () => {
  it('set and get round-trip', () => {
    set('mod-key', { data: 42 });
    expect(get('mod-key')).toEqual({ data: 42 });
  });

  it('del removes a key', () => {
    set('del-key', 'value');
    del('del-key');
    expect(get('del-key')).toBeNull();
  });

  it('clear wipes all module-level storage', () => {
    set('k1', 1);
    set('k2', 2);
    clear();
    expect(get('k1')).toBeNull();
    expect(get('k2')).toBeNull();
  });
});

// ─── isStorageAvailable ───────────────────────────────────────────────────────

describe('isStorageAvailable', () => {
  it('returns true in jsdom environment', () => {
    expect(isStorageAvailable()).toBe(true);
  });
});

// ─── getSettings / updateSettings ────────────────────────────────────────────

describe('getSettings', () => {
  it('returns default settings when none stored', () => {
    const settings = getSettings();
    expect(typeof settings.soundEnabled).toBe('boolean');
    expect(typeof settings.hapticEnabled).toBe('boolean');
    expect(typeof settings.reducedMotion).toBe('boolean');
  });

  it('default soundEnabled is true', () => {
    expect(getSettings().soundEnabled).toBe(true);
  });

  it('default hapticEnabled is true', () => {
    expect(getSettings().hapticEnabled).toBe(true);
  });

  it('default reducedMotion is false', () => {
    expect(getSettings().reducedMotion).toBe(false);
  });
});

describe('updateSettings', () => {
  it('updates a single setting', () => {
    updateSettings({ soundEnabled: false });
    expect(getSettings().soundEnabled).toBe(false);
  });

  it('merges updates with existing settings', () => {
    updateSettings({ soundEnabled: false });
    updateSettings({ hapticEnabled: false });
    const s = getSettings();
    expect(s.soundEnabled).toBe(false);
    expect(s.hapticEnabled).toBe(false);
  });

  it('preserves unmodified settings', () => {
    updateSettings({ soundEnabled: false });
    expect(getSettings().hapticEnabled).toBe(true); // unchanged
  });

  it('returns true on success', () => {
    expect(updateSettings({ soundEnabled: true })).toBe(true);
  });
});

// ─── getGameStats / updateGameStats ──────────────────────────────────────────

describe('getGameStats', () => {
  it('returns zero-value defaults for unknown game', () => {
    const stats = getGameStats('unknown-game');
    expect(stats.played).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.stars).toBe(0);
    expect(stats.lastLevel).toBe(0);
    expect(stats.highScores).toEqual({});
  });

  it('returns previously stored stats', () => {
    updateGameStats('water-sort', { played: 1 });
    expect(getGameStats('water-sort').played).toBe(1);
  });
});

describe('updateGameStats', () => {
  it('increments played count', () => {
    updateGameStats('water-sort', { played: 1 });
    updateGameStats('water-sort', { played: 1 });
    expect(getGameStats('water-sort').played).toBe(2);
  });

  it('increments completed count', () => {
    updateGameStats('water-sort', { completed: 1 });
    updateGameStats('water-sort', { completed: 1 });
    expect(getGameStats('water-sort').completed).toBe(2);
  });

  it('increments stars count', () => {
    updateGameStats('water-sort', { stars: 3 });
    updateGameStats('water-sort', { stars: 2 });
    expect(getGameStats('water-sort').stars).toBe(5);
  });

  it('overwrites non-numeric fields (lastLevel)', () => {
    updateGameStats('water-sort', { lastLevel: 3 });
    updateGameStats('water-sort', { lastLevel: 7 });
    expect(getGameStats('water-sort').lastLevel).toBe(7);
  });

  it('overwrites highScores object', () => {
    updateGameStats('water-sort', { highScores: { 0: 100 } });
    updateGameStats('water-sort', { highScores: { 0: 95, 1: 88 } });
    expect(getGameStats('water-sort').highScores).toEqual({ 0: 95, 1: 88 });
  });

  it('stats are independent per game', () => {
    updateGameStats('game-a', { played: 5 });
    updateGameStats('game-b', { played: 2 });
    expect(getGameStats('game-a').played).toBe(5);
    expect(getGameStats('game-b').played).toBe(2);
  });

  it('returns true on success', () => {
    expect(updateGameStats('water-sort', { played: 1 })).toBe(true);
  });
});
