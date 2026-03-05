/**
 * Analytics - Privacy-focused usage tracking
 *
 * Simple, privacy-first analytics that:
 * - Stores all data locally (no external tracking)
 * - Tracks basic usage patterns
 * - Provides insights for improving the games
 * - Respects user privacy
 */

const ANALYTICS_KEY = 'mobile-gaming-analytics';
const SESSION_KEY = 'mobile-gaming-session';

let isInitialized = false;
let sessionData = null;
let analyticsData = null;

/**
 * Initialize analytics
 */
export function initAnalytics() {
  if (isInitialized) return;
  isInitialized = true;

  // Load existing data
  loadAnalyticsData();

  // Start new session
  startSession();

  // Track page visibility
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Track page unload
  window.addEventListener('beforeunload', handlePageUnload);

  console.log('[Analytics] Initialized (privacy-first, local storage only)');
}

/**
 * Start a new session
 */
function startSession() {
  sessionData = {
    id: generateSessionId(),
    startTime: Date.now(),
    page: window.location.pathname,
    referrer: document.referrer || 'direct',
    events: []
  };

  // Track session start
  trackEvent('session_start', { page: sessionData.page });
}

/**
 * Track an event
 */
export function trackEvent(eventName, data = {}) {
  if (!isInitialized || !sessionData) return;

  const event = {
    name: eventName,
    timestamp: Date.now(),
    data: sanitizeData(data)
  };

  sessionData.events.push(event);

  // Update aggregate stats
  updateAggregateStats(eventName, data);

  // Save periodically
  if (sessionData.events.length % 10 === 0) {
    saveAnalyticsData();
  }
}

/**
 * Track a page view
 */
export function trackPageView(pageName) {
  trackEvent('page_view', { page: pageName || window.location.pathname });
}

/**
 * Track a game event
 */
export function trackGameEvent(gameId, eventName, data = {}) {
  trackEvent(`game_${eventName}`, {
    game: gameId,
    ...data
  });
}

/**
 * Track level completion
 */
export function trackLevelComplete(gameId, levelId, stars, moves, time) {
  trackEvent('level_complete', {
    game: gameId,
    level: levelId,
    stars,
    moves,
    time
  });
}

/**
 * Track game start
 */
export function trackGameStart(gameId, levelId) {
  trackEvent('game_start', {
    game: gameId,
    level: levelId
  });
}

/**
 * Track PWA install
 */
export function trackPWAInstall() {
  trackEvent('pwa_install', {
    standalone: window.matchMedia('(display-mode: standalone)').matches
  });
}

/**
 * Track error (non-fatal)
 */
export function trackError(category, message) {
  trackEvent('error', {
    category,
    message: message.substring(0, 100) // Truncate for storage
  });
}

/**
 * Get session duration in seconds
 */
export function getSessionDuration() {
  if (!sessionData) return 0;
  return Math.floor((Date.now() - sessionData.startTime) / 1000);
}

/**
 * Get analytics summary
 */
export function getAnalyticsSummary() {
  if (!analyticsData) return null;

  return {
    totalSessions: analyticsData.totalSessions || 0,
    totalEvents: analyticsData.totalEvents || 0,
    gamesPlayed: analyticsData.gamesPlayed || {},
    levelCompletions: analyticsData.levelCompletions || {},
    averageSessionDuration: analyticsData.averageSessionDuration || 0,
    firstVisit: analyticsData.firstVisit,
    lastVisit: analyticsData.lastVisit
  };
}

/**
 * Get events for a specific time range
 */
export function getEventsInRange(startTime, endTime) {
  // This would require more complex storage - simplified for now
  return sessionData?.events.filter(e =>
    e.timestamp >= startTime && e.timestamp <= endTime
  ) || [];
}

/**
 * Clear all analytics data
 */
export function clearAnalytics() {
  analyticsData = {
    totalSessions: 0,
    totalEvents: 0,
    gamesPlayed: {},
    levelCompletions: {},
    averageSessionDuration: 0,
    firstVisit: new Date().toISOString(),
    lastVisit: new Date().toISOString()
  };
  saveAnalyticsData();
}

/**
 * Export analytics data
 */
export function exportAnalytics() {
  return JSON.stringify({
    session: sessionData,
    aggregate: analyticsData
  }, null, 2);
}

/**
 * Handle visibility change
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // Page hidden - save data
    saveAnalyticsData();
  } else {
    // Page visible - could track engagement
    trackEvent('page_visible');
  }
}

/**
 * Handle page unload
 */
function handlePageUnload() {
  if (sessionData) {
    const duration = getSessionDuration();
    trackEvent('session_end', { duration });
    saveAnalyticsData();
  }
}

/**
 * Update aggregate statistics
 */
function updateAggregateStats(eventName, data) {
  if (!analyticsData) return;

  analyticsData.totalEvents++;
  analyticsData.lastVisit = new Date().toISOString();

  switch (eventName) {
    case 'session_start':
      analyticsData.totalSessions++;
      break;

    case 'session_end':
      if (data.duration) {
        const prevAvg = analyticsData.averageSessionDuration || 0;
        const prevCount = (analyticsData.totalSessions || 1) - 1;
        analyticsData.averageSessionDuration =
          (prevAvg * prevCount + data.duration) / (prevCount + 1);
      }
      break;

    case 'game_start':
      if (data.game) {
        analyticsData.gamesPlayed[data.game] =
          (analyticsData.gamesPlayed[data.game] || 0) + 1;
      }
      break;

    case 'level_complete':
      if (data.game && data.level !== undefined) {
        const key = `${data.game}_${data.level}`;
        analyticsData.levelCompletions[key] =
          (analyticsData.levelCompletions[key] || 0) + 1;
      }
      break;

    case 'pwa_install':
      analyticsData.pwaInstalls = (analyticsData.pwaInstalls || 0) + 1;
      break;
  }
}

/**
 * Sanitize data to remove sensitive info
 */
function sanitizeData(data) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    // Skip potentially sensitive keys
    if (key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('secret')) {
      continue;
    }

    // Truncate long strings
    if (typeof value === 'string' && value.length > 200) {
      sanitized[key] = value.substring(0, 200);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Load analytics data from storage
 */
function loadAnalyticsData() {
  try {
    const stored = localStorage.getItem(ANALYTICS_KEY);
    if (stored) {
      analyticsData = JSON.parse(stored);
    } else {
      // Initialize new analytics data
      analyticsData = {
        totalSessions: 0,
        totalEvents: 0,
        gamesPlayed: {},
        levelCompletions: {},
        averageSessionDuration: 0,
        firstVisit: new Date().toISOString(),
        lastVisit: new Date().toISOString()
      };
    }
  } catch (e) {
    console.warn('[Analytics] Failed to load data:', e);
    analyticsData = {};
  }
}

/**
 * Save analytics data to storage
 */
function saveAnalyticsData() {
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analyticsData));
  } catch (e) {
    console.warn('[Analytics] Failed to save data:', e);
  }
}

/**
 * Generate unique session ID
 */
function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default {
  initAnalytics,
  trackEvent,
  trackPageView,
  trackGameEvent,
  trackLevelComplete,
  trackGameStart,
  trackPWAInstall,
  trackError,
  getSessionDuration,
  getAnalyticsSummary,
  getEventsInRange,
  clearAnalytics,
  exportAnalytics
};
