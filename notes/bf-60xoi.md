# Unit Test CI Verification Results (bf-60xoi)

## Workflow
- **Name**: mobile-gaming-ci-manual-qgz6m
- **Triggered**: 2026-07-24
- **Status**: Failed

## Unit Test Step Results

### Duration
- **Started**: 16:20:17Z
- **Duration**: ~75 seconds (74.74s per vitest output)
- **Acceptance Criteria**: Under 300s ✓

### Test Results
- **Total Tests**: 2172
- **Passed**: 2124
- **Failed**: 1
- **Test Files**: 111 (39 passed, 1 failed, 1 skipped)

### Failed Test
**File**: `tests/unit/parking-escape-generator.test.js`
**Test**: "medium difficulty target moves in range [9, 16]"
**Error**: Test timed out after 15000ms
**Location**: Line 74-76

```javascript
it('medium difficulty target moves in range [9, 16]', () => {
  let found = false;
  for (let seed = 0; seed < 10; seed++) {
```

### Test Output Summary
```
Test Files  1 failed | 39 passed | 1 skipped (111)
     Tests  1 failed | 2124 passed (2172)
  Start at  16:20:49
  Duration  74.74s (transform 7.76s, setup 2.44s, collect 12.96s, tests 116.20s, environment 74ms, prepare 19.94s)
```

## Acceptance Criteria Status

| Criteria | Status | Notes |
|----------|--------|-------|
| Unit tests complete with duration under 300s | ✓ PASS | 75 seconds |
| All tests pass | ✗ FAIL | 1 test failed (timeout) |
| Workflow proceeds to build step | ✗ FAIL | Unit test failure blocked workflow |

## Conclusion

The unit test step completed within the time limit (75s < 300s), but one test failed due to a timeout. The parking-escape-generator test for medium difficulty target movement exceeded the 15-second timeout. This failure prevented the workflow from proceeding to the build step.

## Recommendation

The failing test `parking-escape-generator.test.js > medium difficulty target moves in range [9, 16]` needs investigation. The test runs 10 seed iterations to find a valid configuration, which appears to be taking longer than the 15-second timeout allows. Options include:
1. Increase the test timeout for this specific test
2. Reduce the number of seed iterations
3. Investigate why the test is taking longer than expected
