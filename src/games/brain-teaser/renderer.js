/**
 * Brain Teaser - Canvas Renderer
 *
 * Renders puzzle elements with:
 * - Sprites and shapes for elements
 * - Prompt text at top
 * - "Only 1% can solve this!" banner (optional)
 * - Decoy failure animations (shake, red flash)
 * - Solution celebration (sparkle particles)
 */

// Visual constants
const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 600;
const PADDING = 20;

// Colors
const COLORS = {
  background: '#1a1a2e',
  prompt: '#ffffff',
  banner: '#ff6b6b',
  bannerText: '#ffffff',
  element: '#4a4a6a',
  elementHover: '#5a5a7a',
  elementActive: '#6a6a8a',
  text: '#ffffff',
  success: '#4ade80',
  error: '#ef4444',
  sparkle: ['#ffd700', '#ff69b4', '#00ffff', '#7cfc00', '#ff6347']
};

// Element sprite renderers
const SPRITE_RENDERERS = {
  circle: renderCircle,
  rect: renderRect,
  triangle: renderTriangle,
  star: renderStar,
  heart: renderHeart,
  diamond: renderDiamond,
  cup: renderCup,
  ball: renderBall,
  box: renderBox,
  key: renderKey,
  door: renderDoor,
  button: renderButton,
  arrow: renderArrow,
  text: renderText,
  image: renderImage,
  hidden: renderHidden
};

/**
 * Create a renderer instance
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = CANVAS_WIDTH;
  let height = CANVAS_HEIGHT;
  let reducedMotion = false;
  let animationFrame = null;
  let particles = [];
  let shakeOffset = { x: 0, y: 0 };
  let flashAlpha = 0;

  /**
   * Resize canvas to fit container
   */
  function resize(state) {
    const container = canvas.parentElement;
    if (!container) return { width, height, scale: 1 };

    const containerRect = container.getBoundingClientRect();
    const scale = Math.min(
      containerRect.width / CANVAS_WIDTH,
      containerRect.height / CANVAS_HEIGHT,
      1
    );

    width = CANVAS_WIDTH * scale;
    height = CANVAS_HEIGHT * scale;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    return { width, height, scale };
  }

  /**
   * Get scale factor
   */
  function getScale() {
    return width / CANVAS_WIDTH;
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
  function render(state, scale = 1) {
    clear();

    // Apply shake offset
    ctx.save();
    ctx.translate(shakeOffset.x, shakeOffset.y);

    // Background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Banner (optional)
    if (state.puzzle.showBanner) {
      renderBanner(scale);
    }

    // Prompt text
    renderPrompt(state.puzzle.prompt, scale);

    // Elements (sorted by zIndex)
    const sortedElements = [...state.puzzle.elements].sort((a, b) =>
      (a.zIndex || 0) - (b.zIndex || 0)
    );

    sortedElements.forEach(element => {
      const isRevealed = state.revealedElements.includes(element.id);
      const isSequenceTarget = state.currentSequence &&
        state.puzzle.type === 'sequence' &&
        state.currentSequence.includes(element.id);

      if (!element.hidden || isRevealed) {
        renderElement(element, scale, { isRevealed, isSequenceTarget });
      }
    });

    // Red flash overlay
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${flashAlpha})`;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();

    // Particles (celebration)
    renderParticles(scale);
  }

  /**
   * Render the "Only 1% can solve this!" banner
   */
  function renderBanner(scale) {
    const bannerY = 20 * scale;
    const bannerHeight = 30 * scale;

    ctx.fillStyle = COLORS.banner;
    ctx.fillRect(0, bannerY, width, bannerHeight);

    ctx.fillStyle = COLORS.bannerText;
    ctx.font = `bold ${14 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Only 1% can solve this!', width / 2, bannerY + bannerHeight / 2);
  }

  /**
   * Render the prompt text
   */
  function renderPrompt(prompt, scale) {
    const promptY = (state => state.puzzle.showBanner ? 70 : 40) * scale;
    const adjustedY = promptY * scale;

    ctx.fillStyle = COLORS.prompt;
    ctx.font = `bold ${18 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Word wrap
    const maxWidth = width - PADDING * 2 * scale;
    const words = prompt.split(' ');
    let lines = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);

    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, adjustedY + i * 24 * scale);
    });
  }

  /**
   * Render a puzzle element
   */
  function renderElement(element, scale, options = {}) {
    const { isRevealed, isSequenceTarget } = options;
    const x = element.x * scale;
    const y = element.y * scale;
    const w = (element.w || 60) * scale;
    const h = (element.h || 60) * scale;

    const renderer = SPRITE_RENDERERS[element.type] || SPRITE_RENDERERS.rect;
    renderer(ctx, { ...element, x, y, w, h, scale, isRevealed, isSequenceTarget });
  }

  /**
   * Render circle element
   */
  function renderCircle(ctx, el) {
    const radius = (el.w || 60) / 2 * el.scale;

    ctx.fillStyle = el.color || COLORS.element;
    ctx.beginPath();
    ctx.arc(el.x + radius, el.y + radius, radius, 0, Math.PI * 2);
    ctx.fill();

    if (el.label) {
      ctx.fillStyle = el.textColor || COLORS.text;
      ctx.font = `bold ${14 * el.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.label, el.x + radius, el.y + radius);
    }
  }

  /**
   * Render rectangle element
   */
  function renderRect(ctx, el) {
    ctx.fillStyle = el.color || COLORS.element;
    ctx.fillRect(el.x, el.y, el.w, el.h);

    if (el.label) {
      ctx.fillStyle = el.textColor || COLORS.text;
      ctx.font = `bold ${14 * el.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.label, el.x + el.w / 2, el.y + el.h / 2);
    }
  }

  /**
   * Render triangle element
   */
  function renderTriangle(ctx, el) {
    ctx.fillStyle = el.color || COLORS.element;
    ctx.beginPath();
    ctx.moveTo(el.x + el.w / 2, el.y);
    ctx.lineTo(el.x + el.w, el.y + el.h);
    ctx.lineTo(el.x, el.y + el.h);
    ctx.closePath();
    ctx.fill();

    if (el.label) {
      ctx.fillStyle = el.textColor || COLORS.text;
      ctx.font = `bold ${12 * el.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.label, el.x + el.w / 2, el.y + el.h * 0.65);
    }
  }

  /**
   * Render star element
   */
  function renderStar(ctx, el) {
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const outerRadius = Math.min(el.w, el.h) / 2;
    const innerRadius = outerRadius * 0.4;
    const points = 5;

    ctx.fillStyle = el.color || '#ffd700';
    ctx.beginPath();

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fill();
  }

  /**
   * Render heart element
   */
  function renderHeart(ctx, el) {
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const size = Math.min(el.w, el.h) / 2;

    ctx.fillStyle = el.color || '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.3);

    // Left curve
    ctx.bezierCurveTo(
      cx - size, cy - size * 0.5,
      cx - size, cy + size * 0.5,
      cx, cy + size
    );

    // Right curve
    ctx.bezierCurveTo(
      cx + size, cy + size * 0.5,
      cx + size, cy - size * 0.5,
      cx, cy + size * 0.3
    );

    ctx.fill();
  }

  /**
   * Render diamond element
   */
  function renderDiamond(ctx, el) {
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;

    ctx.fillStyle = el.color || '#9333ea';
    ctx.beginPath();
    ctx.moveTo(cx, el.y);
    ctx.lineTo(el.x + el.w, cy);
    ctx.lineTo(cx, el.y + el.h);
    ctx.lineTo(el.x, cy);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Render cup element (shell game style)
   */
  function renderCup(ctx, el) {
    const cupWidth = el.w;
    const cupHeight = el.h;

    ctx.fillStyle = el.color || '#8b4513';
    ctx.beginPath();
    ctx.moveTo(el.x + 5, el.y);
    ctx.lineTo(el.x + cupWidth - 5, el.y);
    ctx.lineTo(el.x + cupWidth, el.y + cupHeight);
    ctx.lineTo(el.x, el.y + cupHeight);
    ctx.closePath();
    ctx.fill();

    // Cup rim
    ctx.fillStyle = el.rimColor || '#a0522d';
    ctx.fillRect(el.x, el.y, cupWidth, 8 * el.scale);
  }

  /**
   * Render ball element
   */
  function renderBall(ctx, el) {
    const radius = (el.w || 30) / 2 * el.scale;

    ctx.fillStyle = el.color || '#ff0000';
    ctx.beginPath();
    ctx.arc(el.x + radius, el.y + radius, radius, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(el.x + radius * 0.7, el.y + radius * 0.7, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Render box element
   */
  function renderBox(ctx, el) {
    ctx.fillStyle = el.color || '#8b4513';
    ctx.fillRect(el.x, el.y, el.w, el.h);

    // Box lid line
    ctx.strokeStyle = el.lidColor || '#a0522d';
    ctx.lineWidth = 3 * el.scale;
    ctx.beginPath();
    ctx.moveTo(el.x, el.y + el.h * 0.3);
    ctx.lineTo(el.x + el.w, el.y + el.h * 0.3);
    ctx.stroke();

    // Cross lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 2 * el.scale;
    ctx.beginPath();
    ctx.moveTo(el.x, el.y);
    ctx.lineTo(el.x + el.w, el.y + el.h);
    ctx.moveTo(el.x + el.w, el.y);
    ctx.lineTo(el.x, el.y + el.h);
    ctx.stroke();
  }

  /**
   * Render key element
   */
  function renderKey(ctx, el) {
    const keySize = Math.min(el.w, el.h) * 0.8;
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;

    ctx.fillStyle = el.color || '#ffd700';
    ctx.strokeStyle = el.color || '#ffd700';
    ctx.lineWidth = 4 * el.scale;

    // Key head (circle)
    ctx.beginPath();
    ctx.arc(cx - keySize * 0.3, cy, keySize * 0.25, 0, Math.PI * 2);
    ctx.stroke();

    // Key shaft
    ctx.beginPath();
    ctx.moveTo(cx - keySize * 0.05, cy);
    ctx.lineTo(cx + keySize * 0.4, cy);
    ctx.stroke();

    // Key teeth
    ctx.beginPath();
    ctx.moveTo(cx + keySize * 0.2, cy);
    ctx.lineTo(cx + keySize * 0.2, cy + keySize * 0.15);
    ctx.moveTo(cx + keySize * 0.35, cy);
    ctx.lineTo(cx + keySize * 0.35, cy + keySize * 0.1);
    ctx.stroke();
  }

  /**
   * Render door element
   */
  function renderDoor(ctx, el) {
    ctx.fillStyle = el.color || '#4a3728';
    ctx.fillRect(el.x, el.y, el.w, el.h);

    // Door frame
    ctx.strokeStyle = '#2a1708';
    ctx.lineWidth = 3 * el.scale;
    ctx.strokeRect(el.x, el.y, el.w, el.h);

    // Door knob
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(el.x + el.w * 0.8, el.y + el.h * 0.5, 5 * el.scale, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Render button element
   */
  function renderButton(ctx, el) {
    const radius = Math.min(el.w, el.h) / 2;

    // Button shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(el.x + el.w / 2, el.y + el.h / 2 + 3 * el.scale, radius, 0, Math.PI * 2);
    ctx.fill();

    // Button body
    ctx.fillStyle = el.color || '#ef4444';
    ctx.beginPath();
    ctx.arc(el.x + el.w / 2, el.y + el.h / 2, radius, 0, Math.PI * 2);
    ctx.fill();

    // Button highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(el.x + el.w / 2 - radius * 0.3, el.y + el.h / 2 - radius * 0.3, radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Render arrow element
   */
  function renderArrow(ctx, el) {
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const size = Math.min(el.w, el.h) * 0.4;

    ctx.fillStyle = el.color || '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - size, cy - size);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx - size, cy + size);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Render text element
   */
  function renderText(ctx, el) {
    ctx.fillStyle = el.color || COLORS.text;
    ctx.font = `${el.fontSize || 16}px sans-serif`;
    ctx.textAlign = el.textAlign || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.text || el.label || '', el.x, el.y);
  }

  /**
   * Render image placeholder (for sprite-based elements)
   */
  function renderImage(ctx, el) {
    // For now, render as a colored rect with label
    ctx.fillStyle = el.color || COLORS.element;
    ctx.fillRect(el.x, el.y, el.w, el.h);

    if (el.sprite) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = `${10 * el.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.sprite, el.x + el.w / 2, el.y + el.h / 2);
    }
  }

  /**
   * Render hidden element (placeholder)
   */
  function renderHidden(ctx, el) {
    // Render a subtle placeholder or nothing
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(el.x, el.y, el.w, el.h);
  }

  /**
   * Play shake animation
   */
  function playShake(targetId, callback) {
    if (reducedMotion) {
      if (callback) callback();
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const duration = 400;
      const startTime = performance.now();

      function animate(time) {
        const elapsed = time - startTime;
        const progress = elapsed / duration;

        if (progress < 1) {
          // Shake effect
          const intensity = Math.sin(progress * Math.PI * 8) * (1 - progress) * 10;
          shakeOffset.x = intensity;
          flashAlpha = (1 - progress) * 0.3;
          animationFrame = requestAnimationFrame(animate);
        } else {
          shakeOffset.x = 0;
          shakeOffset.y = 0;
          flashAlpha = 0;
          if (callback) callback();
          resolve();
        }
      }

      animationFrame = requestAnimationFrame(animate);
    });
  }

  /**
   * Play celebration animation
   */
  function playCelebration(callback) {
    if (reducedMotion) {
      if (callback) callback();
      return Promise.resolve();
    }

    // Create particles
    particles = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: width / 2,
        y: height / 2,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15 - 5,
        size: Math.random() * 8 + 4,
        color: COLORS.sparkle[Math.floor(Math.random() * COLORS.sparkle.length)],
        life: 1,
        decay: 0.01 + Math.random() * 0.02
      });
    }

    return new Promise(resolve => {
      const duration = 2000;
      const startTime = performance.now();

      function animate(time) {
        const elapsed = time - startTime;
        const progress = elapsed / duration;

        // Update particles
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.3; // gravity
          p.life -= p.decay;
        });

        // Remove dead particles
        particles = particles.filter(p => p.life > 0);

        if (progress < 1 && particles.length > 0) {
          animationFrame = requestAnimationFrame(animate);
        } else {
          particles = [];
          if (callback) callback();
          resolve();
        }
      }

      animationFrame = requestAnimationFrame(animate);
    });
  }

  /**
   * Render particles
   */
  function renderParticles(scale) {
    particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * scale, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  /**
   * Play animation based on type
   */
  function playAnimation(animation, callback) {
    if (!animation) {
      if (callback) callback();
      return Promise.resolve();
    }

    switch (animation.type) {
      case 'shake':
        return playShake(animation.target, callback);
      case 'flash':
        flashAlpha = 0.5;
        setTimeout(() => { flashAlpha = 0; }, 200);
        if (callback) callback();
        return Promise.resolve();
      case 'celebration':
        return playCelebration(callback);
      default:
        if (callback) callback();
        return Promise.resolve();
    }
  }

  /**
   * Stop current animation
   */
  function stopAnimation() {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    shakeOffset = { x: 0, y: 0 };
    flashAlpha = 0;
    particles = [];
  }

  /**
   * Convert canvas coordinates to element hit test
   */
  function hitTest(canvasX, canvasY, element, scale) {
    const x = element.x * scale;
    const y = element.y * scale;
    const w = (element.w || 60) * scale;
    const h = (element.h || 60) * scale;

    return canvasX >= x && canvasX <= x + w &&
           canvasY >= y && canvasY <= y + h;
  }

  /**
   * Find element at canvas position
   */
  function getElementAt(canvasX, canvasY, elements, scale) {
    // Check in reverse order (top elements first)
    const sorted = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

    for (const element of sorted) {
      if (!element.hidden && hitTest(canvasX, canvasY, element, scale)) {
        return element;
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
    playShake,
    playCelebration,
    playAnimation,
    stopAnimation,
    hitTest,
    getElementAt,
    setReducedMotion,
    get scale() { return getScale(); },
    get width() { return width; },
    get height() { return height; }
  };
}

export default { createRenderer };
