# CI Monitoring Results - bf-68rjw

## Workflow
`mobile-gaming-ci-manual-gw6mc` (run 2026-07-23)

## Results

### ✅ Lint Step: PASSED
The lint step completed successfully with no issues.

### ❌ Build Step: FAILED (exit code 1)
The build step failed due to bundle size violations.

**Root Cause:** Phaser bundle size exceeds budget
- Phaser gzipped: 330.0 KB
- Budget for 2D games: 200 KB
- Over budget by: 130 KB

**Failed Games (all 2D):**
1. pull-the-pin: 346.9KB / 200KB ❌
2. water-sort: 338.1KB / 200KB ❌
3. brain-teaser: 339.4KB / 200KB ❌
4. parking-escape: 339.5KB / 200KB ❌
5. bus-jam: 340.6KB / 200KB ❌
6. merge-games: 336.5KB / 200KB ❌
7. satisfying-asmr: 335.8KB / 200KB ❌
8. save-the-character: 336.2KB / 200KB ❌

**Passed Games (all 3D):**
- crowd-runner: 132.3KB / 400KB ✅
- bridge-race: 132.9KB / 400KB ✅
- giant-runner: 130.7KB / 400KB ✅
- jelly-shift: 134.7KB / 400KB ✅
- makeover-run: 132.8KB / 400KB ✅

### ❌ Unit Tests: TIMED OUT
The unit test step timed out (Pod exceeded deadline) - this happened because the build step failed and the workflow continued anyway.

## Recommended Fixes

1. **Use Phaser Compressor** to strip unused Phaser subsystems
2. **Increase 2D budget** to 350KB if Phaser compression isn't feasible
3. **Dynamic imports** to code-split Phaser per game
4. **Tree-shaking** to remove unused Phaser code

The bundle size check script is at: `scripts/check-bundle-size.js`
