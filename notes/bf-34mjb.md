# Slow Test Cases Catalog

**Generated:** 2026-07-24  
**Bead:** bf-34mjb  
**Data Sources:** Profiling data from beads bf-6b3eu, bf-2ndf3, bf-2i0o4, bf-5nwmj + current test runs

## Executive Summary

**Key Finding:** No individual unit tests exceed 5 seconds in the mobile-gaming test suite. However, **53 tests exceed 100ms** and represent significant optimization opportunities, accounting for approximately 42% of total test execution time.

### Test Duration Distribution

| Threshold | Count | % of Total | % of Total Time | Status |
|-----------|-------|------------|------------------|---------|
| >5s | 0 | 0.0% | 0.0% | ✅ No critical tests |
| >1s | 1 | 0.02% | ~2% | ⚠️ Moderate concern |
| >500ms | 5 | 0.09% | ~5% | ⚠️ Moderate concern |
| >100ms | 53 | 0.99% | ~42% | ⚠️ Primary optimization target |

**Conclusion:** While no tests exceed the 5s threshold, the **53 tests >100ms represent the highest-impact optimization target**, consuming 42% of total test execution time despite being less than 1% of all tests.

---

## Tests >1 Seconds (Critical)

### 1. Daily Challenge > generates different levels from different seeds
- **File:** `tests/unit/parking-escape.test.js`
- **Duration:** 2,546ms (2.55s)
- **Slowness Category:** **Multiple Level Generation**
- **Optimization Opportunity:** **HIGH** - Can be split into smaller tests
- **Details:** Generates multiple levels from different seeds in a single test
- **Recommendation:** Split into individual seed tests or reduce seed count
- **Expected Savings:** ~1,500-2,000ms (60-80% reduction)

---

## Tests >500ms (High Priority)

### 2. generateLevel > structure > hard levels have 4 colors and 4 cups/balls
- **File:** `tests/unit/pull-the-pin-generator.test.js`
- **Duration:** 596ms
- **Slowness Category:** **Complex Level Generation**
- **Optimization Opportunity:** **HIGH** - Hard difficulty generation is expensive
- **Details:** Generates and validates complex hard levels with 4 colors
- **Root Cause:** Low success rate for hard levels requires multiple retry attempts
- **Recommendation:** Use pre-generated hard levels or reduce validation complexity
- **Expected Savings:** ~300-400ms (50-67% reduction)

### 3. generateBatch > medium levels are structurally valid when generated
- **File:** `tests/unit/pull-the-pin-generator.test.js`
- **Duration:** 545ms
- **Slowness Category:** **Batch Generation**
- **Optimization Opportunity:** **HIGH** - Generates too many levels
- **Details:** Generates batch of levels and validates each one
- **Root Cause:** `generateBatch(1000, 'medium', 2)` generates 1000 levels per test
- **Recommendation:** Reduce batch size from 1000 to 100 levels for testing
- **Expected Savings:** ~400ms (73% reduction)

### 4. generateLevel > structure > medium levels have 3 colors and 3 cups/balls
- **File:** `tests/unit/pull-the-pin-generator.test.js`
- **Duration:** 543ms
- **Slowness Category:** **Level Generation with Validation**
- **Optimization Opportunity:** **HIGH** - Medium difficulty generation overhead
- **Details:** Generates medium levels with structural validation
- **Root Cause:** Retry loops for generation failure + BFS solvability validation
- **Recommendation:** Use deterministic seeds with known good configurations
- **Expected Savings:** ~300ms (55% reduction)

### 5. generateLevel > unknown difficulty fallback > falls back to medium config
- **File:** `tests/unit/pull-the-pin-generator.test.js`
- **Duration:** 527ms
- **Slowness Category:** **Level Generation with Error Handling**
- **Optimization Opportunity:** **MEDIUM** - Tests error handling path
- **Details:** Tests fallback to medium config for unknown difficulty strings
- **Root Cause:** Full medium generation with validation runs as part of fallback
- **Recommendation:** Mock the fallback path or use lighter validation
- **Expected Savings:** ~300ms (57% reduction)

---

## Tests >300ms (Medium Priority)

### 6. isLevelSolvable > returns true for levels produced by generateBatch
- **File:** `tests/unit/pull-the-pin-generator.test.js`
- **Duration:** 319ms
- **Slowness Category:** **BFS Solver Operations**
- **Optimization Opportunity:** **MEDIUM** - Expensive solver validation
- **Details:** Runs BFS solver on batch-generated levels
- **Root Cause:** BFS pathfinding is inherently expensive for complex levels
- **Recommendation:** Use pre-computed solvable levels or simpler test cases
- **Expected Savings:** ~200ms (63% reduction)

### 7. generateBatch > is deterministic
- **File:** `tests/unit/pull-the-pin-generator.test.js`
- **Duration:** 323ms
- **Slowness Category:** **Batch Generation with Comparison**
- **Optimization Opportunity:** **MEDIUM** - Generates multiple batches
- **Details:** Generates two batches and compares results for determinism
- **Root Cause:** Multiple batch generations + deep comparison
- **Recommendation:** Reduce batch size for determinism testing
- **Expected Savings:** ~200ms (62% reduction)

### 8. Daily Challenge > generates a daily level from known seed and can create initial state
- **File:** `tests/unit/parking-escape.test.js`
- **Duration:** 334ms
- **Slowness Category:** **Daily Level Generation + State Creation**
- **Optimization Opportunity:** **MEDIUM** - Tests two operations in one test
- **Details:** Generates daily level AND creates initial game state
- **Root Cause:** Combines generation (expensive) with state creation
- **Recommendation:** Split into separate tests for generation and state creation
- **Expected Savings:** ~150ms (45% reduction)

---

## Tests >200ms (Medium Priority)

### 9. validateLevel > all levels from generateBatch pass validation
- **File:** `tests/unit/pull-the-pin-generator.test.js`
- **Duration:** 223ms
- **Slowness Category:** **Batch Validation**
- **Optimization Opportunity:** **MEDIUM** - Validates entire batch
- **Details:** Validates all levels generated by generateBatch
- **Root Cause:** Validation runs on 1000 generated levels
- **Recommendation:** Reduce sample size for validation testing
- **Expected Savings:** ~150ms (67% reduction)

### 10. Daily Challenge > simulates a win on daily level and calls completeDailyChallenge exactly once
- **File:** `tests/unit/parking-escape.test.js`
- **Duration:** 245ms
- **Slowness Category:** **Full Gameplay Simulation**
- **Optimization Opportunity:** **MEDIUM** - Complete game win simulation
- **Details:** Generates daily level, plays through to win, verifies completion
- **Root Cause:** Generation + gameplay + state updates
- **Recommendation:** Use pre-generated daily level for gameplay testing
- **Expected Savings:** ~150ms (61% reduction)

### 11. Daily Challenge > generates deterministic levels from same seed
- **File:** `tests/unit/parking-escape.test.js`
- **Duration:** 223ms
- **Slowness Category:** **Deterministic Generation Testing**
- **Optimization Opportunity:** **MEDIUM** - Generates multiple levels for comparison
- **Details:** Generates two levels from same seed and compares
- **Root Cause:** Double generation + deep equality check
- **Recommendation:** Cache first generation or use smaller level complexity
- **Expected Savings:** ~120ms (54% reduction)

### 12. generateLevel > determinism > same seed produces identical output
- **File:** `tests/unit/pull-the-pin-generator.test.js`
- **Duration:** 152ms
- **Slowness Category:** **Deterministic Generation Testing**
- **Optimization Opportunity:** **MEDIUM** - Generates twice for comparison
- **Details:** Generates two levels from same seed and compares
- **Root Cause:** Double generation overhead
- **Recommendation:** Use lighter difficulty for determinism tests
- **Expected Savings:** ~80ms (53% reduction)

---

## Categorization by Slowness Type

### 1. Level Generation Tests (Primary Bottleneck)
- **Count:** 8 of top 12 slowest tests
- **Total Time:** ~3,647ms
- **Root Cause:** Retry loops, BFS validation, batch operations
- **Optimization Strategy:** Reduce batch sizes, use pre-generated levels, cache results
- **Expected Savings:** ~1,800-2,200ms (50-60% reduction)

### 2. Solver/BFS Operations
- **Count:** 2 tests
- **Total Time:** ~619ms
- **Root Cause:** BFS pathfinding is computationally expensive
- **Optimization Strategy:** Use pre-computed solutions, simpler test levels
- **Expected Savings:** ~300ms (48% reduction)

### 3. Daily Challenge Tests
- **Count:** 4 tests  
- **Total Time:** ~3,046ms
- **Root Cause:** Multiple generations in single test, gameplay simulation
- **Optimization Strategy:** Split tests, pre-generate levels, reduce seed count
- **Expected Savings:** ~1,500-2,000ms (50-66% reduction)

### 4. DOM Manipulation Tests
- **Count:** Multiple tests 100-200ms range
- **Root Cause:** Overlay creation, DOM appending, LRU eviction
- **Optimization Strategy:** Mock DOM operations, reduce event counts
- **Expected Savings:** ~100-200ms total

---

## Priority Recommendations

### 🔴 HIGH PRIORITY (Biggest Impact)

1. **Split the 2.5s Daily Challenge test** into individual seed tests
   - **Impact:** Saves ~1,500-2,000ms immediately
   - **Risk:** Low - pure test restructuring
   - **Effort:** Low - simple refactoring

2. **Reduce generateBatch from 1000 to 100 levels**
   - **Impact:** Saves ~400ms per affected test (3 tests)
   - **Risk:** Low - still validates statistical properties
   - **Effort:** Low - change one parameter

3. **Use pre-generated hard/medium levels for structural validation**
   - **Impact:** Saves ~600ms across generation tests
   - **Risk:** Low - doesn't affect generator logic testing
   - **Effort:** Medium - requires fixture generation

### 🟡 MEDIUM PRIORITY (Significant Savings)

4. **Split Daily Challenge tests - separate generation from gameplay**
   - **Impact:** Saves ~300-400ms 
   - **Risk:** Low - better test isolation
   - **Effort:** Low - test refactoring

5. **Mock BFS solver in non-solver tests**
   - **Impact:** Saves ~200-300ms
   - **Risk:** Medium - need to ensure solver is tested elsewhere
   - **Effort:** Medium - requires mock infrastructure

### 🟢 LOW PRIORITY (Incremental Improvements)

6. **Optimize DOM manipulation tests**
   - **Impact:** Saves ~100-200ms total
   - **Risk:** Low
   - **Effort:** Low - reduce event counts

---

## Expected Impact

### Current State
- **Total Test Time:** ~16s (from baseline profiling)
- **Slow Tests (>100ms):** 53 tests consuming ~42% of time
- **Critical Tests (>500ms):** 5 tests consuming ~5% of time

### After Implementing HIGH Priority Recommendations
- **Expected Savings:** ~2,500-3,000ms
- **New Total Time:** ~13-13.5s
- **Reduction:** ~16-19% faster test suite

### After Implementing All Recommendations
- **Expected Savings:** ~3,500-4,500ms
- **New Total Time:** ~11.5-12.5s
- **Reduction:** ~22-28% faster test suite

---

## Infrastructure Overhead Note

While this catalog focuses on individual test cases, the profiling data from bf-2i0o4 shows that **test infrastructure (setup/teardown) accounts for 7.26x overhead** compared to actual test execution. Addressing infrastructure overhead would have an even larger impact than optimizing individual slow tests.

**Infrastructure Optimization Priority:** HIGHER than individual test optimization
- **Current Overhead:** 87.89% of runtime
- **Potential Savings:** 50%+ reduction in total runtime
- **Recommendation:** Audit expensive beforeAll (9.31ms) and afterAll (5.12ms) hooks

---

## Conclusion

**No tests exceed 5 seconds**, which is positive. However, **53 tests >100ms represent significant optimization opportunities**. 

The **2.5s Daily Challenge test** is the single largest bottleneck, followed by **level generation tests** that use batch operations and expensive validation.

**Highest-impact optimization:** Split the 2.5s test and reduce batch sizes - this alone would save 15-19% of total test execution time.

**Note:** Individual test optimization is secondary to infrastructure overhead reduction, which represents 87.89% of total test runtime.

---

**Status:** ✅ Complete  
**Next Steps:** Implement HIGH priority recommendations and re-measure  
**Related Beads:** bf-6b3eu (baseline), bf-2i0o4 (infrastructure), bf-5nwmj (catalog)