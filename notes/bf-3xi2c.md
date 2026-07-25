# Test Setup/Teardown Overhead Measurement (bf-3xi2c)

## Overview

Measured test setup/teardown overhead for the mobile-gaming project to understand the impact of test framework overhead vs actual test execution time.

## Unit Tests (Vitest)

### Summary Statistics
- **Total tests**: 5,360
- **Total test execution time**: 15,766.68ms
- **Average test duration**: 2.94ms
- **Estimated setup overhead**: ~24ms (per-suite)
- **Total setup overhead across 120 suites**: 2,089.50ms
- **Overhead ratio**: 13.25%

### Key Findings

1. **Setup overhead compounds significantly**: With 120 test suites, setup overhead runs 120 times, contributing ~2 seconds of overhead.

2. **Fast tests dominate**: 4,938 tests (92%) run in under 5ms, with many completing in less than 1ms. These tests are most affected by framework overhead.

3. **Per-suite setup overhead**: Ranges from ~0.4ms to ~1ms per test in suites with many fast tests:
   - `level-coverage.test.js`: 216 tests, ~95ms overhead (~0.44ms per test)
   - `jelly-shift-solver.test.js`: 171 tests, ~84ms overhead (~0.49ms per test)
   - `makeover-run-solver.test.js`: 159 tests, ~78ms overhead (~0.49ms per test)

4. **Slow tests (>100ms)**: Only a few slow tests exist:
   - Parking escape generator: 1,116ms (generates different levels from different seeds)
   - Pull-the-pin generator: 197-297ms (level generation tests)
   - Water sort solver: 240ms (hard level BFS solving)
   - Parking escape generator: 160-193ms (validation tests)

5. **Setup script overhead**: The actual `tests/setup.js` mock setup takes ~24ms to execute once, but this cost is amortized across all tests in a suite.

## E2E Tests (Playwright)

### Summary
- **Total E2E tests**: 1,234 tests across ~13 spec files
- **Wall-clock time**: 15.6 seconds
- **Individual test times**: 2-8ms each (as reported by Playwright)
- **Actual overhead**: Significant - wall-clock time vs individual test times shows major framework overhead

### Key Findings

1. **Massive per-test overhead**: E2E tests show 2-8ms execution time but take ~15.6 seconds total for 1,234 tests = ~12.6ms average wall-clock time per test.

2. **Browser startup overhead**: Each test involves:
   - Browser context creation
   - Page navigation
   - Canvas and DOM setup
   - Test execution
   - Cleanup/teardown

3. **Parallel execution**: Tests run with 6 workers, which helps but the overhead per test is still significant compared to the actual test logic.

## Breakdown of Overhead Sources

### Unit Test Overhead Sources

1. **Per-suite setup**: ~24ms for navigator mocks and global setup
2. **Vitest framework overhead**: Test isolation, mock setup/teardown
3. **Module loading**: Each test file loads its dependencies
4. **Worker threads**: Pool management overhead (2-4 threads)

### E2E Test Overhead Sources

1. **Browser orchestration**: Starting/stopping browser contexts
2. **Page setup**: Navigation, waiting for load, canvas initialization
3. **Test execution**: Actual assertions (2-8ms)
4. **Teardown**: Browser context cleanup, screenshot cleanup
5. **Parallel coordination**: Worker pool management (6 workers)

## Recommendations

1. **For unit tests**:
   - Consider consolidating test suites to reduce per-suite setup overhead
   - The 13.25% overhead is acceptable but could be reduced with fewer suites
   - Focus optimization on the few slow tests (>100ms)

2. **For E2E tests**:
   - The overhead is inherent to browser automation
   - Parallel execution (6 workers) is already optimized
   - Consider test grouping to reduce browser startup overhead
   - Current 15.6s runtime is reasonable for 1,234 E2E tests

3. **Overall**:
   - The overhead ratios are acceptable for a project of this size
   - Unit test overhead (13.25%) is well within normal ranges
   - E2E test overhead is expected given browser automation

## Files Created

- `scripts/measure-test-overhead.js` - Unit test overhead measurement script
- `scripts/measure-e2e-overhead.js` - E2E test overhead measurement script  
- `test-overhead-analysis.json` - Detailed unit test overhead data
- `test-results.json` - Raw vitest JSON output for further analysis

## Conclusion

Test setup/teardown overhead is measurable but not excessive:
- **Unit tests**: ~13% overhead, mostly from per-suite setup
- **E2E tests**: Higher overhead due to browser automation, but acceptable
- **Optimization focus**: Should be on the few slow tests (>100ms) rather than framework overhead
