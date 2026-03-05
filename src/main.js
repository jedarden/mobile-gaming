/**
 * Main.js - Landing Page Entry Point
 *
 * Initializes the game directory landing page with:
 * - Platform systems (storage, meta, achievements, daily)
 * - PWA service worker registration
 * - Install prompt handling
 * - Accessibility features
 * - Zen mode initialization
 * - Error tracking and analytics
 */

import { initStorage, getProfile, getSettings } from './shared/storage.js';
import { getLevelInfo, getProfileStats, formatXP } from './shared/meta.js';
import { getStreakInfo, getStreakEmoji, getStreakMessage, getDailyStatus } from './shared/daily.js';
import { initAccessibility, announce } from './shared/accessibility.js';
import { initZenMode, isZenMode } from './shared/zen-mode.js';
import { initErrorTracking } from './shared/error-tracking.js';
import { initAnalytics, trackEvent, trackPageView, trackPWAInstall } from './shared/analytics.js';

// Install prompt handling
let deferredPrompt = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Mobile Gaming loaded');

  try {
    // Initialize error tracking first
    initErrorTracking();

    // Initialize analytics
    initAnalytics();

    // Track page view
    trackPageView('home');

    // Initialize storage and profile
    await initStorage();

    // Initialize accessibility features
    initAccessibility();

    // Initialize zen mode
    initZenMode();

    // Update UI with player data
    updateProfileDisplay();
    updateDailyStatus();

    // Register service worker for PWA
    registerServiceWorker();

    // Setup install prompt
    setupInstallPrompt();

    // Track sessions for install prompt timing
    trackSession();

    // Listen for zen mode changes
    window.addEventListener('zenModeChanged', (e) => {
      console.log('Zen mode changed:', e.detail.enabled ? 'enabled' : 'disabled');
      trackEvent('zen_mode_change', { enabled: e.detail.enabled });
    });

  } catch (error) {
    console.error('Failed to initialize platform:', error);
  }
});

/**
 * Update profile link with level and stats
 */
function updateProfileDisplay() {
  const levelInfo = getLevelInfo();
  const stats = getProfileStats();
  const streakInfo = getStreakInfo();

  // Update profile link with level
  const profileLink = document.querySelector('.profile-link');
  if (profileLink) {
    const xpDisplay = formatXP(stats.xp);
    profileLink.innerHTML = `👤 Level ${levelInfo.level} <span class="xp-badge">${xpDisplay} XP</span>`;
    profileLink.title = `${stats.totalCompleted} levels completed | ${stats.totalStars} stars`;
  }

  // Add streak indicator if active
  if (streakInfo.current > 0) {
    const header = document.querySelector('header');
    if (header) {
      const streakEl = document.createElement('div');
      streakEl.className = 'streak-indicator';
      streakEl.innerHTML = `${getStreakEmoji(streakInfo.current)} ${streakInfo.current} day streak`;
      streakEl.title = getStreakMessage(streakInfo.current);
      header.appendChild(streakEl);
    }
  }
}

/**
 * Update daily challenge status display
 */
function updateDailyStatus() {
  const dailyStatus = getDailyStatus();
  const completedCount = dailyStatus.filter(d => d.completed).length;

  // Add daily progress indicator
  const header = document.querySelector('header');
  if (header && completedCount > 0) {
    const dailyEl = document.createElement('div');
    dailyEl.className = 'daily-indicator';
    dailyEl.innerHTML = `📅 ${completedCount}/${dailyStatus.length} dailies done`;
    header.appendChild(dailyEl);
  }
}

/**
 * Register service worker for PWA
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('Service Worker registered:', reg.scope);

        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              showUpdateNotification();
              trackEvent('pwa_update_available');
            }
          });
        });
      })
      .catch(err => console.log('Service Worker registration failed:', err));
  }
}

/**
 * Setup PWA install prompt
 */
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Check if we should show the prompt
    const sessions = parseInt(localStorage.getItem('mg_sessions') || '0');
    const dismissed = localStorage.getItem('mg_install_dismissed');

    // Show after 3rd session, or re-prompt after 30 days if dismissed
    if (sessions >= 3 && !dismissed) {
      showInstallPrompt();
    } else if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed >= 30) {
        localStorage.removeItem('mg_install_dismissed');
        showInstallPrompt();
      }
    }
  });

  // Log install
  window.addEventListener('appinstalled', () => {
    console.log('App installed');
    deferredPrompt = null;
    localStorage.removeItem('mg_install_dismissed');
    trackPWAInstall();
  });
}

/**
 * Show install prompt UI
 */
function showInstallPrompt() {
  // Create install banner
  const banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.innerHTML = `
    <div class="install-content">
      <span>📱 Install Mobile Gaming for the best experience!</span>
      <div class="install-actions">
        <button class="install-btn" id="install-accept">Install</button>
        <button class="install-dismiss" id="install-dismiss">Not now</button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  // Handle install click
  document.getElementById('install-accept').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('Install prompt outcome:', outcome);
      deferredPrompt = null;
    }
    banner.remove();
  });

  // Handle dismiss
  document.getElementById('install-dismiss').addEventListener('click', () => {
    localStorage.setItem('mg_install_dismissed', new Date().toISOString());
    banner.remove();
    trackEvent('pwa_install_dismissed');
  });
}

/**
 * Show update notification
 */
function showUpdateNotification() {
  const notification = document.createElement('div');
  notification.className = 'update-notification';
  notification.innerHTML = `
    <span>🔄 Update available!</span>
    <button id="update-reload">Refresh</button>
  `;

  document.body.appendChild(notification);

  document.getElementById('update-reload').addEventListener('click', () => {
    window.location.reload();
  });
}

/**
 * Track session count for install prompt timing
 */
function trackSession() {
  const sessions = parseInt(localStorage.getItem('mg_sessions') || '0');
  const lastSession = localStorage.getItem('mg_last_session');
  const today = new Date().toISOString().slice(0, 10);

  // Only increment if it's a new day (prevents tab refresh counting)
  if (lastSession !== today) {
    localStorage.setItem('mg_sessions', sessions + 1);
    localStorage.setItem('mg_last_session', today);
  }
}

// Export for other modules
export { deferredPrompt };
