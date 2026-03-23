/**
 * Score — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests calculateScore, getBestScore, saveBestScore, clearBestScore,
 * getAllBestScores, resetAllScores.
 * showLevelComplete (DOM overlay) is excluded — it has no testable return value.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock localStorage ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store = {};
  return {
    getItem:    vi.fn((key)        => store[key] ?? null),
    setItem:    vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key)        => { delete store[key]; }),
    clear:      vi.fn(()           => { store = {}; }),
    get length()  { return Object.keys(store).length; },
    key:        vi.fn((i)          => Object.keys(store)[i] ?? null),
    _store:     store,
    _reset()    { store = {}; localStorageMock._store = store; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ─── Mock audio ───────────────────────────────────────────────────────────────

vi.mock('../../src/shared/audio.js', () => ({
  playSound: vi.fn(),
  playTap:   vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  calculateScore,
  getBestScore,
  saveBestScore,
  clearBestScore,
  getAllBestScores,
  resetAllScores,
  showLevelComplete,
  cleanupAll,
} from '../../src/shared/score.js';
import { storage } from '../../src/shared/storage.js';
import { playSound } from '../../src/shared/audio.js';

beforeEach(() => {
  localStorageMock._reset();
  vi.clearAllMocks();
  cleanupAll();
  // Clear the in-memory cache of the shared storage singleton so tests are isolated
  storage.cache.clear();
  storage.accessOrder = [];
});

// ─── calculateScore — perfect play ───────────────────────────────────────────

describe('calculateScore — perfect play', () => {
  it('returns 3 stars when moves and time are at par', () => {
    const result = calculateScore({}, 10, 10, { parMoves: 10, parTime: 10 });
    expect(result.stars).toBe(3);
    expect(result.rating).toBe('Perfect');
    expect(result.optimality).toBe(100);
  });

  it('returns 3 stars when moves and time are better than par', () => {
    const result = calculateScore({}, 5, 5, { parMoves: 10, parTime: 10 });
    expect(result.stars).toBe(3);
    expect(result.optimality).toBe(100);
  });

  it('includes moves and time in result', () => {
    const result = calculateScore({}, 8, 15, { parMoves: 8, parTime: 15 });
    expect(result.moves).toBe(8);
    expect(result.time).toBe(15);
  });

  it('includes parMoves and parTime in result', () => {
    const result = calculateScore({}, 10, 10, { parMoves: 5, parTime: 8 });
    expect(result.parMoves).toBe(5);
    expect(result.parTime).toBe(8);
  });
});

// ─── calculateScore — degradation ────────────────────────────────────────────

describe('calculateScore — degraded performance', () => {
  it('returns 0 stars when moves and time are 3× par', () => {
    const result = calculateScore({}, 30, 30, { parMoves: 10, parTime: 10 });
    expect(result.stars).toBe(0);
    expect(result.rating).toBe('Cleared');
  });

  it('returns lower optimality as moves increase', () => {
    const r1 = calculateScore({}, 10, 10, { parMoves: 10, parTime: 10 });
    const r2 = calculateScore({}, 20, 10, { parMoves: 10, parTime: 10 });
    expect(r2.optimality).toBeLessThan(r1.optimality);
  });

  it('returns lower optimality as time increases', () => {
    const r1 = calculateScore({}, 10, 10, { parMoves: 10, parTime: 10 });
    const r2 = calculateScore({}, 10, 20, { parMoves: 10, parTime: 10 });
    expect(r2.optimality).toBeLessThan(r1.optimality);
  });
});

// ─── calculateScore — star thresholds ────────────────────────────────────────

describe('calculateScore — star rating thresholds', () => {
  // Helper: produce a score with a target optimality
  // Since optimality = moveScore*0.7 + timeScore*0.3 (due to the WEIGHTS bug)
  // with parTime=0 → timeScore=100 always → optimality = moveScore*0.7 + 100*0.3
  // To hit specific optimality via moveScore, control move ratio.

  it('2 stars for "Great" score (optimality 70–89)', () => {
    // parTime=0 → timeScore=100; need optimality ≈ 75
    // optimality = moveScore*0.7 + 100*0.3 = moveScore*0.7 + 30 = 75 → moveScore ≈ 64
    // moveScore=64 → ratio=1+(1-0.64)/0.5=1.72 → moves = parMoves*1.72
    const result = calculateScore({}, 17, 1, { parMoves: 10, parTime: 0 });
    expect(result.stars).toBe(2);
    expect(result.rating).toBe('Great');
  });

  it('1 star for "Good" score (optimality 40–69)', () => {
    // Need optimality in [40,69]
    // 2.5× moves: moveScore = 100*(1-1.5/2) = 25
    // optimality = 25*0.7 + 100*0.3 = 17.5+30 = 47 ≈ 48
    const result = calculateScore({}, 25, 1, { parMoves: 10, parTime: 0 });
    expect(result.stars).toBe(1);
    expect(result.rating).toBe('Good');
  });

  it('0 stars for "Cleared" (optimality < 40)', () => {
    const result = calculateScore({}, 100, 100, { parMoves: 10, parTime: 10 });
    expect(result.stars).toBe(0);
    expect(result.rating).toBe('Cleared');
  });
});

// ─── calculateScore — edge cases ─────────────────────────────────────────────

describe('calculateScore — defaults', () => {
  it('uses parMoves=1, parTime=10 as defaults', () => {
    const result = calculateScore({}, 1, 10);
    // At default par, should score perfectly
    expect(result.stars).toBe(3);
    expect(result.parMoves).toBe(1);
    expect(result.parTime).toBe(10);
  });

  it('parMoves=0 → moveScore=100 (no penalty)', () => {
    const result = calculateScore({}, 50, 10, { parMoves: 0, parTime: 10 });
    expect(result.moveScore).toBe(100);
  });

  it('parTime=0 → timeScore=100 (no penalty)', () => {
    const result = calculateScore({}, 1, 999, { parMoves: 1, parTime: 0 });
    expect(result.timeScore).toBe(100);
  });

  it('parMoves<0 → moveScore=100 (treated same as 0)', () => {
    const result = calculateScore({}, 50, 10, { parMoves: -3, parTime: 10 });
    expect(result.moveScore).toBe(100);
  });

  it('parTime<0 → timeScore=100 (treated same as 0)', () => {
    const result = calculateScore({}, 1, 999, { parMoves: 1, parTime: -5 });
    expect(result.timeScore).toBe(100);
  });

  it('timeScore is 100 when time exactly equals parTime (ratio = 1.0, <= boundary)', () => {
    const result = calculateScore({}, 1, 10, { parMoves: 1, parTime: 10 });
    expect(result.timeScore).toBe(100);
  });

  it('timeScore is exactly 50 at ratio = 2.0 (midpoint interpolation)', () => {
    // ratio=2: 100*(1-(2-1)/2) = 100*0.5 = 50
    const result = calculateScore({}, 1, 20, { parMoves: 1, parTime: 10 });
    expect(result.timeScore).toBe(50);
  });

  it('moveScore is exactly 50 at ratio = 2.0 (midpoint interpolation)', () => {
    // ratio=2: 100*(1-(2-1)/2) = 100*0.5 = 50
    const result = calculateScore({}, 20, 1, { parMoves: 10, parTime: 0 });
    expect(result.moveScore).toBe(50);
  });

  it('timeScore is exactly 0 when time is >= 3x parTime (upper boundary)', () => {
    // ratio=3: return 0 (>= boundary, inclusive)
    const result = calculateScore({}, 1, 30, { parMoves: 1, parTime: 10 });
    expect(result.timeScore).toBe(0);
  });
});

// ─── getBestScore / saveBestScore ─────────────────────────────────────────────

describe('getBestScore / saveBestScore', () => {
  it('returns null when no score saved', () => {
    expect(getBestScore('water-sort', 0)).toBeNull();
  });

  it('saveBestScore returns true for new score', () => {
    const score = calculateScore({}, 5, 10, { parMoves: 5, parTime: 10 });
    expect(saveBestScore('water-sort', 0, score)).toBe(true);
  });

  it('getBestScore retrieves saved optimality, stars, moves, time, rating', () => {
    const score = calculateScore({}, 5, 10, { parMoves: 5, parTime: 10 });
    saveBestScore('water-sort', 0, score);
    const best = getBestScore('water-sort', 0);
    expect(best.optimality).toBe(score.optimality);
    expect(best.stars).toBe(score.stars);
    expect(best.moves).toBe(5);
    expect(best.time).toBe(10);
    expect(best.rating).toBe(score.rating);
  });

  it('saved best score includes a timestamp', () => {
    const score = calculateScore({}, 5, 10, { parMoves: 5, parTime: 10 });
    saveBestScore('water-sort', 0, score);
    const best = getBestScore('water-sort', 0);
    expect(typeof best.timestamp).toBe('number');
    expect(best.timestamp).toBeGreaterThan(0);
  });

  it('saveBestScore returns false when new score is not better', () => {
    const perfect = calculateScore({}, 5, 10, { parMoves: 5, parTime: 10 });
    const worse   = calculateScore({}, 20, 10, { parMoves: 5, parTime: 10 });
    saveBestScore('water-sort', 0, perfect);
    expect(saveBestScore('water-sort', 0, worse)).toBe(false);
  });

  it('saveBestScore returns false when new score equals existing best (check is >, not >=)', () => {
    const score = calculateScore({}, 5, 10, { parMoves: 5, parTime: 10 });
    saveBestScore('water-sort', 0, score);
    // Same score again — optimality is equal, not strictly greater
    expect(saveBestScore('water-sort', 0, score)).toBe(false);
  });

  it('saveBestScore returns true and updates when new score is better', () => {
    const worse   = calculateScore({}, 20, 10, { parMoves: 5, parTime: 10 });
    const better  = calculateScore({}, 5,  10, { parMoves: 5, parTime: 10 });
    saveBestScore('water-sort', 0, worse);
    expect(saveBestScore('water-sort', 0, better)).toBe(true);
    expect(getBestScore('water-sort', 0).optimality).toBe(better.optimality);
  });

  it('scores are independent per game', () => {
    const score = calculateScore({}, 5, 10, { parMoves: 5, parTime: 10 });
    saveBestScore('game-a', 0, score);
    expect(getBestScore('game-b', 0)).toBeNull();
  });

  it('scores are independent per level index', () => {
    const score = calculateScore({}, 5, 10, { parMoves: 5, parTime: 10 });
    saveBestScore('water-sort', 0, score);
    expect(getBestScore('water-sort', 1)).toBeNull();
  });
});

// ─── clearBestScore ───────────────────────────────────────────────────────────

describe('clearBestScore', () => {
  it('removes a saved score', () => {
    const score = calculateScore({}, 5, 10, { parMoves: 5, parTime: 10 });
    saveBestScore('water-sort', 0, score);
    clearBestScore('water-sort', 0);
    expect(getBestScore('water-sort', 0)).toBeNull();
  });

  it('is safe to call when no score exists', () => {
    expect(() => clearBestScore('water-sort', 99)).not.toThrow();
  });
});

// ─── getAllBestScores / resetAllScores ────────────────────────────────────────

describe('getAllBestScores', () => {
  it('returns empty object when no scores saved', () => {
    expect(getAllBestScores('water-sort')).toEqual({});
  });

  it('returns all saved scores keyed by level index', () => {
    const s0 = calculateScore({}, 5, 10, { parMoves: 5, parTime: 10 });
    const s1 = calculateScore({}, 3, 5,  { parMoves: 3, parTime: 5  });
    saveBestScore('water-sort', 0, s0);
    saveBestScore('water-sort', 1, s1);
    const all = getAllBestScores('water-sort');
    expect(Object.keys(all)).toHaveLength(2);
    expect(all[0].moves).toBe(5);
    expect(all[1].moves).toBe(3);
  });

  it('only returns scores for the requested game', () => {
    const score = calculateScore({}, 5, 10, { parMoves: 5, parTime: 10 });
    saveBestScore('game-a', 0, score);
    expect(getAllBestScores('game-b')).toEqual({});
  });

  it('skips keys with non-numeric level suffix (!isNaN guard)', () => {
    localStorageMock.setItem('mg:best-scores:water-sort:invalid', '{"optimality":50}');
    const all = getAllBestScores('water-sort');
    expect(Object.keys(all)).toHaveLength(0);
  });
});

describe('resetAllScores', () => {
  it('removes all scores for a game', () => {
    const score = calculateScore({}, 5, 10, { parMoves: 5, parTime: 10 });
    saveBestScore('water-sort', 0, score);
    saveBestScore('water-sort', 1, score);
    resetAllScores('water-sort');
    expect(getAllBestScores('water-sort')).toEqual({});
  });

  it('only removes scores for the specified game', () => {
    const score = calculateScore({}, 5, 10, { parMoves: 5, parTime: 10 });
    saveBestScore('game-a', 0, score);
    saveBestScore('game-b', 0, score);
    resetAllScores('game-a');
    expect(getBestScore('game-b', 0)).not.toBeNull();
  });

  it('is safe to call when no scores exist', () => {
    expect(() => resetAllScores('game-x')).not.toThrow();
  });

  it('does not throw when localStorage.key throws during iteration (catch block)', () => {
    localStorageMock.key.mockImplementationOnce(() => { throw new Error('Storage denied'); });
    expect(() => resetAllScores('water-sort')).not.toThrow();
  });
});

describe('getAllBestScores — catch block', () => {
  it('returns empty object when localStorage.key throws (catch block)', () => {
    localStorageMock.key.mockImplementationOnce(() => { throw new Error('Storage denied'); });
    expect(getAllBestScores('water-sort')).toEqual({});
  });
});

// ─── showLevelComplete helpers ────────────────────────────────────────────────

const baseStats = {
  stars: 3,
  rating: 'Perfect',
  moves: 5,
  time: 15,
  optimality: 95,
};

// Execute rAF callbacks synchronously so DOM is fully set up after showLevelComplete()
function setupRaf() {
  global.requestAnimationFrame = (cb) => { cb(); };
}

// ─── showLevelComplete — DOM creation ────────────────────────────────────────

describe('showLevelComplete — DOM creation', () => {
  beforeEach(setupRaf);
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; });

  it('appends .mg-score-overlay to the given container', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats });
    expect(container.querySelector('.mg-score-overlay')).not.toBeNull();
  });

  it('appends overlay to document.body when container is omitted (container || document.body branch)', () => {
    showLevelComplete({ gameId: 'g', levelIndex: 0, stats: baseStats });
    expect(document.body.querySelector('.mg-score-overlay')).not.toBeNull();
  });

  it('renders the rating label in the overlay', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: { ...baseStats, rating: 'Great' } });
    expect(container.textContent).toContain('Great!');
  });

  it('returns instance with hide() and destroy() methods', () => {
    const inst = showLevelComplete({ gameId: 'g', levelIndex: 0, stats: baseStats });
    expect(typeof inst.hide).toBe('function');
    expect(typeof inst.destroy).toBe('function');
  });
});

// ─── showLevelComplete — isNewBest flag ───────────────────────────────────────

describe('showLevelComplete — isNewBest flag', () => {
  beforeEach(setupRaf);
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; });

  it('renders "New Best!" subtitle when isNewBest=true (ternary true branch)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats, isNewBest: true });
    expect(container.textContent).toContain('New Best!');
  });

  it('renders "Level Complete" subtitle when isNewBest=false (ternary false branch, default)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats });
    expect(container.textContent).toContain('Level Complete');
  });

  it('does NOT render the NEW badge element when isNewBest=false (ternary false → empty string)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats, isNewBest: false });
    // isNewBest=false → '${isNewBest ? ... : ""}' produces empty string → no .mg-score-stat-new
    expect(container.querySelector('.mg-score-stat-new')).toBeNull();
  });

  it('renders the NEW badge element when isNewBest=true (ternary true → badge div)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats, isNewBest: true });
    expect(container.querySelector('.mg-score-stat-new')).not.toBeNull();
  });
});

// ─── showLevelComplete — sound (stars >= 3) ───────────────────────────────────

describe('showLevelComplete — sound selection', () => {
  beforeEach(setupRaf);
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; });

  it('plays "levelComplete" when stars >= 3 (if branch)', () => {
    showLevelComplete({ gameId: 'g', levelIndex: 0, stats: { ...baseStats, stars: 3 } });
    expect(playSound).toHaveBeenCalledWith('levelComplete');
  });

  it('plays "success" when stars < 3 (else branch)', () => {
    showLevelComplete({ gameId: 'g', levelIndex: 0, stats: { ...baseStats, stars: 2 } });
    expect(playSound).toHaveBeenCalledWith('success');
  });
});

// ─── showLevelComplete — gameId branch ───────────────────────────────────────

describe('showLevelComplete — gameId ? getBestScore : null', () => {
  beforeEach(setupRaf);
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; });

  it('does not throw when gameId is null (false branch — bestScore set to null)', () => {
    expect(() => showLevelComplete({ gameId: null, levelIndex: 0, stats: baseStats })).not.toThrow();
  });

  it('does not throw when gameId is undefined (false branch)', () => {
    expect(() => showLevelComplete({ levelIndex: 0, stats: baseStats })).not.toThrow();
  });
});

// ─── showLevelComplete — instance.destroy() ───────────────────────────────────

describe('showLevelComplete — instance.destroy()', () => {
  beforeEach(setupRaf);
  afterEach(() => { document.body.innerHTML = ''; });

  it('removes overlay from DOM immediately', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats });
    inst.destroy();
    expect(container.querySelector('.mg-score-overlay')).toBeNull();
  });

  it('does not throw when destroy() called twice (parentNode null on second call — if branch false)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats });
    inst.destroy();
    expect(() => inst.destroy()).not.toThrow();
  });
});

// ─── showLevelComplete — hide() setTimeout parentNode branch ─────────────────

describe('showLevelComplete — hide() setTimeout parentNode null branch', () => {
  afterEach(() => { vi.useRealTimers(); cleanupAll(); document.body.innerHTML = ''; });

  it('does not throw when overlay is removed before 300ms timeout fires (parentNode null branch)', () => {
    vi.useFakeTimers();
    setupRaf();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats });
    inst.hide();                // starts 300ms setTimeout
    inst.overlay.remove();      // removes overlay → parentNode becomes null
    expect(() => vi.runAllTimers()).not.toThrow(); // timeout fires, if(parentNode) is false
    vi.useRealTimers();
  });
});

// ─── showLevelComplete — button callbacks (if false branches) ─────────────────

describe('showLevelComplete — button click without callbacks (if false branches)', () => {
  beforeEach(setupRaf);
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; });

  it('clicking next without onNext does not throw (if(onNext) false branch)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats });
    const btn = container.querySelector('[data-action="next"]');
    expect(btn).not.toBeNull();
    expect(() => btn.click()).not.toThrow();
  });

  it('clicking replay without onReplay does not throw (if(onReplay) false branch)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats });
    const btn = container.querySelector('[data-action="replay"]');
    expect(btn).not.toBeNull();
    expect(() => btn.click()).not.toThrow();
  });

  it('clicking close without onClose does not throw (if(onClose) false branch)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats });
    const btn = container.querySelector('[data-action="close"]');
    expect(btn).not.toBeNull();
    expect(() => btn.click()).not.toThrow();
  });
});

// ─── showLevelComplete — barFill null check ───────────────────────────────────

describe('showLevelComplete — barFill null check (if false branch)', () => {
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; });

  it('does not throw when .mg-score-bar-fill is removed before inner rAF fires (if(barFill) false branch)', () => {
    const rafCallbacks = [];
    global.requestAnimationFrame = (cb) => { rafCallbacks.push(cb); };

    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats });

    // Run outer RAF: adds 'mg-visible' and schedules inner RAF
    rafCallbacks.shift()();

    // Remove the bar-fill element before inner RAF fires
    const barFill = container.querySelector('.mg-score-bar-fill');
    if (barFill) barFill.remove();

    // Run inner RAF — barFill is null → if(barFill) is false → no throw
    expect(() => rafCallbacks.shift()()).not.toThrow();

    // Restore synchronous RAF
    global.requestAnimationFrame = (cb) => { cb(); };
  });
});

// ─── showLevelComplete — button click WITH callbacks (if true branches) ────────

describe('showLevelComplete — button click with callbacks (if true branches)', () => {
  beforeEach(() => { vi.useFakeTimers(); setupRaf(); });
  afterEach(() => { vi.useRealTimers(); cleanupAll(); document.body.innerHTML = ''; });

  it('clicking next WITH onNext calls the callback (if(onNext) true branch)', () => {
    const onNext = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats, onNext });
    container.querySelector('[data-action="next"]').click();
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('clicking replay WITH onReplay calls the callback (if(onReplay) true branch)', () => {
    const onReplay = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats, onReplay });
    container.querySelector('[data-action="replay"]').click();
    expect(onReplay).toHaveBeenCalledTimes(1);
  });

  it('clicking close WITH onClose calls the callback (if(onClose) true branch)', () => {
    const onClose = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: baseStats, onClose });
    container.querySelector('[data-action="close"]').click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── showLevelComplete — getBarColor branches ─────────────────────────────────

describe('showLevelComplete — getBarColor (bar fill color)', () => {
  beforeEach(setupRaf);
  afterEach(() => { cleanupAll(); document.body.innerHTML = ''; });

  it('bar fill uses BLUISH_GREEN (rgb 0,158,115) when optimality >= 90 (first if branch)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: { ...baseStats, optimality: 95 } });
    const bar = container.querySelector('.mg-score-bar-fill');
    // jsdom normalises hex → rgb; BLUISH_GREEN=#009E73 → rgb(0, 158, 115)
    expect(bar.getAttribute('style')).toContain('rgb(0, 158, 115)');
  });

  it('bar fill uses BLUE (rgb 0,114,178) when optimality >= 70 and < 90 (second if branch)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: { ...baseStats, optimality: 75, stars: 2, rating: 'Great' } });
    const bar = container.querySelector('.mg-score-bar-fill');
    // BLUE=#0072B2 → rgb(0, 114, 178)
    expect(bar.getAttribute('style')).toContain('rgb(0, 114, 178)');
  });

  it('bar fill uses ORANGE (rgb 230,159,0) when optimality >= 40 and < 70 (third if branch)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: { ...baseStats, optimality: 50, stars: 1, rating: 'Good' } });
    const bar = container.querySelector('.mg-score-bar-fill');
    // ORANGE=#E69F00 → rgb(230, 159, 0)
    expect(bar.getAttribute('style')).toContain('rgb(230, 159, 0)');
  });

  it('bar fill uses GRAY (rgb 153,153,153) when optimality < 40 (fallback return branch)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    showLevelComplete({ container, gameId: 'g', levelIndex: 0, stats: { ...baseStats, optimality: 20, stars: 0, rating: 'Cleared' } });
    const bar = container.querySelector('.mg-score-bar-fill');
    // GRAY=#999999 → rgb(153, 153, 153)
    expect(bar.getAttribute('style')).toContain('rgb(153, 153, 153)');
  });
});

// ─── cleanupAll ───────────────────────────────────────────────────────────────

describe('cleanupAll', () => {
  beforeEach(setupRaf);
  afterEach(() => { document.body.innerHTML = ''; });

  it('destroys all active instances and removes them from the DOM', () => {
    const c1 = document.createElement('div');
    const c2 = document.createElement('div');
    document.body.append(c1, c2);
    showLevelComplete({ container: c1, gameId: 'g1', levelIndex: 0, stats: { ...baseStats, stars: 1, rating: 'Good', optimality: 50 } });
    showLevelComplete({ container: c2, gameId: 'g2', levelIndex: 0, stats: { ...baseStats, stars: 2, rating: 'Great', optimality: 75 } });
    cleanupAll();
    expect(c1.querySelector('.mg-score-overlay')).toBeNull();
    expect(c2.querySelector('.mg-score-overlay')).toBeNull();
  });

  it('is safe to call when no instances are active', () => {
    expect(() => cleanupAll()).not.toThrow();
  });
});
