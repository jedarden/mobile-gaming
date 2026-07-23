# CI E2E Test Status Investigation

## Date: 2026-07-23

## Summary

The mobile-gaming CI is **failing before E2E tests run**. The build step fails due to bundle size exceeding the budget, preventing E2E tests from executing.

## Current CI Failure Pattern

Based on investigation of recent workflow runs:

### Build Step Failure (exit code 1)
- **Phaser bundle size: 1,481.79 KB** (budget: 500KB)
- **three-setup bundle size: 515.23 KB** (budget: 500KB)
- Build step exits with error code 1 when checking bundle size budget

### Unit Test Timeout
- Unit tests are timing out (5-minute deadline exceeded)
- Unit test step: `npm test && npm run test:levels`

### Workflow Steps That Run
1. ✅ **lint** - Passes (checks for console.log and scaffold files)
2. ❌ **unit** - Times out (5-minute activeDeadlineSeconds)
3. ❌ **build** - Fails (bundle size exceeds 500KB budget)
4. ⏭️ **e2e** - Never runs (blocked by build failure)

## E2E Daily-Challenge Tests (Not Running)

The following E2E daily-challenge tests exist in `tests/e2e/level-nav.spec.js` but **never execute** because build fails first:

### Daily Challenge Indicator Tests (13 tests)
For each game in `GAMES_WITH_LEVEL_NAV`:
- water-sort
- parking-escape
- crowd-runner
- giant-runner
- bridge-race
- bus-jam
- jelly-shift
- pull-the-pin
- brain-teaser
- makeover-run
- merge-games
- save-the-character
- satisfying-asmr

Each game has:
1. "daily challenge indicator shows when available" - Checks `.mg-level-daily` element exists with star character
2. "daily shows green when completed" - Checks completion state styling

**Total: 26 daily-challenge E2E tests**

## Root Cause

The Phaser framework bundle (1,481.79 KB) far exceeds the 500KB JS budget enforced by CI. This is a known issue tracked in bead `bf-68rjw`:
- Recent commit: "docs(bf-68rjw): record CI monitoring results - Phaser bundle size exceeds budget"

## Recommendations

To unblock E2E testing:
1. **Increase bundle size budget** in workflow template to reflect actual bundle sizes
2. **Code-split Phaser** into lazy-loaded chunks to reduce initial bundle
3. **Investigate unit test timeout** - tests may need performance optimization or timeout increase

## Local Verification

Ran `npm run build` locally - bundle sizes match CI expectations:
- Phaser: 1,481.79 KB (exceeds budget by ~981KB)
- three-setup: 515.23 KB (exceeds budget by ~15KB)

All scaffold checks pass locally (13 games, all with required files and ≥3 levels).
