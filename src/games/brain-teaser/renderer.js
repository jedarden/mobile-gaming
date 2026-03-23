/**
 * Brain Teaser - Canvas Renderer (polished)
 *
 * Visual improvements:
 * - Notebook/lined-paper background for doodle-puzzle aesthetic
 * - Handwriting-style font for prompt text
 * - Sketch wobble on element borders (three slightly offset strokes)
 * - Rainbow confetti rain on celebration
 * - Comedic fail reaction: big emoji face + dramatic shake
 */

// Visual constants
const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 600;
const PADDING = 20;

// Handwriting font stack (Comic Sans as fallback for notebook feel)
const HAND_FONT = "'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive";

// Colors — warm cream notebook palette
const COLORS = {
  background: '#fdf6e3',       // warm cream
  notebookLine: 'rgba(100,140,200,0.18)',
  prompt: '#2a2a2a',           // dark ink
  banner: '#ff6b6b',
  bannerText: '#ffffff',
  element: '#4a4a6a',
  elementHover: '#5a5a7a',
  elementActive: '#6a6a8a',
  text: '#ffffff',
  success: '#4ade80',
  error: '#ef4444',
  sparkle: ['#ffd700', '#ff69b4', '#00ffff', '#7cfc00', '#ff6347', '#9b59b6', '#3498db']
};

/** Deterministic wobble offset — creates hand-drawn feel */
function wobble(seed) {
  return ((seed * 7919) % 7 - 3) * 0.7;
}


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

  // Hint target: pulsing gold glow on the hinted element
  let hintTargetId = null;
  let hintRafId = null;
  let lastState = null;
  let lastScale = 1;

  /**
   * Resize canvas to fit container
   */
  function resize(_state) {
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
    lastState = state;
    lastScale = scale;
    clear();

    // Apply shake offset
    ctx.save();
    ctx.translate(shakeOffset.x, shakeOffset.y);

    // Notebook background
    renderNotebook(scale);

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
      const isHinted = element.id === hintTargetId;

      if (!element.hidden || isRevealed) {
        renderElement(element, scale, { isRevealed, isSequenceTarget, isHinted });
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
   * Render lined-paper notebook background
   */
  function renderNotebook(scale) {
    // Cream fill
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Red margin line
    ctx.strokeStyle = 'rgba(220,80,80,0.25)';
    ctx.lineWidth = 1.5 * scale;
    const marginX = 38 * scale;
    ctx.beginPath();
    ctx.moveTo(marginX, 0);
    ctx.lineTo(marginX, height);
    ctx.stroke();

    // Horizontal ruled lines
    ctx.strokeStyle = COLORS.notebookLine;
    ctx.lineWidth = 1 * scale;
    const lineSpacing = 28 * scale;
    const startY = 24 * scale;
    for (let y = startY; y < height; y += lineSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Subtle paper texture: tiny grain dots
    ctx.fillStyle = 'rgba(180,150,80,0.04)';
    for (let i = 0; i < 120; i++) {
      const seed = i * 6271;
      const gx = ((seed * 1009) % 1000) / 1000 * width;
      const gy = ((seed * 2017) % 1000) / 1000 * height;
      ctx.beginPath();
      ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
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
    ctx.font = `bold ${14 * scale}px ${HAND_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Only 1% can solve this! 🤔', width / 2, bannerY + bannerHeight / 2);
  }

  /**
   * Render the prompt text
   */
  function renderPrompt(prompt, scale) {
    const promptY = (state => state.puzzle.showBanner ? 70 : 40) * scale;
    const adjustedY = promptY * scale;

    ctx.fillStyle = COLORS.prompt;
    ctx.font = `bold ${18 * scale}px ${HAND_FONT}`;
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

  // Element sprite renderers — defined here so function declarations above are hoisted
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
   * Render a puzzle element with sketch-style border wobble
   */
  function renderElement(element, scale, options = {}) {
    const { isRevealed, isSequenceTarget, isHinted } = options;
    const x = element.x * scale;
    const y = element.y * scale;
    const w = (element.w || 60) * scale;
    const h = (element.h || 60) * scale;

    const renderer = SPRITE_RENDERERS[element.type] || SPRITE_RENDERERS.rect;
    const seed = (element.id || '').charCodeAt(0) || 1;

    // Pulsing gold glow for hint target
    if (isHinted) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
      ctx.save();
      ctx.shadowColor = `rgba(255, 220, 50, ${0.5 + 0.4 * pulse})`;
      ctx.shadowBlur = (16 + 8 * pulse) * scale;
      ctx.strokeStyle = `rgba(255, 200, 0, ${0.8 + 0.2 * pulse})`;
      ctx.lineWidth = 2.5 * scale;
      ctx.beginPath();
      ctx.roundRect(x - 3 * scale, y - 3 * scale, w + 6 * scale, h + 6 * scale, 8 * scale);
      ctx.stroke();
      ctx.restore();
    }

    // Highlight revealed/target elements
    if (isRevealed || isSequenceTarget) {
      ctx.save();
      ctx.shadowColor = isRevealed ? '#4ade80' : '#ffd700';
      ctx.shadowBlur = 12 * scale;
    }

    renderer(ctx, { ...element, x, y, w, h, scale, isRevealed, isSequenceTarget });

    // Sketch border: 2 slightly offset thin strokes = hand-drawn feel
    if (element.type !== 'text' && element.type !== 'hidden') {
      ctx.strokeStyle = 'rgba(40,30,20,0.25)';
      ctx.lineWidth = 1.5 * scale;
      ctx.setLineDash([]);
      for (let pass = 0; pass < 2; pass++) {
        const ox = wobble(seed + pass * 13) * scale;
        const oy = wobble(seed + pass * 7 + 3) * scale;
        ctx.beginPath();
        ctx.roundRect(x + ox, y + oy, w + ox * 0.3, h + oy * 0.3, 6 * scale);
        ctx.stroke();
      }
    }

    if (isRevealed || isSequenceTarget) ctx.restore();
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

  // Fail emoji overlay alpha
  let failEmojiAlpha = 0;
  let failEmojiScale = 1;

  /**
   * Play shake + comedic fail reaction
   */
  function playShake(targetId, callback) {
    if (reducedMotion) {
      if (callback) callback();
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const duration = 600;
      const startTime = performance.now();
      failEmojiAlpha = 1;
      failEmojiScale = 1.5;

      function animate(time) {
        const elapsed = time - startTime;
        const progress = elapsed / duration;

        if (progress < 1) {
          const intensity = Math.sin(progress * Math.PI * 10) * (1 - progress) * 12;
          shakeOffset.x = intensity;
          shakeOffset.y = Math.sin(progress * Math.PI * 7) * (1 - progress) * 5;
          flashAlpha = progress < 0.15 ? progress / 0.15 * 0.35 : (1 - progress) * 0.1;
          failEmojiAlpha = Math.max(0, 1 - progress * 2);
          failEmojiScale = 1.5 - progress * 0.5;
          animationFrame = requestAnimationFrame(animate);
        } else {
          shakeOffset.x = 0;
          shakeOffset.y = 0;
          flashAlpha = 0;
          failEmojiAlpha = 0;
          if (callback) callback();
          resolve();
        }
      }

      animationFrame = requestAnimationFrame(animate);
    });
  }

  /**
   * Play enhanced celebration — confetti rain from top + burst from center
   */
  function playCelebration(callback) {
    if (reducedMotion) {
      if (callback) callback();
      return Promise.resolve();
    }

    particles = [];
    // Burst from center
    for (let i = 0; i < 35; i++) {
      const angle = (i / 35) * Math.PI * 2;
      const speed = 4 + Math.random() * 10;
      particles.push({
        x: width / 2, y: height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.25,
        w: 6 + Math.random() * 8,
        h: 3 + Math.random() * 5,
        color: COLORS.sparkle[Math.floor(Math.random() * COLORS.sparkle.length)],
        life: 1, decay: 0.012 + Math.random() * 0.01
      });
    }
    // Rain from top
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * width, y: -10 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 3,
        vy: 3 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.18,
        w: 5 + Math.random() * 7,
        h: 3 + Math.random() * 4,
        color: COLORS.sparkle[Math.floor(Math.random() * COLORS.sparkle.length)],
        life: 1, decay: 0.008 + Math.random() * 0.008
      });
    }

    return new Promise(resolve => {
      const duration = 2400;
      const startTime = performance.now();

      function animate(time) {
        const elapsed = time - startTime;
        const progress = elapsed / duration;

        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.18;
          p.vx *= 0.99;
          p.rot += p.rotV;
          p.life -= p.decay;
        });
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
   * Render confetti particles
   */
  function renderParticles(scale) {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      ctx.fillStyle = p.color;
      if (p.w && p.rot !== undefined) {
        // Rectangular confetti
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.w / 2 * scale, -p.h / 2 * scale, p.w * scale, p.h * scale);
      } else {
        // Circle sparkle fallback
        ctx.beginPath();
        ctx.arc(p.x, p.y, (p.size || 4) * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Fail emoji overlay
    if (failEmojiAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = failEmojiAlpha;
      ctx.font = `${80 * scale * failEmojiScale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('😤', width / 2, height / 2);
      ctx.restore();
    }
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
    stopHintLoop();
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
   * Set the hint target element ID. Starts a rAF loop for pulsing animation.
   * Pass null to clear.
   */
  function setHintTarget(id) {
    hintTargetId = id;
    if (id) {
      startHintLoop();
    } else {
      stopHintLoop();
    }
  }

  function startHintLoop() {
    if (hintRafId) return; // already running
    function loop() {
      if (!hintTargetId || !lastState) { hintRafId = null; return; }
      render(lastState, lastScale);
      hintRafId = requestAnimationFrame(loop);
    }
    hintRafId = requestAnimationFrame(loop);
  }

  function stopHintLoop() {
    if (hintRafId) {
      cancelAnimationFrame(hintRafId);
      hintRafId = null;
    }
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
    setHintTarget,
    get scale() { return getScale(); },
    get width() { return width; },
    get height() { return height; }
  };
}

export default { createRenderer };
