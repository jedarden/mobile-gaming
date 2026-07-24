# Build Step Logs from mobile-gaming-ci

## Task
Retrieve and examine build step logs from the mobile-gaming-ci workflow to capture bundle size information.

## Build Output Retrieved

Source: Trace file from bead bf-1s6yi (local build execution)

### Build Summary
- **Build Status**: ✅ Success
- **Build Time**: 4.48s
- **Vite Version**: 6.4.3
- **Modules Transformed**: 137

### Bundle Size Analysis

#### JavaScript Bundles
- **Total JS Size**: ~2,196 kB (2.2 MB) uncompressed
- **Largest Chunks**:
  - `phaser-B61OQUcB.js`: 1,481.79 kB (1.4 MB) │ gzip: 337.88 kB
  - `three-setup-ByYrO6bh.js`: 515.23 kB │ gzip: 128.15 kB
  - `pull-the-pin-DPWisfos.js`: 39.25 kB │ gzip: 12.92 kB
  - `bus-jam-DEqKgw_W.js`: 33.43 kB │ gzip: 10.86 kB
  - `brain-teaser-DdFgF9rQ.js`: 32.43 kB │ gzip: 9.65 kB

#### CSS Bundles
- **Total CSS Size**: ~41 kB uncompressed
- **Largest Styles**:
  - `game-shell-CBwTCW1H.css`: 12.41 kB │ gzip: 3.24 kB
  - `hub-DIuotwui.css`: 5.11 kB │ gzip: 1.56 kB
  - `makeover-run-CxC6Ds7o.css`: 3.99 kB │ gzip: 1.10 kB

#### Game Pages (HTML)
- `src/hub/index.html`: 15.83 kB │ gzip: 3.16 kB
- `src/games/water-sort/index.html`: 7.02 kB │ gzip: 1.91 kB
- `src/games/bus-jam/index.html`: 6.71 kB │ gzip: 1.85 kB
- (All game pages under 8 kB)

### Bundle Size Warnings

⚠️ **Chunks exceeding 500 kB limit**:
- `phaser-B61OQUcB.js`: 1,481.79 kB (Exceeds by ~981 kB)
- `three-setup-ByYrO6bh.js`: 515.23 kB (Exceeds by ~15 kB)

**Recommendations from Vite**:
- Use dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit via build.chunkSizeWarningLimit

### CI Budget Status
The current bundle sizes exceed the CI budget limits:
- **JS Budget**: 500 KB (current: ~2,196 KB - **4.4x over budget**)
- **CSS Budget**: 100 KB (current: ~41 KB - **within budget**)

### Build Artifacts
All assets successfully generated to `dist/` directory with proper chunking and hash-based filenames for cache busting.

## Notes
- Build completed successfully with no errors
- Main size concern is the Phaser game engine (1.4 MB) which is expected for game frameworks
- Three.js setup bundle is also large but expected for 3D graphics
- Individual game bundles are well-sized (20-40 kB each)
- CSS is very efficient and well under budget