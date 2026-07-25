# Slow Test Catalog

**Generated:** 2026-07-24  
**Bead:** bf-5nwmj  
**Data Source:** test-timing-run-iteration-1.log

## Summary

Based on analysis of baseline timing data from 5,360 total tests:

- **Total test time:** 16.17s (16,170ms)
- **Threshold (>5s):** No tests exceed 5 seconds
- **Slowest test:** 1.36s (1,360ms)
- **Tests >= 100ms:** 36 tests (0.7% of all tests) consuming 42.4% of total time
- **Tests >= 50ms:** 75 tests (1.4% of all tests) consuming 58.9% of total time

### Key Finding

While no individual tests exceed 5 seconds, the **slowest 0.7% of tests (>= 100ms) account for 42.4% of total test execution time**. This is the primary optimization target.

## Top 30 Slowest Tests (Ranked)

| Rank | Time | Test File | Test Description |
|------|------|-----------|------------------|
| 1 | 1,360ms | tests/unit/parking-escape.test.js | Daily Challenge > generates different levels from different seeds |
| 2 | 356ms | tests/unit/pull-the-pin-generator.test.js | generateBatch > medium levels are structurally valid when generated |
| 3 | 252ms | tests/unit/pull-the-pin-generator.test.js | generateBatch > is deterministic |
| 4 | 246ms | tests/solvers/water-sort-solver.test.js | Water Sort Solver — generated hard levels > generated hard level 0 is BFS-solvable |
| 5 | 244ms | tests/unit/parking-escape-generator.test.js | generateLevel > always includes a hero vehicle |
| 6 | 237ms | tests/unit/pull-the-pin-generator.test.js | generateLevel > structure > medium levels have 3 colors and 3 cups/balls |
| 7 | 200ms | tests/unit/parking-escape.test.js | Daily Challenge > generates a daily level from known seed and can create initial state |
| 8 | 194ms | tests/unit/pull-the-pin-generator.test.js | generateLevel > unknown difficulty fallback > falls back to medium config for an unknown difficulty string |
| 9 | 192ms | tests/unit/pull-the-pin-generator.test.js | generateLevel > structure > hard levels have 4 colors and 4 cups/balls |
| 10 | 180ms | tests/unit/analytics.test.js | LRU eviction > does not exceed 500 events |
| 11 | 169ms | tests/unit/parking-escape-generator.test.js | generateLevel > vehicles have no overlapping cells |
| 12 | 165ms | tests/unit/fail-speedrun.test.js | showFailResult > appends overlay to document.body when no container provided |
| 13 | 162ms | tests/unit/parking-escape-generator.test.js | generateLevel > hero is horizontal and on exit row (y=2) |
| 14 | 157ms | tests/unit/parking-escape-generator.test.js | generateLevel > all vehicles fit within grid bounds |
| 15 | 154ms | tests/solvers/parking-escape-solver.test.js | Parking Escape Solver > level pe-60 solution replays to won |
| 16 | 151ms | tests/unit/score.test.js | showLevelComplete — DOM creation > appends .mg-score-overlay to the given container |
| 17 | 150ms | tests/unit/fail-speedrun-overlay.test.js | showFailResult > appends an overlay to the container |
| 18 | 148ms | tests/solvers/parking-escape-solver.test.js | Parking Escape Solver > level pe-60 solver cost equals targetMoves |
| 19 | 148ms | tests/unit/level-nav.test.js | getLevelProgress > returns saved progress after completeLevel |
| 20 | 147ms | tests/integration/level-coverage.test.js | parking-escape — validateLevel > level pe-60 passes validateLevel |
| 21 | 146ms | tests/solvers/parking-escape-solver.test.js | Parking Escape Solver > level pe-60 solution uses at most maxMoves |
| 22 | 129ms | tests/solvers/water-sort-solver.test.js | Water Sort Solver — generated hard levels > generated hard level 1 is BFS-solvable |
| 23 | 123ms | tests/solvers/parking-escape-solver.test.js | Parking Escape Solver > level pe-60 solution path contains only valid vehicle ids |
| 24 | 122ms | tests/unit/retry.test.js | WIN stats rendering — undefined vs zero > renders moves stat when moves=0 (0 !== undefined) |
| 25 | 122ms | tests/unit/share-overlay.test.js | createShareOverlay > returns an HTMLElement |
| 26 | 121ms | tests/unit/pull-the-pin-generator.test.js | generateBatch > returns the requested number of levels |
| 27 | 119ms | tests/unit/analytics.test.js | LRU eviction > keeps the most recent events when evicting |
| 28 | 118ms | tests/unit/parking-escape-generator.test.js | generateBatch > returns array of levels |
| 29 | 115ms | tests/solvers/parking-escape-solver.test.js | Parking Escape Solver > level pe-60 is solvable |
| 30 | 109ms | tests/integration/level-coverage.test.js | parking-escape — validateLevel > level pe-61 passes validateLevel |

## Time Distribution Analysis

| Threshold | Count | % of Tests | Total Time | % of Total Time |
|-----------|-------|------------|------------|------------------|
| >= 10s | 0 | 0.0% | 0ms | 0.0% |
| >= 5s | 0 | 0.0% | 0ms | 0.0% |
| >= 1s | 1 | 0.0% | 1,360ms | 8.4% |
| >= 500ms | 1 | 0.0% | 1,360ms | 8.4% |
| >= 100ms | 36 | 0.7% | 6,856ms | **42.4%** |
| >= 50ms | 75 | 1.4% | 9,529ms | 58.9% |
| >= 10ms | 226 | 4.2% | 12,463ms | 77.1% |

## Bottleneck Categories

### 1. Level Generation Tests (Pull the Pin)
- **Tests:** #2, #3, #6, #8, #9, #26
- **Total time:** ~1,252ms
- **Pattern:** Random generation with batch operations and structural validation

### 2. Parking Escape Generator Tests
- **Tests:** #5, #11, #13, #14, #28
- **Total time:** ~850ms
- **Pattern:** Vehicle placement validation and grid boundary checks

### 3. Solver Tests (BFS pathfinding)
- **Tests:** #4, #15, #18, #21, #22, #23, #29
- **Total time:** ~1,163ms
- **Pattern:** Full solver runs against complex levels (pe-60, generated hard levels)

### 4. DOM Manipulation Tests
- **Tests:** #10, #12, #16, #17, #19, #24, #25, #27
- **Total time:** ~1,065ms
- **Pattern:** LRU eviction with 500 events, overlay creation, DOM appending

### 5. Daily Challenge Tests
- **Tests:** #1, #7
- **Total time:** ~1,560ms
- **Pattern:** Multiple level generations from different seeds (#1 dominates at 1,360ms)

## Conclusions

1. **No tests exceed 5 seconds** - The baseline is already reasonably performant
2. **The 1.36s test (Daily Challenge > generates different levels from different seeds)** is the single largest bottleneck at 8.4% of total time
3. **36 tests >= 100ms represent 42.4% of execution time** - This is the primary optimization target
4. **Level generation and solver tests** dominate the slowest tests
5. **DOM manipulation tests** with LRU eviction (500 events) are consistently slow

## Verification Status

Findings will be verified by re-running the slowest tests individually.

## Verification Results

Individual test runs were performed to verify the baseline timing data:

| Test | Baseline Time | Verification Time | Status |
|------|--------------|-------------------|--------|
| #1 Daily Challenge > generates different levels | 1,360ms | 926ms | ✓ Verified (slow) |
| #2 generateBatch > medium levels structurally valid | 356ms | 218ms | ✓ Verified (slow) |
| #4 generated hard level 0 is BFS-solvable | 246ms | 162ms | ✓ Verified (slow) |

**Note:** Individual runs are faster than full suite runs due to reduced overhead and lack of test collisions, but the relative slowness is confirmed. All verified tests remain in the slowest percentile.

## Next Steps

To optimize test execution time, focus on:

1. **Priority 1:** The 1.36s Daily Challenge test (#1) - investigate why generating multiple levels from different seeds is slow
2. **Priority 2:** Level generation tests (Pull the Pin, Parking Escape) - batch operations may be inefficient
3. **Priority 3:** Solver tests running full BFS on complex levels - consider using simpler test levels or mocking
4. **Priority 4:** DOM manipulation tests with LRU eviction (500 events) - reduce event count in tests

The **36 tests >= 100ms** represent the highest-impact optimization target, potentially reducing total test time by up to 42.4% if optimized to < 100ms.
