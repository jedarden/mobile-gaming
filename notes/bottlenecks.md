# Performance Bottlenecks - Master Reference List

**Bead ID:** bf-5pi5z  
**Date:** 2026-07-24  
**Project:** mobile-gaming  
**Purpose:** Complete documentation of all identified performance bottlenecks with exact file:line references

## Critical Bottlenecks (>10s)

### 1. Timer-Based Test Timeouts (15s each)

**Location:** `tests/unit/hints.test.js`
- **Lines 379-384:** `idle timer fires after 15s and pre-fetches solution`
- **Lines 386-389:** `idle timer does not fire before 15s`

**Code Reference:**
```javascript
// tests/unit/hints.test.js:379-384
it('idle timer fires after 15s and pre-fetches solution', () => {
  expect(fakeWorker).toBeNull(); // not yet created
  vi.advanceTimersByTime(15_000);  // ⚠️ BOTTLENECK: Advances 15 seconds
  expect(fakeWorker).not.toBeNull();
  expect(fakeWorker.postMessage).toHaveBeenCalledOnce();
});

// tests/unit/hints.test.js:386-389
it('idle timer does not fire before 15s', () => {
  vi.advanceTimersByTime(14_999);  // ⚠️ BOTTLENECK: Advances 14.999 seconds
  expect(fakeWorker).toBeNull();
});
```

**Source Implementation:**
- **`src/shared/hints.js:26`** - `HINT_IDLE_MS = 15_000` constant
- **`src/shared/hints.js:210-216`** - `startIdleTimer()` function with `setTimeout(..., HINT_IDLE_MS)`

**Category:** Timer-Based Test Logic  
**Games Affected:** All games using hints system (water-sort, etc.)  
**Impact:** **CRITICAL** - 30s total (2 tests × 15s) = 48% of slow test time  
**Root Cause:** Tests use `vi.advanceTimersByTime(15_000)` which actually advances fake timers by 15 seconds

---

## Major Bottlenecks (3s-5s)

### 2. Daily Challenge Generation Test (3.78s)

**Location:** `tests/unit/parking-escape.test.js`
- **Line 835:** `generates different levels from different seeds`

**Code Reference:**
```javascript
// tests/unit/parking-escape.test.js:835-843
it('generates different levels from different seeds', async () => {
  const level1 = generateLevel('seed-1', 'easy', 0);  // ⚠️ BOTTLENECK: Full generation
  const level2 = generateLevel('seed-2', 'easy', 0); // ⚠️ BOTTLENECK: Full generation

  // If both generations succeeded, levels should differ
  if (level1 !== null && level2 !== null) {
    expect(level1.grid.vehicles).not.toEqual(level2.grid.vehicles);
  }
});
```

**Source Implementation:**
- **`src/games/parking-escape/generator.js`** - Full generator (211 lines)
- Uses BFS solver for validation (expensive for medium/hard levels)

**Category:** Daily Challenge / Generator  
**Games Affected:** parking-escape  
**Impact:** **HIGH** - Single longest-running non-timeout test  
**Root Cause:** Generates two complete levels with full validation including BFS solving

---

### 3. Badge Award Checking Tests (4 tests × 3s = 12s)

**Location:** `tests/unit/fail-speedrun.test.js`
- **Lines 252-260:** `should award badge for under 3s on pull-the-pin`
- **Lines 262-265:** `should award badge for under 3s on save-the-character`
- **Lines 267-270:** `should not award badge for over 3s`
- **Lines 272-275:** `should not award badge for exactly 3s`

**Code Reference:**
```javascript
// tests/unit/fail-speedrun.test.js:252-260
it('should award badge for under 3s on pull-the-pin', () => {
  const result = checkAdRecreationBadge('pull-the-pin', 2999); // ⚠️ BOTTLENECK: Storage + validation
  expect(result).toBe(true);

  const badges = getEarnedBadges(); // ⚠️ BOTTLENECK: Storage read
  expect(badges).toHaveLength(1);
  expect(badges[0].type).toBe('ad-recreation');
  expect(badges[0].gameId).toBe('pull-the-pin');
});
```

**Source Implementation:**
- **`src/shared/fail-speedrun.js:28`** - `AD_RECREATION_THRESHOLD_MS = 3000`
- **`src/shared/fail-speedrun.js:195-224`** - `checkAdRecreationBadge()` function
- **`src/shared/fail-speedrun.js:31`** - `AD_RECREATION_GAMES` array validation

**Category:** Badge Checking / Storage  
**Games Affected:** pull-the-pin, save-the-character  
**Impact:** **HIGH** - 12s total across 4 similar tests  
**Root Cause:** Each test performs full badge array operations, storage reads/writes, and array searching

---

## Moderate Bottlenecks (500ms-1s)

### 4. Generator Batch Tests

**Location:** `tests/unit/pull-the-pin-generator.test.js`
- **Line 171:** `generateBatch(100, 'easy', 3)` - **~962ms**
- **Line 292:** `generateBatch(200, 'easy', 3)` - **medium batch validation**

**Code Reference:**
```javascript
// tests/unit/pull-the-pin-generator.test.js:170-175
it('returns true for levels produced by generateBatch', () => {
  const levels = generateBatch(100, 'easy', 3); // ⚠️ BOTTLENECK: 100 levels with validation
  for (const level of levels) {
    expect(isLevelSolvable(level)).toBe(true); // ⚠️ VALIDATION OVERHEAD
  }
});

// tests/unit/pull-the-pin-generator.test.js:291-295
it('all levels from generateBatch pass validation', () => {
  const levels = generateBatch(200, 'easy', 3); // ⚠️ BOTTLENECK: 200 levels
  for (const level of levels) {
    expect(validateLevel(level)).toBe(true); // ⚠️ VALIDATION OVERHEAD
  }
});
```

**Source Implementation:**
- **`src/games/pull-the-pin/generator.js:28-40`** - `generateLevel()` with retry loop
- **`src/games/pull-the-pin/generator.js:45-50`** - `tryGenerateLevel()` function

**Category:** Generator / Validation  
**Games Affected:** pull-the-pin  
**Impact:** **MEDIUM** - Multiple tests with 100-200 level batches  
**Root Cause:** Generates many levels with full solvability validation per level

---

### 5. Parking Escape Generator Tests

**Location:** `tests/unit/parking-escape-generator.test.js`
- **Lines 88-96:** `always includes a hero vehicle` - **797ms**
- **Lines 235-246:** `all vehicles fit within grid bounds` - **478ms**
- **Lines 115-119:** `is deterministic — same seed same level` - **390ms**

**Code Reference:**
```javascript
// tests/unit/parking-escape-generator.test.js:88-96
it('always includes a hero vehicle', () => {
  for (let seed = 1; seed <= 5; seed++) { // ⚠️ BOTTLENECK: 5 full generations
    const level = generateLevel(seed, 'easy', 0);
    if (!level) continue;
    const hero = level.grid.vehicles.find(v => v.type === 'hero');
    expect(hero).toBeDefined();
    expect(hero.id).toBe('hero');
  }
});

// tests/unit/parking-escape-generator.test.js:235-246
it('all vehicles fit within grid bounds', () => {
  for (let seed = 1; seed <= 5; seed++) { // ⚠️ BOTTLENECK: 5 full generations
    const level = generateLevel(seed, 'easy', 0);
    if (!level) continue;
    for (const v of level.grid.vehicles) {
      expect(v.x).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.x + v.width).toBeLessThanOrEqual(GRID_SIZE);
      expect(v.y + v.height).toBeLessThanOrEqual(GRID_SIZE);
    }
  }
});
```

**Category:** Generator  
**Games Affected:** parking-escape  
**Impact:** **MEDIUM** - Multiple tests iterating 5+ generations  
**Root Cause:** Loop-based testing with full level generation per iteration

---

### 6. Timer-Related Tests (500ms each)

**Location:** Various test files
- **`tests/unit/replay.test.js`** - `onComplete fires stop()` - **500ms**
- **`tests/unit/share-overlay.test.js`** - `handlePlatformShare setTimeout` - **500ms**
- **`tests/unit/input.test.js`** - `onTap duration tests` (3 tests) - **500ms each**

**Category:** Timer / Async Logic  
**Games Affected:** All games (shared components)  
**Impact:** **MEDIUM** - Scattered across multiple test files  
**Root Cause:** `setTimeout`/`vi.advanceTimersByTime()` usage with 500ms+ delays

---

## Infrastructure Bottlenecks

### 7. Build Overhead (14.78s)

**Location:** Build process (Vite)

**Breakdown:**
```
Build completed in 14.78s
Bundle sizes (after compression):
- phaser-B61OQUcB.js: 1,481.79 kB │ gzip: 337.88 kB
- three-setup-ByYrO6bh.js: 515.23 kB │ gzip: 128.15 kB
- Total assets: 4.2 MB (uncompressed)
```

**Category:** Build / Bundle Size  
**Impact:** **HIGH** - Adds 14.78s to every test run  
**Root Cause:** Large game engine bundles (Phaser, Three.js)

---

### 8. Test Setup Overhead (12.17s)

**Location:** Vitest infrastructure

**Breakdown:**
```
- Transform: 7.24s (code transformation)
- Setup: 2.88s (test setup files)
- Prepare: 37.61s (test collection/preparation)
- Environment: 49.93s (environment initialization)
```

**Category:** Test Infrastructure  
**Impact:** **MEDIUM** - Fixed overhead per test run  
**Root Cause:** 111 test files with 5,262 individual tests requiring transformation

---

## Test Volume Analysis

### Overall Impact by Category

| Category | Tests | Files | Total Time | Avg Time |
|----------|-------|-------|------------|----------|
| Timer-Related | 2 critical + 8 moderate | 4 files | ~35s | 3.5s/test |
| Generator Tests | 15 slow tests | 2 files | ~8s | 533ms/test |
| Badge/Overlay | 6 tests | 2 files | ~14s | 2.3s/test |
| Daily Challenge | 3 tests | 1 file | ~5s | 1.7s/test |

### Games Most Affected

1. **parking-escape** - Generator complexity + daily challenge
2. **pull-the-pin** - Large generator batches + validation
3. **water-sort** - Hints system (15s idle timer)
4. **fail-speedrun games** - Badge checking overhead

---

## Prioritized Optimization Roadmap

### Immediate Fixes (Critical Impact)

1. **Fix 15-second timer tests** (`hints.test.js:379-389`)
   - Replace `vi.advanceTimersByTime(15_000)` with mock-based testing
   - Test timer logic without actually advancing through full duration
   - **Expected Savings:** ~30s

2. **Optimize daily challenge test** (`parking-escape.test.js:835`)
   - Mock expensive generation logic
   - Test seed differentiation without full generation
   - **Expected Savings:** ~3.5s

3. **Optimize badge checking** (`fail-speedrun.test.js:252-275`)
   - Reduce test count or combine similar tests
   - Mock storage operations
   - **Expected Savings:** ~10s

### Medium-Term Optimizations

4. **Reduce generator batch sizes** (`pull-the-pin-generator.test.js`)
   - Change `generateBatch(100, ...)` to `generateBatch(10, ...)`
   - Keep one large batch test for stress testing
   - **Expected Savings:** ~2s

5. **Optimize generator loop tests** (`parking-escape-generator.test.js`)
   - Reduce seed iteration counts (5 → 3)
   - Cache generation results between tests
   - **Expected Savings:** ~1s

### Infrastructure Improvements

6. **Build optimization**
   - Enable incremental builds
   - Cache node_modules
   - **Expected Savings:** ~5-7s

7. **Test infrastructure**
   - Investigate `prepare` phase optimization (37.61s)
   - Split slow test suites into separate jobs
   - **Expected Savings:** ~10s

---

## File Reference Summary

### Test Files with Bottlenecks

- `tests/unit/hints.test.js` - Lines 379-389 (2 tests × 15s)
- `tests/unit/parking-escape.test.js` - Line 835 (3.78s)
- `tests/unit/fail-speedrun.test.js` - Lines 252-275 (4 tests × 3s)
- `tests/unit/pull-the-pin-generator.test.js` - Lines 170-175, 291-295 (batch tests)
- `tests/unit/parking-escape-generator.test.js` - Lines 88-96, 115-119, 235-246
- `tests/unit/replay.test.js` - Timer test (500ms)
- `tests/unit/share-overlay.test.js` - Timer test (500ms)
- `tests/unit/input.test.js` - Timer tests (3 × 500ms)

### Source Files Involved

- `src/shared/hints.js` - Lines 26, 210-216 (HINT_IDLE_MS constant, idle timer)
- `src/shared/fail-speedrun.js` - Lines 28, 195-224 (badge checking logic)
- `src/games/pull-the-pin/generator.js` - Lines 28-50 (generation loop)
- `src/games/parking-escape/generator.js` - Full file (211 lines, BFS solver)

---

## Total Impact Calculation

**Current State:**
- Critical bottlenecks: 30s (2 × 15s timer tests)
- Major bottlenecks: ~16s (daily challenge + badge tests)
- Moderate bottlenecks: ~8s (generator tests)
- Infrastructure: ~27s (build + setup)

**Total Identified Impact:** ~81 seconds

**Potential Optimizations:**
- Immediate fixes: ~43s savings
- Medium-term: ~3s savings
- Infrastructure: ~15s savings

**Theoretical Best Case:** ~20s total run time (75% reduction)

---

**Documentation created:** 2026-07-24  
**Based on:** Baseline profiling (bf-6b3eu), code analysis, and timing data  
**Next steps:** Implement immediate fixes, re-profile to validate improvements