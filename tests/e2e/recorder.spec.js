/**
 * Video Recording and Sharing - E2E Tests (Playwright)
 *
 * End-to-end tests for gameplay video recording and social sharing.
 */

import { test, expect } from '@playwright/test';

// Use a game that has canvas for testing
const GAME_URL = '/jelly-shift/';

test.describe('Video Recording Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    // Wait for canvas to render
    await page.waitForSelector('#game-container canvas', { timeout: 5000 });
  });

  test('recorder module should be importable', async ({ page }) => {
    // Wait for recorder.js module to load
    const modulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/recorder.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      try {
        const recorder = await import('/src/shared/recorder.js');
        return {
          hasFunctions: typeof recorder.startCapture === 'function' &&
            typeof recorder.startRecording === 'function' &&
            typeof recorder.stopRecording === 'function' &&
            typeof recorder.convertToMP4 === 'function'
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    // Ensure module loading has completed
    await modulePromise;

    expect(result.error).toBeUndefined();
    expect(result.hasFunctions).toBe(true);
  });

  test('should detect codec support', async ({ page }) => {
    // Wait for recorder.js module to load
    const modulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/recorder.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const recorder = await import('/src/shared/recorder.js');
      return {
        hasVP9Support: recorder.hasVP9Support(),
        hasH264Support: recorder.hasH264WebMSupport(),
        bestMimeType: recorder.getBestMimeType()
      };
    });

    // Ensure module loading has completed
    await modulePromise;

    expect(typeof result.hasVP9Support).toBe('boolean');
    expect(typeof result.hasH264Support).toBe('boolean');
    expect(result.bestMimeType).toContain('video/webm');
  });

  test('should create output canvas with correct dimensions', async ({ page }) => {
    // Wait for recorder.js module to load
    const modulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/recorder.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const recorder = await import('/src/shared/recorder.js');
      const { canvas, ctx } = recorder.createOutputCanvas();
      return {
        width: canvas.width,
        height: canvas.height,
        hasContext: ctx !== null
      };
    });

    // Ensure module loading has completed
    await modulePromise;

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(result.hasContext).toBe(true);
  });

  test('should calculate game position within output frame', async ({ page }) => {
    // Wait for recorder.js module to load
    const modulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/recorder.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const recorder = await import('/src/shared/recorder.js');

      // Test portrait game (390x844)
      const portraitPos = recorder.calculateGamePosition(390, 844);

      // Test landscape game (844x390)
      const landscapePos = recorder.calculateGamePosition(844, 390);

      return { portraitPos, landscapePos };
    });

    // Ensure module loading has completed
    await modulePromise;

    // Portrait should be centered with padding
    expect(result.portraitPos.x).toBeGreaterThanOrEqual(0);
    expect(result.portraitPos.y).toBeGreaterThanOrEqual(0);
    expect(result.portraitPos.width).toBeLessThanOrEqual(1080);
    expect(result.portraitPos.height).toBeLessThanOrEqual(1920);

    // Landscape should be centered with padding
    expect(result.landscapePos.x).toBeGreaterThanOrEqual(0);
    expect(result.landscapePos.y).toBeGreaterThanOrEqual(0);
    expect(result.landscapePos.width).toBeLessThanOrEqual(1080);
    expect(result.landscapePos.height).toBeLessThanOrEqual(1920);
  });

  test('should capture canvas stream', async ({ page }) => {
    // Wait for recorder.js module to load
    const modulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/recorder.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const recorder = await import('/src/shared/recorder.js');

      // Create a test canvas
      const canvas = document.createElement('canvas');
      canvas.width = 390;
      canvas.height = 844;

      try {
        const stream = recorder.startCapture(canvas, { fps: 30 });
        return {
          success: true,
          hasVideoTracks: stream.getVideoTracks().length > 0
        };
      } catch (e) {
        return { success: false, error: e.message };
      } finally {
        recorder.cleanup();
      }
    });

    // Ensure module loading has completed
    await modulePromise;

    expect(result.success).toBe(true);
    expect(result.hasVideoTracks).toBe(true);
  });

  test('should start and stop recording', async ({ page }) => {
    // Wait for recorder.js module to load
    const modulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/recorder.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const recorder = await import('/src/shared/recorder.js');

      // Create a test canvas
      const canvas = document.createElement('canvas');
      canvas.width = 390;
      canvas.height = 844;

      try {
        recorder.startCapture(canvas, { fps: 30 });
        await recorder.startRecording({ maxDuration: 5000 });

        const isActive = recorder.isActive();

        // Minimal wait for MediaRecorder to encode at least one frame.
        // MediaRecorder starts asynchronously and requires time for the encoder
        // to produce data. Without this, stopRecording() may return an empty blob.
        await new Promise(r => setTimeout(r, 50));

        const blob = await recorder.stopRecording();

        return {
          wasActive: isActive,
          blobSize: blob.size,
          blobType: blob.type
        };
      } catch (e) {
        return { error: e.message };
      } finally {
        recorder.cleanup();
      }
    });

    // Ensure module loading has completed
    await modulePromise;

    expect(result.error).toBeUndefined();
    expect(result.wasActive).toBe(true);
    expect(result.blobType).toBe('video/webm');
  });

  test('should get recording status', async ({ page }) => {
    // Wait for recorder.js module to load
    const modulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/recorder.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const recorder = await import('/src/shared/recorder.js');

      // Initial status
      const initialStatus = recorder.getStatus();

      // Create canvas and start recording
      const canvas = document.createElement('canvas');
      canvas.width = 390;
      canvas.height = 844;

      try {
        recorder.startCapture(canvas, { fps: 30 });
        await recorder.startRecording({ maxDuration: 5000 });

        const recordingStatus = recorder.getStatus();

        return {
          initialNotRecording: !initialStatus.isRecording,
          recordingActive: recordingStatus.isRecording,
          hasDuration: recordingStatus.duration >= 0
        };
      } catch (e) {
        return { error: e.message };
      } finally {
        recorder.cleanup();
      }
    });

    // Ensure module loading has completed
    await modulePromise;

    expect(result.error).toBeUndefined();
    expect(result.initialNotRecording).toBe(true);
    expect(result.recordingActive).toBe(true);
    expect(result.hasDuration).toBe(true);
  });
});

test.describe('Video Overlay Module', () => {
  test('overlay module should be importable', async ({ page }) => {
    // Wait for video-overlay.js module to load from network
    const overlayModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/video-overlay.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      try {
        const overlay = await import('/src/shared/video-overlay.js');
        return {
          hasFunctions: typeof overlay.drawIntroFrame === 'function' &&
            typeof overlay.drawOutroFrame === 'function' &&
            typeof overlay.drawWatermark === 'function' &&
            typeof overlay.renderFrame === 'function'
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    // Ensure module loading has completed
    await overlayModulePromise;

    expect(result.error).toBeUndefined();
    expect(result.hasFunctions).toBe(true);
  });

  test('should create overlay canvas', async ({ page }) => {
    // Wait for video-overlay.js module to load from network
    const overlayModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/video-overlay.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const overlay = await import('/src/shared/video-overlay.js');
      const { canvas, ctx } = overlay.createOverlayCanvas();
      return {
        width: canvas.width,
        height: canvas.height,
        hasContext: ctx !== null
      };
    });

    // Ensure module loading has completed
    await overlayModulePromise;

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(result.hasContext).toBe(true);
  });

  test('should draw intro frame', async ({ page }) => {
    // Wait for video-overlay.js module to load from network
    const overlayModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/video-overlay.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const overlay = await import('/src/shared/video-overlay.js');
      const { canvas, ctx } = overlay.createOverlayCanvas();

      overlay.drawIntroFrame(ctx, {
        gameName: 'Test Game',
        dailyChallenge: 'Daily Challenge — Mar 20',
        difficulty: 'Easy'
      }, 1);

      // Check that canvas has been drawn on
      const imageData = ctx.getImageData(0, 0, 100, 100);
      return {
        hasDrawing: imageData.data.some(v => v !== 0)
      };
    });

    // Ensure module loading has completed
    await overlayModulePromise;

    expect(result.hasDrawing).toBe(true);
  });

  test('should draw outro frame with stats', async ({ page }) => {
    // Wait for video-overlay.js module to load from network
    const overlayModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/video-overlay.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const overlay = await import('/src/shared/video-overlay.js');
      const { canvas, ctx } = overlay.createOverlayCanvas();

      overlay.drawOutroFrame(ctx, {
        stats: {
          moves: 14,
          time: 45,
          score: 1000,
          stars: 3
        },
        qrUrl: 'https://example.com/game?level=1',
        gameName: 'Test Game'
      }, 1);

      // Check that canvas has been drawn on
      const imageData = ctx.getImageData(0, 0, 100, 100);
      return {
        hasDrawing: imageData.data.some(v => v !== 0)
      };
    });

    // Ensure module loading has completed
    await overlayModulePromise;

    expect(result.hasDrawing).toBe(true);
  });

  test('should calculate frame counts', async ({ page }) => {
    // Wait for video-overlay.js module to load from network
    const overlayModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/video-overlay.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const overlay = await import('/src/shared/video-overlay.js');
      return {
        introFrames: overlay.getIntroFrameCount(30),
        outroFrames: overlay.getOutroFrameCount(30),
        totalDuration: overlay.getTotalOverlayDuration()
      };
    });

    // Ensure module loading has completed
    await overlayModulePromise;

    // Intro is 1.5s at 30fps = 45 frames
    expect(result.introFrames).toBe(45);
    // Outro is 2s at 30fps = 60 frames
    expect(result.outroFrames).toBe(60);
    // Total duration should be 3500ms
    expect(result.totalDuration).toBe(3500);
  });
});

test.describe('Share Module', () => {
  test('share module should be importable', async ({ page }) => {
    // Wait for share.js module to load from network
    const shareModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/share.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      try {
        const share = await import('/src/shared/share.js');
        return {
          hasFunctions: typeof share.shareViaWebAPI === 'function' &&
            typeof share.shareToPlatform === 'function' &&
            typeof share.showShareOverlay === 'function' &&
            typeof share.quickShare === 'function'
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    // Ensure module loading has completed
    await shareModulePromise;

    expect(result.error).toBeUndefined();
    expect(result.hasFunctions).toBe(true);
  });

  test('should detect Web Share support', async ({ page }) => {
    // Wait for share.js module to load from network
    const shareModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/share.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const share = await import('/src/shared/share.js');
      return {
        hasWebShare: share.hasWebShareSupport(),
        hasFileShare: share.hasFileShareSupport()
      };
    });

    // Ensure module loading has completed
    await shareModulePromise;

    // In Chromium, Web Share may or may not be available
    expect(typeof result.hasWebShare).toBe('boolean');
    expect(typeof result.hasFileShare).toBe('boolean');
  });

  test('should get available platforms', async ({ page }) => {
    // Wait for share.js module to load from network
    const shareModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/share.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const share = await import('/src/shared/share.js');
      const platforms = share.getAvailablePlatforms();
      return { platforms };
    });

    // Ensure module loading has completed
    await shareModulePromise;

    expect(Array.isArray(result.platforms)).toBe(true);
    expect(result.platforms.length).toBeGreaterThan(0);
    // Copy link should always be available
    expect(result.platforms).toContain('copyLink');
  });

  test('should generate share text', async ({ page }) => {
    // Wait for share.js module to load from network
    const shareModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/share.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const share = await import('/src/shared/share.js');
      const text = share.generateShareText({
        gameName: 'Water Sort',
        moves: 14,
        time: 45,
        stars: 3
      });
      return { text };
    });

    // Ensure module loading has completed
    await shareModulePromise;

    expect(result.text).toContain('Water Sort');
    expect(result.text).toContain('14 moves');
    expect(result.text).toContain('45');
  });

  test('should show share overlay', async ({ page }) => {
    // Wait for share.js module to load from network
    const shareModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/share.js') && response.status() === 200
    );

    await page.evaluate(async () => {
      const share = await import('/src/shared/share.js');
      await share.showShareOverlay({
        title: 'Test Game',
        text: 'Check this out!',
        url: 'https://example.com/game',
        videoBlob: new Blob(['test'], { type: 'video/webm' })
      });
    });

    // Ensure module loading has completed
    await shareModulePromise;

    // Wait for overlay to appear
    const overlay = page.locator('#share-overlay');
    await expect(overlay).toBeVisible({ timeout: 2000 });

    // Check for platform buttons
    await expect(overlay.locator('.share-platform-btn')).toHaveCount({ gte: 1 });
  });

  test('should hide share overlay', async ({ page }) => {
    // Wait for share.js module to load from network
    const shareModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/share.js') && response.status() === 200
    );

    await page.evaluate(async () => {
      const share = await import('/src/shared/share.js');
      await share.showShareOverlay({
        title: 'Test Game',
        videoBlob: new Blob(['test'], { type: 'video/webm' })
      });
    });

    // Ensure module loading has completed
    await shareModulePromise;

    const overlay = page.locator('#share-overlay');
    await expect(overlay).toBeVisible({ timeout: 2000 });

    // Click close button
    await overlay.locator('.share-close').click();

    // Wait for overlay to be hidden after animation
    await expect(overlay).not.toBeVisible({ timeout: 800 });
  });

  test('should handle copy link action', async ({ page }) => {
    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Wait for share.js module to load from network
    const shareModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/share.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const share = await import('/src/shared/share.js');
      return await share.shareToPlatform('copyLink', {
        url: 'https://example.com/test-game'
      });
    });

    // Ensure module loading has completed
    await shareModulePromise;

    expect(result.success).toBe(true);
    expect(result.message).toContain('copied');
  });

  test('should handle Twitter share', async ({ page }) => {
    // Wait for share.js module to load from network
    const shareModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/share.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const share = await import('/src/shared/share.js');
      return await share.shareToPlatform('twitter', {
        text: 'Check out my game!',
        url: 'https://example.com/game'
      });
    });

    // Ensure module loading has completed
    await shareModulePromise;

    expect(result.success).toBe(true);
    expect(result.openUrl).toContain('twitter.com/intent/tweet');
  });

  test('should handle Facebook share', async ({ page }) => {
    // Wait for share.js module to load from network
    const shareModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/share.js') && response.status() === 200
    );

    const result = await page.evaluate(async () => {
      const share = await import('/src/shared/share.js');
      return await share.shareToPlatform('facebook', {
        text: 'Check this out',
        url: 'https://example.com/game'
      });
    });

    // Ensure module loading has completed
    await shareModulePromise;

    expect(result.success).toBe(true);
    expect(result.openUrl).toContain('facebook.com/sharer');
  });

  test('should have download button in overlay', async ({ page }) => {
    // Wait for share.js module to load from network
    const shareModulePromise = page.waitForResponse(response =>
      response.url().includes('/src/shared/share.js') && response.status() === 200
    );

    await page.evaluate(async () => {
      const share = await import('/src/shared/share.js');
      await share.showShareOverlay({
        title: 'Test Game',
        videoBlob: new Blob(['test'], { type: 'video/webm' })
      });
    });

    // Ensure module loading has completed
    await shareModulePromise;

    const overlay = page.locator('#share-overlay');
    await expect(overlay).toBeVisible({ timeout: 2000 });

    // Check for download button
    await expect(overlay.locator('.share-download-btn')).toBeVisible();
    await expect(overlay.locator('.share-download-btn')).toContainText('Download');
  });
});
