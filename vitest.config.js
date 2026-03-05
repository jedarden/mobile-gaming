import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Use happy-dom for browser-like testing environment
    environment: 'happy-dom',

    // Global test APIs (describe, it, expect, etc.)
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/shared/**/*.js',
        'src/games/**/state.js'
      ],
      exclude: [
        'node_modules/**',
        'src/games/**/audio.js',
        'src/games/**/renderer.js'
      ]
    },

    // Test file patterns - only Vitest tests, exclude legacy Node tests
    include: ['tests/**/*.test.js'],
    exclude: ['tests/rng.test.js', 'tests/history.test.js', 'tests/infinite-mode.test.js'],

    // Setup files to run before tests
    setupFiles: ['./tests/setup.js']
  }
})
