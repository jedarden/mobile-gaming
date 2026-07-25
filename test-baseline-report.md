# Test Suite Baseline Timing Report

**Date:** 2026-07-24  
**Bead ID:** bf-22shc  
**Purpose:** Collect baseline test suite timing data for performance analysis and optimization

## Summary

This report documents the baseline performance of the mobile-gaming test suite, consisting of both unit tests (Vitest) and end-to-end tests (Playwright). The data was collected on 2026-07-24 to establish a performance baseline for future optimizations.

## Unit Tests (Vitest)

### Overall Statistics
- **Total Test Files:** 120
- **Total Tests:** 5,360
- **Overall Duration:** 42.75s
- **Breakdown:**
  - Transform time: 5.68s
  - Setup time: 2.26s
  - Collect time: 28.85s
  - Test execution: 35.48s
  - Environment: 32.58s
  - Prepare time: 24.85s

### Performance Characteristics
- **Average per test:** ~7.98ms per test (42.75s / 5,360 tests)
- **Test throughput:** ~125 tests per second
- **Parallel execution:** Yes (default Vitest parallelization)

### Individual Test Timing Examples
From the verbose output, most unit tests complete in 0-10ms range, with some outliers taking up to 136ms for complex operations like level generation.

## End-to-End Tests (Playwright)

### Overall Statistics
- **Total Tests:** 1,232 (excluding 2 skipped)
- **Workers Used:** 6 parallel workers
- **Slowest individual test:** 32ms
- **Fastest individual test:** 3ms
- **Average test duration:** 5.84ms
- **Estimated total execution time:** ~7.2s (individual test times, excluding overhead)

### Performance Characteristics
- **Test distribution:**
  - Mobile Chrome: majority of tests
  - Mobile Safari: significant portion of tests
- **Average test time:** 5.84ms (very fast, indicating efficient test design)
- **Parallel execution:** 6 workers significantly reduce total wall-clock time

### Test Suite Breakdown
The E2E suite covers:
- Core game functionality for all 13 games
- Level navigation and progress tracking
- Cross-game navigation and state management
- Lifecycle management (visibility, persistence)
- UI responsiveness and accessibility
- Share functionality and video recording
- Deploy smoke tests for production monitoring

## Combined Performance Analysis

### Total Test Suite Performance
- **Unit tests:** 42.75s (5,360 tests)
- **E2E tests:** ~7.2s estimated (1,232 tests)
- **Total test count:** 6,592 tests
- **Combined throughput:** ~127 tests per second

### Bottleneck Analysis

#### Unit Tests
1. **Collection phase (28.85s)** - This is the largest single component, taking 67% of total unit test time
2. **Test execution (35.48s)** - Actual test running time
3. **Environment setup (32.58s)** - Test environment initialization

#### E2E Tests
1. **Parallel worker efficiency** - 6 workers handle load well
2. **Individual test speed** - Most tests complete in 3-10ms range
3. **Browser overhead** - Not included in individual test times, likely adds significant wall-clock time

## Recommendations for Optimization

### Immediate Wins (High Impact, Low Effort)
1. **Optimize test collection** - The 28.85s collection phase for unit tests could likely be reduced with better file organization or test patterns
2. **Increase E2E worker count** - Machine appears to handle 6 workers well; could potentially increase to 8-12 workers

### Medium-Term Optimizations
1. **Review transform time** - 5.68s for code transformation could be optimized with better caching or build configuration
2. **Environment setup caching** - 32.58s environment setup might benefit from better caching strategies

### Long-Term Considerations
1. **Test suite structure** - 6,592 tests is substantial; consider splitting into smaller, focused test suites for different purposes
2. **Selective test execution** - Implement better test selection mechanisms for PR validation vs. full CI runs

## Baseline Metrics for Future Comparison

| Metric | Value |
|--------|-------|
| Unit test count | 5,360 |
| Unit test duration | 42.75s |
| E2E test count | 1,232 |
| E2E test duration (estimated) | ~7.2s |
| Total tests | 6,592 |
| Combined duration | ~50s |
| Tests per second | ~132 |

## Methodology

### Data Collection
- Unit tests run with: `npm test -- --reporter=verbose`
- E2E tests run with: `npm run test:e2e --`
- Output captured to log files for analysis
- Individual test timing extracted from verbose output

### Environment
- Platform: Linux 6.12.63
- Node.js version: (from npm environment)
- Test runners: Vitest 3.2.7, Playwright (latest)

## Files Generated

1. `test-baseline-unit-timing.log` - Full unit test timing output
2. `test-baseline-e2e-timing.log` - Full E2E test timing output  
3. `test-baseline-report.md` - This comprehensive analysis report

## Next Steps

1. Use this baseline to measure impact of test optimizations
2. Monitor test execution time trends over time
3. Investigate collection phase optimization opportunities
4. Consider implementing test performance regression checks in CI

---

*This baseline was collected as part of bead bf-22shc: Collect baseline test suite timing data*