/**
 * Merge Games - E2E Tests (Playwright)
 *
 * Note: merge-games has sound and motion toggles but no haptic toggle.
 */

import { test, expect } from '@playwright/test';

const GAME_URL = '/merge-games/';

test.describe('Merge Games', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
  });

  test('loads game page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Merge/i);
  });

  test('canvas is visible and has non-zero dimensions', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('displays initial stats on level 1', async ({ page }) => {
    await expect(page.locator('#level-display')).toHaveText('1');
    await expect(page.locator('#moves-display')).toHaveText('0');
    await expect(page.locator('#level-progress')).toContainText('Level 1');
  });

  test('has all navigation buttons', async ({ page }) => {
    await expect(page.locator('#btn-restart')).toBeVisible();
    await expect(page.locator('#btn-prev')).toBeVisible();
    await expect(page.locator('#btn-next')).toBeVisible();
  });

  test('prev button disabled on first level', async ({ page }) => {
    await expect(page.locator('#btn-prev')).toBeDisabled();
  });

  test('level navigation works', async ({ page }) => {
    await expect(page.locator('#btn-next')).toBeEnabled();
    await page.click('#btn-next');
    await expect(page.locator('#level-display')).toHaveText('2');
    await expect(page.locator('#level-progress')).toContainText('Level 2');
    await page.click('#btn-prev');
    await expect(page.locator('#level-display')).toHaveText('1');
  });

  test('restart button resets the level', async ({ page }) => {
    await page.click('#btn-restart');
    await expect(page.locator('#moves-display')).toHaveText('0');
    await expect(page.locator('#level-display')).toHaveText('1');
  });

  test('settings overlay opens with toggles', async ({ page }) => {
    await page.click('#btn-settings');
    const overlay = page.locator('#settings-overlay');
    await expect(overlay).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#setting-sound')).toBeVisible();
    await expect(page.locator('#setting-motion')).toBeVisible();
  });

  test('settings overlay closes', async ({ page }) => {
    await page.click('#btn-settings');
    await expect(page.locator('#settings-overlay')).toHaveAttribute('aria-hidden', 'false');
    await page.click('#btn-close-settings');
    await expect(page.locator('#settings-overlay')).toHaveAttribute('aria-hidden', 'true');
  });

  test('win overlay starts hidden and is accessible', async ({ page }) => {
    const overlay = page.locator('#win-overlay');
    await expect(overlay).toHaveAttribute('role', 'dialog');
    await expect(overlay).toHaveAttribute('aria-hidden', 'true');
  });
});
