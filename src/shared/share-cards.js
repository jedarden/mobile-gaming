/**
 * Share Cards - Canvas-Generated Achievement Cards
 *
 * Provides:
 * - Canvas-based image generation for achievements
 * - Streak cards with calendar visualization
 * - Milestone cards for level achievements
 * - Mastery cards for game-specific achievements
 * - Daily challenge result cards
 * - Profile stats summary cards
 * - Web Share API integration with fallbacks
 */

import * as storage from './storage.js';
import * as meta from './meta.js';
import * as daily from './daily.js';

// Card dimensions
export const CARD_SIZES = {
  square: { width: 1080, height: 1080 },   // Instagram, Facebook
  landscape: { width: 1200, height: 675 }   // Twitter, LinkedIn
};

// Color palette for cards
export const COLORS = {
  background: {
    start: '#0f0f23',
    middle: '#1a1a3e',
    end: '#0f0f23'
  },
  accent: {
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
    platinum: '#E5E4E2'
  },
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.7)',
    muted: 'rgba(255, 255, 255, 0.5)'
  },
  status: {
    success: '#00C853',
    warning: '#FFB300',
    error: '#FF5252'
  }
};

// Tier colors
export const TIER_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2'
};

/**
 * ShareCardGenerator - Main class for generating share cards
 */
export class ShareCardGenerator {
  constructor(options = {}) {
    this.size = options.size || 'square';
    this.dimensions = CARD_SIZES[this.size];
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Initialize canvas for card generation
   */
  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.dimensions.width;
    this.canvas.height = this.dimensions.height;
    this.ctx = this.canvas.getContext('2d');
    return this.canvas;
  }

  /**
   * Draw gradient background
   */
  drawBackground() {
    const { width, height } = this.dimensions;
    const gradient = this.ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, COLORS.background.start);
    gradient.addColorStop(0.5, COLORS.background.middle);
    gradient.addColorStop(1, COLORS.background.end);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
  }

  /**
   * Draw decorative particles
   */
  drawParticles(count = 50) {
    const { width, height } = this.dimensions;

    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 3 + 1;
      const opacity = Math.random() * 0.3 + 0.1;

      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      this.ctx.fill();
    }
  }

  /**
   * Draw logo/branding header
   */
  drawHeader() {
    const { width } = this.dimensions;

    // Logo icon
    this.ctx.font = '48px system-ui, -apple-system, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('🎮', 50, 70);

    // Brand name
    this.ctx.font = '600 32px system-ui, -apple-system, sans-serif';
    this.ctx.fillStyle = COLORS.text.primary;
    this.ctx.fillText('Mobile Gaming', 110, 68);
  }

  /**
   * Draw footer branding
   */
  drawFooter() {
    const { width, height } = this.dimensions;

    this.ctx.font = '600 24px system-ui, -apple-system, sans-serif';
    this.ctx.fillStyle = COLORS.text.muted;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('mobile-gaming.pages.dev', width / 2, height - 30);
  }

  /**
   * Draw main title with optional emoji
   */
  drawTitle(text, y, options = {}) {
    const { width } = this.dimensions;
    const fontSize = options.fontSize || 72;
    const color = options.color || COLORS.accent.gold;

    this.ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, width / 2, y);

    return y + fontSize + 20;
  }

  /**
   * Draw supporting text
   */
  drawText(text, y, options = {}) {
    const { width } = this.dimensions;
    const fontSize = options.fontSize || 32;
    const color = options.color || COLORS.text.primary;

    this.ctx.font = `${options.weight || 'normal'} ${fontSize}px system-ui, -apple-system, sans-serif`;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, width / 2, y);

    return y + fontSize + 15;
  }

  /**
   * Draw calendar grid for streak visualization
   */
  drawCalendarGrid(days, x, y, width, height) {
    const cols = 7;
    const rows = Math.ceil(days.length / cols);
    const cellWidth = width / cols;
    const cellHeight = height / rows;
    const cellRadius = Math.min(cellWidth, cellHeight) * 0.35;

    days.forEach((day, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = x + col * cellWidth + cellWidth / 2;
      const cy = y + row * cellHeight + cellHeight / 2;

      // Circle background
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, cellRadius, 0, Math.PI * 2);

      if (day.played) {
        this.ctx.fillStyle = COLORS.status.success;
      } else {
        this.ctx.fillStyle = '#333333';
      }
      this.ctx.fill();

      // Highlight today
      if (day.isToday) {
        this.ctx.strokeStyle = COLORS.accent.gold;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
      }
    });
  }

  /**
   * Draw star rating
   */
  drawStars(count, x, y, size = 40) {
    const spacing = size * 1.2;
    const startX = x - ((count - 1) * spacing) / 2;

    for (let i = 0; i < 3; i++) {
      const starX = startX + i * spacing;
      const filled = i < count;

      this.ctx.font = `${size}px system-ui`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(filled ? '⭐' : '☆', starX, y);
    }
  }

  /**
   * Draw progress bar
   */
  drawProgressBar(progress, x, y, width, height = 20) {
    // Background
    this.ctx.fillStyle = '#333333';
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, width, height, height / 2);
    this.ctx.fill();

    // Fill
    if (progress > 0) {
      const fillWidth = Math.max(height, width * progress);
      const gradient = this.ctx.createLinearGradient(x, y, x + fillWidth, y);
      gradient.addColorStop(0, '#6366f1');
      gradient.addColorStop(1, '#8b5cf6');

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, fillWidth, height, height / 2);
      this.ctx.fill();
    }
  }

  /**
   * Generate streak share card
   */
  async generateStreakCard(data) {
    this.initCanvas();
    this.drawBackground();
    this.drawParticles(30);
    this.drawHeader();

    const { width, height } = this.dimensions;
    const centerY = height / 2;

    // Main streak title
    const streakEmoji = daily.getStreakEmoji(data.currentStreak);
    this.drawTitle(`${streakEmoji} ${data.currentStreak} DAY STREAK ${streakEmoji}`, centerY - 120);

    // Calendar grid
    if (data.calendarData && data.calendarData.length > 0) {
      const gridWidth = Math.min(400, width - 100);
      const gridX = (width - gridWidth) / 2;
      this.drawCalendarGrid(data.calendarData, gridX, centerY - 40, gridWidth, 180);
    }

    // Stats
    let statsY = centerY + 160;
    if (data.totalLevels) {
      this.drawText(`${data.totalLevels} levels completed`, statsY);
      statsY += 50;
    }
    if (data.totalXP) {
      this.drawText(`${meta.formatXP(data.totalXP)} XP earned`, statsY);
    }

    this.drawFooter();

    return this.canvas.toDataURL('image/png');
  }

  /**
   * Generate milestone share card (level achievements)
   */
  async generateMilestoneCard(data) {
    this.initCanvas();
    this.drawBackground();
    this.drawParticles(30);
    this.drawHeader();

    const { width, height } = this.dimensions;
    const centerY = height / 2;

    // Level badge
    this.ctx.font = 'bold 150px system-ui, -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = COLORS.accent.gold;
    this.ctx.fillText(`${data.level}`, width / 2, centerY);

    // Level label
    this.drawText('LEVEL', centerY - 100, { fontSize: 48, color: COLORS.text.secondary });

    // Title
    this.drawTitle('Achievement Unlocked!', centerY + 80, { fontSize: 42 });

    // XP total
    if (data.totalXP) {
      this.drawText(`${meta.formatXP(data.totalXP)} Total XP`, centerY + 140, { color: COLORS.text.secondary });
    }

    this.drawFooter();

    return this.canvas.toDataURL('image/png');
  }

  /**
   * Generate mastery share card (game-specific)
   */
  async generateMasteryCard(data) {
    this.initCanvas();
    this.drawBackground();
    this.drawParticles(30);
    this.drawHeader();

    const { width, height } = this.dimensions;
    const centerY = height / 2;

    // Game icon
    const gameEmoji = this.getGameEmoji(data.gameId);
    this.ctx.font = '100px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(gameEmoji, width / 2, centerY - 80);

    // Mastery title
    const tierColor = TIER_COLORS[data.tier] || COLORS.accent.gold;
    this.drawTitle(`${data.gameName} Master!`, centerY + 20, { fontSize: 56, color: tierColor });

    // Stars
    this.drawStars(3, width / 2, centerY + 100, 60);

    // Stats
    if (data.stars) {
      this.drawText(`${data.stars} stars earned`, centerY + 180, { color: COLORS.text.secondary });
    }

    this.drawFooter();

    return this.canvas.toDataURL('image/png');
  }

  /**
   * Generate daily challenge result card
   */
  async generateDailyCard(data) {
    this.initCanvas();
    this.drawBackground();
    this.drawParticles(20);
    this.drawHeader();

    const { width, height } = this.dimensions;
    const centerY = height / 2;

    // Daily challenge title
    this.drawTitle('Daily Challenge', centerY - 100, { fontSize: 48, color: COLORS.text.primary });

    // Game name with emoji
    const gameEmoji = this.getGameEmoji(data.gameId);
    this.drawText(`${gameEmoji} ${data.gameName || data.gameId}`, centerY - 40, { fontSize: 36 });

    // Solved status
    if (data.completed) {
      this.drawTitle('Solved!', centerY + 40, { fontSize: 64, color: COLORS.status.success });

      // Stats
      let statsY = centerY + 120;
      if (data.moves) {
        this.drawText(`${data.moves} moves`, statsY, { fontSize: 32 });
        statsY += 45;
      }
      if (data.time) {
        this.drawText(`Time: ${this.formatTime(data.time)}`, statsY, { fontSize: 32 });
      }

      // Stars
      if (data.stars) {
        this.drawStars(data.stars, width / 2, centerY + 250, 50);
      }
    } else {
      this.drawTitle('Try Again!', centerY + 40, { fontSize: 64, color: COLORS.status.warning });
    }

    // Date
    this.drawText(data.date || daily.getTodayString(), height - 80, { fontSize: 24, color: COLORS.text.muted });

    this.drawFooter();

    return this.canvas.toDataURL('image/png');
  }

  /**
   * Generate profile stats summary card ("Gaming Wrapped" style)
   */
  async generateProfileCard(data) {
    this.initCanvas();
    this.drawBackground();
    this.drawParticles(40);
    this.drawHeader();

    const { width, height } = this.dimensions;
    const centerY = height / 2;

    // Title
    this.drawTitle('My Gaming Stats', centerY - 200, { fontSize: 48 });

    // Level
    this.ctx.font = 'bold 80px system-ui';
    this.ctx.fillStyle = COLORS.accent.gold;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Level ${data.level}`, width / 2, centerY - 100);

    // XP Progress bar
    const barWidth = width - 200;
    const barX = 100;
    this.drawProgressBar(data.progress || 0, barX, centerY - 60, barWidth, 16);

    // Stats grid
    let statsY = centerY;
    const lineHeight = 45;
    const stats = [
      `🎮 ${data.totalCompleted || 0} levels completed`,
      `⭐ ${data.totalStars || 0} stars earned`,
      `💎 ${data.perfectClears || 0} perfect clears`,
      `🔥 ${data.dailyStreak || 0} day streak`,
      `🏆 ${data.achievementCount || 0} achievements`
    ];

    stats.forEach((stat, i) => {
      this.drawText(stat, statsY + i * lineHeight, { fontSize: 28 });
    });

    // Member since
    if (data.memberSince) {
      const date = new Date(data.memberSince);
      this.drawText(`Member since ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
        height - 80, { fontSize: 24, color: COLORS.text.muted });
    }

    this.drawFooter();

    return this.canvas.toDataURL('image/png');
  }

  /**
   * Generate first 3-star achievement card
   */
  async generateFirstStarCard(data) {
    this.initCanvas();
    this.drawBackground();
    this.drawParticles(50);
    this.drawHeader();

    const { width, height } = this.dimensions;
    const centerY = height / 2;

    // Celebration
    this.drawTitle('Perfect Clear!', centerY - 80, { fontSize: 64, color: COLORS.accent.gold });

    // Stars
    this.drawStars(3, width / 2, centerY + 40, 80);

    // Game info
    const gameEmoji = this.getGameEmoji(data.gameId);
    this.drawText(`${gameEmoji} ${data.gameName || data.gameId}`, centerY + 140, { fontSize: 32 });

    if (data.level) {
      this.drawText(`Level ${data.level}`, centerY + 190, { color: COLORS.text.secondary });
    }

    this.drawFooter();

    return this.canvas.toDataURL('image/png');
  }

  /**
   * Get emoji for game
   */
  getGameEmoji(gameId) {
    const emojis = {
      'water-sort': '💧',
      'parking-escape': '🚗',
      'bus-jam': '🚌',
      'pull-pin': '📌',
      'pull-the-pin': '📌'
    };
    return emojis[gameId] || '🎮';
  }

  /**
   * Format time in MM:SS
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get canvas as blob
   */
  async getBlob() {
    return new Promise((resolve) => {
      this.canvas.toBlob(resolve, 'image/png');
    });
  }

  /**
   * Get canvas as data URL
   */
  getDataURL() {
    return this.canvas.toDataURL('image/png');
  }
}

/**
 * ShareManager - High-level API for sharing cards
 */
export class ShareManager {
  constructor() {
    this.generator = new ShareCardGenerator();
  }

  /**
   * Share a card using Web Share API with fallbacks
   */
  async shareCard(imageDataUrl, shareText, options = {}) {
    // Convert data URL to blob
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'mobile-gaming-achievement.png', { type: 'image/png' });

    const shareData = {
      title: options.title || 'Mobile Gaming Achievement',
      text: shareText,
      files: [file]
    };

    // Try native share
    try {
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return { success: true, method: 'native' };
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'aborted' };
      }
      console.warn('[Share] Native share failed:', err);
    }

    // Fallback: show dialog
    return this.showFallbackDialog(imageDataUrl, shareText, options);
  }

  /**
   * Show fallback share dialog
   */
  showFallbackDialog(imageUrl, shareText, options = {}) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'share-card-modal';
      modal.innerHTML = `
        <div class="share-card-backdrop"></div>
        <div class="share-card-content">
          <div class="share-card-header">
            <h3>Share Achievement</h3>
            <button class="share-card-close" aria-label="Close">&times;</button>
          </div>
          <div class="share-card-preview">
            <img src="${imageUrl}" alt="Achievement card" />
          </div>
          <div class="share-card-actions">
            <button class="share-btn share-btn-download">
              <span>📥</span> Download
            </button>
            <button class="share-btn share-btn-copy">
              <span>📋</span> Copy Text
            </button>
            <button class="share-btn share-btn-twitter">
              <span>🐦</span> Twitter
            </button>
            <button class="share-btn share-btn-reddit">
              <span>💬</span> Reddit
            </button>
          </div>
          <p class="share-card-url">mobile-gaming.pages.dev</p>
        </div>
      `;

      document.body.appendChild(modal);

      // Close handlers
      const close = () => {
        modal.remove();
        resolve({ success: false, method: 'cancelled' });
      };

      modal.querySelector('.share-card-close').addEventListener('click', close);
      modal.querySelector('.share-card-backdrop').addEventListener('click', close);

      // Download
      modal.querySelector('.share-btn-download').addEventListener('click', () => {
        this.downloadImage(imageUrl, 'achievement.png');
        modal.remove();
        resolve({ success: true, method: 'download' });
      });

      // Copy text
      modal.querySelector('.share-btn-copy').addEventListener('click', async () => {
        await this.copyToClipboard(shareText);
        modal.remove();
        resolve({ success: true, method: 'clipboard' });
      });

      // Twitter
      modal.querySelector('.share-btn-twitter').addEventListener('click', () => {
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
        window.open(url, '_blank');
        modal.remove();
        resolve({ success: true, method: 'twitter' });
      });

      // Reddit
      modal.querySelector('.share-btn-reddit').addEventListener('click', () => {
        const url = `https://reddit.com/submit?title=${encodeURIComponent(shareText)}`;
        window.open(url, '_blank');
        modal.remove();
        resolve({ success: true, method: 'reddit' });
      });
    });
  }

  /**
   * Download image
   */
  downloadImage(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  /**
   * Copy to clipboard
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
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
  }

  /**
   * Generate share text based on achievement type
   */
  generateShareText(type, data) {
    const templates = {
      streak: (d) => `🔥 ${d.currentStreak}-day streak on Mobile Gaming! Can you beat it? mobile-gaming.pages.dev`,
      milestone: (d) => `Just hit Level ${d.level} on Mobile Gaming! 🎮 mobile-gaming.pages.dev`,
      mastery: (d) => `I mastered ${d.gameName} on Mobile Gaming! 💯 mobile-gaming.pages.dev`,
      daily: (d) => `Solved today's daily challenge in ${d.moves || '?'} moves! 🧩 mobile-gaming.pages.dev`,
      profile: (d) => `I'm Level ${d.level} on Mobile Gaming! 🎮 ${d.totalCompleted} levels, ${d.totalStars} stars. mobile-gaming.pages.dev`,
      firstStar: (d) => `Got my first perfect clear on Mobile Gaming! ⭐⭐⭐ mobile-gaming.pages.dev`
    };

    const template = templates[type];
    return template ? template(data) : 'Check out my progress on Mobile Gaming! mobile-gaming.pages.dev';
  }

  /**
   * Share streak achievement
   */
  async shareStreak(data) {
    const card = await this.generator.generateStreakCard(data);
    const text = this.generateShareText('streak', data);
    return this.shareCard(card, text);
  }

  /**
   * Share milestone achievement
   */
  async shareMilestone(data) {
    const card = await this.generator.generateMilestoneCard(data);
    const text = this.generateShareText('milestone', data);
    return this.shareCard(card, text);
  }

  /**
   * Share mastery achievement
   */
  async shareMastery(data) {
    const card = await this.generator.generateMasteryCard(data);
    const text = this.generateShareText('mastery', data);
    return this.shareCard(card, text);
  }

  /**
   * Share daily challenge result
   */
  async shareDaily(data) {
    const card = await this.generator.generateDailyCard(data);
    const text = this.generateShareText('daily', data);
    return this.shareCard(card, text);
  }

  /**
   * Share profile stats
   */
  async shareProfile(data) {
    const card = await this.generator.generateProfileCard(data);
    const text = this.generateShareText('profile', data);
    return this.shareCard(card, text);
  }

  /**
   * Share first 3-star achievement
   */
  async shareFirstStar(data) {
    const card = await this.generator.generateFirstStarCard(data);
    const text = this.generateShareText('firstStar', data);
    return this.shareCard(card, text);
  }
}

/**
 * Helper function to get calendar data for streak visualization
 */
export function getStreakCalendarData(days = 30) {
  const profile = storage.getProfile();
  const result = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    // Check if any daily was completed on this date
    const games = ['water-sort', 'parking-escape', 'bus-jam', 'pull-pin'];
    const played = games.some(gameId => {
      const data = storage.getDailyChallengeData(dateStr, gameId);
      return data?.completed;
    });

    result.push({
      date: dateStr,
      played,
      isToday: i === 0
    });
  }

  return result;
}

/**
 * Quick share functions
 */
export async function shareCurrentStreak() {
  const profile = storage.getProfile();
  const stats = meta.getProfileStats();
  const calendarData = getStreakCalendarData(30);

  const manager = new ShareManager();
  return manager.shareStreak({
    currentStreak: profile.dailyStreak,
    totalLevels: stats.totalCompleted,
    totalXP: profile.xp,
    calendarData
  });
}

export async function shareCurrentLevel() {
  const stats = meta.getProfileStats();

  const manager = new ShareManager();
  return manager.shareMilestone({
    level: stats.level,
    totalXP: stats.xp
  });
}

export async function shareDailyResult(gameId) {
  const result = daily.getDailyResult(gameId);
  if (!result) return { success: false, reason: 'no_result' };

  const manager = new ShareManager();
  return manager.shareDaily({
    gameId,
    gameName: getGameName(gameId),
    date: daily.getTodayString(),
    completed: result.completed,
    moves: result.moves,
    time: result.time,
    stars: result.stars
  });
}

export async function shareProfileStats() {
  const stats = meta.getProfileStats();
  const profile = storage.getProfile();
  const levelInfo = meta.getLevelInfo();

  const manager = new ShareManager();
  return manager.shareProfile({
    level: stats.level,
    progress: levelInfo.progress,
    totalCompleted: stats.totalCompleted,
    totalStars: stats.totalStars,
    perfectClears: stats.totalPerfectClears,
    dailyStreak: stats.dailyStreak,
    achievementCount: stats.achievementCount,
    memberSince: stats.memberSince
  });
}

/**
 * Get game display name
 */
function getGameName(gameId) {
  const names = {
    'water-sort': 'Water Sort',
    'parking-escape': 'Parking Escape',
    'bus-jam': 'Bus Jam',
    'pull-pin': 'Pull the Pin',
    'pull-the-pin': 'Pull the Pin'
  };
  return names[gameId] || gameId;
}

// Export factory and instances
export function createShareCardGenerator(options) {
  return new ShareCardGenerator(options);
}

export function createShareManager() {
  return new ShareManager();
}

export default {
  ShareCardGenerator,
  ShareManager,
  CARD_SIZES,
  COLORS,
  TIER_COLORS,
  getStreakCalendarData,
  shareCurrentStreak,
  shareCurrentLevel,
  shareDailyResult,
  shareProfileStats,
  createShareCardGenerator,
  createShareManager
};
