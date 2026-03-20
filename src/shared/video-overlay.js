/**
 * Video Overlay Rendering Module
 *
 * Renders intro/outro frames for gameplay videos with:
 * - Game name and branding
 * - Stats display (moves, time, score)
 * - QR code linking to puzzle state
 * - Watermark overlay
 *
 * @module video-overlay
 */

// QRCode generator (lazy loaded)
let QRCode = null;
let qrCodeLoaded = false;

/**
 * Load QRCode library on demand
 * @returns {Promise<void>}
 */
async function loadQRCode() {
  if (qrCodeLoaded) return;
  qrCodeLoaded = true;

  try {
    const module = await import('qrcode-generator');
    QRCode = module.default || module;
  } catch {
    // QRCode not available, will use fallback
  }
}

// Output dimensions (9:16 vertical)
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;

// Timing constants (in milliseconds)
const INTRO_DURATION = 1500; // 1.5 seconds
const OUTRO_DURATION = 2000; // 2 seconds
const FADE_DURATION = 300; // 300ms fade transitions

// Colors
const COLORS = {
  background: '#1a1a2e',
  backgroundGradientStart: '#1a1a2e',
  backgroundGradientEnd: '#16213e',
  primary: '#4ecdc4',
  secondary: '#ff6b6b',
  accent: '#ffd93d',
  text: '#ffffff',
  textSecondary: '#a0a0a0',
  watermark: 'rgba(255, 255, 255, 0.3)'
};

// Fonts
const FONTS = {
  title: 'bold 72px system-ui, -apple-system, sans-serif',
  subtitle: '48px system-ui, -apple-system, sans-serif',
  stats: '36px system-ui, -apple-system, sans-serif',
  statsValue: 'bold 48px system-ui, -apple-system, sans-serif',
  watermark: '24px system-ui, -apple-system, sans-serif',
  cta: 'bold 42px system-ui, -apple-system, sans-serif'
};

/**
 * Create an overlay canvas for video rendering
 * @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }}
 */
export function createOverlayCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  return { canvas, ctx };
}

/**
 * Draw background gradient
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 */
function drawBackground(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, OUTPUT_HEIGHT);
  gradient.addColorStop(0, COLORS.backgroundGradientStart);
  gradient.addColorStop(1, COLORS.backgroundGradientEnd);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
}

/**
 * Draw intro frame
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} options - Intro options
 * @param {string} options.gameName - Name of the game
 * @param {string} options.dailyChallenge - Daily challenge text (optional)
 * @param {string} options.difficulty - Difficulty badge text (optional)
 * @param {number} progress - Animation progress (0-1)
 */
export function drawIntroFrame(ctx, options, progress = 1) {
  const { gameName, dailyChallenge, difficulty } = options;

  // Clear and draw background
  ctx.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  drawBackground(ctx);

  // Apply fade-in effect
  ctx.globalAlpha = Math.min(1, progress * 2);

  // Draw game name (centered, upper third)
  ctx.fillStyle = COLORS.text;
  ctx.font = FONTS.title;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(gameName || 'Game', OUTPUT_WIDTH / 2, OUTPUT_HEIGHT * 0.35);

  // Draw daily challenge text if provided
  if (dailyChallenge) {
    ctx.fillStyle = COLORS.primary;
    ctx.font = FONTS.subtitle;
    ctx.fillText(dailyChallenge, OUTPUT_WIDTH / 2, OUTPUT_HEIGHT * 0.45);
  }

  // Draw difficulty badge if provided
  if (difficulty) {
    const badgeX = OUTPUT_WIDTH / 2;
    const badgeY = OUTPUT_HEIGHT * 0.55;
    const badgeWidth = 200;
    const badgeHeight = 50;

    // Badge background
    ctx.fillStyle = COLORS.accent;
    roundRect(ctx, badgeX - badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, 25);
    ctx.fill();

    // Badge text
    ctx.fillStyle = COLORS.background;
    ctx.font = FONTS.stats;
    ctx.fillText(difficulty, badgeX, badgeY);
  }

  // Draw "Get Ready" text
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = FONTS.subtitle;
  ctx.fillText('Get Ready!', OUTPUT_WIDTH / 2, OUTPUT_HEIGHT * 0.75);

  ctx.globalAlpha = 1;
}

/**
 * Draw outro frame with stats and QR code
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} options - Outro options
 * @param {Object} options.stats - Game statistics
 * @param {number} options.stats.moves - Number of moves
 * @param {number} options.stats.time - Time in seconds
 * @param {number} options.stats.score - Final score
 * @param {number} options.stats.stars - Stars earned (1-3)
 * @param {string} options.qrUrl - URL for QR code
 * @param {string} options.gameName - Name of the game
 * @param {number} progress - Animation progress (0-1)
 */
export function drawOutroFrame(ctx, options, progress = 1) {
  const { stats = {}, qrUrl, gameName } = options;
  const { moves, time, score, stars = 0 } = stats;

  // Clear and draw background
  ctx.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  drawBackground(ctx);

  // Apply fade-in effect
  ctx.globalAlpha = Math.min(1, progress * 2);

  // Draw "Level Complete!" or "Solved!" header
  ctx.fillStyle = COLORS.primary;
  ctx.font = FONTS.title;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Solved!', OUTPUT_WIDTH / 2, OUTPUT_HEIGHT * 0.12);

  // Draw stars
  drawStars(ctx, stars, OUTPUT_WIDTH / 2, OUTPUT_HEIGHT * 0.22, 80);

  // Draw stats
  const statsY = OUTPUT_HEIGHT * 0.35;
  const statsSpacing = 100;
  const statsWidth = 300;

  // Moves
  if (moves !== undefined) {
    drawStatItem(ctx, 'Moves', moves.toString(), OUTPUT_WIDTH / 2 - statsWidth, statsY);
  }

  // Time
  if (time !== undefined) {
    drawStatItem(ctx, 'Time', formatTime(time), OUTPUT_WIDTH / 2, statsY);
  }

  // Score
  if (score !== undefined) {
    drawStatItem(ctx, 'Score', score.toString(), OUTPUT_WIDTH / 2 + statsWidth, statsY);
  }

  // Draw QR code section
  if (qrUrl) {
    const qrY = OUTPUT_HEIGHT * 0.55;

    // Draw QR code
    const qrSize = 200;
    drawQRCode(ctx, qrUrl, OUTPUT_WIDTH / 2 - qrSize / 2, qrY, qrSize);

    // Draw "Scan to play" text
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = FONTS.stats;
    ctx.fillText('Scan to Play', OUTPUT_WIDTH / 2, qrY + qrSize + 40);
  }

  // Draw call-to-action
  ctx.fillStyle = COLORS.accent;
  ctx.font = FONTS.cta;
  ctx.fillText('Can you beat this?', OUTPUT_WIDTH / 2, OUTPUT_HEIGHT * 0.85);

  // Draw game name watermark
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = FONTS.subtitle;
  ctx.fillText(gameName || 'Game', OUTPUT_WIDTH / 2, OUTPUT_HEIGHT * 0.92);

  ctx.globalAlpha = 1;
}

/**
 * Draw a single stat item
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} label - Stat label
 * @param {string} value - Stat value
 * @param {number} x - X position
 * @param {number} y - Y position
 */
function drawStatItem(ctx, label, value, x, y) {
  ctx.textAlign = 'center';

  // Label
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = FONTS.stats;
  ctx.fillText(label, x, y);

  // Value
  ctx.fillStyle = COLORS.text;
  ctx.font = FONTS.statsValue;
  ctx.fillText(value, x, y + 50);
}

/**
 * Draw stars rating
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} count - Number of stars (0-3)
 * @param {number} x - Center X position
 * @param {number} y - Y position
 * @param {number} size - Star size
 */
function drawStars(ctx, count, x, y, size) {
  const starCount = Math.min(3, Math.max(0, count));
  const spacing = size * 1.2;
  const startX = x - spacing;

  for (let i = 0; i < 3; i++) {
    const starX = startX + i * spacing;
    const filled = i < starCount;

    drawStar(ctx, starX, y, size / 2, filled);
  }
}

/**
 * Draw a single star shape
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} radius - Star radius
 * @param {boolean} filled - Whether star is filled
 */
function drawStar(ctx, cx, cy, radius, filled) {
  const spikes = 5;
  const outerRadius = radius;
  const innerRadius = radius / 2;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);

  for (let i = 0; i < spikes; i++) {
    const outerAngle = (i * 4 * Math.PI) / spikes - Math.PI / 2;
    const innerAngle = outerAngle + (2 * Math.PI) / spikes / 2;

    ctx.lineTo(
      cx + Math.cos(outerAngle) * outerRadius,
      cy + Math.sin(outerAngle) * outerRadius
    );
    ctx.lineTo(
      cx + Math.cos(innerAngle) * innerRadius,
      cy + Math.sin(innerAngle) * innerRadius
    );
  }

  ctx.closePath();

  if (filled) {
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
  } else {
    ctx.strokeStyle = COLORS.textSecondary;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

/**
 * Draw QR code (sync version - uses fallback if QRCode not loaded)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} url - URL to encode
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} size - QR code size
 */
function drawQRCode(ctx, url, x, y, size) {
  // Try to use QRCode if available
  if (QRCode) {
    try {
      // Generate QR code
      const qr = QRCode(0, 'M');
      qr.addData(url);
      qr.make();

      // Calculate module size
      const moduleCount = qr.getModuleCount();
      const moduleSize = size / moduleCount;

      // Draw white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, size, size);

      // Draw QR code modules
      ctx.fillStyle = '#000000';

      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (qr.isDark(row, col)) {
            ctx.fillRect(
              x + col * moduleSize,
              y + row * moduleSize,
              moduleSize,
              moduleSize
            );
          }
        }
      }

      return;
    } catch (e) {
      console.warn('QR code generation failed:', e);
    }
  }

  // Fallback: Draw placeholder with URL hint
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);

  // Draw a simple pattern to indicate QR area
  ctx.fillStyle = '#e0e0e0';
  const gridSize = 5;
  const cellSize = size / gridSize;
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if ((row + col) % 2 === 0) {
        ctx.fillRect(x + col * cellSize, y + row * cellSize, cellSize, cellSize);
      }
    }
  }

  ctx.fillStyle = '#333333';
  ctx.font = '18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Scan', x + size / 2, y + size / 2);
}

/**
 * Draw QR code asynchronously (loads QRCode library if needed)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} url - URL to encode
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} size - QR code size
 * @returns {Promise<void>}
 */
export async function drawQRCodeAsync(ctx, url, x, y, size) {
  await loadQRCode();
  drawQRCode(ctx, url, x, y, size);
}

/**
 * Draw watermark on gameplay frame
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Watermark text
 * @param {number} x - X position
 * @param {number} y - Y position
 */
export function drawWatermark(ctx, text, x = OUTPUT_WIDTH - 20, y = OUTPUT_HEIGHT - 40) {
  ctx.save();

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = COLORS.watermark;
  ctx.font = FONTS.watermark;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';

  // Add subtle shadow for visibility on all backgrounds
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Draw rounded rectangle
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
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
 * Format time in seconds to MM:SS
 * @param {number} seconds - Time in seconds
 * @returns {string}
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Render a complete video frame with game canvas and overlay
 * @param {CanvasRenderingContext2D} ctx - Output canvas context
 * @param {HTMLCanvasElement} gameCanvas - Game canvas to render
 * @param {Object} overlay - Overlay options
 * @param {string} overlay.phase - Current phase ('intro', 'gameplay', 'outro')
 * @param {Object} overlay.options - Phase-specific options
 * @param {number} overlay.progress - Animation progress (0-1)
 * @param {string} watermark - Watermark text
 */
export function renderFrame(ctx, gameCanvas, overlay, watermark = 'mobile-gaming.pages.dev') {
  const { phase, options = {}, progress = 1 } = overlay;

  // Clear canvas
  ctx.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

  if (phase === 'intro') {
    // Full intro frame (no game visible yet)
    drawIntroFrame(ctx, options, progress);
  } else if (phase === 'gameplay') {
    // Game canvas centered with watermark
    drawBackground(ctx);

    // Draw game canvas
    if (gameCanvas) {
      const pos = calculateGamePosition(gameCanvas.width, gameCanvas.height);
      ctx.drawImage(gameCanvas, pos.x, pos.y, pos.width, pos.height);
    }

    // Draw watermark
    if (watermark) {
      drawWatermark(ctx, watermark);
    }
  } else if (phase === 'outro') {
    // Outro frame with stats
    drawOutroFrame(ctx, options, progress);
  }
}

/**
 * Calculate game canvas position within output frame
 * @param {number} gameWidth - Game canvas width
 * @param {number} gameHeight - Game canvas height
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
function calculateGamePosition(gameWidth, gameHeight) {
  const gameAspect = gameWidth / gameHeight;
  const outputAspect = OUTPUT_WIDTH / OUTPUT_HEIGHT;

  let drawWidth, drawHeight, x, y;

  if (gameAspect > outputAspect) {
    drawWidth = OUTPUT_WIDTH;
    drawHeight = OUTPUT_WIDTH / gameAspect;
    x = 0;
    y = (OUTPUT_HEIGHT - drawHeight) / 2;
  } else {
    drawHeight = OUTPUT_HEIGHT;
    drawWidth = OUTPUT_HEIGHT * gameAspect;
    x = (OUTPUT_WIDTH - drawWidth) / 2;
    y = 0;
  }

  return { x, y, width: drawWidth, height: drawHeight };
}

/**
 * Get intro frame count based on frame rate
 * @param {number} fps - Frames per second
 * @returns {number}
 */
export function getIntroFrameCount(fps = 30) {
  return Math.ceil((INTRO_DURATION / 1000) * fps);
}

/**
 * Get outro frame count based on frame rate
 * @param {number} fps - Frames per second
 * @returns {number}
 */
export function getOutroFrameCount(fps = 30) {
  return Math.ceil((OUTRO_DURATION / 1000) * fps);
}

/**
 * Get total overlay duration in milliseconds
 * @returns {number}
 */
export function getTotalOverlayDuration() {
  return INTRO_DURATION + OUTRO_DURATION;
}

export default {
  createOverlayCanvas,
  drawIntroFrame,
  drawOutroFrame,
  drawWatermark,
  drawQRCodeAsync,
  renderFrame,
  getIntroFrameCount,
  getOutroFrameCount,
  getTotalOverlayDuration,
  COLORS,
  FONTS,
  OUTPUT_WIDTH,
  OUTPUT_HEIGHT,
  INTRO_DURATION,
  OUTRO_DURATION
};
