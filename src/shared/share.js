/**
 * Share.js - Sharing Utilities
 *
 * Provides cross-platform sharing functionality:
 * - Native Web Share API
 * - Fallback share dialogs
 * - Social media deep links
 * - Score/result sharing
 * - GIF export and sharing
 * - Achievement card generation and sharing
 */

import { createGIFExporter, exportSolutionAsGIF } from './gif-export.js';
import {
  ShareCardGenerator,
  ShareManager,
  getStreakCalendarData,
  shareCurrentStreak as shareStreakImpl,
  shareCurrentLevel as shareLevelImpl,
  shareDailyResult as shareDailyImpl,
  shareProfileStats as shareProfileImpl
} from './share-cards.js';

export const Share = {
  /**
   * Share content using native share sheet or fallback
   * @param {Object} options - Share options
   * @param {string} options.title - Share title
   * @param {string} options.text - Share text
   * @param {string} [options.url] - URL to share
   * @returns {Promise<boolean>} Success status
   */
  async share({ title, text, url }) {
    // Try native share API first
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false;
        // Fall through to fallback
      }
    }

    // Fallback: copy to clipboard
    return this.copyToClipboard(`${title}\n${text}\n${url || ''}`);
  },

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} Success status
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  },

  /**
   * Generate share text for game result
   * @param {string} gameId - Game identifier
   * @param {Object} result - Game result data
   * @returns {string} Formatted share text
   */
  formatResult(gameId, result) {
    const emoji = this.getGameEmoji(gameId);
    const lines = [`${emoji} Daily ${gameId}`];

    if (result.level) lines.push(`Level: ${result.level}`);
    if (result.moves) lines.push(`Moves: ${result.moves}`);
    if (result.time) lines.push(`Time: ${this.formatTime(result.time)}`);
    if (result.completed !== undefined) {
      lines.push(result.completed ? '✅ Solved!' : '❌ Try again!');
    }

    return lines.join('\n');
  },

  /**
   * Get emoji for game
   * @param {string} gameId
   * @returns {string}
   */
  getGameEmoji(gameId) {
    const emojis = {
      'water-sort': '💧',
      'parking-escape': '🚗',
      'bus-jam': '🚌',
      'pull-the-pin': '📌',
    };
    return emojis[gameId] || '🎮';
  },

  /**
   * Format seconds to MM:SS
   * @param {number} seconds
   * @returns {string}
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  /**
   * Share a GIF file using Web Share API or download
   * @param {Blob} blob - GIF blob to share
   * @param {Object} options - Share options
   * @param {string} options.gameId - Game identifier
   * @param {string|number} options.levelId - Level identifier
   * @param {number} options.moves - Number of moves
   * @param {string} [options.title] - Custom title
   * @returns {Promise<{success: boolean, method: string}>}
   */
  async shareGIF(blob, options = {}) {
    const {
      gameId = 'game',
      levelId = 'solution',
      moves = 0,
      title
    } = options;

    const filename = `${gameId}-${levelId}.gif`;
    const file = new File([blob], filename, { type: 'image/gif' });

    const shareTitle = title || `I solved ${gameId} level ${levelId}!`;
    const shareText = `Beat this level in ${moves} moves on Mobile Gaming`;

    const shareData = {
      title: shareTitle,
      text: shareText,
      files: [file]
    };

    // Check if Web Share API supports files
    if (navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return { success: true, method: 'share' };
      } catch (e) {
        if (e.name === 'AbortError') {
          return { success: false, method: 'aborted' };
        }
        // Fall through to download
      }
    }

    // Fallback: Download
    this.downloadBlob(blob, filename);
    return { success: true, method: 'download' };
  },

  /**
   * Download a blob as a file
   * @param {Blob} blob - Blob to download
   * @param {string} filename - File name
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Create a GIF exporter for recording solutions
   * @param {Object} options - Exporter options
   * @returns {GIFExporter}
   */
  createGIFRecorder(options) {
    return createGIFExporter(options);
  },

  /**
   * Export game states as animated GIF
   * @param {Array} states - Array of game states
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} GIF blob
   */
  async exportAsGIF(states, options) {
    return exportSolutionAsGIF(states, options);
  },

  /**
   * Generate share URL with seed for infinite mode
   * @param {string} gameId - Game identifier
   * @param {number} seed - Puzzle seed
   * @returns {string} Shareable URL
   */
  generateSeedURL(gameId, seed) {
    const base = window.location.origin;
    const gamePath = `/games/${gameId}/`;
    return `${base}${gamePath}?seed=${seed}`;
  },

  /**
   * Copy share URL to clipboard
   * @param {string} url - URL to copy
   * @returns {Promise<boolean>} Success status
   */
  async copyShareURL(url) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  },

  // ========== Achievement Card Sharing ==========

  /**
   * Create a share card generator
   * @param {Object} options - Generator options
   * @returns {ShareCardGenerator}
   */
  createCardGenerator(options) {
    return new ShareCardGenerator(options);
  },

  /**
   * Create a share manager for handling share dialogs
   * @returns {ShareManager}
   */
  createShareManager() {
    return new ShareManager();
  },

  /**
   * Share streak achievement with card
   * @param {Object} data - Streak data
   * @returns {Promise<{success: boolean, method: string}>}
   */
  async shareStreak(data) {
    const manager = new ShareManager();
    return manager.shareStreak(data);
  },

  /**
   * Share milestone/level achievement with card
   * @param {Object} data - Milestone data
   * @returns {Promise<{success: boolean, method: string}>}
   */
  async shareMilestone(data) {
    const manager = new ShareManager();
    return manager.shareMilestone(data);
  },

  /**
   * Share game mastery achievement with card
   * @param {Object} data - Mastery data
   * @returns {Promise<{success: boolean, method: string}>}
   */
  async shareMastery(data) {
    const manager = new ShareManager();
    return manager.shareMastery(data);
  },

  /**
   * Share daily challenge result with card
   * @param {Object} data - Daily result data
   * @returns {Promise<{success: boolean, method: string}>}
   */
  async shareDaily(data) {
    const manager = new ShareManager();
    return manager.shareDaily(data);
  },

  /**
   * Share profile stats with card
   * @param {Object} data - Profile data
   * @returns {Promise<{success: boolean, method: string}>}
   */
  async shareProfile(data) {
    const manager = new ShareManager();
    return manager.shareProfile(data);
  },

  /**
   * Share first 3-star achievement with card
   * @param {Object} data - Achievement data
   * @returns {Promise<{success: boolean, method: string}>}
   */
  async shareFirstStar(data) {
    const manager = new ShareManager();
    return manager.shareFirstStar(data);
  },

  // ========== Quick Share Functions ==========

  /**
   * Share current streak (uses stored profile data)
   * @returns {Promise<{success: boolean, method: string}>}
   */
  async shareCurrentStreak() {
    return shareStreakImpl();
  },

  /**
   * Share current level (uses stored profile data)
   * @returns {Promise<{success: boolean, method: string}>}
   */
  async shareCurrentLevel() {
    return shareLevelImpl();
  },

  /**
   * Share daily result for a game (uses stored data)
   * @param {string} gameId - Game identifier
   * @returns {Promise<{success: boolean, method: string}>}
   */
  async shareDailyResult(gameId) {
    return shareDailyImpl(gameId);
  },

  /**
   * Share profile stats (uses stored profile data)
   * @returns {Promise<{success: boolean, method: string}>}
   */
  async shareProfileStats() {
    return shareProfileImpl();
  },

  /**
   * Get calendar data for streak visualization
   * @param {number} days - Number of days to include
   * @returns {Array} Calendar data array
   */
  getStreakCalendarData(days = 30) {
    return getStreakCalendarData(days);
  },

  // ========== Share Prompt Helpers ==========

  /**
   * Show share prompt toast
   * @param {Object} options - Prompt options
   * @param {string} options.title - Prompt title
   * @param {string} options.subtitle - Prompt subtitle
   * @param {Function} options.onShare - Share callback
   * @param {number} [options.timeout=10000] - Auto-dismiss timeout
   * @returns {HTMLElement} The prompt element
   */
  showSharePrompt(options) {
    const { title, subtitle, onShare, timeout = 10000 } = options;

    const prompt = document.createElement('div');
    prompt.className = 'share-prompt';
    prompt.innerHTML = `
      <div class="share-prompt-content">
        <div class="share-prompt-title">${title}</div>
        <div class="share-prompt-subtitle">${subtitle}</div>
      </div>
      <div class="share-prompt-actions">
        <button class="share-prompt-btn share-prompt-btn-dismiss">Later</button>
        <button class="share-prompt-btn share-prompt-btn-share">Share</button>
      </div>
    `;

    document.body.appendChild(prompt);

    const dismiss = () => {
      prompt.style.animation = 'share-fadeIn 0.2s ease reverse';
      setTimeout(() => prompt.remove(), 200);
    };

    // Dismiss button
    prompt.querySelector('.share-prompt-btn-dismiss').addEventListener('click', dismiss);

    // Share button
    prompt.querySelector('.share-prompt-btn-share').addEventListener('click', async () => {
      dismiss();
      if (onShare) {
        await onShare();
      }
    });

    // Auto-dismiss
    if (timeout > 0) {
      setTimeout(dismiss, timeout);
    }

    return prompt;
  },

  /**
   * Check if share prompt should be shown for achievement
   * @param {string} type - Achievement type
   * @param {Object} data - Achievement data
   * @returns {boolean} Whether to show prompt
   */
  shouldPromptShare(type, data) {
    // Milestone levels
    const milestoneLevels = [10, 25, 50, 100];
    if (type === 'milestone' && milestoneLevels.includes(data.level)) {
      return true;
    }

    // Streak milestones
    const streakMilestones = [7, 14, 30, 100];
    if (type === 'streak' && streakMilestones.includes(data.currentStreak)) {
      return true;
    }

    // Game mastery (100 stars)
    if (type === 'mastery' && data.stars >= 100) {
      return true;
    }

    // Daily completion
    if (type === 'daily' && data.completed) {
      return true;
    }

    // First 3-star
    if (type === 'firstStar') {
      return true;
    }

    return false;
  }
};

export default Share;
