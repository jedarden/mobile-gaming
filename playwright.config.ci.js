// playwright.config.ci.js - CI-optimized configuration for faster test execution
import { defineConfig, devices } from '@playwright/test';

const previewPort = Number(process.env.PLAYWRIGHT_TEST_PORT || 4173);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // The Argo runner installs Chromium only, so this config must not depend on
  // the CI environment variable to exclude the WebKit project.
  retries: 1,
  reporter: 'list',

  // Optimize timeout settings for CI
  timeout: 20000,
  expect: {
    timeout: 10000,
  },

  use: {
    baseURL: `http://localhost:${previewPort}`,
    // Mobile viewport matching iPhone 14 — the canonical logical resolution for all portrait games
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Reduce action timeout for faster failure detection
    actionTimeout: 10000,
  },

  // Keep the CI entry point aligned with the browser installed by the workflow.
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // CI validates the built site after the explicit production build stage.
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${previewPort}`,
    port: previewPort,
    reuseExistingServer: false,
    timeout: 120000, // 2min timeout for server startup
  },

  // The Argo E2E container is limited to two CPUs; match its concurrency to
  // avoid browser and level-data requests timing out under four workers.
  workers: 2,
});
