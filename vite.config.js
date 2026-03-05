import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Source maps for debugging
    sourcemap: true,
    // Performance optimizations
    minify: 'esbuild',
    target: 'es2020',
    // Multi-page application with all game entry points
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        'water-sort': resolve(__dirname, 'src/games/water-sort/index.html'),
        'parking-escape': resolve(__dirname, 'src/games/parking-escape/index.html'),
        'bus-jam': resolve(__dirname, 'src/games/bus-jam/index.html'),
        'pull-the-pin': resolve(__dirname, 'src/games/pull-the-pin/index.html'),
      },
      output: {
        manualChunks: {
          // Shared game utilities
          shared: [
            './src/shared/storage.js',
            './src/shared/meta.js',
            './src/shared/daily.js',
            './src/shared/achievements.js',
            './src/shared/accessibility.js',
            './src/shared/rng.js'
          ]
        }
      }
    },
    // Report compressed sizes
    reportCompressedSize: true,
    // Chunk size warnings
    chunkSizeWarningLimit: 150
  },
  // Dev server configuration
  server: {
    port: 5173,
    open: true,
    // Enable gzip compression
    compress: true
  },
  // Preview server for production builds
  preview: {
    port: 5173
  },
  // CSS optimizations
  css: {
    devSourcemap: true
  },
  // Build optimizations
  esbuild: {
    // Minify options
    legalComments: 'none'
  }
})
