/**
 * Cross-Device Progress Sync - E2E Tests (Playwright)
 *
 * Drives the real Hub Settings drawer UI (gear → Data → Sync Progress), which
 * is the production path wired in src/hub/hub.js. Exercises export (dialog +
 * copy), import (prompt → merge), success/failure feedback, and a full
 * export→import round-trip that simulates moving progress between devices.
 */

import { test, expect } from '@playwright/test';

const HUB_URL = '/';

/** Open the Settings drawer from the hub gear button. */
async function openSettings(page) {
  await page.click('.mg-settings-gear');
  await expect(page.locator('.mg-settings-drawer.mg-visible')).toBeVisible();
}

/** Open Settings, click Export, and return the generated sync code. */
async function exportCode(page) {
  await openSettings(page);
  await page.click('[data-action="sync-export"]');
  await expect(page.locator('.mg-sync-dialog')).toBeVisible();
  const code = await page.locator('.mg-sync-code').inputValue();
  await page.click('[data-sync-action="close"]');
  return code;
}

/** Open Settings and drive the Import action, answering the prompt with `code`. */
async function importCode(page, code) {
  page.once('dialog', (d) => d.accept(code));
  await openSettings(page);
  await page.click('[data-action="sync-import"]');
}

test.describe('Sync via Hub Settings UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HUB_URL);
    await page.evaluate(() => localStorage.clear());
  });

  test('export button opens a dialog with a valid sync code and copies it', async ({ page }) => {
    // Seed some progress and reload so the storage manager sees it
    await page.evaluate(() => {
      localStorage.setItem('mg:stats', JSON.stringify({ v: 1, data: {
        'water-sort': { played: 20, completed: 15, stars: 45, lastLevel: 15, highScores: { 0: 100 } },
      }}));
    });
    await page.reload();

    await openSettings(page);
    await page.click('[data-action="sync-export"]');

    const dialog = page.locator('.mg-sync-dialog');
    await expect(dialog).toBeVisible();

    const code = await page.locator('.mg-sync-code').inputValue();
    expect(code.startsWith('SYNC-')).toBe(true);
    expect(code).toMatch(/^SYNC(-[0-9A-Za-z]{1,5})+$/);

    // Copy closes the dialog and surfaces a toast
    await page.click('[data-sync-action="copy"]');
    await expect(dialog).toBeHidden();
    await expect(page.locator('.mg-sync-toast')).toBeVisible();
  });

  test('export then import round-trip restores all progress on another "device"', async ({ page }) => {
    // ── Device A: seed rich progress ──
    await page.evaluate(() => {
      localStorage.setItem('mg:stats', JSON.stringify({ v: 1, data: {
        'water-sort': { played: 20, completed: 15, stars: 45, lastLevel: 15, highScores: { 0: 100, 1: 80 } },
      }}));
      localStorage.setItem('mg:global:settings', JSON.stringify({ v: 1, data: { sound: true, colorBlind: true } }));
      localStorage.setItem('mg:best-scores:water-sort:0', JSON.stringify({ v: 1, data: { optimality: 95, stars: 3 } }));
      localStorage.setItem('mg:daily', JSON.stringify({ completed: { '2026-03-20': true } }));
    });
    await page.reload();

    const code = await exportCode(page);
    expect(code.startsWith('SYNC-')).toBe(true);

    // ── Device B: clear all progress, then import ──
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await importCode(page, code);

    // Success is surfaced to the user
    const toast = page.locator('.mg-sync-toast.mg-sync-ok');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/imported/i);

    // Progress is actually restored in storage
    const restored = await page.evaluate(() => ({
      stats: JSON.parse(localStorage.getItem('mg:stats') || 'null'),
      settings: JSON.parse(localStorage.getItem('mg:global:settings') || 'null'),
      score: JSON.parse(localStorage.getItem('mg:best-scores:water-sort:0') || 'null'),
      daily: JSON.parse(localStorage.getItem('mg:daily') || 'null'),
    }));
    expect(restored.stats.data['water-sort'].completed).toBe(15);
    expect(restored.stats.data['water-sort'].highScores[0]).toBe(100);
    expect(restored.settings.data.colorBlind).toBe(true);
    expect(restored.score.data.optimality).toBe(95);
    expect(restored.daily.completed['2026-03-20']).toBe(true);
  });

  test('import merges and preserves higher scores', async ({ page }) => {
    // Generate a code representing a HIGH score (95) via the UI
    await page.evaluate(() => {
      localStorage.setItem('mg:best-scores:water-sort:0', JSON.stringify({ v: 1, data: { optimality: 95, stars: 3 } }));
    });
    await page.reload();
    const highCode = await exportCode(page);

    // Reset this device to a LOWER score (80), then import the high code
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('mg:best-scores:water-sort:0', JSON.stringify({ v: 1, data: { optimality: 80, stars: 2 } }));
    });
    await page.reload();

    await importCode(page, highCode);
    await expect(page.locator('.mg-sync-toast.mg-sync-ok')).toBeVisible();

    const score = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('mg:best-scores:water-sort:0')).data
    );
    expect(score.optimality).toBe(95); // higher wins
  });

  test('sync code stays compact for rich multi-game progress', async ({ page }) => {
    const rawBytes = await page.evaluate(() => {
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

      let raw = 0;
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('mg:')) raw += localStorage.getItem(k).length;
      }
      return raw;
    });
    await page.reload();

    const code = await exportCode(page);
    // Compression is effective: the code is a small fraction of the raw progress data...
    expect(code.length).toBeLessThan(rawBytes / 4);
    // ...and stays under a generous absolute ceiling even for a fully-completed corpus.
    expect(code.length).toBeLessThan(4000);
  });

  test('importing an invalid code surfaces a failure message', async ({ page }) => {
    await importCode(page, 'SYNC-XXXXX-XXXXX');

    const toast = page.locator('.mg-sync-toast.mg-sync-err');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/failed/i);
  });
});
