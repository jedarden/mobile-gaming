/**
 * Production-output smoke coverage used by the Argo CI workflow.
 */

import { test, expect } from '@playwright/test';

const GAMES = [
  ['brain-teaser', 'Brain Teaser'],
  ['bridge-race', 'Bridge Race'],
  ['bus-jam', 'Bus Jam'],
  ['crowd-runner', 'Crowd Runner'],
  ['giant-runner', 'Giant Runner'],
  ['jelly-shift', 'Jelly Shift'],
  ['makeover-run', 'Makeover Run'],
  ['merge-games', 'Merge Games'],
  ['parking-escape', 'Parking Escape'],
  ['pull-the-pin', 'Pull the Pin'],
  ['satisfying-asmr', 'Satisfying Clean'],
  ['save-the-character', 'Save the Character'],
  ['water-sort', 'Water Sort'],
];

test('production hub lists every game route', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Mobile Games Hub/i);

  for (const [gameId] of GAMES) {
    await expect(page.locator(`a.play-btn[href="/${gameId}/"]`)).toBeVisible();
  }
});

for (const [gameId, title] of GAMES) {
  test(`${title} production route serves its page and level data`, async ({ page }) => {
    const response = await page.goto(`/${gameId}/`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(new RegExp(title, 'i'));
    await expect(page.locator('h1')).toHaveText(title);
    await expect(page.locator('main')).toHaveCount(1);

    const levelsResponse = await page.request.get(`/${gameId}/levels.json`);
    expect(levelsResponse.status()).toBe(200);
    const levels = await levelsResponse.json();
    expect(Array.isArray(levels)).toBe(true);
    expect(levels.length).toBeGreaterThanOrEqual(3);

    await expect(page.locator('.back-link')).toHaveAttribute('href', '../../');
  });
}
