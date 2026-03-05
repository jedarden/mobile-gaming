import { defineConfig, devices } from '@playwright/test';

/**
 * E2E Test Configuration
 *
 * Uses Vite dev server (port 5173) locally and preview server in CI.
 * The preview server is more reliable in CI environments as it serves
 * the production build.
 */
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['html'], ['github']] : 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  // In CI: use preview server (production build) for faster, more reliable tests
  // Locally: use dev server for hot-reload during development
  webServer: isCI
    ? {
        command: 'npm run preview',
        url: 'http://localhost:5173',
        reuseExistingServer: false,
        timeout: 60000, // 1 minute for preview server startup
      }
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120000,
      },
});
