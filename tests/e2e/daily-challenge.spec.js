/**
 * Daily challenge entry flow (Playwright).
 */

import { test, expect } from '@playwright/test';

test('hub daily challenge opens its selected game in daily mode', async ({ page }) => {
  await page.goto('/');

  const banner = page.locator('#dailyChallengeBanner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute('href', /^\/[\w-]+\/\?daily=true$/);

  const navigation = page.waitForNavigation();
  await banner.click();
  const response = await navigation;
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(url => url.searchParams.get('daily') === 'true');
});

test('Parking Escape loads one seeded level for the daily challenge', async ({ page }) => {
  const levels = page.waitForResponse(response =>
    response.url().includes('levels.json') && response.status() === 200
  );

  await page.goto('/parking-escape/?daily=true');
  await levels;
  await expect(page.locator('#level-progress')).toHaveText('Daily Challenge');
  await page.waitForFunction(() =>
    window.__peGame?.isDailyMode === true && window.__peGame.levels.length === 1
  );

  const dailySeed = await page.evaluate(() => window.__peGame.dailySeed);
  expect(dailySeed).toMatch(/^\d{4}-\d{2}-\d{2}:parking-escape$/);
});
