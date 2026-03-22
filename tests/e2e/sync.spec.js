/**
 * Cross-Device Progress Sync - E2E Tests (Playwright)
 *
 * Simulates: export on one "device", import on another (cleared storage),
 * verify progress is fully restored.
 */

import { test, expect } from '@playwright/test';

const TEST_URL = '/tests/e2e/fixtures/sync-harness.html';

test.describe('Sync E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForFunction(() => window.sync && typeof window.sync.exportProgress === 'function');
  });

  test('export then import round-trip restores all progress', async ({ page }) => {
    // ── Seed progress in "device A" session ──
    await page.evaluate(() => {
      localStorage.setItem('mg:stats', JSON.stringify({ v: 1, data: {
        'water-sort': { played: 20, completed: 15, stars: 45, lastLevel: 15, highScores: { 0: 100, 1: 80 } },
      }}));
      localStorage.setItem('mg:global:settings', JSON.stringify({ v: 1, data: { sound: true, colorBlind: true } }));
      localStorage.setItem('mg:best-scores:water-sort:0', JSON.stringify({ v: 1, data: { optimality: 95, stars: 3 } }));
      localStorage.setItem('mg:daily', JSON.stringify({ completed: { '2026-03-20': true } }));
    });

    // Export
    const code = await page.evaluate(() => window.sync.exportProgress());
    expect(typeof code).toBe('string');
    expect(code.startsWith('SYNC-')).toBe(true);
    expect(code).toMatch(/^SYNC(-[0-9A-Za-z]{1,5})+$/);

    // ── Simulate "device B" session: clear storage, import ──
    await page.evaluate(() => localStorage.clear());

    const result = await page.evaluate((syncCode) => {
      return window.sync.importProgress(syncCode);
    }, code);

    expect(result.success).toBe(true);
    expect(result.version).toBe(1);

    // Verify restored data
    const restored = await page.evaluate(() => {
      const stats = JSON.parse(localStorage.getItem('mg:stats') || 'null');
      const settings = JSON.parse(localStorage.getItem('mg:global:settings') || 'null');
      const score = JSON.parse(localStorage.getItem('mg:best-scores:water-sort:0') || 'null');
      const daily = JSON.parse(localStorage.getItem('mg:daily') || 'null');
      return { stats, settings, score, daily };
    });

    expect(restored.stats.data['water-sort'].completed).toBe(15);
    expect(restored.stats.data['water-sort'].highScores[0]).toBe(100);
    expect(restored.settings.data.colorBlind).toBe(true);
    expect(restored.score.data.optimality).toBe(95);
    expect(restored.daily.completed['2026-03-20']).toBe(true);
  });

  test('import merges and preserves higher scores', async ({ page }) => {
    // Device A: level 0 score = 80
    await page.evaluate(() => {
      localStorage.setItem('mg:best-scores:water-sort:0', JSON.stringify({ v: 1, data: { optimality: 80, stars: 2 } }));
    });

    // Device B exports a higher score
    const code = await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('mg:best-scores:water-sort:0', JSON.stringify({ v: 1, data: { optimality: 95, stars: 3 } }));
      return window.sync.exportProgress();
    });

    // Restore device A state and import device B's code
    await page.evaluate(() => {
      localStorage.setItem('mg:best-scores:water-sort:0', JSON.stringify({ v: 1, data: { optimality: 80, stars: 2 } }));
    });

    await page.evaluate((syncCode) => window.sync.importProgress(syncCode), code);

    const score = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('mg:best-scores:water-sort:0')).data;
    });
    expect(score.optimality).toBe(95); // higher wins
  });

  test('sync code is compact enough for text messages (< 1600 chars)', async ({ page }) => {
    // Seed rich multi-game progress
    await page.evaluate(() => {
      const games = ['water-sort', 'brain-teaser', 'pull-the-pin', 'jelly-shift', 'crowd-runner', 'bridge-race'];
      const stats = {};
      for (const gid of games) {
        stats[gid] = { played: 50, completed: 45, stars: 135, lastLevel: 45, highScores: {} };
        for (let l = 0; l < 50; l++) {
          stats[gid].highScores[l] = 80 + (l % 20);
          localStorage.setItem(
            `mg:best-scores:${gid}:${l}`,
            JSON.stringify({ v: 1, data: { optimality: 85 + (l % 15), stars: 2 } })
          );
        }
      }
      localStorage.setItem('mg:stats', JSON.stringify({ v: 1, data: stats }));
      localStorage.setItem('mg:global:settings', JSON.stringify({ v: 1, data: { sound: true, colorBlind: false } }));
    });

    const code = await page.evaluate(() => window.sync.exportProgress());
    expect(code.length).toBeLessThan(1600);
  });

  test('import returns error for invalid code', async ({ page }) => {
    const result = await page.evaluate(() => window.sync.importProgress('SYNC-XXXXX-XXXXX'));
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});
