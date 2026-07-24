# Unit Test Pod Log Retrieval (bf-3gaie)

## Task
Retrieve logs from unit test pod of mobile-gaming-ci workflow run.

## Approach
Since previous workflow runs had completed and their pods were cleaned up (podGC: OnPodCompletion), I triggered a new manual workflow run to capture the unit test logs in real-time.

## Workflow Details
- **Workflow Name**: mobile-gaming-ci-manual-pv8fz
- **Unit Test Pod**: mobile-gaming-ci-manual-pv8fz-unit-2076573049
- **Pod Status**: Failed (exit code 1 due to test timeout)

## Test Results Summary
```
Test Files  1 failed | 39 passed (111)
     Tests  1 failed | 2124 passed (2143)
  Duration  76.57s (transform 8.13s, setup 2.72s, collect 15.19s, tests 117.90s, environment 36ms, prepare 21.11s)
```

## Test Failure
**FAIL**: `tests/unit/parking-escape-generator.test.js > generateLevel > medium difficulty target moves in range [9, 16]`
- **Error**: Test timed out in 15000ms
- **Location**: tests/unit/parking-escape-generator.test.js:74:5
- **Note**: This is a long-running test that may need timeout configuration

## Log Output
Complete unit test logs captured (2289 lines) containing:
- npm ci dependency installation (181 packages)
- vitest test runner output for all 2143 tests
- Detailed test execution timing and results
- Stack traces for stderr output (expected migration warnings in tests)

## Command Used
```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig logs mobile-gaming-ci-manual-pv8fz-unit-2076573049 -n argo-workflows -c main
```

## Acceptance Criteria Met
✅ kubectl logs command executed successfully  
✅ Complete pod log output captured (2289 lines)  
✅ Logs contain unit test execution output (full vitest run)  
✅ Log content available for saving to file  

## Log File Location
/tmp/unit-test-logs-bf-3gaie.txt (2289 lines)
