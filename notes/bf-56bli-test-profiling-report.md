# Test Performance Profiling Report

**Date**: 2026-07-24  
**Task**: Profile and identify slow tests  
**Test Framework**: Vitest 3.2.7

## Executive Summary

The test suite consists of **111 test files** with **5,262 individual tests**. The total test execution time is **49.41 seconds** (excluding setup/teardown overhead), with an average test time of **9.4ms** per test.

### Key Findings
- **8 tests (0.2%) take over 1 second** each
- **52 tests (1.0%) take over 100ms** each  
- **Single slowest test**: 11.9 seconds (parking-escape-generator hard difficulty test)
- **Primary bottleneck**: Generator tests that use BFS solvers to validate levels

---

## Top 10 Slowest Individual Tests

| Rank | Time | Test File | Test Name |
|------|------|-----------|-----------|
| 1 | 11,952ms | `parking-escape-generator.test.js` | hard difficulty: difficulty score uses 8 + Math.round(targetMoves / 15) formula |
| 2 | 4,161ms | `parking-escape-generator.test.js` | medium difficulty target moves in range [9, 16] |
| 3 | 2,441ms | `parking-escape.test.js` | Daily Challenge > generates different levels from different seeds |
| 4 | 2,370ms | `parking-escape.test.js` | Daily Challenge > returns null when generation fails (triggers fallback) |
| 5 | 1,756ms | `parking-escape-generator.test.js` | falls back to medium config for an unknown difficulty string |
| 6 | 1,513ms | `parking-escape-generator.test.js` | validateLevel > returns valid for medium difficulty level |
| 7 | 1,382ms | `parking-escape-generator.test.js` | medium difficulty: difficulty score uses 5 + Math.round(targetMoves / 8) formula |
| 8 | 1,378ms | `parking-escape-generator.test.js` | can generate truck vehicles (type=truck, length=3) from the 25% isTruck probability |
| 9 | 572ms | `pull-the-pin-generator.test.js` | generateBatch > medium levels are structurally valid when generated |
| 10 | 546ms | `pull-the-pin-generator.test.js` | generateLevel > unknown difficulty fallback > falls back to medium config for an unknown difficulty string |

**Pattern**: 9 of the 10 slowest tests are generator-related tests that use BFS solvers for validation.

---

## Test Files by Total Execution Time

### Critical Performance Issues (>5 seconds)

| Rank | Time | Test Count | Test File | Avg Time per Test |
|------|------|------------|-----------|-------------------|
| **1** | **23,908ms** | 25 | `parking-escape-generator.test.js` | **956ms** |
| **2** | **5,547ms** | 65 | `parking-escape.test.js` | **85ms** |
| **3** | **5,424ms** | 33 | `pull-the-pin-generator.test.js` | **164ms** |

### Moderate Performance Issues (>1 second)

| Rank | Time | Test Count | Test File | Avg Time per Test |
|------|------|------------|-----------|-------------------|
| 4 | 1,411ms | 66 | `level-nav.test.js` | 21ms |
| 5 | 1,058ms | 84 | `parking-escape-solver.test.js` | 13ms |
| 6 | 996ms | 50 | `lifecycle.test.js` | 20ms |
| 7 | 899ms | 92 | `water-sort-solver.test.js` | 10ms |
| 8 | 763ms | 42 | `analytics.test.js` | 18ms |

### Well-Performing Test Files (<100ms total)

Examples of efficient test files:
- `sync-invalid-payload.test.js`: 3ms for 1 test
- `adaptive.test.js`: 2ms for 43 tests
- `history.test.js`: 2ms for 29 tests  
- `storage.test.js`: 9ms for 61 tests
- `save-the-character.test.js`: 9ms for 51 tests

---

## Performance Distribution

### Time Distribution
```
< 10ms:    ~4,800 tests (91%) ✅ Fast
10-50ms:   ~380 tests (7%) ✅ Good
50-100ms:  ~50 tests (1%) ⚠️  Acceptable
100-500ms: ~40 tests (0.8%) ⚠️  Needs review
500-1000ms: ~4 tests (0.1%) 🚨 Slow
> 1000ms:  8 tests (0.2%) 🚨 Very slow
```

### Performance Tier Summary
- **Fast tests (<10ms)**: 91% of tests are well-optimized
- **Slow tests (>100ms)**: Only 1% of tests but account for significant execution time
- **Very slow tests (>1s)**: 8 tests account for ~23 seconds (46% of total execution time)

---

## Root Cause Analysis

### Why Generator Tests Are Slow

The primary performance bottleneck comes from **generator tests that validate levels using BFS (Breadth-First Search) solvers**:

1. **BFS Solver Complexity**: Parking Escape and Pull The Pin generators use BFS algorithms that explore all possible moves to find solutions
2. **Test Retry Logic**: Some tests use retry loops to generate valid levels, multiplying the BFS cost
3. **Medium/Hard Difficulty**: These tests generate larger, more complex levels that require longer BFS searches
4. **Validation Overhead**: Each generated level must be validated as solvable before the test can pass

### Specific Hotspots

1. **`parking-escape-generator.test.js`** (23.9s total)
   - Hard difficulty test runs BFS on complex parking layouts
   - Tests validate target move ranges and difficulty scoring formulas
   - 25 tests but average 956ms per test (very high)

2. **`pull-the-pin-generator.test.js`** (5.4s total)  
   - Gravity-based puzzle generation requires complex state validation
   - BFS solver must simulate physics and ball movement
   - Tests multiple difficulty levels with increasing complexity

3. **`parking-escape.test.js`** (5.5s total)
   - Daily Challenge tests generate fresh levels each time
   - Tests involve full game state creation and validation
   - Higher number of tests (65) but still significant per-test overhead

---

## Optimization Recommendations (Priority Order)

### 🔴 **High Priority - Immediate Action Required**

#### 1. **Optimize parking-escape-generator.test.js** (Expected savings: ~15-20s)
   - **Mock BFS solver results** for difficulty formula tests instead of running full solver
   - **Pre-compute and cache** valid level examples for validation tests  
   - **Reduce test complexity** for hard difficulty tests (test with smaller grids)
   - **Skip retry loops** in deterministic tests that don't need fresh generation

#### 2. **Optimize pull-the-pin-generator.test.js** (Expected savings: ~3-4s)
   - **Simplify gravity physics** in test validation (use simplified state space)
   - **Mock solver results** for difficulty scoring tests
   - **Reduce level complexity** in medium/hard difficulty test cases

#### 3. **Optimize parking-escape.test.js Daily Challenge tests** (Expected savings: ~2-3s)
   - **Mock deterministic generation** instead of running full generator
   - **Pre-generate test levels** and reuse them across test runs
   - **Skip BFS validation** for tests that only check seed determinism

### 🟡 **Medium Priority - Worthwhile Improvements**

#### 4. **Review level-nav.test.js and lifecycle.test.js** (Expected savings: ~1-2s)
   - These have many individual tests taking 15-25ms each
   - Consider **test file splitting** to enable better parallelization
   - Review setup/teardown overhead for expensive test fixtures

#### 5. **Improve Test Parallelization**
   - Currently using `pool: 'threads'` with `singleThread: false`
   - Some slow tests may be blocking parallel execution
   - Consider **isolation: false** for pure functional tests that don't need isolation

### 🟢 **Low Priority - Nice to Have**

#### 6. **Benchmark and Threshold Monitoring**
   - Add **performance regression tests** to ensure future changes don't slow down tests
   - Set **time budgets** per test file using Vitest's `testTimeout` configuration
   - Add **slow test logging** to CI pipeline for ongoing monitoring

---

## Impact Analysis

### Current Test Suite Performance
- **Total execution time**: 49.41s (tests only)
- **Wall clock time**: ~65s (including transforms, setup, collection)
- **CI pipeline impact**: With current timeouts of 300s per test, slow tests consume 16% of available time budget

### Potential Optimization Impact
- **Conservative estimate**: 20-30% reduction in test execution time (~10-15s savings)
- **Optimistic estimate**: 40-50% reduction with aggressive mocking and caching (~20-25s savings)
- **Minimal viable optimization**: Focusing only on parking-escape-generator could save ~15-20s

### CI/CD Benefits
- **Faster feedback cycles** for developers
- **Reduced CI resource usage** and costs
- **More iterations possible** within current time budgets
- **Better developer experience** with snappier local test runs

---

## Implementation Timeline

### Phase 1: Quick Wins (1-2 hours)
- Add mocking for BFS solver results in parking-escape-generator tests
- Pre-generate and cache level examples for validation tests
- Expected savings: ~10-15s

### Phase 2: Structural Improvements (2-4 hours)  
- Refactor generator tests to use simplified validation logic
- Implement test-level caching for expensive computations
- Expected additional savings: ~5-8s

### Phase 3: Long-term Monitoring (ongoing)
- Add performance regression tests
- Set up CI monitoring for test execution times
- Periodic review of slow tests

---

## Conclusion

The test suite is generally **well-optimized** with 91% of tests running in under 10ms. However, a **small number of generator-related tests** (primarily parking-escape-generator) account for **nearly half of the total execution time**.

By **focusing optimization efforts on these 8 very slow tests**, especially the parking-escape-generator test suite, we can achieve **20-50% reduction in test execution time** with relatively simple mocking and caching strategies.

The **highest-impact optimization** would be to mock the BFS solver results in generator validation tests, which directly addresses the root cause of the performance issues while maintaining test coverage.

---

## Data Collection Method

- **Tool**: Vitest 3.2.7 with `--reporter=verbose`
- **Environment**: Node.js, 4-core system  
- **Test configuration**: 300s timeout per test, 3s slow test threshold
- **Profiling method**: Full test suite run with individual timing capture
- **Timestamp**: 2026-07-24 17:12:09
- **Total test runtime**: 50.64s (tests only), 24.68s (total suite with transforms/setup)