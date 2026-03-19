/**
 * Accessibility - Screen reader and motion preference support
 *
 * Provides utilities for:
 * - Screen reader announcements via ARIA live regions
 * - Reduced motion preference detection
 * - Focus management
 *
 * Usage:
 *   initAccessibility(); // Call once on app init
 *   announce('Level complete!');
 *   if (isReducedMotionEnabled()) { ... }
 */

let liveRegion = null;
let politeRegion = null;

/**
 * Initialize accessibility features
 * Creates ARIA live regions for announcements
 */
export function initAccessibility() {
  // Create assertive live region for important announcements
  if (!document.getElementById('aria-live-assertive')) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'aria-live-assertive';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'assertive');
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
  } else {
    liveRegion = document.getElementById('aria-live-assertive');
  }

  // Create polite live region for less urgent announcements
  if (!document.getElementById('aria-live-polite')) {
    politeRegion = document.createElement('div');
    politeRegion.id = 'aria-live-polite';
    politeRegion.setAttribute('role', 'status');
    politeRegion.setAttribute('aria-live', 'polite');
    politeRegion.setAttribute('aria-atomic', 'true');
    politeRegion.className = 'sr-only';
    politeRegion.style.cssText = `
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
    document.body.appendChild(politeRegion);
  } else {
    politeRegion = document.getElementById('aria-live-polite');
  }
}

/**
 * Announce a message to screen readers
 * @param {string} message - Message to announce
 * @param {string} priority - 'assertive' or 'polite' (default: 'assertive')
 */
export function announce(message, priority = 'assertive') {
  const region = priority === 'polite' ? politeRegion : liveRegion;

  if (!region) {
    // Initialize if not already done
    initAccessibility();
  }

  const targetRegion = priority === 'polite' ? politeRegion : liveRegion;
  if (!targetRegion) return;

  // Clear and set message (this triggers the announcement)
  targetRegion.textContent = '';

  // Use setTimeout to ensure the screen reader picks up the change
  setTimeout(() => {
    targetRegion.textContent = message;
  }, 50);
}

/**
 * Check if user prefers reduced motion
 * @returns {boolean}
 */
export function isReducedMotionEnabled() {
  // Check localStorage override first
  try {
    const stored = localStorage.getItem('mg:settings');
    if (stored) {
      const settings = JSON.parse(stored);
      if (settings.reducedMotionSetByUser) {
        return settings.reducedMotion;
      }
    }
  } catch {
    // Ignore storage errors
  }

  // Fall back to media query
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Listen for reduced motion preference changes
 * @param {function(boolean)} callback - Called when preference changes
 * @returns {function} Unsubscribe function
 */
export function onReducedMotionChange(callback) {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const handler = (e) => {
    // Only fire if user hasn't set manual override
    try {
      const stored = localStorage.getItem('mg:settings');
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.reducedMotionSetByUser) {
          return; // User has manual override, ignore system change
        }
      }
    } catch {
      // Ignore storage errors
    }

    callback(e.matches);
  };

  mediaQuery.addEventListener('change', handler);

  return () => mediaQuery.removeEventListener('change', handler);
}

/**
 * Focus an element and optionally announce it
 * @param {HTMLElement|string} element - Element or selector to focus
 * @param {string} [announcement] - Optional announcement
 */
export function focusElement(element, announcement = null) {
  const el = typeof element === 'string'
    ? document.querySelector(element)
    : element;

  if (!el) return;

  // Ensure element is focusable
  if (!el.hasAttribute('tabindex') && !el.matches('button, [href], input, select, textarea, [contenteditable]')) {
    el.setAttribute('tabindex', '-1');
  }

  el.focus();

  if (announcement) {
    announce(announcement, 'polite');
  }
}

/**
 * Trap focus within a container (for modals/dialogs)
 * @param {HTMLElement} container - Container to trap focus within
 * @returns {function} Cleanup function to remove trap
 */
export function trapFocus(container) {
  const focusableSelector = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  const focusableElements = container.querySelectorAll(focusableSelector);
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  function handleKeyDown(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown);

  // Focus first element
  if (firstFocusable) {
    firstFocusable.focus();
  }

  return () => container.removeEventListener('keydown', handleKeyDown);
}

export default {
  initAccessibility,
  announce,
  isReducedMotionEnabled,
  onReducedMotionChange,
  focusElement,
  trapFocus
};
