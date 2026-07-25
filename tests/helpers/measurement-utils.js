/**
 * Measurement Utilities for Test Setup/Teardown Profiling
 *
 * Provides utilities to measure time spent in hooks vs actual test execution.
 */

/**
 * Measure the execution time of a function
 * @param {Function} fn - Function to measure
 * @param {string} label - Label for the measurement
 * @returns {object} - Result with value and duration
 */
export function measure(fn, label = '') {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return {
    result,
    duration: end - start,
    label
  };
}

/**
 * Measure an async function's execution time
 * @param {Function} fn - Async function to measure
 * @param {string} label - Label for the measurement
 * @returns {Promise<object>} - Result with value and duration
 */
export async function measureAsync(fn, label = '') {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return {
    result,
    duration: end - start,
    label
  };
}

/**
 * Create a measured version of a beforeEach hook
 * @param {Function} hookFn - The beforeEach function to measure
 * @param {object} timings - Object to store timing data
 * @returns {Function} - Wrapped function that records timing
 */
export function measureBeforeEach(hookFn, timings) {
  return async function(...args) {
    const start = performance.now();
    await hookFn.apply(this, args);
    const end = performance.now();
    if (!timings.beforeEach) {
      timings.beforeEach = [];
    }
    timings.beforeEach.push(end - start);
  };
}

/**
 * Create a measured version of an afterEach hook
 * @param {Function} hookFn - The afterEach function to measure
 * @param {object} timings - Object to store timing data
 * @returns {Function} - Wrapped function that records timing
 */
export function measureAfterEach(hookFn, timings) {
  return async function(...args) {
    const start = performance.now();
    await hookFn.apply(this, args);
    const end = performance.now();
    if (!timings.afterEach) {
      timings.afterEach = [];
    }
    timings.afterEach.push(end - start);
  };
}

/**
 * Create a measured version of a beforeAll hook
 * @param {Function} hookFn - The beforeAll function to measure
 * @param {object} timings - Object to store timing data
 * @returns {Function} - Wrapped function that records timing
 */
export function measureBeforeAll(hookFn, timings) {
  return async function(...args) {
    const start = performance.now();
    await hookFn.apply(this, args);
    const end = performance.now();
    if (!timings.beforeAll) {
      timings.beforeAll = [];
    }
    timings.beforeAll.push(end - start);
  };
}

/**
 * Create a measured version of an afterAll hook
 * @param {Function} hookFn - The afterAll function to measure
 * @param {object} timings - Object to store timing data
 * @returns {Function} - Wrapped function that records timing
 */
export function measureAfterAll(hookFn, timings) {
  return async function(...args) {
    const start = performance.now();
    await hookFn.apply(this, args);
    const end = performance.now();
    if (!timings.afterAll) {
      timings.afterAll = [];
    }
    timings.afterAll.push(end - start);
  };
}

/**
 * Calculate statistics from an array of timing values
 * @param {number[]} timings - Array of timing values in milliseconds
 * @returns {object} - Statistics object
 */
export function calculateTimingStats(timings) {
  if (!timings || timings.length === 0) {
    return { count: 0, total: 0, average: 0, min: 0, max: 0, median: 0 };
  }

  const sorted = [...timings].sort((a, b) => a - b);
  const total = sorted.reduce((sum, val) => sum + val, 0);
  const count = sorted.length;
  const average = total / count;
  const median = count % 2 === 0
    ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : sorted[Math.floor(count / 2)];

  return {
    count,
    total,
    average,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median
  };
}

/**
 * Format milliseconds as a human-readable string
 * @param {number} ms - Time in milliseconds
 * @returns {string} - Formatted string
 */
export function formatMs(ms) {
  if (ms < 1) {
    return `${ms.toFixed(3)}ms`;
  } else if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else {
    return `${(ms / 1000).toFixed(3)}s`;
  }
}

/**
 * Format a percentage
 * @param {number} value - Value
 * @param {number} total - Total
 * @returns {string} - Formatted percentage
 */
export function formatPercent(value, total) {
  if (total === 0) return '0.00%';
  return ((value / total) * 100).toFixed(2) + '%';
}

/**
 * Timing collector for test suites
 */
export class TimingCollector {
  constructor() {
    this.timings = {
      beforeAll: [],
      beforeEach: [],
      testExecution: [],
      afterEach: [],
      afterAll: []
    };
  }

  recordBeforeAll(duration) {
    this.timings.beforeAll.push(duration);
  }

  recordBeforeEach(duration) {
    this.timings.beforeEach.push(duration);
  }

  recordTestExecution(duration) {
    this.timings.testExecution.push(duration);
  }

  recordAfterEach(duration) {
    this.timings.afterEach.push(duration);
  }

  recordAfterAll(duration) {
    this.timings.afterAll.push(duration);
  }

  getSummary() {
    const setupTime = [
      ...this.timings.beforeAll,
      ...this.timings.beforeEach
    ].reduce((sum, val) => sum + val, 0);

    const teardownTime = [
      ...this.timings.afterEach,
      ...this.timings.afterAll
    ].reduce((sum, val) => sum + val, 0);

    const testExecutionTime = this.timings.testExecution.reduce((sum, val) => sum + val, 0);

    const totalTime = setupTime + teardownTime + testExecutionTime;

    return {
      setup: {
        ...calculateTimingStats([...this.timings.beforeAll, ...this.timings.beforeEach]),
        totalTime: setupTime,
        percentage: totalTime > 0 ? (setupTime / totalTime) * 100 : 0
      },
      testExecution: {
        ...calculateTimingStats(this.timings.testExecution),
        totalTime: testExecutionTime,
        percentage: totalTime > 0 ? (testExecutionTime / totalTime) * 100 : 0
      },
      teardown: {
        ...calculateTimingStats([...this.timings.afterEach, ...this.timings.afterAll]),
        totalTime: teardownTime,
        percentage: totalTime > 0 ? (teardownTime / totalTime) * 100 : 0
      },
      total: totalTime,
      details: {
        beforeAll: calculateTimingStats(this.timings.beforeAll),
        beforeEach: calculateTimingStats(this.timings.beforeEach),
        afterEach: calculateTimingStats(this.timings.afterEach),
        afterAll: calculateTimingStats(this.timings.afterAll)
      }
    };
  }

  printSummary(label = '') {
    const summary = this.getSummary();
    console.log(`\n${label}Timing Summary:`);
    console.log(`  Setup (beforeAll + beforeEach): ${formatMs(summary.setup.totalTime)} (${summary.setup.percentage.toFixed(2)}%)`);
    console.log(`  Test Execution:                   ${formatMs(summary.testExecution.totalTime)} (${summary.testExecution.percentage.toFixed(2)}%)`);
    console.log(`  Teardown (afterEach + afterAll):  ${formatMs(summary.teardown.totalTime)} (${summary.teardown.percentage.toFixed(2)}%)`);
    console.log(`  Total:                            ${formatMs(summary.total)}`);
    console.log(`\nDetailed Breakdown:`);
    console.log(`  beforeAll:  ${formatMs(summary.details.beforeAll.total)} (${summary.details.beforeAll.count} calls, avg ${formatMs(summary.details.beforeAll.average)})`);
    console.log(`  beforeEach: ${formatMs(summary.details.beforeEach.total)} (${summary.details.beforeEach.count} calls, avg ${formatMs(summary.details.beforeEach.average)})`);
    console.log(`  afterEach:  ${formatMs(summary.details.afterEach.total)} (${summary.details.afterEach.count} calls, avg ${formatMs(summary.details.afterEach.average)})`);
    console.log(`  afterAll:   ${formatMs(summary.details.afterAll.total)} (${summary.details.afterAll.count} calls, avg ${formatMs(summary.details.afterAll.average)})`);
  }

  toJSON() {
    return {
      timings: this.timings,
      summary: this.getSummary()
    };
  }
}
