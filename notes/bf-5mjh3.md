# CI Workflow Run - bf-5mjh3

## Task
Trigger and monitor first CI workflow run for parking-escape daily-challenge

## Workflow Run 1: mobile-gaming-ci-manual-j4mxn

**Status:** FAILED

**Timeline:**
- Submitted: 2026-07-23 18:17:44
- Completed: 2026-07-23 18:23:51 (approximately 6 minutes)

**Step Results:**
- ✅ lint: Succeeded
- ❌ build: Failed (exit code 1)
- ❌ unit: Failed (pod exceeded deadline)

**Analysis:**
The workflow failed during the build phase with an exit code 1 error. The unit test pod also hit a timeout deadline. Since pods are deleted immediately on completion (podGC: OnPodCompletion), detailed error logs were not captured.

**Next Steps:**
Need to trigger another workflow run and monitor it more closely to capture logs from the build step before pod cleanup. The Argo UI at https://argo-ci.ardenone.com may have archived logs available.

---

## Workflow Run 2: mobile-gaming-ci-manual-7jfzp

**Status:** FAILED

**Timeline:**
- Started: 2026-07-23T22:34:58Z
- Finished: 2026-07-23T22:40:49Z (~5 minutes 51 seconds)

**Step Results:**
- ✅ lint: Succeeded
- ❌ build: Failed (exit code 1) - Started 22:35:39, Finished 22:36:34 (~55 seconds)
- ❌ unit: Failed (Pod exceeded deadline, exit code 143/SIGTERM) - Started 22:35:39, Finished 22:40:39 (~5 minutes)

**Detailed Failure Analysis:**

1. **Build Step:**
   - Error: `main: Error (exit code 1)`
   - Duration: ~55 seconds
   - Indicates compilation error, missing dependency, or build script issue

2. **Unit Test Step:**
   - Error: `Pod was active on the node longer than the specified deadline`
   - Exit code 143 (SIGTERM - killed by deadline)
   - Duration: ~5 minutes (hit configured deadline)
   - May be secondary issue caused by build failure cascading, or genuinely slow/hanging tests

**Root Cause:**
The build failure is the primary issue - it failed quickly with exit code 1. The unit test timeout may be a downstream effect of the build step problems.

**Issue:**
Pods deleted immediately (podGC: OnPodCompletion), so detailed error logs were not captured in this run.

**Local Testing Results:**

To understand the CI failures, ran the same steps locally:

**Build:** ✅ SUCCEEDED (4.46s)
- All games built successfully
- No compilation errors

**Unit Tests:** ❌ FAILED with 29 failures (ran in ~729ms)
```
Test Files  1 failed (1)
     Tests  29 failed | 239 passed (268)
```

**Test Failures Breakdown:**

1. **Insufficient levels (4 games):**
   - bridge-race: 9 levels (needs 10+)
   - crowd-runner: 9 levels (needs 10+)
   - jelly-shift: 9 levels (needs 10+)
   - makeover-run: 9 levels (needs 10+)

2. **Invalid levels:**
   - giant-runner level 10: Boss scale 6.8 not achievable with avg scale 6.42
   - pull-the-pin levels: ptp-006, ptp-009, ptp-011, ptp-014, ptp-016, ptp-018, ptp-019, ptp-020 (all unsolvable)

**CI vs Local Discrepancy:**

The CI environment shows different behavior than local:
- **CI:** Build failed (exit code 1), unit tests timed out after 5 minutes
- **Local:** Build succeeded, unit tests completed in <1 second

This suggests CI environment issues such as:
- Resource constraints (CPU/memory)
- Different Node.js version
- Network issues downloading dependencies
- Container image differences

**Conclusion:**

The workflow `mobile-gaming-ci-manual-7jfzp` failed due to:
1. Build step failure (exit code 1) - likely environment/timeout issue, not a code issue
2. Unit test timeout (5 minutes) - also environment issue, tests run locally in <1 second
3. Actual test failures (29) - legitimate issues with level counts and validation

The core CI infrastructure or environment configuration needs investigation before parking-escape daily-challenge tests can run reliably.
