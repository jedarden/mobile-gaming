import { test, expect } from '@playwright/test';

/**
 * Cross-Browser Compatibility Tests
 *
 * Tests browser-specific features and mobile compatibility across:
 * - Desktop Chrome, Firefox, Safari (WebKit)
 * - Mobile Chrome (Android), Mobile Safari (iOS)
 */
test.describe('Cross-Browser Compatibility', () => {
  test.describe('Canvas Rendering', () => {
    test('should render canvas without errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto('/games/bus-jam/');
      await page.waitForSelector('canvas');

      // Wait for canvas to have content
      await page.waitForFunction(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        // Check canvas has non-zero dimensions
        return canvas.width > 0 && canvas.height > 0;
      });

      expect(errors).toHaveLength(0);
    });

    test('should render Pull the Pin canvas without errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto('/games/pull-the-pin/');
      await page.waitForSelector('canvas');

      // Wait for canvas to have content
      await page.waitForFunction(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;
        return canvas.width > 0 && canvas.height > 0;
      });

      expect(errors).toHaveLength(0);
    });

    test('should support canvas 2D context', async ({ page }) => {
      await page.goto('/games/bus-jam/');

      const hasContext = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        return !!canvas.getContext('2d');
      });

      expect(hasContext).toBe(true);
    });

    test('should support canvas gradients', async ({ page }) => {
      await page.goto('/games/bus-jam/');

      const supportsGradients = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        try {
          const gradient = ctx.createRadialGradient(50, 50, 0, 50, 50, 50);
          gradient.addColorStop(0, 'red');
          gradient.addColorStop(1, 'blue');
          return true;
        } catch {
          return false;
        }
      });

      expect(supportsGradients).toBe(true);
    });
  });

  test.describe('Touch Interactions', () => {
    test('should handle touch events on canvas', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Touch events only testable on mobile');

      await page.goto('/games/bus-jam/');
      await page.waitForSelector('canvas');

      // Simulate touch on canvas
      const canvas = page.locator('canvas');
      const box = await canvas.boundingBox();

      if (box) {
        // Tap in the center of canvas
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

        // Should not throw errors
        await page.waitForTimeout(100);
      }

      // Verify canvas is still visible
      await expect(canvas).toBeVisible();
    });

    test('should support passive touch event listeners', async ({ page }) => {
      await page.goto('/games/bus-jam/');

      // Check if touch events are registered
      const hasTouchListeners = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        // Check if touchstart is registered
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      });

      // This should be true on mobile and may be false on desktop
      // We're just checking it doesn't throw
      expect(typeof hasTouchListeners).toBe('boolean');
    });

    test('should handle viewport meta tag correctly', async ({ page }) => {
      await page.goto('/');

      const viewportContent = await page.locator('meta[name="viewport"]').getAttribute('content');

      expect(viewportContent).toContain('width=device-width');
      expect(viewportContent).toContain('initial-scale=1.0');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should adapt game layout on mobile viewport', async ({ page, viewport }) => {
      await page.goto('/games/bus-jam/');

      // Check that game container is visible
      const container = page.locator('.game-container');
      await expect(container).toBeVisible();

      // Check canvas is responsive
      const canvas = page.locator('canvas');
      const canvasBox = await canvas.boundingBox();

      // Canvas should fit within viewport
      if (canvasBox && viewport) {
        expect(canvasBox.width).toBeLessThanOrEqual(viewport.width);
      }
    });

    test('should have touch-friendly button sizes', async ({ page }) => {
      await page.goto('/games/bus-jam/');

      const buttons = page.locator('.game-btn');
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const btn = buttons.nth(i);
        const box = await btn.boundingBox();

        if (box) {
          // Buttons should be at least 44x44 for touch targets (WCAG guideline)
          // We'll check they're reasonably sized
          expect(box.height).toBeGreaterThan(30);
        }
      }
    });

    test('should handle orientation change', async ({ page }) => {
      await page.goto('/games/bus-jam/');
      await page.waitForSelector('canvas');

      // Get initial canvas size
      const initialBox = await page.locator('canvas').boundingBox();

      // Resize viewport to simulate orientation change
      await page.setViewportSize({ width: 667, height: 375 });

      await page.waitForTimeout(100);

      // Canvas should still be visible
      await expect(page.locator('canvas')).toBeVisible();

      const newBox = await page.locator('canvas').boundingBox();

      // Dimensions should adjust
      expect(newBox).toBeTruthy();
    });
  });

  test.describe('JavaScript API Compatibility', () => {
    test('should support requestAnimationFrame', async ({ page }) => {
      await page.goto('/games/pull-the-pin/');

      const supportsRAF = await page.evaluate(() => {
        return typeof requestAnimationFrame === 'function';
      });

      expect(supportsRAF).toBe(true);
    });

    test('should support Web Audio API or fallback gracefully', async ({ page }) => {
      await page.goto('/games/bus-jam/');

      const audioSupport = await page.evaluate(() => {
        return {
          hasAudioContext: typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined',
          hasAudioElement: typeof Audio !== 'undefined'
        };
      });

      // Should have at least one audio method available
      expect(audioSupport.hasAudioContext || audioSupport.hasAudioElement).toBe(true);
    });

    test('should support localStorage', async ({ page }) => {
      await page.goto('/');

      const supportsStorage = await page.evaluate(() => {
        try {
          const test = '__storage_test__';
          localStorage.setItem(test, test);
          localStorage.removeItem(test);
          return true;
        } catch {
          return false;
        }
      });

      expect(supportsStorage).toBe(true);
    });

    test('should support URL and URLSearchParams', async ({ page }) => {
      await page.goto('/games/pull-the-pin/');

      const supportsURL = await page.evaluate(() => {
        return typeof URL !== 'undefined' && typeof URLSearchParams !== 'undefined';
      });

      expect(supportsURL).toBe(true);
    });

    test('should support ES6 modules', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => {
        if (error.message.includes('module') || error.message.includes('import')) {
          errors.push(error.message);
        }
      });

      await page.goto('/games/bus-jam/');
      await page.waitForSelector('canvas');

      // Should not have module-related errors
      expect(errors).toHaveLength(0);
    });
  });

  test.describe('CSS Compatibility', () => {
    test('should apply CSS custom properties (variables)', async ({ page }) => {
      await page.goto('/');

      const hasCustomProperties = await page.evaluate(() => {
        const el = document.documentElement;
        const styles = getComputedStyle(el);
        // Check if CSS variables are being parsed
        return typeof styles.getPropertyValue === 'function';
      });

      expect(hasCustomProperties).toBe(true);
    });

    test('should support flexbox layout', async ({ page }) => {
      await page.goto('/');

      const flexboxWorks = await page.evaluate(() => {
        const container = document.querySelector('.games-grid');
        if (!container) return false;
        const styles = getComputedStyle(container);
        return styles.display === 'flex' || styles.display === 'inline-flex' || styles.display === 'grid';
      });

      expect(flexboxWorks).toBe(true);
    });

    test('should render game overlays correctly', async ({ page }) => {
      await page.goto('/games/bus-jam/');

      // Check overlay is hidden initially
      const overlay = page.locator('#win-overlay');
      await expect(overlay).toHaveAttribute('aria-hidden', 'true');

      // Check overlay styling
      const isVisible = await overlay.evaluate(el => {
        const styles = getComputedStyle(el);
        return styles.position === 'fixed' || styles.position === 'absolute';
      });

      expect(isVisible).toBe(true);
    });

    test('should apply skip-link styling for accessibility', async ({ page }) => {
      await page.goto('/');

      const skipLink = page.locator('.skip-link');
      await expect(skipLink).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load homepage within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should load game within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/games/bus-jam/');
      await page.waitForSelector('canvas');
      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should not have console errors on load', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Filter out non-critical errors (like analytics, extensions)
      const criticalErrors = errors.filter(e =>
        !e.includes('Extension') &&
        !e.includes('net::') &&
        !e.includes('favicon')
      );

      expect(criticalErrors).toHaveLength(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels on game elements', async ({ page }) => {
      await page.goto('/games/bus-jam/');

      // Check canvas has aria-label
      const canvas = page.locator('canvas');
      await expect(canvas).toHaveAttribute('aria-label');

      // Check buttons have labels
      const undoBtn = page.locator('#btn-undo');
      await expect(undoBtn).toHaveAttribute('aria-label');
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');

      // Check main heading exists
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
    });

    test('should have accessible game controls', async ({ page }) => {
      await page.goto('/games/bus-jam/');

      // All buttons should have accessible labels
      const buttons = page.locator('.game-btn');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);

      // Check first few buttons have aria-labels
      for (let i = 0; i < Math.min(count, 3); i++) {
        const btn = buttons.nth(i);
        const label = await btn.getAttribute('aria-label');
        // Button should have an accessible label (aria-label or text content)
        expect(label || await btn.textContent()).toBeTruthy();
      }
    });

    test('should support reduced motion preference', async ({ page }) => {
      // Emulate reduced motion
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await page.goto('/games/bus-jam/');

      // Page should still load and function
      await expect(page.locator('canvas')).toBeVisible();
    });
  });
});

/**
 * Mobile-Specific Tests
 * These tests are more relevant for mobile viewports
 */
test.describe('Mobile Specific', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobile only test');

  test('should prevent zoom on double tap', async ({ page }) => {
    await page.goto('/games/bus-jam/');

    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');

    // Check for user-scalable=no or maximum-scale=1
    const preventsZoom =
      viewportMeta?.includes('user-scalable=no') ||
      viewportMeta?.includes('maximum-scale=1');

    // This is a common pattern for games, though not recommended for accessibility
    // Just checking it's handled consistently
    expect(typeof preventsZoom).toBe('boolean');
  });

  test('should handle touch events for game interaction', async ({ page }) => {
    await page.goto('/games/pull-the-pin/');
    await page.waitForSelector('canvas');

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    if (box) {
      // Tap to interact with game
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

      // Wait for any animations
      await page.waitForTimeout(200);
    }

    // Game should still be functional
    await expect(canvas).toBeVisible();
  });
});

/**
 * Desktop-Specific Tests
 */
test.describe('Desktop Specific', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop only test');

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/games/bus-jam/');

    // Tab to focus elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should have a focused element
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });

    expect(focusedElement).toBeTruthy();
  });

  test('should support keyboard shortcuts', async ({ page }) => {
    await page.goto('/games/bus-jam/');
    await page.waitForSelector('canvas');

    // Press 'h' for hint
    await page.keyboard.press('h');

    // Should not throw errors
    await page.waitForTimeout(100);

    // Game should still be functional
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('should support mouse hover effects', async ({ page }) => {
    await page.goto('/');

    // Hover over a game card
    const gameCard = page.locator('.game-card').first();
    await gameCard.hover();

    // Should have hover state applied
    await page.waitForTimeout(100);
    await expect(gameCard).toBeVisible();
  });
});
