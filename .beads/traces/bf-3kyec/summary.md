# E2E Wait Calls Inventory Summary

## Overview
Total wait calls identified: **140** across **23 files** (24 files scanned, 1 with no waits)

## Breakdown by Wait Type

| Wait Type | Count | Percentage |
|-----------|-------|------------|
| waitForSelector | 99 | 70.7% |
| waitForFunction | 39 | 27.9% |
| waitForResponse | 2 | 1.4% |
| page.waitFor(timeout) | 0 | 0% |
| waitForNavigation | 0 | 0% |

## Files Requiring Changes (ranked by wait count)

| File | Count | Primary Types |
|------|-------|---------------|
| `level-nav.spec.js` | 48 | waitForSelector (48) |
| `parking-escape.spec.js` | 15 | waitForSelector (13), waitForFunction (2) |
| `swipe-nav.spec.js` | 12 | waitForSelector (12) |
| `lifecycle.spec.js` | 12 | waitForSelector (12) |
| `fail-speedrun.spec.js` | 11 | waitForSelector (11) |
| `cross-game.spec.js` | 11 | waitForSelector (8), waitForFunction (3) |
| `brain-teaser.spec.js` | 6 | waitForSelector (5), waitForFunction (1) |
| `water-sort.spec.js` | 5 | waitForSelector (5) |
| `pull-the-pin.spec.js` | 5 | waitForSelector (5) |
| `gameplay-share.spec.js` | 3 | waitForSelector (3) |
| `jelly-shift.spec.js` | 2 | waitForSelector (2) |
| `recorder.spec.js` | 1 | waitForFunction (1) |
| `merge-games.spec.js` | 1 | waitForSelector (1) |
| `makeover-run.spec.js` | 1 | waitForSelector (1) |
| `giant-runner.spec.js` | 1 | waitForSelector (1) |
| `deploy-smoke.spec.js` | 1 | waitForFunction (1) |
| `crowd-runner.spec.js` | 1 | waitForSelector (1) |
| `bus-jam.spec.js` | 1 | waitForSelector (1) |
| `bridge-race.spec.js` | 1 | waitForSelector (1) |
| `save-the-character.spec.js` | 1 | waitForSelector (1) |
| `satisfying-asmr.spec.js` | 1 | waitForSelector (1) |
| `sync.spec.js` | 0 | - |
| `hub.spec.js` | 0 | - |

## Key Findings

### ✅ Positive Findings
1. **No fixed timeout waits found**: No `page.waitFor(timeout)` calls detected, which is excellent for test reliability
2. **Primary use of waitForSelector**: 70.7% of waits are for UI elements, which is the most reliable pattern
3. **Minimal network wait usage**: Only 2 `waitForResponse` calls found, indicating most tests don't wait on network requests

### ⚠️ Areas for Optimization
1. **level-nav.spec.js has 48 wait calls** - This is exceptionally high and should be reviewed for potential consolidation
2. **39 waitForFunction calls** - These custom condition waits may need review to ensure they're not brittle
3. **Network request handling** - Only `level-nav.spec.js` uses `waitForResponse`, but other files may need it if they interact with network-dependent features

## Recommendations

### High Priority
1. **Review level-nav.spec.js**: 48 wait calls suggest potential test structure issues - consider breaking into smaller tests or using more efficient wait patterns
2. **Audit waitForFunction calls**: Review the 39 custom function waits to ensure they're robust and not polling unnecessarily

### Medium Priority
3. **Consider network waits**: Tests that interact with features making API calls should use `waitForResponse` instead of arbitrary selector waits
4. **Standardize timeout patterns**: While no fixed timeouts were found, ensure all waits have appropriate timeout values configured

### Low Priority
5. **Test-specific optimization**: Files with 5+ wait calls (parking-escape, swipe-nav, lifecycle, fail-speedrun, cross-game) could benefit from review for wait pattern consolidation

## Network Request Analysis

Files that may need `waitForResponse` added (based on potential network interactions):
- All game load tests (currently using waitForSelector on game containers)
- Any tests interacting with features that make async API calls
- Tests for features like gameplay sharing, level saving, or sync functionality

## Next Steps

1. Use the detailed CSV (`.beads/traces/bf-3kyec/wait-inventory.csv`) to plan specific optimizations
2. Start with `level-nav.spec.js` given its high wait count
3. Audit `waitForFunction` calls for optimization opportunities
4. Consider adding `waitForResponse` for network-dependent test scenarios
