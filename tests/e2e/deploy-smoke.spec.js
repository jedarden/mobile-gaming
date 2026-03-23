/**
 * Deploy Smoke Tests (@deploy-smoke)
 *
 * Runs against the live https://mobile-gaming.pages.dev deployment.
 * Run with: npm run test:deploy -- --grep @deploy-smoke
 *
 * Checks:
 *  1. Version gate — deployed SHA matches expected (set EXPECTED_SHA env var)
 *  2. Hub loads with all 13 game links
 *  3. Each game page responds (200) and canvas is visible with non-zero dimensions
 *  4. Each game's JS executes (canvas has drawn content, not blank)
 */

import { test, expect } from '@playwright/test';

const GAMES = [
  'brain-teaser',
  'bridge-race',
  'bus-jam',
  'crowd-runner',
  'giant-runner',
  'jelly-shift',
  'makeover-run',
  'merge-games',
  'parking-escape',
  'pull-the-pin',
  'satisfying-asmr',
  'save-the-character',
  'water-sort',
];

// ---------------------------------------------------------------------------
// 1. Version gate
// ---------------------------------------------------------------------------
test('@deploy-smoke version gate: deployed SHA matches expected', async ({ request }) => {
  const expectedSha = process.env.EXPECTED_SHA;
  if (!expectedSha) {
    test.skip(true, 'EXPECTED_SHA not set — skipping version gate');
    return;
  }

  const res = await request.get('/version.json');
  expect(res.ok(), `GET /version.json returned ${res.status()}`).toBe(true);

  const body = await res.json();
  expect(
    body.sha,
    `Deployed version is stale — expected ${expectedSha}, got ${body.sha}`
  ).toBe(expectedSha);
});

// ---------------------------------------------------------------------------
// 2. Hub
// ---------------------------------------------------------------------------
test.describe('@deploy-smoke Hub', () => {
  test('loads and shows all 13 game links', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Mobile Games Hub/i);

    // All 13 Play links must be present
    for (const game of GAMES) {
      const link = page.locator(`a.play-btn[href="/${game}/"]`);
      await expect(link, `Missing Play link for ${game}`).toBeVisible();
    }
  });

  test('game grid is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.games-grid')).toBeVisible();
    const cards = page.locator('.game-card');
    expect(await cards.count()).toBe(GAMES.length);
  });
});

// ---------------------------------------------------------------------------
// 3. & 4. Per-game: page loads, canvas visible, JS executes
// ---------------------------------------------------------------------------
for (const game of GAMES) {
  test.describe(`@deploy-smoke ${game}`, () => {
    test('page loads (200) and canvas is visible with non-zero size', async ({ page }) => {
      const res = await page.goto(`/${game}/`);
      expect(res.status(), `${game} returned non-200`).toBe(200);

      const canvas = page.locator('#game-canvas');
      await expect(canvas, `${game}: canvas not visible`).toBeVisible();

      const box = await canvas.boundingBox();
      expect(box, `${game}: canvas has no bounding box`).not.toBeNull();
      expect(box.width, `${game}: canvas width is 0`).toBeGreaterThan(0);
      expect(box.height, `${game}: canvas height is 0`).toBeGreaterThan(0);
    });

    test('JS executes — canvas has drawn content', async ({ page }) => {
      await page.goto(`/${game}/`);

      // Wait for the game to initialize (up to 5 s)
      await page.waitForTimeout(2000);

      const canvas = page.locator('#game-canvas');
      await expect(canvas).toBeVisible();

      // Sample the centre pixel; if it's fully transparent the JS never ran
      const hasContent = await canvas.evaluate(el => {
        const ctx = el.getContext('2d');
        if (!ctx) return false;
        const { width, height } = el;
        const px = ctx.getImageData(Math.floor(width / 2), Math.floor(height / 2), 1, 1).data;
        // alpha > 0 means something was drawn
        return px[3] > 0;
      });

      expect(hasContent, `${game}: canvas centre pixel is transparent — JS may not have executed`).toBe(true);
    });
  });
}
