# Test Suite Performance Profile - Baseline Analysis

**Generated:** 2026-07-24  
**Bead:** bf-6b3eu - Performance Bottleneck Identification

## Executive Summary

The mobile-gaming test suite consists of **121 test files** with **5,378 individual tests**. The complete test suite runs in approximately **17-20 seconds**, with no individual test file exceeding 5 seconds. While the overall performance is reasonable, several specific bottlenecks have been identified that contribute to the total runtime.

## Baseline Timing Data (5 runs)

| Run | Duration | Transform | Setup | Collect | Tests | Environment | Prepare |
|-----|----------|-----------|-------|---------|-------|-------------|---------|
| 1   | 17.58s   | 1.81s     | 656ms | 12.45s  | 15.53s | 14.87s      | 8.86s   |
| 2   | 17.40s   | 1.60s     | 689ms | 11.55s  | 14.00s | 14.24s      | 8.78s   |
| 3   | 18.45s   | 1.52s     | 627ms | 11.03s  | 14.89s | 17.13s      | 9.00s   |
| 4   | 20.32s   | 1.82s     | 725ms | 13.00s  | 16.38s | 17.97s      | 10.09s  |
| 5   | 19.57s   | 1.88s     | 749ms | 13.68s  | 16.12s | 16.83s      | 10.12s  |
| **Avg** | **18.66s** | **1.73s** | **679ms** | **12.34s** | **15.38s** | **16.21s** | **9.37s** |

**Key Observation:** Test execution time (`tests` metric) accounts for approximately 82% of the total runtime, indicating this is the primary optimization target.

## Test Files Taking >1 Second

While no test files exceed the 5-second threshold, several take over 1 second and represent significant bottlenecks:

| Test File | Duration | Test Count | Avg/Test | Primary Bottleneck |
|-----------|----------|------------|----------|-------------------|
| `tests/solvers/parking-escape-solver.test.js` | 2,278ms | 84 tests | 27ms | Solver algorithm execution |
| `tests/unit/pull-the-pin-generator.test.js` | 2,187ms | 33 tests | 66ms | Generator complexity + validation |
| `tests/unit/parking-escape.test.js` | 1,505ms | 65 tests | 23ms | State management operations |
| `tests/unit/parking-escape-generator.test.js` | 1,408ms | 25 tests | 56ms | Generator algorithm |
| `tests/unit/level-nav.test.js` | 736ms | 66 tests | 11ms | DOM interaction simulation |
| `tests/unit/lifecycle.test.js` | 450ms | 50 tests | 9ms | Game lifecycle setup |
| `tests/unit/analytics.test.js` | 381ms | 42 tests | 9ms | Analytics tracking overhead |
| `tests/solvers/water-sort-solver.test.js` | 379ms | 92 tests | 4ms | Solver algorithm |

## Setup/Teardown Overhead Analysis

From controlled profiling tests (`tests/profile/setup-teardown-measurement.test.js`):

**Overall Time Distribution:**
- Setup (beforeAll + beforeEach): **27.69ms (68.06%)**
- Test Execution: **4.63ms (11.38%)**
- Teardown (afterEach + afterAll): **8.37ms (20.57%)**

**Hook-Level Breakdown:**
- `beforeAll`: 10.36ms (2 calls, avg 5.18ms)
- `beforeEach`: 17.33ms (17 calls, avg 1.02ms)
- `afterEach`: 3.26ms (17 calls, avg 0.19ms)
- `afterAll`: 5.11ms (1 call, avg 5.11ms)

**Key Finding:** Setup/teardown overhead represents **88.63%** of total execution time in controlled test scenarios, suggesting hook optimization could yield significant improvements.

## Specific Performance Bottlenecks

### 1. Parking Escape Solver (`tests/solvers/parking-escape-solver.test.js:1`)
- **Duration:** 2,278ms (84 tests)
- **Issue:** Solver algorithm processes all 84 hand-crafted levels with BFS pathfinding
- **Location:** Solver implementation at `src/games/parking-escape/state.js:solve()`
- **Impact:** Each test averages 27ms - longest single test file

### 2. Pull-the-Pin Generator (`tests/unit/pull-the-pin-generator.test.js:1`)
- **Duration:** 2,187ms (33 tests)
- **Issue:** Generator creates and validates complex puzzle layouts
- **Location:** Generator at `src/games/pull-the-pin/generator.js`
- **Impact:** Each test averages 66ms - highest per-test average

### 3. Parking Escape Core (`tests/unit/parking-escape.test.js:1`)
- **Duration:** 1,505ms (65 tests)
- **Issue:** Repeated state initialization and move validation
- **Location:** State management at `src/games/parking-escape/state.js`
- **Impact:** Each test averages 23ms

### 4. Parking Escape Generator (`tests/unit/parking-escape-generator.test.js:1`)
- **Duration:** 1,408ms (25 tests)
- **Issue:** Level generation with BFS solvability verification
- **Location:** Generator at `src/games/parking-escape/generator.js`
- **Impact:** Each test averages 56ms

### 5. Level Navigation (`tests/unit/level-nav.test.js:1`)
- **Duration:** 736ms (66 tests)
- **Issue:** DOM manipulation and event simulation
- **Location:** Level navigation at `src/shared/level-nav.js`
- **Impact:** Each test averages 11ms

## Vitest Infrastructure Overhead

From the detailed timing breakdown, Vitest infrastructure accounts for:

- **Transform:** 1.73s (9.3%) - ESM transpilation
- **Environment:** 16.21s (86.9%) - jsdom setup, test context initialization  
- **Prepare:** 9.37s (50.2%) - File collection, dependency resolution
- **Collect:** 12.34s (66.1%) - Test discovery and organization

**Note:** These percentages exceed 100% because Vitest runs these phases in parallel/overlap. The "Tests" metric (15.38s, 82.4%) represents the actual test execution time.

## High-Level Timing Profile

```
Total Runtime: ~18.66s
├── Vitest Infrastructure (parallel): ~8s
│   ├── Transform (ESM): 1.73s
│   ├── Environment (jsdom): 16.21s (parallelized)
│   ├── Prepare (collection): 9.37s (parallelized)
│   └── Collect (discovery): 12.34s (parallelized)
└── Test Execution: 15.38s
    ├── Parking Escape Solver: 2.28s (14.8%)
    ├── Pull-the-Pin Generator: 2.19s (14.2%)
    ├── Parking Escape Core: 1.51s (9.8%)
    ├── Parking Escape Generator: 1.41s (9.2%)
    ├── Level Navigation: 0.74s (4.8%)
    ├── Other 116 test files: 6.25s (40.4%)
```

## Recommendations for Optimization

1. **Parallelize Solvers:** The parking-escape solver processes 84 levels sequentially - could be parallelized
2. **Cache Generators:** Generator tests create new levels each time - consider test fixtures
3. **Mock Expensive Operations:** Analytics and lifecycle tests could use more mocks
4. **Reduce DOM Tests:** Level-nav tests involve full DOM manipulation - could use lighter-weight alternatives
5. **Hook Optimization:** beforeEach hooks average 1ms - could be reduced with better fixture design

## Conclusion

The test suite performs reasonably well at 18.66 seconds total, but clear optimization targets exist:
- **5 test files** account for **~45%** of total runtime
- **Setup/teardown** represents **88%** of overhead in controlled scenarios  
- **Solver algorithms** are the primary bottleneck in test execution

The next phase should focus on optimizing the identified bottlenecks, starting with the parking-escape and pull-the-pin test suites.
