/**
 * Storage.js - Profile and Data Persistence
 *
 * Handles all data persistence with localStorage:
 * - Player profile (XP, levels, achievements)
 * - Game statistics per game
 * - Settings and preferences
 * - Daily challenge data
 */

const STORAGE_KEY = 'mobile-gaming-data';
const SCHEMA_VERSION = 2;

// Default profile structure
const DEFAULT_PROFILE = {
  version: SCHEMA_VERSION,
  xp: 0,
  level: 1,
  gamesPlayed: {},
  achievements: [],
  unlockedCosmetics: ['theme_default'],
  dailyStreak: 0,
  longestStreak: 0,
  lastDailyDate: null,
  settings: {
    soundEnabled: true,
    hapticEnabled: true,
    reducedMotion: false,
    reducedMotionSetByUser: false,
    zenMode: false,
    colorblindMode: 'none',
    highContrast: false,
    highContrastSetByUser: false,
    showPatterns: true
  },
  createdAt: new Date().toISOString(),
  lastPlayedAt: new Date().toISOString()
};

// Default game stats structure
const DEFAULT_GAME_STATS = {
  played: 0,
  completed: 0,
  stars: 0,
  bestStreak: 0,
  perfectClears: 0,
  bestTime: null,
  totalMoves: 0
};

// In-memory cache
let profileCache = null;

/**
 * Initialize storage and return profile
 */
export async function initStorage() {
  try {
    profileCache = await load();

    // Run migrations if needed
    if (profileCache.version < SCHEMA_VERSION) {
      profileCache = migrate(profileCache);
      await save(profileCache);
    }

    return profileCache;
  } catch (error) {
    console.error('[Storage] Init failed:', error);
    profileCache = { ...DEFAULT_PROFILE };
    return profileCache;
  }
}

/**
 * Load profile from storage
 */
export async function load() {
  if (profileCache) {
    return profileCache;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const data = JSON.parse(stored);
      profileCache = validateProfile(data);
      return profileCache;
    }

    profileCache = { ...DEFAULT_PROFILE };
    return profileCache;
  } catch (error) {
    console.error('[Storage] Load failed:', error);
    return { ...DEFAULT_PROFILE };
  }
}

/**
 * Save profile to storage
 */
export async function save(profile = profileCache) {
  if (!profile) {
    console.error('[Storage] No profile to save');
    return false;
  }

  try {
    profile.lastPlayedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    profileCache = profile;
    return true;
  } catch (error) {
    console.error('[Storage] Save failed:', error);

    if (error.name === 'QuotaExceededError') {
      console.warn('[Storage] Storage quota exceeded');
    }

    return false;
  }
}

/**
 * Get current profile (sync)
 */
export function getProfile() {
  return profileCache || { ...DEFAULT_PROFILE };
}

/**
 * Update profile with partial data
 */
export async function updateProfile(updates) {
  const profile = getProfile();
  const newProfile = { ...profile, ...updates };
  return save(newProfile);
}

/**
 * Get stats for a specific game
 */
export function getGameStats(gameId) {
  const profile = getProfile();
  return profile.gamesPlayed[gameId] || { ...DEFAULT_GAME_STATS };
}

/**
 * Update stats for a specific game
 */
export async function updateGameStats(gameId, updates) {
  const profile = getProfile();
  const currentStats = getGameStats(gameId);

  profile.gamesPlayed[gameId] = {
    ...currentStats,
    ...updates
  };

  return save(profile);
}

/**
 * Get settings
 */
export function getSettings() {
  const profile = getProfile();
  return profile.settings;
}

/**
 * Update settings
 */
export async function updateSettings(newSettings) {
  const profile = getProfile();
  profile.settings = { ...profile.settings, ...newSettings };
  return save(profile);
}

/**
 * Check if achievement is unlocked
 */
export function hasAchievement(achievementId) {
  const profile = getProfile();
  return profile.achievements.includes(achievementId);
}

/**
 * Unlock an achievement
 */
export async function unlockAchievement(achievementId) {
  if (hasAchievement(achievementId)) {
    return false;
  }

  const profile = getProfile();
  profile.achievements.push(achievementId);
  await save(profile);

  return true;
}

/**
 * Check if cosmetic is unlocked
 */
export function hasCosmetic(cosmeticId) {
  const profile = getProfile();
  return profile.unlockedCosmetics.includes(cosmeticId);
}

/**
 * Unlock a cosmetic
 */
export async function unlockCosmetic(cosmeticId) {
  if (hasCosmetic(cosmeticId)) {
    return false;
  }

  const profile = getProfile();
  profile.unlockedCosmetics.push(cosmeticId);
  await save(profile);

  return true;
}

/**
 * Get daily challenge data for a specific date and game
 */
export function getDailyChallengeData(date, gameId) {
  const key = `daily_${date}_${gameId}`;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Save daily challenge data
 */
export async function saveDailyChallengeData(date, gameId, data) {
  const key = `daily_${date}_${gameId}`;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Export profile data for backup
 */
export function exportProfile() {
  const profile = getProfile();
  return JSON.stringify(profile, null, 2);
}

/**
 * Import profile data from backup
 */
export async function importProfile(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    const validated = validateProfile(data);
    await save(validated);
    return true;
  } catch (error) {
    console.error('[Storage] Import failed:', error);
    return false;
  }
}

/**
 * Clear all data
 */
export async function clearAllData() {
  try {
    localStorage.removeItem(STORAGE_KEY);

    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('daily_')) {
        localStorage.removeItem(key);
      }
    });

    profileCache = null;
    return true;
  } catch {
    return false;
  }
}

// Internal functions

function validateProfile(data) {
  const validated = { ...DEFAULT_PROFILE, ...data };

  validated.gamesPlayed = validated.gamesPlayed || {};
  validated.achievements = Array.isArray(validated.achievements) ? validated.achievements : [];
  validated.unlockedCosmetics = Array.isArray(validated.unlockedCosmetics) ? validated.unlockedCosmetics : ['theme_default'];
  validated.settings = { ...DEFAULT_PROFILE.settings, ...(validated.settings || {}) };

  return validated;
}

function migrate(profile) {
  let migrated = { ...profile };

  // Version 1: Initial schema
  if (!migrated.version || migrated.version < 1) {
    migrated.version = 1;

    if (!migrated.perfectClears) {
      migrated.perfectClears = 0;
    }

    Object.keys(migrated.gamesPlayed || {}).forEach(gameId => {
      migrated.gamesPlayed[gameId] = {
        ...DEFAULT_GAME_STATS,
        ...migrated.gamesPlayed[gameId]
      };
    });
  }

  // Version 2: Add accessibility settings
  if (migrated.version < 2) {
    migrated.version = 2;

    // Ensure settings object exists with all accessibility fields
    migrated.settings = {
      ...DEFAULT_PROFILE.settings,
      ...migrated.settings
    };

    // Add new accessibility fields if missing
    if (migrated.settings.reducedMotionSetByUser === undefined) {
      migrated.settings.reducedMotionSetByUser = false;
    }
    if (migrated.settings.highContrast === undefined) {
      migrated.settings.highContrast = false;
    }
    if (migrated.settings.highContrastSetByUser === undefined) {
      migrated.settings.highContrastSetByUser = false;
    }
    if (migrated.settings.showPatterns === undefined) {
      migrated.settings.showPatterns = true;
    }
  }

  return migrated;
}

// Auto-save on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (profileCache) {
      save(profileCache);
    }
  });
}

export { DEFAULT_PROFILE, DEFAULT_GAME_STATS, SCHEMA_VERSION };
export default {
  initStorage,
  load,
  save,
  getProfile,
  updateProfile,
  getGameStats,
  updateGameStats,
  getSettings,
  updateSettings,
  hasAchievement,
  unlockAchievement,
  hasCosmetic,
  unlockCosmetic,
  getDailyChallengeData,
  saveDailyChallengeData,
  exportProfile,
  importProfile,
  clearAllData
};
