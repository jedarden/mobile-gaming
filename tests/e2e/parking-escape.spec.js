/**
 * Parking Escape - E2E Tests (Playwright)
 */

import { test, expect } from '@playwright/test';

const GAME_URL = '/parking-escape/';

test.describe('Parking Escape', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for game module and levels.json to load from network
    const gameModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/games/parking-escape/game.js') && response.status() === 200
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
    await expect(page).toHaveTitle(/Parking Escape/i);
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
    await page.waitForSelector('#level-display', { state: 'visible', timeout: 3000 });
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
    await page.waitForFunction(() => {
      const levelEl = document.getElementById('level-display');
      return levelEl && levelEl.textContent === '2';
    }, { timeout: 2000 });
    await expect(page.locator('#level-display')).toHaveText('2');
    await expect(page.locator('#level-progress')).toContainText('Level 2');
    await page.click('#btn-prev');
    await page.waitForFunction(() => {
      const levelEl = document.getElementById('level-display');
      return levelEl && levelEl.textContent === '1';
    }, { timeout: 2000 });
    await expect(page.locator('#level-display')).toHaveText('1');
  });

  test('restart button resets the level', async ({ page }) => {
    await page.click('#btn-restart');
    await page.waitForFunction(() => {
      const movesEl = document.getElementById('moves-display');
      const levelEl = document.getElementById('level-display');
      return movesEl && movesEl.textContent === '0' && levelEl && levelEl.textContent === '1';
    }, { timeout: 2000 });
    await expect(page.locator('#moves-display')).toHaveText('0');
    await expect(page.locator('#level-display')).toHaveText('1');
  });

  test('settings overlay opens with all toggles', async ({ page }) => {
    await page.click('#btn-settings');
    await page.waitForFunction(() => {
      const overlay = document.getElementById('settings-overlay');
      return overlay && overlay.getAttribute('aria-hidden') === 'false';
    }, { timeout: 2000 });
    const overlay = page.locator('#settings-overlay');
    await expect(overlay).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#setting-sound')).toBeVisible();
    await expect(page.locator('#setting-haptic')).toBeVisible();
    await expect(page.locator('#setting-motion')).toBeVisible();
  });

  test('settings overlay closes', async ({ page }) => {
    await page.click('#btn-settings');
    await page.waitForFunction(() => {
      const overlay = document.getElementById('settings-overlay');
      return overlay && overlay.getAttribute('aria-hidden') === 'false';
    }, { timeout: 2000 });
    await expect(page.locator('#settings-overlay')).toHaveAttribute('aria-hidden', 'false');
    await page.click('#btn-close-settings');
    await page.waitForFunction(() => {
      const overlay = document.getElementById('settings-overlay');
      return overlay && overlay.getAttribute('aria-hidden') === 'true';
    }, { timeout: 2000 });
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
    await page.waitForFunction(() => window.__peGame && window.__peGame.state);

    // Reach a distinctive, provably non-default board via the game instance.
    const before = await page.evaluate(() => {
      const g = window.__peGame;
      g.state.moves = 5;
      // Nudge the first vehicle so the board differs from the level's start.
      g.state.vehicles[0].x = 0;
      g.state.vehicles[0].y = 0;
      g.updateUI();
      return {
        moves: g.state.moves,
        sig: g.state.vehicles.map(v => `${v.id}:${v.x},${v.y}`).join('|'),
      };
    });

    // Share → writes a #s=parking-escape.* hash to the address bar.
    await page.click('#btn-share');
    // Wait for hash to be set (shareState is async)
    await page.waitForFunction(() => window.location.hash && window.location.hash.startsWith('#s=parking-escape.'), { timeout: 3000 });
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash.startsWith('#s=parking-escape.')).toBe(true);

    // Reload with the shared hash → board resumes in the exact shared state.
    await page.goto(GAME_URL + hash);
    await page.waitForSelector('#game-canvas');
    await page.waitForFunction(() => window.__peGame && window.__peGame.state && window.__peGame.state.moves === 5);
    await page.waitForFunction(() => {
      const movesEl = document.getElementById('moves-display');
      return movesEl && movesEl.textContent === '5';
    }, { timeout: 2000 });
    await expect(page.locator('#moves-display')).toHaveText('5');
    const after = await page.evaluate(() => ({
      moves: window.__peGame.state.moves,
      sig: window.__peGame.state.vehicles.map(v => `${v.id}:${v.x},${v.y}`).join('|'),
    }));
    expect(after).toEqual(before);

    // Control: a plain reload (no hash) starts fresh at 0 moves.
    await page.goto(GAME_URL);
    await page.waitForSelector('#game-canvas');
    await page.waitForFunction(() => {
      const movesEl = document.getElementById('moves-display');
      return movesEl && movesEl.textContent === '0';
    }, { timeout: 2000 });
    await expect(page.locator('#moves-display')).toHaveText('0');
  });
});
