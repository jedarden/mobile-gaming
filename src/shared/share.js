/**
 * Share.js - Sharing Utilities
 *
 * Provides cross-platform sharing functionality:
 * - Native Web Share API
 * - Fallback share dialogs
 * - Social media deep links
 * - Score/result sharing
 */

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
  }
};

export default Share;
