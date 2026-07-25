/**
 * Save the Character - E2E Tests (Playwright)
 *
 * Note: Save the Character uses "scenarios" not "levels" in its UI.
 * Level progress reads "Scenario 1 / 20". The result overlay is #result-overlay
 * (not #win-overlay). Sound is toggled via #btn-sound, not a settings overlay.
 */

import { test, expect } from '@playwright/test';

const GAME_URL = '/save-the-character/';

test.describe('Save the Character', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for game.js module to load from network
    const gameModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/games/save-the-character/game.js') && response.status() === 200
    );

    // Wait for levels.json network request to complete
    const levelsJsonPromise = page.waitForResponse(response =>
      response.url().includes('levels.json') && response.status() === 200
    );

    await page.goto(GAME_URL);

    // Ensure network requests complete before waiting for selectors
    await Promise.all([gameModulePromise, levelsJsonPromise]);
    await page.waitForSelector('#game-canvas', { timeout: 5000 });
  });

  test('loads game page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Save.*Character/i);
  });

  test('canvas is visible and has non-zero dimensions', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('displays initial stats on scenario 1', async ({ page }) => {
    await expect(page.locator('#level-display')).toHaveText('1');
    await expect(page.locator('#saved-display')).toContainText('0');
    await expect(page.locator('#level-progress')).toContainText('Scenario 1');
  });

  test('has navigation buttons', async ({ page }) => {
    await expect(page.locator('#btn-restart')).toBeVisible();
    await expect(page.locator('#btn-prev')).toBeVisible();
    await expect(page.locator('#btn-next')).toBeVisible();
  });

  test('prev button disabled on first scenario', async ({ page }) => {
    await expect(page.locator('#btn-prev')).toBeDisabled();
  });

  test('scenario navigation works', async ({ page }) => {
    await expect(page.locator('#btn-next')).toBeEnabled();
    await page.click('#btn-next');
    await expect(page.locator('#level-display')).toHaveText('2');
    await expect(page.locator('#level-progress')).toContainText('Scenario 2');
    await page.click('#btn-prev');
    await expect(page.locator('#level-display')).toHaveText('1');
  });

  test('restart button resets scenario', async ({ page }) => {
    await page.click('#btn-restart');
    await expect(page.locator('#level-display')).toHaveText('1');
    await expect(page.locator('#game-canvas')).toBeVisible();
  });

  test('sound toggle button is visible', async ({ page }) => {
    await expect(page.locator('#btn-sound')).toBeVisible();
  });

  test('result overlay starts hidden and is accessible', async ({ page }) => {
    const overlay = page.locator('#result-overlay');
    await expect(overlay).toHaveAttribute('role', 'dialog');
    await expect(overlay).toHaveAttribute('aria-hidden', 'true');
  });
});
