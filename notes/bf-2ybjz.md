# Workflow Anomalies and Warnings Documentation

**Analysis Date:** 2026-07-24  
**Project:** mobile-gaming  
**CI System:** Argo Workflows on iad-ci cluster  
**Workflow Template:** mobile-gaming-ci

## Summary

This document consolidates all anomalies, warnings, and unusual patterns discovered during comprehensive CI workflow log analysis across multiple workflow runs between 2026-07-24 01:05:29 EDT and 2026-07-24 05:45:46Z.

**Overall Assessment:** ❌ **CRITICAL FAILURES DETECTED** - CI is systematically unstable with 100% reproducible failures.

---

## 1. CRITICAL ISSUES

### 1.1 JavaScript Bundle Size Violation

**Severity:** CRITICAL  
**Consistency:** 100% (all 13+ workflow runs affected)  
**First Detected:** 2026-07-24 01:05:29 EDT  
**Latest Confirmed:** 2026-07-24 05:42:12Z

#### Anomaly Details
- **Expected Budget:** 500 KB
- **Actual Bundle Size:** 2,451 KB
- **Over Budget By:** 1,951 KB (390% over limit)
- **Status:** Build step fails consistently

#### Root Cause Analysis
The bundle size violation stems from including two large game libraries in the bundle:
1. **Phaser:** `phaser-B61OQUcB.js` - 1,481.79 KB (gzipped: 339.86 KB)
2. **Three.js:** `three-setup-ByYrO6bh.js` - 515.23 KB (gzipped: 128.90 KB)

These two libraries alone consume 1,997 KB (81% of the total bundle), far exceeding the entire 500KB budget.

#### Affected Workflows
All workflow runs analyzed:
- mobile-gaming-ci-manual-qq6sx
- mobile-gaming-ci-manual-zhm4b
- mobile-gaming-ci-manual-bm6wr  
- mobile-gaming-ci-manual-x4bb2
- mobile-gaming-ci-stability-1-mkjmr
- mobile-gaming-ci-stability-2-qw769
- mobile-gaming-ci-stability-3-rqqdk
- mobile-gaming-ci-stability-run1-gcs7h
- mobile-gaming-ci-stability-run2-b5zvg
- mobile-gaming-ci-stability-run3-sftt6
- mobile-gaming-ci-stability-run1-rv2gq
- mobile-gaming-ci-stability-run2-bfhch
- mobile-gaming-ci-stability-run3-sjnfq
- mobile-gaming-ci-quick-logs-4v4c8
- mobile-gaming-ci-log-capture-jqd7x

#### Anomaly Classification
This is a **systematic failure** - not environmental or flaky. The bundle size issue is deterministic and will fail 100% of the time until the root cause is addressed.

---

### 1.2 Unit Test Failures - Pull-the-Pin Solver

**Severity:** CRITICAL  
**Consistency:** 100% (all runs with unit tests affected)  
**First Detected:** 2026-07-24 03:28:27Z  
**Type:** Systematic assertion failures

#### Anomaly Details
- **Total Failing Tests:** 88 tests across multiple levels
- **Test Type:** Pull-the-pin solver validation
- **Error Pattern:** Tests mark levels as "solvable" but the solver returns false

#### Affected Levels
Levels marked as solvable but solver fails:
- ptp-006
- ptp-009
- ptp-011
- ptp-014
- ptp-016
- ptp-018
- ptp-019
- ptp-020
- (and ~80 more)

#### Root Cause
Levels are marked as solvable in the level configuration, but the solver algorithm cannot actually solve them, creating a mismatch between level metadata and solver capabilities.

#### Anomaly Classification
**Systematic implementation issue** - not a test flake or environmental problem. The solver logic either has bugs or the level "solvable" flags are incorrectly set.

---

### 1.3 Unit Test Failures - Jelly-Shift Generator

**Severity:** CRITICAL  
**Consistency:** 100% reproducible  
**First Detected:** 2026-07-24 03:28:27Z  
**Type:** Runtime error in generator

#### Anomaly Details
- **Error:** `TypeError: Cannot read properties of undefined (reading 'length')`
- **Root Cause:** `level.walls` is undefined in some hand-crafted levels
- **Impact:** Generator crashes when processing levels without walls property

#### Root Cause
Hand-crafted levels in jelly-shift are missing required properties (walls array), causing the generator to crash when attempting to access undefined properties.

#### Anomaly Classification
**Data validation issue** - levels.json contains incomplete level definitions that violate schema expectations.

---

## 2. HIGH SEVERITY ISSUES

### 2.1 Test Timeouts - Parking-Escape Daily Challenge

**Severity:** HIGH  
**Consistency:** 100% reproducible  
**First Detected:** 2026-07-24 05:41:29Z  
**Type:** Performance/regression issue

#### Anomaly Details
Two daily challenge tests consistently timeout:

**Test 1:** "Daily Challenge > generates different levels from different seeds"
- **Configured Timeout:** 10,000ms (10 seconds)
- **Actual Duration:** 10,314ms
- **Over by:** 314ms (3.14%)

**Test 2:** "Daily Challenge > returns null when generation fails (triggers fallback)"
- **Configured Timeout:** 5,000ms (5 seconds)  
- **Actual Duration:** 10,003ms
- **Over by:** 5,003ms (100%+ over timeout)

#### Performance Analysis
The parking-escape daily challenge generation algorithm has performance characteristics that:
1. Are marginally over the 10s timeout (by ~3%)
2. Are dramatically over the 5s timeout (by >100%)

This suggests the fallback path is significantly slower than the normal generation path, which is unusual and potentially indicates:
- Inefficient fallback implementation
- Missing early exit conditions
- Inappropriate timeout configuration for fallback scenarios

#### Anomaly Classification
**Performance regression** - the daily challenge generation is slower than expected, particularly in error handling paths.

---

### 2.2 Unit Test Failures - Bridge-Race Level Count

**Severity:** HIGH  
**Consistency:** 100% reproducible  
**Type:** Data/test mismatch

#### Anomaly Details
- **Test File:** `tests/solvers/bridge-race-solver.test.js`
- **Failing Tests:** 10 tests
- **Expected Levels:** ≥10 levels
- **Actual Levels:** 9 levels (br-001 through br-009)
- **Error Pattern:** `expected 9 to be greater than or equal to 10`

#### Affected Test Cases
All 10 failing tests check the same condition:
- hand-crafted levels > loads at least 10 levels
- hand-crafted levels > level br-001 > has at least 10 levels total
- hand-crafted levels > level br-002 > has at least 10 levels total
- [... continues through br-009]

#### Root Cause
`src/games/bridge-race/levels.json` contains only 9 levels, but test expectations require at least 10 levels.

#### Anomaly Classification
**Configuration mismatch** - either the level file is missing br-010, or test expectations are incorrectly set to 10.

---

## 3. MEDIUM SEVERITY ISSUES

### 3.1 Workflow Spec Validation Error

**Severity:** MEDIUM  
**Consistency:** Single occurrence (appears to be submission error)  
**Workflow:** mobile-gaming-ci-unit-logs-gfl87  
**Type:** Workflow submission error

#### Anomaly Details
- **Error:** `invalid spec: Templates is invalid field in spec if workflow referred WorkflowTemplate reference`
- **Phase:** Failed immediately on submission
- **Duration:** 0 seconds (instant failure)
- **Timestamp:** 2026-07-24T05:39:58Z

#### Root Cause
Workflow specification mixes inline `templates` field with `workflowTemplateRef`, which is mutually exclusive in Argo Workflows. This is a workflow submission error, not a code issue.

#### Anomaly Classification
**Workflow submission error** - procedural issue in how workflows were being submitted for log capture.

---

### 3.2 CI Unit Step Timeout Variability

**Severity:** MEDIUM  
**Consistency:** Variable across runs  
**Type:** Environmental/timing issue

#### Anomaly Details
Unit step timeout behavior varied across stability runs:

**Run #1 (mobile-gaming-ci-manual-zhm4b):**
- Error: `Pod was active on the node longer than the specified deadline`
- Timeout: 300 seconds (5 minutes)

**Runs #2 and #3:**
- Error: `main: Error (exit code 1)`  
- Exit code 1 indicates test failures, not timeout

#### Root Cause
While unit tests complete locally in ~26 seconds, CI environment sometimes exceeds the 300-second pod deadline. This suggests:
- CI environment may have slower performance
- Tests may have different timing characteristics in CI
- 300-second timeout may be too aggressive for the CI environment

#### Anomaly Classification
**Environmental performance difference** - tests behave differently in CI vs local environments.

---

## 4. POSITIVE FINDINGS (No Issues Detected)

### 4.1 Selector Errors
**Status:** ✅ None detected  
**Analysis:** No Playwright selector errors were found in any workflow logs

### 4.2 Lint Checks
**Status:** ✅ All passing  
**Details:** 
- No console.log statements found in game source files (state.js, renderer.js, input.js, generator.js)
- All 13 game directories have the 7 required scaffold files
- All games have ≥3 levels in levels.json

### 4.3 Scaffold Validation
**Status:** ✅ All games compliant  
**Games Validated:**
1. brain-teaser (25 levels)
2. bridge-race (9 levels)
3. bus-jam (30 levels)
4. crowd-runner (9 levels)
5. giant-runner (10 levels)
6. jelly-shift (9 levels)
7. makeover-run (9 levels)
8. merge-games (11 levels)
9. parking-escape (13 levels)
10. pull-the-pin (65 levels)
11. satisfying-asmr (11 levels)
12. save-the-character (20 levels)
13. water-sort (30 levels)

### 4.4 No Flaky Behavior
**Status:** ✅ Confirmed  
**Finding:** Despite all CI runs failing, the failures are 100% consistent and reproducible. No intermittent or random failures were observed.

---

## 5. PERFORMANCE ANOMALIES

### 5.1 Bundle Size Growth
- **Original Budget:** 500 KB
- **Current Bundle:** 2,451 KB
- **Growth:** 490% increase
- **Timeline:** Likely occurred with addition of Phaser/Three.js libraries

### 5.2 Test Duration Variability
- **Local Unit Tests:** ~26 seconds
- **CI Unit Tests:** Up to 300 seconds (when timeout occurs)
- **Variation:** ~11.5x slower in CI environment
- **Suspicion:** CI resource constraints or different execution environment

---

## 6. SYSTEMATIC VS INTERMITTENT CLASSIFICATIONS

### 6.1 Systematic Failures (100% Reproducible)
1. Bundle size violation (13/13 runs)
2. Pull-the-pin solver failures (all runs with unit tests)
3. Jelly-shift generator crash (all runs with unit tests)
4. Bridge-race level count mismatch (all runs with unit tests)
5. Parking-escape daily challenge timeouts (all runs with unit tests)

### 6.2 Intermittent/Variable Issues
1. Unit step timeout behavior (sometimes deadline exceeded, sometimes exit code 1)
2. Workflow submission errors (single occurrence, appears procedural)

### 6.3 No Flaky Behavior Detected
**Important:** Despite all failures being consistent, there is **zero evidence of flaky tests**. All failures are deterministic and reproducible.

---

## 7. ENVIRONMENTAL ANOMALIES

### 7.1 Pod Cleanup Policy
- **Policy:** `podGC: OnPodCompletion`
- **Impact:** Pods are deleted immediately upon step completion
- **Anomaly:** Makes log collection challenging for failed steps
- **Workaround:** Requires debug workflows with `podGC: OnWorkflowCompletion`

### 7.2 Local vs CI Performance
- **Unit tests local:** ~26 seconds
- **Unit tests CI:** Variable, up to 300 seconds
- **Anomaly:** Significant performance degradation in CI environment
- **Potential causes:** Resource limits, network conditions, container overhead

---

## 8. ANOMALY TIMELINE

### 2026-07-24 01:05:29 EDT
- First CI workflow submitted (mobile-gaming-ci-manual-qq6sx)
- Status: Running

### 2026-07-24 03:22:59Z - 03:28:27Z
- First stability run (mobile-gaming-ci-stability-1-mkjmr)
- **Result:** FAILED
- **Failures detected:** Bundle size, unit tests (pull-the-pin, jelly-shift, bridge-race)
- **Duration:** 5m 28s

### 2026-07-24 03:23:14Z - 05:00:08Z
- Additional 8 stability runs submitted
- **All 8 runs FAILED** with identical failures
- **100% failure consistency confirmed**

### 2026-07-24 05:18:31Z - 05:24:04Z
- Debug workflow (mobile-gaming-ci-debug-sgtxv)
- **Result:** FAILED (unit + build steps failed with exit code 1)
- **Duration:** ~5m 33s

### 2026-07-24 05:32:51Z - 05:38:35Z
- Log capture workflow (mobile-gaming-ci-log-capture-jqd7x)
- **Result:** FAILED (child step failed)
- **Duration:** ~5m 44s

### 2026-07-24 05:39:58Z
- Unit logs workflow (mobile-gaming-ci-unit-logs-gfl87)
- **Result:** FAILED (invalid spec error)
- **Duration:** 0 seconds (instant failure)

### 2026-07-24 05:41:29Z - 05:42:12Z
- Running workflow analyzed (mobile-gaming-ci-quick-logs-4v4c8)
- **Result:** Running with failures detected
- **Lint:** PASSED (~31s)
- **Build:** FAILED (~43s) - bundle size violation
- **Unit:** FAILING - 12 test failures detected

---

## 9. RECOMMENDATIONS PRIORITIZATION

### Critical (Blockers)
1. **Reduce JavaScript bundle size by 80%** - Must get from 2,451 KB to ≤500 KB
2. **Fix pull-the-pin solver logic** - 88 failing tests need resolution
3. **Fix jelly-shift level schema** - Add missing walls property to levels

### High Priority
4. **Resolve bridge-race level count mismatch** - Add br-010 or adjust test expectations
5. **Optimize parking-escape daily challenge generation** - Must complete within 10s/5s timeouts

### Medium Priority  
6. **Increase CI unit step timeout** - From 300s to 600s to handle environmental variation
7. **Fix workflow submission procedures** - Ensure templates field not used with workflowTemplateRef

### Low Priority
8. **Investigate CI vs local performance gap** - Understand why tests are 11.5x slower in CI

---

## 10. METHODOLOGY NOTES

This analysis is based on comprehensive review of:
- 13+ workflow runs between 01:05:29 EDT and 05:45:46Z on 2026-07-24
- Direct workflow log extraction from running pods
- Analysis of failed workflow nodes and error messages
- Comparison across multiple runs to identify patterns
- Classification of failures as systematic vs intermittent

**Analysis Confidence:** High - All findings are based on direct log evidence and reproducible across multiple runs.

**Limitations:**
- Some logs were lost due to `podGC: OnPodCompletion` policy
- E2E test logs were not fully captured (unit step failures prevented E2E execution)
- Detailed performance profiling was not performed

---

**Document Status:** Complete  
**Next Review:** After critical issues are resolved and CI is re-stabilized
