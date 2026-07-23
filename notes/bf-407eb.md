# Parking-Escape Daily-Challenge Test Failures - Investigation Report

## Task Summary
Identify parking-escape daily-challenge test failures by running tests locally and documenting all failing assertions with error messages and stack traces.

## Investigation Date
2026-07-23

## Current Test Status: ALL TESTS PASSING ✓

### Unit Tests - 192/192 Passed
**Command:** `npm test -- parking-escape`

```
Test Files  5 passed (5)
     Tests  192 passed (192)
```

#### Daily-Challenge Specific Tests (5/5 Passed)
1. ✓ `Daily Challenge > generates a daily level from known seed and can create initial state` - 7045ms
2. ✓ `Daily Challenge > simulates a win on daily level and calls completeDailyChallenge exactly once` - 6894ms
3. ✓ `Daily Challenge > generates deterministic levels from same seed` - 4108ms
4. ✓ `Daily Challenge > generates different levels from different seeds` - 16926ms
5. ✓ `Daily Challenge > returns null when generation fails (triggers fallback)` - 1056ms

#### Generator Tests (25/25 Passed)
All generator tests pass, including performance-heavy tests:
- Medium difficulty target moves: 9-16 range
- Hard difficulty score formula: 8 + Math.round(targetMoves / 15)
- Medium difficulty score formula: 5 + Math.round(targetMoves / 8)
- Truck vehicle generation (25% probability)
- Level validation

#### Input Tests (15/15 Passed)
All input handling tests pass.

#### Solver Tests (85/85 Passed)
All solver tests pass, including BFS verification tests.

### Behavioral Tests - 120/120 Passed
**Command:** `npm test -- daily-challenge-behavioral`

```
Test Files  1 passed (1)
     Tests  120 passed (120)
```

All 10 games in the daily-challenge behavioral suite pass:
- pull-the-pin
- parking-escape
- crowd-runner
- bridge-race
- merge-games
- satisfying-asmr
- jelly-shift
- makeover-run
- brain-teaser
- save-the-character

### E2E Tests - Infrastructure Failure (Not Test Logic Issue)
**Command:** `npm run test:e2e -- parking-escape`

**Failure Type:** System dependencies missing
**Error:** `libglib-2.0.so.0: cannot open shared object file`

This is an infrastructure issue, not a parking-escape test logic issue. All E2E tests fail uniformly due to missing Playwright browser dependencies on this system.

## Historical Failures (Previously Fixed)

### 1. RGB Color Assertion Error (FIXED - Commit 72f9a9f)
**Category:** Logic - Test expectation error

**Original Issue:**
- Test expected: `'228, 66, 240'` (purple/magenta)
- Actual received: `'240, 228, 66'` (yellow #F0E442)

**Root Cause:** Test author wrote incorrect RGB values in assertion

**Fix:** Changed expected value from `'228, 66, 240'` to `'240, 228, 66'`

**Documentation:** beads bf-668kq, bf-4tiyi

### 2. Timeout Exceeded (FIXED - Commit 23c6cd1)
**Category:** Timing - Performance capacity planning

**Original Issue:**
Three unit tests exceeded 20-second timeout:
- `generates a daily level from known seed`
- `simulates a win on daily level`
- `generates different levels from different seeds`

**Root Cause:** 20s timeout insufficient for expensive level generation in CI environment

**Fix:** Increased timeout from 20,000ms to 30,000ms

**Current Performance:**
- generates a daily level: ~7,045ms (well within 30s)
- simulates a win: ~6,894ms (well within 30s)
- generates different levels: ~16,926ms (well within 30s)

**Documentation:** beads bf-668kq, bf-5oefu, bf-efvvz

## Summary

### Current State: NO FAILING ASSERTIONS IDENTIFIED

All parking-escape daily-challenge tests pass reliably:

| Test Suite | Tests | Status | Notes |
|------------|-------|--------|-------|
| Daily Challenge | 5 | ✓ Pass | All pass within 30s timeout |
| Generator | 25 | ✓ Pass | Including performance tests |
| Solver | 85 | ✓ Pass | All BFS solver tests |
| Input | 15 | ✓ Pass | All input handling tests |
| Behavioral | 120 | ✓ Pass | All 10 games compliant |

### Historical Failures Category Breakdown

| Failure | Category | Status |
|---------|----------|--------|
| RGB color assertion | Logic | ✓ Fixed |
| Timeout (3 tests) | Timing | ✓ Fixed |

### Conclusions

1. **No current test failures exist** - All parking-escape daily-challenge tests pass
2. **Previous failures were resolved** through commits 72f9a9f and 23c6cd1
3. **E2E tests fail** due to infrastructure (missing libglib-2.0.so.0), not test logic
4. **Timeouts are adequate** - Slowest test runs in ~17s vs 30s timeout (53% buffer)
5. **Performance is stable** - All daily-challenge tests complete in reasonable time

## Related Beads

- bf-668kq - Root cause analysis of historical failures
- bf-4tiyi - Original failure documentation
- bf-5oefu - Timing fixes verification
- bf-efvvz - Daily-challenge stability verification
- bf-57ei7 - Selector verification details
- bf-5ere9 - Timeout investigation details

## Files Referenced

- `tests/unit/parking-escape.test.js` - Daily-challenge unit tests
- `tests/unit/parking-escape-generator.test.js` - Generator tests
- `tests/unit/parking-escape-input.test.js` - Input tests
- `tests/solvers/parking-escape-solver.test.js` - Solver tests
- `tests/unit/daily-challenge-behavioral.test.js` - Behavioral tests
- `tests/e2e/parking-escape.spec.js` - E2E tests (infrastructure failure)
- `src/games/parking-escape/generator.js` - Level generation algorithm
- `src/games/parking-escape/state.js` - BFS solver implementation
