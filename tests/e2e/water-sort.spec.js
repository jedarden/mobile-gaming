/**
 * Water Sort - E2E Tests (Playwright)
 */

import { test, expect } from '@playwright/test';

const GAME_URL = '/water-sort/';

test.describe('Water Sort', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for game module and levels.json to load from network
    const gameModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/games/water-sort/game.js') && response.status() === 200
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
    await expect(page).toHaveTitle(/Water Sort/i);
  });

  test('displays initial stats on level 1', async ({ page }) => {
    await expect(page.locator('#level-display')).toHaveText('1');
    await expect(page.locator('#moves-display')).toHaveText('0');
    await expect(page.locator('#level-progress')).toContainText('Level 1');
  });

  test('canvas is visible and has non-zero dimensions', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('undo button is disabled initially', async ({ page }) => {
    await expect(page.locator('#btn-undo')).toBeDisabled();
  });

  test('has all navigation and action buttons', async ({ page }) => {
    await expect(page.locator('#btn-undo')).toBeVisible();
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

  test('tap tube to select and deselect', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    const box = await canvas.boundingBox();
    await page.tap('#game-canvas', { position: { x: box.width * 0.2, y: box.height * 0.5 } });
    await page.tap('#game-canvas', { position: { x: box.width * 0.2, y: box.height * 0.5 } });
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

  test('has a share button', async ({ page }) => {
    await expect(page.locator('#btn-share')).toBeVisible();
  });

  test('shareable state URL round-trips a mid-puzzle board', async ({ page }) => {
    await page.waitForFunction(() => window.__wsGame && window.__wsGame.state);

    // Reach a distinctive, provably non-default board via the game instance.
    const before = await page.evaluate(() => {
      const g = window.__wsGame;
      g.state.moves = 7;
      // Move a segment between two tubes so the board differs from level 1.
      const tubes = g.state.tubes;
      if (tubes[0].segments.length > 0) {
        tubes[tubes.length - 1].segments.push(tubes[0].segments.pop());
      }
      g.updateUI();
      return {
        moves: g.state.moves,
        sig: g.state.tubes.map(t => t.segments.join('/')).join('|'),
      };
    });

    // Set up waitForResponse for potential share endpoint
    // This follows the pattern established for levels.json and module imports
    const shareResponsePromise = page.waitForResponse(response =>
      response.url().includes('/share') && response.status() === 200
    ).catch(() => null); // No-op if no share endpoint exists

    // Share → writes a #s=water-sort.* hash to the address bar.
    await page.click('#btn-share');

    // Wait for potential share response (will resolve immediately if no endpoint)
    await shareResponsePromise;

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash.startsWith('#s=water-sort.')).toBe(true);

    // Reload with the shared hash → board resumes in the exact shared state.
    await page.goto(GAME_URL + hash);
    await page.waitForSelector('#game-canvas');
    await page.waitForFunction(() => window.__wsGame && window.__wsGame.state && window.__wsGame.state.moves === 7);
    await expect(page.locator('#moves-display')).toHaveText('7');
    const after = await page.evaluate(() => ({
      moves: window.__wsGame.state.moves,
      sig: window.__wsGame.state.tubes.map(t => t.segments.join('/')).join('|'),
    }));
    expect(after).toEqual(before);

    // Control: a plain reload (no hash) starts fresh at level 1 / 0 moves.
    await page.goto(GAME_URL);
    await page.waitForSelector('#game-canvas');
    await expect(page.locator('#moves-display')).toHaveText('0');
  });
});
