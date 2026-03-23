/**
 * Satisfying ASMR - Canvas Renderer (polished)
 *
 * Visual improvements:
 * - Textured surface with subtle grain noise
 * - Hidden color-reveal layer exposed as dirt is cleaned
 * - Dirt has earthy texture variation
 * - Debris particles fly off on each erase stroke
 * - Completion sparkle burst when fully cleaned
 * - Smooth internal RAF loop for particle animations
 */

const SURFACE_COLOR = '#f0e6d2';
const DIRT_BASE = '#5a3e2b';

// Color reveal patterns (pastel rainbow under the dirt)
const REVEAL_PALETTES = {
  full:         ['#FFD6E0', '#FFEAA7', '#A8EDEA', '#FEA3AA', '#B8F0B8'],
  splatter:     ['#C3B1E1', '#FFD700', '#87CEEB', '#FF8C69', '#90EE90'],
  stripes:      ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8DADC', '#FF9A9E'],
  checkerboard: ['#F8A5C2', '#6FC5D3', '#FCEA7C', '#B8E6B8', '#FFBFA0']
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let cellSize = 20;
  let canvasW = 300;
  let canvasH = 300;
  let gridW = 16;
  let gridH = 16;
  let currentPatternType = 'full';

  // Offscreen canvases
  let dirtCanvas = null;
  let dirtCtx = null;
  let revealCanvas = null;   // color reveal layer (static)
  let grainCanvas = null;    // grain texture (static)

  // Particles: { x, y, vx, vy, life, r, color }
  const particles = [];

  // Sparkle: { x, y, angle, speed, life, r, color }
  const sparkles = [];

  let rafId = null;
  let lastState = null;

  function now() { return performance.now(); }

  // ── Internal animation loop (runs while particles/sparkles are alive) ─────
  function startLoop() {
    if (rafId) return;
    function tick() {
      updateParticles();
      if (lastState) renderFrame(lastState);
      if (particles.length > 0 || sparkles.length > 0) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.vx *= 0.92;
      p.life -= 0.04;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.x += Math.cos(s.angle) * s.speed;
      s.y += Math.sin(s.angle) * s.speed;
      s.speed *= 0.96;
      s.life -= 0.022;
      if (s.life <= 0) sparkles.splice(i, 1);
    }
  }

  // ── Grain texture canvas (pre-rendered noise) ──────────────────────────────
  function buildGrainCanvas(w, h) {
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = w;
    grainCanvas.height = h;
    const gCtx = grainCanvas.getContext('2d');
    const id = gCtx.createImageData(w, h);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = (Math.random() * 40) | 0;
      id.data[i] = v;
      id.data[i + 1] = v;
      id.data[i + 2] = v;
      id.data[i + 3] = Math.random() < 0.35 ? 18 : 0;
    }
    gCtx.putImageData(id, 0, 0);
  }

  // ── Color reveal canvas (hidden colors under the dirt) ────────────────────
  function buildRevealCanvas(w, h, patternType) {
    revealCanvas = document.createElement('canvas');
    revealCanvas.width = w * cellSize;
    revealCanvas.height = h * cellSize;
    const rCtx = revealCanvas.getContext('2d');

    const palette = REVEAL_PALETTES[patternType] || REVEAL_PALETTES.full;

    if (patternType === 'stripes') {
      const stripeW = Math.ceil((w * cellSize) / palette.length);
      palette.forEach((col, i) => {
        rCtx.fillStyle = col;
        rCtx.fillRect(i * stripeW, 0, stripeW, h * cellSize);
      });
    } else if (patternType === 'checkerboard') {
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          rCtx.fillStyle = palette[(r + c) % palette.length];
          rCtx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    } else {
      // Radial blob pattern (splatter / full)
      rCtx.fillStyle = SURFACE_COLOR;
      rCtx.fillRect(0, 0, w * cellSize, h * cellSize);
      const cx = (w * cellSize) / 2;
      const cy = (h * cellSize) / 2;
      const blobCount = patternType === 'full' ? 3 : 7;
      for (let b = 0; b < blobCount; b++) {
        const bx = cx + (Math.sin(b * 1.3) * 0.4) * w * cellSize;
        const by = cy + (Math.cos(b * 0.9) * 0.4) * h * cellSize;
        const br = (Math.min(w, h) * cellSize) / (patternType === 'full' ? 1.5 : 2.5);
        const grad = rCtx.createRadialGradient(bx, by, 0, bx, by, br);
        grad.addColorStop(0, palette[b % palette.length] + 'ee');
        grad.addColorStop(1, palette[b % palette.length] + '00');
        rCtx.fillStyle = grad;
        rCtx.fillRect(0, 0, w * cellSize, h * cellSize);
      }
    }

    // Subtle sheen overlay
    const sheen = rCtx.createLinearGradient(0, 0, 0, h * cellSize);
    sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.06)');
    rCtx.fillStyle = sheen;
    rCtx.fillRect(0, 0, w * cellSize, h * cellSize);
  }

  function resize(state) {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    gridW = state.width;
    gridH = state.height;
    currentPatternType = state.patternType || 'full';

    const availW = rect.width - 8;
    const availH = rect.height - 8;
    const csW = Math.floor(availW / gridW);
    const csH = Math.floor(availH / gridH);
    cellSize = Math.max(4, Math.min(csW, csH));

    canvasW = cellSize * gridW;
    canvasH = cellSize * gridH;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Rebuild dirt canvas
    dirtCanvas = document.createElement('canvas');
    dirtCanvas.width = canvasW * dpr;
    dirtCanvas.height = canvasH * dpr;
    dirtCtx = dirtCanvas.getContext('2d');
    dirtCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildRevealCanvas(gridW, gridH, currentPatternType);
    buildGrainCanvas(canvasW, canvasH);
  }

  function buildDirtLayer(cells, w, h) {
    if (!dirtCtx) return;
    dirtCtx.clearRect(0, 0, canvasW, canvasH);

    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]) continue;
      const c = i % w;
      const r = Math.floor(i / w);
      const x = c * cellSize;
      const y = r * cellSize;

      // Base dirt with subtle value variation (seeded by position)
      const seed = (c * 17 + r * 31) & 0xFF;
      const v = 40 + seed % 30;
      const br = 30 + seed % 15;
      dirtCtx.fillStyle = `rgb(${v + 50},${v},${br})`;
      dirtCtx.fillRect(x, y, cellSize, cellSize);
    }

    // Grain overlay on dirt
    if (grainCanvas) {
      dirtCtx.globalAlpha = 0.5;
      dirtCtx.drawImage(grainCanvas, 0, 0);
      dirtCtx.globalAlpha = 1;
    }
  }

  function renderFrame(state) {
    if (!dirtCanvas) return;
    ctx.clearRect(0, 0, canvasW, canvasH);

    // 1. Color reveal layer (clean surface with hidden colors)
    if (revealCanvas) {
      ctx.drawImage(revealCanvas, 0, 0, canvasW, canvasH);
    } else {
      ctx.fillStyle = SURFACE_COLOR;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // 2. Grain on clean surface
    if (grainCanvas) {
      ctx.globalAlpha = 0.18;
      ctx.drawImage(grainCanvas, 0, 0);
      ctx.globalAlpha = 1;
    }

    // 3. Dirt overlay
    ctx.drawImage(dirtCanvas, 0, 0, canvasW, canvasH, 0, 0, canvasW, canvasH);

    // 4. Particles (debris)
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life * 0.85;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Sparkles (completion)
    for (const s of sparkles) {
      ctx.save();
      ctx.globalAlpha = s.life;
      ctx.fillStyle = s.color;
      ctx.translate(s.x, s.y);
      ctx.rotate(s.life * Math.PI * 2);
      const sr = s.r * s.life;
      ctx.fillRect(-sr, -sr * 0.25, sr * 2, sr * 0.5);
      ctx.fillRect(-sr * 0.25, -sr, sr * 0.5, sr * 2);
      ctx.restore();
    }

    // 6. Win tint
    if (state.status === 'won') {
      ctx.fillStyle = 'rgba(180,255,200,0.18)';
      ctx.fillRect(0, 0, canvasW, canvasH);
    }
  }

  function render(state) {
    lastState = state;
    renderFrame(state);
  }

  /**
   * Erase dirt cells — updates dirtCanvas in-place.
   */
  function eraseArea(cells, cx, cy, radius, w) {
    if (!dirtCtx) return;
    const r = Math.ceil(radius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const gc = cx + dx;
        const gr = cy + dy;
        if (gc < 0 || gc >= w || gr < 0 || gr >= gridH) continue;
        const idx = gr * w + gc;
        if (cells[idx] === 0) {
          dirtCtx.clearRect(gc * cellSize, gr * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  /**
   * Spawn debris crumbs at the given pixel position (called from game.js on each spray).
   */
  function spawnDebris(px, py) {
    const dirtColors = ['#6e4c32', '#8b6045', '#5a3e2b', '#7a5235', '#4a3020'];
    const count = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 2.5;
      particles.push({
        x: px + (Math.random() - 0.5) * cellSize,
        y: py + (Math.random() - 0.5) * cellSize,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 0.7 + Math.random() * 0.4,
        r: 1.5 + Math.random() * 2,
        color: dirtColors[Math.floor(Math.random() * dirtColors.length)]
      });
    }
    startLoop();
  }

  /**
   * Trigger completion sparkle burst (called from game.js on win).
   */
  function triggerCompletionSparkle() {
    const colors = ['#FFD700', '#FF69B4', '#00FFFF', '#ADFF2F', '#FF6347', '#DDA0DD', '#FFE66D'];
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    // Central burst
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 1 + Math.random() * 4;
      sparkles.push({
        x: cx + (Math.random() - 0.5) * canvasW * 0.6,
        y: cy + (Math.random() - 0.5) * canvasH * 0.6,
        angle,
        speed,
        life: 0.6 + Math.random() * 0.5,
        r: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    startLoop();
  }

  /**
   * Convert canvas pixel coordinates to grid cell coords.
   */
  function pixelToGrid(px, py) {
    return {
      gc: Math.floor(px / cellSize),
      gr: Math.floor(py / cellSize)
    };
  }

  return {
    resize,
    render,
    buildDirtLayer,
    eraseArea,
    pixelToGrid,
    getCellSize: () => cellSize,
    spawnDebris,
    triggerCompletionSparkle
  };
}

export default { createRenderer };
