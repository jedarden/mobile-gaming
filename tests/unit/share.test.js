import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Setup globals
let shareModule;
let mockNavigator;

async function getFreshModule() {
  vi.resetModules();

  // Mock navigator
  mockNavigator = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    share: vi.fn(async () => {}),
    canShare: vi.fn(() => true),
    clipboard: {
      writeText: vi.fn(async () => {})
    }
  };

  // Mock window
  global.navigator = mockNavigator;
  global.window = {
    location: {
      href: 'https://example.com/game?level=1'
    },
    open: vi.fn()
  };

  // Create a mock document with body
  const mockElement = () => ({
    tagName: 'A',
    id: '',
    className: '',
    href: '',
    download: '',
    style: {},
    innerHTML: '',
    textContent: '',
    parentNode: null,
    click: vi.fn(),
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
      contains: vi.fn()
    }
  });

  global.document = {
    body: {
      innerHTML: '',
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      querySelectorAll: vi.fn(() => [])
    },
    head: {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    },
    createElement: vi.fn(mockElement),
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => [])
  };

  return await import('../../src/shared/share.js');
}

describe('share', () => {
  beforeEach(async () => {
    shareModule = await getFreshModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hasWebShareSupport', () => {
    it('returns true when navigator.share is available', () => {
      expect(shareModule.hasWebShareSupport()).toBe(true);
    });

    it('returns false when navigator.share is not available', async () => {
      delete mockNavigator.share;
      vi.resetModules();
      global.navigator = mockNavigator;
      const mod = await import('../../src/shared/share.js');
      expect(mod.hasWebShareSupport()).toBe(false);
    });
  });

  describe('hasFileShareSupport', () => {
    it('returns true when file sharing is supported', () => {
      expect(shareModule.hasFileShareSupport()).toBe(true);
    });

    it('returns false when canShare is not available', async () => {
      mockNavigator.canShare = undefined;
      vi.resetModules();
      global.navigator = mockNavigator;
      const mod = await import('../../src/shared/share.js');
      // Returns false when canShare is not a function
      expect(mod.hasFileShareSupport()).toBe(false);
    });
  });

  describe('isMobile', () => {
    it('returns true for mobile user agent', () => {
      expect(shareModule.isMobile()).toBe(true);
    });

    it('returns true for Android user agent', async () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Linux; Android 10; SM-G960F)';
      vi.resetModules();
      global.navigator = mockNavigator;
      const mod = await import('../../src/shared/share.js');
      expect(mod.isMobile()).toBe(true);
    });

    it('returns false for desktop user agent', async () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      vi.resetModules();
      global.navigator = mockNavigator;
      const mod = await import('../../src/shared/share.js');
      expect(mod.isMobile()).toBe(false);
    });
  });

  describe('getAvailablePlatforms', () => {
    it('returns mobile platforms on mobile device', () => {
      const platforms = shareModule.getAvailablePlatforms();
      expect(platforms).toContain('tiktok');
      expect(platforms).toContain('instagram');
      expect(platforms).toContain('whatsapp');
    });

    it('excludes mobile-only platforms on desktop', async () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      vi.resetModules();
      global.navigator = mockNavigator;
      const mod = await import('../../src/shared/share.js');
      const platforms = mod.getAvailablePlatforms();
      expect(platforms).not.toContain('tiktok');
      expect(platforms).not.toContain('instagram');
      expect(platforms).toContain('youtube');
      expect(platforms).toContain('twitter');
    });
  });

  describe('shareViaWebAPI', () => {
    it('shares with title, text, and url', async () => {
      const options = {
        title: 'My Game',
        text: 'Check this out!',
        url: 'https://example.com/game'
      };

      const result = await shareModule.shareViaWebAPI(options);
      expect(result).toBe(true);
      expect(mockNavigator.share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Game',
          text: 'Check this out!',
          url: 'https://example.com/game'
        })
      );
    });

    it('shares with video file when supported', async () => {
      const videoBlob = new Blob(['video data'], { type: 'video/webm' });
      const options = {
        title: 'My Game',
        videoBlob
      };

      const result = await shareModule.shareViaWebAPI(options);
      expect(result).toBe(true);
      expect(mockNavigator.share).toHaveBeenCalled();
    });

    it('returns false when Web Share not available', async () => {
      delete mockNavigator.share;
      vi.resetModules();
      global.navigator = mockNavigator;
      const mod = await import('../../src/shared/share.js');
      const result = await mod.shareViaWebAPI({ title: 'Test' });
      expect(result).toBe(false);
    });

    it('returns true when user cancels share', async () => {
      mockNavigator.share = vi.fn(async () => {
        const error = new Error('Share cancelled');
        error.name = 'AbortError';
        throw error;
      });
      vi.resetModules();
      global.navigator = mockNavigator;
      const mod = await import('../../src/shared/share.js');
      const result = await mod.shareViaWebAPI({ title: 'Test' });
      expect(result).toBe(true);
    });
  });

  describe('shareToPlatform', () => {
    it('returns error for unknown platform', async () => {
      const result = await shareModule.shareToPlatform('unknown', {});
      expect(result.success).toBe(false);
      expect(result.message).toBe('Unknown platform');
    });

    it('handles Twitter share', async () => {
      const result = await shareModule.shareToPlatform('twitter', {
        text: 'Check out my game!',
        url: 'https://example.com/game'
      });

      expect(result.success).toBe(true);
      expect(result.openUrl).toContain('twitter.com/intent/tweet');
    });

    it('handles Facebook share', async () => {
      const result = await shareModule.shareToPlatform('facebook', {
        text: 'Check this out',
        url: 'https://example.com/game'
      });

      expect(result.success).toBe(true);
      expect(result.openUrl).toContain('facebook.com/sharer');
    });

    it('handles WhatsApp share', async () => {
      const result = await shareModule.shareToPlatform('whatsapp', {
        text: 'Play this game!',
        url: 'https://example.com/game'
      });

      expect(result.success).toBe(true);
      expect(result.openUrl).toContain('wa.me');
    });

    it('handles copy link', async () => {
      const result = await shareModule.shareToPlatform('copyLink', {
        url: 'https://example.com/game'
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('copied');
    });

    it('handles copy link failure', async () => {
      mockNavigator.clipboard = {
        writeText: vi.fn(async () => {
          throw new Error('Clipboard denied');
        })
      };

      const result = await shareModule.shareToPlatform('copyLink', {
        url: 'https://example.com/game'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('downloadVideo', () => {
    it('throws error when no blob provided', async () => {
      await expect(shareModule.downloadVideo(null)).rejects.toThrow('No video blob');
    });

    it('creates download link', async () => {
      const blob = new Blob(['video data'], { type: 'video/webm' });

      // The download function creates an anchor element and clicks it
      // In our mock, click is a vi.fn() that does nothing
      try {
        await shareModule.downloadVideo(blob, 'test.webm');
        // If we get here without error, the test passes
      } catch (e) {
        // May fail in test environment due to DOM
        expect(e).toBeUndefined();
      }

      // Verify createElement was called
      expect(document.createElement).toHaveBeenCalled();
    });
  });

  describe('generateShareText', () => {
    it('generates text with game name', () => {
      const text = shareModule.generateShareText({ gameName: 'Water Sort' });
      expect(text).toContain('Water Sort');
    });

    it('generates text with moves', () => {
      const text = shareModule.generateShareText({ gameName: 'Water Sort', moves: 14 });
      expect(text).toContain('14 moves');
    });

    it('generates text with time', () => {
      const text = shareModule.generateShareText({ gameName: 'Water Sort', time: 45 });
      expect(text).toContain('45');
    });

    it('generates text with stars', () => {
      const text = shareModule.generateShareText({ gameName: 'Water Sort', stars: 3 });
      // Stars are separated by space in the implementation
      expect(text).toContain('⭐');
    });

    it('includes call to action', () => {
      const text = shareModule.generateShareText({ gameName: 'Game' });
      expect(text).toContain('Can you beat');
    });
  });

  describe('quickShare', () => {
    it('tries Web Share first', async () => {
      const options = {
        title: 'My Game',
        text: 'Check this out',
        url: 'https://example.com/game'
      };

      const result = await shareModule.quickShare(options);
      expect(result).toBe(true);
      expect(mockNavigator.share).toHaveBeenCalled();
    });
  });
});
