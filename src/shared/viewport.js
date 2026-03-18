/**
 * Fixed logical resolution viewport
 *
 * Provides a canvas that scales to fit any screen while maintaining
 * consistent logical dimensions. Games render to logical pixels,
 * the canvas scales to fit via CSS.
 */

/**
 * Default logical resolutions
 */
export const LOGICAL_RESOLUTIONS = {
  portrait: { width: 390, height: 844 },   // iPhone 13 Pro
  landscape: { width: 844, height: 390 },
  square: { width: 600, height: 600 },
};

/**
 * Active viewport instances (for cleanup)
 */
const instances = new Set();

/**
 * Create a viewport with fixed logical resolution
 *
 * @param {HTMLElement} container - Container element
 * @param {Object} options - Configuration
 * @param {number} options.logicalWidth - Logical width in pixels
 * @param {number} options.logicalHeight - Logical height in pixels
 * @param {string} options.orientation - 'portrait', 'landscape', or 'auto'
 * @param {boolean} options.autoResize - Auto-resize on container changes (default: true)
 * @returns {Object} Viewport instance
 */
export function createViewport(container, options = {}) {
  const {
    logicalWidth = LOGICAL_RESOLUTIONS.portrait.width,
    logicalHeight = LOGICAL_RESOLUTIONS.portrait.height,
    orientation = 'auto',
    autoResize = true,
  } = options;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = logicalWidth;
  canvas.height = logicalHeight;
  canvas.style.cssText = `
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  `;

  // Create wrapper for proper aspect ratio containment
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--mg-viewport-bg, #000);
  `;
  wrapper.appendChild(canvas);

  // Append to container
  container.appendChild(wrapper);

  // Create viewport instance
  const instance = {
    canvas,
    wrapper,
    container,
    logicalWidth,
    logicalHeight,
    orientation,
    autoResize,
    resizeObserver: null,

    /**
     * Get the 2D rendering context
     * @param {string} contextType - Context type (default: '2d')
     * @returns {CanvasRenderingContext2D|WebGLRenderingContext}
     */
    getContext(contextType = '2d') {
      return canvas.getContext(contextType);
    },

    /**
     * Get canvas dimensions
     * @returns {{width: number, height: number}}
     */
    getDimensions() {
      return { width: logicalWidth, height: logicalHeight };
    },

    /**
     * Get the scale factor between logical and physical pixels
     * @returns {{x: number, y: number}}
     */
    getScale() {
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.width / logicalWidth,
        y: rect.height / logicalHeight,
      };
    },

    /**
     * Convert physical coordinates to logical
     * @param {number} x - Physical X
     * @param {number} y - Physical Y
     * @returns {{x: number, y: number}}
     */
    physicalToLogical(x, y) {
      const scale = this.getScale();
      const rect = canvas.getBoundingClientRect();
      return {
        x: (x - rect.left) / scale.x,
        y: (y - rect.top) / scale.y,
      };
    },

    /**
     * Convert logical coordinates to physical
     * @param {number} x - Logical X
     * @param {number} y - Logical Y
     * @returns {{x: number, y: number}}
     */
    logicalToPhysical(x, y) {
      const scale = this.getScale();
      const rect = canvas.getBoundingClientRect();
      return {
        x: x * scale.x + rect.left,
        y: y * scale.y + rect.top,
      };
    },

    /**
     * Update logical dimensions
     * @param {number} width - New logical width
     * @param {number} height - New logical height
     */
    resizeLogical(width, height) {
      canvas.width = width;
      canvas.height = height;
      this.logicalWidth = width;
      this.logicalHeight = height;
    },

    /**
     * Destroy the viewport
     */
    destroy() {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
      if (wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
      instances.delete(this);
    },
  };

  // Setup auto-resize if enabled
  if (autoResize) {
    instance.resizeObserver = new ResizeObserver(() => {
      _updateCanvasScale(instance);
    });
    instance.resizeObserver.observe(container);
    _updateCanvasScale(instance);
  }

  instances.add(instance);
  return instance;
}

/**
 * Update canvas CSS scale based on container size
 * @param {Object} instance - Viewport instance
 */
function _updateCanvasScale(instance) {
  const { container, wrapper, canvas, logicalWidth, logicalHeight, orientation } = instance;

  const containerRect = container.getBoundingClientRect();
  const containerAspect = containerRect.width / containerRect.height;
  const logicalAspect = logicalWidth / logicalHeight;

  // Determine if we need to letterbox
  let scale;
  if (orientation === 'auto') {
    // Fit to container, maintain aspect ratio
    if (containerAspect > logicalAspect) {
      // Container is wider - fit to height
      scale = containerRect.height / logicalHeight;
    } else {
      // Container is taller - fit to width
      scale = containerRect.width / logicalWidth;
    }
  } else {
    // Fixed orientation - scale to fit within container
    const scaleX = containerRect.width / logicalWidth;
    const scaleY = containerRect.height / logicalHeight;
    scale = Math.min(scaleX, scaleY);
  }

  // Apply scale via transform for crisp rendering
  canvas.style.transform = `scale(${scale})`;
  canvas.style.transformOrigin = 'center center';

  // Set wrapper to exact logical size
  wrapper.style.width = `${logicalWidth}px`;
  wrapper.style.height = `${logicalHeight}px`;
}

/**
 * Create a portrait viewport
 * @param {HTMLElement} container - Container element
 * @returns {Object} Viewport instance
 */
export function createPortraitViewport(container) {
  return createViewport(container, {
    logicalWidth: LOGICAL_RESOLUTIONS.portrait.width,
    logicalHeight: LOGICAL_RESOLUTIONS.portrait.height,
  });
}

/**
 * Create a landscape viewport
 * @param {HTMLElement} container - Container element
 * @returns {Object} Viewport instance
 */
export function createLandscapeViewport(container) {
  return createViewport(container, {
    logicalWidth: LOGICAL_RESOLUTIONS.landscape.width,
    logicalHeight: LOGICAL_RESOLUTIONS.landscape.height,
  });
}

/**
 * Create a square viewport
 * @param {HTMLElement} container - Container element
 * @returns {Object} Viewport instance
 */
export function createSquareViewport(container) {
  return createViewport(container, {
    logicalWidth: LOGICAL_RESOLUTIONS.square.width,
    logicalHeight: LOGICAL_RESOLUTIONS.square.height,
  });
}

/**
 * Cleanup all viewport instances
 */
export function cleanupAllViewports() {
  for (const instance of instances) {
    instance.destroy();
  }
  instances.clear();
}
