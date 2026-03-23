/**
 * Pull the Pin - Canvas Renderer (polished)
 *
 * Physics-feel improvements:
 * - Drop shadows for 3D depth illusion
 * - Scale-pop animation when balls enter cups
 * - Squash/stretch on ball landing
 * - Confetti burst on level complete
 * - Pin pull ease-out with ring ripple
 * - Background grid for spatial reference
 */

import { BALL_RADIUS } from './state.js';
import { getPatternLabel } from '../../shared/color-blind.js';

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

// Easing functions
const ease = {
  outBounce(t) {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
    if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
  },
  outElastic(t) {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
  },
  outCubic(t) { return 1 - Math.pow(1 - t, 3); },
  inOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
};

/**
 * Create renderer for the game canvas
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Animation state
  const cupPops = new Map();      // cupId → { startTime, color }
  const pinRipples = new Map();   // pinId → { startTime, x, y }
  const particles = [];           // confetti particles
  let lastState = null;
  let winAnimStarted = false;
  let reducedMotion = false;
  let colorBlindMode = false;
  let hintPinId = null;
  let hintRafId = null;

  function now() { return performance.now(); }

  /**
   * Check for state transitions and trigger animations
   */
  function updateAnimations(state) {
    if (!lastState) { lastState = state; return; }

    // Detect balls newly settled into cups
    for (const ball of state.balls) {
      if (ball.settled && ball.cupId) {
        const prev = lastState.balls.find(b => b.id === ball.id);
        if (prev && !prev.settled) {
          cupPops.set(ball.cupId, { startTime: now(), color: COLORS[ball.color] || '#888' });
        }
      }
    }

    // Detect pins newly removed
    for (const pin of state.pins) {
      if (pin.removed) {
        const prev = lastState.pins.find(p => p.id === pin.id);
        if (prev && !prev.removed) {
          pinRipples.set(pin.id, { startTime: now(), x: pin.x, y: pin.y });
        }
      }
    }

    // Level complete confetti
    if (state.status === 'won' && !winAnimStarted) {
      winAnimStarted = true;
      if (!reducedMotion) spawnConfetti(width, height);
    }
    if (state.status !== 'won') winAnimStarted = false;

    lastState = state;
  }

  function spawnConfetti(w, _h) {
    const colors = Object.values(COLORS);
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * w,
        y: -10 - Math.random() * 40,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        w: 6 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        life: 1
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;  // gravity
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
      p.life -= 0.012;
      if (p.life <= 0 || p.y > height + 20) particles.splice(i, 1);
    }
  }

  function doRender(state) {
    updateAnimations(state);
    updateParticles();

    renderBackground(ctx, width, height);
    renderGrid(ctx, width, height);
    renderChannels(ctx, state);
    renderCups(ctx, state, cupPops, colorBlindMode);
    renderBalls(ctx, state, colorBlindMode);
    renderPins(ctx, state, pinRipples, hintPinId);
    renderParticles(ctx, particles);
    renderUI(ctx, state, width, height);
  }

  function startHintLoop() {
    if (hintRafId || reducedMotion) return;
    function loop() {
      if (!hintPinId || !lastState) { hintRafId = null; return; }
      doRender(lastState);
      hintRafId = requestAnimationFrame(loop);
    }
    hintRafId = requestAnimationFrame(loop);
  }

  function stopHintLoop() {
    if (hintRafId) { cancelAnimationFrame(hintRafId); hintRafId = null; }
  }

  return {
    render(state) { doRender(state); },

    /** Let external code reset win animation on new level */
    resetAnimations() {
      cupPops.clear();
      pinRipples.clear();
      particles.length = 0;
      winAnimStarted = false;
      lastState = null;
      hintPinId = null;
      stopHintLoop();
    },

    setReducedMotion(v) { reducedMotion = v; },
    setColorBlindMode(v) { colorBlindMode = v; },
    setHintPin(id) {
      hintPinId = id;
      if (id) startHintLoop(); else stopHintLoop();
    }
  };
}

/** Faint dot-grid for spatial grounding */
function renderGrid(ctx, width, height) {
  ctx.fillStyle = 'rgba(100, 150, 180, 0.12)';
  const step = 24;
  for (let x = step; x < width; x += step) {
    for (let y = step; y < height; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Background gradient */
function renderBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, UI.background1);
  gradient.addColorStop(1, UI.background2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/** Channel walls with subtle groove depth */
function renderChannels(ctx, state) {
  const channels = state.channels || [];
  for (const channel of channels) {
    const isBlocked = state.pins.some(p => p.id === channel.blockedByPin && !p.removed);

    // Shadow side (dark offset below)
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = isBlocked ? 5 : 8;
    ctx.lineCap = 'round';
    for (const seg of channel.segments) {
      ctx.beginPath();
      ctx.moveTo(seg.x1 + 1, seg.y1 + 2);
      ctx.lineTo(seg.x2 + 1, seg.y2 + 2);
      ctx.stroke();
    }

    // Main wall
    ctx.strokeStyle = isBlocked ? '#666666' : UI.channelWall;
    ctx.lineWidth = isBlocked ? 4 : 6;
    for (const seg of channel.segments) {
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();

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

/** Cups with scale-pop animation on ball capture */
function renderCups(ctx, state, cupPops, colorBlindMode = false) {
  const t = performance.now();

  for (const cup of state.cups) {
    const color = COLORS[cup.acceptColor] || '#888888';
    const pop = cupPops.get(cup.id);
    let scale = 1;

    if (pop) {
      const elapsed = (t - pop.startTime) / 300; // 300ms pop
      if (elapsed < 1) {
        // 1 → 1.12 → 1 elastic pop
        scale = 1 + 0.12 * ease.outElastic(elapsed);
      } else {
        cupPops.delete(cup.id);
      }
    }

    const topWidth = cup.width;
    const bottomWidth = cup.width * 0.7;
    const x = cup.x;
    const y = cup.y;
    const cx = x + topWidth / 2;
    const cy = y + cup.height / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    // Drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + topWidth, y);
    ctx.lineTo(x + (topWidth + bottomWidth) / 2, y + cup.height);
    ctx.lineTo(x + (topWidth - bottomWidth) / 2, y + cup.height);
    ctx.closePath();

    // Gradient fill
    const grad = ctx.createLinearGradient(x, y, x + topWidth, y + cup.height);
    grad.addColorStop(0, 'rgba(255,255,255,0.92)');
    grad.addColorStop(1, 'rgba(220,235,245,0.82)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = color;
    ctx.lineWidth = pop ? 3.5 : 2.5;
    ctx.stroke();

    // Color stripe at top
    ctx.fillStyle = color;
    ctx.fillRect(x + 5, y - 8, topWidth - 10, 6);

    // Color-blind label on stripe
    if (colorBlindMode) {
      const label = getPatternLabel(cup.acceptColor);
      if (label) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + topWidth / 2, y - 5);
        ctx.restore();
      }
    }

    // Glow when captured balls present
    if (cup.captured && cup.captured.length > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

/** Balls with squash on settling and depth shadow */
function renderBalls(ctx, state, colorBlindMode = false) {
  for (const ball of state.balls) {
    if (ball.lost) continue;

    const x = ball.x;
    const y = ball.settled && ball.cupId
      ? getCupBallPosition(state, ball.cupId, ball)
      : ball.y;
    const color = COLORS[ball.color] || '#888888';
    const r = BALL_RADIUS;

    // Squash when settling (vy > 0 just before settle = squashed vertically)
    const velY = ball.vy || 0;
    const squash = ball.settled ? 1 : Math.max(0.85, 1 - Math.abs(velY) * 0.012);
    const scaleX = ball.settled ? 1 : 1 / squash;
    const scaleY = squash;

    // Drop shadow
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 3, r * scaleX * 0.9, r * scaleY * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
    ctx.fill();

    // Main ball
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scaleX, scaleY);

    const gradient = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
    gradient.addColorStop(0, lightenColor(color, 40));
    gradient.addColorStop(0.65, color);
    gradient.addColorStop(1, darkenColor(color, 20));

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Specular
    ctx.beginPath();
    ctx.arc(-r * 0.27, -r * 0.27, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
    ctx.fill();

    // Edge gloss
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Color-blind label centered on ball
    if (colorBlindMode) {
      const label = getPatternLabel(ball.color);
      if (label) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `bold ${Math.round(r * 0.9)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 0);
      }
    }

    ctx.restore();
  }
}

function getCupBallPosition(state, cupId, ball) {
  const cup = state.cups.find(c => c.id === cupId);
  if (!cup) return ball.y;
  const ballIndex = cup.captured.findIndex(c => c.id === ball.id);
  const stackOffset = ballIndex >= 0 ? ballIndex * (BALL_RADIUS * 1.5) : 0;
  return cup.y + cup.height - BALL_RADIUS - stackOffset;
}

/** Pins with ripple-ring on removal */
function renderPins(ctx, state, pinRipples, hintPinId = null) {
  const t = performance.now();

  // Draw removal ripples first (behind everything)
  for (const [pinId, ripple] of pinRipples) {
    const elapsed = (t - ripple.startTime) / 500;
    if (elapsed >= 1) { pinRipples.delete(pinId); continue; }

    const radius = 20 + elapsed * 40;
    const alpha = (1 - elapsed) * 0.5;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(200, 200, 200, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  for (const pin of state.pins) {
    if (pin.removed) continue;

    const x = pin.x;
    const y = pin.y;
    const pw = 40;
    const ph = 12;

    // Hint glow
    if (pin.id === hintPinId) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
      ctx.save();
      ctx.shadowColor = `rgba(255, 220, 50, ${0.5 + 0.4 * pulse})`;
      ctx.shadowBlur = 18 + 8 * pulse;
      ctx.beginPath();
      ctx.roundRect(x - pw / 2 - 4, y - ph / 2 - 4, pw + 8, ph + 8, 8);
      ctx.strokeStyle = `rgba(255, 200, 0, ${0.8 + 0.2 * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    // Metallic gradient
    const gradient = ctx.createLinearGradient(x - pw / 2, y - ph / 2, x - pw / 2, y + ph / 2);
    gradient.addColorStop(0, UI.pinHighlight);
    gradient.addColorStop(0.4, UI.pinMetal);
    gradient.addColorStop(0.7, UI.pinHighlight);
    gradient.addColorStop(1, UI.pinShadow);

    ctx.beginPath();
    ctx.roundRect(x - pw / 2, y - ph / 2, pw, ph, 5);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = UI.pinShadow;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Horizontal shine stripe
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x - pw / 2 + 4, y - ph / 2 + 2, pw - 8, 3);

    // Pull handle (ring)
    const hx = x + pw / 2 + 10;
    ctx.beginPath();
    ctx.arc(hx, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = UI.pinHighlight;
    ctx.fill();
    ctx.strokeStyle = UI.pinShadow;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(hx, y, 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = UI.pinMetal;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}

/** Confetti particles */
function renderParticles(ctx, particles) {
  for (const p of particles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** UI overlay text */
function renderUI(ctx, state, width) {
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';

  if (state.status === 'won') {
    ctx.fillStyle = '#4CAF50';
    ctx.fillText('Level Complete!', width / 2, 40);
  } else if (state.status === 'lost') {
    ctx.fillStyle = '#F44336';
    ctx.fillText('Try Again', width / 2, 40);
  }

  const remainingPins = state.pins.filter(p => !p.removed).length;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'left';
  ctx.fillText(`Pins: ${remainingPins}`, 10, 25);
}

/** Lighten hex color by percent */
function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/** Darken hex color by percent */
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
