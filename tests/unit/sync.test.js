/**
 * Cross-Device Progress Sync - Unit Tests
 *
 * Tests for export/import round-trip, merge logic, and code size.
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deflateRaw } from 'pako';

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

  it('skips unparseable direct localStorage entries and still exports successfully (catch branch)', () => {
    seedProgress();
    localStorage.setItem('mg:daily', 'invalid json {');
    const code = exportProgress();
    localStorage.removeItem('mg:daily');
    // Export should still succeed despite corrupted mg:daily
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

  it('returns success:false for numeric 0 (falsy non-string)', () => {
    expect(importProgress(0)).toEqual({ success: false, error: 'Invalid code' });
  });

  it('returns success:false for boolean false (falsy non-string)', () => {
    expect(importProgress(false)).toEqual({ success: false, error: 'Invalid code' });
  });

  it('returns success:false for object input (typeof !== string)', () => {
    expect(importProgress({ code: 'SYNC-XXXX' })).toEqual({ success: false, error: 'Invalid code' });
  });

  it('returns success:false for garbled code', () => {
    expect(importProgress('SYNC-!!!!-XXXXX')).toMatchObject({ success: false });
  });

  it('returns "Empty code" when code reduces to empty string after stripping prefix and dashes (clean.length === 0 branch)', () => {
    // 'SYNC-' is truthy and a string, passes !code guard, but after strip → clean = '' → Empty code
    expect(importProgress('SYNC-')).toEqual({ success: false, error: 'Empty code' });
  });

  it('returns "Invalid version prefix" when first char is non-numeric (isNaN branch)', () => {
    // After stripping SYNC- and dashes, first char 'A' makes parseInt return NaN
    expect(importProgress('SYNC-Aabc')).toEqual({ success: false, error: 'Invalid version prefix' });
  });

  it('returns success:false for truncated code', () => {
    expect(importProgress('SYNC-1AAAA')).toMatchObject({ success: false });
  });

  it('returns success:false when base62 decodes but inflateRaw fails (inflate error catch branch)', () => {
    // First char '1' = valid version, rest = valid base62 chars but not valid deflate data
    // base62Decode succeeds, inflateRaw throws → catch block fires → 'Invalid sync code'
    expect(importProgress('SYNC-1aaaaaaaaaaaa')).toMatchObject({ success: false, error: 'Invalid sync code' });
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

  it('keeps current score when imported score is equal (> not >=, strict inequality)', () => {
    mockStorage.set('stats', {
      'water-sort': { played: 5, completed: 4, stars: 12, lastLevel: 4, highScores: { 0: 100 } },
    });

    const deviceB = createMockStorage();
    deviceB.set('stats', {
      'water-sort': { played: 5, completed: 4, stars: 12, lastLevel: 4, highScores: { 0: 100 } },
    });
    const tmpStorage = mockStorage;
    mockStorage = deviceB;
    const code = exportProgress();
    mockStorage = tmpStorage;

    importProgress(code);
    const stats = mockStorage.get('stats');
    // Equal scores: imported score (100) is NOT > current (100) → keep current
    expect(stats['water-sort'].highScores[0]).toBe(100);
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

  it('uses imported value when current level pointer is 0 (|| 0 falsy branch for current)', () => {
    // current=0 → 0 || 0 = 0 → Math.max(0, 3) = 3
    mockStorage.set('level-progress:water-sort:current', 0);

    const deviceB = createMockStorage();
    deviceB.set('level-progress:water-sort:current', 3);
    const tmpStorage = mockStorage;
    mockStorage = deviceB;
    const code = exportProgress();
    mockStorage = tmpStorage;

    importProgress(code);
    expect(mockStorage.get('level-progress:water-sort:current')).toBe(3);
  });

  it('keeps current when imported level pointer is 0 (|| 0 falsy branch for imported)', () => {
    // imported=0 → 0 || 0 = 0 → Math.max(3, 0) = 3
    mockStorage.set('level-progress:water-sort:current', 3);

    const deviceB = createMockStorage();
    deviceB.set('level-progress:water-sort:current', 0);
    const tmpStorage = mockStorage;
    mockStorage = deviceB;
    const code = exportProgress();
    mockStorage = tmpStorage;

    importProgress(code);
    expect(mockStorage.get('level-progress:water-sort:current')).toBe(3);
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

  it('mergeStats || {} fires when each device has a different game in stats (|| {} default branch)', () => {
    // Device A: only water-sort stats
    mockStorage.set('stats', {
      'water-sort': { played: 5, completed: 3, stars: 9, lastLevel: 3, highScores: { 0: 100 } },
    });

    // Device B: only brain-teaser stats
    const deviceB = createMockStorage();
    deviceB.set('stats', {
      'brain-teaser': { played: 3, completed: 2, stars: 6, lastLevel: 2, highScores: { 0: 80 } },
    });
    const tmpStorage = mockStorage;
    mockStorage = deviceB;
    const code = exportProgress();
    mockStorage = tmpStorage;

    importProgress(code);
    const stats = mockStorage.get('stats');
    // Both games should appear in merged stats
    expect(stats['water-sort'].completed).toBe(3); // local preserved via || {}
    expect(stats['brain-teaser'].completed).toBe(2); // imported added via || {}
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

// ─── importProgress direct: catch block for corrupted local JSON ─────────────

describe('importProgress direct localStorage — catch block', () => {
  beforeEach(() => {
    mockStorage = createMockStorage();
    localStorage.clear();
  });

  it('overwrites corrupted local JSON with imported value (catch branch)', () => {
    // Put valid daily data in localStorage for export
    const importedDaily = { completed: { '2026-03-20': true } };
    localStorage.setItem('mg:daily', JSON.stringify(importedDaily));
    const code = exportProgress();

    // Now corrupt local mg:daily so JSON.parse fails during import
    localStorage.setItem('mg:daily', '{ corrupted json }');
    mockStorage = createMockStorage();

    importProgress(code);

    // The catch block should have overwritten with the imported value
    const restored = JSON.parse(localStorage.getItem('mg:daily'));
    expect(restored.completed['2026-03-20']).toBe(true);
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

  it('returns {shared: true, method: "native"} when navigator.share resolves (.then branch)', async () => {
    const originalShare = navigator.share;
    navigator.share = vi.fn().mockResolvedValue(undefined);
    const result = await shareProgress('SYNC-TEST1-CODE0');
    expect(result.shared).toBe(true);
    expect(result.method).toBe('native');
    if (originalShare) navigator.share = originalShare;
    else delete navigator.share;
  });

  it('returns {shared: false, method: "native"} when navigator.share rejects (.catch branch)', async () => {
    const originalShare = navigator.share;
    navigator.share = vi.fn().mockRejectedValue(new Error('Share cancelled'));
    const result = await shareProgress('SYNC-TEST1-CODE0');
    expect(result.shared).toBe(false);
    expect(result.method).toBe('native');
    if (originalShare) navigator.share = originalShare;
    else delete navigator.share;
  });

  it('returns {shared: false, method: "clipboard"} when clipboard.writeText rejects (.catch branch)', async () => {
    const originalShare = navigator.share;
    delete navigator.share;
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('Clipboard denied')) },
      configurable: true,
    });

    const result = await shareProgress('SYNC-TEST1-CODE0');
    expect(result.shared).toBe(false);
    expect(result.method).toBe('clipboard');

    if (originalShare) navigator.share = originalShare;
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
  });
});

// ─── merge helpers — if (!imported) return current; branches ─────────────────
// These branches fire when importProgress receives a crafted payload that has
// a null/falsy value for a key that already exists in local storage.

describe('merge helpers — if (!imported) return current; false branches', () => {
  // Helper: build a valid SYNC- code from a raw payload object
  function makeSyncCode(payload) {
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    const compressed = deflateRaw(bytes);
    const encoded = base62Encode(compressed);
    const versioned = '1' + encoded;
    const chunks = versioned.match(/.{1,5}/g) || [versioned];
    return 'SYNC-' + chunks.join('-');
  }

  beforeEach(() => {
    mockStorage = createMockStorage();
    localStorage.clear();
  });

  it('mergeStats: returns current unchanged when imported is null (if(!imported) branch)', () => {
    const current = { 'water-sort': { played: 5, completed: 3, stars: 9, lastLevel: 3, highScores: {} } };
    mockStorage.set('stats', current);
    const code = makeSyncCode({ v: 1, keys: { stats: null }, direct: {} });
    importProgress(code);
    expect(mockStorage.get('stats')).toEqual(current);
  });

  it('mergeBestScore: returns current unchanged when imported is null (if(!imported) branch)', () => {
    const current = { optimality: 85, stars: 3 };
    mockStorage.set('best-scores:water-sort:0', current);
    const code = makeSyncCode({ v: 1, keys: { 'best-scores:water-sort:0': null }, direct: {} });
    importProgress(code);
    expect(mockStorage.get('best-scores:water-sort:0')).toEqual(current);
  });

  it('mergeSpeedrunBests: returns current unchanged when imported is null (if(!imported) branch)', () => {
    const current = { 0: 5000, 1: 7200 };
    mockStorage.set('fail-speedrun:bests:water-sort', current);
    const code = makeSyncCode({ v: 1, keys: { 'fail-speedrun:bests:water-sort': null }, direct: {} });
    importProgress(code);
    expect(mockStorage.get('fail-speedrun:bests:water-sort')).toEqual(current);
  });

  it('mergeLevelProgress: returns current unchanged when imported is null (if(!imported) branch)', () => {
    const current = { 0: 1, 1: 1, 2: 0 };
    mockStorage.set('level-progress:water-sort', current);
    const code = makeSyncCode({ v: 1, keys: { 'level-progress:water-sort': null }, direct: {} });
    importProgress(code);
    expect(mockStorage.get('level-progress:water-sort')).toEqual(current);
  });

  it('mergeDailyData: returns current when imported has no completed field (if(!imported.completed) branch)', () => {
    const current = { completed: { '2026-03-20': true } };
    localStorage.setItem('mg:daily', JSON.stringify(current));
    // imported has no completed field → mergeDirectValue → mergeDailyData returns current
    const code = makeSyncCode({ v: 1, keys: {}, direct: { 'mg:daily': { lastPlayed: '2026-03-21' } } });
    importProgress(code);
    const stored = JSON.parse(localStorage.getItem('mg:daily'));
    expect(stored.completed['2026-03-20']).toBe(true);
  });

  it('mergeMetaData: returns current unchanged when imported is null (if(!imported) branch)', () => {
    const current = { xp: 1500, level: 3 };
    localStorage.setItem('mg:meta', JSON.stringify(current));
    const code = makeSyncCode({ v: 1, keys: {}, direct: { 'mg:meta': null } });
    importProgress(code);
    const stored = JSON.parse(localStorage.getItem('mg:meta'));
    expect(stored.xp).toBe(1500);
    expect(stored.level).toBe(3);
  });

  it('returns "Invalid payload" when decoded JSON is null (if(!payload) true branch)', () => {
    // JSON.stringify(null) = "null" — valid deflate but payload === null after parse
    const code = makeSyncCode(null);
    const result = importProgress(code);
    expect(result).toEqual({ success: false, error: 'Invalid payload' });
  });

  it('returns "Invalid payload" when decoded JSON is a non-object primitive (typeof !== object right arm)', () => {
    // payload=42 → !42 is false → right arm evaluated: typeof 42 !== 'object' → true → Invalid payload
    const code = makeSyncCode(42);
    const result = importProgress(code);
    expect(result).toEqual({ success: false, error: 'Invalid payload' });
  });

  it('mergeDailyData: returns imported when local JSON has no completed field (!current.completed branch)', () => {
    // Local mg:daily exists as JSON but has no .completed field → !current.completed → return imported
    const localDaily = { lastPlayed: '2026-03-20' }; // no completed field
    localStorage.setItem('mg:daily', JSON.stringify(localDaily));
    const importedDaily = { completed: { '2026-03-21': true } };
    const code = makeSyncCode({ v: 1, keys: {}, direct: { 'mg:daily': importedDaily } });
    importProgress(code);
    const stored = JSON.parse(localStorage.getItem('mg:daily'));
    // imported wins because !current.completed
    expect(stored.completed['2026-03-21']).toBe(true);
  });

  it('mergeDirectValue: returns imported for unknown direct key (default return branch)', () => {
    // Craft a payload with a direct key that is neither mg:daily nor mg:meta
    const localVal = { old: true };
    localStorage.setItem('mg:other', JSON.stringify(localVal));
    const importedVal = { newer: true };
    const code = makeSyncCode({ v: 1, keys: {}, direct: { 'mg:other': importedVal } });
    importProgress(code);
    const stored = JSON.parse(localStorage.getItem('mg:other'));
    // mergeDirectValue default → return imported
    expect(stored).toEqual({ newer: true });
    localStorage.removeItem('mg:other');
  });

});
