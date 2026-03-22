/**
 * Cross-Device Progress Sync
 *
 * No accounts, no server, no database. Export/import all progress as a
 * compact alphanumeric code that fits in a text message.
 *
 * Format: SYNC-{version}{base62(deflateRaw(JSON))} in 5-char groups
 * Example: SYNC-X7K3M-PLNV2-8QR2J-W6T
 *
 * @vitest-environment jsdom
 */

import { deflateRaw, inflateRaw } from 'pako';
import { storage } from './storage.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const SYNC_VERSION = 1;
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CHUNK_SIZE = 5;

// Storage manager keys excluded from sync (ephemeral — in-progress state)
const SKIP_KEYS = new Set(['gameState']);
const SKIP_PREFIXES = ['failures:'];

// Keys stored directly in localStorage (bypassing the storage manager)
const DIRECT_STORAGE_KEYS = ['mg:daily', 'mg:meta'];

// ─── Base62 ───────────────────────────────────────────────────────────────────

/**
 * Encode a Uint8Array to a base62 string.
 *
 * Leading zero bytes are preserved: each leading 0x00 byte is represented
 * as a leading '0' character in the output (same convention as base58check).
 *
 * @param {Uint8Array} uint8arr
 * @returns {string}
 */
export function base62Encode(uint8arr) {
  if (uint8arr.length === 0) return '';

  // Count leading zero bytes — they're preserved as leading '0' chars
  let leadingZeros = 0;
  for (const byte of uint8arr) {
    if (byte !== 0) break;
    leadingZeros++;
  }

  let num = 0n;
  for (const byte of uint8arr) {
    num = num * 256n + BigInt(byte);
  }

  if (num === 0n) {
    // All bytes are zero
    return '0'.repeat(leadingZeros || 1);
  }

  let result = '';
  const base = 62n;
  while (num > 0n) {
    result = BASE62[Number(num % base)] + result;
    num = num / base;
  }
  return '0'.repeat(leadingZeros) + result;
}

/**
 * Decode a base62 string to a Uint8Array.
 *
 * Leading '0' characters are decoded back to leading zero bytes.
 *
 * @param {string} str
 * @returns {Uint8Array}
 */
export function base62Decode(str) {
  if (!str) return new Uint8Array(0);

  // Count leading '0' chars — each represents one leading zero byte
  let leadingZeros = 0;
  for (const char of str) {
    if (char !== '0') break;
    leadingZeros++;
  }

  let num = 0n;
  const base = 62n;
  for (const char of str) {
    const idx = BASE62.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base62 character: ${char}`);
    num = num * base + BigInt(idx);
  }

  const bytes = [];
  while (num > 0n) {
    bytes.unshift(Number(num % 256n));
    num = num / 256n;
  }

  const result = new Uint8Array(leadingZeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[leadingZeros + i] = bytes[i];
  }
  return result;
}

// ─── Merge Helpers ────────────────────────────────────────────────────────────

/**
 * Merge two stats objects, keeping the higher value for each numeric field.
 * highScores is merged separately (max per level).
 */
function mergeStats(current, imported) {
  if (!current) return imported;
  if (!imported) return current;
  const result = {};
  const gameIds = new Set([...Object.keys(current), ...Object.keys(imported)]);
  for (const gameId of gameIds) {
    const c = current[gameId] || {};
    const imp = imported[gameId] || {};
    result[gameId] = {
      played: Math.max(c.played || 0, imp.played || 0),
      completed: Math.max(c.completed || 0, imp.completed || 0),
      stars: Math.max(c.stars || 0, imp.stars || 0),
      lastLevel: Math.max(c.lastLevel || 0, imp.lastLevel || 0),
      highScores: mergeHighScores(c.highScores || {}, imp.highScores || {}),
    };
  }
  return result;
}

/**
 * Merge two highScores maps, keeping the higher score per level key.
 */
function mergeHighScores(current, imported) {
  const result = { ...current };
  for (const [level, score] of Object.entries(imported)) {
    if (!(level in result) || score > result[level]) {
      result[level] = score;
    }
  }
  return result;
}

/**
 * Merge two best-score objects (from score.js), keeping the higher optimality.
 */
function mergeBestScore(current, imported) {
  if (!current) return imported;
  if (!imported) return current;
  return (imported.optimality || 0) > (current.optimality || 0) ? imported : current;
}

/**
 * Merge two fail-speedrun bests objects, keeping the lower time per level.
 */
function mergeSpeedrunBests(current, imported) {
  if (!current) return imported;
  if (!imported) return current;
  const result = { ...current };
  for (const [levelIndex, time] of Object.entries(imported)) {
    if (!(levelIndex in result) || time < result[levelIndex]) {
      result[levelIndex] = time;
    }
  }
  return result;
}

/**
 * Merge two level-progress maps, keeping the max value per level key.
 */
function mergeLevelProgress(current, imported) {
  if (!current) return imported;
  if (!imported) return current;
  const result = { ...current };
  for (const [level, value] of Object.entries(imported)) {
    if (!(level in result) || value > result[level]) {
      result[level] = value;
    }
  }
  return result;
}

/**
 * Merge two storage-manager values using the appropriate strategy for the key.
 */
function mergeValues(key, current, imported) {
  if (key === 'stats') return mergeStats(current, imported);
  if (key.startsWith('best-scores:')) return mergeBestScore(current, imported);
  if (key.startsWith('fail-speedrun:bests:')) return mergeSpeedrunBests(current, imported);
  if (key.startsWith('level-progress:') && !key.endsWith(':current')) {
    return mergeLevelProgress(current, imported);
  }
  if (key.endsWith(':current')) {
    // Current level pointer — keep the higher level
    return Math.max(current || 0, imported || 0);
  }
  // Default: imported data wins
  return imported;
}

/**
 * Merge daily challenge completion maps (union of completed days).
 */
function mergeDailyData(current, imported) {
  if (!current || !current.completed) return imported;
  if (!imported || !imported.completed) return current;
  return { ...imported, completed: { ...current.completed, ...imported.completed } };
}

/**
 * Merge meta/XP data, keeping the higher XP and player level.
 */
function mergeMetaData(current, imported) {
  if (!current) return imported;
  if (!imported) return current;
  return {
    ...imported,
    xp: Math.max(current.xp || 0, imported.xp || 0),
    level: Math.max(current.level || 0, imported.level || 0),
  };
}

/**
 * Merge a directly-stored localStorage value using key-specific logic.
 */
function mergeDirectValue(fullKey, current, imported) {
  if (fullKey === 'mg:daily') return mergeDailyData(current, imported);
  if (fullKey === 'mg:meta') return mergeMetaData(current, imported);
  return imported;
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Export all persistent progress as a compact sync code.
 *
 * Collect all non-ephemeral storage keys → JSON → pako.deflateRaw()
 * → base62 encode → version prefix → 5-char chunks.
 *
 * @returns {string}  e.g. "SYNC-X7K3M-PLNV2-8QR2J-W6T"
 */
export function exportProgress() {
  const payload = { v: SYNC_VERSION, keys: {}, direct: {} };

  // Collect storage-manager keys
  const allKeys = storage._getAllKeys();
  for (const key of allKeys) {
    if (SKIP_KEYS.has(key)) continue;
    if (SKIP_PREFIXES.some(p => key.startsWith(p))) continue;
    const value = storage.get(key);
    if (value !== null) {
      payload.keys[key] = value;
    }
  }

  // Collect directly-stored localStorage keys
  /* c8 ignore next */
  if (typeof localStorage !== 'undefined') {
    for (const fullKey of DIRECT_STORAGE_KEYS) {
      const raw = localStorage.getItem(fullKey);
      if (raw !== null) {
        try {
          payload.direct[fullKey] = JSON.parse(raw);
        } catch {
          // Skip unparseable entries
        }
      }
    }
  }

  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const compressed = deflateRaw(bytes);
  const encoded = base62Encode(compressed);

  // Prefix with version character then chunk into groups of CHUNK_SIZE
  const versioned = String(SYNC_VERSION) + encoded;
  const chunks = [];
  for (let i = 0; i < versioned.length; i += CHUNK_SIZE) {
    chunks.push(versioned.slice(i, i + CHUNK_SIZE));
  }
  return 'SYNC-' + chunks.join('-');
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Import progress from a sync code.
 *
 * Strips formatting → base62 decode → inflate → parse → merge into storage.
 *
 * Merge rules:
 *   - Numeric progress values (levels, stars, scores): keep the higher value
 *   - Speedrun best times: keep the lower (faster) time
 *   - Everything else: imported data wins
 *
 * @param {string} code  Sync code from exportProgress()
 * @returns {{ success: boolean, version?: number, error?: string }}
 */
export function importProgress(code) {
  if (!code || typeof code !== 'string') {
    return { success: false, error: 'Invalid code' };
  }

  // Strip SYNC- prefix, dashes, whitespace
  const clean = code.replace(/^SYNC-/i, '').replace(/[-\s]/g, '');
  if (clean.length === 0) {
    return { success: false, error: 'Empty code' };
  }

  // First character is the sync format version
  const version = parseInt(clean[0], 10);
  if (isNaN(version)) {
    return { success: false, error: 'Invalid version prefix' };
  }
  const encoded = clean.slice(1);

  let payload;
  try {
    const compressed = base62Decode(encoded);
    const decompressed = inflateRaw(compressed);
    const json = new TextDecoder().decode(decompressed);
    payload = JSON.parse(json);
  } catch {
    return { success: false, error: 'Invalid sync code' };
  }

  if (!payload || typeof payload !== 'object') {
    return { success: false, error: 'Invalid payload' };
  }

  // Merge storage-manager keys
  for (const [key, importedValue] of Object.entries(payload.keys || {})) {
    const currentValue = storage.get(key, null);
    if (currentValue === null) {
      storage.set(key, importedValue);
    } else {
      storage.set(key, mergeValues(key, currentValue, importedValue));
    }
  }

  // Merge direct localStorage keys
  /* c8 ignore next */
  if (typeof localStorage !== 'undefined') {
    for (const [fullKey, importedValue] of Object.entries(payload.direct || {})) {
      const raw = localStorage.getItem(fullKey);
      if (raw === null) {
        localStorage.setItem(fullKey, JSON.stringify(importedValue));
      } else {
        try {
          const current = JSON.parse(raw);
          localStorage.setItem(fullKey, JSON.stringify(mergeDirectValue(fullKey, current, importedValue)));
        } catch {
          localStorage.setItem(fullKey, JSON.stringify(importedValue));
        }
      }
    }
  }

  return { success: true, version: payload.v };
}

// ─── Share ────────────────────────────────────────────────────────────────────

/**
 * Share a sync code using the Web Share API or fall back to the clipboard.
 *
 * @param {string} code  Sync code from exportProgress()
 * @returns {Promise<{ shared: boolean, method: 'native'|'clipboard'|'none' }>}
 */
export function shareProgress(code) {
  const shareText = `Import this code in Settings → Sync:\n\n${code}`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    return navigator.share({ title: 'My game progress', text: shareText })
      .then(() => ({ shared: true, method: 'native' }))
      .catch(() => ({ shared: false, method: 'native' }));
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    return navigator.clipboard.writeText(code)
      .then(() => ({ shared: true, method: 'clipboard' }))
      .catch(() => ({ shared: false, method: 'clipboard' }));
  }

  return Promise.resolve({ shared: false, method: 'none' });
}
