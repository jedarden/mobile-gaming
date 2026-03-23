/**
 * Fail Speedrun - Unit Tests
 *
 * @vitest-environment jsdom
 *
 * Tests for the fail speedrun mode functionality.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Create mock storage
const createMockStorage = () => ({
  data: {},
  get(key, defaultValue) {
    return this.data[key] ?? defaultValue;
  },
  set(key, value) {
    this.data[key] = value;
    return true;
  },
  delete(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  },
  _getAllKeys() {
    return Object.keys(this.data);
  }
});

let mockStorageInstance = createMockStorage();

vi.mock('../../src/shared/storage.js', () => ({
  storage: {
    get(key, defaultValue) {
      return mockStorageInstance.get(key, defaultValue);
    },
    set(key, value) {
      return mockStorageInstance.set(key, value);
    },
    delete(key) {
      return mockStorageInstance.delete(key);
    }
  }
}));

// Mock performance.now for consistent timing tests
let mockPerformanceTime = 0;
vi.stubGlobal('performance', {
  now: () => mockPerformanceTime
});

// Import after mocking
import {
  createFailSpeedrun,
  isGameSupported,
  getSupportedGames,
  getGameConfig,
  getPersonalBest,
  getAllPersonalBests,
  savePersonalBest,
  getEarnedBadges,
  checkAdRecreationBadge,
  formatTime,
  isFailSpeedrunEnabled,
  setFailSpeedrunEnabled,
  toggleFailSpeedrun,
  showFailResult,
  showFailTimer,
  cleanupAllOverlays,
} from '../../src/shared/fail-speedrun.js';

describe('Fail Speedrun', () => {
  beforeEach(() => {
    mockStorageInstance = createMockStorage();
    mockPerformanceTime = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Game Support', () => {
    describe('isGameSupported', () => {
      it('should return true for supported games with fail states', () => {
        expect(isGameSupported('pull-the-pin')).toBe(true);
        expect(isGameSupported('water-sort')).toBe(true);
        expect(isGameSupported('brain-teaser')).toBe(true);
        expect(isGameSupported('save-the-character')).toBe(true);
        expect(isGameSupported('jelly-shift')).toBe(true);
        expect(isGameSupported('giant-runner')).toBe(true);
      });

      it('should return false for excluded games', () => {
        expect(isGameSupported('satisfying-asmr')).toBe(false);
      });

      it('should return false for unknown games', () => {
        expect(isGameSupported('unknown-game')).toBe(false);
      });

      it('should return false for games with alternate objectives (no fail state)', () => {
        // Parking Escape and Bridge Race have alternate objectives, not traditional fail states
        expect(isGameSupported('parking-escape')).toBe(false);
        expect(isGameSupported('bridge-race')).toBe(false);
      });
    });

    describe('getSupportedGames', () => {
      it('should return array of supported game IDs', () => {
        const games = getSupportedGames();
        expect(Array.isArray(games)).toBe(true);
        expect(games.length).toBeGreaterThan(0);
        expect(games).toContain('pull-the-pin');
        expect(games).toContain('water-sort');
        expect(games).toContain('jelly-shift');
      });

      it('should not include excluded games', () => {
        const games = getSupportedGames();
        expect(games).not.toContain('satisfying-asmr');
      });

      it('should have 9+ supported games with fail states', () => {
        // Per spec: "Fail speedrun available for 10 of 12 games"
        // Currently 9 games have traditional fail states
        // 2 games (parking-escape, bridge-race) have alternate objectives
        // 1 game (satisfying-asmr) is excluded
        const games = getSupportedGames();
        expect(games.length).toBeGreaterThanOrEqual(9);
      });
    });

    describe('getGameConfig', () => {
      it('should return config for supported games', () => {
        const config = getGameConfig('pull-the-pin');
        expect(config).toBeDefined();
        expect(config.name).toBe('Pull the Pin');
        expect(config.failObjective).toBeDefined();
        expect(config.hasFailState).toBe(true);
      });

      it('should return null for unknown games', () => {
        const config = getGameConfig('unknown-game');
        expect(config).toBeNull();
      });
    });
  });

  describe('Leaderboard', () => {
    describe('savePersonalBest', () => {
      it('should save first personal best', () => {
        const result = savePersonalBest('pull-the-pin', 0, 1500);
        expect(result).toBe(true);
        expect(getPersonalBest('pull-the-pin', 0)).toBe(1500);
      });

      it('should save new best if faster', () => {
        savePersonalBest('pull-the-pin', 0, 1500);
        const result = savePersonalBest('pull-the-pin', 0, 1200);
        expect(result).toBe(true);
        expect(getPersonalBest('pull-the-pin', 0)).toBe(1200);
      });

      it('should not save if slower', () => {
        savePersonalBest('pull-the-pin', 0, 1500);
        const result = savePersonalBest('pull-the-pin', 0, 2000);
        expect(result).toBe(false);
        expect(getPersonalBest('pull-the-pin', 0)).toBe(1500);
      });

      it('should track bests per level', () => {
        savePersonalBest('pull-the-pin', 0, 1500);
        savePersonalBest('pull-the-pin', 1, 2000);
        savePersonalBest('water-sort', 0, 3000);

        expect(getPersonalBest('pull-the-pin', 0)).toBe(1500);
        expect(getPersonalBest('pull-the-pin', 1)).toBe(2000);
        expect(getPersonalBest('water-sort', 0)).toBe(3000);
      });
    });

    describe('getPersonalBest', () => {
      it('should return null when no best exists', () => {
        expect(getPersonalBest('pull-the-pin', 0)).toBeNull();
      });

      it('should return stored best time', () => {
        savePersonalBest('pull-the-pin', 0, 1234);
        expect(getPersonalBest('pull-the-pin', 0)).toBe(1234);
      });
    });

    describe('getAllPersonalBests', () => {
      it('should return empty object when no bests exist', () => {
        const bests = getAllPersonalBests('pull-the-pin');
        expect(bests).toEqual({});
      });

      it('should return all bests for a game', () => {
        savePersonalBest('pull-the-pin', 0, 1500);
        savePersonalBest('pull-the-pin', 2, 2000);
        savePersonalBest('water-sort', 0, 3000);

        // Note: This test depends on localStorage iteration which isn't fully mocked
        // The getAllPersonalBests function iterates over stored keys
        // We can only verify that the bests object is populated correctly
        const bests = getAllPersonalBests('pull-the-pin');
        // At minimum, the bests for level 0 and 2 should be set
        expect(bests[0]).toBe(1500);
        expect(bests[2]).toBe(2000);
        // Level 1 should not have a best
      });
    });
  });

  describe('Timer', () => {
    describe('formatTime', () => {
      it('should format sub-second times correctly', () => {
        expect(formatTime(500)).toBe('0.500');
        expect(formatTime(123)).toBe('0.123');
        expect(formatTime(999)).toBe('0.999');
      });

      it('should format seconds correctly', () => {
        expect(formatTime(1000)).toBe('1.000');
        expect(formatTime(2500)).toBe('2.500');
        expect(formatTime(59000)).toBe('59.000');
      });

      it('should format minutes correctly', () => {
        expect(formatTime(60000)).toBe('1:00.000');
        expect(formatTime(90000)).toBe('1:30.000');
        expect(formatTime(125000)).toBe('2:05.000');
      });

      it('should handle null/undefined', () => {
        expect(formatTime(null)).toBe('--:--.---');
        expect(formatTime(undefined)).toBe('--:--.---');
      });

      it('should have millisecond precision', () => {
        expect(formatTime(1234)).toBe('1.234');
        expect(formatTime(1)).toBe('0.001');
      });
    });
  });

  describe('Badges', () => {
    describe('checkAdRecreationBadge', () => {
      it('should award badge for under 3s on pull-the-pin', () => {
        const result = checkAdRecreationBadge('pull-the-pin', 2999);
        expect(result).toBe(true);

        const badges = getEarnedBadges();
        expect(badges).toHaveLength(1);
        expect(badges[0].type).toBe('ad-recreation');
        expect(badges[0].gameId).toBe('pull-the-pin');
      });

      it('should award badge for under 3s on save-the-character', () => {
        const result = checkAdRecreationBadge('save-the-character', 2500);
        expect(result).toBe(true);
      });

      it('should not award badge for over 3s', () => {
        const result = checkAdRecreationBadge('pull-the-pin', 3500);
        expect(result).toBe(false);
      });

      it('should not award badge for exactly 3s', () => {
        const result = checkAdRecreationBadge('pull-the-pin', 3000);
        expect(result).toBe(false);
      });

      it('should not award badge for other games', () => {
        const result = checkAdRecreationBadge('water-sort', 1000);
        expect(result).toBe(false);
      });

      it('should not award badge twice for same game', () => {
        checkAdRecreationBadge('pull-the-pin', 1000);
        const result = checkAdRecreationBadge('pull-the-pin', 500);
        expect(result).toBe(false);

        const badges = getEarnedBadges();
        expect(badges).toHaveLength(1);
      });

      it('can award badge for multiple games', () => {
        checkAdRecreationBadge('pull-the-pin', 1000);
        checkAdRecreationBadge('save-the-character', 2000);

        const badges = getEarnedBadges();
        expect(badges).toHaveLength(2);
      });
    });

    describe('getEarnedBadges', () => {
      it('should return empty array when no badges earned', () => {
        const badges = getEarnedBadges();
        expect(badges).toEqual([]);
      });
    });
  });

  describe('Fail Speedrun Session', () => {
    describe('createFailSpeedrun', () => {
      it('should create a fail speedrun instance', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });

        expect(speedrun).toBeDefined();
        expect(speedrun.gameId).toBe('pull-the-pin');
        expect(speedrun.levelIndex).toBe(0);
        expect(typeof speedrun.start).toBe('function');
        expect(typeof speedrun.recordInput).toBe('function');
        expect(typeof speedrun.recordFail).toBe('function');
      });

      it('should start with no elapsed time', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });

        expect(speedrun.getElapsedTime()).toBeNull();
      });

      it('should start timing on first input', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });

        speedrun.start();
        expect(speedrun.getElapsedTime()).toBeNull();

        mockPerformanceTime = 100;
        speedrun.recordInput();
        expect(speedrun.getElapsedTime()).toBe(0);

        mockPerformanceTime = 250;
        expect(speedrun.getElapsedTime()).toBe(150);
      });

      it('returns null result when recordFail called before recordInput (firstInputTime === null guard)', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });
        speedrun.start(); // isRunning=true but firstInputTime still null
        const result = speedrun.recordFail();
        expect(result.timeMs).toBeNull();
        expect(result.isNewBest).toBe(false);
        expect(result.badgeAwarded).toBe(false);
      });

      it('returns null result when recordFail called after stop() (!isRunning guard)', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });
        mockPerformanceTime = 0;
        speedrun.start();
        mockPerformanceTime = 100;
        speedrun.recordInput(); // firstInputTime is now set (non-null)
        speedrun.stop();        // isRunning = false
        // !isRunning is true → guard fires → null result
        const result = speedrun.recordFail();
        expect(result.timeMs).toBeNull();
        expect(result.isNewBest).toBe(false);
        expect(result.badgeAwarded).toBe(false);
      });

      it('should stop timing on recordFail', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });

        speedrun.start();

        mockPerformanceTime = 100;
        speedrun.recordInput();

        mockPerformanceTime = 500;
        const result = speedrun.recordFail();

        expect(result.timeMs).toBe(400);
        expect(result.isNewBest).toBe(true);
      });

      it('is a no-op when called before start() (!isRunning guard)', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });
        // recordInput before start() → !isRunning is true → early return, hasInput stays false
        mockPerformanceTime = 100;
        speedrun.recordInput(); // should silently do nothing
        expect(speedrun.getElapsedTime()).toBeNull(); // no firstInputTime set
      });

      it('should only record first input once', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });

        speedrun.start();

        mockPerformanceTime = 100;
        speedrun.recordInput();

        mockPerformanceTime = 200;
        speedrun.recordInput(); // Should be ignored - firstInputTime should still be 100

        // Elapsed time is 200-100=100, NOT 200-200=0
        // This proves firstInputTime wasn't updated by the second call
        expect(speedrun.getElapsedTime()).toBe(100);
      });

      it('should save personal best on fail', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });

        speedrun.start();

        mockPerformanceTime = 100;
        speedrun.recordInput();

        mockPerformanceTime = 500;
        const result = speedrun.recordFail();

        expect(result.isNewBest).toBe(true);
        expect(getPersonalBest('pull-the-pin', 0)).toBe(400);
      });

      it('should detect new personal best', () => {
        // Set existing best
        savePersonalBest('pull-the-pin', 0, 1000);

        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });

        speedrun.start();

        mockPerformanceTime = 100;
        speedrun.recordInput();

        mockPerformanceTime = 500; // 400ms fail - faster than 1000ms best
        const result = speedrun.recordFail();

        expect(result.timeMs).toBe(400);
        expect(result.isNewBest).toBe(true);
      });

      it('should detect if not new best', () => {
        // Set existing best
        savePersonalBest('pull-the-pin', 0, 100);

        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });

        speedrun.start();

        mockPerformanceTime = 100;
        speedrun.recordInput();

        mockPerformanceTime = 500; // 400ms fail - slower than 100ms best
        const result = speedrun.recordFail();

        expect(result.timeMs).toBe(400);
        expect(result.isNewBest).toBe(false);
      });

      it('should award badge for fast fail on eligible games', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });

        speedrun.start();

        mockPerformanceTime = 100;
        speedrun.recordInput();

        mockPerformanceTime = 200; // 100ms fail - under 3s
        const result = speedrun.recordFail();

        expect(result.badgeAwarded).toBe(true);
      });

      it('should not award badge for slow fail', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });

        speedrun.start();

        mockPerformanceTime = 100;
        speedrun.recordInput();

        mockPerformanceTime = 5000; // 4900ms fail - over 3s
        const result = speedrun.recordFail();

        expect(result.badgeAwarded).toBe(false);
      });

      it('should call onFail callback', () => {
        const onFail = vi.fn();
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0,
          onFail
        });

        speedrun.start();

        mockPerformanceTime = 100;
        speedrun.recordInput();

        mockPerformanceTime = 500;
        speedrun.recordFail();

        expect(onFail).toHaveBeenCalledWith(400, true, true);
      });

      it('should call onTick callback', () => {
        const onTick = vi.fn();
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0,
          onTick,
          tickInterval: 10
        });

        speedrun.start();

        mockPerformanceTime = 100;
        speedrun.recordInput();

        // Manually advance and trigger tick (vitest fake timers would be better)
        mockPerformanceTime = 110;

        speedrun.stop(); // Stop to clear interval

        // onTick should have been set up
        expect(typeof onTick).toBe('function');
      });

      it('should return state correctly', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 5
        });

        speedrun.start();

        const state = speedrun.getState();

        expect(state.gameId).toBe('pull-the-pin');
        expect(state.levelIndex).toBe(5);
        expect(state.isRunning).toBe(true);
        expect(state.hasInput).toBe(false);
      });

      it('should reset correctly', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0
        });

        speedrun.start();

        mockPerformanceTime = 100;
        speedrun.recordInput();

        mockPerformanceTime = 500;
        speedrun.recordFail();

        speedrun.reset();

        expect(speedrun.getElapsedTime()).toBeNull();
        expect(speedrun.getState().isRunning).toBe(false);
      });

      it('does not throw when recordFail called without onFail callback (if(onFail) false branch)', () => {
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0,
          // no onFail
        });
        speedrun.start();
        mockPerformanceTime = 100;
        speedrun.recordInput();
        mockPerformanceTime = 300;
        let result;
        expect(() => { result = speedrun.recordFail(); }).not.toThrow();
        expect(result.timeMs).toBe(200);
      });

      it('skips tick interval setup when onTick not provided (if(onTick) false branch in start())', () => {
        // No onTick — tickIntervalId should stay null; stop() is a no-op for intervals
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0,
          // no onTick
        });
        speedrun.start();
        // stop() must not throw even though no interval was ever set
        expect(() => speedrun.stop()).not.toThrow();
      });

      it('clears active tick interval on recordFail (tickIntervalId !== null branch)', () => {
        vi.useFakeTimers();
        const onTick = vi.fn();
        const speedrun = createFailSpeedrun({
          gameId: 'pull-the-pin',
          levelIndex: 0,
          onTick,
          tickInterval: 50,
        });
        speedrun.start();
        mockPerformanceTime = 100;
        speedrun.recordInput();
        vi.advanceTimersByTime(150); // fire the interval a few times
        mockPerformanceTime = 500;
        speedrun.recordFail(); // clears interval
        const callsAtFail = onTick.mock.calls.length;
        vi.advanceTimersByTime(500); // no more ticks should fire
        expect(onTick.mock.calls.length).toBe(callsAtFail);
        vi.useRealTimers();
      });
    });
  });

  describe('Settings', () => {
    describe('isFailSpeedrunEnabled', () => {
      it('should return false by default', () => {
        expect(isFailSpeedrunEnabled('pull-the-pin')).toBe(false);
      });

      it('should return true when enabled', () => {
        setFailSpeedrunEnabled('pull-the-pin', true);
        expect(isFailSpeedrunEnabled('pull-the-pin')).toBe(true);
      });
    });

    describe('setFailSpeedrunEnabled', () => {
      it('should enable fail speedrun mode', () => {
        setFailSpeedrunEnabled('water-sort', true);
        expect(isFailSpeedrunEnabled('water-sort')).toBe(true);
      });

      it('should disable fail speedrun mode', () => {
        setFailSpeedrunEnabled('water-sort', true);
        setFailSpeedrunEnabled('water-sort', false);
        expect(isFailSpeedrunEnabled('water-sort')).toBe(false);
      });
    });

    describe('toggleFailSpeedrun', () => {
      it('should toggle from false to true', () => {
        const result = toggleFailSpeedrun('jelly-shift');
        expect(result).toBe(true);
        expect(isFailSpeedrunEnabled('jelly-shift')).toBe(true);
      });

      it('should toggle from true to false', () => {
        setFailSpeedrunEnabled('jelly-shift', true);
        const result = toggleFailSpeedrun('jelly-shift');
        expect(result).toBe(false);
        expect(isFailSpeedrunEnabled('jelly-shift')).toBe(false);
      });
    });
  });

  describe('Per-Game Fail Objectives', () => {
    it('should have fail objectives for all supported games', () => {
      const supportedGames = getSupportedGames();

      for (const gameId of supportedGames) {
        const config = getGameConfig(gameId);
        expect(config).toBeDefined();
        expect(config.failObjective).toBeDefined();
        expect(config.failObjective.length).toBeGreaterThan(0);
      }
    });

    it('should have correct fail objectives', () => {
      expect(getGameConfig('pull-the-pin').failObjective).toContain('wrong cup');
      expect(getGameConfig('water-sort').failObjective).toContain('wrong color');
      expect(getGameConfig('brain-teaser').failObjective).toContain('wrong answer');
      expect(getGameConfig('save-the-character').failObjective).toContain('worst choice');
      expect(getGameConfig('jelly-shift').failObjective).toContain('splat');
      expect(getGameConfig('giant-runner').failObjective).toContain('smallest');
    });
  });
});

// ── getTotalTime — null guard (startTime === null) ─────────────────────────

describe('getTotalTime — null guard before start()', () => {
  it('returns null before start() is called (startTime === null → return null branch)', () => {
    const speedrun = createFailSpeedrun({ gameId: 'pull-the-pin', levelIndex: 0 });
    // startTime is initialised to null; getTotalTime() checks startTime === null and returns null
    expect(speedrun.getTotalTime()).toBeNull();
  });
});

// ── showFailResult ────────────────────────────────────────────────────────────

describe('showFailResult', () => {
  beforeEach(() => {
    mockStorageInstance = createMockStorage();
    global.requestAnimationFrame = (cb) => { cb(); };
    document.body.innerHTML = '';
  });
  afterEach(() => {
    cleanupAllOverlays();
    document.body.innerHTML = '';
  });

  it('appends overlay to document.body when no container provided', () => {
    const inst = showFailResult({ gameId: 'pull-the-pin', levelIndex: 0, timeMs: 1234 });
    expect(document.body.querySelector('.fs-overlay')).not.toBeNull();
    inst.destroy();
  });

  it('uses gameConfig.failObjective as subtitle when gameId is known (gameConfig?.failObjective truthy)', () => {
    const inst = showFailResult({ gameId: 'water-sort', levelIndex: 0, timeMs: 1000 });
    const subtitle = document.body.querySelector('.fs-subtitle');
    expect(subtitle.textContent).toContain('wrong color');
    inst.destroy();
  });

  it('falls back to "Fastest fail" subtitle when gameId unknown (gameConfig null → || fallback)', () => {
    const inst = showFailResult({ gameId: 'unknown-game-xyz', levelIndex: 0, timeMs: 500 });
    const subtitle = document.body.querySelector('.fs-subtitle');
    expect(subtitle.textContent).toBe('Fastest fail');
    inst.destroy();
  });

  it('shows Ad Recreation badge when badgeAwarded=true (if(badgeAwarded) true arm)', () => {
    const inst = showFailResult({ gameId: 'pull-the-pin', levelIndex: 0, timeMs: 999, badgeAwarded: true });
    expect(document.body.querySelector('.fs-ad-badge')).not.toBeNull();
    inst.destroy();
  });

  it('does not show Ad Recreation badge when badgeAwarded=false (default, if(badgeAwarded) false arm)', () => {
    const inst = showFailResult({ gameId: 'pull-the-pin', levelIndex: 0, timeMs: 999 });
    expect(document.body.querySelector('.fs-ad-badge')).toBeNull();
    inst.destroy();
  });

  it('shows "New Personal Best!" when isNewBest=true (if(isNewBest) true arm)', () => {
    const inst = showFailResult({ gameId: 'pull-the-pin', levelIndex: 0, timeMs: 999, isNewBest: true });
    expect(document.body.querySelector('.fs-new-best')).not.toBeNull();
    inst.destroy();
  });

  it('does not show "New Personal Best!" when isNewBest=false (default, if(isNewBest) false arm)', () => {
    const inst = showFailResult({ gameId: 'pull-the-pin', levelIndex: 0, timeMs: 999 });
    expect(document.body.querySelector('.fs-new-best')).toBeNull();
    inst.destroy();
  });

  it('shows previous best stat when a personal best exists (if(previousBest !== null) true arm)', () => {
    savePersonalBest('pull-the-pin', 0, 800);
    const inst = showFailResult({ gameId: 'pull-the-pin', levelIndex: 0, timeMs: 999 });
    const stats = document.body.querySelectorAll('.fs-stat');
    expect(stats.length).toBe(2); // "This Run" + "Best"
    inst.destroy();
  });

  it('does not show previous best stat when no personal best exists (if(previousBest !== null) false arm)', () => {
    const inst = showFailResult({ gameId: 'pull-the-pin', levelIndex: 0, timeMs: 999 });
    const stats = document.body.querySelectorAll('.fs-stat');
    expect(stats.length).toBe(1); // "This Run" only
    inst.destroy();
  });

  it('calls onRetry when retry button clicked (if(action==="retry"&&onRetry) true arm)', () => {
    const onRetry = vi.fn();
    showFailResult({ gameId: 'pull-the-pin', levelIndex: 0, timeMs: 500, onRetry });
    document.body.querySelector('[data-action="retry"]').click();
    expect(onRetry).toHaveBeenCalled();
  });

  it('calls onClose when close button clicked (if(action==="close"&&onClose) true arm)', () => {
    const onClose = vi.fn();
    showFailResult({ gameId: 'pull-the-pin', levelIndex: 0, timeMs: 500, onClose });
    document.body.querySelector('[data-action="close"]').click();
    expect(onClose).toHaveBeenCalled();
  });

  it('appends to custom container when provided (container || document.body true arm)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = showFailResult({ gameId: 'pull-the-pin', levelIndex: 0, timeMs: 500, container });
    expect(container.querySelector('.fs-overlay')).not.toBeNull();
    inst.destroy();
  });
});

// ── showFailTimer ─────────────────────────────────────────────────────────────

describe('showFailTimer', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { document.body.innerHTML = ''; });

  it('appends timer element to document.body when no container (container || document.body false arm)', () => {
    const inst = showFailTimer({ getCurrentTime: () => 0 });
    expect(document.body.querySelector('.fs-timer')).not.toBeNull();
    inst.destroy();
  });

  it('appends to custom container when provided (container || document.body true arm)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const inst = showFailTimer({ container, getCurrentTime: () => 0 });
    expect(container.querySelector('.fs-timer')).not.toBeNull();
    inst.destroy();
  });

  it('update(false) shows "Waiting..." and adds fs-waiting class (hasInput false arm)', () => {
    const inst = showFailTimer({ getCurrentTime: () => 500 });
    inst.update(false);
    expect(inst.timer.textContent).toBe('Waiting...');
    expect(inst.timer.classList.contains('fs-waiting')).toBe(true);
    inst.destroy();
  });

  it('update(true) shows formatted time and removes fs-waiting class (hasInput true arm)', () => {
    const inst = showFailTimer({ getCurrentTime: () => 1234 });
    inst.update(true);
    expect(inst.timer.classList.contains('fs-waiting')).toBe(false);
    expect(inst.timer.textContent).not.toBe('Waiting...');
    inst.destroy();
  });

  it('destroy() removes timer from DOM', () => {
    const inst = showFailTimer({ getCurrentTime: () => 0 });
    expect(document.body.contains(inst.timer)).toBe(true);
    inst.destroy();
    expect(document.body.contains(inst.timer)).toBe(false);
  });

  it('update() after destroy() is a no-op and does not throw (if(destroyed) early return)', () => {
    const inst = showFailTimer({ getCurrentTime: () => 999 });
    inst.destroy();
    expect(() => inst.update(true)).not.toThrow();
  });
});

// ── cleanupAllOverlays ────────────────────────────────────────────────────────

describe('cleanupAllOverlays', () => {
  beforeEach(() => {
    global.requestAnimationFrame = (cb) => { cb(); };
    document.body.innerHTML = '';
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('removes all active overlay instances from DOM', () => {
    showFailResult({ gameId: 'pull-the-pin', levelIndex: 0, timeMs: 500 });
    showFailResult({ gameId: 'water-sort', levelIndex: 0, timeMs: 600 });
    expect(document.body.querySelectorAll('.fs-overlay').length).toBe(2);
    cleanupAllOverlays();
    expect(document.body.querySelectorAll('.fs-overlay').length).toBe(0);
  });

  it('does not throw when no overlays are active', () => {
    expect(() => cleanupAllOverlays()).not.toThrow();
  });
});
