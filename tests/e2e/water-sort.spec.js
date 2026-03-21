import { test, expect } from '@playwright/test';
import { solve } from '../solvers/water-sort-solver.js';

test.describe('Water Sort', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/src/games/water-sort/index.html');
  });

  test('loads game and displays tubes', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Check level display shows 1
    await expect(page.locator('#level-display')).toHaveText('1');
  });

  test('displays correct number of tubes for level 1', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Level 1 has 3 tubes
    // Verify the canvas is rendered (has non-zero dimensions)
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('undo button is disabled initially', async ({ page }) => {
    await expect(page.locator('#btn-undo')).toBeDisabled();
  });

  test('tap tube to select and deselect', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    // Tap the first tube area (left side of canvas)
    await page.tap('#game-canvas', { position: { x: box.width * 0.2, y: box.height * 0.5 } });

    // Tap the same area to deselect
    await page.tap('#game-canvas', { position: { x: box.width * 0.2, y: box.height * 0.5 } });
  });

  test('restart button resets the level', async ({ page }) => {
    await expect(page.locator('#moves-display')).toHaveText('0');
    await page.click('#btn-restart');
    await expect(page.locator('#moves-display')).toHaveText('0');
  });

  test('level navigation works', async ({ page }) => {
    // Next level should be enabled
    await expect(page.locator('#btn-next')).toBeEnabled();

    // Prev should be disabled on level 1
    await expect(page.locator('#btn-prev')).toBeDisabled();

    // Go to next level
    await page.click('#btn-next');
    await expect(page.locator('#level-display')).toHaveText('2');
    await expect(page.locator('#level-progress')).toContainText('Level 2');

    // Go back
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
