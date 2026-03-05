import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Performance optimizations
    minify: 'esbuild',
    target: 'es2020',
    // Chunk splitting for better caching
    rollupOptions: {
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
  publicDir: '../public',
  // Dev server optimizations
  server: {
    // Enable gzip compression
    compress: true
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
