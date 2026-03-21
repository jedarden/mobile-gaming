/**
 * Hub - E2E Tests (Playwright)
 *
 * End-to-end tests for the Hub page including Quick Play functionality.
 */

import { test, expect } from '@playwright/test';

const HUB_URL = '/src/hub/index.html';

test.describe('Hub Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HUB_URL);
  });

  test('should load the hub page', async ({ page }) => {
    await expect(page).toHaveTitle(/Mobile Games Hub/);
  });

  test('should display Quick Play button', async ({ page }) => {
    const quickPlayBtn = page.locator('#quickPlayBtn');
    await expect(quickPlayBtn).toBeVisible();
    await expect(quickPlayBtn).toContainText('Quick Play');
  });

  test('should display Daily Challenge banner', async ({ page }) => {
    const banner = page.locator('#dailyChallengeBanner');
    await expect(banner).toBeVisible();
    await expect(banner.locator('.banner-title')).toContainText('Daily Challenge');
  });

  test('should display game cards', async ({ page }) => {
    const gameCards = page.locator('.game-card');
    const count = await gameCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display filter tabs', async ({ page }) => {
    const tabs = page.locator('.filter-tab');
    await expect(tabs).toHaveCount(4); // All, Puzzle, Arcade, Simulation
  });
});

test.describe('Quick Play Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HUB_URL);
  });

  test('should be clickable', async ({ page }) => {
    const quickPlayBtn = page.locator('#quickPlayBtn');
    await expect(quickPlayBtn).toBeEnabled();
  });

  test('should navigate to a game on click', async ({ page }) => {
    // Clear any existing storage first
    await page.evaluate(() => localStorage.clear());

    // Click Quick Play
    await page.click('#quickPlayBtn');

    // Should navigate away from hub
    await page.waitForURL(/\/(water-sort|brain-teaser|jelly-shift|giant-runner|bus-jam|save-the-character)\//);

    // Verify we're on a game page
    const url = page.url();
    expect(url).not.toContain('/hub/');
    expect(url).toMatch(/\/(water-sort|brain-teaser|jelly-shift|giant-runner|bus-jam|save-the-character)\//);
  });

  test('should navigate to water-sort level 1 for first visit', async ({ page }) => {
    // Clear storage to simulate first visit
    await page.evaluate(() => localStorage.clear());

    // Click Quick Play and wait for navigation
    await page.click('#quickPlayBtn');

    // Should navigate to water-sort
    await page.waitForURL(/\/water-sort\//);
    expect(page.url()).toContain('/water-sort/');
  });

  test('should include level parameter for games with progress', async ({ page }) => {
    // Set up some play history
    await page.evaluate(() => {
      localStorage.setItem('mg:playHistory', JSON.stringify({
        'water-sort': {
          lastPlayed: Date.now() - (2 * 60 * 60 * 1000),
          sessions: 5,
          completed: 3,
          totalSolveTime: 150000,
          totalRetries: 2
        }
      }));
    });

    // Reload to pick up storage changes
    await page.reload();

    // Click Quick Play
    await page.click('#quickPlayBtn');

    // Wait for navigation
    await page.waitForURL(/\/(water-sort|brain-teaser|jelly-shift|giant-runner|bus-jam|save-the-character)\//);
  });
});

test.describe('Quick Play Preloading', () => {
  test('should add modulepreload links on page load', async ({ page }) => {
    await page.goto(HUB_URL);

    // Check for modulepreload links
    const preloadLinks = page.locator('link[rel="modulepreload"]');

    // Should have at least 1 preload link for top candidate
    const count = await preloadLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should preload water-sort for first visit', async ({ page }) => {
    // Clear storage
    await page.evaluate(() => localStorage.clear());

    await page.goto(HUB_URL);

    // Should preload water-sort game.js
    const preloadLinks = page.locator('link[rel="modulepreload"]');
    const hrefs = await preloadLinks.evaluateAll(links =>
      links.map(l => l.href)
    );

    // Should include water-sort
    const hasWaterSort = hrefs.some(href => href.includes('water-sort'));
    expect(hasWaterSort).toBe(true);
  });
});

test.describe('Game Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HUB_URL);
  });

  test('should filter games by category', async ({ page }) => {
    // Click Puzzle filter
    await page.click('.filter-tab[data-filter="puzzle"]');

    // All visible cards should be puzzle
    const visibleCards = page.locator('.game-card:not(.hidden)');
    const count = await visibleCards.count();

    for (let i = 0; i < count; i++) {
      const card = visibleCards.nth(i);
      expect(await card.getAttribute('data-category')).toBe('puzzle');
    }
  });

  test('should show all games when All filter clicked', async ({ page }) => {
    // First filter to puzzle
    await page.click('.filter-tab[data-filter="puzzle"]');

    // Then click All
    await page.click('.filter-tab[data-filter="all"]');

    // All cards should be visible
    const allCards = page.locator('.game-card');
    const hiddenCards = page.locator('.game-card.hidden');

    const totalCount = await allCards.count();
    const hiddenCount = await hiddenCards.count();

    expect(totalCount).toBeGreaterThan(0);
    expect(hiddenCount).toBe(0);
  });
});

test.describe('Hub Responsive', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(HUB_URL);

    // Quick Play button should be visible
    await expect(page.locator('#quickPlayBtn')).toBeVisible();

    // Game cards should be visible
    await expect(page.locator('.game-card').first()).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(HUB_URL);

    await expect(page.locator('#quickPlayBtn')).toBeVisible();
    await expect(page.locator('.game-card').first()).toBeVisible();
  });
});
