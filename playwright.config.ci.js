// playwright.config.ci.js - CI-optimized configuration for faster test execution
import { defineConfig, devices } from '@playwright/test';

const previewPort = Number(process.env.PLAYWRIGHT_TEST_PORT || 4173);
const useProductionPreview = process.env.PLAYWRIGHT_TEST_SERVER === 'preview';
const webServerCommand = useProductionPreview
  ? `npx vite preview --host 127.0.0.1 --port ${previewPort}`
  : `npx vite --host 127.0.0.1 --port ${previewPort}`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // The Argo runner installs Chromium only, so this config must not depend on
  // the CI environment variable to exclude the WebKit project.
  retries: 1,
  reporter: 'list',

  // Optimize timeout settings for CI
  timeout: 10000, // 10s per test (down from default 30s)
  expect: {
    timeout: 5000, // 5s for assertions (down from default 5s)
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
    actionTimeout: 5000,
  },

  // Keep the CI entry point aligned with the browser installed by the workflow.
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // E2E suites inspect Vite-served source modules. CI can opt into a production
  // preview for deployable-output smoke tests after the build stage.
  webServer: {
    command: webServerCommand,
    port: previewPort,
    reuseExistingServer: false,
    timeout: 120000, // 2min timeout for server startup
  },

  workers: 4,
});
