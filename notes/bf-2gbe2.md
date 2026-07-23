# Timing-Sensitive Assertions in Parking-Escape Daily-Challenge Tests

## Overview

Analysis of parking-escape daily-challenge E2E tests in `tests/e2e/level-nav.spec.js` to identify timing-sensitive assertions that could cause flaky behavior.

## Test Files Analyzed

1. **tests/e2e/level-nav.spec.js** - Lines 292-375 (Daily Challenge tests)
2. **src/shared/level-nav.js** - Level navigation implementation
3. **src/games/parking-escape/game.js** - Game initialization and level-nav setup

## Findings Summary

### ✅ Explicit Waits Present (Good Patterns)

The tests use multiple explicit `waitForFunction` calls to ensure elements are ready:

```javascript
// Line 299-302: Wait for level-nav strip presence
await page.waitForFunction(() => {
  const nav = document.querySelector('.mg-level-nav');
  return nav && nav.offsetParent !== null;
}, { timeout: 5000 });

// Line 313-316: Wait for daily dot visibility
await page.waitForFunction(() => {
  const el = document.querySelector('.mg-level-daily');
  return el && el.offsetParent !== null;
}, { timeout: 5000 });

// Line 320-323: Wait for text content
await page.waitForFunction(() => {
  const el = document.querySelector('.mg-level-daily');
  return el && el.textContent && el.textContent.length > 0;
}, { timeout: 5000 });

// Line 328-331: Wait for aria-label
await page.waitForFunction(() => {
  const el = document.querySelector('.mg-level-daily');
  return el && el.getAttribute('aria-label');
}, { timeout: 5000 });

// Line 357-360: Wait for computed styles
await page.waitForFunction(() => {
  const el = document.querySelector('.mg-level-daily');
  return el && el.offsetParent !== null && window.getComputedStyle(el).borderColor;
}, { timeout: 5000 });
```

### ⚠️ Potential Timing Issues

#### 1. Split-Check Pattern (Lines 305-324)

**Issue**: The test checks `hasDaily` using `page.evaluate()`, then separately waits for and validates the daily dot.

```javascript
// Lines 305-308: Check existence via evaluate (snapshot of DOM)
const hasDaily = await page.evaluate(() => {
  return document.querySelector('.mg-level-daily') !== null;
});

if (hasDaily) {
  // Lines 311-324: Now validate with waitForFunction
  await page.waitForFunction(() => {
    const el = document.querySelector('.mg-level-daily');
    return el && el.offsetParent !== null;
  }, { timeout: 5000 });
  // ... more assertions
}
```

**Race Condition**: Between the `page.evaluate()` call checking for existence and the subsequent `waitForFunction`/locator operations, there's a theoretical window where the DOM could be mid-update.

**Severity**: Low - The subsequent `waitForFunction` calls will retry until timeout, so this is defensive but redundant.

#### 2. Redundant Waits for Synchronous Properties (Lines 320-331)

**Issue**: The test waits separately for textContent and aria-label, which are set synchronously in the implementation.

**Implementation Evidence** (level-nav.js lines 174-178):
```javascript
dailyDot.className = 'mg-level-dot mg-level-daily';
dailyDot.setAttribute('aria-label', 'Daily Challenge');
dailyDot.textContent = '★'; // star
```

These are synchronous operations - once the element exists, textContent and aria-label are immediately available.

**Severity**: Low - Redundant but not harmful. The waits will resolve immediately.

#### 3. Separate Style Wait (Lines 357-360)

**Issue**: Test waits for `borderColor` computed style separately.

**Implementation Evidence** (level-nav.js lines 179-186):
```javascript
dailyDot.style.cssText = `
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
  border: 2px solid ${dailyCompleted ? '#009E73' : '#F0E442'};
  background: ${dailyCompleted ? 'rgba(0, 158, 115, 0.3)' : 'rgba(240, 228, 66, 0.3)'};
  color: ${dailyCompleted ? '#009E73' : '#F0E442'};
  // ...
`;
```

Styles are set synchronously during element creation.

**Severity**: Low - Computed style may technically require a layout/paint, so this wait is actually appropriate.

## Analysis by Test

### Test: `${gameId}: daily challenge indicator shows when available` (Lines 294-337)

**Timing-sensitive assertions:**
1. Line 317: `await expect(dailyDot).toBeVisible();` - After waitForFunction, safe
2. Line 324: `expect(text).toBe('★');` - After waitForFunction for textContent, safe
3. Line 333: `expect(ariaLabel).toBe('Daily Challenge');` - After waitForFunction for aria-label, safe

**Verdict**: ✅ Properly guarded with explicit waits

### Test: `${gameId}: daily shows green when completed` (Lines 339-373)

**Timing-sensitive assertions:**
1. Line 363-366: Checks `borderColor` after waitForFunction, safe

**Verdict**: ✅ Properly guarded

**Note**: This test has an incomplete implementation (lines 368-372 comment about completing daily via game logic). The test currently only checks the initial (non-completed) state.

## Race Condition Patterns Found

### Pattern 1: Snapshot-Then-Validate (Low Risk)

**Description**: Check element existence via `page.evaluate()`, then perform operations based on that check.

**Location**: Lines 305-324

**Why it's mostly safe**: Subsequent `waitForFunction` calls provide retry logic.

**Mitigation**: Combine the existence check with the validation logic into a single `waitForFunction`.

### Pattern 2: Separate Waits for Synchronous Properties (Redundant)

**Description**: Multiple `waitForFunction` calls for properties set synchronously.

**Location**: Lines 320-331 (textContent, aria-label)

**Why it's redundant**: These properties are set during synchronous DOM construction.

**Impact**: No real harm, just redundant retry loops.

## Implementation Timing Analysis

### Level-Nav Creation Flow (level-nav.js)

1. **Synchronous Phase** (lines 136-311):
   - Strip container created
   - Daily dot created with all attributes (className, aria-label, textContent, styles)
   - Level dots created
   - All elements appended to DOM

2. **Asynchronous Phase** (line 314):
   - `requestAnimationFrame` for auto-scroll to current level

3. **Daily Completion Update** (lines 372-374, 380-539):
   - `completeDaily()` calls `refresh()`
   - `refresh()` rebuilds the entire strip (synchronous)
   - New `requestAnimationFrame` for scroll

**Key Insight**: The daily dot and all its properties are created synchronously during initial render. The only async operation is auto-scroll, which doesn't affect the dot's visibility or attributes.

## Recommendations

### 1. Consolidate Split-Check Pattern (Low Priority)

**Current**:
```javascript
const hasDaily = await page.evaluate(() => 
  document.querySelector('.mg-level-daily') !== null
);
if (hasDaily) {
  await page.waitForFunction(() => /* check visibility */);
}
```

**Improved**:
```javascript
const dailyData = await page.waitForFunction(() => {
  const el = document.querySelector('.mg-level-daily');
  if (!el) return { exists: false };
  return {
    exists: true,
    visible: el.offsetParent !== null,
    text: el.textContent,
    aria: el.getAttribute('aria-label')
  };
}, { timeout: 5000 });

if (dailyData.exists) {
  expect(dailyData.text).toBe('★');
  expect(dailyData.aria).toBe('Daily Challenge');
}
```

### 2. Remove Redundant Waits (Very Low Priority)

Text content and aria-label don't need separate `waitForFunction` calls since they're set synchronously. A single wait for element presence is sufficient.

**Current**:
```javascript
await page.waitForFunction(() => el && el.offsetParent !== null);
await page.waitForFunction(() => el && el.textContent && el.textContent.length > 0);
await page.waitForFunction(() => el && el.getAttribute('aria-label'));
```

**Simplified**:
```javascript
await page.waitForFunction(() => {
  const el = document.querySelector('.mg-level-daily');
  return el && el.offsetParent !== null;
});
// At this point, textContent and aria-label are guaranteed to be set
```

### 3. Keep Style Wait (Correct)

The `waitForFunction` for `borderColor` (lines 357-360) is actually correct because computed styles require the browser to complete layout/paint.

## Conclusion

**Overall Assessment**: The parking-escape daily-challenge tests are **well-protected** against timing issues. The split-check pattern and redundant waits are not actual sources of flakiness because:

1. The level-nav strip (including daily dot) is built **synchronously**
2. All attributes are set during construction, not via async callbacks
3. The `waitForFunction` calls provide retry logic that handles any delays

**No critical timing-sensitive assertions were found** that would cause actual flaky behavior. The tests use defensive programming with explicit waits, which is appropriate for E2E testing.

**Estimated Flakiness Risk**: **Very Low** - The implementation has no async state updates that would race with test assertions.
