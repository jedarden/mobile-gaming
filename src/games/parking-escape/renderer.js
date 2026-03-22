/**
 * Parking Escape - Canvas Renderer
 *
 * Renders a 6×6 grid with sliding vehicles.
 * Vehicles are rounded rectangles; hero is red, others use distinct colors.
 * Exit is shown as a gap with an arrow.
 * Dragging vehicles is handled visually here; logic is in state.js.
 */

const PADDING = 16;
const GRID_LINES_COLOR = 'rgba(255,255,255,0.08)';
const GRID_BG = '#1a1a2e';
const EXIT_COLOR = '#FFD700';
const HERO_GLOW = 'rgba(231,76,60,0.5)';

/**
 * Create a renderer.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {Object} Renderer API
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let cellSize = 60;
  let offsetX = PADDING;
  let offsetY = PADDING;
  let reducedMotion = false;

  // Drag state for smooth visual feedback
  let dragState = null; // { vehicleId, startGridX, startGridY, currentPixelOffset, axis }

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

  function drawRoundedRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function drawGrid(state) {
    const gw = state.grid.width;
    const gh = state.grid.height;
    const gridPxW = gw * cellSize;
    const gridPxH = gh * cellSize;

    // Background
    drawRoundedRect(offsetX, offsetY, gridPxW, gridPxH, 8, GRID_BG, 'rgba(255,255,255,0.1)');

    // Grid lines
    ctx.strokeStyle = GRID_LINES_COLOR;
    ctx.lineWidth = 1;
    for (let c = 1; c < gw; c++) {
      const x = offsetX + c * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + gridPxH);
      ctx.stroke();
    }
    for (let r = 1; r < gh; r++) {
      const y = offsetY + r * cellSize;
      ctx.beginPath();
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + gridPxW, y);
      ctx.stroke();
    }

    // Exit gap (right side)
    const exit = state.grid.exit;
    const ey = offsetY + exit.y * cellSize + 4;
    const eh = cellSize - 8;
    ctx.clearRect(offsetX + gridPxW - 2, ey, 6, eh);

    // Exit arrow
    const ax = offsetX + gridPxW + 4;
    const ay = offsetY + exit.y * cellSize + cellSize / 2;
    ctx.fillStyle = EXIT_COLOR;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 8);
    ctx.lineTo(ax + 14, ay);
    ctx.lineTo(ax, ay + 8);
    ctx.closePath();
    ctx.fill();
  }

  function drawVehicle(v, pixelOffsetX = 0, pixelOffsetY = 0) {
    const margin = 4;
    const pos = gridToCanvas(v.x, v.y);
    const pw = v.width * cellSize - margin * 2;
    const ph = v.height * cellSize - margin * 2;
    const px = pos.x + margin + pixelOffsetX;
    const py = pos.y + margin + pixelOffsetY;
    const r = Math.min(10, cellSize / 6);

    // Hero glow
    if (v.type === 'hero') {
      ctx.save();
      ctx.shadowColor = HERO_GLOW;
      ctx.shadowBlur = 16;
    }

    drawRoundedRect(px, py, pw, ph, r, v.color, 'rgba(255,255,255,0.3)');

    // Windows
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    if (v.orientation === 'horizontal') {
      const ww = pw * 0.3;
      const wh = ph * 0.4;
      const wy = py + ph * 0.15;
      ctx.fillRect(px + pw * 0.1, wy, ww, wh);
      ctx.fillRect(px + pw * 0.6, wy, ww, wh);
    } else {
      const ww = pw * 0.5;
      const wh = ph * 0.15;
      const wx = px + pw * 0.25;
      ctx.fillRect(wx, py + ph * 0.1, ww, wh);
      if (v.height >= 3) ctx.fillRect(wx, py + ph * 0.45, ww, wh);
    }

    if (v.type === 'hero') ctx.restore();
  }

  function render(state, drag) {
    const W = parseInt(canvas.style.width);
    const H = parseInt(canvas.style.height);
    ctx.clearRect(0, 0, W, H);

    drawGrid(state);

    for (const v of state.vehicles) {
      if (drag && drag.vehicleId === v.id) continue; // draw dragging vehicle last
      drawVehicle(v);
    }

    // Dragging vehicle on top
    if (drag) {
      const v = state.vehicles.find(veh => veh.id === drag.vehicleId);
      if (v) {
        drawVehicle(v, drag.dx || 0, drag.dy || 0);
      }
    }

    // Win overlay hint
    if (state.status === 'won') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /**
   * Find which vehicle is at the given canvas coordinates.
   *
   * @param {number} px
   * @param {number} py
   * @param {Object} state
   * @returns {string|null} vehicleId or null
   */
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

  /**
   * Given a drag delta in pixels, compute snapped grid distance.
   *
   * @param {Object} vehicle
   * @param {number} dx - pixel delta X
   * @param {number} dy - pixel delta Y
   * @param {Object} state
   * @returns {{ direction: string, distance: number }|null}
   */
  function computeSnapMove(vehicle, dx, dy, state) {
    const { getAllMoves } = state._moveFns || {};
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
    setReducedMotion,
    getCellSize: () => cellSize,
    getOffset: () => ({ x: offsetX, y: offsetY })
  };
}

export default { createRenderer };
