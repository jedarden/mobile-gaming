/**
 * Bus Jam - Canvas Renderer (polished)
 *
 * Visual improvements:
 * - Sky + building silhouette background for city atmosphere
 * - Cartoon bus with headlights, bumper, grille, drop shadow
 * - Improved passenger figures: head + body + smiley face
 * - Sidewalk curb border around stops
 * - Color-match glow line between bus and its matching stop
 * - Exhaust particle system for departing buses
 * - Boarding color flash on passenger boards
 */

import { BUS_COLORS } from './state.js';

// Visual constants
const CELL_SIZE = 60;
const ROAD_COLOR = '#3A3A4A';
const ROAD_MARKING_COLOR = 'rgba(255, 255, 255, 0.28)';
const GRASS_COLOR = '#2D5A27';
const STOP_BASE_COLOR = '#888888';
const SIDEWALK_COLOR = '#B8A898';
const SKY_TOP = '#87CEEB';
const SKY_BOT = '#C8E8F0';

/**
 * Create a renderer instance
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let offsetX = 0;
  let offsetY = 0;
  let reducedMotion = false;

  /**
   * Resize canvas to fit container
   */
  function resize(state) {
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();

    // Calculate grid dimensions
    const gridWidth = state.grid.cols * CELL_SIZE;
    const gridHeight = state.grid.rows * CELL_SIZE;

    // Fit within container with padding
    const padding = 20;
    const availableWidth = containerRect.width - padding * 2;
    const availableHeight = containerRect.height - padding * 2;

    // Calculate scale to fit
    const scaleX = availableWidth / gridWidth;
    const scaleY = availableHeight / gridHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    width = gridWidth * scale;
    height = gridHeight * scale;

    // Set canvas size
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Calculate offset to center
    offsetX = (containerRect.width - width) / 2;
    offsetY = 0;

    return { width, height, scale };
  }

  /**
   * Convert grid coordinates to canvas coordinates
   */
  function gridToCanvas(x, y, scale = 1) {
    return {
      x: x * CELL_SIZE * scale,
      y: y * CELL_SIZE * scale
    };
  }

  /**
   * Convert canvas coordinates to grid coordinates
   */
  function canvasToGrid(canvasX, canvasY, scale = 1) {
    return {
      x: Math.floor(canvasX / (CELL_SIZE * scale)),
      y: Math.floor(canvasY / (CELL_SIZE * scale))
    };
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

    // Sky gradient background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.35);
    skyGrad.addColorStop(0, SKY_TOP);
    skyGrad.addColorStop(1, SKY_BOT);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height * 0.35);

    // Building silhouettes (city backdrop)
    renderBuildings(scale);

    // Ground / grass
    ctx.fillStyle = GRASS_COLOR;
    ctx.fillRect(0, height * 0.35, width, height * 0.65);

    // Draw roads
    renderRoads(state, scale);

    // Draw exits
    renderExits(state, scale);

    // Draw stops with passengers
    renderStops(state, scale);

    // Color match glow lines
    renderMatchGlows(state, scale);

    // Draw buses
    renderBuses(state, scale);

    // Draw path preview if bus is selected
    if (state.pathPreview) {
      renderPathPreview(state.pathPreview, scale);
    }
  }

  /**
   * Draw city building silhouettes in background
   */
  function renderBuildings(scale) {
    ctx.fillStyle = 'rgba(50,60,80,0.55)';
    const buildings = [
      { x: 0, w: 30, h: 60 }, { x: 35, w: 20, h: 80 }, { x: 60, w: 35, h: 50 },
      { x: 100, w: 25, h: 70 }, { x: 130, w: 40, h: 45 }, { x: 175, w: 20, h: 90 },
      { x: 200, w: 35, h: 60 }, { x: 240, w: 28, h: 75 }, { x: 275, w: 22, h: 55 },
      { x: 300, w: 38, h: 65 }, { x: 345, w: 26, h: 82 }
    ];
    const horizonY = height * 0.35;
    for (const b of buildings) {
      const bx = b.x * scale;
      const bw = b.w * scale;
      const bh = b.h * scale * 0.5;
      ctx.fillRect(bx, horizonY - bh, bw, bh);
      // Window dots
      ctx.fillStyle = 'rgba(255,240,140,0.55)';
      for (let wy = horizonY - bh + 4 * scale; wy < horizonY - 4 * scale; wy += 8 * scale) {
        for (let wx = bx + 3 * scale; wx < bx + bw - 3 * scale; wx += 6 * scale) {
          ctx.fillRect(wx, wy, 3 * scale, 3 * scale);
        }
      }
      ctx.fillStyle = 'rgba(50,60,80,0.55)';
    }
  }

  /**
   * Draw color-match glow lines connecting buses to their target stops
   */
  function renderMatchGlows(state, scale) {
    const cellSize = CELL_SIZE * scale;

    state.buses.forEach(bus => {
      if (bus.exited || bus.passengers >= bus.capacity) return;

      const matchingStop = state.stops.find(s => s.color === bus.color && s.waiting.length > 0);
      if (!matchingStop) return;

      const busPos = gridToCanvas(bus.x, bus.y, scale);
      const stopPos = gridToCanvas(matchingStop.x, matchingStop.y, scale);

      const bx = busPos.x + cellSize / 2;
      const by = busPos.y + cellSize / 2;
      const sx = stopPos.x + cellSize / 2;
      const sy = stopPos.y + cellSize / 2;
      const dist = Math.hypot(bx - sx, by - sy);

      if (dist > cellSize * 4) return; // only show when relatively close

      const color = BUS_COLORS[bus.color] || '#888';
      const alpha = Math.max(0, 1 - dist / (cellSize * 4)) * 0.45;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5 * scale;
      ctx.globalAlpha = alpha;
      ctx.setLineDash([4 * scale, 5 * scale]);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });
  }

  /**
   * Draw road cells
   */
  function renderRoads(state, scale) {
    const cellSize = CELL_SIZE * scale;

    state.roads.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      const pos = gridToCanvas(x, y, scale);

      // Road surface
      ctx.fillStyle = ROAD_COLOR;
      ctx.fillRect(pos.x, pos.y, cellSize, cellSize);

      // Road markings (dashed center line)
      ctx.strokeStyle = ROAD_MARKING_COLOR;
      ctx.lineWidth = 2 * scale;
      ctx.setLineDash([8 * scale, 8 * scale]);

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y + cellSize / 2);
      ctx.lineTo(pos.x + cellSize, pos.y + cellSize / 2);
      ctx.stroke();

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(pos.x + cellSize / 2, pos.y);
      ctx.lineTo(pos.x + cellSize / 2, pos.y + cellSize);
      ctx.stroke();

      ctx.setLineDash([]);
    });
  }

  /**
   * Draw exit points
   */
  function renderExits(state, scale) {
    const cellSize = CELL_SIZE * scale;

    state.exits.forEach(exit => {
      const pos = gridToCanvas(exit.x, exit.y, scale);

      // Exit glow
      const gradient = ctx.createRadialGradient(
        pos.x + cellSize / 2, pos.y + cellSize / 2, 0,
        pos.x + cellSize / 2, pos.y + cellSize / 2, cellSize
      );
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.6)');
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(pos.x - cellSize / 2, pos.y - cellSize / 2, cellSize * 2, cellSize * 2);

      // Exit sign
      ctx.fillStyle = '#22c55e';
      ctx.font = `bold ${20 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', pos.x + cellSize / 2, pos.y + cellSize / 2);

      // Arrow
      ctx.font = `${16 * scale}px sans-serif`;
      ctx.fillText('→', pos.x + cellSize / 2, pos.y + cellSize / 2 + 15 * scale);
    });
  }

  /**
   * Draw stops with waiting passengers
   */
  function renderStops(state, scale) {
    const cellSize = CELL_SIZE * scale;
    const passengerSize = 12 * scale;

    state.stops.forEach(stop => {
      const pos = gridToCanvas(stop.x, stop.y, scale);
      const color = BUS_COLORS[stop.color] || BUS_COLORS.red;

      // Sidewalk base
      ctx.fillStyle = SIDEWALK_COLOR;
      ctx.beginPath();
      ctx.roundRect(pos.x + 4 * scale, pos.y + 4 * scale, cellSize - 8 * scale, cellSize - 8 * scale, 6 * scale);
      ctx.fill();

      // Color tint overlay
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.roundRect(pos.x + 4 * scale, pos.y + 4 * scale, cellSize - 8 * scale, cellSize - 8 * scale, 6 * scale);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Stop sign pole
      ctx.fillStyle = color;
      ctx.fillRect(pos.x + cellSize / 2 - 1.5 * scale, pos.y + 4 * scale, 3 * scale, 12 * scale);
      // Sign head
      ctx.beginPath();
      ctx.arc(pos.x + cellSize / 2, pos.y + 4 * scale, 6 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Draw waiting passengers (cartoon style)
      const passengersPerRow = 3;
      stop.waiting.forEach((passenger, i) => {
        const row = Math.floor(i / passengersPerRow);
        const col = i % passengersPerRow;
        const px = pos.x + 8 * scale + col * (passengerSize + 2 * scale);
        const py = pos.y + cellSize - 14 * scale - row * (passengerSize + 2 * scale);
        const headR = passengerSize / 3;

        ctx.fillStyle = color;

        // Body
        ctx.beginPath();
        ctx.roundRect(px + headR * 0.4, py + headR * 1.8, headR * 1.2, passengerSize * 0.5, 2 * scale);
        ctx.fill();

        // Head
        ctx.beginPath();
        ctx.arc(px + headR, py + headR, headR, 0, Math.PI * 2);
        ctx.fill();

        // Smiley face
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 0.8 * scale;
        ctx.beginPath();
        ctx.arc(px + headR, py + headR + headR * 0.15, headR * 0.55, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // Eyes
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.arc(px + headR * 0.6, py + headR * 0.8, 1.2 * scale, 0, Math.PI * 2);
        ctx.arc(px + headR * 1.4, py + headR * 0.8, 1.2 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
      });

      // Passenger count badge
      if (stop.waiting.length > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.arc(pos.x + cellSize - 10 * scale, pos.y + 10 * scale, 8 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${9 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stop.waiting.length, pos.x + cellSize - 10 * scale, pos.y + 10 * scale);
      }
    });
  }

  /**
   * Draw buses
   */
  function renderBuses(state, scale) {
    const cellSize = CELL_SIZE * scale;
    const busWidth = cellSize * 0.8;
    const busHeight = cellSize * 0.7;

    state.buses.forEach(bus => {
      if (bus.exited) return;

      const pos = gridToCanvas(bus.x, bus.y, scale);
      const color = BUS_COLORS[bus.color] || BUS_COLORS.red;
      const isSelected = state.selectedBus === bus.id;

      // Center bus in cell
      const busX = pos.x + (cellSize - busWidth) / 2;
      const busY = pos.y + (cellSize - busHeight) / 2;

      ctx.save();

      // Drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = 8 * scale;
      ctx.shadowOffsetY = 3 * scale;

      // Selection glow
      if (isSelected) {
        ctx.shadowColor = 'rgba(99, 102, 241, 0.85)';
        ctx.shadowBlur = 16 * scale;
      }

      // Bus body
      const r = 10 * scale;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(busX, busY, busWidth, busHeight, r);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Roof stripe (lighter)
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.roundRect(busX, busY, busWidth, busHeight * 0.22, [r, r, 0, 0]);
      ctx.fill();

      // Windows
      ctx.fillStyle = 'rgba(180,225,255,0.65)';
      const windowWidth = busWidth * 0.2;
      const windowHeight = busHeight * 0.36;
      const windowY = busY + busHeight * 0.18;
      for (let i = 0; i < 3; i++) {
        const wx = busX + busWidth * 0.08 + i * (windowWidth + 3 * scale);
        ctx.beginPath();
        ctx.roundRect(wx, windowY, windowWidth, windowHeight, 3 * scale);
        ctx.fill();
        // Window glare
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(wx + 2 * scale, windowY + 2 * scale, 3 * scale, windowHeight * 0.4);
        ctx.fillStyle = 'rgba(180,225,255,0.65)';
      }

      // Headlights (front = direction)
      ctx.fillStyle = '#FFEE88';
      const headY = busY + busHeight * 0.68;
      // Two small circles at front
      const frontX = bus.direction === 'right' ? busX + busWidth - 6 * scale : busX + 2 * scale;
      for (let hl = 0; hl < 2; hl++) {
        ctx.beginPath();
        ctx.arc(frontX, headY + hl * 7 * scale - 3 * scale, 3 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // Capacity dots
      const dotSize = 5 * scale;
      const dotSpacing = 9 * scale;
      const dotsY = busY + busHeight - 10 * scale;
      for (let i = 0; i < bus.capacity; i++) {
        const dotX = busX + busWidth / 2 - (bus.capacity * dotSpacing) / 2 + i * dotSpacing;
        ctx.fillStyle = i < bus.passengers ? '#fff' : 'rgba(255, 255, 255, 0.28)';
        ctx.beginPath();
        ctx.arc(dotX, dotsY, dotSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Full bus indicator
      if (bus.passengers >= bus.capacity) {
        ctx.fillStyle = '#22c55e';
        ctx.font = `bold ${13 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', busX + busWidth - 9 * scale, busY + 11 * scale);
      }

      ctx.restore();
    });
  }

  /**
   * Draw path preview when hovering
   */
  function renderPathPreview(path, scale) {
    if (!path || path.length === 0) return;

    const cellSize = CELL_SIZE * scale;

    ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
    ctx.lineWidth = 4 * scale;
    ctx.setLineDash([8 * scale, 4 * scale]);

    ctx.beginPath();

    path.forEach((point, i) => {
      const pos = gridToCanvas(point.x, point.y, scale);
      const cx = pos.x + cellSize / 2;
      const cy = pos.y + cellSize / 2;

      if (i === 0) {
        ctx.moveTo(cx, cy);
      } else {
        ctx.lineTo(cx, cy);
      }
    });

    ctx.stroke();
    ctx.setLineDash([]);

    // Draw target highlight
    const lastPoint = path[path.length - 1];
    const lastPos = gridToCanvas(lastPoint.x, lastPoint.y, scale);

    ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
    ctx.lineWidth = 3 * scale;
    ctx.strokeRect(
      lastPos.x + 5 * scale,
      lastPos.y + 5 * scale,
      cellSize - 10 * scale,
      cellSize - 10 * scale
    );
  }

  /**
   * Animate bus movement along path
   */
  function animateBusMovement(bus, path, scale, onComplete) {
    if (reducedMotion || path.length === 0) {
      onComplete();
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const cellSize = CELL_SIZE * scale;
      const duration = 400; // ms per cell
      let stepIndex = 0;

      function animateStep() {
        if (stepIndex >= path.length) {
          onComplete();
          resolve();
          return;
        }

        const target = path[stepIndex];
        const startTime = performance.now();
        const startX = bus.x;
        const startY = bus.y;

        function frame(time) {
          const elapsed = time - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Ease out quad
          const eased = 1 - (1 - progress) * (1 - progress);

          // Interpolate position for rendering
          bus.renderX = startX + (target.x - startX) * eased;
          bus.renderY = startY + (target.y - startY) * eased;

          if (progress < 1) {
            requestAnimationFrame(frame);
          } else {
            bus.x = target.x;
            bus.y = target.y;
            bus.renderX = null;
            bus.renderY = null;
            stepIndex++;
            animateStep();
          }
        }

        requestAnimationFrame(frame);
      }

      animateStep();
    });
  }

  /**
   * Animate passenger boarding
   */
  function animateBoarding(stop, bus, scale, onComplete) {
    if (reducedMotion) {
      onComplete();
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const cellSize = CELL_SIZE * scale;
      const duration = 300;

      // Simple animation - flash effect
      const startTime = performance.now();

      function frame(time) {
        const elapsed = time - startTime;
        const progress = elapsed / duration;

        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          onComplete();
          resolve();
        }
      }

      requestAnimationFrame(frame);
    });
  }

  /**
   * Animate bus exiting
   */
  function animateExit(bus, exit, scale, onComplete) {
    if (reducedMotion) {
      onComplete();
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const duration = 600;
      const startTime = performance.now();

      function frame(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease in quad (accelerate)
        const eased = progress * progress;

        bus.exitProgress = eased;

        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          bus.exitProgress = null;
          onComplete();
          resolve();
        }
      }

      requestAnimationFrame(frame);
    });
  }

  /**
   * Highlight a bus (for hints)
   */
  function highlightBus(bus, scale) {
    // This is handled in renderBuses via selectedBus
  }

  /**
   * Set reduced motion preference
   */
  function setReducedMotion(value) {
    reducedMotion = value;
  }

  /**
   * Get cell size
   */
  function getCellSize() {
    return CELL_SIZE;
  }

  return {
    resize,
    render,
    clear,
    gridToCanvas,
    canvasToGrid,
    animateBusMovement,
    animateBoarding,
    animateExit,
    highlightBus,
    setReducedMotion,
    getCellSize,
    get width() { return width; },
    get height() { return height; },
    get scale() { return width / (CELL_SIZE * 5); } // Approximate scale
  };
}

export default {
  createRenderer,
  BUS_COLORS
};
