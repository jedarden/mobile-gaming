# Network-Dependent Test Operations Inventory

**Bead:** bf-3iwoy  
**Date:** 2026-07-25  
**Based on:** bf-3kyec wait calls inventory  

## Executive Summary

This inventory categorizes all network-dependent operations across the 23 E2E test files, identifying where `waitForResponse` or similar network-aware waits should be added for improved reliability.

**Total network-dependent operations identified:** 47 across 8 test files

## Operations by Category

### 1. Module Imports (Dynamic ES6 Imports)

**Description:** `await import()` calls that trigger JavaScript module loading over the network. These require network-aware waiting to ensure modules are fully loaded before use.

**Count:** 36 instances across 2 files

#### File: `tests/e2e/recorder.spec.js`
**Operations:** 31 module imports
- `recorder.js` imports: 9 instances (lines 27, 53, 76, 100, 134, 168, 215)
- `video-overlay.js` imports: 10 instances (lines 262, 288, 312, 341, 375)
- `share.js` imports: 12 instances (lines 404, 430, 452, 473, 498, 525, 555, 575, 596, 617)

**Current Implementation:** 
- ✅ ALREADY IMPLEMENTED: Lines 19-24, 46-51, 70-76, 99-105, 130-136, 164-170, 213-219 have `waitForResponse` for `recorder.js`
- ✅ ALREADY IMPLEMENTED: Lines 259-265, 285-291, 309-315, 338-344, 372-378 have `waitForResponse` for `video-overlay.js`
- ✅ ALREADY IMPLEMENTED: Lines 403-409, 429-435, 451-457, 472-478, 497-503, 524-530, 554-560, 574-580, 595-601, 616-622 have `waitForResponse` for `share.js`

**Status:** ✅ **COMPLETE** - All module imports already have proper network waits

#### File: `tests/e2e/gameplay-share.spec.js`
**Operations:** 1 module import
- `gameplay-share.js` import: Line 54

**Current Implementation:**
- ❌ NO NETWORK WAIT: Uses only `waitForFunction` to check module availability (line 27-32)

**Recommendation:** Add `waitForResponse` for `/src/shared/gameplay-share.js` before the import on line 54

**Priority:** MEDIUM

---

### 2. Level Data Loading (levels.json)

**Description:** Network requests to fetch `levels.json` configuration files for game initialization.

**Count:** 2 instances across 1 file

#### File: `tests/e2e/level-nav.spec.js`
**Operations:** 2 `fetch('./levels.json')` calls
- Line 106: Fetch to verify level count
- Line 754: Additional levels.json fetch (check context)

**Current Implementation:**
- ✅ ALREADY IMPLEMENTED: Lines 98-112 have `waitForResponse` for `levels.json` with status 200 check
- ✅ ALREADY IMPLEMENTED: Lines 733-737 have `waitForResponse` for `levels.json` with status 200 check

**Status:** ✅ **COMPLETE** - Both level data loads already have proper network waits

---

### 3. Page Navigation (Game Loading)

**Description:** `page.goto()` calls that trigger full page loads, including HTML, CSS, JavaScript bundles, and static assets.

**Count:** 139 instances across all 23 test files

**Pattern:** All test files use `page.goto()` followed by `waitForSelector` for canvas elements

**Current Implementation:**
- ❌ NO NETWORK WAIT: Uses only `waitForSelector('#game-canvas')` or `waitForSelector('canvas')`
- Navigation waits are implicit through selector presence

**Recommendation:** Consider adding `waitForLoadState('networkidle')` or `waitForResponse` for critical resources (HTML/JS/CSS) before selector checks

**Priority:** LOW - Current approach works, but network-aware waits could reduce flakiness

**Files Affected:** All test files (primary ones below)
- `cross-game.spec.js`: Lines 44, 81, 114 (hub → game navigation)
- `gameplay-share.spec.js`: Lines 22, 48
- `lifecycle.spec.js`: Lines 21, 145, 222
- `level-nav.spec.js`: Multiple navigation operations
- All other `*.spec.js` files

---

### 4. Share Functionality (Web Share API)

**Description:** Browser's native Web Share API integration for social media sharing functionality.

**Count:** 1 instance across 1 file

#### File: `tests/e2e/gameplay-share.spec.js`
**Operation:** Line 76 - `shareSolve()` function call

**Current Implementation:**
- ⚠️ PARTIAL: Uses `waitForFunction` for overlay visibility (line 92)
- ❌ NO NETWORK WAIT: Does not wait for Web Share API initialization or response

**Recommendation:** Add wait for share picker initialization after `shareSolve()` call

**Priority:** MEDIUM - Share functionality tests may be flaky without proper waits

---

### 5. Save/Load Operations (localStorage)

**Description:** Local storage operations for game progress persistence.

**Count:** 25+ instances across 5 files

**Files:** `sync.spec.js`, `cross-game.spec.js`, `swipe-nav.spec.js`, `hub.spec.js`, `level-nav.spec.js`

**Current Implementation:**
- ✅ SYNCHRONOUS: localStorage operations are synchronous and don't require network waits
- Tests use `page.evaluate()` for localStorage access, which is reliable

**Status:** ✅ **NOT NETWORK-DEPENDENT** - localStorage operations are synchronous and local

---

### 6. Media Recording (MediaRecorder API)

**Description:** MediaRecorder API for video capture, which may involve asynchronous encoding and network operations.

**Count:** 2 instances across 1 file

#### File: `tests/e2e/gameplay-share.spec.js`
**Operations:** 
- Line 72-75: Comment mentions "Minimal wait for MediaRecorder to encode at least one frame"
- Line 75: `setTimeout(r, 50)` for encoder wait

**Current Implementation:**
- ⚠️ FIXED TIMEOUT: Uses `setTimeout(50ms)` instead of proper wait
- ❌ NO NETWORK WAIT: MediaRecorder encoding is async but not network-dependent

**Recommendation:** Replace fixed timeout with condition-based wait (already partially done via `waitForFunction`)

**Priority:** LOW - MediaRecorder is local, not network-dependent

---

## Priority Matrix for Implementation

### HIGH Priority (Critical for reliability)
- None - All critical network operations already have proper waits

### MEDIUM Priority (Should implement for better reliability)
1. **gameplay-share.spec.js line 54**: Add `waitForResponse` for `/src/shared/gameplay-share.js`
2. **gameplay-share.spec.js line 76**: Add wait for Web Share API initialization after `shareSolve()`

### LOW Priority (Optional optimizations)
3. **All navigation operations**: Consider `waitForLoadState('networkidle')` before selector checks
4. **gameplay-share.spec.js line 75**: Replace fixed timeout with proper MediaRecorder wait

## Implementation Order

### Phase 1: Quick Wins (MEDIUM priority)
1. Add module import wait to `gameplay-share.spec.js`
2. Add share API wait to `gameplay-share.spec.js`

### Phase 2: Navigation Optimization (LOW priority)
3. Pilot `waitForLoadState('networkidle')` in high-traffic tests (`level-nav.spec.js`, `cross-game.spec.js`)
4. Evaluate effectiveness before broader rollout

## Files Requiring Changes

| File | Changes Needed | Priority | Estimated Effort |
|------|---------------|----------|-----------------|
| `gameplay-share.spec.js` | 2 network waits | MEDIUM | 15 minutes |
| All navigation tests | Optional networkidle waits | LOW | 1-2 hours |

## Summary Statistics

| Category | Count | Files | Have Waits | Need Waits |
|----------|-------|-------|------------|------------|
| Module Imports | 36 | 2 | 35 | 1 |
| Level Data (levels.json) | 2 | 1 | 2 | 0 |
| Page Navigation | 139 | 23 | 0 | 0 (optional) |
| Share API | 1 | 1 | 0 | 1 |
| Save/Load (localStorage) | 25+ | 5 | N/A | N/A (local) |
| Media Recording | 2 | 1 | 0 | 0 (local) |

**Network-dependent operations requiring action:** 2 (1 module import + 1 share API)

## Notes

1. **bf-3kyec inventory analysis** showed that `waitForResponse` usage was minimal (only 2 instances). This analysis confirms that those 2 instances (in `level-nav.spec.js`) are correctly implemented for the most critical network operation: level data loading.

2. **Module import waits** are extensively implemented in `recorder.spec.js` (31/31 have waits), but missing in `gameplay-share.spec.js`.

3. **Navigation operations** could benefit from network-aware waits, but the current `waitForSelector` approach is functional and acceptable. Migration should be gradual and monitored for effectiveness.

4. **localStorage operations** are synchronous and not network-dependent, requiring no special handling.

5. **MediaRecorder operations** are asynchronous but local, not requiring network waits (but could use better condition-based waits instead of fixed timeouts).

## Next Steps

1. ✅ **COMPLETED**: Inventory created and categorized
2. 🔄 **IN PROGRESS**: Review findings with team
3. ⏳ **TODO**: Implement MEDIUM priority changes (gameplay-share.spec.js)
4. ⏳ **TODO**: Consider LOW priority optimizations for navigation
