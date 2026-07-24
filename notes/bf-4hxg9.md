# CI Stability Test - Run 2 - parking-escape

**Date:** 2026-07-24  
**Workflow ID:** mobile-gaming-ci-manual-ctn5w  
**Duration:** 336 seconds (5 minutes 36 seconds)

## Summary

**Phase:** Failed  
**Message:** child 'mobile-gaming-ci-manual-ctn5w-3051829412' failed

## Step Results

| Step | Status | Duration | Notes |
|------|--------|----------|-------|
| lint | ✅ Succeeded | 30s | No console.log found, scaffold files validated |
| build | ❌ Failed | 48s | Exit code 1 |
| unit | ❌ Failed | 4m 46s (286s) | Exit code 1 |
| e2e | ⏭️ Skipped | - | Did not run due to earlier failures |

## Failure Details

### build step
- **Phase:** Failed
- **Message:** main: Error (exit code 1)
- **Finished At:** 2026-07-24T12:37:49Z
- **Duration:** 48 seconds
- **Pod Name:** mobile-gaming-ci-manual-ctn5w-build-[hash] (deleted by podGC)

### unit step
- **Phase:** Failed
- **Message:** main: Error (exit code 1)
- **Finished At:** 2026-07-24T12:41:47Z
- **Duration:** 286 seconds (4m 46s)
- **Pod Name:** mobile-gaming-ci-manual-ctn5w-unit-3051829412 (deleted by podGC)

## Timeline

- 12:36:21Z - Workflow started
- 12:36:51Z - lint step completed (30s)
- 12:37:01Z - unit + build steps started (parallel)
- 12:37:49Z - build step failed (48s)
- 12:41:47Z - unit step failed (286s)
- 12:41:51Z - workflow marked as Failed

## Comparison with Run 1

### Run 1 (mobile-gaming-ci-manual-wdw2d)
- **Duration:** 335s (5m 35s)
- **Phase:** Failed
- **lint:** ✅ 32s
- **build:** ❌ 46s (exit code 1)
- **unit:** ❌ 3m 43s = 223s (exit code 1)
- **e2e:** ⏭️ Skipped

### Run 2 (mobile-gaming-ci-manual-ctn5w)
- **Duration:** 336s (5m 36s)
- **Phase:** Failed
- **lint:** ✅ 30s
- **build:** ❌ 48s (exit code 1)
- **unit:** ❌ 4m 46s = 286s (exit code 1)
- **e2e:** ⏭️ Skipped

### Consistency Analysis

**✅ HIGHLY CONSISTENT FAILURE PATTERN**

1. **Duration:** Nearly identical (335s vs 336s) - difference of only 1 second
2. **Phase:** Both Failed with same child failure message pattern
3. **Lint:** Both passed consistently (30-32s)
4. **Build:** Both failed with exit code 1 at similar duration (46s vs 48s)
5. **Unit:** Both failed with exit code 1, but with notable duration variance:
   - Run 1: 223s (3m 43s)
   - Run 2: 286s (4m 46s)
   - **Difference:** 63 seconds longer in run 2

### Error Patterns

**Consistent:**
- Same steps failing (build, unit)
- Same error type (exit code 1)
- Same overall failure pattern

**Divergent:**
- Unit test duration varies significantly (63s difference)
- Build duration very consistent (46s vs 48s, only 2s difference)

## Conclusion

**Result:** 100% failure rate across 2 runs  
**Pattern:** Consistent, reproducible failure at build and unit steps  
**Reliability:** HIGH - both runs fail at identical steps with identical errors

This represents a **stable failure pattern** rather than intermittent flakiness. The failures are reproducible across multiple runs, indicating a genuine code or configuration issue rather than CI infrastructure instability.

**Root cause analysis blocked by podGC:** As with run 1, pod logs are deleted immediately on completion, preventing detailed failure analysis. To investigate further:
1. Submit workflow with `podGC: OnWorkflowCompletion` override
2. Check Argo UI at https://argo-ci.ardenone.com
3. Run local tests: `npm ci && npm test && npm run build`

## Full Workflow Data

Saved to: `/tmp/mobile-gaming-ci-run-2.json`
