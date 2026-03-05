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
      await expect(settingsLink).toHaveAttribute('href', './settings/');
    });

    test('should have skip link for accessibility', async ({ page }) => {
      await page.goto('/');
      const skipLink = page.locator('.skip-link');
      await expect(skipLink).toBeVisible();
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
