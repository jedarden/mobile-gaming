# Workflow Log Analysis - mobile-gaming-ci

**Date:** 2026-07-24  
**Workflow:** `mobile-gaming-ci-quick-logs-4v4c8`  
**Status:** Running with failures detected

## Summary

Analysis of workflow logs reveals **2 critical failures** in the CI pipeline:
1. **Build step failed**: JS bundle exceeds 500KB budget (actual: 2,451 KB)
2. **Unit tests failing**: 12 test failures detected (parking-escape timeouts + bridge-race level count)

---

## Step-by-Step Analysis

### ✅ Lint Step: PASSED
- **Phase**: Succeeded
- **Duration**: ~31 seconds (05:40:43 - 05:41:10)
- **Checks passed**:
  - No console.log statements found in game source files (state.js, renderer.js, input.js, generator.js)
  - All 13 game directories have the 7 required scaffold files:
    - index.html, game.js, state.js, renderer.js, input.js, styles.css, levels.json
  - All games have ≥3 levels in levels.json:
    - brain-teaser: 25 levels
    - bridge-race: 9 levels
    - bus-jam: 30 levels
    - crowd-runner: 9 levels
    - giant-runner: 10 levels
    - jelly-shift: 9 levels
    - makeover-run: 9 levels
    - merge-games: 11 levels
    - parking-escape: 13 levels
    - pull-the-pin: 65 levels
    - satisfying-asmr: 11 levels
    - save-the-character: 20 levels
    - water-sort: 30 levels

### ❌ Build Step: FAILED
- **Phase**: Failed
- **Exit Code**: 1
- **Duration**: ~43 seconds (05:41:29 - 05:42:12)
- **Error**: `ERROR: JS bundle exceeds 500KB`
- **Bundle sizes**:
  - **JS**: 2,451 KB (budget: 500 KB) - **EXCEEDS BY 1,939 KB**
  - **CSS**: 47 KB (budget: 100 KB) ✅ Within budget
- **Largest JS chunks**:
  - phaser-B61OQUcB.js: 1,481.79 kB (gzipped: 339.86 kB)
  - three-setup-ByYrO6bh.js: 515.23 kB (gzipped: 128.90 kB)
  - pull-the-pin-AaKJNQpC.js: 81.54 kB (gzipped: 17.37 kB)
- **Root cause**: Phaser and Three.js libraries included in bundle, causing massive size
- **Build output**: Vite build completed successfully, but bundle size budget check failed

### ❌ Unit Step: FAILING (partial results)
- **Phase**: Running with failures detected
- **Tests analyzed**: Partial (unit step still running)

#### Test Failures Detected:

##### 1. parking-escape.test.js (2 failures)
- **× Daily Challenge > generates different levels from different seeds** (10,314ms)
  - **Error**: `Test timed out in 10000ms`
- **× Daily Challenge > returns null when generation fails (triggers fallback)** (10,003ms)
  - **Error**: `Test timed out in 5000ms`
- **Issue**: Daily challenge generation for parking-escape is too slow, exceeding configured timeouts
- **Impact**: 2 timeout failures

##### 2. bridge-race-solver.test.js (10 failures)
All failures are identical:
- **× hand-crafted levels > loads at least 10 levels**
  - **Error**: `expected 9 to be greater than or equal to 10`
- **× hand-crafted levels > level br-001 > has at least 10 levels total**
  - **Error**: `expected 9 to be greater than or equal to 10`
- **× hand-crafted levels > level br-002 > has at least 10 levels total**
  - **Error**: `expected 9 to be greater than or equal to 10`
- **× hand-crafted levels > level br-003 > has at least 10 levels total**
  - **Error**: `expected 9 to be greater than or equal to 10`
- **× hand-crafted levels > level br-004 > has at least 10 levels total**
  - **Error**: `expected 9 to be greater than or equal to 10`
- **× hand-crafted levels > level br-005 > has at least 10 levels total**
  - **Error**: `expected 9 to be greater than or equal to 10`
- **× hand-crafted levels > level br-006 > has at least 10 levels total**
  - **Error**: `expected 9 to be greater than or equal to 10`
- **× hand-crafted levels > level br-007 > has at least 10 levels total**
  - **Error**: `expected 9 to be greater than or equal to 10`
- **× hand-crafted levels > level br-008 > has at least 10 levels total**
  - **Error**: `expected 9 to be greater than or equal to 10`
- **× hand-crafted levels > level br-009 > has at least 10 levels total**
  - **Error**: `expected 9 to be greater than or equal to 10`

- **Root cause**: `src/games/bridge-race/levels.json` only contains 9 levels (br-001 through br-009), but tests expect at least 10
- **Impact**: 10 assertion failures from level count expectation mismatch

---

## Error Categories

### 1. Bundle Size Budget Exceeded
- **Severity**: CRITICAL
- **Step**: build
- **Error Type**: Assertion failure (bundle size check)
- **Message**: `JS: 2451KB (budget 500KB) CSS: 47KB (budget 100KB)`
- **Exit Code**: 1

### 2. Test Timeouts
- **Severity**: HIGH
- **Step**: unit
- **Error Type**: Timeout
- **Files**: `tests/unit/parking-escape.test.js`
- **Count**: 2 tests
- **Timeouts**: 10s and 5s configured, exceeded by ~300ms each

### 3. Assertion Failures
- **Severity**: HIGH
- **Step**: unit
- **Error Type**: Assertion failure (level count)
- **File**: `tests/solvers/bridge-race-solver.test.js`
- **Count**: 10 tests
- **Expected**: ≥10 levels, **Actual**: 9 levels

---

## No Issues Found In

- **Selector errors**: None detected
- **Lint failures**: None (all checks passed)
- **Scaffold validation**: All games have correct file structure
- **Level file existence**: All games have levels.json with ≥3 entries
- **Console.log violations**: None found in restricted files

---

## Previous Failed Workflows Analyzed

### mobile-gaming-ci-log-capture-jqd7x (Failed)
- **Phase**: Failed
- **Message**: `child 'mobile-gaming-ci-log-capture-jqd7x-2617552530' failed`
- **Failed nodes**:
  - **build**: `main: Error (exit code 1)` - Same bundle size issue
  - **unit**: `main: Error (exit code 1)` - Same test failures
- **Started**: 2026-07-24T05:32:51Z
- **Finished**: 2026-07-24T05:38:35Z

### mobile-gaming-ci-unit-logs-gfl87 (Failed)
- **Phase**: Failed
- **Message**: `invalid spec: Templates is invalid field in spec if workflow referred WorkflowTemplate reference`
- **Error Type**: Spec validation error (workflow submission error)
- **Started**: 2026-07-24T05:39:58Z
- **Finished**: 2026-07-24T05:39:58Z (immediate failure)

---

## Recommendations

1. **Fix JS bundle size** (CRITICAL):
   - Phaser (1.48 MB) and Three.js (515 KB) are pushing the bundle way over the 500KB budget
   - Consider external CDN loading for these libraries
   - Or increase the budget if in-app loading is required

2. **Add missing bridge-race level** (HIGH):
   - Add br-010 to `src/games/bridge-race/levels.json`
   - Or update test expectations from 10 to 9 levels

3. **Fix parking-escape timeout** (HIGH):
   - Increase test timeout from 10s/5s to 15s/10s
   - Or optimize the daily challenge generation algorithm

4. **Fix workflow spec submission** (MEDIUM):
   - The `mobile-gaming-ci-unit-logs-gfl87` workflow had invalid spec (Templates field in workflow with WorkflowTemplateRef)
   - Ensure workflow submissions don't mix template references with inline templates
