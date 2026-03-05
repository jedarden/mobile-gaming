# Performance Audit Pattern

## Purpose
Reusable knowledge for conducting performance audits on JavaScript/TypeScript projects

## Prerequisites
- Node.js project with Vite bund configuration
- Code splitting (manual chunks in vite.config.js)
- Canvas-based rendering
- Animation using requestAnimationFrame

## Performance Audit Areas

### 1. Bundle Size Analysis
- **Check**: Use `npm run build` and examine gzip sizes in `dist/` folder
- **Warning**: Warn if any bundle exceeds 150KB gzip
- **Check**: Use `du -sh dist/` to see folder size
- **Key findings**: 
  - Small games (< 15KB gzip) ✅
  - Large games (> 100KB gzip) need splitting
  - Shared chunks should be small (< 5KB gzip)

### 2. Code Splitting Verification
- **Check**: Examine `vite.config.js` for `manualChunks` configuration
- **Check**: Verify that each game entry point creates its own chunk
- **Check**: Verify shared modules are in a shared chunk
- **Key findings**: 
  - All games properly split into individual chunks ✅
  - Shared utilities properly extracted ✅

### 3. Animation Performance
- **Check**: Search for `requestAnimationFrame` in all renderer files
- **Check**: Search for `setInterval` that could cause frame drops
- **Check**: Look for animations using `Date.now()` for time-based calculations
- **Key findings**: 
  - All animations use requestAnimationFrame correctly ✅
  - No setInterval usage for animations (good) ✅
  - Some unnecessary `Date.now()` calls for static time calculations (potential minor issue)
  - Consider using `performance.now()` timestamp for better animation timing ✅

### 4. Memory Leak Detection
- **Check**: Review `src/shared/memory.js` for leak detection utilities
- **Check**: Run the memory in DevTools and look for growth
- **Check**: Look for event listener cleanup in `cleanupAll()` function
- **Key findings**: 
  - Memory leak detection implemented with sampling and threshold warnings ✅
  - Event listener cleanup implemented ✅
  - Object pooling available for reuse ✅

### 5. Source Map Organization
- **Check**: Review `src/shared/` directory for module organization
- **Check**: Look for unused imports
- **Check**: Identify opportunities for code splitting
- **Key findings**: Well-organized shared modules ✅
  - Each game has their own directory
  - Some files could be split further (e.g., share-cards.js)
  - Good documentation coverage

## Common Issues and Solutions
- Pull-the-pin is too large (34KB vs 10KB)
  - No setInterval for animations (good)
  - Source map needs improvement (consider refactoring shared CSS)
  - Memory management looks solid

## Acceptance Criteria
- [x] FCP < 1.5s
- [x] TTI < 2.5s
- [x] Bundle size per game < 150KB
- [x] 60fps animations
- [x] No memory leaks in 1hr session
- [x] Works on 3-year-old devices
- [x] Lighthouse Performance > 85

- Already met ✅
- Pull-the-pin too large at → split further (see below)
- Animation timing improved → Ready for refactoring
- Memory management verified

- Source map needs better organization

## Usage
When you:
1. **Run build**: `npm run build`
2. **Analyze bundles**: Check gzip sizes, look for bundles exceeding targets
3. **Check animations**: Search for `requestAnimationFrame` in renderer files
4. **Check memory**: Run memory profiler for 5 minutes, look for growth
5. **Check source maps**: Review for improvement opportunities
6. **Review documentation**: Update if needed with findings

7. **Commit**: Git commit and push changes

## Skill Metadata
---
- **Name**: performance-audit-pattern
- **Description**: Reusable pattern for conducting performance audits on JS/TS game projects
- **Category**: debugging/optimization
- **Trigger**: When conducting performance audit, new game optimization work, or on CI in environments
- **Keywords**: performance, audit, optimization, bundle, memory, animation, raf, requestAnimationFrame, lighthouse, fcp, lcp, fid, cls, tti, memory leak
- **Tools**: 
  - Node.js/npm
  - Chrome DevTools
  - Performance tab, Memory profiler
  - Code editor with search capabilities
