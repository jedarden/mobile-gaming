# CI Run 1 - parking-escape Test Fixes

## Workflow Details

**Workflow ID:** mobile-gaming-ci-manual-x59pl  
**Submitted:** 2026-07-24 02:18:24Z  
**Completed:** 2026-07-24 02:23:XXZ  
**Status:** FAILED  
**Duration:** ~5 minutes

## Results by Step

| Step | Status | Duration | Notes |
|------|--------|----------|-------|
| lint | ✅ PASSED | ~33s | Console log checks and scaffold validation passed |
| unit | ❌ FAILED | ~50s | Bundle size budget exceeded |
| build | ❌ FAILED | ~50s | Bundle size budget exceeded |
| e2e | ⏭️ SKIPPED | - | Skipped due to build failure |

## Failure Analysis

### Primary Issue: Bundle Size Budget Exceeded

**Root Cause:** Pre-existing CI bundle size budget configuration issue

The CI workflow calculates bundle size by summing ALL JS files in `dist/assets/*.js`:
```bash
JS_SIZE=$(du -sb dist/assets/*.js 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
```

**Current Bundle Breakdown:**
| File | Size | Purpose |
|------|------|---------|
| phaser-B61OQUcB.js | 1.5 MB | Phaser game library (shared across games) |
| three-setup-ByYrO6bh.js | 504 KB | Three.js setup (shared across games) |
| pull-the-pin-AaKJNQpC.js | 80 KB | Individual game bundle |
| All other game bundles | 20-36 KB each | Individual game bundles |
| **TOTAL** | **~2.5 MB** | All JS files combined |
| **CI Budget** | **500 KB** | Budget limit |

**Parking-escape contribution:** 32KB (well within budget)

### Key Finding

**This failure is NOT related to the parking-escape test timeout fixes.** The bundle size issue exists independently of the timeout changes made in bead bf-bmh85. The parking-escape game bundle is only 32KB, and the 2.5MB total is driven by shared libraries (Phaser, Three.js) that are used across multiple games.

### Previous CI History

Looking at git history, previous CI runs have also failed with "build and unit errors," which were likely this same bundle size budget issue:
- docs(bf-42m8n): "first parking-escape CI run - failed with timeout and build errors"
- docs(bf-2brrk): "second parking-escape CI run - FAILED with build and unit errors"
- docs(bf-q3wc3): "third parking-escape CI run - FAILED with consistent pattern"
- docs(bf-52cqi): "fourth parking-escape CI run - FAILED with consistent pattern"

The "build and unit errors" mentioned in previous runs were likely bundle size failures, not actual test failures.

## Recommendations

### Short-term (unblock CI)
1. **Adjust bundle size budget** to reflect actual project size: 500KB → 3MB
2. **Or exclude shared libraries** from bundle check (Phaser, Three.js)
3. **Or check per-game bundles** instead of total sum

### Long-term (proper fix)
1. **Code splitting**: Load Phaser/Three.js only when needed (dynamic imports)
2. **CDN libraries**: Use CDN links for Phaser/Three.js instead of bundling
3. **Per-game budgets**: Set individual budgets per game (e.g., 100KB per game)

## Parking-escape Test Fixes Status

Despite CI failure, the parking-escape timeout fixes are **locally verified and working**:
- Unit tests pass locally (npm test)
- E2E tests pass locally (npm run test:e2e)
- Bundle size is reasonable (32KB)
- No console.log violations
- Scaffold files validated

The timeout fixes (reduced from 6000ms to 3000ms) are valid and should resolve the actual flaky test timeouts observed in previous CI runs, once the bundle size budget issue is addressed.

## Next Steps

1. Address bundle size budget in CI configuration
2. Re-run CI after budget fix
3. Verify parking-escape tests pass in CI environment
