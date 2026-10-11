/**
 * Bus Jam's daily result sharing behavior.
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/games/bus-jam/renderer.js', () => ({
  createRenderer: vi.fn(),
}));

vi.mock('../../src/shared/daily-share.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    shareDailyResult: vi.fn(),
  };
});

import { BusJamGame } from '../../src/games/bus-jam/game.js';
import { generateDailyShareText, shareDailyResult } from '../../src/shared/daily-share.js';

function makeGame(overrides = {}) {
  return Object.assign(Object.create(BusJamGame.prototype), overrides);
}

describe('Bus Jam daily challenge sharing', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="stars-display">
        <span class="star"></span><span class="star"></span><span class="star"></span>
      </div>
      <div id="stats-summary"></div>
      <div id="win-overlay"></div>
      <button id="btn-share-daily"></button>
    `;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('shares daily-mode result details in the daily challenge format', async () => {
    const game = makeGame({
      isDailyMode: true,
      state: { moves: 5 },
      levelStartTime: Date.now() - 30_000,
      hintSession: { level: 1 },
      levels: [{ optimal: 4 }],
      currentLevelIndex: 0,
      btnShareDaily: document.getElementById('btn-share-daily'),
      winOverlay: document.getElementById('win-overlay'),
    });

    game.showWinOverlay(2);
    expect(game.btnShareDaily.style.display).toBe('inline-flex');

    await game.handleShareDaily();

    expect(shareDailyResult).toHaveBeenCalledTimes(1);
    const result = shareDailyResult.mock.calls[0][0];
    expect(result).toEqual({
      gameId: 'bus-jam',
      moves: 5,
      time: 30,
      hints: 1,
      date: '2026-09-01',
      stars: 2,
    });

    const text = generateDailyShareText(result);
    const displayDate = new Date(result.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    expect(text).toContain(`Bus Jam Daily — ${displayDate}`);
    expect(text).toContain('5 moves, 30s');
    expect(text).toContain('mobile-gaming.pages.dev/bus-jam/?daily=2026-09-01');
  });

  it('keeps the daily result share button hidden outside daily mode', () => {
    const game = makeGame({
      isDailyMode: false,
      btnShareDaily: document.getElementById('btn-share-daily'),
      winOverlay: document.getElementById('win-overlay'),
      state: { moves: 5 },
    });

    game.showWinOverlay(2);

    expect(game.btnShareDaily.style.display).toBe('none');
    expect(game.winOverlay.classList.contains('active')).toBe(true);
  });
});
