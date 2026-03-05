/**
 * Accessibility.js - Accessibility Management
 *
 * Provides:
 * - Settings detection and management
 * - Reduced motion support
 * - Colorblind mode patterns
 * - Focus management
 * - Screen reader announcements
 */

import { getSettings, updateSettings } from './storage.js';

// CSS class names for accessibility modes
const ACCESSIBILITY_CLASSES = {
  reducedMotion: 'reduced-motion',
  colorblindDeuteranopia: 'colorblind-deuteranopia',
  colorblindProtanopia: 'colorblind-protanopia',
  colorblindTritanopia: 'colorblind-tritanopia',
  colorblindPatterns: 'colorblind-patterns',
  highContrast: 'high-contrast'
};

// Live region for screen reader announcements
let liveRegion = null;

/**
 * Initialize accessibility features
 */
export function initAccessibility() {
  // Detect system preferences
  detectSystemPreferences();

  // Apply stored settings
  applyStoredSettings();

  // Create live region for announcements
  createLiveRegion();

  // Listen for preference changes
  listenForPreferenceChanges();
}

/**
 * Detect system accessibility preferences
 */
function detectSystemPreferences() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const prefersHighContrast = window.matchMedia('(prefers-contrast: more)').matches;

  // Store detected preferences
  const settings = getSettings();

  // Only apply system preference if user hasn't manually set it
  if (prefersReducedMotion && !settings.reducedMotionSetByUser) {
    updateSettings({ reducedMotion: true });
  }

  if (prefersHighContrast && !settings.highContrastSetByUser) {
    updateSettings({ highContrast: true });
  }
}

/**
 * Apply stored accessibility settings to the document
 */
export function applyStoredSettings() {
  const settings = getSettings();

  // Remove all accessibility classes first
  Object.values(ACCESSIBILITY_CLASSES).forEach(cls => {
    document.documentElement.classList.remove(cls);
  });

  // Apply reduced motion
  if (settings.reducedMotion) {
    document.documentElement.classList.add(ACCESSIBILITY_CLASSES.reducedMotion);
  }

  // Apply colorblind mode
  applyColorblindMode(settings.colorblindMode);

  // Apply high contrast
  if (settings.highContrast) {
    document.documentElement.classList.add(ACCESSIBILITY_CLASSES.highContrast);
  }
}

/**
 * Apply colorblind mode
 * @param {string} mode - Colorblind mode ('none', 'deuteranopia', 'protanopia', 'tritanopia')
 */
export function applyColorblindMode(mode) {
  // Remove existing colorblind classes
  document.documentElement.classList.remove(
    ACCESSIBILITY_CLASSES.colorblindDeuteranopia,
    ACCESSIBILITY_CLASSES.colorblindProtanopia,
    ACCESSIBILITY_CLASSES.colorblindTritanopia,
    ACCESSIBILITY_CLASSES.colorblindPatterns
  );

  // Apply new mode
  switch (mode) {
    case 'deuteranopia':
      document.documentElement.classList.add(ACCESSIBILITY_CLASSES.colorblindDeuteranopia);
      document.documentElement.classList.add(ACCESSIBILITY_CLASSES.colorblindPatterns);
      break;
    case 'protanopia':
      document.documentElement.classList.add(ACCESSIBILITY_CLASSES.colorblindProtanopia);
      document.documentElement.classList.add(ACCESSIBILITY_CLASSES.colorblindPatterns);
      break;
    case 'tritanopia':
      document.documentElement.classList.add(ACCESSIBILITY_CLASSES.colorblindTritanopia);
      document.documentElement.classList.add(ACCESSIBILITY_CLASSES.colorblindPatterns);
      break;
    case 'none':
    default:
      // No colorblind mode
      break;
  }
}

/**
 * Create live region for screen reader announcements
 */
function createLiveRegion() {
  if (liveRegion) return;

  liveRegion = document.createElement('div');
  liveRegion.id = 'sr-live-region';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  liveRegion.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
  document.body.appendChild(liveRegion);
}

/**
 * Announce message to screen readers
 * @param {string} message - Message to announce
 * @param {'polite' | 'assertive'} priority - Announcement priority
 */
export function announce(message, priority = 'polite') {
  if (!liveRegion) createLiveRegion();

  // Update priority if needed
  if (priority === 'assertive') {
    liveRegion.setAttribute('aria-live', 'assertive');
  } else {
    liveRegion.setAttribute('aria-live', 'polite');
  }

  // Clear and set message (triggers announcement)
  liveRegion.textContent = '';
  setTimeout(() => {
    liveRegion.textContent = message;
  }, 50);
}

/**
 * Listen for system preference changes
 */
function listenForPreferenceChanges() {
  // Reduced motion preference change
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotionQuery.addEventListener('change', (e) => {
    const settings = getSettings();
    if (!settings.reducedMotionSetByUser) {
      updateSettings({ reducedMotion: e.matches });
      applyStoredSettings();
    }
  });

  // High contrast preference change
  const highContrastQuery = window.matchMedia('(prefers-contrast: more)');
  highContrastQuery.addEventListener('change', (e) => {
    const settings = getSettings();
    if (!settings.highContrastSetByUser) {
      updateSettings({ highContrast: e.matches });
      applyStoredSettings();
    }
  });
}

/**
 * Set reduced motion preference
 * @param {boolean} enabled - Whether reduced motion is enabled
 * @param {boolean} setByUser - Whether this was set by user (vs system)
 */
export async function setReducedMotion(enabled, setByUser = true) {
  await updateSettings({
    reducedMotion: enabled,
    reducedMotionSetByUser: setByUser
  });
  applyStoredSettings();
}

/**
 * Set colorblind mode
 * @param {string} mode - Colorblind mode
 */
export async function setColorblindMode(mode) {
  await updateSettings({ colorblindMode: mode });
  applyColorblindMode(mode);
}

/**
 * Set high contrast mode
 * @param {boolean} enabled - Whether high contrast is enabled
 * @param {boolean} setByUser - Whether this was set by user
 */
export async function setHighContrast(enabled, setByUser = true) {
  await updateSettings({
    highContrast: enabled,
    highContrastSetByUser: setByUser
  });
  applyStoredSettings();
}

/**
 * Focus trap for modals and overlays
 * @param {HTMLElement} container - Container to trap focus within
 * @returns {Function} Cleanup function
 */
export function trapFocus(container) {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  // Focus first element
  if (firstFocusable) {
    firstFocusable.focus();
  }

  function handleKeydown(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  }

  container.addEventListener('keydown', handleKeydown);

  return () => {
    container.removeEventListener('keydown', handleKeydown);
  };
}

/**
 * Get accessibility settings for display
 * @returns {Object} Current accessibility settings
 */
export function getAccessibilitySettings() {
  const settings = getSettings();
  const systemPrefs = {
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    prefersHighContrast: window.matchMedia('(prefers-contrast: more)').matches
  };

  return {
    reducedMotion: settings.reducedMotion,
    colorblindMode: settings.colorblindMode || 'none',
    highContrast: settings.highContrast,
    systemPreferences: systemPrefs
  };
}

/**
 * Check if reduced motion is enabled (user or system)
 * @returns {boolean}
 */
export function isReducedMotionEnabled() {
  const settings = getSettings();
  return settings.reducedMotion ||
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if high contrast is enabled
 * @returns {boolean}
 */
export function isHighContrastEnabled() {
  const settings = getSettings();
  return settings.highContrast ||
         window.matchMedia('(prefers-contrast: more)').matches;
}

/**
 * Apply accessibility settings (unified function for settings page)
 * @param {Object} settings - Settings to apply
 */
export function applyAccessibilitySettings(settings) {
  if (settings.reducedMotion !== undefined) {
    if (settings.reducedMotion) {
      document.documentElement.classList.add(ACCESSIBILITY_CLASSES.reducedMotion);
    } else {
      document.documentElement.classList.remove(ACCESSIBILITY_CLASSES.reducedMotion);
    }
  }
  
  if (settings.highContrast !== undefined) {
    if (settings.highContrast) {
      document.documentElement.classList.add(ACCESSIBILITY_CLASSES.highContrast);
    } else {
      document.documentElement.classList.remove(ACCESSIBILITY_CLASSES.highContrast);
    }
  }
  
  if (settings.colorblindMode !== undefined) {
    applyColorblindMode(settings.colorblindMode);
  }
  
  if (settings.showPatterns !== undefined) {
    if (settings.showPatterns) {
      document.documentElement.classList.add(ACCESSIBILITY_CLASSES.colorblindPatterns);
    } else {
      document.documentElement.classList.remove(ACCESSIBILITY_CLASSES.colorblindPatterns);
    }
  }
}

export default {
  initAccessibility,
  applyStoredSettings,
  applyColorblindMode,
  announce,
  setReducedMotion,
  setColorblindMode,
  setHighContrast,
  trapFocus,
  getAccessibilitySettings,
  isReducedMotionEnabled,
  isHighContrastEnabled,
  applyAccessibilitySettings
};
