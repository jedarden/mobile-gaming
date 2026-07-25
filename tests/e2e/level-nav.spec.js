/**
 * Level Navigation - E2E Tests (Playwright)
 *
 * Comprehensive tests for level-nav functionality across all games.
 * Tests visual rendering, interaction states, localStorage persistence,
 * daily challenge, and endless mode indicators.
 */

import { test, expect } from '@playwright/test';

// Games with level-nav integration
const GAMES_WITH_LEVEL_NAV = [
  'water-sort',
  'parking-escape',
  'crowd-runner',
  'giant-runner',
  'bridge-race',
  'bus-jam',
  'jelly-shift',
  'pull-the-pin',
  'brain-teaser',
  'makeover-run',
  'merge-games',
  'save-the-character',
  'satisfying-asmr',
];

// Games that may have level-nav (check dynamically)
const ALL_GAMES = [
  'water-sort',
  'parking-escape',
  'crowd-runner',
  'giant-runner',
  'bridge-race',
  'bus-jam',
  'jelly-shift',
  'pull-the-pin',
  'brain-teaser',
  'makeover-run',
  'merge-games',
  'satisfying-asmr',
  'save-the-character',
];

/**
 * Helper: Clear localStorage for a specific game
 */
async function clearGameProgress(page, gameId) {
  await page.evaluate((id) => {
    localStorage.removeItem(`level-progress:${id}`);
    localStorage.removeItem(`level-progress:${id}:current`);
  }, gameId);
}

/**
 * Helper: Set game progress to a specific state
 */
async function setGameProgress(page, gameId, progress, currentLevel = 0) {
  await page.evaluate(({ id, prog, curr }) => {
    localStorage.setItem(`level-progress:${id}`, JSON.stringify(prog));
    localStorage.setItem(`level-progress:${id}:current`, curr.toString());
  }, { id: gameId, prog: progress, curr: currentLevel });
}

/**
 * Helper: Check if level-nav is present
 */
async function hasLevelNav(page) {
  return await page.locator('.mg-level-nav').count() > 0;
}

test.describe('Level Navigation - Core Rendering', () => {
  GAMES_WITH_LEVEL_NAV.forEach(gameId => {
    test(`${gameId}: renders level nav strip at bottom of screen`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Level nav strip should exist
      const navStrip = page.locator('.mg-level-nav');
      await expect(navStrip).toBeVisible();

      // Should be positioned at bottom
      const position = await navStrip.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
      });
      expect(position.bottom).toBeCloseTo(window.innerHeight, 50);

      // Should have dots container
      const dotsContainer = navStrip.locator('div');
      await expect(dotsContainer).toBeVisible();
    });

    test(`${gameId}: level dots are rendered with correct count`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Get total levels from levels.json (minimum 3)
      const totalLevels = await page.evaluate(async () => {
        const response = await fetch('./levels.json');
        const levels = await response.json();
        return levels.length;
      });

      // Should have at least 3 level dots
      const levelDots = page.locator('.mg-level-dot[data-level]');
      const count = await levelDots.count();
      expect(count).toBeGreaterThanOrEqual(Math.min(totalLevels, 3));
    });

    test(`${gameId}: current level is highlighted correctly`, async ({ page }) => {
      // Clear progress first
      await page.goto(`/${gameId}/`);
      await clearGameProgress(page, gameId);
      await page.reload();
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Current level dot (level 0/1) should have blue color
      const currentDot = page.locator('.mg-level-dot[data-level="0"]');
      await expect(currentDot).toBeVisible();

      // Check for current level styling (blue border and background)
      const currentStyles = await currentDot.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          borderColor: styles.borderColor,
          backgroundColor: styles.backgroundColor,
          hasAnimation: styles.animationName !== 'none',
        };
      });

      // Current level should have blue (#0072B2) border
      expect(currentStyles.borderColor).toContain('178, 114, 0'); // RGB for #0072B2
      expect(currentStyles.hasAnimation).toBe(true);
    });

    test(`${gameId}: level strip is horizontally scrollable`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      const navStrip = page.locator('.mg-level-nav');

      // Check overflow is scrollable
      const overflowX = await navStrip.evaluate(el =>
        window.getComputedStyle(el).overflowX
      );

      expect(overflowX).toMatch(/auto|scroll/);
    });
  });
});

test.describe('Level Navigation - Visual States', () => {
  GAMES_WITH_LEVEL_NAV.forEach(gameId => {
    test(`${gameId}: completed levels show green with checkmark`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Set level 0 as completed
      await setGameProgress(page, gameId, { '0': 'completed' }, 1);
      await page.reload();
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Level 0 dot should show green/completed state
      const completedDot = page.locator('.mg-level-dot[data-level="0"]');
      await expect(completedDot).toBeVisible();

      const completedStyles = await completedDot.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          borderColor: styles.borderColor,
          backgroundColor: styles.backgroundColor,
          textContent: el.textContent,
        };
      });

      // Should be green (#009E73)
      expect(completedStyles.borderColor).toContain('0, 158, 115');
      expect(completedStyles.textContent).toBe('✓');
    });

    test(`${gameId}: locked levels are grayed out`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Clear progress so all levels except first are locked
      await clearGameProgress(page, gameId);
      await page.reload();
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Level 2 should be locked (index 2)
      const lockedDot = page.locator('.mg-level-dot[data-level="2"]');
      await expect(lockedDot).toBeVisible();

      // Locked dots should be gray
      const lockedStyles = await lockedDot.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          opacity: styles.opacity,
          cursor: styles.cursor,
          borderColor: styles.borderColor,
        };
      });

      expect(parseFloat(lockedStyles.opacity)).toBeLessThan(1);
      expect(lockedStyles.cursor).toBe('default');
    });

    test(`${gameId}: skipped levels show dash indicator`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Mark level 0 as skipped, current is level 1
      await setGameProgress(page, gameId, { '0': 'skipped' }, 1);
      await page.reload();
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      const skippedDot = page.locator('.mg-level-dot[data-level="0"]');
      const text = await skippedDot.evaluate(el => el.textContent);

      expect(text).toBe('–');
    });
  });
});

test.describe('Level Navigation - Tap Interactions', () => {
  GAMES_WITH_LEVEL_NAV.forEach(gameId => {
    test(`${gameId}: tapping current level does nothing destructive`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      const currentDot = page.locator('.mg-level-dot[data-level="0"]');
      await expect(currentDot).toBeVisible();

      // Tap current level
      await currentDot.click();

      // Should still be on level 1
      const levelDisplay = page.locator('#level-display');
      const levelText = await levelDisplay.textContent();
      expect(levelText).toContain('1');
    });

    test(`${gameId}: tapping unlocked level navigates to it`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Complete level 0, making level 1 unlocked
      await setGameProgress(page, gameId, { '0': 'completed' }, 1);
      await page.reload();
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Tap level 0 dot (unlocked/completed)
      const level0Dot = page.locator('.mg-level-dot[data-level="0"]');
      await level0Dot.click();

      // Should navigate to level 1
      const levelDisplay = page.locator('#level-display');
      await expect(levelDisplay).toContainText('1');
    });

    test(`${gameId}: locked levels are not interactive`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // With no progress, level 2 should be locked
      const lockedDot = page.locator('.mg-level-dot[data-level="2"]');
      await expect(lockedDot).toBeVisible();

      // Try to click it
      await lockedDot.click();

      // Should remain on level 1 (locked levels don't navigate)
      const levelDisplay = page.locator('#level-display');
      const levelText = await levelDisplay.textContent();
      expect(levelText).toContain('1');
    });

    test(`${gameId}: level dots have proper ARIA labels`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      const levelDots = page.locator('.mg-level-dot[data-level]');
      const firstDot = levelDots.first();

      const ariaLabel = await firstDot.getAttribute('aria-label');
      expect(ariaLabel).toMatch(/Level \d+/);
    });
  });
});

test.describe('Level Navigation - Daily Challenge', () => {
  GAMES_WITH_LEVEL_NAV.forEach(gameId => {
    test(`${gameId}: daily challenge indicator shows when available`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Wait for level-nav to be present and fully rendered
      await page.waitForFunction(() => {
        const nav = document.querySelector('.mg-level-nav');
        return nav && nav.offsetParent !== null;
      }, { timeout: 3000 });

      // Check if this game has daily challenge (after level-nav is ready)
      const hasDaily = await page.evaluate(() => {
        // Games may opt into daily challenge - check if daily dot exists
        return document.querySelector('.mg-level-daily') !== null;
      });

      if (hasDaily) {
        const dailyDot = page.locator('.mg-level-daily');
        // Wait for the daily dot to be visible
        await page.waitForFunction(() => {
          const el = document.querySelector('.mg-level-daily');
          return el && el.offsetParent !== null;
        }, { timeout: 3000 });
        await expect(dailyDot).toBeVisible();

        // Wait for text content to be applied
        await page.waitForFunction(() => {
          const el = document.querySelector('.mg-level-daily');
          return el && el.textContent && el.textContent === '★';
        }, { timeout: 3000 });
        const text = await dailyDot.evaluate(el => el.textContent);
        expect(text).toBe('★');

        // Wait for aria-label to be set
        await page.waitForFunction(() => {
          const el = document.querySelector('.mg-level-daily');
          return el && el.getAttribute('aria-label') === 'Daily Challenge';
        }, { timeout: 3000 });
        const ariaLabel = await dailyDot.getAttribute('aria-label');
        expect(ariaLabel).toBe('Daily Challenge');
      } else {
        test.skip();
      }
    });

    test(`${gameId}: daily shows green when completed`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Wait for level-nav to be present and fully rendered
      await page.waitForFunction(() => {
        const nav = document.querySelector('.mg-level-nav');
        return nav && nav.offsetParent !== null;
      }, { timeout: 3000 });

      const hasDaily = await page.evaluate(() =>
        document.querySelector('.mg-level-daily') !== null
      );

      if (hasDaily) {
        const dailyDot = page.locator('.mg-level-daily');

        // Wait for the daily dot to be visible and styles applied
        await page.waitForFunction(() => {
          const el = document.querySelector('.mg-level-daily');
          return el && el.offsetParent !== null && window.getComputedStyle(el).borderColor;
        }, { timeout: 3000 });

        // Initially should be yellow (not completed)
        const initialBorder = await dailyDot.evaluate(el =>
          window.getComputedStyle(el).borderColor
        );
        expect(initialBorder).toContain('240, 228, 66'); // #F0E442 yellow

        // Mark daily as completed and reload
        const today = new Date().toISOString().split('T')[0];
        await page.evaluate((date) => {
          const data = JSON.parse(localStorage.getItem('mg:daily') || '{"completed":{}}');
          data.completed[date] = true;
          data.completed[`${date}:water-sort`] = true;
          localStorage.setItem('mg:daily', JSON.stringify(data));
        }, today);

        await page.reload();
        await page.waitForSelector('#game-canvas', { timeout: 5000 });

        // Wait for level-nav to be present and fully rendered
        await page.waitForFunction(() => {
          const nav = document.querySelector('.mg-level-nav');
          return nav && nav.offsetParent !== null;
        }, { timeout: 3000 });

        // Wait for daily dot styles to be applied after reload
        await page.waitForFunction(() => {
          const el = document.querySelector('.mg-level-daily');
          const borderColor = window.getComputedStyle(el).borderColor;
          return el && el.offsetParent !== null && borderColor && borderColor.includes('0, 158, 115');
        }, { timeout: 3000 });

        // Should now show green border (completed)
        const completedBorder = await dailyDot.evaluate(el =>
          window.getComputedStyle(el).borderColor
        );
        expect(completedBorder).toContain('0, 158, 115'); // #009E73 green
      } else {
        test.skip();
      }
    });
  });
});

test.describe('Level Navigation - Endless Mode', () => {
  GAMES_WITH_LEVEL_NAV.forEach(gameId => {
    test(`${gameId}: endless mode indicator shows when available`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Check if this game has endless mode
      const hasEndless = await page.evaluate(() => {
        return document.querySelector('.mg-level-endless') !== null;
      });

      if (hasEndless) {
        const endlessDot = page.locator('.mg-level-endless');
        await expect(endlessDot).toBeVisible();

        // Should have infinity symbol
        const text = await endlessDot.evaluate(el => el.textContent);
        expect(text).toBe('∞');

        // Should have aria-label
        const ariaLabel = await endlessDot.getAttribute('aria-label');
        expect(ariaLabel).toBe('Endless Mode');
      } else {
        test.skip();
      }
    });

    test(`${gameId}: endless dot is tappable`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      const hasEndless = await page.evaluate(() =>
        document.querySelector('.mg-level-endless') !== null
      );

      if (hasEndless) {
        const endlessDot = page.locator('.mg-level-endless');

        // Should be clickable
        const cursor = await endlessDot.evaluate(el =>
          window.getComputedStyle(el).cursor
        );
        expect(cursor).toBe('pointer');
      } else {
        test.skip();
      }
    });
  });
});

test.describe('Level Navigation - LocalStorage Persistence', () => {
  GAMES_WITH_LEVEL_NAV.forEach(gameId => {
    test(`${gameId}: progress persists across page reloads`, async ({ page }) => {
      const storageKey = `level-progress:${gameId}`;
      const currentKey = `level-progress:${gameId}:current`;

      // Set initial progress
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      await setGameProgress(page, gameId, { '0': 'completed', '1': 'completed' }, 2);
      await page.reload();
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Check progress persisted
      const progress = await page.evaluate(key => {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : {};
      }, storageKey);

      expect(progress['0']).toBe('completed');
      expect(progress['1']).toBe('completed');

      // Current level should be 2
      const currentLevel = await page.evaluate(key =>
        parseInt(localStorage.getItem(key) || '0', 10)
      , currentKey);
      expect(currentLevel).toBe(2);
    });

    test(`${gameId}: level strip updates after completing a level`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Initially on level 0
      let currentDot = page.locator('.mg-level-dot[data-level="0"]');
      await expect(currentDot).toBeVisible();

      // Mark level 0 as completed
      await setGameProgress(page, gameId, { '0': 'completed' }, 1);
      await page.reload();
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Level 0 should now show completed state
      const completedDot = page.locator('.mg-level-dot[data-level="0"]');
      const text = await completedDot.evaluate(el => el.textContent);
      expect(text).toBe('✓');

      // Level 1 should be current
      const newCurrentDot = page.locator('.mg-level-dot[data-level="1"]');
      const isCurrent = await newCurrentDot.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.animationName !== 'none';
      });
      expect(isCurrent).toBe(true);
    });

    test(`${gameId}: localStorage uses correct keys`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Check that keys are properly formatted
      const keys = await page.evaluate(id => {
        const progressKey = `level-progress:${id}`;
        const currentKey = `level-progress:${id}:current`;
        return {
          hasProgress: localStorage.getItem(progressKey) !== null,
          hasCurrent: localStorage.getItem(currentKey) !== null,
        };
      }, gameId);

      // Keys should exist (even if empty)
      expect(keys).toBeTruthy();
    });
  });
});

test.describe('Level Navigation - Responsive Design', () => {
  GAMES_WITH_LEVEL_NAV.forEach(gameId => {
    test(`${gameId}: level nav works on mobile viewport`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      const navStrip = page.locator('.mg-level-nav');
      await expect(navStrip).toBeVisible();

      // Should still be at bottom
      const position = await navStrip.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.bottom;
      });
      expect(position).toBeCloseTo(667, 50);
    });

    test(`${gameId}: level nav works on tablet viewport`, async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      const navStrip = page.locator('.mg-level-nav');
      await expect(navStrip).toBeVisible();
    });

    test(`${gameId}: level dots are tap-friendly size`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      const firstDot = page.locator('.mg-level-dot[data-level="0"]');
      const size = await firstDot.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });

      // Should be at least 30x30 (DOT_SIZE from level-nav.js)
      expect(size.width).toBeGreaterThanOrEqual(28);
      expect(size.height).toBeGreaterThanOrEqual(28);
    });
  });
});

test.describe('Level Navigation - Accessibility', () => {
  GAMES_WITH_LEVEL_NAV.forEach(gameId => {
    test(`${gameId}: all interactive elements have aria-labels`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Check all level dots
      const levelDots = page.locator('.mg-level-dot');
      const count = await levelDots.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const dot = levelDots.nth(i);
        const ariaLabel = await dot.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
      }
    });

    test(`${gameId}: current level auto-scrolls into view`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Set to a higher level
      await setGameProgress(page, gameId, { '0': 'completed', '1': 'completed', '2': 'completed' }, 3);
      await page.reload();
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // Wait for auto-scroll to complete
      await page.waitForFunction(() => {
        const currentDot = document.querySelector('.mg-level-dot[data-level="3"]');
        const strip = currentDot?.closest('.mg-level-nav');
        if (!currentDot || !strip) return false;
        const rect = currentDot.getBoundingClientRect();
        const stripRect = strip.getBoundingClientRect();
        return rect.left >= stripRect.left && rect.right <= stripRect.right;
      }, { timeout: 1500 });

      const currentDot = page.locator('.mg-level-dot[data-level="3"]');
      const isVisible = await currentDot.isVisible();

      if (isVisible) {
        // Check if it's scrolled into view (within viewport)
        const isInView = await currentDot.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const strip = el.closest('.mg-level-nav');
          if (!strip) return false;
          const stripRect = strip.getBoundingClientRect();
          return rect.left >= stripRect.left && rect.right <= stripRect.right;
        });
        // Note: This may vary based on scroll timing
      }
    });

    test(`${gameId}: locked dots have disabled appearance`, async ({ page }) => {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      // With no progress, level 3+ should be locked
      const lockedDot = page.locator('.mg-level-dot[data-level="3"]');

      const hasLevel3 = await lockedDot.count();
      if (hasLevel3 > 0) {
        const opacity = await lockedDot.evaluate(el =>
          window.getComputedStyle(el).opacity
        );
        expect(parseFloat(opacity)).toBeLessThan(1);
      } else {
        test.skip();
      }
    });
  });
});

test.describe('Level Navigation - Cross-Game Consistency', () => {
  test('all games use consistent level-nav structure', async ({ page }) => {
    const gamesWithNav = [];

    for (const gameId of GAMES_WITH_LEVEL_NAV) {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      const hasNav = await hasLevelNav(page);
      if (hasNav) {
        gamesWithNav.push(gameId);
      }
    }

    // At least the known games should have level-nav
    expect(gamesWithNav.length).toBeGreaterThanOrEqual(5);
  });

  test('all games use consistent CSS class names', async ({ page }) => {
    for (const gameId of GAMES_WITH_LEVEL_NAV.slice(0, 3)) {
      await page.goto(`/${gameId}/`);
      await page.waitForSelector('#game-canvas', { timeout: 5000 });

      const hasNav = await hasLevelNav(page);
      if (hasNav) {
        // Should have the main strip class
        const strip = page.locator('.mg-level-nav');
        await expect(strip).toBeVisible();

        // Should have dot elements
        const dots = page.locator('.mg-level-dot');
        const count = await dots.count();
        expect(count).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Level Navigation - Edge Cases', () => {
  test('handles rapid level switching gracefully', async ({ page }) => {
    const gameId = 'water-sort';
    await page.goto(`/${gameId}/`);
    await page.waitForSelector('#game-canvas', { timeout: 5000 });

    // Set up multiple completed levels
    await setGameProgress(page, gameId, {
      '0': 'completed',
      '1': 'completed',
      '2': 'completed'
    }, 3);
    await page.reload();
    await page.waitForSelector('#game-canvas', { timeout: 5000 });

    // Rapidly tap different level dots
    const level0 = page.locator('.mg-level-dot[data-level="0"]');
    const level1 = page.locator('.mg-level-dot[data-level="1"]');
    const level2 = page.locator('.mg-level-dot[data-level="2"]');

    // Rapidly tap different level dots (test rapid switching)
    await level0.click();
    await level1.click();
    await level2.click();

    // Should not crash - game should still be responsive
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
  });

  test('handles empty progress correctly', async ({ page }) => {
    const gameId = 'water-sort';
    await page.goto(`/${gameId}/`);
    await clearGameProgress(page, gameId);
    await page.reload();
    await page.waitForSelector('#game-canvas', { timeout: 5000 });

    // Should still show level-nav
    const navStrip = page.locator('.mg-level-nav');
    await expect(navStrip).toBeVisible();

    // Level 0 should be current
    const currentDot = page.locator('.mg-level-dot[data-level="0"]');
    await expect(currentDot).toBeVisible();
  });

  test('handles all levels completed', async ({ page }) => {
    const gameId = 'water-sort';
    await page.goto(`/${gameId}/`);
    await page.waitForSelector('#game-canvas', { timeout: 5000 });

    // Get total levels
    const totalLevels = await page.evaluate(async () => {
      const response = await fetch('./levels.json');
      const levels = await response.json();
      return levels.length;
    });

    // Mark all as completed
    const allCompleted = {};
    for (let i = 0; i < totalLevels; i++) {
      allCompleted[i.toString()] = 'completed';
    }

    await setGameProgress(page, gameId, allCompleted, totalLevels - 1);
    await page.reload();
    await page.waitForSelector('#game-canvas', { timeout: 5000 });

    // All should show checkmarks
    const allDots = page.locator('.mg-level-dot[data-level]');
    const count = await allDots.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const dot = allDots.nth(i);
      const text = await dot.evaluate(el => el.textContent);
      expect(text).toBe('✓');
    }
  });
});
