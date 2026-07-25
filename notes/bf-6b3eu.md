# Test Suite Performance Profile - Baseline Analysis

**Date:** 2026-07-24
**Task:** Profile test suite to identify performance bottlenecks
**Method:** 5 complete test runs, timing data collection and analysis

## Executive Summary

- **Total Test Files:** 120
- **Total Tests:** 5,360
- **Average Runtime:** 53.04 seconds
- **Test Execution Time:** 41.75s (78.7%)
- **Setup/Teardown Overhead:** 11.29s (21.3%)

## Overall Timing Breakdown

Across 5 baseline runs:

| Component | Average Time | Percentage |
|-----------|-------------|------------|
| **Total Duration** | 53.04s | 100% |
| Tests | 41.75s | 78.7% |
| Collect | 32.32s | 60.9% |
| Environment | 42.44s | 80.0% |
| Prepare | 32.62s | 61.5% |
| Transform | 5.78s | 10.9% |
| Setup | 2.34s | 4.4% |

**Overhead (non-test execution):** 11.29s (21.3%)

## Individual Run Variance

| Run | Total | Tests | Overhead |
|-----|-------|-------|----------|
| 1 | 45.55s | 34.32s | 11.23s |
| 2 | 60.26s | 44.46s | 15.80s |
| 3 | 54.83s | 43.40s | 11.43s |
| 4 | 61.56s | 49.68s | 11.88s |
| 5 | 43.02s | 36.91s | 6.11s |

**Min:** 43.02s | **Max:** 61.56s | **Variance:** 18.54s (43% swing)

## Critical Bottlenecks (>500ms average)

### 1. **generateBatch > medium levels are structurally valid when generated**
- **Average:** 824ms
- **Max:** 1,007ms
- **Min:** 665ms
- **Location:** `tests/unit/pull-the-pin-generator.test.js:366`
- **Code:** `generateBatch(1000, 'medium', 2)` - generates 1000 medium levels

### 2. **generateLevel > structure > medium levels have 3 colors and 3 cups/balls**
- **Average:** 634ms
- **Max:** 752ms
- **Min:** 511ms
- **Location:** `tests/unit/pull-the-pin-generator.test.js`

### 3. **generateLevel > structure > hard levels have 4 colors and 4 cups/balls**
- **Average:** 629ms
- **Max:** 828ms
- **Min:** 502ms
- **Location:** `tests/unit/pull-the-pin-generator.test.js`

### 4. **generateLevel > unknown difficulty fallback**
- **Average:** 599ms
- **Max:** 898ms
- **Min:** 463ms
- **Location:** `tests/unit/pull-the-pin-generator.test.js`

### 5. **generateLevel > hero is horizontal and on exit row (y=2)**
- **Average:** 532ms
- **Max:** 841ms
- **Min:** 440ms
- **Location:** `tests/unit/parking-escape-generator.test.js`

### 6. **Water Sort Solver — generated hard levels > BFS-solvable**
- **Average:** 529ms
- **Max:** 597ms
- **Min:** 442ms
- **Location:** `tests/solvers/water-sort-solver.test.js`

### 7. **generateLevel > always includes a hero vehicle**
- **Average:** 519ms
- **Max:** 628ms
- **Min:** 376ms
- **Location:** `tests/unit/parking-escape-generator.test.js`

## High Variance Test (Critical Issue)

### **Daily Challenge > generates different levels from different seeds**
- **Average:** 439ms
- **Max:** **4,407ms** ⚠️
- **Min:** 0ms
- **Location:** `tests/unit/parking-escape.test.js:835`
- **Issue:** **Extreme variance - 10x swing** indicates non-deterministic behavior or resource contention

```javascript
// tests/unit/parking-escape.test.js:835
it('generates different levels from different seeds', async () => {
  const level1 = generateLevel('seed-1', 'easy', 0);
  const level2 = generateLevel('seed-2', 'easy', 0);

  if (level1 !== null && level2 !== null) {
    expect(level1.grid.vehicles).not.toEqual(level2.grid.vehicles);
  }
});
```

## Test Timing Distribution

| Range | Count | Percentage |
|-------|-------|------------|
| <100ms | 5,178 | 98.5% |
| 100-299ms | 64 | 1.2% |
| 300-499ms | 8 | 0.2% |
| 500-999ms | 7 | 0.1% |
| ≥1000ms | 0 | 0.0% |

**Finding:** 98.5% of tests complete in <100ms, but the remaining 1.5% account for significant execution time.

## Root Cause Analysis

### Primary Bottlenecks:

1. **Level Generation (Pull-the-Pin)**
   - `generateBatch(1000, ...)` generates 1000 levels per test
   - Medium difficulty has low success rate, requiring multiple retries
   - Each level generation involves:
     - Random seed-based generation
     - Solvability validation (BFS solver)
     - Retry loops on failure

2. **BFS Solver Operations**
   - Water sort solver runs BFS on generated levels
   - Parking escape solver validates solvability
   - These are inherently expensive operations

3. **Daily Challenge Test Variance**
   - Extreme timing variance suggests:
     - Possible resource contention
     - Non-deterministic generation behavior
     - Generator retry loops with variable success rates

### Setup/Telemetry Overhead (21.3%):

- **Transform (10.9%):** Module transformation and bundling
- **Collect (60.9%):** Test discovery and collection
- **Environment (80.0%):** jsdom environment setup
- **Prepare (61.5%):** Worker thread preparation

## Optimization Opportunities

### High Impact (address individual slow tests):

1. **`tests/unit/pull-the-pin-generator.test.js:366`**
   - Reduce batch size from 1000 to 100-200 levels
   - Expected savings: ~700ms per run

2. **`tests/unit/parking-escape.test.js:835`**
   - Investigate extreme variance (4.4s max)
   - Add deterministic seed handling or timeout protection
   - Expected savings: ~400ms on worst runs

3. **Parallel generator tests**
   - Current tests run sequentially in same file
   - Could split into independent test files for parallel execution
   - Expected savings: ~2-3s through better CPU utilization

### Medium Impact (architectural improvements):

1. **Mock expensive solver operations**
   - BFS solvers could use pre-computed results in most tests
   - Only validate solver correctness in dedicated solver tests

2. **Level generation caching**
   - Cache generated levels across test runs
   - Use deterministic seeds for reproducibility

3. **Reduce retry loops in generators**
   - Current generators retry up to 10 times on failure
   - Tests could use easier difficulties or better seeds

### Low Impact (optimization tweaks):

1. **Worker pool optimization**
   - Current: 2-4 threads
   - Could increase to match CPU core count (if tests are CPU-bound)

2. **Module caching**
   - Already enabled, but verify no redundant imports

## Next Steps

1. ✅ **Measurement complete** - baseline data collected
2. **Fix high-variance test** - investigate daily challenge variance
3. **Reduce batch sizes** - optimize generateBatch tests
4. **Re-measure** - validate improvements

## Acceptance Criteria Status

- ✅ Run full test suite 5 times to collect baseline timing data
- ✅ Identify all test cases taking >5s individually (none found >5s, but 7 tests >500ms)
- ✅ Measure test setup/teardown overhead (21.3% overhead)
- ✅ Document current bottlenecks with specific file:line references
- ✅ Create timing profile showing where time is spent
