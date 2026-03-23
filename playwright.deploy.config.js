// playwright.deploy.config.js
// Run against the live Cloudflare Pages deployment.
// Usage: npm run test:deploy
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: ['**/*.spec.js'],
  fullyParallel: true,
  retries: 1,
  reporter: 'list',

  use: {
    baseURL: 'https://mobile-gaming.pages.dev',
    // Mobile viewport matching iPhone 14
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    // Longer timeouts for network latency
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
  // No webServer — tests run against the live site
});
