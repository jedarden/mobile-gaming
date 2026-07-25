/**
 * Gameplay Share Wiring - E2E Tests (Playwright)
 *
 * Covers Phase 6.5: passive gameplay recording + "Share your solve" flow
 * wired into real games via shared/gameplay-share.js.
 *
 * Two things are asserted:
 *   1. Wired games expose a live SolveRecorder that starts capturing.
 *   2. The record -> convert -> share picker flow runs without throwing and
 *      produces a video-backed share overlay.
 */

import { test, expect } from '@playwright/test';

test.describe('Share your solve - game wiring', () => {
  // water-sort (puzzle) and crowd-runner (runner) are the two wired games.
  for (const { name, url, canvasSelector } of [
    { name: 'water-sort', url: '/water-sort/', canvasSelector: '#game-canvas' },
    { name: 'crowd-runner', url: '/crowd-runner/', canvasSelector: '#game-container canvas' },
  ]) {
    test(`${name} starts a passive solve recorder`, async ({ page }) => {
      await page.goto(url);
      await page.waitForSelector(canvasSelector, { timeout: 10000 });

      // The game exposes its recorder for verification; wait for capture to
      // actually begin (startRecording resolves asynchronously).
      await page.waitForFunction(
        () => !!window.__solveRecorder &&
          typeof window.__solveRecorder.shareSolve === 'function' &&
          window.__solveRecorder.isCapturing(),
        { timeout: 10000 }
      );

      const info = await page.evaluate(() => ({
        hasShare: typeof window.__solveRecorder.shareSolve === 'function',
        capturing: window.__solveRecorder.isCapturing(),
      }));

      expect(info.hasShare).toBe(true);
      expect(info.capturing).toBe(true);
    });
  }
});

test.describe('Share your solve - record and share flow', () => {
  // Use an unwired game page so the recorder singleton is not already in use.
  test.beforeEach(async ({ page }) => {
    await page.goto('/jelly-shift/');
    await page.waitForSelector('#game-container canvas', { timeout: 10000 });
  });

  test('records a clip, burns the outro card, and opens the share picker', async ({ page }) => {
    // Wait for gameplay-share.js module to load
    const modulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/gameplay-share.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const { createSolveRecorder } = await import('/src/shared/gameplay-share.js');

      // A plain 2D canvas stands in for the game canvas so the flow is
      // deterministic and independent of WebGL availability.
      const canvas = document.createElement('canvas');
      canvas.width = 390;
      canvas.height = 844;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#3355ff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      document.body.appendChild(canvas);

      try {
        const rec = createSolveRecorder({ canvas, gameName: 'Jelly Shift' });
        await rec.start();

        const capturing = rec.isCapturing();

        // Wait for MediaRecorder to encode at least one frame by polling
        // for buffered chunks instead of using a fixed timeout.
        const { recorder } = await import('/src/shared/recorder.js');
        await new Promise((resolve) => {
          const checkChunks = () => {
            if (recorder.getBufferedChunks().length > 0) {
              resolve();
            } else {
              setTimeout(checkChunks, 5);
            }
          };
          checkChunks();
        });
        await rec.shareSolve({
          stats: { moves: 12, time: 34, stars: 3 },
          url: 'https://example.com/jelly-shift',
        });

        return { threw: false, capturing };
      } catch (e) {
        return { threw: true, error: e.message };
      }
    });

    // Ensure module loading has completed
    await modulePromise;

    expect(result.threw).toBe(false);
    expect(result.capturing).toBe(true);

    // Wait for share.js module to load for share picker initialization
    // Desktop Chromium is not "mobile", so share.js renders the custom picker.
    const shareModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/share.js') && response.status() === 200
    ).catch(() => null); // No-op if already loaded or no network request

    const overlay = page.locator('#share-overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });

    // Ensure share.js has loaded before checking picker elements
    await shareModulePromise;

    await expect(overlay.locator('.share-platform-btn').first()).toBeVisible();
    // A recorded clip was attached, so the download (video) action is present.
    await expect(overlay.locator('.share-download-btn')).toBeVisible();
  });
});
