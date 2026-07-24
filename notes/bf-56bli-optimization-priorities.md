# Test Optimization Priority List

**Generated**: 2026-07-24  
**Bead**: bf-56bli  
**Goal**: Prioritize tests for performance optimization

---

## 🚨 Critical Priority - Total Expected Savings: ~15-25s

### 1. parking-escape-generator.test.js (23,908ms total) 
**Impact**: 🔴 **HIGHEST** - Single biggest bottleneck  
**Tests**: 25 tests  
**Avg per test**: 956ms  
**Biggest offender**: Single test taking 11,952ms

**Action Items**:
- Mock BFS solver results for difficulty formula tests
- Pre-compute valid levels for validation tests
- Reduce grid complexity in hard difficulty tests
- Remove retry loops from deterministic tests

**Expected savings**: 15-20s

---

### 2. parking-escape.test.js (5,547ms total)
**Impact**: 🟠 **HIGH** - Daily Challenge generation  
**Tests**: 65 tests  
**Avg per test**: 85ms

**Action Items**:
- Mock deterministic generation for Daily Challenge tests
- Pre-generate test levels and reuse them
- Skip BFS validation for seed determinism tests

**Expected savings**: 2-3s

---

### 3. pull-the-pin-generator.test.js (5,424ms total)
**Impact**: 🟠 **HIGH** - Gravity puzzle generation  
**Tests**: 33 tests  
**Avg per test**: 164ms

**Action Items**:
- Simplify gravity physics in test validation
- Mock solver results for difficulty tests
- Reduce complexity in medium/hard tests

**Expected savings**: 3-4s

---

## 🟡 Medium Priority - Total Expected Savings: ~1-2s

### 4. level-nav.test.js (1,411ms total)
**Impact**: 🟡 **MEDIUM** - Navigation tests  
**Tests**: 66 tests  
**Avg per test**: 21ms

**Action Items**:
- Review fixture setup overhead
- Consider test file splitting for better parallelization

**Expected savings**: 0.3-0.5s

---

### 5. lifecycle.test.js (996ms total)
**Impact**: 🟡 **MEDIUM** - Lifecycle tests  
**Tests**: 50 tests  
**Avg per test**: 20ms

**Action Items**:
- Review setup/teardown costs
- Check for redundant test fixtures

**Expected savings**: 0.2-0.4s

---

## 📊 Quick Stats

- **8 tests > 1s** account for ~23s (46% of total time)
- **52 tests > 100ms** account for ~8s (16% of total time)  
- **Fixing top 3 files = ~20-27s savings (40-54% reduction)**
- **Current total test time**: 49.41s
- **Potential optimized time**: 22-29s

---

## 🎯 Optimization Strategy

### Phase 1: BFS Mocking (Highest ROI)
Mock out BFS solver calls in generator validation tests. This directly addresses the root cause of 90% of the slowness.

### Phase 2: Pre-computation  
Pre-generate valid test levels and cache them. Eliminates redundant generation across test runs.

### Phase 3: Complexity Reduction  
Reduce grid sizes and difficulty levels in test cases. Maintains coverage while reducing solver search space.

---

## 📋 Implementation Checklist

- [ ] Mock BFS solver in parking-escape-generator tests
- [ ] Pre-compute levels for validation tests  
- [ ] Optimize parking-escape Daily Challenge tests
- [ ] Mock BFS in pull-the-pin-generator tests
- [ ] Review and optimize level-nav tests
- [ ] Review and optimize lifecycle tests
- [ ] Add performance regression tests
- [ ] Update CI monitoring for test times

---

## 💡 Key Insight

**The vast majority of test slowness comes from generator tests that run BFS solvers to validate levels.** By mocking these solver results (which are deterministic and can be pre-computed), we can dramatically reduce test execution time without sacrificing test coverage or reliability.

The optimization is low-risk because:
1. We're mocking deterministic algorithms, not random behavior
2. We can pre-compute correct results once and reuse them
3. The mocked results are verifiable against the real solver
4. Test logic remains the same, only the validation method changes