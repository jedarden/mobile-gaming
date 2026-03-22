import { test, expect } from '@playwright/test';

test.describe('Save the Character', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/games/save-the-character/index.html');
  });

  test('loads game and displays level 1', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.locator('#level-display')).toHaveText('1');
  });

  test('canvas is visible and has non-zero dimensions', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('restart button resets the level', async ({ page }) => {
    await expect(page.locator('#moves-display')).toHaveText('0');
    await page.click('#btn-restart');
    await expect(page.locator('#moves-display')).toHaveText('0');
  });

  test('level navigation works', async ({ page }) => {
    await expect(page.locator('#btn-next')).toBeEnabled();
    await expect(page.locator('#btn-prev')).toBeDisabled();
    await page.click('#btn-next');
    await expect(page.locator('#level-display')).toHaveText('2');
    await page.click('#btn-prev');
    await expect(page.locator('#level-display')).toHaveText('1');
  });

  test('settings overlay opens and closes', async ({ page }) => {
    await page.click('#btn-settings');
    await expect(page.locator('#settings-overlay')).toHaveAttribute('aria-hidden', 'false');
    await page.click('#btn-close-settings');
    await expect(page.locator('#settings-overlay')).toHaveAttribute('aria-hidden', 'true');
  });
});
