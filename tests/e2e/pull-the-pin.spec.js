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

    // Share → writes a #s=pull-the-pin.* hash to the address bar.
    await page.click('#btn-share');
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
