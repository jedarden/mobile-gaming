import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test.describe('Homepage', () => {
    test('should load homepage', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle(/Mobile Gaming/);
    });

    test('should display all game cards', async ({ page }) => {
      await page.goto('/');

      const gameCards = page.locator('.game-card');
      await expect(gameCards).toHaveCount(4);

      const gameNames = ['Water Sort', 'Parking Escape', 'Bus Jam', 'Pull the Pin'];
      for (const name of gameNames) {
        await expect(page.getByRole('heading', { name })).toBeVisible();
      }
    });

    test('should have working navigation to profile', async ({ page }) => {
      await page.goto('/');
      await page.click('.profile-link');
      await expect(page).toHaveURL(/\/profile\//);
    });

    test('should have settings link', async ({ page }) => {
      await page.goto('/');
      const settingsLink = page.locator('.settings-link');
      await expect(settingsLink).toBeVisible();
    });

    test('should have skip link for accessibility', async ({ page }) => {
      await page.goto('/');
      const skipLink = page.locator('.skip-link');
      await expect(skipLink).toBeVisible();
    });

    test('should show all games as playable (no Coming Soon badges)', async ({ page }) => {
      await page.goto('/');
      
      // All game cards should have "Play" badge, not "Coming Soon"
      const comingSoonBadges = page.locator('.badge-warning');
      await expect(comingSoonBadges).toHaveCount(0);
      
      const playBadges = page.locator('.badge-success');
      await expect(playBadges).toHaveCount(4);
    });
  });

  test.describe('Profile Page', () => {
    test('should load profile page', async ({ page }) => {
      await page.goto('/profile/');
      await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
    });
  });

  test.describe('Settings Page', () => {
    test('should load settings page', async ({ page }) => {
      await page.goto('/settings/');
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    });
  });

  test.describe('Water Sort Game', () => {
    test('should load water sort game page', async ({ page }) => {
      await page.goto('/games/water-sort/');
      await expect(page.getByRole('heading', { name: /water sort/i })).toBeVisible();
    });

    test('should display game canvas', async ({ page }) => {
      await page.goto('/games/water-sort/');
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();
    });

    test('should have clickable canvas', async ({ page }) => {
      await page.goto('/games/water-sort/');
      const canvas = page.locator('canvas');
      await expect(canvas).toHaveCSS('cursor', 'pointer');
    });
  });

  test.describe('Parking Escape Game', () => {
    test('should load parking escape game page', async ({ page }) => {
      await page.goto('/games/parking-escape/');
      await expect(page.getByRole('heading', { name: /parking escape/i })).toBeVisible();
    });

    test('should display game canvas', async ({ page }) => {
      await page.goto('/games/parking-escape/');
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();
    });

    test('should have drag input cursor', async ({ page }) => {
      await page.goto('/games/parking-escape/');
      const canvas = page.locator('canvas');
      await expect(canvas).toHaveCSS('cursor', 'grab');
    });
  });

  test.describe('Bus Jam Game', () => {
    test('should load bus jam game page', async ({ page }) => {
      await page.goto('/games/bus-jam/');
      await expect(page.getByRole('heading', { name: /bus jam/i })).toBeVisible();
    });

    test('should display game canvas', async ({ page }) => {
      await page.goto('/games/bus-jam/');
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();
    });
  });

  test.describe('Pull the Pin Game', () => {
    test('should load pull the pin game page', async ({ page }) => {
      await page.goto('/games/pull-the-pin/');
      await expect(page.getByRole('heading', { name: /pull the pin/i })).toBeVisible();
    });

    test('should display game canvas', async ({ page }) => {
      await page.goto('/games/pull-the-pin/');
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();
    });
  });
});
