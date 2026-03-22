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
});
