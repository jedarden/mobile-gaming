// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',   // solvers are pure functions, no DOM needed
    setupFiles: ['./tests/setup.js'],  // Setup file for navigator mocking

    // Timeout guards to prevent CI hangs
    testTimeout: 300000,     // 300s per test (overrides default infinite)
    hookTimeout: 300000,    // 300s for beforeAll/afterAll/beforeEach/afterEach
    sequence: {
      timeout: 360000       // 6min overall test suite timeout
    },

    // Fail-fast mechanism - stop after first failure
    bail: 1,

    // Slow test logging for debugging
    slowTestThreshold: 3000, // Log tests slower than 3s
    reporters: ['verbose', './tests/timing-reporter.js'],  // Custom timing reporter

    // Isolation and concurrency
    isolate: true,           // Isolate each test file
    pool: 'threads',         // Use worker threads for parallel execution
    poolOptions: {
      threads: {
        singleThread: false,  // Enable parallel test execution
        minThreads: 2,        // Use at least 2 threads
        maxThreads: 4         // Limit to 4 threads to prevent resource exhaustion
      }
    },

    // Performance optimizations
    cache: true,             // Enable module caching
    clearMocks: true,        // Automatically clear mocks before each test
    restoreMocks: true,      // Automatically restore mocks after each test

    // Coverage options (for future use)
    // coverage: {
    //   provider: 'v8',
    //   reporter: ['text', 'json', 'html'],
    //   exclude: ['tests/', 'node_modules/']
    // }
  }
});
