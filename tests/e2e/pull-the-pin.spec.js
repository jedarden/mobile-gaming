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
    // Wait for game module and levels.json to load from network
    const gameModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/games/pull-the-pin/game.js') && response.status() === 200
    );
    const levelsJsonPromise = page.waitForResponse(response =>
      response.url().includes('levels.json') && response.status() === 200
    );

    await page.goto(GAME_URL);

    // Ensure network resources are loaded before waiting for UI
    await Promise.all([gameModulePromise, levelsJsonPromise]);
    await page.waitForSelector('#game-canvas', { timeout: 5000 });
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

  test('has a share button', async ({ page }) => {
    await expect(page.locator('#btn-share')).toBeVisible();
  });

  test('shareable state URL round-trips a mid-puzzle board', async ({ page }) => {
    await page.waitForFunction(() => window.__ptpGame && window.__ptpGame.getState());

    const freshPinText = await page.locator('#pin-count').textContent();

    // Reach a distinctive mid-puzzle state: remove the first pin.
    const before = await page.evaluate(() => {
      const gs = window.__ptpGame.getState();
      gs.pins[0].removed = true;
      return { sig: gs.pins.map(p => `${p.id}:${p.removed ? 1 : 0}`).join('|') };
    });

    // Set up waitForResponse for potential share endpoint
    // This follows the pattern established for levels.json and module imports
    const shareResponsePromise = page.waitForResponse(response =>
      response.url().includes('/share') && response.status() === 200
    ).catch(() => null); // No-op if no share endpoint exists

    // Share → writes a #s=pull-the-pin.* hash to the address bar.
    await page.click('#btn-share');

    // Wait for potential share response (will resolve immediately if no endpoint)
    await shareResponsePromise;

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash.startsWith('#s=pull-the-pin.')).toBe(true);

    // Reload with the shared hash → board resumes with the pin removed.
    await page.goto(GAME_URL + hash);
    await page.waitForSelector('#game-canvas');
    await page.waitForFunction(() => window.__ptpGame && window.__ptpGame.getState() && window.__ptpGame.getState().pins[0].removed === true);
    const after = await page.evaluate(() => ({
      sig: window.__ptpGame.getState().pins.map(p => `${p.id}:${p.removed ? 1 : 0}`).join('|'),
    }));
    expect(after).toEqual(before);
    // One fewer pin than a fresh load.
    await expect(page.locator('#pin-count')).not.toHaveText(freshPinText);

    // Control: a plain reload (no hash) starts fresh with all pins.
    await page.goto(GAME_URL);
    await page.waitForSelector('#game-canvas');
    await expect(page.locator('#pin-count')).toHaveText(freshPinText);
  });
});
