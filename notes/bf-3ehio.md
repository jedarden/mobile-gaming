# bf-3ehio: First CI Stability Run Results

## Summary
**First CI run FAILED** - Workflow did not pass successfully.

## Workflow Details
- **Workflow ID:** `mobile-gaming-ci-stability-1-mkjmr`
- **Submitted:** 2026-07-24T03:22:59Z
- **Final Phase:** Failed
- **Duration:** ~110 minutes (from creation to being listed as Failed)

## Failure Analysis

### Failed Steps
Both `unit` and `build` steps failed with exit code 1.

### Unit Test Failures (exit code 1)
Running tests locally revealed:
1. **Pull-the-pin solver failures:** 8 levels (ptp-006, ptp-009, ptp-011, ptp-014, ptp-016, ptp-018, ptp-019, ptp-020) are marked as solvable but the solver returns false
2. **Jelly-shift generator failure:** `TypeError: Cannot read properties of undefined (reading 'length')` - `level.walls` is undefined in some hand-crafted levels
3. **Bridge-race test:** Expected 10 levels but found only 9

### Build Failures (exit code 1)
Bundle size budget exceeded:
- **JS Budget:** 500 KB
- **Actual JS:**
  - `three-setup-ByYrO6bh.js`: 515.23 KB
  - `phaser-B61OQUcB.js`: 1,481.79 KB

## Additional Stability Runs
9 total stability runs were submitted; all failed:
- `mobile-gaming-ci-stability-1-mkjmr` (03:22:59Z) - Failed
- `mobile-gaming-ci-stability-2-qw769` (03:23:14Z) - Failed
- `mobile-gaming-ci-stability-3-rqqdk` (03:23:17Z) - Failed
- `mobile-gaming-ci-stability-run1-gcs7h` (03:49:00Z) - Failed
- `mobile-gaming-ci-stability-run2-b5zvg` (03:49:06Z) - Failed
- `mobile-gaming-ci-stability-run3-sftt6` (03:49:09Z) - Failed
- `mobile-gaming-ci-stability-run1-rv2gq` (05:00:00Z) - Failed
- `mobile-gaming-ci-stability-run2-bfhch` (05:00:05Z) - Failed
- `mobile-gaming-ci-stability-run3-sjnfq` (05:00:08Z) - Failed

## Conclusion
The first CI run **did not pass**. The stability analysis cannot confirm CI stability because:
1. Unit tests have multiple failures across pull-the-pin, jelly-shift, and bridge-race games
2. Build bundle sizes exceed the 500KB JS budget (phaser bundle is ~3x budget, three.js bundle exceeds budget)
3. All 9 submitted runs failed consistently

**CI is not stable.**
