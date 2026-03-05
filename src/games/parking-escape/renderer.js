/**
 * Parking Escape - Canvas Renderer
 *
 * Renders the game board with:
 * - Parking lot grid
 * - Cars with orientation
 * - Exit point
 * - Drag preview and collision feedback
 * - Win animation
 */

import { CAR_COLORS, getCarCells, getValidMoveRange } from './state.js';

// Visual constants
const CELL_SIZE = 60;
const GRID_COLOR = '#264653';
const GRID_LINE_COLOR = 'rgba(255, 255, 255, 0.1)';
const EXIT_COLOR = '#00FF88';

/**
 * Create a renderer instance
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let reducedMotion = false;

  /**
   * Resize canvas to fit container
   */
  function resize(state) {
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();

    // Calculate grid dimensions
    const gridWidth = state.gridSize * CELL_SIZE;
    const gridHeight = state.gridSize * CELL_SIZE;

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
      x: canvasX / (CELL_SIZE * scale),
      y: canvasY / (CELL_SIZE * scale)
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

    // Draw background (parking lot)
    renderGrid(state, scale);

    // Draw exit
    renderExit(state, scale);

    // Draw valid move range indicator
    if (state.draggingCar && !state.collisionPreview?.length) {
      renderValidRange(state, scale);
    }

    // Draw collision preview
    if (state.collisionPreview && state.collisionPreview.length > 0) {
      renderCollisionPreview(state, scale);
    }

    // Draw cars
    renderCars(state, scale);

    // Draw win animation
    if (state.won) {
      renderWinEffect(state, scale);
    }
  }

  /**
   * Draw parking lot grid
   */
  function renderGrid(state, scale) {
    const cellSize = CELL_SIZE * scale;

    // Background
    ctx.fillStyle = GRID_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 1;

    for (let i = 0; i <= state.gridSize; i++) {
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, height);
      ctx.stroke();

      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(width, i * cellSize);
      ctx.stroke();
    }

    // Parking spot markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2 * scale;
    ctx.setLineDash([10 * scale, 5 * scale]);

    for (let y = 0; y < state.gridSize; y++) {
      ctx.beginPath();
      ctx.moveTo(cellSize * 0.2, y * cellSize + cellSize / 2);
      ctx.lineTo(cellSize * 0.8, y * cellSize + cellSize / 2);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  /**
   * Draw exit point
   */
  function renderExit(state, scale) {
    const cellSize = CELL_SIZE * scale;
    const exitY = state.exit.y * cellSize;

    // Exit glow
    const gradient = ctx.createLinearGradient(width - cellSize, 0, width, 0);
    gradient.addColorStop(0, 'rgba(0, 255, 136, 0)');
    gradient.addColorStop(0.5, 'rgba(0, 255, 136, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 255, 136, 0.6)');

    ctx.fillStyle = gradient;
    ctx.fillRect(width - cellSize * 0.5, exitY, cellSize * 0.5, cellSize * 2);

    // Exit arrow
    ctx.fillStyle = EXIT_COLOR;
    ctx.font = `bold ${24 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('→', width - cellSize * 0.25, exitY + cellSize);

    // Pulsing effect
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('EXIT', width - cellSize * 0.25, exitY + cellSize * 0.5);
    ctx.globalAlpha = 1;
  }

  /**
   * Draw valid move range for dragged car
   */
  function renderValidRange(state, scale) {
    const car = state.cars.find(c => c.id === state.draggingCar);
    if (!car) return;

    const range = getValidMoveRange(state, car);
    const cellSize = CELL_SIZE * scale;
    const pos = gridToCanvas(car.x, car.y, scale);

    ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    ctx.lineWidth = 2 * scale;

    // Draw valid range cells
    if (car.orientation === 'horizontal') {
      const startX = pos.x - range.min * cellSize;
      const totalWidth = (range.min + range.max + car.length) * cellSize;
      
      ctx.fillRect(startX, pos.y, totalWidth, car.length * cellSize);
      ctx.strokeRect(startX, pos.y, totalWidth, car.length * cellSize);
    } else {
      const startY = pos.y - range.min * cellSize;
      const totalHeight = (range.min + range.max + car.length) * cellSize;
      
      ctx.fillRect(pos.x, startY, car.length * cellSize, totalHeight);
      ctx.strokeRect(pos.x, startY, car.length * cellSize, totalHeight);
    }
  }

  /**
   * Draw collision preview
   */
  function renderCollisionPreview(state, scale) {
    if (!state.collisionPreview) return;

    const cellSize = CELL_SIZE * scale;

    state.collisionPreview.forEach(collision => {
      const pos = gridToCanvas(collision.x, collision.y, scale);

      // Red flash for collision
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(pos.x, pos.y, cellSize, cellSize);

      // Red border
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 3 * scale;
      ctx.strokeRect(pos.x + 2, pos.y + 2, cellSize - 4, cellSize - 4);

      // X mark
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.moveTo(pos.x + cellSize * 0.3, pos.y + cellSize * 0.3);
      ctx.lineTo(pos.x + cellSize * 0.7, pos.y + cellSize * 0.7);
      ctx.moveTo(pos.x + cellSize * 0.7, pos.y + cellSize * 0.3);
      ctx.lineTo(pos.x + cellSize * 0.3, pos.y + cellSize * 0.7);
      ctx.stroke();
    });
  }

  /**
   * Draw cars
   */
  function renderCars(state, scale) {
    const cellSize = CELL_SIZE * scale;

    state.cars.forEach(car => {
      const isDragging = state.draggingCar === car.id;
      
      // Use drag position if dragging, otherwise use grid position
      let renderX, renderY;
      if (isDragging && state.dragPosition) {
        renderX = state.dragPosition.x * cellSize;
        renderY = state.dragPosition.y * cellSize;
      } else {
        const pos = gridToCanvas(car.x, car.y, scale);
        renderX = pos.x;
        renderY = pos.y;
      }

      const carWidth = car.orientation === 'horizontal' 
        ? car.length * cellSize - 8 * scale 
        : cellSize - 8 * scale;
      const carHeight = car.orientation === 'horizontal'
        ? cellSize - 8 * scale
        : car.length * cellSize - 8 * scale;

      const color = CAR_COLORS[car.color] || CAR_COLORS.red;

      // Shadow (deeper when dragging)
      if (isDragging) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 15 * scale;
        ctx.shadowOffsetY = 8 * scale;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 5 * scale;
        ctx.shadowOffsetY = 3 * scale;
      }

      // Car body
      ctx.fillStyle = color;
      const cornerRadius = 8 * scale;
      const x = renderX + 4 * scale;
      const y = renderY + 4 * scale;

      ctx.beginPath();
      ctx.roundRect(x, y, carWidth, carHeight, cornerRadius);
      ctx.fill();

      // Clear shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Car roof (lighter shade)
      const roofGradient = ctx.createLinearGradient(x, y, x, y + carHeight);
      roofGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      roofGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
      roofGradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
      ctx.fillStyle = roofGradient;
      ctx.beginPath();
      ctx.roundRect(x, y, carWidth, carHeight, cornerRadius);
      ctx.fill();

      // Windows
      ctx.fillStyle = 'rgba(100, 150, 200, 0.8)';
      const windowPadding = 8 * scale;
      const windowWidth = car.orientation === 'horizontal'
        ? carWidth * 0.2
        : carWidth - windowPadding * 2;
      const windowHeight = car.orientation === 'horizontal'
        ? carHeight - windowPadding * 2
        : carHeight * 0.15;

      if (car.orientation === 'horizontal') {
        // Front and rear windows
        ctx.fillRect(x + windowPadding, y + windowPadding, windowWidth, windowHeight);
        ctx.fillRect(x + carWidth - windowPadding - windowWidth, y + windowPadding, windowWidth, windowHeight);
      } else {
        // Top and bottom windows
        const windowX = x + windowPadding;
        const windowY1 = y + windowPadding;
        const windowY2 = y + carHeight - windowPadding - windowHeight;
        ctx.fillRect(windowX, windowY1, windowWidth, windowHeight);
        ctx.fillRect(windowX, windowY2, windowWidth, windowHeight);
      }

      // Wheels
      ctx.fillStyle = '#333';
      const wheelRadius = 6 * scale;
      const wheelOffset = 12 * scale;

      if (car.orientation === 'horizontal') {
        // Left wheels
        ctx.beginPath();
        ctx.arc(x + wheelOffset, y + 2, wheelRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + wheelOffset, y + carHeight - 2, wheelRadius, 0, Math.PI * 2);
        ctx.fill();
        // Right wheels
        ctx.beginPath();
        ctx.arc(x + carWidth - wheelOffset, y + 2, wheelRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + carWidth - wheelOffset, y + carHeight - 2, wheelRadius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Top wheels
        ctx.beginPath();
        ctx.arc(x + 2, y + wheelOffset, wheelRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + carWidth - 2, y + wheelOffset, wheelRadius, 0, Math.PI * 2);
        ctx.fill();
        // Bottom wheels
        ctx.beginPath();
        ctx.arc(x + 2, y + carHeight - wheelOffset, wheelRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + carWidth - 2, y + carHeight - wheelOffset, wheelRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Target car indicator
      if (car.id === 'target') {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.roundRect(x - 2, y - 2, carWidth + 4, carHeight + 4, cornerRadius + 2);
        ctx.stroke();
      }

      // Dragging highlight
      if (isDragging) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.roundRect(x, y, carWidth, carHeight, cornerRadius);
        ctx.stroke();
      }
    });
  }

  /**
   * Draw win effect
   */
  function renderWinEffect(state, scale) {
    const cellSize = CELL_SIZE * scale;
    const targetCar = state.cars.find(c => c.id === 'target');
    
    if (!targetCar) return;

    // Celebration particles
    const time = Date.now() / 100;
    ctx.fillStyle = '#FFD700';
    
    for (let i = 0; i < 8; i++) {
      const angle = (time + i * 45) * Math.PI / 180;
      const radius = 50 * scale;
      const x = width - cellSize + Math.cos(angle) * radius;
      const y = targetCar.y * cellSize + cellSize / 2 + Math.sin(angle) * radius;
      
      ctx.beginPath();
      ctx.arc(x, y, 4 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Animate car snap to grid
   */
  function animateSnap(car, fromX, fromY, toX, toY, scale, onComplete) {
    if (reducedMotion) {
      car.x = toX;
      car.y = toY;
      onComplete();
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const duration = 150;
      const startTime = performance.now();

      function frame(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out back (overshoot)
        const eased = 1 - Math.pow(1 - progress, 3);

        // Interpolate
        car.renderX = fromX + (toX - fromX) * eased;
        car.renderY = fromY + (toY - fromY) * eased;

        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          car.x = toX;
          car.y = toY;
          car.renderX = null;
          car.renderY = null;
          onComplete();
          resolve();
        }
      }

      requestAnimationFrame(frame);
    });
  }

  /**
   * Animate target car exiting
   */
  function animateExit(car, scale, onComplete) {
    if (reducedMotion) {
      car.exited = true;
      onComplete();
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const duration = 600;
      const startTime = performance.now();
      const startX = car.x;

      function frame(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease in (accelerate)
        const eased = progress * progress;
        car.x = startX + eased * 3;

        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          car.exited = true;
          onComplete();
          resolve();
        }
      }

      requestAnimationFrame(frame);
    });
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
    animateSnap,
    animateExit,
    setReducedMotion,
    getCellSize,
    get width() { return width; },
    get height() { return height; },
    get scale() { return width / (CELL_SIZE * 6); }
  };
}

export default {
  createRenderer,
  CAR_COLORS,
  CELL_SIZE
};
