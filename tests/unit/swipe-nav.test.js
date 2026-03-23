/**
 * Swipe Navigation - Unit Tests
 *
 * Tests for gesture detection, game ring ordering, and state preservation.
 * @vitest-environment jsdom
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
  clear() {
    this.data = {};
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
    }
  }
}));

// Import after mocking
import {
  initSwipeNav,
  saveGameRing,
  loadGameRing,
  getGameRing,
  getAdjacentIndices,
  saveGameState,
  getSavedGameState,
  hasSavedState,
  clearSavedGameState,
  getCurrentGameIndex,
  setCurrentGameIndex,
  isSwipeNavTransitioning,
  detectEdgeSwipe,
  isTwoFingerHorizontalSwipe,
  reorderGame,
  CONFIG
} from '../../src/shared/swipe-nav.js';

describe('Swipe Navigation', () => {
  beforeEach(() => {
    mockStorageInstance = createMockStorage();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('CONFIG', () => {
    it('should have correct edge threshold', () => {
      expect(CONFIG.edgeThreshold).toBe(40);
    });

    it('should have correct swipe threshold', () => {
      expect(CONFIG.swipeThreshold).toBe(80);
    });

    it('should have correct velocity threshold', () => {
      expect(CONFIG.velocityThreshold).toBe(0.5);
    });

    it('should have correct transition duration', () => {
      expect(CONFIG.transitionDuration).toBe(300);
    });
  });

  describe('Game Ring', () => {
    it('should return default game ring when no stored ring', () => {
      const ring = getGameRing();
      expect(ring.length).toBeGreaterThan(0);
      expect(ring[0]).toHaveProperty('id');
      expect(ring[0]).toHaveProperty('title');
    });

    it('should save and retrieve game ring', () => {
      const customRing = [
        { id: 'test-game', title: 'Test Game', icon: 'test' }
      ];
      saveGameRing(customRing);

      const retrieved = getGameRing();
      expect(retrieved).toEqual(customRing);
    });

    it('should merge new games with stored ring', () => {
      // Store partial ring (only water-sort), then loadGameRing should add missing defaults
      mockStorageInstance.data['gameRing'] = [
        { id: 'water-sort', title: 'Water Sort', icon: 'droplet' }
      ];

      const ring = loadGameRing();
      expect(ring.length).toBeGreaterThan(1);
      expect(ring.find(g => g.id === 'water-sort')).toBeDefined();
    });

    it('returns default ring when stored value is not an array (Array.isArray false branch)', () => {
      mockStorageInstance.data['gameRing'] = 'not-an-array';
      const ring = loadGameRing();
      expect(Array.isArray(ring)).toBe(true);
      expect(ring.length).toBeGreaterThan(0);
      expect(ring[0]).toHaveProperty('id');
    });

    it('returns default ring when stored value is an empty array (length === 0 false branch)', () => {
      mockStorageInstance.data['gameRing'] = [];
      const ring = loadGameRing();
      expect(Array.isArray(ring)).toBe(true);
      expect(ring.length).toBeGreaterThan(0);
    });
  });

  describe('getAdjacentIndices', () => {
    it('should return correct adjacent indices', () => {
      // Save a ring with known length
      saveGameRing([
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
        { id: 'c', title: 'C' }
      ]);

      const adjacent = getAdjacentIndices(1);
      expect(adjacent.left).toBe(0);
      expect(adjacent.right).toBe(2);
    });

    it('should wrap around to end when at start', () => {
      saveGameRing([
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
        { id: 'c', title: 'C' }
      ]);

      const adjacent = getAdjacentIndices(0);
      expect(adjacent.left).toBe(2); // wrap to end
      expect(adjacent.right).toBe(1);
    });

    it('should wrap around to start when at end', () => {
      saveGameRing([
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
        { id: 'c', title: 'C' }
      ]);

      const adjacent = getAdjacentIndices(2);
      expect(adjacent.left).toBe(1);
      expect(adjacent.right).toBe(0); // wrap to start
    });

    it('should handle single-item ring', () => {
      saveGameRing([{ id: 'a', title: 'A' }]);

      const adjacent = getAdjacentIndices(0);
      expect(adjacent.left).toBe(0);
      expect(adjacent.right).toBe(0);
    });
  });

  describe('Game State Preservation', () => {
    it('should save game state', () => {
      const state = { level: 5, score: 100 };
      saveGameState('test-game', state);

      const retrieved = getSavedGameState('test-game');
      expect(retrieved).toEqual(state);
    });

    it('should return null for non-existent state', () => {
      const state = getSavedGameState('non-existent');
      expect(state).toBeNull();
    });

    it('should detect saved state', () => {
      expect(hasSavedState('test-game')).toBe(false);

      saveGameState('test-game', { level: 1 });
      expect(hasSavedState('test-game')).toBe(true);
    });

    it('should clear saved state', () => {
      saveGameState('test-game', { level: 1 });
      expect(hasSavedState('test-game')).toBe(true);

      clearSavedGameState('test-game');
      expect(hasSavedState('test-game')).toBe(false);
    });

    it('should store separate states per game', () => {
      saveGameState('game-a', { level: 1 });
      saveGameState('game-b', { level: 2 });

      expect(getSavedGameState('game-a').level).toBe(1);
      expect(getSavedGameState('game-b').level).toBe(2);
    });
  });

  describe('detectEdgeSwipe', () => {
    it('should detect left edge swipe', () => {
      const element = {
        getBoundingClientRect: () => ({ left: 0, width: 300 })
      };
      const event = { clientX: 30 };

      const result = detectEdgeSwipe(element, event, 40);
      expect(result).toEqual({ isEdge: true, side: 'left' });
    });

    it('should detect right edge swipe', () => {
      const element = {
        getBoundingClientRect: () => ({ left: 0, width: 300 })
      };
      const event = { clientX: 275 };

      const result = detectEdgeSwipe(element, event, 40);
      expect(result).toEqual({ isEdge: true, side: 'right' });
    });

    it('should return null for non-edge swipe', () => {
      const element = {
        getBoundingClientRect: () => ({ left: 0, width: 300 })
      };
      const event = { clientX: 150 };

      const result = detectEdgeSwipe(element, event, 40);
      expect(result).toBeNull();
    });

    it('should detect touch events', () => {
      const element = {
        getBoundingClientRect: () => ({ left: 0, width: 300 })
      };
      const event = {
        touches: [{ clientX: 30 }]
      };

      const result = detectEdgeSwipe(element, event, 40);
      expect(result).toEqual({ isEdge: true, side: 'left' });
    });

    it('should use custom threshold', () => {
      const element = {
        getBoundingClientRect: () => ({ left: 0, width: 300 })
      };
      const event = { clientX: 50 };

      // Default threshold (40) - not edge
      const result1 = detectEdgeSwipe(element, event, 40);
      expect(result1).toBeNull();

      // Larger threshold (60) - is edge
      const result2 = detectEdgeSwipe(element, event, 60);
      expect(result2).toEqual({ isEdge: true, side: 'left' });
    });

    it('uses changedTouches when touches is absent (changedTouches fallback branch)', () => {
      const element = {
        getBoundingClientRect: () => ({ left: 0, width: 300 })
      };
      // event has changedTouches but NOT touches — exercises the else-if branch
      const event = { changedTouches: [{ clientX: 10 }] };
      const result = detectEdgeSwipe(element, event, 40);
      expect(result).toEqual({ isEdge: true, side: 'left' });
    });
  });

  describe('isTwoFingerHorizontalSwipe', () => {
    it('should return true for two-finger touch', () => {
      const event = {
        touches: [{ clientX: 100 }, { clientX: 200 }]
      };

      expect(isTwoFingerHorizontalSwipe(event)).toBe(true);
    });

    it('should return true for three-finger touch', () => {
      const event = {
        touches: [{ clientX: 100 }, { clientX: 200 }, { clientX: 300 }]
      };

      expect(isTwoFingerHorizontalSwipe(event)).toBe(true);
    });

    it('should return false for single-finger touch', () => {
      const event = {
        touches: [{ clientX: 100 }]
      };

      expect(isTwoFingerHorizontalSwipe(event)).toBe(false);
    });

    it('should return false for mouse event', () => {
      const event = {
        clientX: 100
      };

      expect(isTwoFingerHorizontalSwipe(event)).toBe(false);
    });

    it('should return false when touches is undefined', () => {
      const event = {};

      expect(isTwoFingerHorizontalSwipe(event)).toBe(false);
    });
  });

  describe('reorderGame', () => {
    beforeEach(() => {
      saveGameRing([
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
        { id: 'c', title: 'C' },
        { id: 'd', title: 'D' }
      ]);
    });

    it('should reorder game to new position', () => {
      reorderGame(0, 2); // Move 'a' to position 2

      const ring = getGameRing();
      expect(ring[0].id).toBe('b');
      expect(ring[1].id).toBe('c');
      expect(ring[2].id).toBe('a');
      expect(ring[3].id).toBe('d');
    });

    it('should handle reordering to same position', () => {
      reorderGame(1, 1);

      const ring = getGameRing();
      expect(ring[1].id).toBe('b');
    });

    it('should handle invalid indices', () => {
      const originalRing = getGameRing();

      reorderGame(-1, 2);
      expect(getGameRing()).toEqual(originalRing);

      reorderGame(0, 10);
      expect(getGameRing()).toEqual(originalRing);
    });

    it('returns early when fromIndex equals ring length (>= boundary, not just >)', () => {
      const originalRing = getGameRing();
      reorderGame(4, 0); // ring has 4 items, index 4 is exactly out of bounds
      expect(getGameRing()).toEqual(originalRing);
    });

    it('updates currentGameIndex to toIndex when current game is being moved (=== fromIndex branch)', () => {
      setCurrentGameIndex(1); // currently on 'b'
      reorderGame(1, 3);     // move 'b' from index 1 to index 3
      expect(getCurrentGameIndex()).toBe(3);
    });

    it('decrements currentGameIndex when item before current is moved to at/after current (fromIndex < current && toIndex >= current branch)', () => {
      setCurrentGameIndex(2); // currently on 'c' (index 2)
      reorderGame(0, 2);     // move 'a' (before current) to index 2 (at current) → current shifts left
      expect(getCurrentGameIndex()).toBe(1);
    });

    it('increments currentGameIndex when item after current is moved to at/before current (fromIndex > current && toIndex <= current branch)', () => {
      setCurrentGameIndex(1); // currently on 'b' (index 1)
      reorderGame(3, 1);     // move 'd' (after current) to index 1 (at current) → current shifts right
      expect(getCurrentGameIndex()).toBe(2);
    });

    it('leaves currentGameIndex unchanged when reorder does not affect current position (implicit else — no branch fires)', () => {
      // currentGameIndex=2 ('c'), moving 'a' (index 0) to index 1:
      //   ring goes [a,b,c,d] → [b,a,c,d]; 'c' stays at index 2
      //   Condition 1: 2 === 0 → false
      //   Condition 2: 0 < 2 (true) && 1 >= 2 (false) → false
      //   Condition 3: 0 > 2 (false) → false
      //   → no branch fires; currentGameIndex stays 2
      setCurrentGameIndex(2);
      reorderGame(0, 1);
      expect(getCurrentGameIndex()).toBe(2);
    });
  });

  describe('Current Game Index', () => {
    it('should get and set current game index', () => {
      setCurrentGameIndex(3);
      expect(getCurrentGameIndex()).toBe(3);
    });
  });

  describe('Transition State', () => {
    it('should not be transitioning initially', () => {
      expect(isSwipeNavTransitioning()).toBe(false);
    });
  });

  describe('initSwipeNav', () => {
    it('should return cleanup function', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const cleanup = initSwipeNav({
        currentGameId: 'water-sort',
        container
      });

      expect(typeof cleanup).toBe('function');

      // Cleanup
      cleanup();
      document.body.removeChild(container);
    });

    it('should create indicator element', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      initSwipeNav({
        currentGameId: 'water-sort',
        container
      });

      const indicator = container.querySelector('#swipe-nav-indicator');
      expect(indicator).toBeDefined();
      expect(indicator).not.toBeNull();

      // Cleanup
      document.body.removeChild(container);
    });

    it('should add swipe-nav-styles to document', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      initSwipeNav({
        currentGameId: 'water-sort',
        container
      });

      const styles = document.getElementById('swipe-nav-styles');
      expect(styles).toBeDefined();
      expect(styles).not.toBeNull();

      // Cleanup
      document.body.removeChild(container);
      styles?.remove();
    });

    it('should remove indicator on cleanup', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const cleanup = initSwipeNav({
        currentGameId: 'water-sort',
        container
      });

      expect(container.querySelector('#swipe-nav-indicator')).not.toBeNull();

      cleanup();

      expect(container.querySelector('#swipe-nav-indicator')).toBeNull();

      document.body.removeChild(container);
    });
  });

  describe('Gesture Detection - Edge Swipe vs In-Game Swipe', () => {
    it('should differentiate edge swipe from center swipe', () => {
      const element = {
        getBoundingClientRect: () => ({ left: 0, width: 300 })
      };

      // Edge swipe (within 40px of left edge)
      const edgeEvent = { clientX: 30 };
      const edgeResult = detectEdgeSwipe(element, edgeEvent, 40);
      expect(edgeResult).not.toBeNull();

      // Center swipe (not near edge)
      const centerEvent = { clientX: 150 };
      const centerResult = detectEdgeSwipe(element, centerEvent, 40);
      expect(centerResult).toBeNull();
    });

    it('should recognize two-finger swipe as valid navigation trigger', () => {
      const singleFinger = { touches: [{ clientX: 100 }] };
      const twoFinger = { touches: [{ clientX: 100 }, { clientX: 200 }] };

      expect(isTwoFingerHorizontalSwipe(singleFinger)).toBe(false);
      expect(isTwoFingerHorizontalSwipe(twoFinger)).toBe(true);
    });
  });

  describe('Game Ring Wrap-Around', () => {
    beforeEach(() => {
      saveGameRing([
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
        { id: 'c', title: 'C' }
      ]);
    });

    it('should wrap left from first to last', () => {
      const adjacent = getAdjacentIndices(0);
      expect(adjacent.left).toBe(2);
    });

    it('should wrap right from last to first', () => {
      const adjacent = getAdjacentIndices(2);
      expect(adjacent.right).toBe(0);
    });

    it('should maintain consistent indices', () => {
      for (let i = 0; i < 3; i++) {
        const adjacent = getAdjacentIndices(i);
        // Left and right should be different (unless single item)
        expect(adjacent.left).not.toBe(adjacent.right);
        // Indices should be in valid range
        expect(adjacent.left).toBeGreaterThanOrEqual(0);
        expect(adjacent.left).toBeLessThan(3);
        expect(adjacent.right).toBeGreaterThanOrEqual(0);
        expect(adjacent.right).toBeLessThan(3);
      }
    });
  });

  describe('preloadAdjacentGames — dedup (existingPreload early return)', () => {
    afterEach(() => {
      document.querySelectorAll('link[rel="modulepreload"]').forEach(l => l.remove());
    });

    it('does not create a duplicate modulepreload link when one already exists (existingPreload branch)', () => {
      saveGameRing([
        { id: 'pull-the-pin', title: 'Pull the Pin', icon: 'pin' },
        { id: 'water-sort',   title: 'Water Sort',   icon: 'droplet' },
        { id: 'brain-teaser', title: 'Brain Teaser', icon: 'brain' },
      ]);

      // Remove any leftover preload links from earlier tests to get a clean slate
      document.querySelectorAll('link[rel="modulepreload"]').forEach(l => l.remove());

      // Pre-inject a modulepreload link for pull-the-pin (adjacent-left of water-sort at index 1)
      const preExisting = document.createElement('link');
      preExisting.rel = 'modulepreload';
      preExisting.href = '/src/games/pull-the-pin/game.js';
      document.head.appendChild(preExisting);

      const container = document.createElement('div');
      document.body.appendChild(container);

      const cleanup = initSwipeNav({ currentGameId: 'water-sort', container });

      // Should only be ONE link for pull-the-pin — existing one was found → early return fired
      const pullPinLinks = document.querySelectorAll(
        'link[rel="modulepreload"][href*="/pull-the-pin/game.js"]'
      );
      expect(pullPinLinks.length).toBe(1);

      cleanup();
      document.body.removeChild(container);
    });
  });

  describe('preloadAdjacentGames — !game guard (empty ring)', () => {
    afterEach(() => {
      document.querySelectorAll('link[rel="modulepreload"]').forEach(l => l.remove());
      saveGameRing([{ id: 'water-sort', title: 'Water Sort', icon: 'droplet' }]);
    });

    it('does not throw when game ring is empty (gameRing[NaN] === undefined — !game false branch)', () => {
      // Empty ring → getAdjacentIndices returns NaN indices → gameRing[NaN] = undefined → !game guard fires
      saveGameRing([]);
      const container = document.createElement('div');
      document.body.appendChild(container);

      expect(() => {
        const cleanup = initSwipeNav({ currentGameId: 'water-sort', container });
        cleanup();
      }).not.toThrow();

      document.body.removeChild(container);
    });
  });

  describe('initSwipeNav — unknown currentGameId fallback', () => {
    it('defaults currentGameIndex to 0 when currentGameId is not in the game ring (findIndex === -1 branch)', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const cleanup = initSwipeNav({
        currentGameId: 'completely-unknown-game-id-xyz',
        container,
      });

      // findIndex returns -1 for unknown id → fallback to 0
      expect(getCurrentGameIndex()).toBe(0);

      cleanup();
      document.body.removeChild(container);
    });
  });

  describe('handleSwipeEnd — !targetGame branch', () => {
    afterEach(() => {
      document.querySelectorAll('link[rel="modulepreload"]').forEach(l => l.remove());
      // Restore a valid ring so other tests are not affected
      saveGameRing([{ id: 'water-sort', title: 'Water Sort', icon: 'droplet' }]);
    });

    it('resets isTransitioning to false when targetGame is undefined (empty ring after init)', () => {
      saveGameRing([
        { id: 'water-sort',   title: 'Water Sort',   icon: 'droplet' },
        { id: 'pull-the-pin', title: 'Pull the Pin', icon: 'pin' },
      ]);

      const container = document.createElement('div');
      document.body.appendChild(container);

      // Provide a non-zero bounding rect so gesture thresholds work
      container.getBoundingClientRect = vi.fn().mockReturnValue(
        { left: 0, top: 0, right: 400, bottom: 600, width: 400, height: 600 }
      );

      const cleanup = initSwipeNav({ currentGameId: 'water-sort', container });

      // Replace ring with empty array — getAdjacentIndices will return NaN indices
      // and gameRing[NaN] === undefined, triggering the !targetGame early return
      saveGameRing([]);

      expect(isSwipeNavTransitioning()).toBe(false);

      // Simulate an edge swipe: start at left edge, move past swipeThreshold (80px)
      // With fake timers Date.now() is fixed → duration=0 → velocity=Infinity ≥ 0.5
      container.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 300, bubbles: true }));
      container.dispatchEvent(new MouseEvent('mousemove', { clientX: 110, clientY: 300, bubbles: true }));
      container.dispatchEvent(new MouseEvent('mouseup',   { clientX: 110, clientY: 300, bubbles: true }));

      // handleSwipeEnd ran: set isTransitioning=true, then !targetGame → reset to false
      expect(isSwipeNavTransitioning()).toBe(false);

      cleanup();
      document.body.removeChild(container);
    });
  });

  // ── updateIndicatorHighlight — scrollIntoView absent ──────────────────────

  describe('updateIndicatorHighlight — scrollIntoView absent (if false branch)', () => {
    let container;

    beforeEach(() => {
      saveGameRing([
        { id: 'water-sort',   title: 'Water Sort',   icon: 'droplet' },
        { id: 'pull-the-pin', title: 'Pull the Pin', icon: 'pin' },
      ]);
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('does not throw when activeIcon.scrollIntoView is absent (false branch)', () => {
      initSwipeNav({ currentGameId: 'water-sort', container });

      // Override instance property to shadow prototype scrollIntoView → makes it falsy
      const activeIcon = document.querySelector('.swipe-nav-icon.active');
      if (activeIcon) {
        Object.defineProperty(activeIcon, 'scrollIntoView', { value: undefined, configurable: true });
      }

      // setCurrentGameIndex → updateIndicatorHighlight → if(activeIcon && activeIcon.scrollIntoView) → false
      expect(() => setCurrentGameIndex(0)).not.toThrow();
    });
  });

  // ── handleMove — shouldTrigger=false and absDx≤10 branches ────────────────

  describe('handleMove — if(shouldTrigger && absDx > 10) false branches', () => {
    let container, cleanup;

    beforeEach(() => {
      vi.useFakeTimers();
      saveGameRing([
        { id: 'water-sort',   title: 'Water Sort',   icon: 'droplet' },
        { id: 'pull-the-pin', title: 'Pull the Pin', icon: 'pin' },
      ]);
      container = document.createElement('div');
      document.body.appendChild(container);
      container.getBoundingClientRect = vi.fn().mockReturnValue(
        { left: 0, top: 0, right: 400, bottom: 600, width: 400, height: 600 }
      );
      cleanup = initSwipeNav({ currentGameId: 'water-sort', container });
    });

    afterEach(() => {
      if (cleanup) cleanup();
      document.body.removeChild(container);
      vi.useRealTimers();
    });

    it('does not navigate for a center swipe (shouldTrigger=false branch)', () => {
      // clientX=200 is not within 40px of either edge → isEdgeSwipe=false, touchCount=1
      // → shouldTrigger = false || (1 >= 2 && ...) = false → if body skipped
      container.dispatchEvent(new MouseEvent('mousedown', { clientX: 200, clientY: 300, bubbles: true }));
      container.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300, bubbles: true }));
      container.dispatchEvent(new MouseEvent('mouseup',   { clientX: 300, clientY: 300, bubbles: true }));

      expect(isSwipeNavTransitioning()).toBe(false); // no navigation triggered
    });

    it('does not navigate when absDx <= 10 despite edge swipe start (absDx > 10 false branch)', () => {
      // clientX=5 → left edge (isEdgeSwipe=true, shouldTrigger=true)
      // but mousemove only 5px → absDx=5 ≤ 10 → if body skipped
      container.dispatchEvent(new MouseEvent('mousedown', { clientX: 5,  clientY: 300, bubbles: true }));
      container.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 300, bubbles: true }));
      container.dispatchEvent(new MouseEvent('mouseup',   { clientX: 10, clientY: 300, bubbles: true }));

      expect(isSwipeNavTransitioning()).toBe(false); // absDx=5 ≤ 10 → not triggered
    });
  });

  describe('handleSwipeEnd — successful navigation (setTimeout window.location.href branch)', () => {
    afterEach(() => {
      document.querySelectorAll('link[rel="modulepreload"]').forEach(l => l.remove());
      saveGameRing([{ id: 'water-sort', title: 'Water Sort', icon: 'droplet' }]);
      vi.unstubAllGlobals();
    });

    it('sets window.location.href to target game URL after 50ms (setTimeout branch)', () => {
      saveGameRing([
        { id: 'water-sort',   title: 'Water Sort',   icon: 'droplet' },
        { id: 'pull-the-pin', title: 'Pull the Pin', icon: 'pin' },
      ]);

      const container = document.createElement('div');
      document.body.appendChild(container);
      container.getBoundingClientRect = vi.fn().mockReturnValue(
        { left: 0, top: 0, right: 400, bottom: 600, width: 400, height: 600 }
      );

      const cleanup = initSwipeNav({ currentGameId: 'water-sort', container });

      // Replace window.location so href assignment doesn't trigger jsdom navigation
      const locMock = { href: '' };
      vi.stubGlobal('location', locMock);

      // Simulate right-edge swipe leftward (direction='right' → navigates to right-adjacent game)
      // startX=390 > 360 (400-edgeThreshold=40) → right edge detected
      // move to clientX=290 → dx=-100 < 0 → direction overridden to 'right' (next game)
      container.dispatchEvent(new MouseEvent('mousedown', { clientX: 390, clientY: 300, bubbles: true }));
      container.dispatchEvent(new MouseEvent('mousemove', { clientX: 290, clientY: 300, bubbles: true }));
      container.dispatchEvent(new MouseEvent('mouseup',   { clientX: 290, clientY: 300, bubbles: true }));

      // isTransitioning is true — success path was taken
      expect(isSwipeNavTransitioning()).toBe(true);

      // Advance past the 50ms setTimeout
      vi.advanceTimersByTime(51);

      // window.location.href should be set to target game URL (right-adjacent = pull-the-pin at index 1)
      expect(locMock.href).toBe('/pull-the-pin/');

      cleanup();
      document.body.removeChild(container);
    });
  });

  // ── handleIconTap — targetIndex === currentGameIndex early return ─────────

  describe('handleIconTap — same-game icon tap returns early (targetIndex === currentGameIndex branch)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      document.querySelectorAll('link[rel="modulepreload"]').forEach(l => l.remove());
      saveGameRing([{ id: 'water-sort', title: 'Water Sort', icon: 'droplet' }]);
    });

    it('does not navigate when the current game icon is clicked (targetIndex === currentGameIndex returns early)', () => {
      saveGameRing([
        { id: 'water-sort',   title: 'Water Sort',   icon: 'droplet' },
        { id: 'pull-the-pin', title: 'Pull the Pin', icon: 'pin' },
      ]);
      const container = document.createElement('div');
      document.body.appendChild(container);

      const cleanup = initSwipeNav({ currentGameId: 'water-sort', container });

      const locMock = { href: '' };
      vi.stubGlobal('location', locMock);

      // Find the icon button for the current game (index 0 = water-sort)
      const icons = document.querySelectorAll('.swipe-nav-icon');
      expect(icons.length).toBeGreaterThan(0);
      const currentIcon = icons[0]; // index 0 is the active (current) game
      currentIcon.click(); // fires handleIconTap(0) — targetIndex === currentGameIndex → returns early

      // No navigation should occur — href unchanged
      expect(locMock.href).toBe('');

      cleanup();
      document.body.removeChild(container);
    });
  });
});
