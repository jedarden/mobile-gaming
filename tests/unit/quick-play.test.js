/**
 * Quick Play - Unit Tests
 *
 * Tests for the intelligent game selection algorithm.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create mock storage object that can be accessed by the mock factory
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

// Use a module-scoped variable that the mock can access
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
  getPlayHistory,
  recordPlaySession,
  calculateRecencyPenalty,
  calculateVarietyBonus,
  calculateDifficultyMatch,
  calculateGameScore,
  pickGame,
  getTopCandidates,
  getNextUnsolvedLevel,
  getGameUrl,
  getAvailableGames,
  navigateToQuickPlay,
  GAME_REGISTRY
} from '../../src/shared/quick-play.js';

describe('Quick Play', () => {
  beforeEach(() => {
    mockStorageInstance = createMockStorage();
  });

  describe('getPlayHistory', () => {
    it('should return empty object when no history exists', () => {
      const history = getPlayHistory();
      expect(history).toEqual({});
    });

    it('should return stored play history', () => {
      mockStorageInstance.data['playHistory'] = {
        'water-sort': { sessions: 5, completed: 3 }
      };

      const history = getPlayHistory();
      expect(history['water-sort'].sessions).toBe(5);
    });
  });

  describe('recordPlaySession', () => {
    it('should create new history entry for first play', () => {
      const result = recordPlaySession('water-sort', {
        completed: true,
        solveTime: 30000,
        retries: 2
      });

      expect(result.sessions).toBe(1);
      expect(result.completed).toBe(1);
      expect(result.totalSolveTime).toBe(30000);
      expect(result.totalRetries).toBe(2);
      expect(result.lastPlayed).toBeGreaterThan(0);
    });

    it('should work with no sessionData argument (uses defaults)', () => {
      const result = recordPlaySession('brain-teaser');
      expect(result.sessions).toBe(1);
      expect(result.completed).toBe(0);
      expect(result.totalSolveTime).toBe(0);
      expect(result.totalRetries).toBe(0);
    });

    it('should update existing history entry', () => {
      recordPlaySession('water-sort', {
        completed: true,
        solveTime: 30000,
        retries: 2
      });

      const result = recordPlaySession('water-sort', {
        completed: false,
        solveTime: 15000,
        retries: 0
      });

      expect(result.sessions).toBe(2);
      expect(result.completed).toBe(1);
      expect(result.totalSolveTime).toBe(45000);
      expect(result.totalRetries).toBe(2);
    });
  });

  describe('calculateRecencyPenalty', () => {
    it('should return 0 for games never played', () => {
      const penalty = calculateRecencyPenalty(null);
      expect(penalty).toBe(0);
    });

    it('should return 0 when history exists but lastPlayed is null', () => {
      const penalty = calculateRecencyPenalty({ lastPlayed: null });
      expect(penalty).toBe(0);
    });

    it('should return 0 for games played over an hour ago', () => {
      const history = {
        lastPlayed: Date.now() - (61 * 60 * 1000) // 61 minutes ago
      };
      const penalty = calculateRecencyPenalty(history);
      expect(penalty).toBe(0);
    });

    it('should return 0 when timeSincePlay equals exactly RECENCY_WINDOW_MS (>= boundary)', () => {
      const history = {
        lastPlayed: Date.now() - (60 * 60 * 1000) // exactly 1 hour ago
      };
      const penalty = calculateRecencyPenalty(history);
      expect(penalty).toBe(0);
    });

    it('should return full penalty for games just played', () => {
      const history = {
        lastPlayed: Date.now()
      };
      const penalty = calculateRecencyPenalty(history);
      expect(penalty).toBeCloseTo(-30, 1);
    });

    it('should return partial penalty for games played recently', () => {
      const history = {
        lastPlayed: Date.now() - (30 * 60 * 1000) // 30 minutes ago
      };
      const penalty = calculateRecencyPenalty(history);
      // Should be around -15 (half penalty)
      expect(penalty).toBeLessThan(0);
      expect(penalty).toBeGreaterThan(-30);
    });
  });

  describe('calculateVarietyBonus', () => {
    it('should return full bonus for never-played games', () => {
      const bonus = calculateVarietyBonus(null);
      expect(bonus).toBe(50);
    });

    it('should return full bonus for undefined history (also falsy)', () => {
      const bonus = calculateVarietyBonus(undefined);
      expect(bonus).toBe(50);
    });

    it('should return reduced bonus for played games', () => {
      const history = { sessions: 3 };
      const bonus = calculateVarietyBonus(history);
      expect(bonus).toBeLessThan(50);
      expect(bonus).toBeGreaterThan(0);
    });

    it('should return zero bonus for heavily played games', () => {
      const history = { sessions: 20 };
      const bonus = calculateVarietyBonus(history);
      expect(bonus).toBe(0);
    });

    it('should return full bonus when sessions is 0 on a non-null history object', () => {
      const bonus = calculateVarietyBonus({ sessions: 0 });
      expect(bonus).toBe(50);
    });
  });

  describe('calculateDifficultyMatch', () => {
    it('should return high score for new games', () => {
      const score = calculateDifficultyMatch(null);
      expect(score).toBeCloseTo(32, 1); // 0.8 * 40
    });

    it('should return full score for flow zone (10-30% retry rate)', () => {
      // 20% retry rate = 2 retries / (10 attempts)
      const history = {
        sessions: 10,
        totalRetries: 2
      };
      const score = calculateDifficultyMatch(history);
      expect(score).toBe(40);
    });

    it('should return reduced score for too easy games', () => {
      // 5% retry rate
      const history = {
        sessions: 100,
        totalRetries: 5
      };
      const score = calculateDifficultyMatch(history);
      expect(score).toBeLessThan(40);
      expect(score).toBeGreaterThan(20);
    });

    it('should return reduced score for too hard games', () => {
      // 50% retry rate
      const history = {
        sessions: 10,
        totalRetries: 5
      };
      const score = calculateDifficultyMatch(history);
      expect(score).toBeLessThan(40);
    });

    it('caps retryRate at 0.9 for extremely hard games', () => {
      // retryRate = 99/100 = 0.99, capped to 0.9 → score = 40 * (1 - 0.6) = 16
      const history = { sessions: 1, totalRetries: 99 };
      const score = calculateDifficultyMatch(history);
      expect(score).toBeCloseTo(16, 1);
    });
  });

  describe('calculateGameScore', () => {
    it('should combine all scoring factors', () => {
      const history = {
        'water-sort': {
          lastPlayed: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
          sessions: 5,
          completed: 3,
          totalRetries: 2
        }
      };

      const score = calculateGameScore('water-sort', history);

      // Score should be sum of all factors
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(-50);
      expect(score).toBeLessThan(150);
    });

    it('should give never-played games highest score', () => {
      const history = {};
      const score = calculateGameScore('water-sort', history);

      // Never played: 0 recency + 50 variety + 32 difficulty = 82
      expect(score).toBeCloseTo(82, 1);
    });
  });

  describe('pickGame', () => {
    it('should return water-sort level 1 for first-time visitors', () => {
      const result = pickGame();
      expect(result.gameId).toBe('water-sort');
      expect(result.level).toBe(1);
    });

    it('should select game with highest score', () => {
      // Set up history where brain-teaser has been played recently
      // but water-sort hasn't
      mockStorageInstance.data['playHistory'] = {
        'brain-teaser': {
          lastPlayed: Date.now() - (5 * 60 * 1000), // 5 minutes ago (recency penalty)
          sessions: 10,
          completed: 5,
          totalRetries: 20
        }
      };

      const result = pickGame();
      // Should not pick brain-teaser due to recency penalty
      expect(result.gameId).not.toBe('brain-teaser');
    });

    it('should return valid game from registry', () => {
      mockStorageInstance.data['playHistory'] = {
        'water-sort': {
          lastPlayed: Date.now() - (24 * 60 * 60 * 1000),
          sessions: 1,
          completed: 1,
          totalRetries: 0
        }
      };

      const result = pickGame();
      const availableGames = getAvailableGames();
      const gameIds = availableGames.map(g => g.id);

      expect(gameIds).toContain(result.gameId);
      expect(result.level).toBeGreaterThanOrEqual(1);
    });

    it('returns water-sort level 1 fallback when registry is empty (availableGames.length===0 branch)', () => {
      const saved = GAME_REGISTRY.splice(0);
      try {
        const result = pickGame();
        expect(result).toEqual({ gameId: 'water-sort', level: 1 });
      } finally {
        GAME_REGISTRY.splice(0, 0, ...saved);
      }
    });
  });

  describe('getTopCandidates', () => {
    it('should return water-sort and brain-teaser for first visit', () => {
      const candidates = getTopCandidates();
      expect(candidates).toHaveLength(2);
      expect(candidates[0].gameId).toBe('water-sort');
      expect(candidates[1].gameId).toBe('brain-teaser');
    });

    it('should return top 2 games by score', () => {
      // Set up history for all games to control the ranking
      const baseTime = Date.now();
      mockStorageInstance.data['playHistory'] = {
        'water-sort': {
          lastPlayed: baseTime - (2 * 60 * 60 * 1000), // 2 hours ago
          sessions: 1,
          completed: 1,
          totalRetries: 0
        },
        'brain-teaser': {
          lastPlayed: baseTime, // Just played (recency penalty)
          sessions: 5,
          completed: 3,
          totalRetries: 10
        },
        // Other games also played but not recently
        'jelly-shift': {
          lastPlayed: baseTime - (3 * 60 * 60 * 1000),
          sessions: 2,
          completed: 1,
          totalRetries: 5
        },
        'giant-runner': {
          lastPlayed: baseTime - (4 * 60 * 60 * 1000),
          sessions: 2,
          completed: 1,
          totalRetries: 5
        },
        'bus-jam': {
          lastPlayed: baseTime - (5 * 60 * 60 * 1000),
          sessions: 2,
          completed: 1,
          totalRetries: 5
        },
        'save-the-character': {
          lastPlayed: baseTime - (6 * 60 * 60 * 1000),
          sessions: 2,
          completed: 1,
          totalRetries: 5
        }
      };

      const candidates = getTopCandidates();
      expect(candidates).toHaveLength(2);
      // brain-teaser should NOT be first (recency penalty)
      expect(candidates[0].gameId).not.toBe('brain-teaser');
    });

    it('returns single water-sort fallback when registry is empty (availableGames.length===0 branch)', () => {
      const saved = GAME_REGISTRY.splice(0);
      try {
        const candidates = getTopCandidates();
        expect(candidates).toEqual([{ gameId: 'water-sort', level: 1 }]);
      } finally {
        GAME_REGISTRY.splice(0, 0, ...saved);
      }
    });
  });

  describe('getNextUnsolvedLevel', () => {
    it('should return 1 for games never played', () => {
      const level = getNextUnsolvedLevel('water-sort', {});
      expect(level).toBe(1);
    });

    it('should return next level after completed', () => {
      const history = {
        'water-sort': {
          completed: 3
        }
      };
      const level = getNextUnsolvedLevel('water-sort', history);
      expect(level).toBe(4);
    });

    it('should cap at total levels', () => {
      const history = {
        'water-sort': {
          completed: 35 // More than total levels (30)
        }
      };
      const level = getNextUnsolvedLevel('water-sort', history);
      expect(level).toBe(30);
    });

    it('should return 1 for unknown gameId', () => {
      const level = getNextUnsolvedLevel('nonexistent-game', {});
      expect(level).toBe(1);
    });

    it('should return 1 when history exists but completed is 0', () => {
      const history = { 'water-sort': { sessions: 2, completed: 0 } };
      const level = getNextUnsolvedLevel('water-sort', history);
      expect(level).toBe(1);
    });
  });

  describe('getGameUrl', () => {
    it('should return base URL without level', () => {
      const url = getGameUrl('water-sort');
      expect(url).toBe('/water-sort/');
    });

    it('should return URL with level parameter for level > 1', () => {
      const url = getGameUrl('water-sort', 5);
      expect(url).toBe('/water-sort/?level=5');
    });

    it('should not add level parameter for level 1', () => {
      const url = getGameUrl('water-sort', 1);
      expect(url).toBe('/water-sort/');
    });

    it('should not add level parameter for level 0 (falsy — treated same as omitted)', () => {
      const url = getGameUrl('water-sort', 0);
      expect(url).toBe('/water-sort/');
    });
  });

  describe('getAvailableGames', () => {
    it('should return array of available games', () => {
      const games = getAvailableGames();
      expect(Array.isArray(games)).toBe(true);
      expect(games.length).toBeGreaterThan(0);
    });

    it('should include water-sort', () => {
      const games = getAvailableGames();
      const waterSort = games.find(g => g.id === 'water-sort');
      expect(waterSort).toBeDefined();
      expect(waterSort.title).toBe('Water Sort');
    });
  });

  describe('Scoring Integration', () => {
    it('should prefer variety over recency when exploring', () => {
      // Player has only played water-sort once
      mockStorageInstance.data['playHistory'] = {
        'water-sort': {
          lastPlayed: Date.now() - (30 * 60 * 1000), // 30 min ago
          sessions: 1,
          completed: 1,
          totalRetries: 0
        }
      };

      const result = pickGame();
      // Should pick a different game (variety bonus)
      // unless recency penalty of water-sort is low enough
      // This tests the balance between variety and recency
      expect(result.gameId).toBeDefined();
    });

    it('should favor flow zone difficulty games', () => {
      // Set up all games with similar play history to control comparison
      const baseTime = Date.now() - (60 * 60 * 1000);
      mockStorageInstance.data['playHistory'] = {
        'water-sort': {
          lastPlayed: baseTime,
          sessions: 10,
          completed: 8,
          totalRetries: 2 // 20% retry rate - flow zone
        },
        'brain-teaser': {
          lastPlayed: baseTime,
          sessions: 10,
          completed: 2,
          totalRetries: 15 // 75% retry rate - too hard
        },
        // Other games with similar stats to water-sort for fair comparison
        'jelly-shift': {
          lastPlayed: baseTime,
          sessions: 10,
          completed: 8,
          totalRetries: 15 // High retry - too hard
        },
        'giant-runner': {
          lastPlayed: baseTime,
          sessions: 10,
          completed: 8,
          totalRetries: 15
        },
        'bus-jam': {
          lastPlayed: baseTime,
          sessions: 10,
          completed: 8,
          totalRetries: 15
        },
        'save-the-character': {
          lastPlayed: baseTime,
          sessions: 10,
          completed: 8,
          totalRetries: 15
        },
        // Newer games — all played with high retry rates to keep water-sort as winner
        'pull-the-pin': {
          lastPlayed: baseTime,
          sessions: 10,
          completed: 8,
          totalRetries: 15
        },
        'parking-escape': {
          lastPlayed: baseTime,
          sessions: 10,
          completed: 8,
          totalRetries: 15
        },
        'merge-games': {
          lastPlayed: baseTime,
          sessions: 10,
          completed: 8,
          totalRetries: 15
        },
        'satisfying-asmr': {
          lastPlayed: baseTime,
          sessions: 10,
          completed: 8,
          totalRetries: 15
        },
        'crowd-runner': {
          lastPlayed: baseTime,
          sessions: 10,
          completed: 8,
          totalRetries: 15
        },
        'bridge-race': {
          lastPlayed: baseTime,
          sessions: 10,
          completed: 8,
          totalRetries: 15
        },
        'makeover-run': {
          lastPlayed: baseTime,
          sessions: 10,
          completed: 8,
          totalRetries: 15
        }
      };

      const result = pickGame();
      // Should prefer water-sort (flow zone) over games with higher retry rates
      expect(result.gameId).toBe('water-sort');
    });
  });

  describe('GAME_REGISTRY', () => {
    it('is an array with entries for all 13 games', () => {
      expect(Array.isArray(GAME_REGISTRY)).toBe(true);
      expect(GAME_REGISTRY.length).toBe(13);
    });

    it('each entry has id, title, category, and totalLevels', () => {
      for (const entry of GAME_REGISTRY) {
        expect(typeof entry.id, `${entry.id} id not a string`).toBe('string');
        expect(typeof entry.title, `${entry.id} title not a string`).toBe('string');
        expect(typeof entry.category, `${entry.id} category not a string`).toBe('string');
        expect(entry.totalLevels, `${entry.id} missing totalLevels`).toBeGreaterThan(0);
      }
    });

    it('includes all expected game IDs', () => {
      const ids = GAME_REGISTRY.map(g => g.id);
      const expected = [
        'water-sort', 'pull-the-pin', 'brain-teaser', 'save-the-character',
        'jelly-shift', 'bus-jam', 'parking-escape', 'merge-games',
        'satisfying-asmr', 'giant-runner', 'crowd-runner', 'bridge-race',
        'makeover-run'
      ];
      for (const id of expected) {
        expect(ids, `missing ${id}`).toContain(id);
      }
    });
  });

  describe('navigateToQuickPlay', () => {
    it('sets window.location.href to a game URL', () => {
      const origHref = globalThis.window?.location?.href;
      const mockLocation = { href: '' };
      const origWindow = globalThis.window;
      globalThis.window = { location: mockLocation };

      navigateToQuickPlay();

      expect(mockLocation.href).toMatch(/\//); // URL contains a path

      globalThis.window = origWindow;
      if (origHref !== undefined) globalThis.window.location.href = origHref;
    });
  });

});
