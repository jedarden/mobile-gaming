# Investigation: Parking-Escape Daily-Challenge Test Timeout

## Task
Investigate and adjust the 20s timeout setting for parking-escape daily-challenge tests.

## Findings

### Test Files
Three tests in `tests/unit/parking-escape.test.js` had 20-second timeouts:
1. Line 802: "generates a daily level from known seed and can create initial state"
2. Line 836: "simulates a win on daily level and calls completeDailyChallenge exactly once"  
3. Line 854: "generates different levels from different seeds"

### Performance Results (Local)

**Run 1:**
| Test | Duration | Timeout | Buffer |
|------|----------|---------|--------|
| generates a daily level from known seed | 6,026ms | 20,000ms | 13,974ms |
| simulates a win on daily level | 5,783ms | 20,000ms | 14,217ms |
| generates deterministic levels from same seed | 3,646ms | 20,000ms | 16,354ms |
| generates different levels from different seeds | **14,532ms** | 20,000ms | **5,468ms** |

**Run 2:**
| Test | Duration | Timeout | Buffer |
|------|----------|---------|--------|
| generates a daily level from known seed | 6,029ms | 20,000ms | 13,971ms |
| simulates a win on daily level | 6,452ms | 20,000ms | 13,548ms |
| generates deterministic levels from same seed | 3,817ms | 20,000ms | 16,183ms |
| generates different levels from different seeds | **15,255ms** | 20,000ms | **4,745ms** |

### Root Cause
The `generateLevel()` function for parking-escape is computationally expensive:
- Generates random vehicles with collision detection
- Validates solvability using BFS solver
- Retry logic for unsolvable generations
- Each test may generate 2 levels (e.g., "different seeds" test)

### Why 20s Was Insufficient
- Slowest test took ~15 seconds locally
- Only ~5 second buffer for CI variance
- CI environments (Argo Workflows on iad-ci) typically slower than local development
- Risk of intermittent timeout failures in CI

## Changes Made
Increased timeout from **20,000ms (20s)** to **30,000ms (30s)** for all three daily-challenge related tests:
- Lines 802, 836, 854 in `tests/unit/parking-escape.test.js`
- Updated comments to document "allows for CI variance"

## Verification
After changes, all tests pass within new 30-second timeout:
- Slowest test: ~15.7 seconds
- New buffer: ~14.3 seconds (adequate for CI variance)

## Files Modified
- `tests/unit/parking-escape.test.js` (3 timeout values updated, comments updated)
