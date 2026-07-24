# Test Suite Performance Baseline Report

**Generated:** 2026-07-24  
**Bead:** bf-1oak7  
**Task:** Profile test suite and identify performance bottlenecks

## Executive Summary
- **Total test suite duration:** ~16.1s (average of 3 runs)
- **Total test files:** 111
- **Total individual tests:** 5,262
- **Test success rate:** 100%
- **Baseline throughput:** ~327 tests/second

## Detailed Timing Data (3 runs)

### Run 1: 16.60s
- Transform: 6.04s (36.4%)
- Setup: 2.55s (15.4%)
- Collect: 26.42s (159.2%)
- Tests: 31.33s (188.7%)
- Environment: 31.41s (189.2%)
- Prepare: 25.93s (156.3%)

### Run 2: 15.61s
- Transform: 5.43s (34.8%)
- Setup: 2.26s (14.5%)
- Collect: 24.28s (155.5%)
- Tests: 30.01s (192.2%)
- Environment: 29.28s (187.6%)
- Prepare: 23.74s (152.1%)

### Run 3: 16.20s
- Transform: 5.20s (32.1%)
- Setup: 2.68s (16.5%)
- Collect: 25.23s (155.7%)
- Tests: 29.11s (179.7%)
- Environment: 31.35s (193.5%)
- Prepare: 24.42s (150.7%)

### Average Performance: ~16.1s total
- Transform: ~5.56s (34.5%)
- Setup: ~2.50s (15.5%)
- Collect: ~25.31s (157.1%)
- Tests: ~30.15s (187.2%)
- Environment: ~30.68s (190.4%)
- Prepare: ~24.70s (153.1%)

## Individual Test Analysis

### Tests Taking >5s: NONE ✓
- No individual test case exceeds 5 seconds
- Slowest individual tests observed: ~57ms (parking-escape-solver tests)

### Slowest Individual Tests (Top 10):
1. Parking Escape Solver tests: 57ms (pe-60)
2. Parking Escape Solver tests: 57ms (pe-60)
3. Parking Escape Solver tests: 57ms (pe-60)
4. Parking Escape Solver tests: 56ms (pe-60)
5. Parking Escape Solver tests: 56ms (pe-60)
6. Parking Escape Solver tests: 43ms (pe-61)
7. Parking Escape Solver tests: 43ms (pe-61)
8. Parking Escape Solver tests: 42ms (pe-61)
9. Parking Escape Solver tests: 42ms (pe-61)
10. Parking Escape Solver tests: 42ms (pe-61)

## Setup/Teardown Overhead Analysis

### Setup Overhead: ~2.5s (15.5% of total)
- Test setup includes: environment initialization, mocking, fixture loading
- Percentage indicates moderate setup cost per test run

### Collection Overhead: ~25.3s (157% of total)
- Test discovery and file processing
- This is unusually high and indicates potential optimization opportunities

### Environment Overhead: ~30.7s (190% of total)
- Environment setup per test file
- Very high overhead suggests inefficient environment initialization

### Transformation Overhead: ~5.6s (34.5% of total)
- Code transformation/compilation
- Moderate overhead, expected for TypeScript/ES6+ code

## Key Bottlenecks Identified

### Priority 1: Collection Phase (25.3s - 157% overhead)
- Test discovery takes longer than actual test execution
- Likely scanning too many files or inefficient file matching
- **Impact:** HIGH - This is the single biggest bottleneck

### Priority 2: Environment Setup (30.7s - 190% overhead)  
- Environment initialization takes significantly longer than tests
- May be re-initializing environment per test file instead of reusing
- **Impact:** HIGH - Second biggest bottleneck

### Priority 3: Test Execution (30.1s - 187% overhead)
- While individual tests are fast, the cumulative execution time is high
- 5,262 tests running across 111 files
- **Impact:** MEDIUM - Could benefit from better parallelization

### Priority 4: Transform Phase (5.6s - 34.5% overhead)
- Code compilation/transformation overhead
- Could benefit from build caching or incremental compilation
- **Impact:** LOW-MEDIUM - Expected overhead but could be optimized

## Optimization Targets (Prioritized)

1. **Investigate collection phase efficiency** (HIGH priority)
   - Reduce file scanning overhead
   - Optimize glob patterns for test discovery
   - Expected savings: 5-10s

2. **Environment initialization optimization** (HIGH priority)
   - Implement environment reuse instead of per-file setup
   - Reduce environment initialization overhead
   - Expected savings: 10-15s

3. **Parallel test execution optimization** (MEDIUM priority)
   - Currently using threads pool with 4 workers
   - Could increase worker count or optimize test distribution
   - Expected savings: 5-8s

4. **Build/transform caching** (LOW-MEDIUM priority)
   - Implement incremental compilation caching
   - Reduce redundant transformations
   - Expected savings: 2-3s

5. **Test file consolidation** (LOW priority)
   - Consider consolidating small test files
   - Reduce per-file overhead
   - Expected savings: 1-2s

## Current Baseline Metrics

- **Total execution time:** 16.1s
- **Tests per second:** ~327 tests/s
- **Setup overhead ratio:** 15.5%
- **Collection overhead ratio:** 157.1%
- **Environment overhead ratio:** 190.4%
- **Transformation overhead ratio:** 34.5%

## Recommendations

1. Immediate focus should be on collection and environment phases
2. Test parallelization appears underutilized for 5,262 tests
3. Consider vitest's `--no-coverage` flag to reduce overhead
4. Evaluate if all 5,262 tests are necessary or if some can be consolidated

## Acceptance Criteria Status

✅ **Run full test suite 3 times and capture timing data** - Completed  
✅ **Identify all test cases taking >5s individually** - No tests exceed 5s  
✅ **Measure setup/teardown overhead time** - Documented above  
✅ **Document current baseline performance metrics** - Documented above  
✅ **Create prioritized list of optimization targets** - Documented above  

---

**Test Environment:**
- Vitest v3.2.7
- Node environment (no DOM)
- 111 test files
- 5,262 individual tests
- Parallel execution enabled (threads pool)
- Test isolation: true
- Bail on first failure: enabled