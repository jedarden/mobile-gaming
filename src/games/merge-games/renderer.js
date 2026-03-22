/**
 * Merge Games - Canvas Renderer
 *
 * Renders a grid of tile items. Each cell shows its tier as a number and color.
 * Drag from one cell to an adjacent same-tier cell to merge.
 */

const TIER_COLORS = ['', '#A8DADC', '#457B9D', '#1D3557', '#E63946', '#F4A261', '#2A9D8F'];
const TIER_LABELS = ['', '1', '2', '3', '4', '5', '6'];
const CELL_GAP = 6;
const CELL_RADIUS = 10;
const CELL_BG = 'rgba(255,255,255,0.06)';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let cellSize = 60;
  let offsetX = 0;
  let offsetY = 0;

  let dragState = null; // { fromR, fromC, tier, px, py }
  let flashCells = []; // [{r,c,t}] cells to flash on merge

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

  function roundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function drawCell(r, c, tier, highlight, dragging) {
    const { x, y, w, h } = cellRect(r, c);
    const alpha = dragging ? 0.3 : 1;
    if (tier === 0) {
      roundRect(x, y, w, h, CELL_RADIUS, CELL_BG);
      return;
    }
    const color = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)] || '#888';
    ctx.globalAlpha = alpha;
    roundRect(x, y, w, h, CELL_RADIUS, color, highlight ? 'white' : 'rgba(255,255,255,0.15)');
    ctx.globalAlpha = 1;

    // Tier number
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.round(cellSize * 0.38)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;
    ctx.fillText(TIER_LABELS[Math.min(tier, TIER_LABELS.length - 1)], x + w / 2, y + h / 2);
    ctx.globalAlpha = 1;
  }

  function render(state, drag) {
    const cw = parseInt(canvas.style.width);
    const ch = parseInt(canvas.style.height);
    ctx.clearRect(0, 0, cw, ch);

    for (let r = 0; r < state.height; r++) {
      for (let c = 0; c < state.width; c++) {
        const tier = state.grid[r][c];
        const isDragging = drag && drag.fromR === r && drag.fromC === c;
        const isHighlight = drag && tier !== 0 && tier === state.grid[drag.fromR]?.[drag.fromC] && !(r === drag.fromR && c === drag.fromC);
        drawCell(r, c, tier, isHighlight, isDragging);
      }
    }

    // Draw dragged item floating
    if (drag && drag.tier > 0) {
      const half = cellSize / 2;
      const color = TIER_COLORS[Math.min(drag.tier, TIER_COLORS.length - 1)] || '#888';
      roundRect(drag.px - half, drag.py - half, cellSize, cellSize, CELL_RADIUS, color, 'white');
      ctx.fillStyle = 'white';
      ctx.font = `bold ${Math.round(cellSize * 0.38)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TIER_LABELS[Math.min(drag.tier, TIER_LABELS.length - 1)], drag.px, drag.py);
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

  return { resize, render, canvasToCell, cellRect, getCellSize: () => cellSize };
}

export default { createRenderer };
