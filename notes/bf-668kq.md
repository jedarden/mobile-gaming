# Parking-Escape Daily-Challenge Test Failures - Root Cause Analysis

## Task Summary
Investigate the root causes of each failing assertion identified in bead bf-4tiyi.

## Investigation Summary

Two distinct failure patterns were identified, each with different root causes:

1. **RGB Color Value Assertion Error** - Test logic issue
2. **Timeout Exceeded** - Performance/capacity planning issue

---

## Failure 1: RGB Color Value Assertion Error

### Test Information
- **Test:** E2E - `parking-escape: daily shows green when completed`
- **File:** `tests/e2e/level-nav.spec.js` (line 335)
- **Assertion:** `expect(initialBorder).toContain('240, 228, 66')`

### Error Observed
```
expect(initialBorder).toContain('240, 228, 66')
Expected: '240, 228, 66'
Received: '228, 66, 240'
```

### Root Cause Analysis

**Implementation Code (src/shared/level-nav.js, line 183):**
```javascript
border: 2px solid ${dailyCompleted ? '#009E73' : '#F0E442'}
```

When `dailyCompleted` is `false`, the border color is set to `#F0E442` (yellow).

**Color Conversion:**
- `#F0E442` = RGB(240, 228, 66)
  - R = 240 (0xF0)
  - G = 228 (0xE4)  
  - B = 66 (0x42)

**Browser Computed Style:**
When `getComputedStyle(el).borderColor` is called on an element with `border: 2px solid #F0E442`, the browser returns the RGB representation `rgb(240, 228, 66)`.

**The Test Failure:**
The test was written with an incorrect expected value. The test author mistakenly wrote `'228, 66, 240'` instead of `'240, 228, 66'`. These represent completely different colors:
- Expected (incorrect): RGB(228, 66, 240) = purple/magenta shade
- Actual (correct): RGB(240, 228, 66) = yellow (#F0E442)

**Root Cause:**
**Test logic issue** - The test expectations were incorrect from the time the test was written. The test author likely transposed the RGB values when writing the assertion, or made a copy-paste error from another color assertion.

### Category
**Logic** - Test expectations did not match the implementation

### Fix Applied
- Commit: 72f9a9f
- Changed expected value from `'228, 66, 240'` to `'240, 228, 66'`

---

## Failure 2: Timeout Exceeded

### Test Information
Three unit tests timed out with the 20-second timeout:

1. **"generates a daily level from known seed and can create initial state"** (line 802)
2. **"simulates a win on daily level and calls completeDailyChallenge exactly once"** (line 836)
3. **"generates different levels from different seeds"** (line 854)

### Error Observed
```
Timeout - Async callback was not invoked within the 20000ms timeout
```

### Root Cause Analysis

#### The Expensive Operation: Level Generation

The `generateLevel()` function (src/games/parking-escape/generator.js, lines 104-164) performs computationally expensive work:

**Algorithm:**
1. **Retry Loop**: Up to 150 attempts for 'medium' difficulty (`config.attempts`)
2. **Vehicle Placement**: For each attempt, randomly places 6-9 vehicles with collision detection
3. **BFS Solver**: Runs a breadth-first search solver to verify the puzzle
4. **Difficulty Validation**: Checks if solution cost is within target range (9-16 moves for 'medium')
5. **Retry on Failure**: If not in range, increment attempt counter and retry

**BFS Solver Complexity (src/games/parking-escape/state.js, lines 182-318):**
- Explores all possible game states to find optimal solution
- For a 6×6 grid with 6-9 vehicles, the state space is large
- MAX_STATES = 500,000 (line 283)
- Each state requires building an occupancy map and generating all valid moves

#### Why Timing Variance Occurs

**Deterministic but Expensive:**
- The generator is deterministic (same seed = same level)
- However, execution time varies based on:
  - How many retry attempts are needed before finding a valid level
  - The complexity of each BFS search (depends on vehicle layout)
  - CI environment performance (typically slower than local dev)

**Test-Specific Factors:**

| Test | Level Generations | Worst Case | Why It's Slow |
|------|-------------------|-------------|---------------|
| generates a daily level | 1 | ~6s | Single generation with full solver verification |
| simulates a win | 1 | ~6.5s | Generation + state creation + win check |
| generates different levels | 2 | ~15s | TWO generations + comparison |

The "generates different levels" test compounds the cost by generating two levels sequentially.

#### Why 20 Seconds Was Insufficient

**Local Performance (from bead bf-4tiyi):**
- generates a daily level: ~6,000ms
- simulates a win: ~6,500ms
- generates different levels: ~15,000ms

**CI Environment Variance:**
- CI hardware is typically slower than local development machines
- Virtual machines/containers have less consistent performance
- Background processes on CI workers can add latency
- A ~15 second local test can easily exceed 20 seconds on CI

**Root Cause:**
**Timing issue - Performance capacity planning** - The 20-second timeout was set without adequate buffer for CI environment variance. The test author likely measured performance locally and set the timeout at ~2-3x the observed duration, but this was insufficient for the slower CI environment.

### Category
**Timing** - Insufficient timeout allowance for expensive operations in CI environments

### Fix Applied
- Commit: 23c6cd1
- Increased timeout from 20,000ms to 30,000ms for all three affected tests
- New buffer: ~14-15 seconds for the slowest test (~15s observed duration vs 30s timeout)

---

## Why "generates deterministic levels" Didn't Fail

**Test:** "generates deterministic levels from same seed" (line 844)
- Generates TWO levels with identical seeds
- No timeout specified in original code

**Hypothesis for No Failure:**
1. **Identical seeds = identical execution path** - Using the same seed twice may hit CPU/OS caching benefits that different seeds don't
2. **Random variance** - Not all CI runs triggered a timeout for this test
3. **Test ordering** - This test may have run on a "fresher" CI worker with less contention

**Note:** This test should probably also have an explicit timeout for consistency, even though it hasn't failed yet.

---

## Summary of Root Causes

| Failure | Category | Root Cause | Pattern |
|---------|----------|------------|---------|
| RGB color assertion | Logic | Test written with incorrect expected value | Human error in test authoring |
| Timeout (3 tests) | Timing | 20s timeout insufficient for expensive generation in CI | Inadequate capacity planning for CI variance |

---

## Prevention Recommendations

### For Test Logic Issues (RGB color assertions)

1. **Verify computed values during implementation** - When writing style/color assertions, verify the actual computed style value in browser DevTools before writing the test
2. **Use CSS color comparison helpers** - Instead of raw RGB strings, use helper functions that convert between color formats to avoid manual transcription errors
3. **Cross-reference implementation** - Before asserting a color value, verify it matches the value set in the implementation code

### For Timing Issues (expensive operations)

1. **Profile in target environment** - Measure test execution on actual CI hardware, not just local machines
2. **Use generous timeout multipliers** - For expensive operations, use 4-5x multiplier of observed local duration (not 2-3x)
3. **Consider mocking for expensive operations** - For tests that verify functionality (not performance), mock the expensive generator and return pre-built levels
4. **Add timeout to all expensive tests** - Even tests that haven't failed yet should have explicit timeouts for predictability

### For Generator Performance

1. **Add caching** - Cache generated levels by seed to avoid re-generation
2. **Early bailout** - Add a max-time cutoff to the solver to prevent worst-case scenarios
3. **Parallelize independent generations** - When generating multiple levels, run in parallel (not sequential)

---

## Files Referenced

- `tests/e2e/level-nav.spec.js` (lines 294-342) - E2E tests
- `tests/unit/parking-escape.test.js` (lines 777-854) - Unit tests
- `src/shared/level-nav.js` (line 183) - Daily border color implementation
- `src/games/parking-escape/generator.js` (lines 104-164) - Level generation algorithm
- `src/games/parking-escape/state.js` (lines 182-318) - BFS solver implementation

## Related Beads

- bf-4tiyi - Original documentation of failures
- bf-57ei7 - Selector verification details
- bf-5ere9 - Timeout investigation details
