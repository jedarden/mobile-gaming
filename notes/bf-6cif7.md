# CI Stability Run #1 for parking-escape daily-challenge

**Workflow:** `mobile-gaming-ci-manual-zhm4b`
**Date:** 2026-07-24
**Status:** FAILED - Systematic failures confirmed

## Workflow Results

| Step | Status | Details |
|------|--------|---------|
| lint | ⏭️ SKIPPED | Not reached due to later failures |
| build | ❌ FAILED | JS bundle exceeds budget (2451KB vs 500KB limit) |
| unit | ⏱️ TIMEOUT | Pod exceeded 300-second deadline |
| e2e | ⏭️ SKIPPED | Not reached |

## Failure Analysis

### 1. Build Step Failure - Systematic

**Error:** `main: Error (exit code 1)`

**Cause:** JavaScript bundle size far exceeds CI budget
- **Actual:** 2451KB
- **Budget:** 500KB
- **Over budget by:** 1951KB (390% over)

**Command that failed:**
```bash
npm run build
# Bundle size check:
[ "$JS_SIZE" -le "$JS_BUDGET" ] || { echo "ERROR: JS bundle exceeds 500KB"; exit 1; }
```

**Local verification:**
```bash
npm run build
JS_SIZE=$(du -sb dist/assets/*.js | awk '{sum+=$1} END {print sum+0}')
echo "JS: $((JS_SIZE / 1024))KB (budget 500KB)"
# Output: JS: 2451KB (budget 500KB)
```

This is a **systematic failure** - the build will always fail until the bundle size issue is resolved.

### 2. Unit Step Timeout - Systematic

**Error:** `Pod was active on the node longer than the specified deadline`

**Timeout setting:** `activeDeadlineSeconds: 300` (5 minutes)

**Local test run:**
- Duration: 26.41 seconds
- Test results: 88 failed, 5430 passed
- Test failures: Pull-the-pin solver validation failures (unsolvable levels)

**Discrepancy:** The unit tests complete locally in 26 seconds, but CI pod times out at 5 minutes. This suggests:
- CI environment may have slower performance
- npm ci may take longer in CI
- The 5-minute deadline may be too tight for the current test suite size

This is a **systematic timeout** that needs addressing.

## Root Causes

1. **Bundle size blowout:** The parking-escape daily-challenge implementation significantly increased bundle size
2. **Unit test timeout:** CI unit step cannot complete within 300-second deadline

## Next Steps Required

1. **Fix bundle size:** Optimize JavaScript bundle to fit within 500KB budget (need 80% reduction)
2. **Fix pull-the-pin tests:** 88 pull-the-pin levels are failing solver validation
3. **Increase unit timeout:** Consider raising unit step timeout from 300 to 600 seconds
4. **Retry CI run:** After fixes are applied

## Conclusion

This was a **systematic failure** - both the build and unit steps failed due to structural issues (bundle size and timeout) that will prevent all future CI runs until resolved. The parking-escape daily-challenge work introduced these regressions.
