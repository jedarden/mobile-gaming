/**
 * Memory.js - Memory Management Utilities
 *
 * Provides:
 * - Event listener tracking and cleanup
 * - Timer tracking and cleanup
 * - Object pooling for game objects
 * - Automatic cleanup on page hide
 * - Memory leak detection helpers
 */

// Tracked resources for cleanup
const trackedListeners = new Map();
const trackedTimers = new Map();
const trackedIntervals = new Map();
const trackedRAFs = new Map();
const objectPools = new Map();

// Auto-incrementing ID for tracking
let trackingId = 0;

/**
 * Track an event listener for cleanup
 * @param {EventTarget} target - Element or object to listen on
 * @param {string} type - Event type
 * @param {Function} listener - Event listener
 * @param {Object} options - Event listener options
 * @returns {number} Tracking ID for cleanup
 */
export function trackEventListener(target, type, listener, options = {}) {
  const id = ++trackingId;

  target.addEventListener(type, listener, options);

  trackedListeners.set(id, {
    target,
    type,
    listener,
    options,
  });

  return id;
}

/**
 * Remove a tracked event listener
 * @param {number} id - Tracking ID
 */
export function untrackEventListener(id) {
  const tracked = trackedListeners.get(id);
  if (tracked) {
    tracked.target.removeEventListener(tracked.type, tracked.listener, tracked.options);
    trackedListeners.delete(id);
  }
}

/**
 * Track a timeout for cleanup
 * @param {Function} callback - Timeout callback
 * @param {number} delay - Delay in ms
 * @returns {number} Tracking ID
 */
export function trackTimeout(callback, delay) {
  const id = ++trackingId;
  const timeoutId = setTimeout(() => {
    trackedTimers.delete(id);
    callback();
  }, delay);

  trackedTimers.set(id, timeoutId);

  return id;
}

/**
 * Clear a tracked timeout
 * @param {number} id - Tracking ID
 */
export function clearTrackedTimeout(id) {
  const timeoutId = trackedTimers.get(id);
  if (timeoutId) {
    clearTimeout(timeoutId);
    trackedTimers.delete(id);
  }
}

/**
 * Track an interval for cleanup
 * @param {Function} callback - Interval callback
 * @param {number} delay - Interval in ms
 * @returns {number} Tracking ID
 */
export function trackInterval(callback, delay) {
  const id = ++trackingId;
  const intervalId = setInterval(callback, delay);

  trackedIntervals.set(id, intervalId);

  return id;
}

/**
 * Clear a tracked interval
 * @param {number} id - Tracking ID
 */
export function clearTrackedInterval(id) {
  const intervalId = trackedIntervals.get(id);
  if (intervalId) {
    clearInterval(intervalId);
    trackedIntervals.delete(id);
  }
}

/**
 * Track a requestAnimationFrame for cleanup
 * @param {Function} callback - Animation frame callback
 * @returns {number} Tracking ID
 */
export function trackRAF(callback) {
  const id = ++trackingId;
  const rafId = requestAnimationFrame(callback);

  trackedRAFs.set(id, rafId);

  return id;
}

/**
 * Cancel a tracked RAF
 * @param {number} id - Tracking ID
 */
export function cancelTrackedRAF(id) {
  const rafId = trackedRAFs.get(id);
  if (rafId) {
    cancelAnimationFrame(rafId);
    trackedRAFs.delete(id);
  }
}

/**
 * Create an object pool for reusing objects
 * @param {string} name - Pool name
 * @param {Function} factory - Factory function to create new objects
 * @param {Function} reset - Reset function to prepare objects for reuse
 * @param {number} maxSize - Maximum pool size
 * @returns {Object} Pool interface
 */
export function createObjectPool(name, factory, reset, maxSize = 100) {
  const pool = [];
  let activeCount = 0;

  const poolInterface = {
    /**
     * Get an object from the pool (or create new)
     */
    acquire(...args) {
      let obj;
      if (pool.length > 0) {
        obj = pool.pop();
        reset(obj, ...args);
      } else {
        obj = factory(...args);
      }
      activeCount++;
      return obj;
    },

    /**
     * Return an object to the pool
     */
    release(obj) {
      if (pool.length < maxSize) {
        pool.push(obj);
      }
      activeCount--;
    },

    /**
     * Clear the pool
     */
    clear() {
      pool.length = 0;
      activeCount = 0;
    },

    /**
     * Get pool statistics
     */
    stats() {
      return {
        name,
        available: pool.length,
        active: activeCount,
        total: pool.length + activeCount,
        maxSize,
      };
    },
  };

  objectPools.set(name, poolInterface);
  return poolInterface;
}

/**
 * Get pool by name
 * @param {string} name - Pool name
 * @returns {Object|undefined} Pool interface
 */
export function getPool(name) {
  return objectPools.get(name);
}

/**
 * Clear all pools
 */
export function clearAllPools() {
  objectPools.forEach(pool => pool.clear());
}

/**
 * Clean up all tracked resources
 * @param {Object} options - Cleanup options
 * @param {boolean} options.listeners - Clean up event listeners
 * @param {boolean} options.timers - Clean up timeouts
 * @param {boolean} options.intervals - Clean up intervals
 * @param {boolean} options.rafs - Clean up animation frames
 * @param {boolean} options.pools - Clean up object pools
 */
export function cleanupAll(options = {}) {
  const {
    listeners = true,
    timers = true,
    intervals = true,
    rafs = true,
    pools = true,
  } = options;

  if (listeners) {
    trackedListeners.forEach((tracked, id) => {
      tracked.target.removeEventListener(tracked.type, tracked.listener, tracked.options);
    });
    trackedListeners.clear();
  }

  if (timers) {
    trackedTimers.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    trackedTimers.clear();
  }

  if (intervals) {
    trackedIntervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    trackedIntervals.clear();
  }

  if (rafs) {
    trackedRAFs.forEach((rafId) => {
      cancelAnimationFrame(rafId);
    });
    trackedRAFs.clear();
  }

  if (pools) {
    clearAllPools();
  }

  console.log('[Memory] Cleanup completed');
}

/**
 * Setup automatic cleanup on page hide/visibility change
 */
export function setupAutoCleanup() {
  // Cleanup when page is hidden
  trackEventListener(document, 'visibilitychange', () => {
    if (document.hidden) {
      // Don't cleanup everything, just reduce memory usage
      clearAllPools();
    }
  });

  // Cleanup before page unload
  trackEventListener(window, 'beforeunload', () => {
    cleanupAll();
  });

  // Cleanup on page hide (mobile browsers)
  trackEventListener(window, 'pagehide', () => {
    cleanupAll();
  });
}

/**
 * Get memory usage statistics
 */
export function getMemoryStats() {
  const stats = {
    trackedListeners: trackedListeners.size,
    trackedTimers: trackedTimers.size,
    trackedIntervals: trackedIntervals.size,
    trackedRAFs: trackedRAFs.size,
    pools: {},
    jsHeapSize: null,
  };

  // Pool stats
  objectPools.forEach((pool, name) => {
    stats.pools[name] = pool.stats();
  });

  // Browser memory API (if available)
  if (performance.memory) {
    stats.jsHeapSize = {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit,
    };
  }

  return stats;
}

/**
 * Detect potential memory leaks
 * @param {number} sampleInterval - How often to sample (ms)
 * @param {number} threshold - Growth threshold to trigger warning (MB)
 * @returns {Function} Cleanup function
 */
export function detectMemoryLeak(sampleInterval = 5000, threshold = 10) {
  if (!performance.memory) {
    console.warn('[Memory] Memory API not available for leak detection');
    return () => {};
  }

  let samples = [];
  let intervalId;

  const check = () => {
    const used = performance.memory.usedJSHeapSize / (1024 * 1024);
    samples.push(used);

    // Keep last 12 samples (1 minute at 5s interval)
    if (samples.length > 12) {
      samples.shift();
    }

    // Check for consistent growth
    if (samples.length >= 6) {
      const firstHalf = samples.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      const secondHalf = samples.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const growth = secondHalf - firstHalf;

      if (growth > threshold) {
        console.warn(`[Memory] Potential memory leak detected: ${growth.toFixed(1)}MB growth over 30s`);
        console.warn('[Memory] Stats:', getMemoryStats());
      }
    }
  };

  intervalId = setInterval(check, sampleInterval);

  return () => {
    clearInterval(intervalId);
    samples = [];
  };
}

/**
 * Create a weak reference helper for objects
 * (Useful for caching without preventing garbage collection)
 */
export function createWeakCache() {
  const cache = new Map();
  const registry = new FinalizationRegistry((key) => {
    cache.delete(key);
  });

  return {
    get(key) {
      const ref = cache.get(key);
      return ref?.deref();
    },

    set(key, value) {
      const ref = new WeakRef(value);
      cache.set(key, ref);
      registry.register(value, key);
    },

    has(key) {
      const ref = cache.get(key);
      return ref?.deref() !== undefined;
    },

    delete(key) {
      cache.delete(key);
    },

    clear() {
      cache.clear();
    },
  };
}

/**
 * Debounce function with automatic cleanup
 */
export function createDebounced(fn, delay) {
  let timeoutId = null;

  const debounced = (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  debounced.flush = (...args) => {
    debounced.cancel();
    fn(...args);
  };

  return debounced;
}

/**
 * Throttle function with automatic cleanup
 */
export function createThrottled(fn, limit) {
  let inThrottle = false;
  let lastArgs = null;

  const throttled = (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          throttled(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };

  throttled.cancel = () => {
    lastArgs = null;
  };

  return throttled;
}

// Initialize auto-cleanup on module load
if (typeof window !== 'undefined') {
  setupAutoCleanup();
}

export default {
  trackEventListener,
  untrackEventListener,
  trackTimeout,
  clearTrackedTimeout,
  trackInterval,
  clearTrackedInterval,
  trackRAF,
  cancelTrackedRAF,
  createObjectPool,
  getPool,
  clearAllPools,
  cleanupAll,
  setupAutoCleanup,
  getMemoryStats,
  detectMemoryLeak,
  createWeakCache,
  createDebounced,
  createThrottled,
};
