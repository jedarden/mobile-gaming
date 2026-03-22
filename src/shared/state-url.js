/**
 * Shareable Puzzle State URLs
 *
 * Encode any game state into a compact URL hash parameter for sharing.
 *
 * Format: #s=<gameId>.<version>.<base64url>
 *
 * Example: #s=water-sort.1.eJyrVkqtKEnNSwUA...
 *
 * Usage:
 *   const hash = encodeState('water-sort', state);
 *   window.location.hash = hash;
 *
 *   const { gameId, state } = decodeState(window.location.hash) ?? {};
 */

import { deflateRaw, inflateRaw } from 'pako';

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_VERSION = 1;
const HASH_PREFIX = 's=';
const SEPARATOR = '.';
const MAX_URL_LENGTH = 2000;

// ─── Encoding ─────────────────────────────────────────────────────────────────

/**
 * Convert a Uint8Array to URL-safe base64 (no padding).
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function toBase64Url(bytes) {
  // Build binary string in chunks to avoid stack overflow on large inputs
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convert URL-safe base64 back to Uint8Array.
 * @param {string} b64url
 * @returns {Uint8Array}
 */
function fromBase64Url(b64url) {
  const b64 = b64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  // Add padding back
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode a game state to a URL hash string.
 *
 * @param {string} gameId - Game identifier (e.g. 'water-sort')
 * @param {*} state - Serializable game state object
 * @param {number} [version=1] - Schema version for forward compatibility
 * @returns {string} URL hash string starting with '#s='
 */
export function encodeState(gameId, state, version = CURRENT_VERSION) {
  if (!gameId || typeof gameId !== 'string') {
    throw new Error('gameId must be a non-empty string');
  }

  const json = JSON.stringify(state);
  const compressed = deflateRaw(json, { level: 6 });
  const b64 = toBase64Url(compressed);
  const hash = `#${HASH_PREFIX}${gameId}${SEPARATOR}${version}${SEPARATOR}${b64}`;

  // If URL would be too long, fall back to compact level+moves encoding
  if (hash.length > MAX_URL_LENGTH && state && state.levelId !== undefined) {
    return encodeCompact(gameId, state, version);
  }

  return hash;
}

/**
 * Compact fallback encoding: only levelId + moves list.
 * Used when full state would exceed URL length limits.
 *
 * @param {string} gameId
 * @param {*} state
 * @param {number} version
 * @returns {string}
 */
function encodeCompact(gameId, state, version) {
  const compact = {
    levelId: state.levelId,
    moves: state.moves ?? [],
    _compact: true,
  };
  const json = JSON.stringify(compact);
  const compressed = deflateRaw(json, { level: 6 });
  const b64 = toBase64Url(compressed);
  return `#${HASH_PREFIX}${gameId}${SEPARATOR}${version}${SEPARATOR}${b64}`;
}

// ─── Decoding ─────────────────────────────────────────────────────────────────

/**
 * Decode a URL hash string back to { gameId, version, state }.
 *
 * @param {string} hash - URL hash string (with or without leading '#')
 * @returns {{ gameId: string, version: number, state: * } | null}
 */
export function decodeState(hash) {
  if (!hash || typeof hash !== 'string') return null;

  // Strip leading '#'
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;

  if (!raw.startsWith(HASH_PREFIX)) return null;

  const payload = raw.slice(HASH_PREFIX.length);
  const firstDot = payload.indexOf(SEPARATOR);
  if (firstDot === -1) return null;

  const secondDot = payload.indexOf(SEPARATOR, firstDot + 1);
  if (secondDot === -1) return null;

  const gameId = payload.slice(0, firstDot);
  const versionStr = payload.slice(firstDot + 1, secondDot);
  const b64 = payload.slice(secondDot + 1);

  if (!gameId || !versionStr || !b64) return null;

  const version = parseInt(versionStr, 10);
  if (isNaN(version)) return null;

  try {
    const bytes = fromBase64Url(b64);
    const json = inflateRaw(bytes, { to: 'string' });
    const state = JSON.parse(json);
    return { gameId, version, state };
  } catch {
    return null;
  }
}

/**
 * Check whether a URL hash looks like a state URL.
 *
 * @param {string} hash
 * @returns {boolean}
 */
export function isStateHash(hash) {
  if (!hash || typeof hash !== 'string') return false;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  return raw.startsWith(HASH_PREFIX);
}

/**
 * Get encoded URL length for a given state (useful for diagnostics).
 *
 * @param {string} gameId
 * @param {*} state
 * @returns {number}
 */
export function encodedLength(gameId, state) {
  return encodeState(gameId, state).length;
}
