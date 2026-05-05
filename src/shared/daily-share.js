/**
 * Daily Share - Daily challenge result sharing
 *
 * Provides:
 * - Share card generation using Canvas 2D
 * - Web Share API integration for sharing images
 * - Text-based fallback for platforms without image sharing
 * - Game icon loading from OG preview images
 * - Per-move quality tracking for Wordle-style grids
 *
 * Usage:
 *   await shareDailyResult({ gameId: 'water-sort', moves: 14, time: 45, hints: 0, date: '2026-03-16' });
 *   await shareDailyResult({ gameId: 'water-sort', moves: 14, time: 45, hints: 0, date: '2026-03-16', moveQuality: ['optimal', 'optimal', 'suboptimal', 'hint', ...] });
 */

// Game display names and colors
const GAME_INFO = {
  'pull-the-pin': { name: 'Pull the Pin', color: '#e74c3c' },
  'water-sort': { name: 'Water Sort', color: '#3498db' },
  'brain-teaser': { name: 'Brain Teaser', color: '#9b59b6' },
  'parking-escape': { name: 'Parking Escape', color: '#f39c12' },
  'save-the-character': { name: 'Save the Character', color: '#e74c3c' },
  'merge-games': { name: 'Merge Games', color: '#2ecc71' },
  'satisfying-asmr': { name: 'Satisfying ASMR', color: '#f39c12' },
  'crowd-runner': { name: 'Crowd Runner', color: '#3498db' },
  'bridge-race': { name: 'Bridge Race', color: '#e67e22' },
  'giant-runner': { name: 'Giant Runner', color: '#9b59b6' },
  'jelly-shift': { name: 'Jelly Shift', color: '#e74c3c' },
  'makeover-run': { name: 'Makeover Run', color: '#f39c12' },
  'bus-jam': { name: 'Bus Jam', color: '#34495e' }
};

// Move quality enum
const MoveQuality = {
  OPTIMAL: 'optimal',    // Green - perfect move
  SUBOPTIMAL: 'suboptimal', // Yellow - could be better
  HINT_ASSISTED: 'hint-assisted' // Gray - used hint
};

// Cache for loaded game icons
const iconCache = new Map();

/**
 * Load game icon image
 * @param {string} gameId - Game identifier
 * @returns {Promise<HTMLImageElement|null>} Loaded image or null if not found
 */
async function loadGameIcon(gameId) {
  // Check cache first
  if (iconCache.has(gameId)) {
    return iconCache.get(gameId);
  }

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const iconPath = `/og/${gameId}.png`;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = iconPath;
    });

    iconCache.set(gameId, img);
    return img;
  } catch {
    // Icon not found, return null
    return null;
  }
}

/**
 * Generate share card as image blob
 * @param {Object} options - Share options
 * @param {string} options.gameId - Game identifier
 * @param {number} options.moves - Number of moves used
 * @param {number} options.time - Time taken in seconds
 * @param {number} options.hints - Number of hints used
 * @param {string} options.date - Date string (YYYY-MM-DD)
 * @param {number} options.stars - Stars earned (optional)
 * @param {string[]} options.moveQuality - Array of move quality strings ('optimal', 'suboptimal', 'hint-assisted') (optional)
 * @returns {Promise<Blob>} Image blob
 */
export async function generateDailyShareCard(options) {
  const { gameId, moves, time, hints, date, stars, moveQuality } = options;
  const gameInfo = GAME_INFO[gameId] || { name: gameId, color: '#34495e' };

  // Create canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const width = 600;
  const height = 400; // Increased height for better layout
  canvas.width = width;
  canvas.height = height;

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, gameInfo.color);
  gradient.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Load and draw game icon (if available)
  const icon = await loadGameIcon(gameId);
  const iconSize = 64;
  const iconX = (width - iconSize) / 2;
  const iconY = 25;

  if (icon) {
    // Draw icon with rounded corners
    ctx.save();
    roundRect(ctx, iconX, iconY, iconSize, iconSize, 12);
    ctx.clip();
    ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
    ctx.restore();
  } else {
    // Fallback: draw colored circle with first letter
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(width / 2, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gameInfo.name.charAt(0).toUpperCase(), width / 2, iconY + iconSize / 2);
  }

  // Date display
  const dateObj = new Date(date);
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Daily Challenge', width / 2, 115);
  ctx.font = '16px system-ui, -apple-system, sans-serif';
  ctx.fillText(dateStr, width / 2, 138);

  // Game name
  ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
  ctx.fillText(gameInfo.name, width / 2, 175);

  // Stats row
  const statsY = 215;
  ctx.font = '18px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${moves} moves`, width / 2 - 90, statsY);
  ctx.fillText(`${formatTime(time)}`, width / 2, statsY);
  ctx.fillText(`${hints} hints`, width / 2 + 90, statsY);

  // Hints badge (if no hints used)
  if (hints === 0) {
    ctx.fillStyle = 'rgba(46, 204, 113, 0.3)';
    roundRect(ctx, width / 2 - 40, statsY + 15, 80, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('NO HINTS', width / 2, statsY + 30);
  }

  // Move quality grid (Wordle-style)
  const gridStartY = hints === 0 ? 265 : 265;
  const gridSize = 28;
  const gap = 5;
  const maxGridSquares = 10;
  const gridWidth = (gridSize * maxGridSquares) + (gap * (maxGridSquares - 1));
  const startX = (width - gridWidth) / 2;

  const numSquares = Math.min(moves, maxGridSquares);

  // Generate move quality indicators
  for (let i = 0; i < numSquares; i++) {
    const x = startX + i * (gridSize + gap);

    // Determine color based on move quality
    let color;
    if (moveQuality && moveQuality[i]) {
      switch (moveQuality[i]) {
        case MoveQuality.OPTIMAL:
          color = '#2ecc71'; // Green
          break;
        case MoveQuality.SUBOPTIMAL:
          color = '#f1c40f'; // Yellow
          break;
        case MoveQuality.HINT_ASSISTED:
          color = '#95a5a6'; // Gray
          break;
        default:
          color = '#2ecc71';
      }
    } else {
      // Fallback: simplified logic
      // If any hints were used, all squares are gray
      // Otherwise, green for first few, yellow for rest based on move efficiency
      if (hints > 0) {
        color = '#95a5a6';
      } else {
        // Simple heuristic: first 60% green, rest yellow
        color = i < Math.ceil(numSquares * 0.6) ? '#2ecc71' : '#f1c40f';
      }
    }

    // Draw rounded square
    ctx.fillStyle = color;
    roundRect(ctx, x, gridStartY, gridSize, gridSize, 4);
    ctx.fill();
  }

  // Stars (if earned)
  if (stars !== undefined && stars > 0) {
    ctx.font = '24px system-ui, -apple-system, sans-serif';
    ctx.fillText('⭐'.repeat(stars), width / 2, gridStartY + gridSize + 25);
  }

  // Footer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillText('mobile-gaming.pages.dev', width / 2, height - 12);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to generate image blob'));
      }
    }, 'image/png');
  });
}

/**
 * Draw a rounded rectangle
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Rectangle width
 * @param {number} height - Rectangle height
 * @param {number} radius - Corner radius
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Format time in seconds to readable string
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time
 */
function formatTime(seconds) {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate text-based share string (fallback)
 * @param {Object} options - Share options
 * @param {string} options.gameId - Game identifier
 * @param {number} options.moves - Number of moves used
 * @param {number} options.time - Time taken in seconds
 * @param {number} options.hints - Number of hints used
 * @param {string} options.date - Date string (YYYY-MM-DD)
 * @param {string[]} options.moveQuality - Array of move quality strings (optional)
 * @returns {string} Share text
 */
export function generateDailyShareText(options) {
  const { gameId, moves, time, hints, date, moveQuality } = options;
  const gameInfo = GAME_INFO[gameId] || { name: gameId };

  const dateObj = new Date(date);
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Generate emoji indicators for move quality
  const green = '🟩';
  const yellow = '🟨';
  const gray = '⬜';
  const maxIndicators = 6;

  let indicators = '';
  if (moveQuality && moveQuality.length > 0) {
    // Use actual move quality data
    for (let i = 0; i < Math.min(moveQuality.length, maxIndicators); i++) {
      switch (moveQuality[i]) {
        case MoveQuality.OPTIMAL:
          indicators += green;
          break;
        case MoveQuality.SUBOPTIMAL:
          indicators += yellow;
          break;
        case MoveQuality.HINT_ASSISTED:
          indicators += gray;
          break;
        default:
          indicators += green;
      }
    }
  } else {
    // Fallback: simplified logic
    if (hints === 0) {
      // No hints: mostly green
      const greenCount = Math.ceil(Math.min(moves, maxIndicators) * 0.6);
      const yellowCount = Math.min(moves, maxIndicators) - greenCount;
      indicators = green.repeat(greenCount) + yellow.repeat(yellowCount);
    } else {
      // Hints used: all gray
      indicators = gray.repeat(Math.min(moves, maxIndicators));
    }
  }

  const timeStr = time < 60 ? `${Math.floor(time)}s` : `${Math.floor(time / 60)}:${(Math.floor(time) % 60).toString().padStart(2, '0')}`;
  const hintsBadge = hints === 0 ? ' ✨ No hints!' : '';

  return `${gameInfo.name} Daily — ${dateStr}\n${indicators} ${moves} moves, ${timeStr}${hintsBadge}\nmobile-gaming.pages.dev/${gameId}/?daily=${date}`;
}

/**
 * Check if Web Share API with file support is available
 * @returns {boolean}
 */
function hasFileShareSupport() {
  return (
    navigator &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  );
}

/**
 * Share daily challenge result
 * Tries image share first, falls back to text share
 * @param {Object} options - Share options
 * @param {string} options.gameId - Game identifier
 * @param {number} options.moves - Number of moves used
 * @param {number} options.time - Time taken in seconds
 * @param {number} options.hints - Number of hints used
 * @param {string} options.date - Date string (YYYY-MM-DD)
 * @param {number} options.stars - Stars earned (optional)
 * @param {string[]} options.moveQuality - Array of move quality strings (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function shareDailyResult(options) {
  // Try image share first
  if (hasFileShareSupport()) {
    try {
      const blob = await generateDailyShareCard(options);
      const file = new File([blob], `daily-${options.gameId}-${options.date}.png`, { type: 'image/png' });

      const shareData = {
        title: 'Daily Challenge',
        text: generateDailyShareText(options),
        files: [file]
      };

      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return true;
      }
    } catch (error) {
      // Fall through to text share
      if (error.name !== 'AbortError') {
        console.warn('Image share failed, falling back to text:', error);
      }
    }
  }

  // Text share fallback
  try {
    const text = generateDailyShareText(options);
    await navigator.share({
      title: 'Daily Challenge',
      text: text
    });
    return true;
  } catch (error) {
    if (error.name === 'AbortError') {
      return true; // User cancelled
    }
    // Copy to clipboard as last resort
    try {
      await navigator.clipboard.writeText(generateDailyShareText(options));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Download share card as image
 * @param {Object} options - Share options
 * @returns {Promise<void>}
 */
export async function downloadDailyCard(options) {
  const blob = await generateDailyShareCard(options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `daily-${options.gameId}-${options.date}.png`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Get move quality enum for use in games
 * @returns {Object} Move quality enum
 */
export function getMoveQualityEnum() {
  return MoveQuality;
}

export default {
  generateDailyShareCard,
  generateDailyShareText,
  shareDailyResult,
  downloadDailyCard,
  MoveQuality,
  getMoveQualityEnum
};
