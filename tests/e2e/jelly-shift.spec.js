/**
 * Jelly Shift - E2E Tests (Playwright)
 *
 * End-to-end tests for Jelly Shift game UI.
 */

import { test, expect } from '@playwright/test';

const GAME_URL = '/src/games/jelly-shift/index.html';

test.describe('Jelly Shift Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    // Wait for Three.js canvas to render
    await page.waitForSelector('#game-container canvas', { timeout: 10000 });
  });

  test('should load the game page', async ({ page }) => {
    await expect(page).toHaveTitle(/Jelly Shift/);
    await expect(page.locator('h1')).toContainText('Jelly Shift');
  });

  test('should display initial stats', async ({ page }) => {
    await expect(page.locator('#score-display')).toContainText('0');
    await expect(page.locator('#speed-display')).toContainText('2.0');
    await expect(page.locator('#level-progress')).toContainText('Level 1');
  });

  test('should render Three.js canvas', async ({ page }) => {
    const canvas = page.locator('#game-container canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('should have navigation buttons', async ({ page }) => {
    await expect(page.locator('#btn-restart')).toBeVisible();
    await expect(page.locator('#btn-prev')).toBeVisible();
    await expect(page.locator('#btn-next')).toBeVisible();
  });

  test('should disable prev button on first level', async ({ page }) => {
    await expect(page.locator('#btn-prev')).toBeDisabled();
  });

  test('should show settings overlay', async ({ page }) => {
    await page.locator('#btn-settings').click();

    const overlay = page.locator('#settings-overlay');
    await expect(overlay).toHaveAttribute('aria-hidden', 'false');

    await expect(page.locator('#setting-sound')).toBeVisible();
    await expect(page.locator('#setting-haptic')).toBeVisible();
    await expect(page.locator('#setting-motion')).toBeVisible();
  });

  test('should close settings overlay', async ({ page }) => {
    await page.locator('#btn-settings').click();
    await expect(page.locator('#settings-overlay')).toHaveAttribute('aria-hidden', 'false');

    await page.locator('#btn-close-settings').click();
    await expect(page.locator('#settings-overlay')).toHaveAttribute('aria-hidden', 'true');
  });

  test('should navigate to next level', async ({ page }) => {
    await page.locator('#btn-next').click();
    await expect(page.locator('#level-progress')).toContainText('Level 2');
  });

  test('should navigate to previous level', async ({ page }) => {
    // Go to level 2 first
    await page.locator('#btn-next').click();
    await expect(page.locator('#level-progress')).toContainText('Level 2');

    // Go back
    await page.locator('#btn-prev').click();
    await expect(page.locator('#level-progress')).toContainText('Level 1');
  });

  test('should restart level', async ({ page }) => {
    // Click restart
    await page.locator('#btn-restart').click();
    await expect(page.locator('#score-display')).toContainText('0');
  });

  test('should have accessible overlay', async ({ page }) => {
    const overlay = page.locator('#win-overlay');
    await expect(overlay).toHaveAttribute('role', 'dialog');
    await expect(overlay).toHaveAttribute('aria-hidden', 'true');
  });

  test('should have skip link', async ({ page }) => {
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toHaveAttribute('href', '#game-container');
  });

  test('should render blob that responds to game progression', async ({ page }) => {
    // Wait a moment for game loop to start
    await page.waitForTimeout(500);

    // Score should be incrementing as blob moves forward
    const scoreAfterWait = await page.locator('#score-display').textContent();
    const scoreNum = parseInt(scoreAfterWait, 10);
    expect(scoreNum).toBeGreaterThan(0);
  });

  test('should handle drag input on canvas', async ({ page }) => {
    const canvas = page.locator('#game-container canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    // Drag down (should reshape wider)
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + 50, { steps: 5 });
    await page.mouse.up();

    // No error should occur - game should still be running
    await page.waitForTimeout(200);
    const overlay = page.locator('#win-overlay');
    await expect(overlay).toHaveAttribute('aria-hidden', 'true');
  });
});
