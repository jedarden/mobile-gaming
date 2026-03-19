/**
 * Bus Jam - Canvas Renderer
 *
 * Renders the game board with:
 * - Road grid with markings
 * - Buses with capacity indicators
 * - Stops with passenger queues
 * - Exit points
 * - Path preview visualization
 * - Animations for movement and boarding
 */

import { BUS_COLORS, isRoad, getBusAt, getStopAt, isExit } from './state.js';

// Visual constants
const CELL_SIZE = 60;
const ROAD_COLOR = '#4A4A5A';
const ROAD_MARKING_COLOR = 'rgba(255, 255, 255, 0.3)';
const GRASS_COLOR = '#2D5A27';
const STOP_BASE_COLOR = '#888888';

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

    // Draw background (grass)
    ctx.fillStyle = GRASS_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Draw roads
    renderRoads(state, scale);

    // Draw exits
    renderExits(state, scale);

    // Draw stops with passengers
    renderStops(state, scale);

    // Draw buses
    renderBuses(state, scale);

    // Draw path preview if bus is selected
    if (state.pathPreview) {
      renderPathPreview(state.pathPreview, scale);
    }
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

      // Stop base (sidewalk)
      ctx.fillStyle = STOP_BASE_COLOR;
      ctx.fillRect(pos.x + 5 * scale, pos.y + 5 * scale, cellSize - 10 * scale, cellSize - 10 * scale);

      // Stop color indicator
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(pos.x + 5 * scale, pos.y + 5 * scale, cellSize - 10 * scale, cellSize - 10 * scale);
      ctx.globalAlpha = 1;

      // Draw waiting passengers
      const passengersPerRow = 3;
      stop.waiting.forEach((passenger, i) => {
        const row = Math.floor(i / passengersPerRow);
        const col = i % passengersPerRow;
        const px = pos.x + 10 * scale + col * (passengerSize + 3 * scale);
        const py = pos.y + cellSize - 15 * scale - row * (passengerSize + 3 * scale);

        // Passenger body (simple stick figure)
        ctx.fillStyle = color;

        // Head
        ctx.beginPath();
        ctx.arc(px + passengerSize / 2, py, passengerSize / 3, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillRect(px + passengerSize / 3, py + passengerSize / 3, passengerSize / 3, passengerSize / 2);
      });

      // Passenger count
      if (stop.waiting.length > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${10 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(stop.waiting.length, pos.x + cellSize / 2, pos.y + 8 * scale);
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

      // Selection glow
      if (isSelected) {
        ctx.shadowColor = 'rgba(99, 102, 241, 0.8)';
        ctx.shadowBlur = 15 * scale;
      }

      // Bus body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(busX, busY, busWidth, busHeight, 8 * scale);
      ctx.fill();

      // Clear shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Bus windows
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      const windowWidth = busWidth * 0.2;
      const windowHeight = busHeight * 0.4;
      const windowY = busY + busHeight * 0.2;

      for (let i = 0; i < 3; i++) {
        ctx.fillRect(
          busX + busWidth * 0.1 + i * (windowWidth + 4 * scale),
          windowY,
          windowWidth,
          windowHeight
        );
      }

      // Capacity indicator (dots)
      const dotSize = 6 * scale;
      const dotSpacing = 10 * scale;
      const dotsY = busY + busHeight - 12 * scale;

      for (let i = 0; i < bus.capacity; i++) {
        const dotX = busX + busWidth / 2 - (bus.capacity * dotSpacing) / 2 + i * dotSpacing;
        ctx.fillStyle = i < bus.passengers ? '#fff' : 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(dotX, dotsY, dotSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bus direction indicator
      const arrowSize = 8 * scale;
      ctx.fillStyle = '#fff';
      ctx.font = `${arrowSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const arrowX = busX + busWidth / 2;
      const arrowY = busY + busHeight + 8 * scale;
      const arrows = { up: '▲', down: '▼', left: '◀', right: '▶' };
      ctx.fillText(arrows[bus.direction] || '', arrowX, arrowY);

      // Full bus indicator
      if (bus.passengers >= bus.capacity) {
        ctx.fillStyle = '#22c55e';
        ctx.font = `bold ${14 * scale}px sans-serif`;
        ctx.fillText('✓', busX + busWidth - 10 * scale, busY + 12 * scale);
      }
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
