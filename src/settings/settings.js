/**
 * Settings Page Logic
 *
 * Manages all settings with localStorage persistence:
 * - Zen mode toggle and audio controls
 * - Audio settings (sound, haptic)
 * - Accessibility options
 */

import { getSettings, updateSettings } from '../shared/storage.js';
import { 
  initZenMode, 
  toggleZenMode, 
  isZenMode, 
  playAmbientAudio, 
  stopAmbientAudio, 
  setAmbientVolume,
  getAmbiance,
  getVolume
} from '../shared/zen-mode.js';
import { initAccessibility, applyAccessibilitySettings } from '../shared/accessibility.js';

// Initialize settings page
async function init() {
  // Initialize zen mode first
  initZenMode();
  
  // Load current settings
  const settings = getSettings();
  
  // Apply settings to UI
  applySettingsToUI(settings);
  
  // Show/hide zen-only settings based on current state
  updateZenVisibility(settings.zenMode);
  
  // Setup event listeners
  setupEventListeners();
  
  // Initialize accessibility
  initAccessibility();
}

/**
 * Apply settings to UI controls
 */
function applySettingsToUI(settings) {
  // Zen mode
  document.getElementById('zen-toggle').checked = settings.zenMode || false;
  document.getElementById('zen-ambiance').value = settings.zenAmbiance || 'silence';
  document.getElementById('zen-volume').value = (settings.zenVolume ?? 0.3) * 100;
  document.getElementById('volume-display').textContent = `${Math.round((settings.zenVolume ?? 0.3) * 100)}%`;
  
  // Audio
  document.getElementById('sound-toggle').checked = settings.soundEnabled ?? true;
  document.getElementById('haptic-toggle').checked = settings.hapticEnabled ?? true;
  
  // Accessibility
  document.getElementById('motion-toggle').checked = settings.reducedMotion || false;
  document.getElementById('contrast-toggle').checked = settings.highContrast || false;
  document.getElementById('colorblind-select').value = settings.colorblindMode || 'none';
  document.getElementById('patterns-toggle').checked = settings.showPatterns ?? true;
}

/**
 * Show/hide zen-only settings
 */
function updateZenVisibility(enabled) {
  const zenOnlyElements = document.querySelectorAll('.zen-only');
  
  zenOnlyElements.forEach(el => {
    if (enabled) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Zen mode toggle
  document.getElementById('zen-toggle').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await toggleZenMode();
    updateZenVisibility(enabled);
  });
  
  // Zen ambiance
  document.getElementById('zen-ambiance').addEventListener('change', async (e) => {
    const trackId = e.target.value;
    await playAmbientAudio(trackId);
  });
  
  // Zen volume
  document.getElementById('zen-volume').addEventListener('input', async (e) => {
    const volume = e.target.value / 100;
    document.getElementById('volume-display').textContent = `${e.target.value}%`;
    await setAmbientVolume(volume);
  });
  
  // Sound toggle
  document.getElementById('sound-toggle').addEventListener('change', async (e) => {
    await updateSettings({ soundEnabled: e.target.checked });
  });
  
  // Haptic toggle
  document.getElementById('haptic-toggle').addEventListener('change', async (e) => {
    await updateSettings({ hapticEnabled: e.target.checked });
  });
  
  // Reduced motion
  document.getElementById('motion-toggle').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await updateSettings({ 
      reducedMotion: enabled,
      reducedMotionSetByUser: true 
    });
    applyAccessibilitySettings({ reducedMotion: enabled });
  });
  
  // High contrast
  document.getElementById('contrast-toggle').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await updateSettings({ 
      highContrast: enabled,
      highContrastSetByUser: true 
    });
    applyAccessibilitySettings({ highContrast: enabled });
  });
  
  // Colorblind mode
  document.getElementById('colorblind-select').addEventListener('change', async (e) => {
    const mode = e.target.value;
    await updateSettings({ colorblindMode: mode });
    applyAccessibilitySettings({ colorblindMode: mode });
  });
  
  // Show patterns
  document.getElementById('patterns-toggle').addEventListener('change', async (e) => {
    await updateSettings({ showPatterns: e.target.checked });
    applyAccessibilitySettings({ showPatterns: e.target.checked });
  });
  
  // Listen for zen mode changes from other sources
  window.addEventListener('zenModeChanged', (e) => {
    document.getElementById('zen-toggle').checked = e.detail.enabled;
    updateZenVisibility(e.detail.enabled);
  });
}

// Run on load
document.addEventListener('DOMContentLoaded', init);

export { init };
