// playwright.config.ci.js - CI-optimized configuration for faster test execution
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // Reduce retries in CI for faster feedback
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  // Optimize timeout settings for CI
  timeout: 10000, // 10s per test (down from default 30s)
  expect: {
    timeout: 5000, // 5s for assertions (down from default 5s)
  },

  use: {
    baseURL: 'http://localhost:4173',
    // Mobile viewport matching iPhone 14 — the canonical logical resolution for all portrait games
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Reduce action timeout for faster failure detection
    actionTimeout: 5000,
  },

  // CI: Run only mobile-chrome for faster execution (50% reduction in test time)
  // Local: Run both browsers for comprehensive testing
  projects: process.env.CI ? [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ] : [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],

  // Start Vite preview server before running tests
  webServer: {
    command: 'npx vite preview --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2min timeout for server startup
  },

  // Optimize worker count for CI
  workers: process.env.CI ? 4 : undefined, // 4 parallel workers in CI, auto-detect locally
});