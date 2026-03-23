/**
 * Pull the Pin - E2E Tests (Playwright)
 *
 * Note: Pull the Pin uses a distinct UI pattern from the shared game shell.
 * IDs: #level-indicator (not #level-display), #reset-btn (not #btn-restart),
 *      #pin-count, #overlay/#overlay-content for win/lose state.
 * There is no settings overlay or prev/next level navigation buttons.
 */

import { test, expect } from '@playwright/test';

const GAME_URL = '/pull-the-pin/';

test.describe('Pull the Pin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
  });

  test('loads game page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Pull.*Pin/i);
  });

  test('canvas is visible and has non-zero dimensions', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('displays level indicator on level 1', async ({ page }) => {
    await expect(page.locator('#level-indicator')).toContainText('Level 1');
  });

  test('displays pin count', async ({ page }) => {
    await expect(page.locator('#pin-count')).toBeVisible();
    await expect(page.locator('#pin-count')).toContainText('Pins:');
  });

  test('reset button is visible', async ({ page }) => {
    await expect(page.locator('#reset-btn')).toBeVisible();
  });

  test('reset button resets level state', async ({ page }) => {
    await page.click('#reset-btn');
    await expect(page.locator('#level-indicator')).toContainText('Level 1');
    await expect(page.locator('#game-canvas')).toBeVisible();
  });

  test('overlay is hidden initially', async ({ page }) => {
    const overlay = page.locator('#overlay');
    await expect(overlay).toHaveClass(/hidden/);
  });

  test('game container is accessible', async ({ page }) => {
    await expect(page.locator('#game-container')).toBeVisible();
    await expect(page.locator('#game-main')).toBeVisible();
  });
});
