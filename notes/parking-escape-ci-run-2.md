# CI Stability Run #2 - FAILED (Second Attempt)

**Date:** 2026-07-23
**Workflow:** `mobile-gaming-ci-stability-run2-wkqzd`
**Status:** ❌ FAILED

## Failure Summary

Run #2 (second attempt) of the CI stability testing FAILED with unit test timeout:

1. **Unit tests timed out** - "Pod was active on the node longer than the specified deadline"
2. **Build step also failed** - Exit code 1 (likely downstream effect of unit failure)

## Detailed Failure Information

```
Workflow: mobile-gaming-ci-stability-run2-wkqzd
Phase: Failed
Run Duration: 7m 48s
```

### Failed Nodes

1. **unit** (mobile-gaming-ci-stability-run2-wkqzd-4237810657)
   - Phase: Failed
   - Message: `Pod was active on the node longer than the specified deadline`

2. **build** (mobile-gaming-ci-stability-run2-wkqzd-1642372458)
   - Phase: Failed
   - Message: `main: Error (exit code 1)`

## Analysis

This failure (second attempt) indicates that the parking-escape test fixes applied in bf-bmh85 are **NOT stable** across CI runs:

1. **Unit test timeout**: The parking-escape unit tests are consistently timing out in CI, meaning:
   - The timeout reductions applied in bf-bmh85 were insufficient for the CI environment
   - OR there's genuine performance variability in the tests
   - OR the CI environment is slower than expected

2. **Build failure (exit code 1)**: This appears to be a downstream effect of the unit test failure

## Pattern Across Runs

Both stability runs (wkqzd and 9vcgm) failed identically:
- Same failure point (unit tests)
- Same error (pod deadline exceeded)
- Similar duration (~7m 48s)

This confirms a **systemic timeout issue**, not a flaky test problem.

## Acceptance Criteria Status

- [x] Complete CI workflow run #2
- [ ] Run must pass without failures - **FAILED: Unit test timeout**
- [ ] No timeouts across the run - **FAILED: Pod deadline exceeded**
- [ ] Document workflow run ID and results - **DONE**

## Conclusion

Both stability runs failed consistently with unit test timeouts. The test timeout reduction from previous bead (bf-bmh85) appears to be too aggressive for the CI environment. Further investigation and configuration adjustment is required before the tests can pass consistently.
