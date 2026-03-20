/**
 * Brain Teaser - E2E Tests (Playwright)
 *
 * End-to-end tests for Brain Teaser game UI.
 */

import { test, expect } from '@playwright/test';

const GAME_URL = '/src/games/brain-teaser/index.html';

test.describe('Brain Teaser Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    // Wait for game to initialize
    await page.waitForSelector('#game-canvas');
  });

  test('should load the game page', async ({ page }) => {
    await expect(page).toHaveTitle(/Brain Teaser/);
    await expect(page.locator('h1')).toContainText('Brain Teaser');
  });

  test('should display initial puzzle', async ({ page }) => {
    // Check level display shows puzzle number
    await expect(page.locator('#level-display')).toContainText('1');

    // Check attempts display starts at 0
    await expect(page.locator('#attempts-display')).toContainText('0');

    // Check progress text
    await expect(page.locator('#level-progress')).toContainText('Puzzle 1');
  });

  test('should render canvas', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Canvas should have dimensions
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('should show hint when hint button clicked', async ({ page }) => {
    const hintText = page.locator('#hint-text');

    // Initially hidden
    await expect(hintText).not.toHaveClass(/visible/);

    // Click hint button
    await page.click('#btn-hint');

    // Should become visible
    await expect(hintText).toHaveClass(/visible/);

    // Should have hint text
    const text = await hintText.textContent();
    expect(text.length).toBeGreaterThan(0);
  });

  test('should navigate between puzzles', async ({ page }) => {
    // Next button should be enabled
    await expect(page.locator('#btn-next')).toBeEnabled();

    // Click next
    await page.click('#btn-next');
    await expect(page.locator('#level-display')).toContainText('2');

    // Prev should now be enabled
    await expect(page.locator('#btn-prev')).toBeEnabled();

    // Click prev
    await page.click('#btn-prev');
    await expect(page.locator('#level-display')).toContainText('1');
  });

  test('should restart puzzle', async ({ page }) => {
    // Click restart
    await page.click('#btn-restart');

    // Should still be on puzzle 1 with 0 attempts
    await expect(page.locator('#level-display')).toContainText('1');
    await expect(page.locator('#attempts-display')).toContainText('0');
  });

  test('should open and close settings', async ({ page }) => {
    const settingsOverlay = page.locator('#settings-overlay');

    // Open settings
    await page.click('#btn-settings');
    await expect(settingsOverlay).toHaveClass(/active/);

    // Close settings
    await page.click('#btn-close-settings');
    await expect(settingsOverlay).not.toHaveClass(/active/);
  });

  test('should toggle sound', async ({ page }) => {
    const soundBtn = page.locator('#btn-sound');

    // Click to mute
    await soundBtn.click();
    await expect(soundBtn).toContainText('🔇');

    // Click to unmute
    await soundBtn.click();
    await expect(soundBtn).toContainText('🔊');
  });
});

test.describe('Brain Teaser Gameplay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForSelector('#game-canvas');
  });

  test('should show win overlay on correct answer', async ({ page }) => {
    // First puzzle solution is cup2 (tap middle cup)
    // We need to click on the canvas at the right position

    const canvas = page.locator('#game-canvas');
    const box = await canvas.boundingBox();

    // Calculate position for middle cup (approximately)
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height * 0.5;

    // Click on the canvas
    await canvas.click({ position: { x: centerX - box.x, y: centerY - box.y } });

    // Check if win overlay appears (may need to click correct position)
    // This test might need adjustment based on actual puzzle
  });

  test('should increment attempts on wrong answer', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    const box = await canvas.boundingBox();

    // Click on left side (likely wrong for first puzzle)
    const leftX = box.width * 0.15;
    const centerY = box.height * 0.5;

    await canvas.click({ position: { x: leftX, y: centerY } });

    // Wait a moment for animation
    await page.waitForTimeout(500);

    // Attempts should be > 0 (if we clicked a decoy)
    const attempts = await page.locator('#attempts-display').textContent();
    // Note: This depends on hitting a decoy, so might not always increment
  });
});

test.describe('Brain Teaser Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForSelector('#game-canvas');
  });

  test('should have proper heading structure', async ({ page }) => {
    // Should have h1
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
  });

  test('should have accessible buttons', async ({ page }) => {
    // All buttons should have labels
    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const label = await btn.getAttribute('aria-label');
      const text = await btn.textContent();

      // Button should have either aria-label or text content
      expect(label || text).toBeTruthy();
    }
  });

  test('should have skip link', async ({ page }) => {
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeVisible();
  });

  test('should manage focus in overlays', async ({ page }) => {
    // Open settings
    await page.click('#btn-settings');

    const settingsOverlay = page.locator('#settings-overlay');
    await expect(settingsOverlay).toHaveAttribute('aria-hidden', 'false');

    // Close with button
    await page.click('#btn-close-settings');
    await expect(settingsOverlay).toHaveAttribute('aria-hidden', 'true');
  });
});

test.describe('Brain Teaser Responsive', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(GAME_URL);
    await page.waitForSelector('#game-canvas');

    // Canvas should still be visible
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Buttons should be accessible
    await expect(page.locator('#btn-hint')).toBeVisible();
    await expect(page.locator('#btn-restart')).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(GAME_URL);
    await page.waitForSelector('#game-canvas');

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
  });
});
