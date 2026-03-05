/**
 * Pull the Pin - Canvas Renderer
 *
 * Renders the game board with:
 * - Physics-based balls with gradients
 * - Metallic pins with removal animation
 * - Animated lava hazards
 * - Glowing goal zones
 * - Wall segments
 * - Particle effects
 */

import { BALL_TYPES } from './state.js';

// Visual constants
const COLORS = {
  background: '#1a1a2e',
  wall: '#4A4A5A',
  wallStroke: '#666676',
  pin: '#C0C0C0',
  pinHighlight: '#E8E8E8',
  pinRemoving: '#FF6B6B',
  lava: '#FF4500',
  lavaHighlight: '#FF6B00',
  goal: '#00C853',
  goalHighlight: '#00E676',
  text: '#FFFFFF'
};

/**
 * Create a renderer instance
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let scale = 1;
  let reducedMotion = false;
  let time = 0;

  // Particle system for effects
  let particles = [];

  /**
   * Resize canvas to fit container
   */
  function resize(levelWidth = 300, levelHeight = 400) {
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();

    // Fit within container with padding
    const padding = 20;
    const availableWidth = containerRect.width - padding * 2;
    const availableHeight = containerRect.height - padding * 2;

    // Calculate scale to fit
    const scaleX = availableWidth / levelWidth;
    const scaleY = availableHeight / levelHeight;
    scale = Math.min(scaleX, scaleY, 1.5);

    width = levelWidth * scale;
    height = levelHeight * scale;

    // Set canvas size
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    return { width, height, scale };
  }

  /**
   * Clear the canvas
   */
  function clear() {
    ctx.clearRect(0, 0, width, height);
  }

  /**
   * Draw the full game state
   */
  function render(state) {
    time += 0.016; // ~60fps time increment

    clear();

    // Draw background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Draw walls
    renderWalls(state.walls);

    // Draw hazards
    renderHazards(state.hazards);

    // Draw goals
    renderGoals(state.goals);

    // Draw pins
    renderPins(state.pins);

    // Draw balls
    renderBalls(state.balls);

    // Draw particles
    renderParticles();
  }

  /**
   * Draw wall segments
   */
  function renderWalls(walls) {
    ctx.strokeStyle = COLORS.wallStroke;
    ctx.lineWidth = 3 * scale;
    ctx.lineCap = 'round';

    for (const wall of walls) {
      ctx.beginPath();
      ctx.moveTo(wall.x1 * scale, wall.y1 * scale);
      ctx.lineTo(wall.x2 * scale, wall.y2 * scale);
      ctx.stroke();
    }
  }

  /**
   * Draw pins with metallic appearance
   */
  function renderPins(pins) {
    for (const pin of pins) {
      if (pin.removed) continue;

      const x = pin.x * scale;
      const y = pin.y * scale;
      const length = pin.length * scale;
      const thickness = 6 * scale;

      // Calculate endpoints
      const halfLength = length / 2;
      const cos = Math.cos(pin.angle);
      const sin = Math.sin(pin.angle);
      const x1 = x - halfLength * cos;
      const y1 = y - halfLength * sin;
      const x2 = x + halfLength * cos;
      const y2 = y + halfLength * sin;

      // Pin removal animation
      let alpha = 1;
      let offsetX = 0;
      if (pin.removing) {
        // Slide out and fade
        const progress = pin.removeProgress || 0;
        alpha = 1 - progress;
        offsetX = progress * 30 * scale;
      }

      ctx.globalAlpha = alpha;

      // Draw pin shadow
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = thickness + 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1 + offsetX + 2, y1 + 2);
      ctx.lineTo(x2 + offsetX + 2, y2 + 2);
      ctx.stroke();

      // Draw pin body with gradient
      const gradient = ctx.createLinearGradient(x1, y1 - thickness, x1, y1 + thickness);
      gradient.addColorStop(0, pin.removing ? COLORS.pinRemoving : COLORS.pinHighlight);
      gradient.addColorStop(0.5, pin.removing ? '#FF8888' : COLORS.pin);
      gradient.addColorStop(1, pin.removing ? '#AA4444' : '#808080');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(x1 + offsetX, y1);
      ctx.lineTo(x2 + offsetX, y2);
      ctx.stroke();

      // Draw pin end caps
      ctx.fillStyle = pin.removing ? COLORS.pinRemoving : COLORS.pinHighlight;
      ctx.beginPath();
      ctx.arc(x1 + offsetX, y1, thickness / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x2 + offsetX, y2, thickness / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;

      // Tappable indicator (subtle pulse)
      if (!pin.removing && !pin.removed) {
        const pulse = Math.sin(time * 3) * 0.2 + 0.8;
        ctx.strokeStyle = `rgba(255,255,255,${0.2 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 15 * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /**
   * Draw balls with physics-based rendering
   */
  function renderBalls(balls) {
    for (const ball of balls) {
      if (ball.collected || ball.destroyed) continue;

      const x = ball.x * scale;
      const y = ball.y * scale;
      const r = ball.radius * scale;
      const ballType = BALL_TYPES[ball.type] || BALL_TYPES.gold;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + r + 2, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ball gradient
      const gradient = ctx.createRadialGradient(
        x - r * 0.3, y - r * 0.3, 0,
        x, y, r
      );
      gradient.addColorStop(0, ballType.gradient[0]);
      gradient.addColorStop(0.7, ballType.color);
      gradient.addColorStop(1, ballType.gradient[1]);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Velocity indicator (subtle motion blur)
      const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
      if (speed > 2 && !reducedMotion) {
        const trailLength = Math.min(speed * 2, 20);
        ctx.strokeStyle = `rgba(255,215,0,${Math.min(speed / 20, 0.3)})`;
        ctx.lineWidth = r * 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - ball.vx * scale * trailLength / speed, y - ball.vy * scale * trailLength / speed);
        ctx.stroke();
      }
    }
  }

  /**
   * Draw hazards (lava, spikes) with animation
   */
  function renderHazards(hazards) {
    for (const hazard of hazards) {
      const x = hazard.x * scale;
      const y = hazard.y * scale;
      const w = hazard.width * scale;
      const h = hazard.height * scale;

      if (hazard.type === 'lava') {
        // Animated lava
        const gradient = ctx.createLinearGradient(x, y, x, y + h);
        gradient.addColorStop(0, COLORS.lavaHighlight);
        gradient.addColorStop(1, COLORS.lava);

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, w, h);

        // Animated waves on top
        if (!reducedMotion) {
          ctx.fillStyle = '#FF8800';
          for (let i = 0; i < w; i += 10) {
            const waveY = Math.sin((time * 4 + i * 0.1)) * 3;
            ctx.beginPath();
            ctx.arc(x + i, y + waveY, 4, 0, Math.PI, true);
            ctx.fill();
          }
        }

        // Glow effect
        ctx.shadowColor = COLORS.lava;
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(255,69,0,0.3)';
        ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
        ctx.shadowBlur = 0;

      } else if (hazard.type === 'spikes') {
        // Static spikes
        ctx.fillStyle = '#444';
        const spikeCount = Math.floor(w / 15);
        const spikeWidth = w / spikeCount;

        for (let i = 0; i < spikeCount; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * spikeWidth, y + h);
          ctx.lineTo(x + i * spikeWidth + spikeWidth / 2, y);
          ctx.lineTo(x + (i + 1) * spikeWidth, y + h);
          ctx.fill();
        }
      }
    }
  }

  /**
   * Draw goals with pulsing glow
   */
  function renderGoals(goals) {
    for (const goal of goals) {
      const x = goal.x * scale;
      const y = goal.y * scale;
      const w = goal.width * scale;
      const h = goal.height * scale;

      // Pulsing glow
      const pulse = reducedMotion ? 1 : (Math.sin(time * 3) * 0.2 + 0.8);

      // Outer glow
      ctx.shadowColor = COLORS.goal;
      ctx.shadowBlur = 20 * pulse;

      // Goal zone
      const gradient = ctx.createLinearGradient(x, y, x, y + h);
      gradient.addColorStop(0, COLORS.goalHighlight);
      gradient.addColorStop(1, COLORS.goal);

      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;

      ctx.shadowBlur = 0;

      // Border
      ctx.strokeStyle = COLORS.goal;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Counter
      if (goal.required) {
        ctx.fillStyle = COLORS.text;
        ctx.font = `bold ${12 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          `${goal.collected || 0}/${goal.required}`,
          x + w / 2,
          y + h / 2
        );
      }
    }
  }

  /**
   * Add particle effect
   */
  function addParticle(x, y, type) {
    const count = type === 'collect' ? 8 : 12;
    const color = type === 'collect' ? '#FFD700' : '#FF4500';

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const speed = 2 + Math.random() * 3;
      particles.push({
        x: x * scale,
        y: y * scale,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
        size: 3 + Math.random() * 3
      });
    }
  }

  /**
   * Render and update particles
   */
  function renderParticles() {
    particles = particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // gravity
      p.life -= 0.03;

      if (p.life <= 0) return false;

      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      return true;
    });
  }

  /**
   * Animate pin removal
   */
  function animatePinRemoval(pin, duration = 200) {
    return new Promise(resolve => {
      if (reducedMotion) {
        pin.removeProgress = 1;
        resolve();
        return;
      }

      const startTime = performance.now();

      function animate(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out
        pin.removeProgress = 1 - (1 - progress) * (1 - progress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(animate);
    });
  }

  /**
   * Get pin at position (for tap detection)
   */
  function getPinAtPosition(state, canvasX, canvasY) {
    const x = canvasX / scale;
    const y = canvasY / scale;

    for (const pin of state.pins) {
      if (pin.removed || pin.removing) continue;

      // Check distance to pin center
      const dx = x - pin.x;
      const dy = y - pin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Use a generous hit area
      if (dist < pin.length / 2 + 15) {
        return pin;
      }
    }

    return null;
  }

  /**
   * Set reduced motion preference
   */
  function setReducedMotion(value) {
    reducedMotion = value;
  }

  return {
    resize,
    render,
    clear,
    addParticle,
    animatePinRemoval,
    getPinAtPosition,
    setReducedMotion,
    get width() { return width; },
    get height() { return height; },
    get scale() { return scale; }
  };
}

export default {
  createRenderer,
  BALL_TYPES,
  COLORS
};
