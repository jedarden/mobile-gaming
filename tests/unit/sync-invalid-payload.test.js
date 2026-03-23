/**
 * Sync — invalid payload type branch
 *
 * Tests the `if (!payload || typeof payload !== 'object')` guard
 * in importProgress() when the decompressed JSON is a primitive (number).
 *
 * Uses vi.mock('pako') to stub inflateRaw, bypassing real compression so
 * we can inject arbitrary decompressed bytes.
 */

import { describe, it, expect, vi } from 'vitest';

// Stub storage so the module loads without touching real localStorage
vi.mock('../../src/shared/storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    delete: vi.fn(),
    _getAllKeys: vi.fn(() => []),
  },
}));

// Stub inflateRaw to return bytes that decode to JSON primitive "42"
// → JSON.parse('42') = 42 → typeof 42 !== 'object' → Invalid payload branch
vi.mock('pako', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    inflateRaw: vi.fn(() => new TextEncoder().encode('42')),
  };
});

import { importProgress } from '../../src/shared/sync.js';

describe('importProgress — !payload || typeof payload !== "object" (true branch)', () => {
  it('returns Invalid payload when decompressed JSON is a number (typeof !== object)', () => {
    // 'SYNC-1A': version='1' (valid), encoded='A' (valid base62)
    // inflateRaw is mocked → TextDecoder yields '42' → JSON.parse → 42
    // typeof 42 !== 'object' → if branch fires → { success:false, error:'Invalid payload' }
    const result = importProgress('SYNC-1A');
    expect(result).toEqual({ success: false, error: 'Invalid payload' });
  });
});
