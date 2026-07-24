# CI Workflow Monitoring - bf-1gmzy

## Workflow: mobile-gaming-ci-manual-l2chv

### Execution Summary
- **Started:** 2026-07-24T16:55:41Z
- **Finished:** 2026-07-24T16:58:44Z
- **Duration:** ~3 minutes
- **Final Phase:** Failed

### Step-by-Step Results

| Step | Phase | Notes |
|------|-------|-------|
| lint | Succeeded | Passed |
| build | Succeeded | Passed |
| unit | **Failed** | Exit code 1 |

### Failing Step
The **unit tests** step failed with exit code 1, causing the entire workflow to fail.

### Observations
- Lint and build steps completed successfully
- Unit tests (which run in parallel with build) failed, causing workflow termination
- E2E tests were not reached due to unit test failure
