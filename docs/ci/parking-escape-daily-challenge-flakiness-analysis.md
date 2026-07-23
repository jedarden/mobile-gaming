# Parking-Escape Daily-Challenge CI Flakiness Analysis

**Analysis Date:** 2026-07-23  
**Bead:** bf-4m05t  
**Focus:** Daily-challenge test workflow failures

## Executive Summary

**All 10 recent CI workflow runs analyzed failed with identical patterns:**
- **Failure Type:** Unit test timeout (100% of runs)
- **Root Cause:** Test infrastructure issue with `navigator` property mocking
- **Impact:** Total CI pipeline blockage (E2E tests never run)
- **Not Flaky — Consistent Failure:** This is **not** a flakiness issue but a **systematic test infrastructure failure**

## Workflows Analyzed

| Workflow | Completed | Status | Duration | Pattern |
|----------|-----------|--------|----------|---------|
| mobile-gaming-ci-verify-daily-1-pz8zp | 19:00:58Z | ❌ Failed | ~6 min | Unit timeout → build fail |
| mobile-gaming-ci-verify-daily-2-gxhc7 | 19:01:06Z | ❌ Failed | ~6 min | Unit timeout → build fail |
| mobile-gaming-ci-verify-daily-3-xtbjr | 19:01:17Z | ❌ Failed | ~6 min | Unit timeout → build fail |
| mobile-gaming-ci-verify-stability-87rlz | 19:11:55Z | ❌ Failed | ~6 min | Unit timeout → build fail |
| mobile-gaming-ci-manual-whv5t | 18:39:19Z | ❌ Failed | ~6 min | Unit timeout → build fail |
| mobile-gaming-ci-manual-fchnd | 18:47:38Z | ❌ Failed | ~6 min | Unit timeout → build fail |
| mobile-gaming-ci-manual-xqgfl | 18:25:41Z | ❌ Failed | ~6 min | Unit timeout → build fail |
| mobile-gaming-ci-verify-run1-z67w4 | 18:56:06Z | ❌ Failed | ~6 min | Unit timeout → build fail |
| mobile-gaming-ci-verify-run2-vccbr | 18:56:10Z | ❌ Failed | ~6 min | Unit timeout → build fail |
| mobile-gaming-ci-verify-run3-5zghg | 18:56:25Z | ❌ Failed | ~6 min | Unit timeout → build fail |

## Failure Patterns

### Pattern 1: Unit Test Timeout (100% Occurrence)

**Error Message:** `Pod was active on the node longer than the specified deadline`

**Timeout Configuration:** 300 seconds (5 minutes)

**What's Happening:**
1. Unit test suite starts running
2. Tests in `tests/unit/share.test.js` encounter navigator mocking issue
3. All 48 tests in share.test.js fail with: `Cannot set property navigator of #<Object> which has only a getter`
4. Test runner appears to hang or retry extensively, hitting the 5-minute deadline
5. Kubernetes terminates the pod due to timeout

**Test Environment Details:**
- Test framework: Vitest
- Browser env: JSDOM-like environment
- Issue: Test setup code attempts to assign to `navigator` (read-only property)

**Local vs CI Discrepancy:**
- Local runs may show quick failures with proper error messages
- CI runs hit deadline because the test runner struggles with these failures
- The infrastructure difference amplifies the same underlying test bug

### Pattern 2: Build Failure (Secondary Effect)

**Error Message:** `main: Error (exit code 1)`

**What's Happening:**
- Build step is likely configured to run **after** unit tests
- When unit tests fail, build step is skipped or marked as failed
- Build **succeeds locally** in 4.66 seconds with proper bundle sizes
- The "Error (exit code 1)" is a cascading failure from unit test timeout

**Evidence:**
```bash
# Local build succeeds (from prior investigation)
npm run build
# Time: 4.66s
# Output: parking-escape-Rd3l_Kyr.js 31.49 kB, parking-escape-DrzCcPVK.css 0.75 kB
# Both well within 500KB JS / 100KB CSS budget
```

### Pattern 3: E2E Test Skipped (100% of Runs)

**Status:** Not run due to prior failures

**Workflow Configuration:**
```
lint (300s) → [unit (300s) | build (300s)] → e2e (600s)
```

**Impact:**
- Lint succeeds (✅)
- Unit fails (❌) → blocks downstream steps
- Build fails (❌) → likely skipped/failed due to unit failure
- E2E never runs (⏸️)

**For Daily-Challenge Testing:**
- This means daily-challenge E2E tests are **never reached**
- No visibility into whether daily-challenge implementation actually works
- Cannot validate integration with the rest of the game

## Environmental Factors

### CI Environment
- **Cluster:** iad-ci (Rackspace Spot, us-east-iad-1)
- **Base Image:** `node:20-bookworm`
- **Timeout Budget:** 300s per step (unit, build, lint)
- **E2E Timeout:** 600s

### Resource Constraints
- Spot instances can have variable load
- 5-minute timeout is generous for unit tests (should take < 1 minute normally)
- The fact that tests are timing out suggests:
  - Test runner is in a retry loop
  - Or tests are genuinely taking too long due to infrastructure issues

### Timing Analysis
**Expected Unit Test Duration (healthy):** ~30-60 seconds  
**Actual Unit Test Duration (failing):** 300 seconds (timeout)  
**Overhead Factor:** 5-10x slowdown caused by failure handling

## Specific Failure Modes by Test

### tests/unit/share.test.js

**Test Count:** 48 tests  
**Failure Rate:** 100% (48/48 tests failing)  
**Error:** `Cannot set property navigator of #<Object> which has only a getter`

**Root Cause:**
Test setup code is attempting to mock `navigator` using assignment, which fails because `navigator` is a read-only property in modern JavaScript environments.

**Likely Code Pattern (problematic):**
```javascript
// This fails
global.navigator = { ... };

// Should be one of these instead:
Object.defineProperty(global, 'navigator', { value: { ... }, writable: true });
// Or
vi.stubAllGlobals().mockImplementation(() => ({ ... }));
```

**Impact on CI:**
The test runner (vitest) likely attempts to recover from these failures or runs additional cleanup/validation, which extends the runtime beyond the 5-minute deadline.

## Daily-Challenge Specific Impact

### What's NOT Being Tested

Because the unit test suite fails early, the following are **never validated**:

1. **Daily-challenge game mechanics integration**
   - Does the daily challenge mode actually work for parking-escape?
   - Are level selection and completion detection working?

2. **Persistence and state management**
   - Are daily challenges properly saved/loaded?
   - Does state.js correctly handle daily-challenge flag?

3. **UI integration**
   - Are daily-challenge elements rendered correctly?
   - Does the UI show the correct daily challenge status?

4. **Cross-game consistency**
   - Does parking-escape follow the same daily-challenge pattern as other games?

### False Confidence Risk

**Current State:** CI pipeline shows "failed"  
**Interpretation:** "Tests are broken, need to fix"  
**Reality:** Daily-challenge implementation might be **completely non-functional**, but we can't tell because the test infrastructure fails before reaching those tests.

## Comparison to Parking-Escape Results from bf-35fku

The existing documentation at `docs/ci/parking-escape-results.md` already identified this issue but **did not fully recognize it as a blocker to daily-challenge testing**.

**Key Points from Prior Analysis:**
- Unit test timeout identified correctly
- Navigator mocking issue identified correctly  
- Root cause analysis was accurate
- **Missing:** Recognition that this blocks ALL daily-challenge validation

**Additional Findings from This Analysis:**
- Confirmed 10/10 runs fail with **identical** pattern (not flaky, systematic)
- Daily-challenge specific E2E tests never reached
- Build failures are secondary (build works locally)
- Test runner behavior in CI differs from local (timeout vs quick failure)

## Recommendations (Priority Order)

### Critical — Unblock CI Pipeline

1. **Fix tests/unit/share.test.js navigator mocking** (Blocker)
   ```bash
   # Replace navigator assignment with proper mocking
   # Use Object.defineProperty or vitest's vi.stubAllGlobals()
   # This is the single root cause of 100% of CI failures
   ```

2. **Add per-test timeout guards**
   ```javascript
   // In vitest config
   testTimeout: 30000,  // 30 seconds per test
   ```

3. **Add test suite timeout monitoring**
   ```javascript
   // Fail fast if test suite exceeds expected duration
   // Log which tests are slow
   ```

### High — Restore CI Visibility

4. **Add skip-on-failure for non-blocking tests**
   ```yaml
   # In workflow template
   # Allow unit tests to fail without blocking E2E
   # Or split test suite so share tests don't block everything
   ```

5. **Add daily-challenge smoke test before full suite**
   ```javascript
   // Add a quick sanity check that daily-challenge wiring exists
   // This would give visibility even if full unit suite fails
   ```

### Medium — Improve Robustness

6. **Increase unit test timeout from 300s to 600s**
   ```yaml
   # Gives time for slow-but-correct tests
   # But doesn't fix the root cause
   ```

7. **Run unit tests with verbose output in CI**
   ```bash
   # Capture detailed failure logs
   # Helps debug future issues
   ```

## Next Steps for Parking-Escape Daily-Challenge

Once CI is unblocked:

1. **Confirm daily-challenge wiring exists**
   ```bash
   # Check for daily-challenge integration in parking-escape
   grep -r "dailyChallenge" src/games/parking-escape/
   ```

2. **Run daily-challenge specific E2E tests**
   ```bash
   # Targeted E2E for daily-challenge flow
   npm run test:e2e -- tests/e2e/daily-challenge/
   ```

3. **Validate cross-game consistency**
   ```bash
   # Ensure parking-escape follows same pattern as other games
   diff <(grep -h "dailyChallenge" src/games/*/game.js) 
   ```

## Conclusion

**Finding:** This is **NOT a flakiness issue**. This is a **systematic test infrastructure failure** that blocks all CI validation.

**Pattern:** 100% of analyzed runs (10/10) fail with identical unit test timeout caused by navigator mocking bug in share.test.js.

**Impact on Daily-Challenge:** Complete blindness — daily-challenge E2E tests never run, so we cannot validate that daily-challenge integration works for parking-escape.

**Path Forward:** Fix the navigator mocking in tests/unit/share.test.js (single root cause), then re-run CI to get actual visibility into daily-challenge test results.

---

*Analysis completed for bead bf-4m05t*  
*Based on 10 CI workflow runs from 2026-07-23*  
*All workflows: mobile-gaming-ci WorkflowTemplate on iad-ci cluster*
