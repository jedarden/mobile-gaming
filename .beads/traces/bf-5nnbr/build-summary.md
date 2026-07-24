# Build Execution Summary

## Pod Information
- **Pod Name**: mobile-gaming-ci-unit-logs-bf69417-ht9nv-build-3136594858
- **Workflow**: mobile-gaming-ci-unit-logs-bf69417-ht9nv
- **Namespace**: argo-workflows
- **Cluster**: iad-ci
- **Status**: Completed

## Build Artifacts

### Bundle Sizes
- **JavaScript Bundle**: 2,467,840 bytes (2.41 MB / 2,410 KB)
  - Budget: 3,072,000 bytes (3 MB / 3,000 KB)
  - Status: ✅ Within budget (80% of budget)
  
- **CSS Bundle**: 48,838 bytes (47 KB)
  - Budget: 153,600 bytes (150 KB)
  - Status: ✅ Within budget (31% of budget)

### Build Performance
- **Build Duration**: 20.98 seconds
- **Vite Version**: 6.4.3
- **Modules Transformed**: 137
- **Build Status**: Build passed!

### Largest Assets
1. **phaser-B61OQUcB.js**: 1,481.79 kB (gzip: 339.86 kB) - Game engine library
2. **three-setup-ByYrO6bh.js**: 515.23 kB (gzip: 128.90 kB) - Three.js setup
3. **pako.esm-Dy2yOSi5.js**: 47.30 kB (gzip: 15.14 kB) - Compression library

### Assets Generated
- **27 HTML files** (game pages + hub)
- **15 CSS files** (game-specific + shared)
- **27 JS files** (game logic + shared libraries)

### Games Built
1. pull-the-pin (3.19 kB HTML)
2. save-the-character (4.58 kB HTML)
3. satisfying-asmr (5.33 kB HTML)
4. merge-games (5.63 kB HTML)
5. brain-teaser (5.78 kB HTML)
6. bridge-race (6.29 kB HTML)
7. makeover-run (6.30 kB HTML)
8. giant-runner (6.32 kB HTML)
9. jelly-shift (6.37 kB HTML)
10. crowd-runner (6.38 kB HTML)
11. parking-escape (6.59 kB HTML)
12. bus-jam (6.71 kB HTML)
13. water-sort (7.02 kB HTML)
14. hub (15.83 kB HTML)

## Build Environment
- **Node.js**: npm version 10.8.2
- **Dependencies**: 181 packages installed
- **Git**: branch main, shallow clone depth 1

## Notes
- Build warnings about chunks larger than 500 kB (phaser library)
- One high severity security vulnerability detected in dependencies
- All CI bundle size budgets passed successfully
