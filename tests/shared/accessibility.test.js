/**
 * Tests for Accessibility.js - Accessibility Management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
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
} from '../../src/shared/accessibility.js';
import * as storage from '../../src/shared/storage.js';
import { clearAllData } from '../../src/shared/storage.js';

describe('Accessibility', () => {
  let mockMatchMedia;

  beforeEach(async () => {
    // Clear localStorage first
    localStorage.clear();
    // Reset storage module cache
    await clearAllData();
    // Initialize fresh storage
    await storage.initStorage();

    // Mock matchMedia
    mockMatchMedia = vi.fn((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
    window.matchMedia = mockMatchMedia;

    // Clear document classes
    document.documentElement.className = '';
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Clean up after each test
    await clearAllData();
    localStorage.clear();
  });

  describe('applyColorblindMode', () => {
    it('should remove all colorblind classes when mode is none', () => {
      document.documentElement.classList.add('colorblind-deuteranopia');
      document.documentElement.classList.add('colorblind-patterns');

      applyColorblindMode('none');

      expect(document.documentElement.classList.contains('colorblind-deuteranopia')).toBe(false);
      expect(document.documentElement.classList.contains('colorblind-protanopia')).toBe(false);
      expect(document.documentElement.classList.contains('colorblind-tritanopia')).toBe(false);
      expect(document.documentElement.classList.contains('colorblind-patterns')).toBe(false);
    });

    it('should apply deuteranopia mode', () => {
      applyColorblindMode('deuteranopia');

      expect(document.documentElement.classList.contains('colorblind-deuteranopia')).toBe(true);
      expect(document.documentElement.classList.contains('colorblind-patterns')).toBe(true);
    });

    it('should apply protanopia mode', () => {
      applyColorblindMode('protanopia');

      expect(document.documentElement.classList.contains('colorblind-protanopia')).toBe(true);
      expect(document.documentElement.classList.contains('colorblind-patterns')).toBe(true);
    });

    it('should apply tritanopia mode', () => {
      applyColorblindMode('tritanopia');

      expect(document.documentElement.classList.contains('colorblind-tritanopia')).toBe(true);
      expect(document.documentElement.classList.contains('colorblind-patterns')).toBe(true);
    });

    it('should switch between modes correctly', () => {
      applyColorblindMode('deuteranopia');
      expect(document.documentElement.classList.contains('colorblind-deuteranopia')).toBe(true);

      applyColorblindMode('protanopia');
      expect(document.documentElement.classList.contains('colorblind-deuteranopia')).toBe(false);
      expect(document.documentElement.classList.contains('colorblind-protanopia')).toBe(true);
    });
  });

  describe('applyStoredSettings', () => {
    it('should apply reduced motion setting', async () => {
      await storage.updateSettings({ reducedMotion: true });
      applyStoredSettings();

      expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
    });

    it('should apply high contrast setting', async () => {
      await storage.updateSettings({ highContrast: true });
      applyStoredSettings();

      expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
    });

    it('should apply colorblind mode setting', async () => {
      await storage.updateSettings({ colorblindMode: 'deuteranopia' });
      applyStoredSettings();

      expect(document.documentElement.classList.contains('colorblind-deuteranopia')).toBe(true);
    });

    it('should apply multiple settings together', async () => {
      await storage.updateSettings({
        reducedMotion: true,
        highContrast: true,
        colorblindMode: 'protanopia'
      });
      applyStoredSettings();

      expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
      expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
      expect(document.documentElement.classList.contains('colorblind-protanopia')).toBe(true);
    });

    it('should remove all classes when settings are disabled', async () => {
      // First add classes
      document.documentElement.classList.add('reduced-motion');
      document.documentElement.classList.add('high-contrast');

      // Then apply with disabled settings
      await storage.updateSettings({
        reducedMotion: false,
        highContrast: false,
        colorblindMode: 'none'
      });
      applyStoredSettings();

      expect(document.documentElement.classList.contains('reduced-motion')).toBe(false);
      expect(document.documentElement.classList.contains('high-contrast')).toBe(false);
    });
  });

  describe('announce', () => {
    it('should create live region if not exists', () => {
      announce('Test message');

      const liveRegion = document.getElementById('sr-live-region');
      expect(liveRegion).not.toBeNull();
      expect(liveRegion.getAttribute('role')).toBe('status');
      expect(liveRegion.getAttribute('aria-live')).toBe('polite');
    });

    it('should set aria-live to polite by default', () => {
      announce('Test message');

      const liveRegion = document.getElementById('sr-live-region');
      expect(liveRegion.getAttribute('aria-live')).toBe('polite');
    });

    it('should set aria-live to assertive when specified', () => {
      announce('Urgent message', 'assertive');

      const liveRegion = document.getElementById('sr-live-region');
      expect(liveRegion.getAttribute('aria-live')).toBe('assertive');
    });

    it('should set message text after delay', async () => {
      announce('Delayed message');

      const liveRegion = document.getElementById('sr-live-region');
      expect(liveRegion.textContent).toBe(''); // Initially cleared

      // Wait for the setTimeout
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(liveRegion.textContent).toBe('Delayed message');
    });
  });

  describe('setReducedMotion', () => {
    it('should enable reduced motion', async () => {
      await setReducedMotion(true);

      expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
      const settings = storage.getSettings();
      expect(settings.reducedMotion).toBe(true);
      expect(settings.reducedMotionSetByUser).toBe(true);
    });

    it('should disable reduced motion', async () => {
      document.documentElement.classList.add('reduced-motion');
      await setReducedMotion(false);

      expect(document.documentElement.classList.contains('reduced-motion')).toBe(false);
      const settings = storage.getSettings();
      expect(settings.reducedMotion).toBe(false);
    });

    it('should track if set by user', async () => {
      await setReducedMotion(true, true);
      let settings = storage.getSettings();
      expect(settings.reducedMotionSetByUser).toBe(true);

      await setReducedMotion(true, false);
      settings = storage.getSettings();
      expect(settings.reducedMotionSetByUser).toBe(false);
    });
  });

  describe('setColorblindMode', () => {
    it('should set colorblind mode to deuteranopia', async () => {
      await setColorblindMode('deuteranopia');

      expect(document.documentElement.classList.contains('colorblind-deuteranopia')).toBe(true);
      const settings = storage.getSettings();
      expect(settings.colorblindMode).toBe('deuteranopia');
    });

    it('should set colorblind mode to none', async () => {
      document.documentElement.classList.add('colorblind-deuteranopia');
      await setColorblindMode('none');

      expect(document.documentElement.classList.contains('colorblind-deuteranopia')).toBe(false);
      const settings = storage.getSettings();
      expect(settings.colorblindMode).toBe('none');
    });
  });

  describe('setHighContrast', () => {
    it('should enable high contrast', async () => {
      await setHighContrast(true);

      expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
      const settings = storage.getSettings();
      expect(settings.highContrast).toBe(true);
      expect(settings.highContrastSetByUser).toBe(true);
    });

    it('should disable high contrast', async () => {
      document.documentElement.classList.add('high-contrast');
      await setHighContrast(false);

      expect(document.documentElement.classList.contains('high-contrast')).toBe(false);
    });
  });

  describe('trapFocus', () => {
    it('should focus first focusable element', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="btn1">First</button>
        <a href="#" id="link1">Link</a>
        <button id="btn2">Last</button>
      `;
      document.body.appendChild(container);

      const cleanup = trapFocus(container);

      expect(document.activeElement.id).toBe('btn1');
      cleanup();
      container.remove();
    });

    it('should trap Tab at last element', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;
      document.body.appendChild(container);

      const cleanup = trapFocus(container);
      const lastBtn = container.querySelector('#last');
      lastBtn.focus();

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      container.dispatchEvent(event);

      // After tab on last element, should cycle to first
      expect(document.activeElement.id).toBe('first');

      cleanup();
      container.remove();
    });

    it('should trap Shift+Tab at first element', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;
      document.body.appendChild(container);

      const cleanup = trapFocus(container);
      const firstBtn = container.querySelector('#first');
      firstBtn.focus();

      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
      container.dispatchEvent(event);

      // After shift+tab on first element, should cycle to last
      expect(document.activeElement.id).toBe('last');

      cleanup();
      container.remove();
    });

    it('should return cleanup function that removes listener', () => {
      const container = document.createElement('div');
      container.innerHTML = '<button>Button</button>';
      document.body.appendChild(container);

      const cleanup = trapFocus(container);

      // Remove listener should not throw
      expect(() => cleanup()).not.toThrow();

      container.remove();
    });

    it('should handle empty container', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      expect(() => trapFocus(container)).not.toThrow();

      container.remove();
    });
  });

  describe('getAccessibilitySettings', () => {
    it('should return current accessibility settings', async () => {
      await storage.updateSettings({
        reducedMotion: true,
        colorblindMode: 'deuteranopia',
        highContrast: true
      });

      const settings = getAccessibilitySettings();

      expect(settings.reducedMotion).toBe(true);
      expect(settings.colorblindMode).toBe('deuteranopia');
      expect(settings.highContrast).toBe(true);
    });

    it('should default colorblindMode to none', () => {
      const settings = getAccessibilitySettings();
      expect(settings.colorblindMode).toBe('none');
    });

    it('should include system preferences', () => {
      const settings = getAccessibilitySettings();
      expect(settings.systemPreferences).toBeDefined();
      expect(typeof settings.systemPreferences.prefersReducedMotion).toBe('boolean');
      expect(typeof settings.systemPreferences.prefersHighContrast).toBe('boolean');
    });
  });

  describe('isReducedMotionEnabled', () => {
    it('should return true when setting is enabled', async () => {
      await storage.updateSettings({ reducedMotion: true });
      expect(isReducedMotionEnabled()).toBe(true);
    });

    it('should return false when setting is disabled and system prefers not', () => {
      expect(isReducedMotionEnabled()).toBe(false);
    });

    it('should return true when system prefers reduced motion', () => {
      mockMatchMedia.mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }));

      expect(isReducedMotionEnabled()).toBe(true);
    });
  });

  describe('isHighContrastEnabled', () => {
    it('should return true when setting is enabled', async () => {
      await storage.updateSettings({ highContrast: true });
      expect(isHighContrastEnabled()).toBe(true);
    });

    it('should return false when setting is disabled and system prefers not', () => {
      expect(isHighContrastEnabled()).toBe(false);
    });

    it('should return true when system prefers high contrast', () => {
      mockMatchMedia.mockImplementation((query) => ({
        matches: query === '(prefers-contrast: more)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }));

      expect(isHighContrastEnabled()).toBe(true);
    });
  });

  describe('applyAccessibilitySettings', () => {
    it('should apply reduced motion setting', () => {
      applyAccessibilitySettings({ reducedMotion: true });
      expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);

      applyAccessibilitySettings({ reducedMotion: false });
      expect(document.documentElement.classList.contains('reduced-motion')).toBe(false);
    });

    it('should apply high contrast setting', () => {
      applyAccessibilitySettings({ highContrast: true });
      expect(document.documentElement.classList.contains('high-contrast')).toBe(true);

      applyAccessibilitySettings({ highContrast: false });
      expect(document.documentElement.classList.contains('high-contrast')).toBe(false);
    });

    it('should apply colorblind mode setting', () => {
      applyAccessibilitySettings({ colorblindMode: 'deuteranopia' });
      expect(document.documentElement.classList.contains('colorblind-deuteranopia')).toBe(true);
    });

    it('should apply show patterns setting', () => {
      applyAccessibilitySettings({ showPatterns: true });
      expect(document.documentElement.classList.contains('colorblind-patterns')).toBe(true);

      applyAccessibilitySettings({ showPatterns: false });
      expect(document.documentElement.classList.contains('colorblind-patterns')).toBe(false);
    });

    it('should handle partial settings', () => {
      document.documentElement.classList.add('reduced-motion');
      applyAccessibilitySettings({ highContrast: true });

      expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
      expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
    });
  });
});
