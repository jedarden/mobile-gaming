/**
 * Performance.js - Performance Monitoring and Optimization
 *
 * Provides:
 * - Core Web Vitals measurement (FCP, LCP, FID, CLS, TTFB)
 * - Time to Interactive detection
 * - Memory usage monitoring
 * - Frame rate monitoring
 * - Performance budgets
 * - Automatic performance mode adjustments
 */

// Performance metrics storage
const metrics = {
  fcp: null,           // First Contentful Paint
  lcp: null,           // Largest Contentful Paint
  fid: null,           // First Input Delay
  cls: null,           // Cumulative Layout Shift
  ttfb: null,          // Time to First Byte
  tti: null,           // Time to Interactive
  memoryUsage: [],     // Memory samples over time
  frameRate: [],       // FPS samples
  longTasks: [],       // Tasks > 50ms
};

// Performance thresholds (from the task requirements)
const THRESHOLDS = {
  fcp: { good: 1500, needsImprovement: 3000 },  // ms
  lcp: { good: 2500, needsImprovement: 4000 },  // ms
  fid: { good: 100, needsImprovement: 300 },    // ms
  cls: { good: 0.1, needsImprovement: 0.25 },   // score
  ttfb: { good: 800, needsImprovement: 1800 },  // ms
  tti: { good: 2500, needsImprovement: 5000 },  // ms
};

// Callbacks for performance events
const callbacks = {
  onMetric: [],
  onLongTask: [],
  onMemoryWarning: [],
  onLowFrameRate: [],
};

// Performance monitoring state
let isMonitoring = false;
let frameRateInterval = null;
let memoryInterval = null;

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring() {
  if (typeof window === 'undefined') return;

  // Observe Core Web Vitals
  observeWebVitals();

  // Detect Time to Interactive
  detectTTI();

  // Monitor long tasks
  observeLongTasks();

  // Start periodic monitoring
  startPeriodicMonitoring();

  // Listen for visibility changes
  setupVisibilityHandler();

  isMonitoring = true;
  console.log('[Performance] Monitoring initialized');
}

/**
 * Observe Core Web Vitals using Performance Observer
 */
function observeWebVitals() {
  // First Contentful Paint
  const paintEntries = performance.getEntriesByType('paint');
  const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
  if (fcpEntry) {
    metrics.fcp = fcpEntry.startTime;
    emitMetric('fcp', metrics.fcp);
  }

  // Largest Contentful Paint
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        metrics.lcp = lastEntry.startTime;
        emitMetric('lcp', metrics.lcp);
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      // LCP not supported
    }

    // First Input Delay
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          metrics.fid = entry.processingStart - entry.startTime;
          emitMetric('fid', metrics.fid);
        });
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      // FID not supported
    }

    // Cumulative Layout Shift
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        metrics.cls = clsValue;
        emitMetric('cls', metrics.cls);
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      // CLS not supported
    }
  }

  // Time to First Byte
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  if (navigationEntry) {
    metrics.ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
    emitMetric('ttfb', metrics.ttfb);
  }
}

/**
 * Detect Time to Interactive
 */
function detectTTI() {
  if (document.readyState === 'complete') {
    metrics.tti = performance.now();
    emitMetric('tti', metrics.tti);
  } else {
    window.addEventListener('load', () => {
      // Wait for network idle (simplified)
      setTimeout(() => {
        metrics.tti = performance.now();
        emitMetric('tti', metrics.tti);
      }, 100);
    });
  }
}

/**
 * Observe long tasks (> 50ms)
 */
function observeLongTasks() {
  if (!('PerformanceObserver' in window)) return;

  try {
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        metrics.longTasks.push({
          startTime: entry.startTime,
          duration: entry.duration,
          name: entry.name,
        });

        // Emit long task event
        callbacks.onLongTask.forEach(cb => cb(entry));

        // Log warning for very long tasks
        if (entry.duration > 100) {
          console.warn(`[Performance] Long task detected: ${entry.duration.toFixed(0)}ms`);
        }
      }
    });
    longTaskObserver.observe({ type: 'longtask', buffered: true });
  } catch (e) {
    // Long task observer not supported
  }
}

/**
 * Start periodic monitoring (frame rate, memory)
 */
function startPeriodicMonitoring() {
  // Monitor frame rate
  let lastFrameTime = performance.now();
  let frameCount = 0;

  const measureFrameRate = () => {
    frameCount++;
    const now = performance.now();

    if (now - lastFrameTime >= 1000) {
      const fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
      metrics.frameRate.push({ time: now, fps });

      // Keep only last 60 samples (1 minute)
      if (metrics.frameRate.length > 60) {
        metrics.frameRate.shift();
      }

      // Warn on low frame rate
      if (fps < 30) {
        callbacks.onLowFrameRate.forEach(cb => cb(fps));
      }

      frameCount = 0;
      lastFrameTime = now;
    }

    if (isMonitoring) {
      requestAnimationFrame(measureFrameRate);
    }
  };

  requestAnimationFrame(measureFrameRate);

  // Monitor memory (if supported)
  if (performance.memory) {
    memoryInterval = setInterval(() => {
      const usedMB = performance.memory.usedJSHeapSize / (1024 * 1024);
      const totalMB = performance.memory.totalJSHeapSize / (1024 * 1024);
      const limitMB = performance.memory.jsHeapSizeLimit / (1024 * 1024);

      metrics.memoryUsage.push({
        time: Date.now(),
        used: usedMB,
        total: totalMB,
        limit: limitMB,
        percentUsed: (usedMB / limitMB) * 100,
      });

      // Keep only last 60 samples
      if (metrics.memoryUsage.length > 60) {
        metrics.memoryUsage.shift();
      }

      // Warn on high memory usage (> 80%)
      if (usedMB / limitMB > 0.8) {
        callbacks.onMemoryWarning.forEach(cb => cb({
          used: usedMB,
          limit: limitMB,
          percentUsed: (usedMB / limitMB) * 100,
        }));
      }
    }, 1000);
  }
}

/**
 * Setup visibility handler for performance optimization
 */
function setupVisibilityHandler() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Page is hidden - reduce monitoring frequency
      if (memoryInterval) {
        clearInterval(memoryInterval);
        memoryInterval = null;
      }
    } else {
      // Page is visible - resume monitoring
      if (!memoryInterval && performance.memory) {
        memoryInterval = setInterval(() => {
          const usedMB = performance.memory.usedJSHeapSize / (1024 * 1024);
          const limitMB = performance.memory.jsHeapSizeLimit / (1024 * 1024);

          metrics.memoryUsage.push({
            time: Date.now(),
            used: usedMB,
            percentUsed: (usedMB / limitMB) * 100,
          });

          if (metrics.memoryUsage.length > 60) {
            metrics.memoryUsage.shift();
          }
        }, 1000);
      }
    }
  });
}

/**
 * Emit metric event
 */
function emitMetric(name, value) {
  const rating = getMetricRating(name, value);
  callbacks.onMetric.forEach(cb => cb({ name, value, rating }));

  console.log(`[Performance] ${name}: ${value.toFixed(0)}ms (${rating})`);
}

/**
 * Get rating for a metric
 */
function getMetricRating(name, value) {
  const threshold = THRESHOLDS[name];
  if (!threshold) return 'unknown';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * Get current metrics
 */
export function getMetrics() {
  return { ...metrics };
}

/**
 * Get performance score (0-100)
 */
export function getPerformanceScore() {
  const scores = [];

  if (metrics.fcp) {
    scores.push(calculateScore(metrics.fcp, THRESHOLDS.fcp));
  }
  if (metrics.lcp) {
    scores.push(calculateScore(metrics.lcp, THRESHOLDS.lcp));
  }
  if (metrics.fid) {
    scores.push(calculateScore(metrics.fid, THRESHOLDS.fid));
  }
  if (metrics.cls) {
    scores.push(calculateScore(metrics.cls * 1000, { good: 100, needsImprovement: 250 }));
  }
  if (metrics.tti) {
    scores.push(calculateScore(metrics.tti, THRESHOLDS.tti));
  }

  if (scores.length === 0) return null;

  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/**
 * Calculate score from value and thresholds
 */
function calculateScore(value, threshold) {
  if (value <= threshold.good) return 100;
  if (value >= threshold.needsImprovement) return 0;

  const range = threshold.needsImprovement - threshold.good;
  const position = value - threshold.good;

  return Math.round(100 - (position / range) * 100);
}

/**
 * Check if device is low-end
 */
export function isLowEndDevice() {
  // Check hardware concurrency
  const cores = navigator.hardwareConcurrency || 2;
  if (cores <= 2) return true;

  // Check device memory (if available)
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) {
    return true;
  }

  // Check connection speed
  if (navigator.connection) {
    const connection = navigator.connection;
    if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
      return true;
    }
    if (connection.saveData) {
      return true;
    }
  }

  // Check if battery is low (if available)
  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      if (battery.level < 0.2 && !battery.charging) {
        return true;
      }
    });
  }

  return false;
}

/**
 * Get recommended performance mode
 */
export function getRecommendedPerformanceMode() {
  if (isLowEndDevice()) return 'low';

  const score = getPerformanceScore();
  if (score === null) return 'normal';
  if (score < 50) return 'low';
  if (score < 80) return 'normal';
  return 'high';
}

/**
 * Subscribe to performance events
 */
export function onPerformanceEvent(event, callback) {
  if (callbacks[event]) {
    callbacks[event].push(callback);
    return () => {
      const index = callbacks[event].indexOf(callback);
      if (index > -1) {
        callbacks[event].splice(index, 1);
      }
    };
  }
  return () => {};
}

/**
 * Stop monitoring
 */
export function stopMonitoring() {
  isMonitoring = false;
  if (memoryInterval) {
    clearInterval(memoryInterval);
    memoryInterval = null;
  }
}

/**
 * Force garbage collection hint (for testing)
 */
export function suggestGarbageCollection() {
  if (typeof window !== 'undefined' && window.gc) {
    window.gc();
  }
}

/**
 * Measure execution time of a function
 */
export async function measureTime(name, fn) {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);

  return { result, duration };
}

/**
 * Create a performance mark
 */
export function mark(name) {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name);
  }
}

/**
 * Measure between two marks
 */
export function measure(name, startMark, endMark) {
  if (typeof performance !== 'undefined' && performance.measure) {
    try {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name, 'measure');
      if (entries.length > 0) {
        return entries[entries.length - 1].duration;
      }
    } catch (e) {
      // Marks don't exist
    }
  }
  return null;
}

/**
 * Report metrics for debugging
 */
export function reportMetrics() {
  const score = getPerformanceScore();

  return {
    score,
    metrics: {
      FCP: metrics.fcp ? `${metrics.fcp.toFixed(0)}ms` : 'N/A',
      LCP: metrics.lcp ? `${metrics.lcp.toFixed(0)}ms` : 'N/A',
      FID: metrics.fid ? `${metrics.fid.toFixed(0)}ms` : 'N/A',
      CLS: metrics.cls ? metrics.cls.toFixed(3) : 'N/A',
      TTFB: metrics.ttfb ? `${metrics.ttfb.toFixed(0)}ms` : 'N/A',
      TTI: metrics.tti ? `${metrics.tti.toFixed(0)}ms` : 'N/A',
    },
    longTasks: metrics.longTasks.length,
    avgFrameRate: metrics.frameRate.length > 0
      ? Math.round(metrics.frameRate.reduce((a, b) => a + b.fps, 0) / metrics.frameRate.length)
      : 'N/A',
    memoryUsage: metrics.memoryUsage.length > 0
      ? `${metrics.memoryUsage[metrics.memoryUsage.length - 1].used.toFixed(1)}MB`
      : 'N/A',
    isLowEnd: isLowEndDevice(),
    recommendedMode: getRecommendedPerformanceMode(),
  };
}

// Export for debugging
if (typeof window !== 'undefined') {
  window.__performanceReport = reportMetrics;
}

export default {
  initPerformanceMonitoring,
  getMetrics,
  getPerformanceScore,
  isLowEndDevice,
  getRecommendedPerformanceMode,
  onPerformanceEvent,
  stopMonitoring,
  measureTime,
  mark,
  measure,
  reportMetrics,
  suggestGarbageCollection,
};
