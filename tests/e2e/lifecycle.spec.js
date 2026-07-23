/**
 * Visibilitychange Lifecycle - E2E Tests (Playwright)
 *
 * Tests the pause/resume behavior for runner/timed games and state
 * persistence for puzzle games when the page visibility changes.
 */

import { test, expect } from '@playwright/test';

test.describe('Visibilitychange Lifecycle', () => {
  test.describe('Runner/Timed Games', () => {
    const RUNNER_GAMES = [
      { name: 'Crowd Runner', url: '/crowd-runner/', displayId: '#crowd-display' },
      { name: 'Giant Runner', url: '/giant-runner/', displayId: '#giant-display' },
      { name: 'Bridge Race', url: '/bridge-race/', displayId: '#bridge-display' },
    ];

    RUNNER_GAMES.forEach(({ name, url, displayId }) => {
      test.describe(name, () => {
        test.beforeEach(async ({ page }) => {
          await page.goto(url);
          // Wait for game to initialize
          await page.waitForSelector('canvas', { timeout: 10000 });
          // Wait for lifecycle ready() to complete
          await page.waitForTimeout(500);
        });

        test('shows resume overlay after visibilitychange to hidden', async ({ page }) => {
          // Initially, the resume overlay should be hidden
          await expect(page.locator('#mg-resume')).not.toBeVisible();

          // Simulate the page becoming hidden (document.hidden = true)
          await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { value: true, writable: true });
            document.dispatchEvent(new Event('visibilitychange'));
          });

          // The resume overlay should now be visible
          await expect(page.locator('#mg-resume')).toBeVisible();
          await expect(page.locator('.mg-resume-text')).toContainText('Paused');
          await expect(page.locator('.mg-resume-btn')).toContainText('Tap to Continue');
        });

        test('game does not auto-resume on visibility alone', async ({ page }) => {
          // Trigger visibilitychange to hidden
          await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { value: true, writable: true });
            document.dispatchEvent(new Event('visibilitychange'));
          });

          await expect(page.locator('#mg-resume')).toBeVisible();

          // Simulate page becoming visible again (document.hidden = false)
          await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { value: false, writable: true });
            document.dispatchEvent(new Event('visibilitychange'));
          });

          // The overlay should still be visible (requires tap to continue)
          await expect(page.locator('#mg-resume')).toBeVisible();
        });

        test('game resumes only after tapping the resume button', async ({ page }) => {
          // Trigger visibilitychange
          await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { value: true, writable: true });
            document.dispatchEvent(new Event('visibilitychange'));
          });

          await expect(page.locator('#mg-resume')).toBeVisible();

          // Resume by tapping the button
          await page.click('.mg-resume-btn');

          // Overlay should be hidden after clicking resume
          await expect(page.locator('#mg-resume')).not.toBeVisible();
        });

        test('saves game state when page is hidden', async ({ page }) => {
          // Navigate to level 2 to create a non-default state
          await page.click('#btn-next');
          await expect(page.locator('#level-display')).toHaveText('2');

          // Trigger visibilitychange to trigger state save
          await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { value: true, writable: true });
            document.dispatchEvent(new Event('visibilitychange'));
          });

          // Verify state was saved to localStorage
          const savedState = await page.evaluate(() => {
            const key = 'mg:crowd-runner:state'; // or giant-runner, bridge-race
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
          });

          expect(savedState).not.toBeNull();
          expect(savedState.currentLevelIndex).toBe(1); // Level 2 (0-indexed)
        });

        test('game is frozen when paused (no visual updates)', async ({ page }) => {
          // Get the current level display value
          const initialLevel = await page.locator('#level-display').textContent();

          // Trigger pause via visibilitychange
          await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { value: true, writable: true });
            document.dispatchEvent(new Event('visibilitychange'));
          });

          // The resume overlay should be visible
          await expect(page.locator('#mg-resume')).toBeVisible();

          // Wait a bit - if the game were running, something would change
          await page.waitForTimeout(1000);

          // Level should not have changed (game is frozen)
          const levelAfterWait = await page.locator('#level-display').textContent();
          expect(levelAfterWait).toBe(initialLevel);

          // Verify we can't interact with the game while paused
          // (overlay blocks clicks)
          const overlayVisible = await page.locator('#mg-resume').isVisible();
          expect(overlayVisible).toBe(true);
        });
      });
    });
  });

  test.describe('Puzzle Games', () => {
    const PUZZLE_GAMES = [
      { name: 'Water Sort', url: '/water-sort/' },
      { name: 'Pull The Pin', url: '/pull-the-pin/' },
      { name: 'Parking Escape', url: '/parking-escape/' },
    ];

    PUZZLE_GAMES.forEach(({ name, url }) => {
      test.describe(name, () => {
        test.beforeEach(async ({ page }) => {
          await page.goto(url);
          await page.waitForSelector('canvas', { timeout: 10000 });
          await page.waitForTimeout(500);
        });

        test('persists game state on visibilitychange without showing overlay', async ({ page }) => {
          // For water-sort, make a move to create in-progress state
          if (url === '/water-sort/') {
            const canvas = page.locator('#game-canvas');
            const box = await canvas.boundingBox();
            // Tap to make a move
            await page.tap('#game-canvas', { position: { x: box.width * 0.2, y: box.height * 0.5 } });
            await page.waitForTimeout(200);
          }

          // No resume overlay should exist for puzzle games (they don't pause)
          const resumeOverlay = page.locator('#mg-resume');
          const hasOverlay = await resumeOverlay.count();
          expect(hasOverlay).toBe(0);

          // Trigger visibilitychange to trigger state persistence
          await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { value: true, writable: true });
            document.dispatchEvent(new Event('visibilitychange'));
          });

          // State should be persisted to storage
          const stateKey = await page.evaluate(() => {
            // Determine the storage key based on game
            if (window.location.pathname.includes('water-sort')) return 'mg:water-sort:progress';
            if (window.location.pathname.includes('pull-the-pin')) return 'mg:pull-the-pin:progress';
            if (window.location.pathname.includes('parking-escape')) return 'mg:parking-escape:progress';
            return null;
          });

          expect(stateKey).toBeTruthy();

          const hasState = await page.evaluate((key) => {
            const item = localStorage.getItem(key);
            return item !== null;
          }, stateKey);

          expect(hasState).toBe(true);
        });

        test('restores persisted state on page reload', async ({ page }) => {
          // For water-sort, make a move to create distinctive state
          if (url === '/water-sort/') {
            await page.waitForFunction(() => window.__wsGame && window.__wsGame.state);

            // Make a move to increment the move counter
            const beforeState = await page.evaluate(() => {
              const g = window.__wsGame;
              g.state.moves = 5;
              g.updateUI();
              return {
                moves: g.state.moves,
                level: g.currentLevelIndex,
                sig: g.state.tubes.map(t => t.segments.join('/')).join('|')
              };
            });

            // Trigger visibilitychange to persist
            await page.evaluate(() => {
              Object.defineProperty(document, 'hidden', { value: true, writable: true });
              document.dispatchEvent(new Event('visibilitychange'));
            });

            // Reload the page
            await page.goto(url);
            await page.waitForSelector('#game-canvas');
            await page.waitForTimeout(500);

            // State should be restored
            const afterState = await page.evaluate(() => {
              if (!window.__wsGame || !window.__wsGame.state) return null;
              return {
                moves: window.__wsGame.state.moves,
                level: window.__wsGame.currentLevelIndex,
                sig: window.__wsGame.state.tubes.map(t => t.segments.join('/')).join('|')
              };
            });

            // The restored state should match what we saved
            expect(afterState).not.toBeNull();
            expect(afterState.moves).toBe(beforeState.moves);
            expect(afterState.level).toBe(beforeState.level);
          }
        });

        test('clears persisted state after restoration', async ({ page }) => {
          if (url === '/water-sort/') {
            await page.waitForFunction(() => window.__wsGame && window.__wsGame.state);

            // Create and persist state
            await page.evaluate(() => {
              const g = window.__wsGame;
              g.state.moves = 3;
              g.updateUI();
            });

            await page.evaluate(() => {
              Object.defineProperty(document, 'hidden', { value: true, writable: true });
              document.dispatchEvent(new Event('visibilitychange'));
            });

            // Verify state exists in storage
            const hasStateBefore = await page.evaluate(() => {
              return localStorage.getItem('mg:water-sort:progress') !== null;
            });
            expect(hasStateBefore).toBe(true);

            // Reload to trigger restoration
            await page.goto(url);
            await page.waitForSelector('#game-canvas');
            await page.waitForTimeout(500);

            // State should be cleared after restoration
            const hasStateAfter = await page.evaluate(() => {
              return localStorage.getItem('mg:water-sort:progress') !== null;
            });
            expect(hasStateAfter).toBe(false);
          }
        });
      });
    });
  });
});
