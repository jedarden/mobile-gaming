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

    it('returns false when canShare is a function that returns false (canShare() false branch)', async () => {
      // canShare IS a function, but returns false for the test file → hasFileShareSupport returns false
      mockNavigator.canShare = vi.fn(() => false);
      vi.resetModules();
      global.navigator = mockNavigator;
      const mod = await import('../../src/shared/share.js');
      expect(mod.hasFileShareSupport()).toBe(false);
    });

    it('returns false when hasWebShareSupport() is false (!hasWebShareSupport() early return)', async () => {
      // Remove navigator.share so hasWebShareSupport() returns false
      delete mockNavigator.share;
      vi.resetModules();
      global.navigator = mockNavigator;
      const mod = await import('../../src/shared/share.js');
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

    it('names video file gameplay.mp4 when blob type contains mp4 (mp4 branch)', async () => {
      const videoBlob = new Blob(['video data'], { type: 'video/mp4' });
      await shareModule.shareViaWebAPI({ title: 'My Game', videoBlob });
      const shareData = mockNavigator.share.mock.calls[0][0];
      expect(shareData.files).toBeDefined();
      expect(shareData.files[0].name).toBe('gameplay.mp4');
    });

    it('names video file gameplay.webm when blob type does not contain mp4 (webm branch)', async () => {
      const videoBlob = new Blob(['video data'], { type: 'video/webm' });
      await shareModule.shareViaWebAPI({ title: 'My Game', videoBlob });
      const shareData = mockNavigator.share.mock.calls[0][0];
      expect(shareData.files[0].name).toBe('gameplay.webm');
    });

    it('returns false when Web Share not available', async () => {
      delete mockNavigator.share;
      vi.resetModules();
      global.navigator = mockNavigator;
      const mod = await import('../../src/shared/share.js');
      const result = await mod.shareViaWebAPI({ title: 'Test' });
      expect(result).toBe(false);
    });

    it('returns false when canShare(shareData) returns false (share not permitted)', async () => {
      mockNavigator.canShare = vi.fn(() => false);
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

    it('returns false when navigator.share throws a non-AbortError (catch else branch)', async () => {
      mockNavigator.share = vi.fn(async () => {
        throw new Error('NotAllowedError');
      });
      vi.resetModules();
      global.navigator = mockNavigator;
      const mod = await import('../../src/shared/share.js');
      const result = await mod.shareViaWebAPI({ title: 'Test' });
      expect(result).toBe(false);
    });

    it('does not add files to shareData when hasFileShareSupport() is false (videoBlob && false — if false branch)', async () => {
      // Removing canShare makes hasFileShareSupport() return false (typeof check fails)
      // and also makes the canShare guard at line 148 short-circuit (canShare is falsy)
      delete mockNavigator.canShare;
      vi.resetModules();
      global.navigator = mockNavigator;
      const mod = await import('../../src/shared/share.js');
      const videoBlob = new Blob(['video'], { type: 'video/webm' });
      const result = await mod.shareViaWebAPI({ title: 'Test', videoBlob });
      expect(result).toBe(true); // share succeeds without file
      const shareData = mockNavigator.share.mock.calls[0][0];
      expect(shareData.files).toBeUndefined(); // files NOT added because hasFileShareSupport() is false
    });

    it('uses "My Gameplay" default when title is omitted (title||"My Gameplay" false arm)', async () => {
      // shareViaWebAPI({}) — no title → title is undefined → || 'My Gameplay' fires
      const result = await shareModule.shareViaWebAPI({});
      expect(result).toBe(true);
      const shareData = mockNavigator.share.mock.calls[0][0];
      expect(shareData.title).toBe('My Gameplay');
      expect(shareData.text).toBe('Check out my gameplay!'); // text also uses default
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

    it('uses window.location.href when url is omitted', async () => {
      const result = await shareModule.shareToPlatform('twitter', {
        text: 'Hello',
      });
      expect(result.success).toBe(true);
      expect(result.openUrl).toContain(encodeURIComponent('https://example.com/game?level=1'));
    });

    it('uses default text when text is omitted', async () => {
      const result = await shareModule.shareToPlatform('twitter', {
        url: 'https://example.com',
      });
      expect(result.success).toBe(true);
      expect(result.openUrl).toContain(encodeURIComponent('Check out my gameplay!'));
    });

    it('copyLink uses window.location.href when url is omitted', async () => {
      const result = await shareModule.shareToPlatform('copyLink', {});
      expect(result.success).toBe(true);
      expect(mockNavigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/game?level=1');
    });

    it('handles TikTok share (downloads video, returns deep link)', async () => {
      const videoBlob = new Blob(['video'], { type: 'video/webm' });
      const result = await shareModule.shareToPlatform('tiktok', { videoBlob });
      expect(result.success).toBe(true);
      expect(result.openUrl).toBe('tiktok://');
      expect(result.message).toContain('TikTok');
    });

    it('handles Instagram share (downloads video, returns deep link)', async () => {
      const videoBlob = new Blob(['video'], { type: 'video/webm' });
      const result = await shareModule.shareToPlatform('instagram', { videoBlob });
      expect(result.success).toBe(true);
      expect(result.openUrl).toBe('instagram://library');
      expect(result.message).toContain('Instagram');
    });

    it('handles Snapchat share (downloads video, returns deep link)', async () => {
      const videoBlob = new Blob(['video'], { type: 'video/webm' });
      const result = await shareModule.shareToPlatform('snapchat', { videoBlob });
      expect(result.success).toBe(true);
      expect(result.openUrl).toBe('snapchat://');
      expect(result.message).toContain('Snapchat');
    });

    it('handles YouTube share (downloads video, returns upload URL with title)', async () => {
      const videoBlob = new Blob(['video'], { type: 'video/webm' });
      const result = await shareModule.shareToPlatform('youtube', { videoBlob, title: 'My Game' });
      expect(result.success).toBe(true);
      expect(result.openUrl).toContain('youtube.com/upload');
      expect(result.openUrl).toContain(encodeURIComponent('My Game'));
      expect(result.message).toContain('YouTube');
    });

    it('YouTube share uses default title when omitted', async () => {
      const videoBlob = new Blob(['video'], { type: 'video/webm' });
      const result = await shareModule.shareToPlatform('youtube', { videoBlob });
      expect(result.success).toBe(true);
      expect(result.openUrl).toContain(encodeURIComponent('My Gameplay'));
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

    it('uses "Game" fallback when gameName is undefined (gameName || "Game" false branch)', () => {
      const text = shareModule.generateShareText({});
      expect(text).toContain('Game');
    });

    it('generates text with moves', () => {
      const text = shareModule.generateShareText({ gameName: 'Water Sort', moves: 14 });
      expect(text).toContain('14 moves');
    });

    it('generates text with time only (else-if branch — time but no moves)', () => {
      const text = shareModule.generateShareText({ gameName: 'Water Sort', time: 45 });
      expect(text).toContain('45 seconds');
    });

    it('generates text with both moves and time (inner if branch — moves + time together)', () => {
      const text = shareModule.generateShareText({ gameName: 'Water Sort', moves: 10, time: 30 });
      expect(text).toContain('10 moves');
      expect(text).toContain('30s');
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

  describe('showShareOverlay', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns early when native share succeeds on mobile (if(shared) true branch)', async () => {
      // Setup: iPhone UA (isMobile=true), share fn (hasWebShareSupport=true), videoBlob truthy
      // To avoid File constructor issues in canShare check, remove canShare from navigator so
      // hasFileShareSupport() returns false (skips file attachment) and canShare gate is skipped.
      // shareViaWebAPI then just calls navigator.share → resolves → returns true → early return.
      vi.resetModules();
      const nativeShareFn = vi.fn(async () => {});
      global.navigator = {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        share: nativeShareFn,
        // no canShare — hasFileShareSupport() returns false → no File creation → no canShare gate
      };
      global.document.body.appendChild = vi.fn();
      vi.stubGlobal('requestAnimationFrame', vi.fn(cb => cb()));
      const mod = await import('../../src/shared/share.js');

      const videoBlob = new Blob(['video'], { type: 'video/webm' });
      await mod.showShareOverlay({ title: 'Test', text: 'Go!', url: 'http://x.com', videoBlob });

      // native share succeeded → overlay NOT appended
      expect(nativeShareFn).toHaveBeenCalled();
      expect(global.document.body.appendChild).not.toHaveBeenCalled();
    });

    it('falls back to custom overlay when native share fails (if(shared) false arm)', async () => {
      // navigator.share throws non-AbortError → shareViaWebAPI returns false → createShareOverlay runs
      vi.resetModules();
      const mockChild = {
        addEventListener: vi.fn(),
        classList: { add: vi.fn(), remove: vi.fn() },
        dataset: {},
      };
      const bodyAppend = vi.fn();
      global.navigator = {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        share: vi.fn(async () => { throw new Error('Permission denied'); }),
        // no canShare — hasFileShareSupport returns false → no File creation
      };
      global.document = {
        body: { appendChild: bodyAppend, removeChild: vi.fn() },
        head: { appendChild: vi.fn() },
        createElement: vi.fn(() => ({
          id: '', className: '', innerHTML: '', textContent: '',
          addEventListener: vi.fn(),
          querySelector: vi.fn(() => mockChild),
          querySelectorAll: vi.fn(() => []), // empty forEach — avoids platform btn loop
          classList: { add: vi.fn() },
        })),
        getElementById: vi.fn(() => null), // style not yet injected → injectStyles proceeds
        querySelector: vi.fn(() => null),
      };
      vi.stubGlobal('requestAnimationFrame', vi.fn(cb => cb()));
      const mod = await import('../../src/shared/share.js');

      const videoBlob = new Blob(['video'], { type: 'video/webm' });
      await mod.showShareOverlay({ title: 'Test', text: 'Go!', url: 'http://x.com', videoBlob });

      // native share failed → custom overlay IS appended to body
      expect(bodyAppend).toHaveBeenCalled();
    });
  });
});
