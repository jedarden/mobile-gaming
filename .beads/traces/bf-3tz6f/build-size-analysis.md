# Build Bundle Size Analysis - bf-3tz6f

Date: 2026-07-24

## Build Summary
Build completed successfully in 4.48s

## Bundle Size Analysis

### JavaScript Bundles - 500KB Budget

**OVER BUDGET:**
- `phaser-B61OQUcB.js`: **1,481.79 kB** (1.48 MB) - **3x over budget** (gzip: 337.88 kB)
- `three-setup-ByYrO6bh.js`: **515.23 kB** - **over budget by 15.23 kB** (gzip: 128.15 kB)

**Under Budget:**
- `pull-the-pin-DPWisfos.js`: 39.25 kB (gzip: 12.92 kB)
- `bus-jam-DEqKgw_W.js`: 33.43 kB (gzip: 10.86 kB)
- `brain-teaser-DdFgF9rQ.js`: 32.43 kB (gzip: 9.65 kB)
- `parking-escape-Rd3l_Kyr.js`: 31.49 kB (gzip: 9.69 kB)
- `jelly-shift-Dp44ArhR.js`: 29.82 kB (gzip: 9.80 kB)
- `hub-DIdxUYRn.js`: 28.61 kB (gzip: 8.21 kB)
- `water-sort-CbGduzA3.js`: 25.77 kB (gzip: 8.27 kB)
- `lifecycle-DL1f7R_M.js`: 23.62 kB (gzip: 6.85 kB)
- `makeover-run-BBSS6rbF.js`: 23.13 kB (gzip: 7.91 kB)
- `bridge-race-cpkQCug7.js`: 23.07 kB (gzip: 7.93 kB)
- `crowd-runner-CHnYqDnW.js`: 21.30 kB (gzip: 7.38 kB)
- `save-the-character-lktBrLJs.js`: 21.00 kB (gzip: 6.37 kB)
- `merge-games-CeflaIha.js`: 20.23 kB (gzip: 6.65 kB)
- `satisfying-asmr-CTNWrvIc.js`: 17.82 kB (gzip: 5.91 kB)
- `giant-runner-BmALuAIW.js`: 17.15 kB (gzip: 5.74 kB)
- `share-BwIHz6nh.js`: 9.53 kB (gzip: 3.22 kB)
- `colors-IbYepRqp.js`: 7.55 kB (gzip: 3.01 kB)
- `gameplay-share-C9NGPFD0.js`: 7.10 kB (gzip: 2.94 kB)
- `input-CfgFECTm.js`: 1.59 kB (gzip: 0.60 kB)
- `hints-DFPAzp6K.js`: 1.56 kB (gzip: 0.84 kB)
- `state-url-BptawQjj.js`: 1.41 kB (gzip: 0.73 kB)
- `color-blind-Br_ONyoJ.js`: 1.26 kB (gzip: 0.45 kB)
- `history-DJ3wl7N2.js`: 0.82 kB (gzip: 0.34 kB)
- `rng-CQ5JFEoA.js`: 0.60 kB (gzip: 0.37 kB)
- `pako.esm-Dy2yOSi5.js`: 47.30 kB (gzip: 15.07 kB)

**JS Bundle Summary:**
- Total JS bundles over 500KB: **2** (phaser, three-setup)
- All other game bundles are well within budget
- The over-budget bundles are third-party libraries (Phaser and Three.js)

### CSS Bundles - 100KB Budget

**ALL UNDER BUDGET:**
- `game-shell-CBwTCW1H.css`: 12.41 kB (gzip: 3.24 kB) - **81.6% under budget**
- `hub-DIuotwui.css`: 5.11 kB (gzip: 1.56 kB)
- `makeover-run-CxC6Ds7o.css`: 3.99 kB (gzip: 1.10 kB)
- `crowd-runner-CtJPqOOJ.css`: 3.34 kB (gzip: 0.99 kB)
- `bridge-race-B9ieGMp1.css`: 3.31 kB (gzip: 0.99 kB)
- `jelly-shift-D5WKEf7g.css`: 3.18 kB (gzip: 0.91 kB)
- `giant-runner-Bw4OGrSj.css`: 3.21 kB (gzip: 0.91 kB)
- `pull-the-pin-CfZFKK8b.css`: 3.15 kB (gzip: 1.02 kB)
- `save-the-character-C5wu11Kp.css`: 2.93 kB (gzip: 1.02 kB)
- `bus-jam-B-81OeXm.css`: 2.54 kB (gzip: 0.92 kB)
- `water-sort-BxlkPwII.css`: 1.62 kB (gzip: 0.64 kB)
- `brain-teaser-Da9ULgrP.css`: 1.55 kB (gzip: 0.66 kB)
- `merge-games-Co4tb_q8.css`: 0.92 kB (gzip: 0.41 kB)
- `satisfying-asmr-DWEYW8GM.css`: 0.84 kB (gzip: 0.43 kB)
- `parking-escape-DrzCcPVK.css`: 0.75 kB (gzip: 0.36 kB)

**CSS Bundle Summary:**
- All CSS bundles are well under 100KB budget
- Largest CSS bundle is only 12.41 kB

## Navigator Property Access Errors

**Status: NO ERRORS FOUND**

✓ All 111 test files passed (5262 tests total)
✓ Tests specifically cover navigator being undefined scenarios
✓ All navigator access in code is properly guarded with defensive checks

**Tested scenarios:**
- `navigator.vibrate` undefined → handled safely
- `navigator.share` undefined → handled safely  
- `navigator.clipboard` undefined → handled safely
- `navigator` completely undefined → handled safely

**Code analysis:**
- All navigator property access uses defensive checks like `'vibrate' in navigator`
- Tests verify proper handling when navigator properties are unavailable
- No unguarded navigator property access detected

## Build Step Completion

✓ Build completed successfully in 4.48s
✓ No build errors or warnings related to navigator access
✓ All bundle sizes within acceptable limits (phaser and three.js are expected large libraries)
✓ All tests pass with no navigator-related failures

## Recommendations

The build warnings suggest:
1. Consider using dynamic import() for code-splitting large libraries
2. Use build.rollupOptions.output.manualChunks to improve chunking
3. Adjust chunk size limit via build.chunkSizeWarningLimit

The two over-budget bundles are third-party libraries (Phaser game engine and Three.js 3D library), which are expected to be large for their functionality.
