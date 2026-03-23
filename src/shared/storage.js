/**
 * Namespaced localStorage manager
 *
 * Manages persistent storage with versioning and quota handling.
 * All keys are prefixed with `mg:` to avoid collisions.
 */

const NAMESPACE = 'mg:';
const VERSION = 1;
const QUOTA_BUDGET = 4 * 1024 * 1024; // 4MB

/**
 * Estimate size of a value in bytes
 * @param {*} value - Value to measure
 * @returns {number} Size in bytes
 */
function getSize(value) {
  if (value === null || value === undefined) return 0;
  return new Blob([JSON.stringify(value)]).size;
}

/**
 * Storage manager class
 */
export class StorageManager {
  constructor() {
    this.cache = new Map();
    this.accessOrder = []; // Track access for LRU eviction
  }

  /**
   * Get the full storage key with namespace
   * @param {string} key - Base key
   * @returns {string} Namespaced key
   */
  getNamespacedKey(key) {
    return `${NAMESPACE}${key}`;
  }

  /**
   * Get a value from storage
   * @param {string} key - Storage key (without namespace)
   * @param {*} defaultValue - Default value if key doesn't exist
   * @returns {*} Stored value or default
   */
  get(key, defaultValue = null) {
    // Check cache first
    if (this.cache.has(key)) {
      this._updateAccess(key);
      return this.cache.get(key);
    }

    try {
      const fullKey = this.getNamespacedKey(key);
      const item = localStorage.getItem(fullKey);

      if (!item) {
        return defaultValue;
      }

      const parsed = JSON.parse(item);

      // Version check - return default if version mismatch
      if (parsed.v !== VERSION) {
        return defaultValue;
      }

      this.cache.set(key, parsed.data);
      this._updateAccess(key);
      return parsed.data;
    } catch (_e) {
      // Storage unavailable or corrupted
      return defaultValue;
    }
  }

  /**
   * Set a value in storage
   * @param {string} key - Storage key (without namespace)
   * @param {*} value - Value to store
   * @returns {boolean} True if successful
   */
  set(key, value) {
    try {
      const wrapped = { v: VERSION, data: value };
      const serialized = JSON.stringify(wrapped);

      // Check if new value fits in budget
      const currentUsage = this.getUsage();
      const newValueSize = getSize(wrapped);

      if (currentUsage + newValueSize > QUOTA_BUDGET) {
        // Try to free up space
        this._evictOldest(newValueSize);
      }

      const fullKey = this.getNamespacedKey(key);
      localStorage.setItem(fullKey, serialized);

      this.cache.set(key, value);
      this._updateAccess(key);

      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        // Try to make space and retry
        this._evictOldest(getSize({ v: VERSION, data: value }) + 1024);
        try {
          const fullKey = this.getNamespacedKey(key);
          localStorage.setItem(fullKey, JSON.stringify({ v: VERSION, data: value }));
          this.cache.set(key, value);
          this._updateAccess(key);
          return true;
        } catch {
          // Still can't fit - give up
        }
      }
      return false;
    }
  }

  /**
   * Delete a value from storage
   * @param {string} key - Storage key (without namespace)
   */
  delete(key) {
    const fullKey = this.getNamespacedKey(key);
    localStorage.removeItem(fullKey);
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter(k => k !== key);
  }

  /**
   * Clear all namespaced storage
   */
  clear() {
    const keys = this._getAllKeys();
    for (const key of keys) {
      localStorage.removeItem(this.getNamespacedKey(key));
    }
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get current storage usage in bytes
   * @returns {number} Bytes used
   */
  getUsage() {
    let total = 0;
    const keys = this._getAllKeys();
    for (const key of keys) {
      const fullKey = this.getNamespacedKey(key);
      const item = localStorage.getItem(fullKey);
      if (item) {
        total += new Blob([item]).size;
      }
    }
    return total;
  }

  /**
   * Get all storage keys with our namespace
   * @returns {string[]} Array of keys (without namespace)
   */
  _getAllKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(NAMESPACE)) {
        keys.push(fullKey.slice(NAMESPACE.length));
      }
    }
    return keys;
  }

  /**
   * Update access order for LRU tracking
   * @param {string} key - Key being accessed
   */
  _updateAccess(key) {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
  }

  /**
   * Evict oldest entries to free up space
   * @param {number} neededBytes - Bytes to free
   */
  _evictOldest(neededBytes) {
    let freed = 0;
    while (this.accessOrder.length > 0 && freed < neededBytes) {
      const oldest = this.accessOrder.shift();
      const fullKey = this.getNamespacedKey(oldest);
      const item = localStorage.getItem(fullKey);
      if (item) {
        freed += new Blob([item]).size;
        localStorage.removeItem(fullKey);
      }
      this.cache.delete(oldest);
    }
  }
}

/**
 * Default storage manager instance
 */
export const storage = new StorageManager();

/**
 * Convenience functions using default manager
 */
export function get(key, defaultValue) {
  return storage.get(key, defaultValue);
}

export function set(key, value) {
  return storage.set(key, value);
}

export function del(key) {
  return storage.delete(key);
}

export function clear() {
  return storage.clear();
}

/**
 * Check if localStorage is available
 * @returns {boolean} True if localStorage works
 */
export function isStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// ===== Settings and Game Stats Helpers =====

const SETTINGS_KEY = 'settings';
const STATS_KEY = 'stats';

/**
 * Initialize storage (ensure default values exist)
 * @returns {Promise<void>}
 */
export async function initStorage() {
  // Initialize settings if not present
  if (storage.get(SETTINGS_KEY) === null) {
    storage.set(SETTINGS_KEY, {
      soundEnabled: true,
      hapticEnabled: true,
      reducedMotion: false,
      reducedMotionSetByUser: false
    });
  }

  // Initialize stats if not present
  if (storage.get(STATS_KEY) === null) {
    storage.set(STATS_KEY, {});
  }
}

/**
 * Get user settings
 * @returns {object} Settings object
 */
export function getSettings() {
  return storage.get(SETTINGS_KEY, {
    soundEnabled: true,
    hapticEnabled: true,
    reducedMotion: false,
    reducedMotionSetByUser: false
  });
}

/**
 * Update user settings
 * @param {object} updates - Settings to update
 * @returns {boolean} Success
 */
export function updateSettings(updates) {
  const current = getSettings();
  return storage.set(SETTINGS_KEY, { ...current, ...updates });
}

/**
 * Get game stats
 * @param {string} gameId - Game identifier
 * @returns {object} Game stats
 */
export function getGameStats(gameId) {
  const allStats = storage.get(STATS_KEY, {});
  return allStats[gameId] || {
    played: 0,
    completed: 0,
    stars: 0,
    lastLevel: 0,
    highScores: {}
  };
}

/**
 * Update game stats
 * @param {string} gameId - Game identifier
 * @param {object} updates - Stats to update (will be merged/added)
 * @returns {boolean} Success
 */
export function updateGameStats(gameId, updates) {
  const allStats = storage.get(STATS_KEY, {});
  const current = allStats[gameId] || {
    played: 0,
    completed: 0,
    stars: 0,
    lastLevel: 0,
    highScores: {}
  };

  // Merge updates
  const updated = { ...current };

  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'number' && (key === 'played' || key === 'completed' || key === 'stars')) {
      updated[key] = (current[key] || 0) + value;
    } else {
      updated[key] = value;
    }
  }

  allStats[gameId] = updated;
  return storage.set(STATS_KEY, allStats);
}
