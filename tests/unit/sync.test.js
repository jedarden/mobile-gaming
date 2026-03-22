/**
 * Cross-Device Progress Sync - Unit Tests
 *
 * Tests for export/import round-trip, merge logic, and code size.
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock storage ─────────────────────────────────────────────────────────────

const createMockStorage = () => ({
  data: {},
  get(key, defaultValue = null) {
    return key in this.data ? this.data[key] : defaultValue;
  },
  set(key, value) {
    this.data[key] = value;
    return true;
  },
  delete(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  },
  _getAllKeys() {
    return Object.keys(this.data);
  },
});

let mockStorage = createMockStorage();

vi.mock('../../src/shared/storage.js', () => ({
  storage: {
    get(key, defaultValue) { return mockStorage.get(key, defaultValue); },
    set(key, value) { return mockStorage.set(key, value); },
    delete(key) { return mockStorage.delete(key); },
    _getAllKeys() { return mockStorage._getAllKeys(); },
  },
}));

import {
  exportProgress,
  importProgress,
  shareProgress,
  base62Encode,
  base62Decode,
} from '../../src/shared/sync.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seedProgress() {
  mockStorage.set('settings', { soundEnabled: true, hapticEnabled: true, reducedMotion: false });
  mockStorage.set('global:settings', { sound: true, haptic: true, colorBlind: false, darkMode: null });
  mockStorage.set('stats', {
    'water-sort': { played: 20, completed: 15, stars: 45, lastLevel: 15, highScores: { 0: 100, 1: 80 } },
    'brain-teaser': { played: 10, completed: 8, stars: 24, lastLevel: 8, highScores: { 0: 90 } },
  });
  mockStorage.set('best-scores:water-sort:0', { optimality: 95, stars: 3, moves: 5, time: 30, rating: 'S' });
  mockStorage.set('fail-speedrun:bests:water-sort', { 0: 5000, 1: 7200 });
  mockStorage.set('fail-speedrun:badges', ['badge-first', 'badge-10-levels']);
  mockStorage.set('level-progress:water-sort', { 0: 1, 1: 1, 2: 1 });
  mockStorage.set('level-progress:water-sort:current', 3);
  mockStorage.set('playHistory', { 'water-sort': { lastPlayed: 1700000000000, playCount: 20 } });
  mockStorage.set('gameRing', [{ id: 'water-sort', title: 'Water Sort' }, { id: 'brain-teaser', title: 'Brain Teaser' }]);
}

// ─── Base62 ───────────────────────────────────────────────────────────────────

describe('base62Encode / base62Decode', () => {
  it('round-trips empty array', () => {
    const original = new Uint8Array(0);
    const encoded = base62Encode(original);
    const decoded = base62Decode(encoded);
    expect(decoded).toEqual(original);
  });

  it('round-trips single zero byte', () => {
    const original = new Uint8Array([0]);
    const encoded = base62Encode(original);
    expect(typeof encoded).toBe('string');
    // Decoding of a single zero should yield [0]
    const decoded = base62Decode(encoded);
    expect(decoded[0]).toBe(0);
  });

  it('round-trips known bytes', () => {
    const original = new Uint8Array([1, 2, 3, 255, 0, 128]);
    const encoded = base62Encode(original);
    expect(typeof encoded).toBe('string');
    expect(encoded).toMatch(/^[0-9A-Za-z]+$/);
    const decoded = base62Decode(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('round-trips larger buffer', () => {
    const original = new Uint8Array(200);
    for (let i = 0; i < 200; i++) original[i] = i % 256;
    const encoded = base62Encode(original);
    const decoded = base62Decode(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('throws on invalid base62 character', () => {
    expect(() => base62Decode('!invalid!')).toThrow('Invalid base62 character');
  });

  it('returns empty Uint8Array for empty string', () => {
    expect(base62Decode('')).toEqual(new Uint8Array(0));
  });
});

// ─── Export ───────────────────────────────────────────────────────────────────

describe('exportProgress', () => {
  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  it('returns a string starting with SYNC-', () => {
    seedProgress();
    const code = exportProgress();
    expect(typeof code).toBe('string');
    expect(code.startsWith('SYNC-')).toBe(true);
  });

  it('uses 5-char dash-separated groups', () => {
    seedProgress();
    const code = exportProgress();
    // Strip leading SYNC-
    const rest = code.slice(5);
    const groups = rest.split('-');
    // All groups except possibly the last should be 5 chars
    for (let i = 0; i < groups.length - 1; i++) {
      expect(groups[i].length).toBe(5);
    }
    expect(groups[groups.length - 1].length).toBeGreaterThanOrEqual(1);
    expect(groups[groups.length - 1].length).toBeLessThanOrEqual(5);
  });

  it('code contains only alphanumeric chars and dashes', () => {
    seedProgress();
    const code = exportProgress();
    expect(code).toMatch(/^SYNC(-[0-9A-Za-z]{1,5})+$/);
  });

  it('excludes gameState (ephemeral)', () => {
    seedProgress();
    mockStorage.set('gameState', { 'water-sort': { level: 3, inProgress: true } });
    const code = exportProgress();
    // Import into a fresh storage and verify gameState is not present
    mockStorage = createMockStorage();
    importProgress(code);
    expect(mockStorage.get('gameState', null)).toBeNull();
  });

  it('excludes failures: keys (ephemeral)', () => {
    seedProgress();
    mockStorage.set('failures:water-sort:0', 5);
    mockStorage.set('failures:brain-teaser:3', 2);
    const code = exportProgress();
    mockStorage = createMockStorage();
    importProgress(code);
    expect(mockStorage.get('failures:water-sort:0', null)).toBeNull();
  });

  it('produces compact code — typical progress fits in a long text message (< 3000 chars)', () => {
    // Seed representative multi-game progress: aggregate stats + scores + settings
    // (individual best-scores keys are large; typical users rely on stats.highScores)
    const gameIds = ['water-sort', 'brain-teaser', 'pull-the-pin', 'jelly-shift', 'crowd-runner', 'bridge-race'];
    const stats = {};
    for (const gid of gameIds) {
      const highScores = {};
      for (let l = 0; l < 50; l++) highScores[l] = 80 + (l % 20);
      stats[gid] = { played: 50, completed: 45, stars: 135, lastLevel: 45, highScores };
      mockStorage.set(`level-progress:${gid}`, Object.fromEntries(Array.from({ length: 50 }, (_, i) => [i, 1])));
      mockStorage.set(`level-progress:${gid}:current`, 45);
    }
    mockStorage.set('stats', stats);
    mockStorage.set('global:settings', { sound: true, colorBlind: false, darkMode: null });
    mockStorage.set('fail-speedrun:bests:water-sort', Object.fromEntries(Array.from({ length: 50 }, (_, i) => [i, 5000 + i * 100])));
    mockStorage.set('fail-speedrun:badges', ['badge-first', 'badge-10', 'badge-50', 'badge-speedrun']);

    const code = exportProgress();
    // Typical multi-game progress (50 levels × 6 games) should fit in a messaging app
    expect(code.length).toBeLessThan(3000);
  });
});

// ─── Import ───────────────────────────────────────────────────────────────────

describe('importProgress', () => {
  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  it('round-trip: exported data is fully restored', () => {
    seedProgress();
    const code = exportProgress();

    // Clear storage and re-import
    mockStorage = createMockStorage();
    const result = importProgress(code);

    expect(result.success).toBe(true);
    expect(result.version).toBe(1);

    expect(mockStorage.get('settings')).toEqual({ soundEnabled: true, hapticEnabled: true, reducedMotion: false });
    expect(mockStorage.get('global:settings')).toMatchObject({ sound: true, haptic: true });
    const stats = mockStorage.get('stats');
    expect(stats['water-sort'].completed).toBe(15);
    expect(mockStorage.get('best-scores:water-sort:0')).toMatchObject({ optimality: 95 });
    expect(mockStorage.get('fail-speedrun:bests:water-sort')).toEqual({ 0: 5000, 1: 7200 });
    expect(mockStorage.get('level-progress:water-sort')).toEqual({ 0: 1, 1: 1, 2: 1 });
    expect(mockStorage.get('gameRing')).toHaveLength(2);
  });

  it('returns success:false for null input', () => {
    expect(importProgress(null)).toEqual({ success: false, error: 'Invalid code' });
  });

  it('returns success:false for empty string', () => {
    expect(importProgress('')).toEqual({ success: false, error: 'Invalid code' });
  });

  it('returns success:false for garbled code', () => {
    expect(importProgress('SYNC-!!!!-XXXXX')).toMatchObject({ success: false });
  });

  it('returns success:false for truncated code', () => {
    expect(importProgress('SYNC-1AAAA')).toMatchObject({ success: false });
  });

  it('strips dashes and SYNC- prefix before decoding', () => {
    seedProgress();
    const code = exportProgress();
    const stripped = code.replace(/^SYNC-/, '').replace(/-/g, '');
    // Prepend SYNC- back and re-add dashes in different places to check tolerance
    mockStorage = createMockStorage();
    const result = importProgress('SYNC-' + stripped);
    expect(result.success).toBe(true);
  });

  it('is case-insensitive for SYNC- prefix', () => {
    seedProgress();
    const code = exportProgress();
    const lower = code.replace(/^SYNC-/, 'sync-');
    mockStorage = createMockStorage();
    const result = importProgress(lower);
    expect(result.success).toBe(true);
  });
});

// ─── Merge Logic ─────────────────────────────────────────────────────────────

describe('importProgress merge logic', () => {
  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  it('keeps higher score when both devices have played', () => {
    // Device A has score 100 for level 0
    mockStorage.set('stats', {
      'water-sort': { played: 10, completed: 8, stars: 24, lastLevel: 8, highScores: { 0: 100, 1: 50 } },
    });

    // Device B (export) has score 80 for level 0 but 90 for level 1
    const deviceB = createMockStorage();
    deviceB.set('stats', {
      'water-sort': { played: 12, completed: 10, stars: 28, lastLevel: 10, highScores: { 0: 80, 1: 90 } },
    });
    const tmpStorage = mockStorage;
    mockStorage = deviceB;
    const code = exportProgress();
    mockStorage = tmpStorage;

    importProgress(code);

    const stats = mockStorage.get('stats');
    // Level 0: keep 100 (current higher)
    expect(stats['water-sort'].highScores[0]).toBe(100);
    // Level 1: keep 90 (imported higher)
    expect(stats['water-sort'].highScores[1]).toBe(90);
    // Numeric fields: keep max
    expect(stats['water-sort'].played).toBe(12);
    expect(stats['water-sort'].completed).toBe(10);
    expect(stats['water-sort'].lastLevel).toBe(10);
  });

  it('keeps higher optimality for best-score entries', () => {
    mockStorage.set('best-scores:water-sort:0', { optimality: 95, stars: 3 });

    const deviceB = createMockStorage();
    deviceB.set('best-scores:water-sort:0', { optimality: 80, stars: 2 });
    const tmpStorage = mockStorage;
    mockStorage = deviceB;
    const code = exportProgress();
    mockStorage = tmpStorage;

    importProgress(code);
    expect(mockStorage.get('best-scores:water-sort:0').optimality).toBe(95);
  });

  it('imports higher optimality score when import is better', () => {
    mockStorage.set('best-scores:water-sort:0', { optimality: 70, stars: 2 });

    const deviceB = createMockStorage();
    deviceB.set('best-scores:water-sort:0', { optimality: 92, stars: 3 });
    const tmpStorage = mockStorage;
    mockStorage = deviceB;
    const code = exportProgress();
    mockStorage = tmpStorage;

    importProgress(code);
    expect(mockStorage.get('best-scores:water-sort:0').optimality).toBe(92);
  });

  it('keeps lower (faster) speedrun time per level', () => {
    mockStorage.set('fail-speedrun:bests:water-sort', { 0: 6000, 1: 8000 });

    const deviceB = createMockStorage();
    deviceB.set('fail-speedrun:bests:water-sort', { 0: 4500, 1: 9000 });
    const tmpStorage = mockStorage;
    mockStorage = deviceB;
    const code = exportProgress();
    mockStorage = tmpStorage;

    importProgress(code);
    const bests = mockStorage.get('fail-speedrun:bests:water-sort');
    expect(bests[0]).toBe(4500); // imported faster
    expect(bests[1]).toBe(8000); // current faster
  });

  it('merges level-progress maps taking max per level', () => {
    mockStorage.set('level-progress:water-sort', { 0: 1, 1: 0, 2: 1 });

    const deviceB = createMockStorage();
    deviceB.set('level-progress:water-sort', { 0: 0, 1: 1, 3: 1 });
    const tmpStorage = mockStorage;
    mockStorage = deviceB;
    const code = exportProgress();
    mockStorage = tmpStorage;

    importProgress(code);
    const progress = mockStorage.get('level-progress:water-sort');
    expect(progress[0]).toBe(1);
    expect(progress[1]).toBe(1);
    expect(progress[2]).toBe(1);
    expect(progress[3]).toBe(1);
  });

  it('keeps higher current level pointer', () => {
    mockStorage.set('level-progress:water-sort:current', 5);

    const deviceB = createMockStorage();
    deviceB.set('level-progress:water-sort:current', 8);
    const tmpStorage = mockStorage;
    mockStorage = deviceB;
    const code = exportProgress();
    mockStorage = tmpStorage;

    importProgress(code);
    expect(mockStorage.get('level-progress:water-sort:current')).toBe(8);
  });

  it('imported wins for non-score fields (e.g. settings)', () => {
    mockStorage.set('global:settings', { sound: false, colorBlind: false });

    const deviceB = createMockStorage();
    deviceB.set('global:settings', { sound: true, colorBlind: true });
    const tmpStorage = mockStorage;
    mockStorage = deviceB;
    const code = exportProgress();
    mockStorage = tmpStorage;

    importProgress(code);
    const settings = mockStorage.get('global:settings');
    expect(settings.sound).toBe(true);
    expect(settings.colorBlind).toBe(true);
  });

  it('imports new keys that do not exist locally', () => {
    // Local storage is empty
    const deviceB = createMockStorage();
    deviceB.set('fail-speedrun:badges', ['badge-1', 'badge-2']);
    const tmpStorage = mockStorage;
    mockStorage = deviceB;
    const code = exportProgress();
    mockStorage = tmpStorage;

    importProgress(code);
    expect(mockStorage.get('fail-speedrun:badges')).toEqual(['badge-1', 'badge-2']);
  });
});

// ─── Direct localStorage keys ─────────────────────────────────────────────────

describe('importProgress direct localStorage keys', () => {
  beforeEach(() => {
    mockStorage = createMockStorage();
    localStorage.clear();
  });

  it('imports mg:daily when not present locally', () => {
    const dailyData = { completed: { '2026-03-20': true, '2026-03-21': true } };
    localStorage.setItem('mg:daily', JSON.stringify(dailyData));

    const code = exportProgress();
    localStorage.clear();
    mockStorage = createMockStorage();

    importProgress(code);
    const restored = JSON.parse(localStorage.getItem('mg:daily'));
    expect(restored.completed['2026-03-20']).toBe(true);
    expect(restored.completed['2026-03-21']).toBe(true);
  });

  it('merges mg:daily completed maps (union)', () => {
    const local = { completed: { '2026-03-20': true } };
    localStorage.setItem('mg:daily', JSON.stringify(local));

    // Device B has different days
    const deviceBDaily = { completed: { '2026-03-21': true, '2026-03-22': true } };
    const tempLocal = JSON.parse(localStorage.getItem('mg:daily'));
    localStorage.setItem('mg:daily', JSON.stringify(deviceBDaily));

    const code = exportProgress();

    localStorage.setItem('mg:daily', JSON.stringify(tempLocal));
    importProgress(code);

    const merged = JSON.parse(localStorage.getItem('mg:daily'));
    expect(merged.completed['2026-03-20']).toBe(true);
    expect(merged.completed['2026-03-21']).toBe(true);
    expect(merged.completed['2026-03-22']).toBe(true);
  });

  it('merges mg:meta keeping higher XP and level', () => {
    localStorage.setItem('mg:meta', JSON.stringify({ xp: 2000, level: 5, otherData: 'keep' }));

    const deviceB = JSON.stringify({ xp: 1500, level: 4, otherData: 'imported' });
    const tempMeta = localStorage.getItem('mg:meta');
    localStorage.setItem('mg:meta', deviceB);
    const code = exportProgress();

    localStorage.setItem('mg:meta', tempMeta);
    importProgress(code);

    const merged = JSON.parse(localStorage.getItem('mg:meta'));
    expect(merged.xp).toBe(2000); // local is higher
    expect(merged.level).toBe(5);
    expect(merged.otherData).toBe('imported'); // imported wins on non-special fields
  });
});

// ─── shareProgress ────────────────────────────────────────────────────────────

describe('shareProgress', () => {
  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  it('falls back to clipboard when Web Share API unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    // Ensure no share API
    const originalShare = navigator.share;
    delete navigator.share;

    const code = 'SYNC-TEST1-CODE0';
    const result = await shareProgress(code);
    expect(result.method).toBe('clipboard');
    expect(result.shared).toBe(true);
    expect(writeText).toHaveBeenCalledWith(code);

    if (originalShare) navigator.share = originalShare;
  });

  it('returns method:none when neither API is available', async () => {
    const originalShare = navigator.share;
    const originalClipboard = navigator.clipboard;
    delete navigator.share;
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    const result = await shareProgress('SYNC-TEST1-CODE0');
    expect(result.shared).toBe(false);
    expect(result.method).toBe('none');

    if (originalShare) navigator.share = originalShare;
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
  });
});
