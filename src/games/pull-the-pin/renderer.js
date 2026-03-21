/**
 * Pull the Pin - Canvas Renderer
 *
 * Renders the pin-removal puzzle game:
 * - Background gradient
 * - Pins with metallic appearance
 * - Balls with specular highlights
 * - Cups with color-coded borders
 * - Channel walls
 * - Animations and effects
 */

import { BALL_RADIUS } from './state.js';

// Color palette
const COLORS = {
  red: '#FF6B6B',
  blue: '#4DABF7',
  green: '#69DB7C',
  yellow: '#FFD93D',
  purple: '#B197FC',
  orange: '#FFA94D'
};

const UI = {
  pinMetal: '#8B8B8B',
  pinHighlight: '#C0C0C0',
  pinShadow: '#4A4A4A',
  channelWall: '#3D3D3D',
  channelHighlight: '#5A5A5A',
  background1: '#E8F4F8',
  background2: '#D0E8F0'
};

/**
 * Create renderer for the game canvas
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  return {
    render(state) {
      renderBackground(ctx, width, height);
      renderChannels(ctx, state);
      renderCups(ctx, state);
      renderBalls(ctx, state);
      renderPins(ctx, state);
      renderUI(ctx, state, width, height);
    }
  };
}

/**
 * Render background gradient
 */
function renderBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, UI.background1);
  gradient.addColorStop(1, UI.background2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Render channel walls
 */
function renderChannels(ctx, state) {
  const channels = state.channels || [];

  for (const channel of channels) {
    const isBlocked = state.pins.some(p => p.id === channel.blockedByPin && !p.removed);

    ctx.strokeStyle = isBlocked ? '#666666' : UI.channelWall;
    ctx.lineWidth = isBlocked ? 4 : 6;
    ctx.lineCap = 'round';

    for (const seg of channel.segments) {
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();

      // Add highlight
      if (!isBlocked) {
        ctx.strokeStyle = UI.channelHighlight;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(seg.x1 + 1, seg.y1 + 1);
        ctx.lineTo(seg.x2 + 1, seg.y2 + 1);
        ctx.stroke();
        ctx.strokeStyle = UI.channelWall;
        ctx.lineWidth = 6;
      }
    }
  }
}

/**
 * Render cups at the bottom
 */
function renderCups(ctx, state) {
  for (const cup of state.cups) {
    const color = COLORS[cup.acceptColor] || '#888888';

    // Cup body (trapezoid shape)
    ctx.beginPath();
    const topWidth = cup.width;
    const bottomWidth = cup.width * 0.7;
    const x = cup.x;
    const y = cup.y;

    ctx.moveTo(x, y);
    ctx.lineTo(x + topWidth, y);
    ctx.lineTo(x + (topWidth + bottomWidth) / 2, y + cup.height);
    ctx.lineTo(x + (topWidth - bottomWidth) / 2, y + cup.height);
    ctx.closePath();

    // Fill with semi-transparent color
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();

    // Border matching accept color
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Color indicator at top
    ctx.fillStyle = color;
    ctx.fillRect(x + 5, y - 8, topWidth - 10, 6);

    // Glow effect when balls are captured
    if (cup.captured && cup.captured.length > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
}

/**
 * Render balls with specular highlight
 */
function renderBalls(ctx, state) {
  for (const ball of state.balls) {
    if (ball.lost) continue;

    const x = ball.x;
    const y = ball.settled && ball.cupId
      ? getCupBallPosition(state, ball.cupId, ball)
      : ball.y;
    const color = COLORS[ball.color] || '#888888';
    const radius = BALL_RADIUS;

    // Shadow
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fill();

    // Main ball
    const gradient = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, 0,
      x, y, radius
    );
    gradient.addColorStop(0, lightenColor(color, 40));
    gradient.addColorStop(0.7, color);
    gradient.addColorStop(1, darkenColor(color, 20));

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Specular highlight
    ctx.beginPath();
    ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
  }
}

/**
 * Get Y position of ball inside a cup
 */
function getCupBallPosition(state, cupId, ball) {
  const cup = state.cups.find(c => c.id === cupId);
  if (!cup) return ball.y;

  const ballIndex = cup.captured.findIndex(c => c.id === ball.id);
  const stackOffset = ballIndex >= 0 ? ballIndex * (BALL_RADIUS * 1.5) : 0;

  return cup.y + cup.height - BALL_RADIUS - stackOffset;
}

/**
 * Render pins with metallic appearance
 */
function renderPins(ctx, state) {
  for (const pin of state.pins) {
    if (pin.removed) continue;

    const x = pin.x;
    const y = pin.y;
    const width = 40;
    const height = 12;

    // Pin body gradient (metallic)
    const gradient = ctx.createLinearGradient(x - width / 2, y, x + width / 2, y);
    gradient.addColorStop(0, UI.pinShadow);
    gradient.addColorStop(0.3, UI.pinHighlight);
    gradient.addColorStop(0.5, UI.pinMetal);
    gradient.addColorStop(0.7, UI.pinHighlight);
    gradient.addColorStop(1, UI.pinShadow);

    // Main pin body
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - height / 2, width, height, 4);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = UI.pinShadow;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pull handle (circle)
    ctx.beginPath();
    ctx.arc(x + width / 2 + 10, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = UI.pinHighlight;
    ctx.fill();
    ctx.strokeStyle = UI.pinShadow;
    ctx.stroke();

    // Inner ring of handle
    ctx.beginPath();
    ctx.arc(x + width / 2 + 10, y, 4, 0, Math.PI * 2);
    ctx.strokeStyle = UI.pinMetal;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/**
 * Render UI elements (status, moves)
 */
function renderUI(ctx, state, width, height) {
  // Status text
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#333333';

  if (state.status === 'won') {
    ctx.fillStyle = '#4CAF50';
    ctx.fillText('Level Complete!', width / 2, 40);
  } else if (state.status === 'lost') {
    ctx.fillStyle = '#F44336';
    ctx.fillText('Try Again', width / 2, 40);
  }

  // Pin count
  const remainingPins = state.pins.filter(p => !p.removed).length;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'left';
  ctx.fillText(`Pins: ${remainingPins}`, 10, 25);
}

/**
 * Lighten a color by percentage
 */
function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Darken a color by percentage
 */
function darkenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
  const B = Math.max(0, (num & 0x0000FF) - amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

export default {
  createRenderer,
  COLORS,
  UI
};
