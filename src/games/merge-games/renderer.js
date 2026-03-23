/**
 * Merge Games - Canvas Renderer (polished)
 *
 * Visual improvements:
 * - Vibrant tier color palette with warm/cool progression
 * - Drag float: shadow, slight rotation, scale-up
 * - Merge burst: particle explosion + elastic scale pop
 * - Tier glow aura for high-tier items
 * - Grid background gradient
 * - Matching-tier cell highlight pulse
 */

// Curated tier palette: pastels → vibrant → warm
const TIER_COLORS = [
  '',           // 0 — empty
  '#A8DADC',   // 1 — cool sky
  '#45B7D1',   // 2 — vivid teal
  '#4ECDC4',   // 3 — mint
  '#FFE66D',   // 4 — golden yellow
  '#FF6B6B',   // 5 — coral red
  '#C678DD'    // 6 — vibrant purple
];
const TIER_LABELS = ['', '1', '2', '3', '4', '5', '6'];
const CELL_GAP = 6;
const CELL_RADIUS = 12;
const CELL_BG = 'rgba(255,255,255,0.07)';

function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let cellSize = 60;
  let offsetX = 0;
  let offsetY = 0;
  let reducedMotion = false;
  // Hint cells: highlighted pair to merge
  let hintCells = null; // null or { r1, c1, r2, c2 }

  // Merge burst particles: { x, y, vx, vy, color, life, r }
  const particles = [];

  // Scale pops: { r, c, startTime, scale }
  const scalePops = new Map();

  // Last rendered state — needed for the particle animation loop
  let lastState = null;
  let loopId = null;

  function now() { return performance.now(); }

  /** Run a rAF loop while particles or scale pops are active */
  function startLoop() {
    if (loopId || reducedMotion) return;
    function loop() {
      const active = particles.length > 0 || scalePops.size > 0 || hintCells !== null;
      if (!active || !lastState) { loopId = null; return; }
      render(lastState, null);
      loopId = requestAnimationFrame(loop);
    }
    loopId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (loopId) { cancelAnimationFrame(loopId); loopId = null; }
  }

  function resize(state) {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const cols = state.width;
    const rows = state.height;
    const avail = Math.min(rect.width, rect.height) - 32;
    cellSize = Math.floor((avail - CELL_GAP * (Math.max(cols, rows) - 1)) / Math.max(cols, rows));
    const gridW = cols * cellSize + (cols - 1) * CELL_GAP;
    const gridH = rows * cellSize + (rows - 1) * CELL_GAP;
    offsetX = (rect.width - gridW) / 2;
    offsetY = (rect.height - gridH) / 2;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cellRect(r, c) {
    return {
      x: offsetX + c * (cellSize + CELL_GAP),
      y: offsetY + r * (cellSize + CELL_GAP),
      w: cellSize,
      h: cellSize
    };
  }

  /** Spawn merge particle burst at cell center */
  function spawnMergeBurst(r, c, tier) {
    if (reducedMotion) return;
    const { x, y, w, h } = cellRect(r, c);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const color = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)] || '#fff';
    for (let i = 0; i < 12 + tier * 3; i++) {
      const angle = (i / (12 + tier * 3)) * Math.PI * 2;
      const speed = 2 + Math.random() * (2 + tier);
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color, life: 1,
        r: 2 + Math.random() * 3,
        decay: 0.025 + Math.random() * 0.02
      });
    }
    scalePops.set(`${r},${c}`, { startTime: now(), tier });
    startLoop();
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.vy += 0.08;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawCell(r, c, tier, highlight, dragging, isHinted) {
    const { x, y, w, h } = cellRect(r, c);

    // Scale pop from merge
    const popKey = `${r},${c}`;
    const pop = scalePops.get(popKey);
    let scale = 1;
    if (pop) {
      const elapsed = (now() - pop.startTime) / 420;
      if (elapsed < 1) {
        scale = 1 + 0.2 * easeOutElastic(elapsed);
      } else {
        scalePops.delete(popKey);
      }
    }

    if (tier === 0) {
      ctx.fillStyle = CELL_BG;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, CELL_RADIUS);
      ctx.fill();
      return;
    }

    const color = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)] || '#888';
    const alpha = dragging ? 0.25 : 1;

    // Hint glow for suggested merge cells
    if (isHinted) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
      ctx.save();
      ctx.shadowColor = `rgba(255, 220, 50, ${0.5 + 0.4 * pulse})`;
      ctx.shadowBlur = 16 + 6 * pulse;
      ctx.strokeStyle = `rgba(255, 200, 0, ${0.8 + 0.2 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x - 2, y - 2, w + 4, h + 4, CELL_RADIUS + 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    if (scale !== 1) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }

    ctx.globalAlpha = alpha;

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    // Tier glow for higher tiers
    if (tier >= 4) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14 + (tier - 4) * 6;
      ctx.shadowOffsetY = 0;
    }

    // Body gradient
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, lighten(color, 20));
    grad.addColorStop(1, darken(color, 10));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, CELL_RADIUS);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Highlight ring when matching drag target
    if (highlight) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, w - 2, h - 2, CELL_RADIUS);
      ctx.stroke();
    }

    // Top sheen
    const sheen = ctx.createLinearGradient(x, y, x, y + h * 0.5);
    sheen.addColorStop(0, 'rgba(255,255,255,0.3)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h * 0.45, [CELL_RADIUS - 2, CELL_RADIUS - 2, 0, 0]);
    ctx.fill();

    // Tier label
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 3;
    ctx.font = `bold ${Math.round(cellSize * 0.40)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(TIER_LABELS[Math.min(tier, TIER_LABELS.length - 1)], x + w / 2, y + h / 2);
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function render(state, drag) {
    lastState = state;
    updateParticles();

    const cw = parseInt(canvas.style.width);
    const ch = parseInt(canvas.style.height);

    // Grid background gradient
    const bg = ctx.createLinearGradient(0, 0, cw, ch);
    bg.addColorStop(0, '#16213e');
    bg.addColorStop(1, '#0f3460');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);

    for (let r = 0; r < state.height; r++) {
      for (let c = 0; c < state.width; c++) {
        const tier = state.grid[r][c];
        const isDragging = drag && drag.fromR === r && drag.fromC === c;
        const isHighlight = drag && tier !== 0 && tier === state.grid[drag.fromR]?.[drag.fromC] && !(r === drag.fromR && c === drag.fromC);
        const isHinted = hintCells !== null && tier !== 0 && (
          (r === hintCells.r1 && c === hintCells.c1) ||
          (r === hintCells.r2 && c === hintCells.c2)
        );
        drawCell(r, c, tier, isHighlight, isDragging, isHinted);
      }
    }

    // Draw particles
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Dragged item floating (elevated with shadow + rotation)
    if (drag && drag.tier > 0) {
      const half = cellSize / 2;
      const color = TIER_COLORS[Math.min(drag.tier, TIER_COLORS.length - 1)] || '#888';
      ctx.save();
      ctx.translate(drag.px, drag.py);
      ctx.rotate(0.04);
      ctx.scale(1.08, 1.08);
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;

      const grad = ctx.createLinearGradient(-half, -half, -half, half);
      grad.addColorStop(0, lighten(color, 20));
      grad.addColorStop(1, darken(color, 10));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(-half, -half, cellSize, cellSize, CELL_RADIUS);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'white';
      ctx.font = `bold ${Math.round(cellSize * 0.38)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TIER_LABELS[Math.min(drag.tier, TIER_LABELS.length - 1)], 0, 0);
      ctx.restore();
    }

    // Win tint
    if (state.status === 'won') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, cw, ch);
    }
  }

  function canvasToCell(px, py) {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const { x, y, w, h } = cellRect(r, c);
        if (px >= x && px <= x + w && py >= y && py <= y + h) return { r, c };
      }
    }
    return null;
  }

  function setReducedMotion(v) { reducedMotion = v; }

  function setHintCells(r1, c1, r2, c2) {
    hintCells = (r1 === null) ? null : { r1, c1, r2, c2 };
    if (hintCells) startLoop(); else stopLoop();
  }

  return { resize, render, canvasToCell, cellRect, spawnMergeBurst, setReducedMotion, setHintCells, stopLoop, getCellSize: () => cellSize };
}

function lighten(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16);
  const a = Math.round(2.55 * pct);
  return `#${[
    Math.min(255, (n >> 16) + a),
    Math.min(255, ((n >> 8) & 0xff) + a),
    Math.min(255, (n & 0xff) + a)
  ].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function darken(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16);
  const a = Math.round(2.55 * pct);
  return `#${[
    Math.max(0, (n >> 16) - a),
    Math.max(0, ((n >> 8) & 0xff) - a),
    Math.max(0, (n & 0xff) - a)
  ].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

export default { createRenderer };
