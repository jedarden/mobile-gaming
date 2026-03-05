/**
 * Tests for Share Cards - Canvas-Generated Achievement Cards
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ShareCardGenerator,
  ShareManager,
  CARD_SIZES,
  COLORS,
  TIER_COLORS,
  getStreakCalendarData,
  createShareCardGenerator,
  createShareManager
} from '../../src/shared/share-cards.js';
import * as storage from '../../src/shared/storage.js';
import * as meta from '../../src/shared/meta.js';

// Mock canvas for testing
class MockCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.context2d = new MockContext2D();
  }

  getContext(type) {
    return type === '2d' ? this.context2d : null;
  }

  toDataURL(type) {
    return `data:${type};base64,mockimagedata`;
  }

  toBlob(callback, type) {
    callback(new Blob(['mock'], { type }));
  }
}

class MockContext2D {
  constructor() {
    this.fillStyle = '';
    this.strokeStyle = '';
    this.lineWidth = 1;
    this.font = '';
    this.textAlign = 'left';
    this.operations = [];
  }

  fillRect(x, y, w, h) {
    this.operations.push({ type: 'fillRect', x, y, w, h });
  }

  arc(x, y, r, start, end) {
    this.operations.push({ type: 'arc', x, y, r, start, end });
  }

  fill() {
    this.operations.push({ type: 'fill' });
  }

  stroke() {
    this.operations.push({ type: 'stroke' });
  }

  beginPath() {
    this.operations.push({ type: 'beginPath' });
  }

  drawImage() {
    this.operations.push({ type: 'drawImage' });
  }

  fillText(text, x, y) {
    this.operations.push({ type: 'fillText', text, x, y });
  }

  getImageData(x, y, w, h) {
    this.operations.push({ type: 'getImageData', x, y, w, h });
    return { data: new Uint8ClampedArray(w * h * 4) };
  }

  createLinearGradient(x0, y0, x1, y1) {
    return {
      addColorStop: vi.fn(),
      stops: []
    };
  }

  roundRect(x, y, w, h, r) {
    this.operations.push({ type: 'roundRect', x, y, w, h, r });
  }

  save() {
    this.operations.push({ type: 'save' });
  }

  restore() {
    this.operations.push({ type: 'restore' });
  }
}

// Setup mock
vi.stubGlobal('document', {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return new MockCanvas(1080, 1080);
    }
    return {
      classList: { add: vi.fn() },
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      style: {},
      innerHTML: '',
      querySelector: vi.fn(() => ({ addEventListener: vi.fn() })),
      addEventListener: vi.fn(),
      remove: vi.fn()
    };
  },
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  }
});

vi.stubGlobal('navigator', {
  share: vi.fn(),
  canShare: vi.fn(() => true),
  clipboard: {
    writeText: vi.fn(() => Promise.resolve())
  }
});

vi.stubGlobal('window', {
  open: vi.fn()
});

vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({
    blob: () => Promise.resolve(new Blob(['mock'], { type: 'image/png' }))
  })
));

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn()
});

describe('ShareCardGenerator', () => {
  let generator;

  beforeEach(async () => {
    localStorage.clear();
    await storage.initStorage();
    generator = new ShareCardGenerator();
  });

  describe('constructor', () => {
    it('should create generator with default square size', () => {
      const gen = new ShareCardGenerator();
      expect(gen.size).toBe('square');
      expect(gen.dimensions).toEqual(CARD_SIZES.square);
    });

    it('should create generator with landscape size', () => {
      const gen = new ShareCardGenerator({ size: 'landscape' });
      expect(gen.size).toBe('landscape');
      expect(gen.dimensions).toEqual(CARD_SIZES.landscape);
    });
  });

  describe('initCanvas', () => {
    it('should create canvas with correct dimensions', () => {
      const canvas = generator.initCanvas();

      expect(canvas.width).toBe(CARD_SIZES.square.width);
      expect(canvas.height).toBe(CARD_SIZES.square.height);
    });
  });

  describe('generateStreakCard', () => {
    it('should generate streak card with correct data', async () => {
      const data = {
        currentStreak: 7,
        totalLevels: 50,
        totalXP: 5000,
        calendarData: [
          { date: '2024-01-01', played: true, isToday: false },
          { date: '2024-01-02', played: true, isToday: true }
        ]
      };

      const result = await generator.generateStreakCard(data);

      expect(result).toContain('data:image/png');
      expect(generator.ctx.operations).toContainEqual(
        expect.objectContaining({ type: 'fillText', text: expect.stringContaining('7') })
      );
    });
  });

  describe('generateMilestoneCard', () => {
    it('should generate milestone card with level', async () => {
      const data = {
        level: 10,
        totalXP: 4000
      };

      const result = await generator.generateMilestoneCard(data);

      expect(result).toContain('data:image/png');
      expect(generator.ctx.operations).toContainEqual(
        expect.objectContaining({ type: 'fillText', text: '10' })
      );
    });
  });

  describe('generateMasteryCard', () => {
    it('should generate mastery card for game', async () => {
      const data = {
        gameId: 'water-sort',
        gameName: 'Water Sort',
        tier: 'gold',
        stars: 100
      };

      const result = await generator.generateMasteryCard(data);

      expect(result).toContain('data:image/png');
    });
  });

  describe('generateDailyCard', () => {
    it('should generate daily card for completed challenge', async () => {
      const data = {
        gameId: 'water-sort',
        gameName: 'Water Sort',
        date: '2024-01-15',
        completed: true,
        moves: 25,
        time: 120,
        stars: 3
      };

      const result = await generator.generateDailyCard(data);

      expect(result).toContain('data:image/png');
    });

    it('should generate daily card for failed challenge', async () => {
      const data = {
        gameId: 'water-sort',
        gameName: 'Water Sort',
        date: '2024-01-15',
        completed: false
      };

      const result = await generator.generateDailyCard(data);

      expect(result).toContain('data:image/png');
    });
  });

  describe('generateProfileCard', () => {
    it('should generate profile stats card', async () => {
      const data = {
        level: 15,
        progress: 0.75,
        totalCompleted: 200,
        totalStars: 450,
        perfectClears: 50,
        dailyStreak: 14,
        achievementCount: 25,
        memberSince: '2024-01-01T00:00:00.000Z'
      };

      const result = await generator.generateProfileCard(data);

      expect(result).toContain('data:image/png');
    });
  });

  describe('generateFirstStarCard', () => {
    it('should generate first 3-star card', async () => {
      const data = {
        gameId: 'water-sort',
        gameName: 'Water Sort',
        level: 10
      };

      const result = await generator.generateFirstStarCard(data);

      expect(result).toContain('data:image/png');
    });
  });

  describe('helper methods', () => {
    it('should return correct game emoji', () => {
      expect(generator.getGameEmoji('water-sort')).toBe('💧');
      expect(generator.getGameEmoji('parking-escape')).toBe('🚗');
      expect(generator.getGameEmoji('bus-jam')).toBe('🚌');
      expect(generator.getGameEmoji('unknown')).toBe('🎮');
    });

    it('should format time correctly', () => {
      expect(generator.formatTime(65)).toBe('1:05');
      expect(generator.formatTime(125)).toBe('2:05');
      expect(generator.formatTime(0)).toBe('0:00');
    });
  });
});

describe('ShareManager', () => {
  let manager;

  beforeEach(async () => {
    localStorage.clear();
    await storage.initStorage();
    manager = new ShareManager();
  });

  describe('generateShareText', () => {
    it('should generate streak share text', () => {
      const text = manager.generateShareText('streak', { currentStreak: 7 });
      expect(text).toContain('7');
      expect(text).toContain('streak');
      expect(text).toContain('mobile-gaming.pages.dev');
    });

    it('should generate milestone share text', () => {
      const text = manager.generateShareText('milestone', { level: 10 });
      expect(text).toContain('Level 10');
      expect(text).toContain('mobile-gaming.pages.dev');
    });

    it('should generate mastery share text', () => {
      const text = manager.generateShareText('mastery', { gameName: 'Water Sort' });
      expect(text).toContain('Water Sort');
      expect(text).toContain('mastered');
      expect(text).toContain('mobile-gaming.pages.dev');
    });

    it('should generate daily share text', () => {
      const text = manager.generateShareText('daily', { moves: 25 });
      expect(text).toContain('25');
      expect(text).toContain('moves');
      expect(text).toContain('mobile-gaming.pages.dev');
    });

    it('should generate profile share text', () => {
      const text = manager.generateShareText('profile', { level: 20, totalCompleted: 150, totalStars: 300 });
      expect(text).toContain('Level 20');
      expect(text).toContain('150 levels');
      expect(text).toContain('300 stars');
      expect(text).toContain('mobile-gaming.pages.dev');
    });
  });

  describe('copyToClipboard', () => {
    it('should copy text to clipboard', async () => {
      const result = await manager.copyToClipboard('test text');
      expect(result).toBe(true);
    });
  });

  describe('shareStreak', () => {
    it('should attempt to share streak card', async () => {
      const result = await manager.shareStreak({ currentStreak: 7 });
      // Will fallback to dialog since navigator.share might not be available
      expect(result).toBeDefined();
    });
  });

  describe('shareMilestone', () => {
    it('should attempt to share milestone card', async () => {
      const result = await manager.shareMilestone({ level: 10 });
      expect(result).toBeDefined();
    });
  });
});

describe('getStreakCalendarData', () => {
  beforeEach(async () => {
    localStorage.clear();
    await storage.initStorage();
  });

  it('should return calendar data for specified days', async () => {
    const data = await getStreakCalendarData(7);

    expect(data.length).toBe(7);
    expect(data[0]).toHaveProperty('date');
    expect(data[0]).toHaveProperty('played');
    expect(data[0]).toHaveProperty('isToday');
  });

  it('should mark today correctly', async () => {
    const data = await getStreakCalendarData(1);

    expect(data[0].isToday).toBe(true);
  });

  it('should detect played days from storage', async () => {
    // Save some daily challenge data
    const today = new Date().toISOString().slice(0, 10);
    await storage.saveDailyChallengeData(today, 'water-sort', { completed: true });

    const data = await getStreakCalendarData(1);
    expect(data[0].played).toBe(true);
  });
});

describe('Constants', () => {
  describe('CARD_SIZES', () => {
    it('should have square dimensions', () => {
      expect(CARD_SIZES.square.width).toBe(1080);
      expect(CARD_SIZES.square.height).toBe(1080);
    });

    it('should have landscape dimensions', () => {
      expect(CARD_SIZES.landscape.width).toBe(1200);
      expect(CARD_SIZES.landscape.height).toBe(675);
    });
  });

  describe('COLORS', () => {
    it('should have background colors', () => {
      expect(COLORS.background.start).toBeDefined();
      expect(COLORS.background.middle).toBeDefined();
      expect(COLORS.background.end).toBeDefined();
    });

    it('should have accent colors', () => {
      expect(COLORS.accent.gold).toBe('#FFD700');
      expect(COLORS.accent.silver).toBe('#C0C0C0');
    });

    it('should have status colors', () => {
      expect(COLORS.status.success).toBe('#00C853');
      expect(COLORS.status.warning).toBe('#FFB300');
    });
  });

  describe('TIER_COLORS', () => {
    it('should have all tier colors', () => {
      expect(TIER_COLORS.bronze).toBeDefined();
      expect(TIER_COLORS.silver).toBeDefined();
      expect(TIER_COLORS.gold).toBeDefined();
      expect(TIER_COLORS.platinum).toBeDefined();
    });
  });
});

describe('Factory functions', () => {
  it('should create ShareCardGenerator', () => {
    const gen = createShareCardGenerator({ size: 'landscape' });
    expect(gen).toBeInstanceOf(ShareCardGenerator);
    expect(gen.size).toBe('landscape');
  });

  it('should create ShareManager', () => {
    const man = createShareManager();
    expect(man).toBeInstanceOf(ShareManager);
  });
});
