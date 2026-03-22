/**
 * Satisfying ASMR - Canvas Renderer
 *
 * Two-layer approach:
 * - Bottom: clean surface color
 * - Top: dirt overlay drawn as colored cells
 *
 * The grid state (cells[]) maps to canvas pixels via cellSize scaling.
 */

const SURFACE_COLOR = '#e8dcc8';
const DIRT_COLOR = '#4a3728';
const CLEAN_TINT = 'rgba(200,240,220,0.08)';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let cellSize = 20;
  let canvasW = 300;
  let canvasH = 300;
  let gridW = 16;
  let gridH = 16;

  // Offscreen canvas for dirt layer (efficient partial clears)
  let dirtCanvas = null;
  let dirtCtx = null;

  function resize(state) {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    gridW = state.width;
    gridH = state.height;

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
  }

  function buildDirtLayer(cells, w, h) {
    if (!dirtCtx) return;
    dirtCtx.clearRect(0, 0, canvasW, canvasH);
    dirtCtx.fillStyle = DIRT_COLOR;
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]) continue;
      const c = i % w;
      const r = Math.floor(i / w);
      dirtCtx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
    }
  }

  function render(state) {
    if (!dirtCanvas) return;
    ctx.clearRect(0, 0, canvasW, canvasH);

    // Bottom: clean surface
    ctx.fillStyle = SURFACE_COLOR;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Dirt overlay
    ctx.drawImage(dirtCanvas, 0, 0, canvasW, canvasH, 0, 0, canvasW, canvasH);

    // Faint clean tint on clean areas (for visual feedback)
    // (skipped for performance — dirt removal is enough feedback)
  }

  /**
   * Erase dirt cells at (cx, cy) with given radius (in grid cells).
   * Updates dirtCanvas in-place for performance (no full redraw).
   *
   * @param {number[]} cells - Updated cells array
   * @param {number} cx - Center column (grid coords)
   * @param {number} cy - Center row (grid coords)
   * @param {number} radius - Radius in grid cells
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
   * Convert canvas pixel coordinates to grid cell coords.
   */
  function pixelToGrid(px, py) {
    return {
      gc: Math.floor(px / cellSize),
      gr: Math.floor(py / cellSize)
    };
  }

  return { resize, render, buildDirtLayer, eraseArea, pixelToGrid, getCellSize: () => cellSize };
}

export default { createRenderer };
