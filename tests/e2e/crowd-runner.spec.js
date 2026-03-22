import { test, expect } from '@playwright/test';

test.describe('Crowd Runner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/games/crowd-runner/index.html');
  });

  test('loads game and displays level 1', async ({ page }) => {
    const container = page.locator('#game-container');
    await expect(container).toBeVisible();
    await expect(page.locator('#level-display')).toHaveText('1');
    await expect(page.locator('#crowd-display')).toBeVisible();
  });

  test('restart button keeps game on level 1', async ({ page }) => {
    await page.click('#btn-restart');
    await expect(page.locator('#level-display')).toHaveText('1');
    await expect(page.locator('#game-container')).toBeVisible();
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
