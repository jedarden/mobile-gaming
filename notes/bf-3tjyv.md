# Fix for parking-escape daily-challenge CI test issues

## Problem

The mobile-gaming CI workflow was failing with two issues:

1. **Unit Test Timeout (300s)** - The unit test step exceeded the 5-minute active deadline
2. **Build Failure (exit code 1)** - Build step failed in CI despite working locally

## Root Cause

The primary issue was in `tests/unit/share.test.js`. All 48 tests in this file were failing with:
```
Cannot set property navigator of #<Object> which has only a getter
```

This occurred because the test code was attempting to assign directly to `global.navigator`, which is a read-only property in modern JavaScript environments. The test failures cascaded, causing the test runner to hang and trigger the 300s timeout.

## Solution Applied

Replaced direct global assignment with vitest's `vi.stubGlobal()` API, which properly handles read-only properties.

**Changes made in commit `0d8a4c3`:**

1. **Replaced direct navigator assignment:**
   - Before: `global.navigator = mockNavigator`
   - After: `vi.stubGlobal('navigator', mockNavigator)`

2. **Replaced direct window assignment:**
   - Before: `global.window = {...}`
   - After: `vi.stubGlobal('window', {...})`

3. **Added proper cleanup:**
   - Added `vi.unstubAllGlobals()` calls in `getFreshModule()` and `afterEach()`
   - Updated all 13 instances of global navigator reassignment throughout the test file

## Results

✅ **All 48 share.test.js tests now pass** (previously all 48 failed)
✅ **Test execution time:** ~100ms (down from 300s timeout)
✅ **Build succeeds locally:** 4.30s, all bundle sizes within budget
✅ **Parking-escape assets build correctly:**
   - JS: 31.49 kB (gzip: 9.69 kB)
   - CSS: 0.75 kB (gzip: 0.36 kB)

## Deployment

- **Committed:** `0d8a4c3 fix(bf-3tjyv): replace direct navigator assignment with vi.stubGlobal() to fix CI timeout`
- **Pushed:** `6569a11` to `origin/main`
- **Date:** 2026-07-23

## Next Steps

The CI workflow should now pass the unit test and build steps. Monitor the next `mobile-gaming-ci` workflow run to confirm:
1. Unit tests complete within 300s timeout
2. Build step completes successfully
3. E2E tests run (previously skipped due to prior failures)

---

*Fix applied for bead: bf-3tjyv*
*Analysis reference: docs/ci/parking-escape-results.md*
