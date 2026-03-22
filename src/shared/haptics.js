/**
 * Haptics
 *
 * Named vibration patterns for key game events.
 * Reads the haptic toggle from the global settings key used by settings.js.
 * Falls back gracefully when the Vibration API is unavailable.
 *
 * Usage:
 *   import { haptic } from '../shared/haptics.js';
 *   haptic('win');      // victory burst
 *   haptic('collect');  // light tap
 *   haptic('fail');     // warning double-tap
 */

import { StorageManager } from './storage.js';

const storage = new StorageManager();

/**
 * Vibration patterns (ms).
 * Odd-indexed entries = vibrate, even-indexed = pause.
 * A plain number means a single vibration of that duration.
 */
export const PATTERNS = {
  tap:         10,
  collect:     15,
  merge:       [12, 50, 12],
  pin_pull:    25,
  win:         [60, 40, 60, 40, 120],
  boss_defeat: [100, 50, 100, 50, 200],
  fail:        [20, 80, 40],
  error:       [10, 80, 10, 80, 10],
  level_start: 20,
};

/**
 * Check whether haptic feedback is currently enabled in settings.
 * Reads both the new 'global:settings' key and the legacy 'settings' key.
 * @returns {boolean}
 */
export function isHapticEnabled() {
  const global = storage.get('global:settings');
  if (global && typeof global.haptic === 'boolean') return global.haptic;

  const legacy = storage.get('settings');
  if (legacy && typeof legacy.hapticEnabled === 'boolean') return legacy.hapticEnabled;

  return true; // enabled by default
}

/**
 * Trigger a named haptic pattern.
 *
 * @param {string} [name='tap'] - One of the keys in PATTERNS, or a
 *   custom number/array passed directly.
 */
export function haptic(name = 'tap') {
  if (!isHapticEnabled()) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

  const pattern = typeof name === 'string'
    ? (PATTERNS[name] ?? PATTERNS.tap)
    : name;

  navigator.vibrate(pattern);
}
