/**
 * Parking Escape - Canvas Renderer (polished)
 *
 * Visual improvements:
 * - Asphalt texture with painted parking-space markings
 * - Toy-car 3D shading (top face highlight + right/bottom shadow face)
 * - Selection lift: expanded drop-shadow when vehicle is selected
 * - Smooth slide animation with ease-out-back bounce
 * - Exit particle burst when hero car exits
 * - Screen shake on blocked drag
 */

const PADDING = 16;
const EXIT_COLOR = '#FFD700';
const HERO_COLOR = '#E74C3C';
const HERO_GLOW = 'rgba(231,76,60,0.5)';
const ANIM_DURATION = 180; // ms per cell slide

// Ease out back
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let cellSize = 60;
  let offsetX = PADDING;
  let offsetY = PADDING;
  let reducedMotion = false;

  // Animation: per-vehicle slide { fromX, fromY, toX, toY, startTime, cells }
  const slideAnims = new Map();

  // Shake state
  let shakeUntil = 0;
  let shakeAmplitude = 4;

  // Exit particles
  const exitParticles = [];

  // Cached asphalt gradient/pattern
  let asphaltGrad = null;
  let lastCellSize = 0;

  function setReducedMotion(v) { reducedMotion = v; }

  function resize(state) {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const avail = Math.min(rect.width, rect.height) - PADDING * 2;
    cellSize = Math.floor(avail / state.grid.width);
    const gridPx = cellSize * state.grid.width;
    offsetX = (rect.width - gridPx) / 2;
    offsetY = (rect.height - gridPx) / 2;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Invalidate cached gradient
    if (cellSize !== lastCellSize) { asphaltGrad = null; lastCellSize = cellSize; }
  }

  function gridToCanvas(col, row) {
    return { x: offsetX + col * cellSize, y: offsetY + row * cellSize };
  }

  function canvasToGrid(px, py) {
    return {
      col: Math.floor((px - offsetX) / cellSize),
      row: Math.floor((py - offsetY) / cellSize)
    };
  }

  /** Build asphalt radial gradient (cached) */
  function getAsphaltGrad(w, h) {
    if (asphaltGrad) return asphaltGrad;
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, '#383838');
    g.addColorStop(0.6, '#2a2a2a');
    g.addColorStop(1, '#1e1e1e');
    asphaltGrad = g;
    return g;
  }

  /** Draw asphalt with parking-space marking lines */
  function drawGrid(state) {
    const gw = state.grid.width;
    const gh = state.grid.height;
    const gridPxW = gw * cellSize;
    const gridPxH = gh * cellSize;

    // Outer border
    ctx.beginPath();
    ctx.roundRect(offsetX - 2, offsetY - 2, gridPxW + 4, gridPxH + 4, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Asphalt fill
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(offsetX, offsetY, gridPxW, gridPxH, 8);
    ctx.clip();
    ctx.fillStyle = getAsphaltGrad(gridPxW, gridPxH);
    // Offset gradient to grid coords
    ctx.translate(offsetX, offsetY);
    ctx.fillRect(0, 0, gridPxW, gridPxH);
    ctx.translate(-offsetX, -offsetY);

    // Subtle asphalt grain dots
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let c = 0; c < gw; c++) {
      for (let r = 0; r < gh; r++) {
        // deterministic "random" spots per cell
        const seed = c * 37 + r * 17;
        const sx = offsetX + c * cellSize + (seed % 23) / 23 * cellSize;
        const sy = offsetY + r * cellSize + ((seed * 13) % 31) / 31 * cellSize;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Parking space lines (dashed yellow)
    ctx.strokeStyle = 'rgba(255, 230, 100, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([cellSize * 0.2, cellSize * 0.3]);
    for (let c = 1; c < gw; c++) {
      const x = offsetX + c * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, offsetY + 4);
      ctx.lineTo(x, offsetY + gridPxH - 4);
      ctx.stroke();
    }
    for (let r = 1; r < gh; r++) {
      const y = offsetY + r * cellSize;
      ctx.beginPath();
      ctx.moveTo(offsetX + 4, y);
      ctx.lineTo(offsetX + gridPxW - 4, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // Exit gap + arrow
    const exit = state.grid.exit;
    const ey = offsetY + exit.y * cellSize + 4;
    const eh = cellSize - 8;
    // Clear border to show gap
    ctx.clearRect(offsetX + gridPxW - 3, ey, 8, eh);

    // Exit glow cone
    const ax = offsetX + gridPxW + 6;
    const ay = offsetY + exit.y * cellSize + cellSize / 2;
    const cone = ctx.createRadialGradient(ax, ay, 0, ax, ay, cellSize);
    cone.addColorStop(0, 'rgba(255,215,0,0.35)');
    cone.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = cone;
    ctx.fillRect(ax - cellSize, ay - cellSize / 2, cellSize + 10, cellSize);

    // Arrow
    ctx.fillStyle = EXIT_COLOR;
    ctx.shadowColor = EXIT_COLOR;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 9);
    ctx.lineTo(ax + 15, ay);
    ctx.lineTo(ax, ay + 9);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /** 3D toy-car shading on a vehicle */
  function drawVehicle(v, pixelOffsetX = 0, pixelOffsetY = 0, isSelected = false) {
    const margin = 4;
    const pos = gridToCanvas(v.x, v.y);
    const pw = v.width * cellSize - margin * 2;
    const ph = v.height * cellSize - margin * 2;
    let px = pos.x + margin + pixelOffsetX;
    let py = pos.y + margin + pixelOffsetY;
    const r = Math.min(12, cellSize / 5);
    const depth = Math.round(cellSize * 0.10); // side-face depth

    const isHero = v.type === 'hero';

    // Selection / hero shadow
    ctx.save();
    if (isHero || isSelected) {
      ctx.shadowColor = isHero ? HERO_GLOW : 'rgba(255,255,255,0.45)';
      ctx.shadowBlur = isSelected ? 22 : 16;
      ctx.shadowOffsetY = isSelected ? 4 : 2;
    }

    // Bottom/right side face (shadow)
    const sideColor = darken(v.color, 30);
    ctx.beginPath();
    ctx.roundRect(px + depth, py + depth, pw, ph, r);
    ctx.fillStyle = sideColor;
    ctx.fill();
    ctx.restore();

    // Main top face
    const topGrad = ctx.createLinearGradient(px, py, px, py + ph);
    topGrad.addColorStop(0, lighten(v.color, 22));
    topGrad.addColorStop(0.5, v.color);
    topGrad.addColorStop(1, darken(v.color, 12));
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, r);
    ctx.fillStyle = topGrad;
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Top highlight strip
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.roundRect(px + 4, py + 3, pw - 8, ph * 0.22, r * 0.5);
    ctx.fill();

    // Windows
    ctx.fillStyle = 'rgba(200,240,255,0.35)';
    if (v.orientation === 'horizontal') {
      const ww = pw * 0.28;
      const wh = ph * 0.38;
      const wy = py + ph * 0.2;
      ctx.fillRect(px + pw * 0.1, wy, ww, wh);
      ctx.fillRect(px + pw * 0.62, wy, ww, wh);
    } else {
      const ww = pw * 0.52;
      const wh = ph * 0.14;
      const wx = px + pw * 0.24;
      ctx.fillRect(wx, py + ph * 0.1, ww, wh);
      if (v.height >= 3) ctx.fillRect(wx, py + ph * 0.45, ww, wh);
    }

    // Windshield glare diagonal
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    if (v.orientation === 'horizontal') {
      ctx.moveTo(px + pw * 0.1, py + ph * 0.2);
      ctx.lineTo(px + pw * 0.38, py + ph * 0.2);
      ctx.lineTo(px + pw * 0.28, py + ph * 0.58);
      ctx.lineTo(px + pw * 0.1, py + ph * 0.58);
    } else {
      ctx.moveTo(px + pw * 0.24, py + ph * 0.1);
      ctx.lineTo(px + pw * 0.76, py + ph * 0.1);
      ctx.lineTo(px + pw * 0.65, py + ph * 0.24);
      ctx.lineTo(px + pw * 0.24, py + ph * 0.24);
    }
    ctx.closePath();
    ctx.fill();
  }

  /** Draw exit particles */
  function updateAndDrawParticles() {
    for (let i = exitParticles.length - 1; i >= 0; i--) {
      const p = exitParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.018;
      if (p.life <= 0) { exitParticles.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot += p.rotV);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** Spawn exit celebration burst */
  function spawnExitBurst(exitRow) {
    const colors = [HERO_COLOR, EXIT_COLOR, '#fff', '#ff8c42', '#ff3cac'];
    const x = offsetX + (6 * cellSize) + 20; // right of grid
    const y = offsetY + exitRow * cellSize + cellSize / 2;
    for (let i = 0; i < 40; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = 2 + Math.random() * 5;
      exitParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        w: 4 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        life: 0.8 + Math.random() * 0.4
      });
    }
  }

  /** Get shake offset */
  function getShake() {
    const t = performance.now();
    if (t > shakeUntil) return { dx: 0, dy: 0 };
    const phase = (t * 0.03) % (Math.PI * 2);
    const decay = (shakeUntil - t) / 300;
    const amp = shakeAmplitude * decay;
    return { dx: Math.cos(phase * 3.7) * amp, dy: Math.sin(phase * 2.9) * amp };
  }

  /**
   * Compute vehicle draw position accounting for slide animation
   */
  function getVehicleDrawPos(v, drag) {
    if (drag && drag.vehicleId === v.id) {
      return { pixelOffsetX: drag.dx || 0, pixelOffsetY: drag.dy || 0 };
    }

    const anim = slideAnims.get(v.id);
    if (!anim) return { pixelOffsetX: 0, pixelOffsetY: 0 };

    const t = performance.now();
    const elapsed = (t - anim.startTime) / anim.duration;
    if (elapsed >= 1) {
      slideAnims.delete(v.id);
      return { pixelOffsetX: 0, pixelOffsetY: 0 };
    }

    const eased = reducedMotion ? 1 : easeOutBack(elapsed);
    const dx = (anim.toGridX - anim.fromGridX) * cellSize;
    const dy = (anim.toGridY - anim.fromGridY) * cellSize;
    // Current position is anim.toGridX/Y (already in state), animate from the old pos
    return {
      pixelOffsetX: dx * (eased - 1),
      pixelOffsetY: dy * (eased - 1)
    };
  }

  function render(state, drag, selectedId) {
    const W = parseInt(canvas.style.width) || canvas.width;
    const H = parseInt(canvas.style.height) || canvas.height;
    const shake = getShake();

    ctx.save();
    ctx.translate(shake.dx, shake.dy);
    ctx.clearRect(-10, -10, W + 20, H + 20);

    drawGrid(state);

    // Draw non-dragged, non-hero vehicles first
    for (const v of state.vehicles) {
      if (drag && drag.vehicleId === v.id) continue;
      if (v.type === 'hero') continue;
      const { pixelOffsetX, pixelOffsetY } = getVehicleDrawPos(v, null);
      drawVehicle(v, pixelOffsetX, pixelOffsetY, selectedId === v.id);
    }

    // Hero on top (so its glow renders above other cars)
    const hero = state.vehicles.find(v => v.type === 'hero');
    if (hero && !(drag && drag.vehicleId === hero.id)) {
      const { pixelOffsetX, pixelOffsetY } = getVehicleDrawPos(hero, null);
      drawVehicle(hero, pixelOffsetX, pixelOffsetY, selectedId === hero.id);
    }

    // Dragging vehicle on top of everything
    if (drag) {
      const v = state.vehicles.find(veh => veh.id === drag.vehicleId);
      if (v) drawVehicle(v, drag.dx || 0, drag.dy || 0, true);
    }

    updateAndDrawParticles();

    ctx.restore();

    // Win overlay
    if (state.status === 'won') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** Animate a vehicle sliding from its old grid position to new */
  function animateSlide(vehicleId, fromGridX, fromGridY, toGridX, toGridY, cells) {
    if (reducedMotion) return;
    slideAnims.set(vehicleId, {
      fromGridX, fromGridY, toGridX, toGridY,
      startTime: performance.now(),
      duration: ANIM_DURATION * Math.max(1, cells)
    });
  }

  /** Trigger screen shake on blocked move */
  function shake(durationMs = 300, amplitude = 4) {
    if (reducedMotion) return;
    shakeUntil = performance.now() + durationMs;
    shakeAmplitude = amplitude;
  }

  /** Call when hero exits — spawns particle burst at exit */
  function onHeroExit(exitRow) {
    spawnExitBurst(exitRow);
  }

  function hitTestVehicle(px, py, state) {
    const { col, row } = canvasToGrid(px, py);
    for (const v of state.vehicles) {
      if (v.orientation === 'horizontal') {
        if (row === v.y && col >= v.x && col < v.x + v.width) return v.id;
      } else {
        if (col === v.x && row >= v.y && row < v.y + v.height) return v.id;
      }
    }
    return null;
  }

  function computeSnapMove(vehicle, dx, dy) {
    if (vehicle.orientation === 'horizontal') {
      const cells = Math.round(dx / cellSize);
      if (cells === 0) return null;
      return { direction: cells > 0 ? 'right' : 'left', distance: Math.abs(cells) };
    } else {
      const cells = Math.round(dy / cellSize);
      if (cells === 0) return null;
      return { direction: cells > 0 ? 'down' : 'up', distance: Math.abs(cells) };
    }
  }

  return {
    resize,
    render,
    hitTestVehicle,
    computeSnapMove,
    animateSlide,
    shake,
    onHeroExit,
    setReducedMotion,
    getCellSize: () => cellSize,
    getOffset: () => ({ x: offsetX, y: offsetY })
  };
}

function lighten(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16);
  const a = Math.round(2.55 * pct);
  const R = Math.min(255, (n >> 16) + a);
  const G = Math.min(255, ((n >> 8) & 0xff) + a);
  const B = Math.min(255, (n & 0xff) + a);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function darken(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16);
  const a = Math.round(2.55 * pct);
  const R = Math.max(0, (n >> 16) - a);
  const G = Math.max(0, ((n >> 8) & 0xff) - a);
  const B = Math.max(0, (n & 0xff) - a);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

export default { createRenderer };
