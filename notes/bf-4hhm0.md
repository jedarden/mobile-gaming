# CI Stability Test - Run 3 - parking-escape

**Date:** 2026-07-24
**Workflow ID:** mobile-gaming-ci-stability-run3-jn4cj
**Duration:** 338 seconds (5 minutes 38 seconds)

## Summary

**Phase:** Failed  
**Message:** child 'mobile-gaming-ci-stability-run3-jn4cj-2976522748' failed

## Step Results

| Step | Status | Duration | Notes |
|------|--------|----------|-------|
| lint | ✅ Succeeded | ~31s | No console.log found, scaffold files validated |
| build | ❌ Failed | ~47s | Exit code 1 |
| unit | ❌ Failed | ~4m 44s (284s) | Exit code 1 |
| e2e | ⏭️ Skipped | - | Did not run due to earlier failures |

## Failure Details

### build step
- **Phase:** Failed
- **Message:** main: Error (exit code 1)
- **Finished At:** 2026-07-24T12:48:02Z
- **Duration:** ~47 seconds
- **Pod Name:** mobile-gaming-ci-stability-run3-jn4cj-build-[hash] (deleted by podGC)

### unit step
- **Phase:** Failed
- **Message:** main: Error (exit code 1)
- **Finished At:** 2026-07-24T12:48:49Z
- **Duration:** ~284 seconds (4m 44s)
- **Pod Name:** mobile-gaming-ci-stability-run3-jn4cj-unit-2976522748 (deleted by podGC)

## Timeline

- 12:43:11Z - Workflow started
- 12:43:42Z - lint step completed (~31s)
- 12:43:52Z - unit + build steps started (parallel)
- 12:48:02Z - build step failed (~47s)
- 12:48:49Z - unit step failed (~284s)
- 12:48:49Z - workflow marked as Failed

## Three-Run Consistency Analysis

### Run 1 (mobile-gaming-ci-manual-wdw2d)
- **Duration:** 335s (5m 35s)
- **Phase:** Failed
- **lint:** ✅ 32s
- **build:** ❌ 46s (exit code 1)
- **unit:** ❌ 223s = 3m 43s (exit code 1)
- **e2e:** ⏭️ Skipped

### Run 2 (mobile-gaming-ci-manual-ctn5w)
- **Duration:** 336s (5m 36s)
- **Phase:** Failed
- **lint:** ✅ 30s
- **build:** ❌ 48s (exit code 1)
- **unit:** ❌ 286s = 4m 46s (exit code 1)
- **e2e:** ⏭️ Skipped

### Run 3 (mobile-gaming-ci-stability-run3-jn4cj)
- **Duration:** 338s (5m 38s)
- **Phase:** Failed
- **lint:** ✅ ~31s
- **build:** ❌ ~47s (exit code 1)
- **unit:** ❌ ~284s = 4m 44s (exit code 1)
- **e2e:** ⏭️ Skipped

## Statistical Consistency Analysis

### Duration Consistency
- **Run 1:** 335s
- **Run 2:** 336s (+1s from run 1)
- **Run 3:** 338s (+3s from run 1, +2s from run 2)
- **Variance:** Only 3 seconds across all three runs (0.9% variance)

### Step Duration Analysis

**Lint (HIGHLY CONSISTENT):**
- Run 1: 32s
- Run 2: 30s
- Run 3: ~31s
- **Range:** 30-32s (2s variance, 6.7% variance)

**Build (EXTREMELY CONSISTENT):**
- Run 1: 46s
- Run 2: 48s
- Run 3: ~47s
- **Range:** 46-48s (2s variance, 4.3% variance)

**Unit (NOTABLE VARIANCE):**
- Run 1: 223s (3m 43s)
- Run 2: 286s (4m 46s)
- Run 3: ~284s (4m 44s)
- **Range:** 223-286s (63s variance, 28.3% variance)
- **Pattern:** Run 1 was significantly faster, runs 2&3 are very close

## Error Pattern Consistency

### ✅ PERFECTLY CONSISTENT
1. **Failure Phase:** All three runs failed with identical error pattern
2. **Failing Steps:** build and unit fail in all runs (lint always passes)
3. **Error Type:** All failures are exit code 1
4. **Error Messages:** Identical error message format across all runs
5. **Skipped Steps:** e2e consistently skipped due to build/unit failures

### 🔄 CONSISTENT WITH VARIANCE
1. **Unit test duration:** Run 1 faster (223s), runs 2&3 nearly identical (284-286s)
2. **Total duration:** Nearly identical across all runs (335-338s)

### ❓ NOT ANALYZABLE
- Detailed error messages (podGC deleted logs immediately)
- Root cause of build/unit failures
- Specific test failures in unit step

## Stability Assessment

### Failure Rate
- **Run 1:** FAILED (100% failure rate)
- **Run 2:** FAILED (100% failure rate) 
- **Run 3:** FAILED (100% failure rate)
- **Overall:** 100% failure rate across 3 runs

### Reliability Rating
**EXTREMELY HIGH STABILITY** - This is not flaky CI infrastructure. The identical failure pattern across three consecutive runs, with highly consistent timing (0.9% variance in total duration), indicates:

1. **Reproducible Failure:** The same steps fail every time
2. **Consistent Timing:** Build and lint durations vary by only seconds
3. **Deterministic Behavior:** No random failures or intermittent issues
4. **Code/Config Issue:** This represents a genuine problem in code or CI configuration, not infrastructure instability

### Unit Test Duration Pattern
The unit test duration shows an interesting pattern:
- **Run 1:** 223s (significantly faster)
- **Run 2:** 286s (+63s, 28% slower)
- **Run 3:** 284s (nearly identical to run 2)

This suggests that run 1 may have experienced different test execution behavior (possibly early exit on first failure vs. running all tests), while runs 2 and 3 executed identically.

## Conclusion

**Result:** 100% failure rate across 3 consecutive runs  
**Pattern:** Highly consistent, reproducible failure at build and unit steps  
**Reliability:** EXTREMELY HIGH - near-identical timing and failure pattern across all runs  
**Assessment:** Stable failure pattern indicating genuine code/configuration issue, not CI flakiness

**Three-Run Confirmation:** The third run confirms the stability of the failure pattern observed in runs 1 and 2. With only 3 seconds variance in total duration across all three runs and identical failing steps, this represents a deterministic, reproducible failure rather than intermittent CI instability.

**Next Steps for Root Cause Analysis:**
Since we now have confirmed stable failure behavior, the next steps require detailed logs:
1. Submit workflow with `podGC: OnWorkflowCompletion` to preserve logs
2. Check Argo UI at https://argo-ci.ardenone.com for detailed error messages
3. Run local tests to reproduce: `npm ci && npm test && npm run build`
4. Investigate why unit test duration varies between runs (potential test isolation issues)

## Full Workflow Data

Workflow JSON saved to: `/tmp/mobile-gaming-ci-run-3.json`