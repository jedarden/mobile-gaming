/**
 * Settings Drawer Component
 *
 * Slide-out settings panel accessible via a gear icon.
 * Provides toggles for sound, haptic, color-blind, dark mode, and reduced motion.
 * Includes sync progress export/import and an about section.
 */

import { storage } from './storage.js';
import { playTap } from './audio.js';
import { BLUE, GRAY, WHITE, BLUISH_GREEN } from './colors.js';

/** Storage key for settings */
const SETTINGS_KEY = 'global:settings';

/** Drawer width */
const DRAWER_WIDTH = 280;

/** Transition duration in ms */
const TRANSITION_MS = 200;

/** Default settings values */
const DEFAULTS = {
  sound: true,
  haptic: true,
  colorBlind: false,
  darkMode: null, // null = follow prefers-color-scheme
  reducedMotion: null, // null = follow prefers-reduced-motion
  devMode: false,
};

/** App metadata */
const APP_INFO = {
  name: 'Mobile Gaming',
  version: '1.0.0',
  github: 'https://github.com/coding/mobile-gaming',
  credits: 'Built with Three.js and Web Audio API',
};

/** Active instances for cleanup */
const instances = new Set();

/** Injected styles (only once) */
let stylesInjected = false;

/**
 * Inject component styles into the document
 */
function injectStyles() {
  if (stylesInjected) return;

  const style = document.createElement('style');
  style.textContent = `
    .mg-settings-gear {
      position: fixed;
      top: 16px;
      right: 16px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 600;
      transition: transform 0.15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .mg-settings-gear:active {
      transform: scale(0.92);
    }
    .mg-settings-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 700;
      opacity: 0;
      pointer-events: none;
      transition: opacity ${TRANSITION_MS}ms ease;
    }
    .mg-settings-backdrop.mg-visible {
      opacity: 1;
      pointer-events: auto;
    }
    .mg-settings-drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: ${DRAWER_WIDTH}px;
      background: #1a1a2e;
      color: white;
      z-index: 800;
      transform: translateX(100%);
      transition: transform ${TRANSITION_MS}ms ease;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 24px 20px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .mg-settings-drawer.mg-visible {
      transform: translateX(0);
    }
    .mg-settings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .mg-settings-title {
      font-size: 20px;
      font-weight: 700;
    }
    .mg-settings-close {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .mg-settings-close:active {
      background: rgba(255, 255, 255, 0.2);
    }
    .mg-settings-section {
      margin-bottom: 20px;
    }
    .mg-settings-section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: ${GRAY.hex};
      margin-bottom: 12px;
    }
    .mg-settings-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .mg-settings-toggle-label {
      font-size: 15px;
    }
    .mg-settings-toggle-desc {
      font-size: 12px;
      color: ${GRAY.hex};
      margin-top: 2px;
    }
    .mg-settings-switch {
      position: relative;
      width: 48px;
      height: 28px;
      flex-shrink: 0;
    }
    .mg-settings-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .mg-settings-switch-slider {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 14px;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    .mg-settings-switch-slider::before {
      content: '';
      position: absolute;
      width: 22px;
      height: 22px;
      left: 3px;
      top: 3px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s ease;
    }
    .mg-settings-switch input:checked + .mg-settings-switch-slider {
      background: ${BLUISH_GREEN.hex};
    }
    .mg-settings-switch input:checked + .mg-settings-switch-slider::before {
      transform: translateX(20px);
    }
    .mg-settings-action {
      display: block;
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      border: none;
      background: rgba(255, 255, 255, 0.08);
      color: white;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      margin-bottom: 8px;
      text-align: left;
      transition: background 0.15s ease;
    }
    .mg-settings-action:active {
      background: rgba(255, 255, 255, 0.15);
    }
    .mg-settings-about {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      text-align: center;
    }
    .mg-settings-version {
      font-size: 13px;
      color: ${GRAY.hex};
      cursor: default;
      user-select: none;
      -webkit-user-select: none;
    }
    .mg-settings-credits {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.3);
      margin-top: 8px;
    }
    .mg-settings-link {
      color: ${BLUE.hex};
      text-decoration: none;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

/**
 * Load settings from storage
 * @returns {Object} Settings object
 */
function loadSettings() {
  return storage.get(SETTINGS_KEY, { ...DEFAULTS });
}

/**
 * Save settings to storage
 * @param {Object} settings - Settings object
 */
function saveSettings(settings) {
  storage.set(SETTINGS_KEY, settings);
}

/**
 * Get the effective value for a system-following setting
 * @param {*} settingValue - Stored setting value (null = follow system)
 * @param {string} mediaQuery - CSS media query to match
 * @param {boolean} fallback - Fallback if media query not supported
 * @returns {boolean}
 */
function resolveSystemSetting(settingValue, mediaQuery, fallback) {
  if (settingValue !== null) return settingValue;
  if (typeof window.matchMedia !== 'function') return fallback;
  return window.matchMedia(mediaQuery).matches;
}

/**
 * Trigger haptic feedback if available
 */
function triggerHaptic() {
  const settings = loadSettings();
  if (!settings.haptic) return;
  try {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch {
    // Haptics not supported
  }
}

/**
 * Create a settings drawer instance
 *
 * @param {Object} options - Configuration
 * @param {HTMLElement} options.container - Container element to append to
 * @param {Function} options.onSettingsChange - Callback(settings) when any setting changes
 * @param {Function} options.onDevMode - Callback() when dev mode is toggled
 * @param {Function} options.onSyncExport - Callback() for export progress action
 * @param {Function} options.onSyncImport - Callback(code) for import progress action
 * @returns {Object} Settings drawer instance
 */
export function createSettings(options = {}) {
  const {
    container,
    onSettingsChange,
    onDevMode,
    onSyncExport,
    onSyncImport,
  } = options;

  injectStyles();

  let versionTapCount = 0;
  let versionTapTimer = null;

  // Gear button
  const gear = document.createElement('button');
  gear.className = 'mg-settings-gear';
  gear.setAttribute('aria-label', 'Settings');
  gear.textContent = '\u2699'; // gear emoji
  container.appendChild(gear);

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'mg-settings-backdrop';
  document.body.appendChild(backdrop);

  // Drawer
  const drawer = document.createElement('div');
  drawer.className = 'mg-settings-drawer';
  document.body.appendChild(drawer);

  /**
   * Build drawer contents
   */
  function buildContent() {
    const currentSettings = loadSettings();

    drawer.innerHTML = `
      <div class="mg-settings-header">
        <div class="mg-settings-title">Settings</div>
        <button class="mg-settings-close" aria-label="Close settings">\u2715</button>
      </div>

      <div class="mg-settings-section">
        <div class="mg-settings-section-title">Audio & Haptics</div>
        <div class="mg-settings-toggle">
          <div>
            <div class="mg-settings-toggle-label">Sound</div>
            <div class="mg-settings-toggle-desc">Game sound effects</div>
          </div>
          <label class="mg-settings-switch">
            <input type="checkbox" data-setting="sound" ${currentSettings.sound ? 'checked' : ''}>
            <span class="mg-settings-switch-slider"></span>
          </label>
        </div>
        <div class="mg-settings-toggle">
          <div>
            <div class="mg-settings-toggle-label">Haptic</div>
            <div class="mg-settings-toggle-desc">Vibration feedback</div>
          </div>
          <label class="mg-settings-switch">
            <input type="checkbox" data-setting="haptic" ${currentSettings.haptic ? 'checked' : ''}>
            <span class="mg-settings-switch-slider"></span>
          </label>
        </div>
      </div>

      <div class="mg-settings-section">
        <div class="mg-settings-section-title">Accessibility</div>
        <div class="mg-settings-toggle">
          <div>
            <div class="mg-settings-toggle-label">Color Blind</div>
            <div class="mg-settings-toggle-desc">High-contrast color palette</div>
          </div>
          <label class="mg-settings-switch">
            <input type="checkbox" data-setting="colorBlind" ${currentSettings.colorBlind ? 'checked' : ''}>
            <span class="mg-settings-switch-slider"></span>
          </label>
        </div>
        <div class="mg-settings-toggle">
          <div>
            <div class="mg-settings-toggle-label">Dark Mode</div>
            <div class="mg-settings-toggle-desc">Follows system preference</div>
          </div>
          <label class="mg-settings-switch">
            <input type="checkbox" data-setting="darkMode" ${currentSettings.darkMode === true ? 'checked' : ''}>
            <span class="mg-settings-switch-slider"></span>
          </label>
        </div>
        <div class="mg-settings-toggle">
          <div>
            <div class="mg-settings-toggle-label">Reduced Motion</div>
            <div class="mg-settings-toggle-desc">Follows system preference</div>
          </div>
          <label class="mg-settings-switch">
            <input type="checkbox" data-setting="reducedMotion" ${currentSettings.reducedMotion === true ? 'checked' : ''}>
            <span class="mg-settings-switch-slider"></span>
          </label>
        </div>
      </div>

      <div class="mg-settings-section">
        <div class="mg-settings-section-title">Data</div>
        <button class="mg-settings-action" data-action="sync-export">Sync Progress (Export)</button>
        <button class="mg-settings-action" data-action="sync-import">Sync Progress (Import)</button>
      </div>

      <div class="mg-settings-about">
        <div class="mg-settings-version" data-action="version">v${APP_INFO.version}</div>
        <div class="mg-settings-credits">${APP_INFO.credits}</div>
      </div>
    `;

    // Toggle handlers
    drawer.querySelectorAll('input[data-setting]').forEach(input => {
      input.addEventListener('change', () => {
        const key = input.dataset.setting;
        const value = input.checked;

        const current = loadSettings();
        current[key] = value;
        saveSettings(current);
        triggerHaptic();

        if (onSettingsChange) onSettingsChange(current);
      });
    });

    // Action handlers
    drawer.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', () => {
        const action = el.dataset.action;

        if (action === 'sync-export') {
          playTap();
          triggerHaptic();
          if (onSyncExport) onSyncExport();
        } else if (action === 'sync-import') {
          playTap();
          triggerHaptic();
          const code = prompt('Enter sync code:');
          if (code && onSyncImport) onSyncImport(code);
        } else if (action === 'version') {
          versionTapCount++;
          clearTimeout(versionTapTimer);
          versionTapTimer = setTimeout(() => { versionTapCount = 0; }, 500);

          if (versionTapCount >= 3) {
            versionTapCount = 0;
            const current = loadSettings();
            current.devMode = !current.devMode;
            saveSettings(current);
            if (onDevMode) onDevMode();
          }
        }
      });
    });

    // Close button
    const closeBtn = drawer.querySelector('.mg-settings-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => instance.hide());
    }
  }

  /**
   * Show the settings drawer
   */
  function show() {
    playTap();
    triggerHaptic();
    buildContent();
    backdrop.classList.add('mg-visible');
    drawer.classList.add('mg-visible');
  }

  /**
   * Hide the settings drawer
   */
  function hide() {
    backdrop.classList.remove('mg-visible');
    drawer.classList.remove('mg-visible');
  }

  // Gear click
  gear.addEventListener('click', show);

  // Backdrop click
  backdrop.addEventListener('click', hide);

  // Build instance
  const instance = {
    gear,
    backdrop,
    drawer,
    show,
    hide,

    /**
     * Get current settings
     * @returns {Object} Current settings
     */
    getSettings() {
      return loadSettings();
    },

    /**
     * Update a specific setting
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    setSetting(key, value) {
      const current = loadSettings();
      current[key] = value;
      saveSettings(current);
    },

    /**
     * Check if dark mode is active
     * @returns {boolean}
     */
    isDarkMode() {
      const current = loadSettings();
      return resolveSystemSetting(current.darkMode, '(prefers-color-scheme: dark)', false);
    },

    /**
     * Check if reduced motion is active
     * @returns {boolean}
     */
    isReducedMotion() {
      const current = loadSettings();
      return resolveSystemSetting(current.reducedMotion, '(prefers-reduced-motion: reduce)', false);
    },

    /**
     * Destroy the settings drawer
     */
    destroy() {
      hide();
      if (gear.parentNode) gear.parentNode.removeChild(gear);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      if (drawer.parentNode) drawer.parentNode.removeChild(drawer);
      instances.delete(instance);
    },
  };

  instances.add(instance);
  return instance;
}

/**
 * Get all current settings (without creating UI)
 * @returns {Object} Current settings
 */
export function getSettings() {
  return loadSettings();
}

/**
 * Update a setting value (without creating UI)
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 */
export function setSetting(key, value) {
  const current = loadSettings();
  current[key] = value;
  saveSettings(current);
}

/**
 * Check if dark mode is active (without creating UI)
 * @returns {boolean}
 */
export function isDarkMode() {
  const current = loadSettings();
  return resolveSystemSetting(current.darkMode, '(prefers-color-scheme: dark)', false);
}

/**
 * Check if reduced motion is active (without creating UI)
 * @returns {boolean}
 */
export function isReducedMotion() {
  const current = loadSettings();
  return resolveSystemSetting(current.reducedMotion, '(prefers-reduced-motion: reduce)', false);
}

/**
 * Reset all settings to defaults
 */
export function resetSettings() {
  saveSettings({ ...DEFAULTS });
}

/**
 * Cleanup all settings instances
 */
export function cleanupAll() {
  for (const inst of instances) {
    inst.destroy();
  }
  instances.clear();
}
