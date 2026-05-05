/**
 * Daily Share - Daily challenge result sharing
 *
 * Provides:
 * - Share card generation using Canvas 2D
 * - Web Share API integration for sharing images
 * - Text-based fallback for platforms without image sharing
 *
 * Usage:
 *   await shareDailyResult({ gameId: 'water-sort', moves: 14, time: 45, hints: 0, date: '2026-03-16' });
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

/**
 * Generate share card as image blob
 * @param {Object} options - Share options
 * @param {string} options.gameId - Game identifier
 * @param {number} options.moves - Number of moves used
 * @param {number} options.time - Time taken in seconds
 * @param {number} options.hints - Number of hints used
 * @param {string} options.date - Date string (YYYY-MM-DD)
 * @param {number} options.stars - Stars earned (optional)
 * @returns {Promise<Blob>} Image blob
 */
export async function generateDailyShareCard(options) {
  const { gameId, moves, time, hints, date, stars } = options;
  const gameInfo = GAME_INFO[gameId] || { name: gameId, color: '#34495e' };

  // Create canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const width = 600;
  const height = 315;
  canvas.width = width;
  canvas.height = height;

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, gameInfo.color);
  gradient.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Date display
  const dateObj = new Date(date);
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Daily Challenge', width / 2, 50);
  ctx.font = '18px system-ui, -apple-system, sans-serif';
  ctx.fillText(dateStr, width / 2, 80);

  // Game name
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.fillText(gameInfo.name, width / 2, 130);

  // Stats
  ctx.font = '20px system-ui, -apple-system, sans-serif';
  const statsY = 180;
  ctx.fillText(`${moves} moves`, width / 2 - 80, statsY);
  ctx.fillText(`${Math.floor(time)}s`, width / 2, statsY);
  ctx.fillText(`${hints} hints`, width / 2 + 80, statsY);

  // Stars (if earned)
  if (stars !== undefined && stars > 0) {
    ctx.font = '28px system-ui, -apple-system, sans-serif';
    ctx.fillText('⭐'.repeat(stars), width / 2, 220);
  }

  // Move quality grid (Wordle-style)
  if (moves <= 20) {
    const gridStartY = 250;
    const gridSize = 20;
    const gap = 4;
    const totalWidth = (gridSize * 10) + (gap * 9);
    const startX = (width - totalWidth) / 2;

    // Generate move quality indicators (simplified - all green for now)
    for (let i = 0; i < Math.min(moves, 10); i++) {
      const x = startX + i * (gridSize + gap);
      // Green = optimal, yellow = suboptimal, gray = hint-assisted
      ctx.fillStyle = hints === 0 ? '#2ecc71' : '#95a5a6';
      ctx.fillRect(x, gridStartY, gridSize, gridSize);
    }
  }

  // Footer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText('mobile-gaming.pages.dev', width / 2, height - 15);

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
 * Generate text-based share string (fallback)
 * @param {Object} options - Share options
 * @param {string} options.gameId - Game identifier
 * @param {number} options.moves - Number of moves used
 * @param {number} options.time - Time taken in seconds
 * @param {number} options.hints - Number of hints used
 * @param {string} options.date - Date string (YYYY-MM-DD)
 * @returns {string} Share text
 */
export function generateDailyShareText(options) {
  const { gameId, moves, time, hints, date } = options;
  const gameInfo = GAME_INFO[gameId] || { name: gameId };

  const dateObj = new Date(date);
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Generate emoji indicators for move quality
  const green = '🟩';
  const yellow = '🟨';
  const gray = '⬜';
  const indicators = hints === 0 ? green.repeat(Math.min(moves, 6)) : gray.repeat(Math.min(moves, 6));

  return `${gameInfo.name} Daily — ${dateStr}\n${indicators} ${moves} moves, ${Math.floor(time)}s\nmobile-gaming.pages.dev/${gameId}/?daily=${date}`;
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

export default {
  generateDailyShareCard,
  generateDailyShareText,
  shareDailyResult,
  downloadDailyCard
};
