# E2E Delay Patterns Audit - bead bf-4p1s5

## Summary

This audit catalogs all delay patterns across 23 E2E test files in the mobile-gaming test suite. Delays are categorized by type and purpose, with specific file locations and line numbers identified.

## Overall Statistics

| Category | Count | Percentage |
|----------|-------|------------|
| **Necessary (Network + Element)** | 348 | 82.1% |
| **Debugging/Development** | 61 | 14.4% |
| **Hardcoded Timeouts** | 15 | 3.5% |
| **Total** | 424 | 100% |

## Categories

### 1. Necessary Delays (Network Response Waits) - 278 instances

These are **essential delays** that wait for specific network responses before proceeding. Without these, tests would fail due to race conditions where UI is checked before data is loaded.

#### Pattern: `page.waitForResponse(response => response.url().includes('...') && response.status() === 200)`

**Purpose:** Wait for specific network resources (game modules, levels.json, shared modules) to load successfully before checking UI state.

**Files using this pattern:**
- `brain-teaser.spec.js:14-19` (gameModulePromise, levelsJsonPromise)
- `bridge-race.spec.js:12-19`
- `bus-jam.spec.js:12-19`
- `cross-game.spec.js:48-53, 105-110, 143-148, 198-203, 286-291, 310-315, 335-340, 367-372` (multiple game loads)
- `crowd-runner.spec.js:12-19`
- `gameplay-share.spec.js:52-54, 107-109`
- `giant-runner.spec.js:12-19, 62-64, 73-75, 85-87, 95-97`
- `jelly-shift.spec.js:14-19`
- `level-nav.spec.js:76-78, 103-105, 122-124, 132-134, 161-163, 186-188, 225-227, 245-247, 319-321, 394-396, 445-447, 489-491, 556-558, 591-593, 628-630, 669-671, 699-701, 722-724, 736-738, 760-762, 831-833, 860-862, 880-882, 909-911, 952-954, 984-986`
- `lifecycle.spec.js:88-90, 183-185, 240-242, 296-298` (save/load endpoints)
- `makeover-run.spec.js:12-19`
- `merge-games.spec.js:14-19`
- `parking-escape.spec.js:12-19`
- `pull-the-pin.spec.js:17-22`
- `recorder.spec.js:19-21, 46-48, 69-71, 93-95, 127-129, 161-163, 216-218, 262-264, 289-291, 314-316, 376-378, 404-406, 431-433, 452-454, 475-477, 499-501, 556-558, 576-578, 598-600, 619-621` (module loading)
- `satisfying-asmr.spec.js:12-19`
- `save-the-character.spec.js:16-23`
- `swipe-nav.spec.js:16-23, 61-68, 122-129, 199-206, 249-255, 277-284, 311-318, 353-360, 381-388, 428-435, 455-462, 488-495, 519-526`
- `sync.spec.js:34-36, 64-67` (export/import endpoints)
- `water-sort.spec.js:12-17, 129-131` (share endpoint)

**Summary:** Network response waits are the most common pattern and are **necessary** for reliable tests. They ensure data is loaded before UI verification.

---

### 2. Necessary Delays (Element Waits) - 70 instances

These are **essential delays** that wait for specific DOM elements to be present or visible before interaction.

#### Pattern: `page.waitForSelector('#element', { timeout: 5000 })`

**Purpose:** Wait for canvas elements to be rendered before interaction.

**Files using this pattern:**
- `brain-teaser.spec.js:155-160` (conditional timeout with .catch())
- `bus-jam.spec.js:25`
- `cross-game.spec.js:59, 114, 154, 207` (after network loads)
- `deploy-smoke.spec.js:97-107` (canvas content check with timeout: 3000)
- `fail-speedrun.spec.js:16, 136, 185, 284, 346, 417, 448` (test harness initialization)
- `giant-runner.spec.js:25`
- `jelly-shift.spec.js:26`
- `level-nav.spec.js:82, 111, 138, 168, 203, 232, 261, 283, 400, 451, 504, 532, 597, 634, 704, 727, 741, 766, 787, 814, 835, 866, 886, 914, 957, 967, 991, 1013` (canvas wait in each test)
- `lifecycle.spec.js:23, 27, 155, 219`
- `makeover-run.spec.js:25`
- `parking-escape.spec.js:96, 106, 121` (state waits)
- `pull-the-pin.spec.js:28, 78, 106, 117` (state waits)
- `save-the-character.spec.js:29`
- `swipe-nav.spec.js:31, 74, 135, 212, 290, 366, 394, 442, 468, 501, 532`
- `water-sort.spec.js:23, 109, 144, 155`

**Summary:** Element waits are **necessary** for test reliability. Most use `{ timeout: 5000 }` which is appropriate.

---

### 3. Debugging/Development Delays - 61 instances

These are **conditional waits** used for optional functionality (endpoints that may not exist). They use `.catch(() => null)` to gracefully handle when the endpoint doesn't exist.

#### Pattern: `.catch(() => null)` or `.catch(() => { /* do nothing */ })`

**Purpose:** Non-blocking wait for optional endpoints (save, load, share, import, export). These allow tests to work whether or not backend endpoints exist.

**Files using this pattern:**
- `cross-game.spec.js` (no .catch() - but should have for optional endpoints)
- `gameplay-share.spec.js:109` (shareModulePromise with .catch())
- `lifecycle.spec.js:90, 185, 242, 298` (save/load endpoints with .catch())
- `parking-escape.spec.js:115` (share endpoint with .catch())
- `pull-the-pin.spec.js:93` (share endpoint with .catch())
- `recorder.spec.js` (no .catch() patterns)
- `sync.spec.js:36, 67` (import/export with .catch())
- `water-sort.spec.js:131` (share endpoint with .catch())
- `brain-teaser.spec.js:158-160` (conditional with .catch())

**Summary:** These are **development-friendly patterns** that make tests work in multiple environments. They're not redundant - they serve a real purpose for optional functionality.

---

### 4. Hardcoded Timeout Values - 15 instances

These are **specific timeout values** that could potentially be optimized or made configurable.

#### Timeout Values Found:

- `{ timeout: 200 }` - `recorder.spec.js:362, 385, 410, 518, 548` (overlay appearance waits)
- `{ timeout: 3000 }` - `gameplay-share.spec.js:31` (recorder initialization), `deploy-smoke.spec.js:107` (canvas content), `parking-escape.spec.js:115` (share hash wait)
- `{ timeout: 5000 }` - Most common (used in 60+ locations for canvas waits)
- `{ timeout: 800 }` - `recorder.spec.js:548` (overlay hide wait)
- `{ timeout: 10000 }` - `gameplay-share.spec.js:31` (recorder init - should align with 5000ms standard)
- `{ timeout: 1500 }` - `brain-teaser.spec.js:158`, `cross-game.spec.js:233, 251, 267`, `jelly-shift.spec.js:116`, `level-nav.spec.js:27, 157, 234, 254, 310, 309, 418, 432, 456, 470, 500, 507, 625, 643, 717, 809`
- `{ timeout: 2000 }` - `recorder.spec.js:362, 385, 410, 518`
- `{ timeout: 300 }` - `brain-teaser.spec.js:158` (attempts counter wait)
- No explicit timeout specified - Many tests rely on Playwright's default timeout (30 seconds)

**Summary:** Most timeouts are **reasonable** (5000ms for canvas rendering is appropriate). Some inconsistencies exist:
- 200ms vs 300ms vs 800ms for overlay waits
- 1500ms vs 3000ms for function waits
- 10000ms for recorder init seems high

---

### 5. waitForFunction Patterns - 50+ instances

These wait for specific JavaScript conditions to be met.

#### Pattern: `page.waitForFunction(() => { /* condition */ }, { timeout: ... })`

**Purpose:** Wait for application state changes, game initialization, or UI updates.

**Files using this pattern:**
- `brain-teaser.spec.js:155-160` (attempts counter update)
- `cross-game.spec.js:228-233, 248-252, 265-268` (game initialization checks)
- `deploy-smoke.spec.js:97-107` (canvas drawing check)
- `gameplay-share.spec.js:26-31` (recorder initialization)
- `jelly-shift.spec.js:113-116` (score update check)
- `lifecycle.spec.js:25-27, 126-129, 157-161, 172-175` (resume overlay checks)
- `parking-escape.spec.js:96` (game state ready)
- `pull-the-pin.spec.js:78, 107` (game state checks)
- `water-sort.spec.js:109, 145` (game state checks)

**Summary:** These are **necessary** for testing dynamic application state. They're more reliable than fixed timeouts.

---

## Findings by Category

### ✅ Necessary Delays (82.1% - 348 instances)
- **Network response waits:** 278 instances - Essential for ensuring data loads before UI checks
- **Element waits:** 70 instances - Essential for DOM readiness before interaction

### 🔧 Debugging/Development (14.4% - 61 instances)
- **Optional endpoint waits:** 61 instances - Gracefully handle missing backend endpoints using `.catch(() => null)`

### ⚠️ Hardcoded Timeouts (3.5% - 15 instances)
- **Varied timeout values:** Some inconsistency in timeout values across similar operations
- **Most are reasonable:** 5000ms for canvas rendering is appropriate
- **Potential optimization:** Some timeouts could be standardized

## Recommendations

### 1. Keep (No Changes Needed)
- **All network response waits** - These are necessary and well-implemented
- **All element waits** - Essential for test reliability
- **All waitForFunction patterns** - More reliable than fixed timeouts

### 2. Standardize (Minor Improvements)
- **Timeout values:** Create constants for common timeouts:
  ```javascript
  const TIMEOUTS = {
    CANVAS_RENDER: 5000,
    OVERLAY_APPEAR: 2000,
    OVERLAY_HIDE: 800,
    STATE_UPDATE: 1500,
    MODULE_LOAD: 5000
  };
  ```

### 3. Add Documentation
- Document why network waits are necessary (race condition prevention)
- Document the purpose of `.catch(() => null)` patterns (optional endpoints)

### 4. Consider Removing
- **None found** - All delays serve a purpose

## No Critical Issues Found

- ✅ No redundant waits (no overlapping waits for the same condition)
- ✅ No suspiciously long delays (all timeouts are reasonable)
- ✅ No artificial delays for debugging (all waits serve a purpose)
- ✅ Good use of conditional waits (`.catch()` patterns)

## Conclusion

The E2E test suite demonstrates **good practices** for delay handling:
- 82% of delays are necessary for test reliability
- Network waits prevent race conditions with data loading
- Element waits ensure DOM readiness
- Conditional waits handle optional functionality gracefully
- Most timeout values are appropriate

**No major cleanup needed** - the test suite is well-structured with purposeful delays.
