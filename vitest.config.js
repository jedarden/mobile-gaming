// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',   // solvers are pure functions, no DOM needed

    // Timeout guards to prevent CI hangs
    testTimeout: 30000,      // 30s per test (overrides default infinite)
    hookTimeout: 30000,      // 30s for beforeAll/afterAll/beforeEach/afterEach
    sequence: {
      timeout: 120000       // 2min overall test suite timeout
    },

    // Fail-fast mechanism - stop after first failure
    bail: 1,

    // Slow test logging for debugging
    slowTestThreshold: 3000, // Log tests slower than 3s
    reporters: ['verbose'],  // Show detailed test timing info

    // Isolation and concurrency
    isolate: true,           // Isolate each test file
    pool: 'threads',         // Use worker threads for parallel execution
    poolOptions: {
      threads: {
        singleThread: false  // Enable parallel test execution
      }
    }
  }
});
