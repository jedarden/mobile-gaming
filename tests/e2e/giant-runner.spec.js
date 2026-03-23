/**
 * Giant Runner - E2E Tests (Playwright)
 */

import { test, expect } from '@playwright/test';

const GAME_URL = '/giant-runner/';

test.describe('Giant Runner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForSelector('#game-container canvas', { timeout: 10000 });
  });

  test('loads game page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Giant Runner/);
    await expect(page.locator('h1')).toContainText('Giant Runner');
  });

  test('renders Three.js canvas with valid dimensions', async ({ page }) => {
    const canvas = page.locator('#game-container canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('displays initial stats on level 1', async ({ page }) => {
    await expect(page.locator('#level-display')).toHaveText('1');
    await expect(page.locator('#scale-display')).toContainText('1.00');
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

  test('restart button resets to level 1', async ({ page }) => {
    await page.click('#btn-next');
    await expect(page.locator('#level-display')).toHaveText('2');
    await page.click('#btn-restart');
    await expect(page.locator('#level-display')).toHaveText('1');
    await expect(page.locator('#game-container')).toBeVisible();
  });

  test('settings overlay opens with all toggles', async ({ page }) => {
    await page.click('#btn-settings');
    const overlay = page.locator('#settings-overlay');
    await expect(overlay).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#setting-sound')).toBeVisible();
    await expect(page.locator('#setting-haptic')).toBeVisible();
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

  test('has skip link for keyboard accessibility', async ({ page }) => {
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toHaveAttribute('href', '#game-container');
  });
});
