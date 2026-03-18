/**
 * Unified pointer input handling
 *
 * Normalizes mouse and touch events into a consistent format.
 * All coordinates are in logical pixels relative to the element.
 */

/**
 * Default thresholds for gesture detection
 */
const DEFAULTS = {
  tapThreshold: 10,     // Max movement for tap (logical pixels)
  dragThreshold: 5,     // Min movement to start drag (logical pixels)
  swipeThreshold: 30,   // Min movement for swipe (logical pixels)
  swipeTimeout: 300     // Max duration for swipe (ms)
};

/**
 * Active input listeners (for cleanup)
 */
const activeListeners = new Map();

/**
 * Get pointer position relative to an element
 *
 * @param {HTMLElement} element - Target element
 * @param {MouseEvent|TouchEvent} event - Input event
 * @returns {Object} { x, y } Normalized coordinates in logical pixels
 */
function getPointerPosition(element, event) {
  const rect = element.getBoundingClientRect();
  let clientX, clientY;

  if (event.touches && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else if (event.changedTouches && event.changedTouches.length > 0) {
    clientX = event.changedTouches[0].clientX;
    clientY = event.changedTouches[0].clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }

  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

/**
 * Normalize an input event into a standard format
 *
 * @param {HTMLElement} element - Target element
 * @param {string} type - Event type ('down', 'move', 'up', 'cancel')
 * @param {MouseEvent|TouchEvent} event - Raw input event
 * @returns {Object} Normalized pointer data
 */
export function normalizeEvent(element, type, event) {
  const pos = getPointerPosition(element, event);

  return {
    type,
    x: pos.x,
    y: pos.y,
    dx: 0,
    dy: 0,
    timestamp: Date.now(),
    originalEvent: event
  };
}

/**
 * Register a tap gesture handler
 *
 * @param {HTMLElement} element - Element to listen on
 * @param {Function} callback - Callback with { x, y } in logical pixels
 * @param {number} threshold - Max movement for tap (default: 10)
 * @returns {Function} Cleanup function to remove listener
 */
export function onTap(element, callback, threshold = DEFAULTS.tapThreshold) {
  let startX = 0;
  let startY = 0;
  let startTime = 0;

  const onDown = (e) => {
    const pos = getPointerPosition(element, e);
    startX = pos.x;
    startY = pos.y;
    startTime = Date.now();
  };

  const onUp = (e) => {
    const pos = getPointerPosition(element, e);
    const dx = pos.x - startX;
    const dy = pos.y - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - startTime;

    if (distance <= threshold && duration < 500) {
      callback({ x: pos.x, y: pos.y });
    }
  };

  element.addEventListener('mousedown', onDown, { passive: true });
  element.addEventListener('touchstart', onDown, { passive: true });
  element.addEventListener('mouseup', onUp, { passive: true });
  element.addEventListener('touchend', onUp, { passive: true });

  const cleanup = () => {
    element.removeEventListener('mousedown', onDown);
    element.removeEventListener('touchstart', onDown);
    element.removeEventListener('mouseup', onUp);
    element.removeEventListener('touchend', onUp);
  };

  const id = `${element}-${callback}`;
  activeListeners.set(`tap-${id}`, cleanup);

  return cleanup;
}

/**
 * Register a drag gesture handler
 *
 * @param {HTMLElement} element - Element to listen on
 * @param {Function} callback - Callback with { x, y, dx, dy, isDragging }
 * @param {number} threshold - Min movement to start drag (default: 5)
 * @returns {Function} Cleanup function to remove listener
 */
export function onDrag(element, callback, threshold = DEFAULTS.dragThreshold) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;

  const onDown = (e) => {
    const pos = getPointerPosition(element, e);
    startX = pos.x;
    startY = pos.y;
    lastX = pos.x;
    lastY = pos.y;
    isDragging = false;

    callback({ x: pos.x, y: pos.y, dx: 0, dy: 0, isDragging: false });
  };

  const onMove = (e) => {
    const pos = getPointerPosition(element, e);
    const dx = pos.x - startX;
    const dy = pos.y - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const wasDragging = isDragging;
    if (distance >= threshold) {
      isDragging = true;
    }

    const moveDx = pos.x - lastX;
    const moveDy = pos.y - lastY;
    lastX = pos.x;
    lastY = pos.y;

    if (wasDragging || isDragging) {
      callback({ x: pos.x, y: pos.y, dx: moveDx, dy: moveDy, isDragging });
    }
  };

  const onUp = () => {
    if (isDragging) {
      callback({ x: lastX, y: lastY, dx: 0, dy: 0, isDragging: false });
    }
    isDragging = false;
  };

  element.addEventListener('mousedown', onDown, { passive: true });
  element.addEventListener('touchstart', onDown, { passive: true });
  element.addEventListener('mousemove', onMove, { passive: true });
  element.addEventListener('touchmove', onMove, { passive: true });
  element.addEventListener('mouseup', onUp, { passive: true });
  element.addEventListener('mouseleave', onUp, { passive: true });
  element.addEventListener('touchend', onUp, { passive: true });
  element.addEventListener('touchcancel', onUp, { passive: true });

  const cleanup = () => {
    element.removeEventListener('mousedown', onDown);
    element.removeEventListener('touchstart', onDown);
    element.removeEventListener('mousemove', onMove);
    element.removeEventListener('touchmove', onMove);
    element.removeEventListener('mouseup', onUp);
    element.removeEventListener('mouseleave', onUp);
    element.removeEventListener('touchend', onUp);
    element.removeEventListener('touchcancel', onUp);
  };

  const id = `${element}-${callback}`;
  activeListeners.set(`drag-${id}`, cleanup);

  return cleanup;
}

/**
 * Register a swipe gesture handler
 *
 * @param {HTMLElement} element - Element to listen on
 * @param {Function} callback - Callback with { direction, distance, velocity }
 * @param {number} threshold - Min movement for swipe (default: 30)
 * @param {string} direction - Direction filter: 'up', 'down', 'left', 'right', or null for any
 * @returns {Function} Cleanup function to remove listener
 */
export function onSwipe(element, callback, threshold = DEFAULTS.swipeThreshold, direction = null) {
  let startX = 0;
  let startY = 0;
  let startTime = 0;

  const onDown = (e) => {
    const pos = getPointerPosition(element, e);
    startX = pos.x;
    startY = pos.y;
    startTime = Date.now();
  };

  const onUp = (e) => {
    const pos = getPointerPosition(element, e);
    const dx = pos.x - startX;
    const dy = pos.y - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - startTime;

    if (distance < threshold || duration > DEFAULTS.swipeTimeout) {
      return;
    }

    let detectedDirection;
    if (Math.abs(dx) > Math.abs(dy)) {
      detectedDirection = dx > 0 ? 'right' : 'left';
    } else {
      detectedDirection = dy > 0 ? 'down' : 'up';
    }

    if (direction === null || direction === detectedDirection) {
      callback({
        direction: detectedDirection,
        distance,
        velocity: distance / duration
      });
    }
  };

  element.addEventListener('mousedown', onDown, { passive: true });
  element.addEventListener('touchstart', onDown, { passive: true });
  element.addEventListener('mouseup', onUp, { passive: true });
  element.addEventListener('touchend', onUp, { passive: true });

  const cleanup = () => {
    element.removeEventListener('mousedown', onDown);
    element.removeEventListener('touchstart', onDown);
    element.removeEventListener('mouseup', onUp);
    element.removeEventListener('touchend', onUp);
  };

  const id = `${element}-${callback}`;
  activeListeners.set(`swipe-${id}`, cleanup);

  return cleanup;
}

/**
 * Remove all active input listeners
 */
export function removeAllListeners() {
  for (const cleanup of activeListeners.values()) {
    cleanup();
  }
  activeListeners.clear();
}

/**
 * Prevent default touch behaviors on an element
 *
 * @param {HTMLElement} element - Element to disable touch actions on
 */
export function disableTouchActions(element) {
  element.style.touchAction = 'none';
  element.style.webkitTouchCallout = 'none';
  element.style.webkitUserSelect = 'none';
  element.style.userSelect = 'none';
}
