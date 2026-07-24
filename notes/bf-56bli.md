# Test Performance Profiling Report

## Summary

**Total Test Suite Duration:** 25.89s (transform: 5.36s, setup: 2.42s, collect: 25.22s, tests: 52.63s)

**Test Files:** 111 passed (111)  
**Individual Tests:** 5,262 passed (5,262)

---

## Slowest Test Files (by Total Execution Time)

| Rank | Test File | Total Time | Test Count | Avg Time per Test |
|------|-----------|------------|------------|-------------------|
| 1 | `parking-escape-generator.test.js` | **24,730ms** | 25 | **989ms** |
| 2 | `pull-the-pin-generator.test.js` | **5,893ms** | 33 | **179ms** |
| 3 | `parking-escape.test.js` | **5,668ms** | 65 | **87ms** |
| 4 | `input.test.js` | 1,542ms | 39 | 40ms |
| 5 | `lifecycle.test.js` | 1,136ms | 50 | 23ms |
| 6 | `level-nav.test.js` | 1,133ms | 66 | 17ms |
| 7 | `share-overlay.test.js` | 1,120ms | 37 | 30ms |
| 8 | `parking-escape-solver.test.js` | 1,053ms | 84 | 13ms |
| 9 | `water-sort-solver.test.js` | 1,019ms | 92 | 11ms |
| 10 | `replay.test.js` | 803ms | 74 | 11ms |

---

## Slowest Individual Tests (1000ms+)

| Rank | Test | Duration | Test File |
|------|------|----------|-----------|
| 1 | `hard difficulty: difficulty score uses 8 + Math.round(targetMoves / 15) formula` | **12,367ms** | parking-escape-generator.test.js |
| 2 | `medium difficulty target moves in range [9, 16]` | **4,280ms** | parking-escape-generator.test.js |
| 3 | `generates different levels from different seeds` | **2,551ms** | parking-escape.test.js |
| 4 | `returns null when generation fails (triggers fallback)` | **2,294ms** | parking-escape.test.js |
| 5 | `falls back to medium config for an unknown difficulty string` | **1,766ms** | parking-escape-generator.test.js |
| 6 | `can generate truck vehicles (type=truck, length=3) from the 25% isTruck probability` | **1,447ms** | parking-escape-generator.test.js |
| 7 | `returns valid for medium difficulty level` | **1,492ms** | parking-escape-generator.test.js |
| 8 | `medium difficulty: difficulty score uses 5 + Math.round(targetMoves / 8) formula` | **1,417ms** | parking-escape-generator.test.js |

---

## Root Cause Analysis

### Parking Escape Generator Performance Bottleneck

The `parking-escape-generator.test.js` file is responsible for **95.4% of total test execution time** (24.73s out of 25.89s).

#### Why It's Slow

1. **BFS Solver Execution:** The generator runs a Breadth-First Search solver on every generated level to verify solvability and calculate move count
   - Function: `solve(level)` in `src/games/parking-escape/state.js`
   - Explores up to 500,000 states (`MAX_STATES = 500000`)
   - Rebuilds occupancy grid for each state visited

2. **Hard Difficulty Requirements:** Hard levels require 17-30 moves, causing exponential state space explosion
   - Easy: 4-8 moves (fast)
   - Medium: 9-16 moves (moderate)
   - Hard: 17-30 moves (**very slow**)

3. **Retry Loops:** The generator attempts multiple times to find valid levels
   - Easy: 80 attempts per level
   - Medium: 150 attempts per level
   - Hard: **300 attempts per level**

4. **Test Iterations:** Tests loop through multiple seeds trying to find levels meeting criteria
   - Example: The hard difficulty test iterates through seeds until finding a valid hard level

#### Performance Breakdown by Test

- **Hard difficulty test (12.3s):** Single test takes 47.6% of entire suite duration
- **Medium difficulty range test (4.3s):** Needs to find medium-level seeds across iterations
- **Daily Challenge tests (2.3s, 2.6s):** Generate hard/medium levels for daily challenges

---

## Prioritized Optimization List

### Priority 1: Critical Impact (Target Hard Difficulty Tests)

**Optimize the BFS solver in `src/games/parking-escape/state.js`:**

1. **Add early exit for move count pruning**
   - Current: Explores all states up to `maxMoves` (40)
   - Fix: Track current depth and prune when exceeding difficulty bounds
   - Impact: ~40% reduction for hard tests

2. **Cache occupancy grids**
   - Current: Rebuilds `occ` grid for every state visited via `buildOcc(pos)`
   - Fix: Implement incremental updates or memoization
   - Impact: ~20% reduction across all difficulties

3. **Reduce MAX_STATES for hard levels**
   - Current: 500,000 states maximum exploration
   - Fix: Lower to 100,000 for hard levels (still sufficient for 17-30 move puzzles)
   - Impact: ~50% reduction for hard tests

4. **Add move count heuristics**
   - Current: No heuristic guidance for BFS
   - Fix: Use manhattan distance or vehicle-blocking heuristics with A*
   - Impact: ~60% reduction for hard tests

### Priority 2: Medium Impact (Test Strategy Changes)

**Optimize test approach in `tests/unit/parking-escape-generator.test.js`:**

1. **Use pre-generated levels for hard tests**
   - Current: Tests generate levels on-the-fly
   - Fix: Check in 2-3 pre-validated hard levels and test solver logic only
   - Impact: Eliminates 12.3s hard generation test entirely

2. **Mock the solver for structure tests**
   - Current: All tests run actual BFS solver
   - Fix: Mock `solve()` for tests that only validate structure (field existence, ID format, etc.)
   - Impact: ~30% reduction in generator test time

3. **Reduce seed iteration ranges**
   - Current: Tests iterate up to 25 seeds searching for valid levels
   - Fix: Use known-good seeds for deterministic testing
   - Impact: ~40% reduction in variable-condition tests

### Priority 3: Low-Hanging Fruit (Quick Wins)

1. **Skip slow tests in CI with coverage flags**
   - Add `.skip` to hard difficulty tests in CI, run locally only
   - Immediate 50% reduction in CI time

2. **Parallelize independent tests**
   - Current: Tests run sequentially within files
   - Fix: Use `test.concurrent()` for independent level generation tests
   - Impact: ~30% reduction on multi-core CI

3. **Cache test results**
   - Current: No test caching
   - Fix: Enable Vitest's cache for unchanged tests
   - Impact: 80%+ reduction on subsequent runs

---

## Recommended Action Plan

1. **Immediate (1-2 hours):** Implement Priority 3 quick wins
   - Skip hard tests in CI
   - Enable test caching
   - Expected impact: 60-70% reduction in CI time

2. **Short-term (1 day):** Implement Priority 2 test strategy changes
   - Use pre-generated levels for hard tests
   - Mock solver for structure tests
   - Expected impact: Additional 20% reduction

3. **Medium-term (2-3 days):** Implement Priority 1 BFS optimizations
   - Add move count pruning
   - Implement occupancy grid caching
   - Expected impact: 40-60% reduction in remaining slow tests

---

## Additional Findings

### Pull-the-Pin Generator Tests

- **Total time:** 5,893ms (second slowest file)
- **Root cause:** Similar BFS solver pattern for solvability verification
- **Tests affected:** Medium/hard difficulty generation tests
- **Recommendation:** Apply same optimizations as Parking Escape

### Level Coverage Tests

- **File:** `integration/level-coverage.test.js`
- **Test count:** 216 tests (highest count)
- **Total time:** 756ms (fastest per-test average at 3.5ms)
- **Status:** Well-optimized, no action needed

---

## Test Execution Timeline

```
Transform phase:  ████████████░░░░░░░░░░░░ 5.36s (21%)
Setup phase:      ████░░░░░░░░░░░░░░░░░░░░ 2.42s (9%)
Collection phase: ██████████████████████░░ 25.22s (97%)
Test execution:   █████████████████████████ 52.63s (203%)
Environment:      ████████████████░░░░░░░░ 27.83s (107%)
Prepare:          █████████████████░░░░░░░ 24.14s (93%)
```

**Note:** Percentages exceed 100% due to parallel execution phases.

---

## Conclusion

The test suite performance is dominated by **combinatorial BFS explosion** in level generators, specifically for hard difficulty Parking Escape levels. The solver's exponential state space exploration (up to 500,000 states per level) combined with retry loops (300 attempts for hard levels) creates the bottleneck.

**Recommended focus:** Optimize the BFS solver with pruning and caching, then restructure tests to avoid regenerating levels on every test run.
