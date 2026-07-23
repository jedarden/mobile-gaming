/**
 * Fail Speedrun Mode - E2E Tests (Playwright)
 *
 * End-to-end tests for fail speedrun mode functionality.
 */

import { test, expect } from '@playwright/test';

// Test page URL - we'll use a simple test harness
const TEST_URL = '/tests/e2e/fixtures/fail-speedrun-harness.html';

test.describe('Fail Speedrun Mode', () => {
  test.describe('Core Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(TEST_URL);
      await page.waitForSelector('#test-container', { timeout: 5000 });
    });

    test('should create fail speedrun instance', async ({ page }) => {
      const result = await page.evaluate(() => {
        const { createFailSpeedrun } = window.failSpeedrun;
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });
        return {
          created: !!speedrun,
          hasStart: typeof speedrun.start === 'function',
          hasRecordInput: typeof speedrun.recordInput === 'function',
          hasRecordFail: typeof speedrun.recordFail === 'function'
        };
      });

      expect(result.created).toBe(true);
      expect(result.hasStart).toBe(true);
      expect(result.hasRecordInput).toBe(true);
      expect(result.hasRecordFail).toBe(true);
    });

    test('should start timer on first input', async ({ page }) => {
      const result = await page.evaluate(() => {
        const { createFailSpeedrun } = window.failSpeedrun;
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });

        speedrun.start();

        // Before input
        const beforeInput = speedrun.getElapsedTime();

        // Simulate first input
        speedrun.recordInput();

        // After input
        const afterInput = speedrun.getElapsedTime();

        return {
          beforeInputIsNull: beforeInput === null,
          afterInputIsNumber: typeof afterInput === 'number',
          afterInputIsZero: afterInput === 0
        };
      });

      expect(result.beforeInputIsNull).toBe(true);
      expect(result.afterInputIsNumber).toBe(true);
      expect(result.afterInputIsZero).toBe(true);
    });

    test('should record fail and return time', async ({ page }) => {
      const result = await page.evaluate(() => {
        return new Promise((resolve) => {
          const { createFailSpeedrun } = window.failSpeedrun;
          const speedrun = createFailSpeedrun({
            gameId: 'pull-the-pin',
            levelIndex: 0,
            onFail: (timeMs, isNewBest, badgeAwarded) => {
              resolve({
                timeMs,
                isNewBest,
                badgeAwarded,
                timeIsNumber: typeof timeMs === 'number'
              });
            }
          });

          speedrun.start();
          speedrun.recordInput();

          // Simulate some time passing
          setTimeout(() => {
            speedrun.recordFail();
          }, 100);
        });
      });

      expect(result.timeIsNumber).toBe(true);
      expect(result.timeMs).toBeGreaterThanOrEqual(90);
      expect(result.isNewBest).toBe(true);
    });

    test('should save personal best to localStorage', async ({ page }) => {
      await page.evaluate(() => {
        const { createFailSpeedrun } = window.failSpeedrun;
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });

        speedrun.start();
        speedrun.recordInput();

        return new Promise((resolve) => {
          setTimeout(() => {
            speedrun.recordFail();
            resolve();
          }, 150);
        });
      });

      // Check localStorage
      const bestTime = await page.evaluate(() => {
        const { getPersonalBest } = window.failSpeedrun;
        return getPersonalBest('pull-the-pin', 0);
      });

      expect(bestTime).toBeDefined();
      expect(bestTime).toBeGreaterThanOrEqual(140);
    });
  });

  test.describe('Game Support', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(TEST_URL);
      await page.waitForSelector('#test-container', { timeout: 5000 });
    });

    test('should identify supported games', async ({ page }) => {
      const result = await page.evaluate(() => {
        const { isGameSupported, getSupportedGames } = window.failSpeedrun;
        return {
          pullThePinSupported: isGameSupported('pull-the-pin'),
          waterSortSupported: isGameSupported('water-sort'),
          jellyShiftSupported: isGameSupported('jelly-shift'),
          asmrExcluded: isGameSupported('satisfying-asmr'),
          unknownNotSupported: isGameSupported('unknown-game'),
          supportedCount: getSupportedGames().length
        };
      });

      expect(result.pullThePinSupported).toBe(true);
      expect(result.waterSortSupported).toBe(true);
      expect(result.jellyShiftSupported).toBe(true);
      expect(result.asmrExcluded).toBe(false);
      expect(result.unknownNotSupported).toBe(false);
      // Per spec: "Fail speedrun available for 10 of 12 games"
      expect(result.supportedCount).toBe(10);
    });

    test('should have fail objectives for all supported games', async ({ page }) => {
      const result = await page.evaluate(() => {
        const { getSupportedGames, getGameConfig } = window.failSpeedrun;
        const games = getSupportedGames();
        return games.map(gameId => {
          const config = getGameConfig(gameId);
          return {
            gameId,
            hasObjective: !!config?.failObjective,
            objectiveLength: config?.failObjective?.length || 0
          };
        });
      });

      for (const game of result) {
        expect(game.hasObjective).toBe(true);
        expect(game.objectiveLength).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Ad Recreation Badge', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(TEST_URL);
      await page.waitForSelector('#test-container', { timeout: 5000 });
    });

    test('should award badge for under 3s on pull-the-pin', async ({ page }) => {
      const result = await page.evaluate(() => {
        const { createFailSpeedrun, getEarnedBadges } = window.failSpeedrun;

        return new Promise((resolve) => {
          const speedrun = createFailSpeedrun({
            gameId: 'pull-the-pin',
            levelIndex: 0,
            onFail: (timeMs, isNewBest, badgeAwarded) => {
              const badges = getEarnedBadges();
              resolve({
                badgeAwarded,
                hasAdRecreationBadge: badges.some(b => b.type === 'ad-recreation'),
                timeUnderThreshold: timeMs < 3000
              });
            }
          });

          speedrun.start();
          speedrun.recordInput();

          // Fail quickly (under 3s)
          setTimeout(() => {
            speedrun.recordFail();
          }, 500);
        });
      });

      expect(result.timeUnderThreshold).toBe(true);
      expect(result.badgeAwarded).toBe(true);
      expect(result.hasAdRecreationBadge).toBe(true);
    });

    test('should not award badge for over 3s', async ({ page }) => {
      const result = await page.evaluate(() => {
        const { createFailSpeedrun, getEarnedBadges } = window.failSpeedrun;

        // Clear any existing badges
        localStorage.removeItem('fail-speedrun:badges');

        return new Promise((resolve) => {
          const speedrun = createFailSpeedrun({
            gameId: 'pull-the-pin',
            levelIndex: 0,
            onFail: (timeMs, isNewBest, badgeAwarded) => {
              resolve({
                badgeAwarded,
                timeOverThreshold: timeMs >= 3000
              });
            }
          });

          speedrun.start();
          speedrun.recordInput();

          // Fail slowly (over 3s)
          setTimeout(() => {
            speedrun.recordFail();
          }, 3100);
        });
      });

      expect(result.timeOverThreshold).toBe(true);
      expect(result.badgeAwarded).toBe(false);
    });

    test('should not award badge for non-eligible games', async ({ page }) => {
      const result = await page.evaluate(() => {
        const { createFailSpeedrun, getEarnedBadges } = window.failSpeedrun;

        localStorage.removeItem('fail-speedrun:badges');

        return new Promise((resolve) => {
          const speedrun = createFailSpeedrun({
            gameId: 'water-sort', // Not eligible for badge
            levelIndex: 0,
            onFail: (timeMs, isNewBest, badgeAwarded) => {
              resolve({ badgeAwarded });
            }
          });

          speedrun.start();
          speedrun.recordInput();

          setTimeout(() => {
            speedrun.recordFail();
          }, 100);
        });
      });

      expect(result.badgeAwarded).toBe(false);
    });
  });

  test.describe('Timer Precision', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(TEST_URL);
      await page.waitForSelector('#test-container', { timeout: 5000 });
    });

    test('should have millisecond precision', async ({ page }) => {
      const result = await page.evaluate(() => {
        const { createFailSpeedrun, formatTime } = window.failSpeedrun;

        return new Promise((resolve) => {
          const speedrun = createFailSpeedrun({
            gameId: 'pull-the-pin',
            levelIndex: 0,
            onFail: (timeMs) => {
              const formatted = formatTime(timeMs);
              resolve({
                timeMs,
                formatted,
                hasDecimalPoint: formatted.includes('.'),
                hasThreeDecimalPlaces: /\.\d{3}$/.test(formatted)
              });
            }
          });

          speedrun.start();
          speedrun.recordInput();

          setTimeout(() => {
            speedrun.recordFail();
          }, 123);
        });
      });

      expect(result.hasDecimalPoint).toBe(true);
      expect(result.hasThreeDecimalPlaces).toBe(true);
    });

    test('formatTime should format correctly', async ({ page }) => {
      const result = await page.evaluate(() => {
        const { formatTime } = window.failSpeedrun;
        return {
          subSecond: formatTime(500),
          oneSecond: formatTime(1000),
          withMs: formatTime(1234),
          oneMinute: formatTime(60000),
          overMinute: formatTime(90000),
          nullValue: formatTime(null)
        };
      });

      expect(result.subSecond).toBe('0.500');
      expect(result.oneSecond).toBe('1.000');
      expect(result.withMs).toBe('1.234');
      expect(result.oneMinute).toBe('1:00.000');
      expect(result.overMinute).toBe('1:30.000');
      expect(result.nullValue).toBe('--:--.---');
    });
  });

  test.describe('UI Overlay', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(TEST_URL);
      await page.waitForSelector('#test-container', { timeout: 5000 });
    });

    test('should show fail result overlay', async ({ page }) => {
      await page.evaluate(() => {
        const { showFailResult } = window.failSpeedrun;
        showFailResult({
          gameId: 'pull-the-pin',
          levelIndex: 0,
          timeMs: 1500,
          isNewBest: true,
          badgeAwarded: false,
          container: document.getElementById('test-container')
        });
      });

      // Wait for overlay to appear
      await page.waitForSelector('.fs-overlay.fs-visible', { timeout: 2000 });

      // Check overlay content
      const overlay = page.locator('.fs-overlay');
      await expect(overlay).toContainText('FAIL');
      await expect(overlay).toContainText('Fail Speedrun');
      await expect(overlay).toContainText('1.500');
    });

    test('should show badge in overlay when awarded', async ({ page }) => {
      await page.evaluate(() => {
        const { showFailResult } = window.failSpeedrun;
        showFailResult({
          gameId: 'pull-the-pin',
          levelIndex: 0,
          timeMs: 1500,
          isNewBest: true,
          badgeAwarded: true,
          container: document.getElementById('test-container')
        });
      });

      await page.waitForSelector('.fs-overlay.fs-visible', { timeout: 2000 });

      const overlay = page.locator('.fs-overlay');
      await expect(overlay).toContainText('Ad Recreation Badge');
    });

    test('should hide overlay on button click', async ({ page }) => {
      await page.evaluate(() => {
        const { showFailResult } = window.failSpeedrun;
        window.testOverlay = showFailResult({
          gameId: 'pull-the-pin',
          levelIndex: 0,
          timeMs: 1500,
          isNewBest: false,
          badgeAwarded: false,
          container: document.getElementById('test-container'),
          onClose: () => {}
        });
      });

      await page.waitForSelector('.fs-overlay.fs-visible', { timeout: 2000 });

      // Click exit button
      await page.click('.fs-btn[data-action="close"]');

      // Wait for overlay to hide
      await page.waitForSelector('.fs-overlay:not(.fs-visible)', { timeout: 2000 });
    });
  });

  test.describe('Settings', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(TEST_URL);
      await page.waitForSelector('#test-container', { timeout: 5000 });
    });

    test('should toggle fail speedrun mode', async ({ page }) => {
      const result = await page.evaluate(() => {
        const { toggleFailSpeedrun, isFailSpeedrunEnabled } = window.failSpeedrun;

        const initially = isFailSpeedrunEnabled('pull-the-pin');
        const afterToggle1 = toggleFailSpeedrun('pull-the-pin');
        const afterToggle2 = toggleFailSpeedrun('pull-the-pin');

        return {
          initially,
          afterToggle1,
          afterToggle2
        };
      });

      expect(result.initially).toBe(false);
      expect(result.afterToggle1).toBe(true);
      expect(result.afterToggle2).toBe(false);
    });

    test('should persist setting', async ({ page }) => {
      await page.evaluate(() => {
        const { setFailSpeedrunEnabled, isFailSpeedrunEnabled } = window.failSpeedrun;
        setFailSpeedrunEnabled('water-sort', true);
      });

      // Reload page
      await page.reload();
      await page.waitForSelector('#test-container', { timeout: 5000 });

      const isEnabled = await page.evaluate(() => {
        const { isFailSpeedrunEnabled } = window.failSpeedrun;
        return isFailSpeedrunEnabled('water-sort');
      });

      expect(isEnabled).toBe(true);
    });
  });
});
