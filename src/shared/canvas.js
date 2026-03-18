/**
 * Canvas utilities with DPR-aware sizing for crisp rendering
 *
 * All logical pixels are scaled by devicePixelRatio for sharp text and shapes
 * on high-DPI displays while maintaining consistent logical dimensions.
 */

/**
 * Active animation frames mapped by ID
 */
const activeLoops = new Map();

/**
 * Get the device pixel ratio, defaulting to 1 if unavailable
 */
function getDevicePixelRatio() {
  return window.devicePixelRatio || 1;
}

/**
 * Create a canvas element with DPR-aware sizing
 *
 * @param {HTMLElement} container - Container element for the canvas
 * @param {number} logicalWidth - Width in logical pixels (e.g., 390)
 * @param {number} logicalHeight - Height in logical pixels (e.g., 844)
 * @returns {HTMLCanvasElement} Configured canvas element
 */
export function createCanvas(container, logicalWidth, logicalHeight) {
  const canvas = document.createElement('canvas');
  const dpr = getDevicePixelRatio();

  // Set display size (logical pixels)
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;

  // Set actual size in physical pixels (scaled by DPR)
  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;

  // Prevent default touch actions (scrolling, zooming)
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  canvas.style.webkitUserSelect = 'none';

  container.appendChild(canvas);

  return canvas;
}

/**
 * Resize an existing canvas with DPR-aware scaling
 *
 * @param {HTMLCanvasElement} canvas - Canvas element to resize
 * @param {number} logicalWidth - New width in logical pixels
 * @param {number} logicalHeight - New height in logical pixels
 */
export function resizeCanvas(canvas, logicalWidth, logicalHeight) {
  const dpr = getDevicePixelRatio();

  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;
}

/**
 * Get the 2D context with DPR scaling applied
 *
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {CanvasRenderingContext2D} Scaled 2D context
 */
export function getContext2D(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = getDevicePixelRatio();

  ctx.scale(dpr, dpr);
  return ctx;
}

/**
 * Clear a canvas (fills with transparent black)
 *
 * @param {CanvasRenderingContext2D} ctx - 2D context
 * @param {number} width - Logical width
 * @param {number} height - Logical height
 */
export function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Start a requestAnimationFrame loop
 *
 * @param {Function} callback - Function to call each frame (receives timestamp)
 * @param {string} id - Unique identifier for this loop
 * @returns {string} The loop ID for cancellation
 */
export function startLoop(callback, id) {
  // Cancel existing loop with same ID
  if (activeLoops.has(id)) {
    cancelAnimationFrame(activeLoops.get(id));
  }

  function loop(timestamp) {
    callback(timestamp);
    activeLoops.set(id, requestAnimationFrame(loop));
  }

  activeLoops.set(id, requestAnimationFrame(loop));
  return id;
}

/**
 * Stop a requestAnimationFrame loop
 *
 * @param {string} id - Loop ID to cancel
 */
export function stopLoop(id) {
  if (activeLoops.has(id)) {
    cancelAnimationFrame(activeLoops.get(id));
    activeLoops.delete(id);
  }
}

/**
 * Stop all active animation loops
 */
export function stopAllLoops() {
  for (const id of activeLoops.keys()) {
    cancelAnimationFrame(activeLoops.get(id));
  }
  activeLoops.clear();
}
