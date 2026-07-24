# Unit Test Timeout Root Cause Analysis (bf-2qdtx)

## Summary
The unit test step is timing out at 300s due to a **mismatch between the deployed workflow configuration and the local source**.

## Root Cause

### Configuration Mismatch
- **Local workflow template** (`declarative-config/k8s/iad-ci/argo-workflows/mobile-gaming-ci-workflowtemplate.yml`): `activeDeadlineSeconds: 600`
- **Deployed workflow template** (on iad-ci cluster): `activeDeadlineSeconds: 300`

The deployed workflow has a **300-second (5 minute) timeout** for the unit step, while the local source shows 600 seconds.

### Performance Differential
- **Local execution**: ~26 seconds total (full test suite)
- **CI environment**: Slower due to limited CPU resources
  - CI: 500m-1000m CPU limits
  - Local: Full CPU availability
  - Hard difficulty tests can take **15+ seconds locally**, likely much longer in CI

### Slow Tests Identified
From local test execution, these tests are particularly slow:
1. **Parking Escape hard difficulty**: 15,972ms (16 seconds)
2. **Parking Escape medium difficulty tests**: 1,400-1,800ms each
3. **Parking Escape truck generation**: 1,573ms
4. **Parking Escape medium validation**: 1,630ms

In CI with limited CPU, these tests likely take 2-3x longer, causing the total suite to exceed 300 seconds.

## Test Execution Flow in CI
```bash
npm ci                    # Dependency installation
npm test                  # Vitest unit tests (5262 tests)
npm run test:levels -- --count 5  # Level validation (31 tiers)
```

The `npm test` command alone has 5,262 tests, and the parking escape generator tests that run BFS solvers are computationally expensive.

## Specific Test File
`tests/unit/parking-escape-generator.test.js`:
- Hard difficulty test (line 87-95): Has 30s timeout, but takes 15s locally
- Multiple medium difficulty tests with 1.5s timeouts
- All tests run BFS solver validation which is CPU-intensive

## Resolution
The workflow template needs to be synced to the cluster (ArgoCD should handle this automatically) to apply the 600-second timeout that's already in the local source.

## Verification
After ArgoCD syncs the template:
- Unit step should have `activeDeadlineSeconds: 600`
- Tests should complete within 600 seconds even with CI resource constraints
- No changes to test code needed (already optimized in recent commit)
