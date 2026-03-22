/**
 * LevelNav — Unit Tests
 * @vitest-environment jsdom
 *
 * Tests: createLevelNav, getLevelProgress, resetLevelProgress, cleanupAll.
 * Covers: progress persistence, unlock logic, level dot creation,
 *         daily/endless extras, completeLevel, skipLevel, setCurrentLevel,
 *         completeDaily, refresh, destroy.
 *
 * Note: jsdom's 'background' shorthand property breaks the entire cssText
 * parsing (a known jsdom CSS limitation). Tests use textContent, aria-labels,
 * and click-callback behavior instead of style property assertions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock localStorage ────────────────────────────────────────────────────────

let _store = {};

const localStorageMock = {
  getItem:    vi.fn((key)        => _store[key] ?? null),
  setItem:    vi.fn((key, value) => { _store[key] = String(value); }),
  removeItem: vi.fn((key)        => { delete _store[key]; }),
  clear:      vi.fn(()           => { _store = {}; }),
  get length()  { return Object.keys(_store).length; },
  key:        vi.fn((i)          => Object.keys(_store)[i] ?? null),
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ─── Mock audio ───────────────────────────────────────────────────────────────

vi.mock('../../src/shared/audio.js', () => ({
  playTap: vi.fn(),
}));

// ─── DOM stubs ────────────────────────────────────────────────────────────────

vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 1; });
vi.stubGlobal('cancelAnimationFrame', vi.fn());
// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  createLevelNav,
  getLevelProgress,
  resetLevelProgress,
  cleanupAll,
} from '../../src/shared/level-nav.js';

import { playTap } from '../../src/shared/audio.js';
import { storage } from '../../src/shared/storage.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContainer() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

function makeLevelNav(overrides = {}) {
  const container = makeContainer();
  const nav = createLevelNav({
    container,
    gameId: 'test-game',
    totalLevels: 5,
    ...overrides,
  });
  return { nav, container };
}

/** Get all level dots (not daily/endless) from a nav */
function getLevelDots(nav) {
  return Array.from(nav.dotsContainer.querySelectorAll('[data-level]'));
}

beforeEach(() => {
  _store = {};
  storage.cache.clear(); // flush StorageManager's in-memory cache
  vi.clearAllMocks();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

afterEach(() => {
  cleanupAll();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

// ─── getLevelProgress ─────────────────────────────────────────────────────────

describe('getLevelProgress', () => {
  it('returns empty object when no progress is saved', () => {
    expect(getLevelProgress('new-game')).toEqual({});
  });

  it('returns saved progress after completeLevel', () => {
    const { nav } = makeLevelNav({ gameId: 'prog-game', totalLevels: 3 });
    nav.completeLevel(0);
    expect(getLevelProgress('prog-game')[0]).toBe('completed');
  });

  it('returns empty object for a different gameId', () => {
    const { nav } = makeLevelNav({ gameId: 'game-a', totalLevels: 3 });
    nav.completeLevel(0);
    expect(getLevelProgress('game-b')).toEqual({});
  });
});

// ─── resetLevelProgress ───────────────────────────────────────────────────────

describe('resetLevelProgress', () => {
  it('clears all progress for a game', () => {
    const { nav } = makeLevelNav({ gameId: 'reset-game', totalLevels: 3 });
    nav.completeLevel(0);
    nav.completeLevel(1);
    resetLevelProgress('reset-game');
    expect(getLevelProgress('reset-game')).toEqual({});
  });

  it('does not affect other games', () => {
    const { nav: navA } = makeLevelNav({ gameId: 'game-aa', totalLevels: 3 });
    const { nav: navB } = makeLevelNav({ gameId: 'game-bb', totalLevels: 3 });
    navA.completeLevel(0);
    navB.completeLevel(0);
    resetLevelProgress('game-aa');
    expect(getLevelProgress('game-aa')).toEqual({});
    expect(getLevelProgress('game-bb')[0]).toBe('completed');
  });

  it('removes both progress and current-level keys from storage', () => {
    const { nav } = makeLevelNav({ gameId: 'keys-game', totalLevels: 3 });
    nav.completeLevel(0); // advances current to 1
    resetLevelProgress('keys-game');
    // After reset, getLevelProgress returns empty (no progress key)
    expect(getLevelProgress('keys-game')).toEqual({});
    // After reset a new nav should start at level 0 (current key also gone)
    const { nav: nav2 } = makeLevelNav({ gameId: 'keys-game', totalLevels: 3 });
    const dots = getLevelDots(nav2);
    // Level 0 should be current — it shows the number "1", not a checkmark
    expect(dots[0].textContent).toBe('1');
  });
});

// ─── cleanupAll ───────────────────────────────────────────────────────────────

describe('cleanupAll', () => {
  it('removes all nav strips from the DOM', () => {
    const { container: c1 } = makeLevelNav({ gameId: 'clean-1' });
    const { container: c2 } = makeLevelNav({ gameId: 'clean-2' });
    expect(c1.querySelector('.mg-level-nav')).not.toBeNull();
    expect(c2.querySelector('.mg-level-nav')).not.toBeNull();
    cleanupAll();
    expect(c1.querySelector('.mg-level-nav')).toBeNull();
    expect(c2.querySelector('.mg-level-nav')).toBeNull();
  });

  it('is safe to call multiple times', () => {
    makeLevelNav({ gameId: 'multi-clean' });
    cleanupAll();
    expect(() => cleanupAll()).not.toThrow();
  });
});

// ─── createLevelNav — DOM structure ───────────────────────────────────────────

describe('createLevelNav — DOM structure', () => {
  it('appends a strip to the container', () => {
    const { container } = makeLevelNav();
    expect(container.querySelector('.mg-level-nav')).not.toBeNull();
  });

  it('creates exactly totalLevels level dots', () => {
    const { nav } = makeLevelNav({ totalLevels: 7 });
    expect(getLevelDots(nav)).toHaveLength(7);
  });

  it('each dot has an aria-label with the level number', () => {
    const { nav } = makeLevelNav({ totalLevels: 3 });
    const dots = getLevelDots(nav);
    expect(dots[0].getAttribute('aria-label')).toBe('Level 1');
    expect(dots[1].getAttribute('aria-label')).toBe('Level 2');
    expect(dots[2].getAttribute('aria-label')).toBe('Level 3');
  });

  it('returns instance with correct metadata', () => {
    const { nav } = makeLevelNav({
      totalLevels: 4, gameId: 'meta-game', hasEndless: true, hasDaily: true,
    });
    expect(nav.gameId).toBe('meta-game');
    expect(nav.totalLevels).toBe(4);
    expect(nav.hasEndless).toBe(true);
    expect(nav.hasDaily).toBe(true);
  });

  it('has a dotsContainer child inside the strip', () => {
    const { nav } = makeLevelNav();
    expect(nav.strip.contains(nav.dotsContainer)).toBe(true);
  });
});

// ─── createLevelNav — daily/endless extras ────────────────────────────────────

describe('createLevelNav — daily dot', () => {
  it('creates a daily dot when hasDaily is true', () => {
    const { nav } = makeLevelNav({ hasDaily: true });
    const daily = nav.dotsContainer.querySelector('.mg-level-daily');
    expect(daily).not.toBeNull();
    expect(daily.getAttribute('aria-label')).toBe('Daily Challenge');
  });

  it('daily dot contains a star symbol', () => {
    const { nav } = makeLevelNav({ hasDaily: true });
    const daily = nav.dotsContainer.querySelector('.mg-level-daily');
    expect(daily.textContent).toBe('\u2605');
  });

  it('does not create a daily dot when hasDaily is false', () => {
    const { nav } = makeLevelNav({ hasDaily: false });
    expect(nav.dotsContainer.querySelector('.mg-level-daily')).toBeNull();
  });

  it('daily dot fires onDailySelect when clicked', () => {
    const onDailySelect = vi.fn();
    const { nav } = makeLevelNav({ hasDaily: true, onDailySelect });
    const daily = nav.dotsContainer.querySelector('.mg-level-daily');
    daily.click();
    expect(onDailySelect).toHaveBeenCalledTimes(1);
  });

  it('daily dot click plays tap sound', () => {
    const { nav } = makeLevelNav({ hasDaily: true, onDailySelect: vi.fn() });
    nav.dotsContainer.querySelector('.mg-level-daily').click();
    expect(playTap).toHaveBeenCalled();
  });
});

describe('createLevelNav — endless dot', () => {
  it('creates an endless dot when hasEndless is true', () => {
    const { nav } = makeLevelNav({ hasEndless: true });
    const endless = nav.dotsContainer.querySelector('.mg-level-endless');
    expect(endless).not.toBeNull();
    expect(endless.getAttribute('aria-label')).toBe('Endless Mode');
    expect(endless.textContent).toBe('\u221E');
  });

  it('does not create an endless dot when hasEndless is false', () => {
    const { nav } = makeLevelNav({ hasEndless: false });
    expect(nav.dotsContainer.querySelector('.mg-level-endless')).toBeNull();
  });

  it('endless dot fires onEndlessSelect when clicked', () => {
    const onEndlessSelect = vi.fn();
    const { nav } = makeLevelNav({ hasEndless: true, onEndlessSelect });
    nav.dotsContainer.querySelector('.mg-level-endless').click();
    expect(onEndlessSelect).toHaveBeenCalledTimes(1);
  });
});

// ─── Unlock/lock behavior (via click callbacks) ───────────────────────────────

describe('unlock logic', () => {
  it('level 0 fires onLevelSelect when clicked (unlocked by default)', () => {
    const onLevelSelect = vi.fn();
    const { nav } = makeLevelNav({ totalLevels: 5, onLevelSelect });
    getLevelDots(nav)[0].click();
    expect(onLevelSelect).toHaveBeenCalled();
  });

  it('level 1 does NOT fire onLevelSelect when nothing is completed (locked)', () => {
    const onLevelSelect = vi.fn();
    const { nav } = makeLevelNav({ totalLevels: 5, onLevelSelect });
    getLevelDots(nav)[1].click();
    expect(onLevelSelect).not.toHaveBeenCalled();
  });

  it('level 1 fires onLevelSelect after level 0 is completed (unlocked)', () => {
    const onLevelSelect = vi.fn();
    const { nav } = makeLevelNav({ totalLevels: 5, onLevelSelect });
    nav.completeLevel(0);
    getLevelDots(nav)[1].click();
    expect(onLevelSelect).toHaveBeenCalled();
  });

  it('level 2 stays locked when only level 0 is completed', () => {
    const onLevelSelect = vi.fn();
    const { nav } = makeLevelNav({ totalLevels: 5, onLevelSelect });
    nav.completeLevel(0);
    getLevelDots(nav)[2].click();
    expect(onLevelSelect).not.toHaveBeenCalled();
  });

  it('completes multiple levels to progressively unlock', () => {
    const onLevelSelect = vi.fn();
    const { nav } = makeLevelNav({ totalLevels: 5, onLevelSelect });
    nav.completeLevel(0);
    nav.completeLevel(1);
    nav.completeLevel(2);
    getLevelDots(nav)[3].click();
    expect(onLevelSelect).toHaveBeenCalled();
    vi.clearAllMocks();
    getLevelDots(nav)[4].click();
    expect(onLevelSelect).not.toHaveBeenCalled(); // still locked
  });

  it('skipping does NOT unlock the next level (only completions unlock)', () => {
    // maxUnlocked is computed from 'completed' entries only, not 'skipped'
    const onLevelSelect = vi.fn();
    const { nav } = makeLevelNav({ totalLevels: 5, onLevelSelect });
    nav.skipLevel(0); // advances current pointer to 1, but level 1 is still locked
    getLevelDots(nav)[1].click(); // level 1 is locked → no callback
    expect(onLevelSelect).not.toHaveBeenCalled();
  });

  it('clicking level 0 when it is current passes restart=true', () => {
    const onLevelSelect = vi.fn();
    const { nav } = makeLevelNav({ totalLevels: 3, onLevelSelect });
    getLevelDots(nav)[0].click(); // level 0 is current
    expect(onLevelSelect).toHaveBeenCalledWith(0, true);
  });

  it('clicking a non-current unlocked level passes restart=false', () => {
    const onLevelSelect = vi.fn();
    const { nav } = makeLevelNav({ totalLevels: 3, onLevelSelect });
    nav.completeLevel(0);
    // current is now 1; click level 0 (completed, not current)
    getLevelDots(nav)[0].click();
    expect(onLevelSelect).toHaveBeenCalledWith(0, false);
  });
});

// ─── completeLevel ────────────────────────────────────────────────────────────

describe('completeLevel', () => {
  it('saves completed status for the level', () => {
    const { nav } = makeLevelNav({ gameId: 'comp-game', totalLevels: 5 });
    nav.completeLevel(2);
    expect(getLevelProgress('comp-game')[2]).toBe('completed');
  });

  it('completed level dot shows checkmark', () => {
    const { nav } = makeLevelNav({ totalLevels: 3 });
    nav.completeLevel(0);
    expect(getLevelDots(nav)[0].textContent).toBe('\u2713');
  });

  it('advances current to next level (next dot shows level number)', () => {
    const { nav } = makeLevelNav({ totalLevels: 5 });
    nav.completeLevel(0); // current becomes 1
    // Level 1 is now current — its text is "2" (1-based)
    expect(getLevelDots(nav)[1].textContent).toBe('2');
  });

  it('does not advance past last level', () => {
    const { nav } = makeLevelNav({ gameId: 'last-game', totalLevels: 3 });
    nav.completeLevel(0);
    nav.completeLevel(1);
    nav.completeLevel(2);
    expect(getLevelProgress('last-game')[2]).toBe('completed');
  });

  it('unlocks the next level for clicking', () => {
    const onLevelSelect = vi.fn();
    const { nav } = makeLevelNav({ totalLevels: 3, onLevelSelect });
    nav.completeLevel(0);
    getLevelDots(nav)[1].click();
    expect(onLevelSelect).toHaveBeenCalled();
  });
});

// ─── skipLevel ────────────────────────────────────────────────────────────────

describe('skipLevel', () => {
  it('saves skipped status for the level', () => {
    const { nav } = makeLevelNav({ gameId: 'skip-game', totalLevels: 5 });
    nav.skipLevel(1);
    expect(getLevelProgress('skip-game')[1]).toBe('skipped');
  });

  it('skipped level dot shows a dash', () => {
    const { nav } = makeLevelNav({ totalLevels: 4 });
    nav.skipLevel(0);
    nav.skipLevel(1);
    expect(getLevelDots(nav)[0].textContent).toBe('\u2013');
  });

  it('advances current pointer but does not unlock next level', () => {
    // After skipLevel(0), current pointer = 1 but level 1 is still locked
    // (unlock requires completion, not just skipping)
    const { nav } = makeLevelNav({ gameId: 'skip-adv', totalLevels: 5 });
    nav.skipLevel(0);
    // Level 0 becomes skipped, level 1 becomes current — but 1 > maxUnlocked(0)
    expect(getLevelProgress('skip-adv')[0]).toBe('skipped');
    // Level 0 is still clickable (maxUnlocked = 0, isLocked = 0 > 0 = false)
    const onLevelSelect = vi.fn();
    const { nav: nav2 } = makeLevelNav({ gameId: 'skip-adv', totalLevels: 5, onLevelSelect });
    getLevelDots(nav2)[0].click(); // level 0: skipped but unlocked
    expect(onLevelSelect).toHaveBeenCalledWith(0, false); // not current, not restart
  });
});

// ─── setCurrentLevel ──────────────────────────────────────────────────────────

describe('setCurrentLevel', () => {
  it('changes current without modifying progress', () => {
    const { nav } = makeLevelNav({ gameId: 'cur-game', totalLevels: 5 });
    nav.completeLevel(0); // progress: {0: 'completed'}
    nav.setCurrentLevel(0); // move back to 0
    const progress = getLevelProgress('cur-game');
    expect(Object.keys(progress)).toHaveLength(1);
    expect(progress[0]).toBe('completed');
  });

  it('clicking the new current level passes restart=true', () => {
    const onLevelSelect = vi.fn();
    const { nav } = makeLevelNav({ totalLevels: 5, onLevelSelect });
    nav.completeLevel(0);
    nav.setCurrentLevel(1); // set current to 1
    getLevelDots(nav)[1].click();
    expect(onLevelSelect).toHaveBeenCalledWith(1, true);
  });
});

// ─── completeDaily ────────────────────────────────────────────────────────────

describe('completeDaily', () => {
  it('keeps daily dot in DOM after completeDaily', () => {
    const { nav } = makeLevelNav({ hasDaily: true });
    nav.completeDaily();
    expect(nav.dotsContainer.querySelector('.mg-level-daily')).not.toBeNull();
  });

  it('daily dot still fires onDailySelect after completeDaily', () => {
    const onDailySelect = vi.fn();
    const { nav } = makeLevelNav({ hasDaily: true, onDailySelect });
    nav.completeDaily();
    nav.dotsContainer.querySelector('.mg-level-daily').click();
    expect(onDailySelect).toHaveBeenCalledTimes(1);
  });
});

// ─── destroy ─────────────────────────────────────────────────────────────────

describe('destroy', () => {
  it('removes the strip from the container', () => {
    const { nav, container } = makeLevelNav();
    nav.destroy();
    expect(container.querySelector('.mg-level-nav')).toBeNull();
  });

  it('is safe to call destroy twice', () => {
    const { nav } = makeLevelNav();
    nav.destroy();
    expect(() => nav.destroy()).not.toThrow();
  });

  it('destroyed instance is excluded from subsequent cleanupAll', () => {
    const { nav, container } = makeLevelNav();
    nav.destroy();
    expect(() => cleanupAll()).not.toThrow();
    expect(container.querySelector('.mg-level-nav')).toBeNull();
  });
});

// ─── refresh ──────────────────────────────────────────────────────────────────

describe('refresh', () => {
  it('rebuilds level dots after completeLevel', () => {
    const { nav } = makeLevelNav({ totalLevels: 3 });
    nav.completeLevel(0);
    const dots = getLevelDots(nav);
    expect(dots[0].textContent).toBe('\u2713'); // completed
    expect(dots[1].textContent).toBe('2');      // current (1-based label)
  });

  it('preserves endless dot after refresh', () => {
    const { nav } = makeLevelNav({ hasEndless: true, totalLevels: 3 });
    nav.completeLevel(0);
    expect(nav.dotsContainer.querySelector('.mg-level-endless')).not.toBeNull();
  });

  it('preserves daily dot after refresh', () => {
    const { nav } = makeLevelNav({ hasDaily: true, totalLevels: 3 });
    nav.completeLevel(0);
    expect(nav.dotsContainer.querySelector('.mg-level-daily')).not.toBeNull();
  });

  it('preserves correct level count after refresh', () => {
    const { nav } = makeLevelNav({ totalLevels: 5 });
    nav.completeLevel(0);
    expect(getLevelDots(nav)).toHaveLength(5);
  });
});

// ─── Dot textContent labels ────────────────────────────────────────────────────

describe('dot textContent labels', () => {
  it('current dot shows 1-based level number', () => {
    const { nav } = makeLevelNav({ totalLevels: 3 });
    expect(getLevelDots(nav)[0].textContent).toBe('1'); // level 0, label "1"
  });

  it('locked dot shows 1-based level number', () => {
    const { nav } = makeLevelNav({ totalLevels: 5 });
    expect(getLevelDots(nav)[1].textContent).toBe('2'); // level 1 locked, label "2"
  });

  it('completed dot shows checkmark', () => {
    const { nav } = makeLevelNav({ totalLevels: 3 });
    nav.completeLevel(0);
    expect(getLevelDots(nav)[0].textContent).toBe('\u2713');
  });

  it('skipped dot shows dash', () => {
    const { nav } = makeLevelNav({ totalLevels: 4 });
    nav.skipLevel(0);
    expect(getLevelDots(nav)[0].textContent).toBe('\u2013');
  });
});

// ─── Click plays audio ────────────────────────────────────────────────────────

describe('click plays tap sound', () => {
  it('unlocked level dot click plays tap', () => {
    const { nav } = makeLevelNav({ totalLevels: 3, onLevelSelect: vi.fn() });
    getLevelDots(nav)[0].click();
    expect(playTap).toHaveBeenCalled();
  });

  it('locked level dot click does NOT play tap', () => {
    const { nav } = makeLevelNav({ totalLevels: 3, onLevelSelect: vi.fn() });
    getLevelDots(nav)[1].click(); // level 1 locked
    expect(playTap).not.toHaveBeenCalled();
  });
});

// ─── Multiple instances ───────────────────────────────────────────────────────

describe('multiple instances', () => {
  it('different gameIds maintain separate progress', () => {
    const { nav: navA } = makeLevelNav({ gameId: 'sep-a', totalLevels: 3 });
    const { nav: navB } = makeLevelNav({ gameId: 'sep-b', totalLevels: 3 });
    navA.completeLevel(0);
    expect(getLevelProgress('sep-a')[0]).toBe('completed');
    expect(getLevelProgress('sep-b')).toEqual({});
  });

  it('cleanupAll removes all active instances', () => {
    const containers = [];
    for (let i = 0; i < 3; i++) {
      const { container } = makeLevelNav({ gameId: `multi-${i}` });
      containers.push(container);
    }
    cleanupAll();
    containers.forEach(c => {
      expect(c.querySelector('.mg-level-nav')).toBeNull();
    });
  });
});
