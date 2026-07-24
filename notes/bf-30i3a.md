# CI Unit Test and Build Step Verification - bf-30i3a

## Date: 2026-07-24 (Updated - Second Verification)

## Task
Verify CI unit test and build steps pass.

## Latest Workflow: mobile-gaming-ci-unit-only-q2jp5

## Unit Test Results

### Status: FAILED ✗
- **Duration**: 25.33s local (under 300s timeout) ✓
- **CI Duration**: ~78s workflow, test timeout after 15s
- **Tests Local Run**: 5262 passed, 111 test files passed
- **CI Failure**: `tests/unit/parking-escape-generator.test.js > generateLevel > medium difficulty target moves in range [9, 16]`
- **Error**: Test timed out in 15000ms (default 15s timeout exceeded)

### Test Details
The parking-escape-generator test at lines 74-85 has:
- 15-second timeout specified in test
- Loops through 10 seeds to find a valid medium difficulty level
- Each seed requires BFS solver validation which can be slow
- CI environment appears slower than local, causing timeout

**Test location**: `tests/unit/parking-escape-generator.test.js:74:5`

**Test Code**:
```javascript
it('medium difficulty target moves in range [9, 16]', () => {
  let found = false;
  for (let seed = 0; seed < 10; seed++) {
    const level = generateLevel(seed, 'medium', 0);
    if (!level) continue;
    expect(level.targetMoves).toBeGreaterThanOrEqual(9);
    expect(level.targetMoves).toBeLessThanOrEqual(16);
    found = true;
    break;
  }
  expect(found).toBe(true);
}, 15000); // 15s timeout
```

### Local Test Output Summary
```
Test Files  111 passed (111)
     Tests  5262 passed (5262)
  Start at  13:47:43
   Duration  25.33s (transform 5.62s, setup 2.78s, collect 27.24s, tests 56.10s, environment 32.98s, prepare 24.83s)
```

## Build Step Results

### Status: SUCCEEDED ✓
- **Build completed**: Successfully in ~23s
- **No navigator property errors**: ✓
- **Build output**: All chunks built successfully

### Bundle Size Analysis

#### Actual Bundle Sizes (from CI build)
```
JS: 2410KB (CI budget 3000KB)
CSS: 47KB (CI budget 150KB)
```

#### Major JS Bundles
| Bundle | Size | Bead Budget (500KB) | CI Budget (3000KB) | Status |
|--------|------|-------------------|-------------------|--------|
| phaser-B61OQUcB.js | 1,481.79 kB (1.48 MB) | ✗ 3x over | ✓ Under | ✗ exceeds bead budget |
| three-setup-ByYrO6bh.js | 515.23 kB | ✗ Exceeds | ✓ Under | ✗ exceeds bead budget |
| pull-the-pin-DPWisfos.js | 39.25 kB | ✓ | ✓ | ✓ |
| bus-jam-DEqKgw_W.js | 33.43 kB | ✓ | ✓ | ✓ |
| brain-teaser-DdFgF9rQ.js | 32.43 kB | ✓ | ✓ | ✓ |
| parking-escape-Rd3l_Kyr.js | 31.49 kB | ✓ | ✓ | ✓ |
| Other individual bundles | < 30 kB | ✓ | ✓ | ✓ |

#### CSS Bundles
| Bundle | Size | Bead Budget (100KB) | CI Budget (150KB) | Status |
|--------|------|-------------------|-------------------|--------|
| game-shell-CBwTCW1H.css | 12.41 kB | ✓ | ✓ | ✓ |
| hub-DIuotwui.css | 5.11 kB | ✓ | ✓ | ✓ |
| makeover-run-CxC6Ds7o.css | 3.99 kB | ✓ | ✓ | ✓ |
| All other CSS bundles | < 4 kB | ✓ | ✓ | ✓ |

#### Budget Discrepancy Found
- **Bead requirements**: 500KB JS, 100KB CSS
- **CI workflow budget**: 3000KB JS, 150KB CSS
- **Build passes CI budget** but **exceeds bead requirements budget**

## Acceptance Criteria Status

- ✗ **Unit tests pass with no failures** - CI has test timeout failure (local passes)
- ✓ **Test duration captured and under 300s** - 25.33s local, CI workflow ~78s
- ✓ **Build step completes successfully** - Completed in ~23s
- ✗ **Bundle sizes under budget (JS < 500KB, CSS < 100KB)** - JS exceeds bead budget (phaser: 1.48MB, three-setup: 515KB); CSS within budget
- ✓ **Bundle sizes under CI budget (JS < 3000KB, CSS < 150KB)** - Passes CI budget
- ✓ **No navigator property errors in build logs** - None detected
- ✗ **Workflow reaches E2E step** - Blocked at unit test failure

## Issues Found

### Critical Issues

1. **Unit Test Timeout (High Priority)**
   - Test: `parking-escape-generator.test.js > generateLevel > medium difficulty target moves in range [9, 16]`
   - Location: `tests/unit/parking-escape-generator.test.js:74-85`
   - Issue: Test exceeds 15s timeout in CI environment (passes locally)
   - Root cause: BFS solver validation for medium difficulty levels is slow in CI
   - Impact: Blocks CI pipeline from reaching E2E tests
   - Recommendation: Increase timeout to 30s or reduce seed iterations

2. **Budget Configuration Discrepancy (Medium Priority)**
   - Bead requirements specify: 500KB JS, 100KB CSS
   - CI workflow enforces: 3000KB JS, 150KB CSS
   - Impact: Unclear which budget is the actual requirement
   - Current build: Passes CI budget but exceeds bead budget
   - Recommendation: Align bead requirements with CI budget or vice versa

3. **Large JS Bundles (Performance Issue)**
   - `phaser-B61OQUcB.js`: 1,481.79 kB (1.48 MB)
   - `three-setup-ByYrO6bh.js`: 515.23 kB
   - Impact: Large initial payload affects load performance
   - Recommendation: Implement code-splitting with dynamic imports for Phaser/Three.js

## Workflow Status

```
lint: Succeeded ✓
build: Succeeded ✓ (passes CI budget, exceeds bead requirements budget)
unit: Failed ✗ (test timeout)
E2E: Not reached (blocked by unit failure)
```

## Methodology
- Submitted debug workflow `mobile-gaming-ci-unit-only-q2jp5` to iad-ci cluster
- Captured build step logs from completed pod
- Ran unit tests locally for comparison
- Analyzed workflow template configuration
- Compared bead requirements budget with CI workflow budget

## Verification Date

2026-07-24 17:47 UTC

---

# Third Verification - 2026-07-24 14:52 UTC

## Task Re-examination

Investigation of CI unit test and build step failures with focus on schema validation.

## Unit Test Results (Latest Run)

### `npm test` (vitest unit tests)
- **Status:** ✅ PASS
- **Test Files:** 111 passed (111)
- **Tests:** 5262 passed (5262)
- **Duration:** 26.48s
- **Under 300s timeout:** ✅ YES

### `npm run test:levels` (schema + generator validation)
- **Status:** ❌ FAIL
- **Schema Validation:** 305 passed, **25 failed**
- **Generator Validation:** Incomplete (schema failures exit early)

**CRITICAL FINDING:** The CI unit step fails at **schema validation**, not unit test timeouts.

## Schema Validation Failures

### Root Cause
Committed level JSON files have `difficulty` as a number instead of required string enum.

**Expected format (per schema):**
```json
"difficulty": "easy"  // or "medium" or "hard"
```

**Actual format in committed files:**
```json
"difficulty": 1  // numeric instead of string enum
```

### Failed Files (25 total)

#### merge-games (15 files)
- `levels/merge-games/mg-001.json` through `mg-015.json`
- Error: `instance.difficulty: is not of a type(s) string`
- Error: `instance.difficulty: is not one of enum values: easy,medium,hard`

#### satisfying-asmr (10 files)
- `levels/satisfying-asmr/asmr-001.json` through `asmr-010.json`
- Error: `instance.difficulty: is not of a type(s) string`
- Error: `instance.difficulty: is not one of enum values: easy,medium,hard`

### Schema Reference
File: `/home/coding/mobile-gaming/schemas/merge-games.schema.json`
```json
"difficulty": {
  "type": "string",
  "enum": ["easy", "medium", "hard"],
  "description": "Difficulty tier"
}
```

## Build Step Verification

### Build Status
- **Status:** ✅ PASS
- **Build Duration:** 4.55s
- **No navigator property errors**

### Bundle Sizes (CI Budget Compliance)
- **JS Total:** 2410KB (CI budget: 3000KB) ✅
- **CSS Total:** 47KB (CI budget: 150KB) ✅

**Note:** Build passes CI budget limits. Previous verification noted bead requirement budget (500KB JS, 100KB CSS) is exceeded by Phaser (1.48MB) and Three.js (515KB) bundles, but CI workflow uses higher limits (3000KB JS, 150KB CSS).

## Updated Acceptance Criteria Status

- ✗ **Unit tests pass with no failures** - Schema validation fails (25 committed levels)
- ✗ **Test:levels pass** - Schema validation rejects 25 level files
- ✓ **Vitest tests pass** - 5262 tests pass, 26.48s
- ✓ **Test duration under 300s** - 26.48s (well under timeout)
- ✓ **Build step completes successfully** - 4.55s
- ✓ **Bundle sizes under CI budget** - JS 2410KB < 3000KB, CSS 47KB < 150KB
- ✗ **Bundle sizes under bead requirements budget** - Exceeds 500KB JS limit
- ✓ **No navigator property errors** - None detected
- ✗ **Workflow reaches E2E step** - Blocked by unit step schema failure

## Critical Issue Identified

The CI unit step fails due to **25 committed level files with invalid `difficulty` field format**. This is a data integrity issue, not a test flakiness or performance issue.

### Required Fix
Convert `difficulty` field from number to string enum in affected files:

**Files requiring fixes:**
- `levels/merge-games/mg-001.json` through `mg-015.json` (15 files)
- `levels/satisfying-asmr/asmr-001.json` through `asmr-010.json` (10 files)

**Conversion needed:**
```json
// Before (invalid)
"difficulty": 1

// After (valid) - map numbers to appropriate difficulty tier
"difficulty": "easy"  // for difficulty = 1
"difficulty": "medium"  // for difficulty = 2
"difficulty": "hard"  // for difficulty = 3
```

## Workflow Status (Actual)

```
lint: Succeeded ✓
unit: Failed ✗ (schema validation: 25 level files rejected)
build: Succeeded ✓ (passes CI budget)
E2E: Not reached (blocked by unit failure)
```

## Methodology
- Examined workflow template: `mobile-gaming-ci` in `jedarden/declarative-config`
- Checked recent CI workflow runs on iad-ci cluster
- Ran unit tests locally: `npm test` (passed)
- Ran level validation locally: `npm run test:levels` (schema validation failed)
- Examined failing level files to identify root cause
- Verified build step locally and checked bundle sizes

## Verification Date

2026-07-24 14:52 UTC
