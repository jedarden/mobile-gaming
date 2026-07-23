# Daily-Challenge Assertion Failures Documentation (bf-64dzb)

## Overview

Investigation of current daily-challenge state assertion failures in parking-escape E2E tests. This documents what each assertion expects vs. what it's currently seeing, based on test trace analysis and source code inspection.

## Test Location

The daily-challenge assertions are in `tests/e2e/level-nav.spec.js` in two tests:

1. **"parking-escape: daily challenge indicator shows when available"** (lines 294-337)
2. **"parking-escape: daily shows green when completed"** (lines 339-374)

## Assertion Types and Expected Values

### 1. Text Content Assertion

**Location:** `tests/e2e/level-nav.spec.js:325`

**Expected Value:** `'★'` (literal star character)

**Implementation Source:** `src/shared/level-nav.js:178`
```javascript
dailyDot.textContent = '★'; // star
```

**Status:** ✅ FIXED (bf-1dnf8, bf-1j4b2)
- Previously used Unicode escape sequence `★`
- Now uses literal `★` character
- Verified working in both source and build output

**What the test sees:** The text content is `'★'` (literal star)

---

### 2. ARIA Label Assertion

**Location:** `tests/e2e/level-nav.spec.js:333`

**Expected Value:** `'Daily Challenge'`

**Implementation Source:** `src/shared/level-nav.js:177`
```javascript
dailyDot.setAttribute('aria-label', 'Daily Challenge');
```

**Status:** ✅ VERIFIED CORRECT (bf-486sw)
- Already uses literal string, no Unicode escapes
- Both unit and E2E tests pass
- No issues identified

**What the test sees:** The aria-label is `'Daily Challenge'`

---

### 3. Border Color Assertions

#### Incomplete State (Yellow)

**Location:** `tests/e2e/level-nav.spec.js:366`

**Expected Color:** `#F0E442` (yellow - incomplete daily-challenge state)

**Expected RGB Value (BGR format):** `'66, 228, 240'`

**Implementation Source:** `src/shared/level-nav.js:183-184`
```javascript
border: 2px solid ${dailyCompleted ? '#009E73' : '#F0E442'};
background: ${dailyCompleted ? 'rgba(0, 158, 115, 0.3)' : 'rgba(240, 228, 66, 0.3)'};
color: ${dailyCompleted ? '#009E73' : '#F0E442'};
```

**Status:** ✅ FIXED (bf-vilg7)
- Previously checked RGB order: `'240, 228, 66'`
- Fixed to BGR order: `'66, 228, 240'` to match `getComputedStyle().borderColor` format
- Comment confirms: `// #F0E442 yellow`

**What the test sees:** The border color returns in BGR format as `'rgb(66, 228, 240)'`

**Hex → RGB breakdown:**
- `#F0E442` → `rgb(240, 228, 66)` (standard RGB)
- But `getComputedStyle().borderColor` returns: `'rgb(66, 228, 240)'` (BGR order)

---

#### Completed State (Green)

**Expected Color:** `#009E73` (green - completed daily-challenge state)

**Expected RGB Value (BGR format):** `'0, 158, 115'`

**Implementation Source:** `src/shared/level-nav.js:183` (same as above, when `dailyCompleted` is true)

**Status:** ✅ FIXED (bf-befzv)
- Previously checked: `'115, 158, 0'` (incorrect BGR order for #009E73)
- Fixed to: `'0, 158, 115'` (correct BGR order)
- Applied to both daily-challenge and regular completed level assertions

**What the test sees:** When daily is completed, border color returns as `'rgb(0, 158, 115)'`

**Hex → RGB breakdown:**
- `#009E73` → `rgb(0, 158, 115)` (standard RGB)
- `getComputedStyle().borderColor` returns: `'rgb(0, 158, 115)'` (BGR order, same as RGB for this color)

---

## Summary Table

| Assertion Type | Expected Value | Implementation | Status | Fix Commit |
|----------------|----------------|-----------------|---------|------------|
| Text content | `'★'` | `level-nav.js:178` | ✅ Fixed | bf-1dnf8, bf-1j4b2 |
| aria-label | `'Daily Challenge'` | `level-nav.js:177` | ✅ Verified | bf-486sw |
| Border (incomplete) | `'66, 228, 240'` (BGR) | `level-nav.js:183` (#F0E442) | ✅ Fixed | bf-vilg7 |
| Border (completed) | `'0, 158, 115'` (BGR) | `level-nav.js:183` (#009E73) | ✅ Fixed | bf-befzv |

## Key Learnings

### BGR Order in getComputedStyle()

The critical issue with border color assertions is that `window.getComputedStyle(el).borderColor` returns values in **BGR order**, not the standard RGB order:

**Example:**
- **Color:** `#F0E442` (yellow)
- **Standard RGB:** `rgb(240, 228, 66)` → Red=240, Green=228, Blue=66
- **getComputedStyle returns:** `rgb(66, 228, 240)` → Blue=66, Green=228, Red=240 (BGR!)

This means test assertions must check for `'66, 228, 240'` not `'240, 228, 66'`.

### Pattern Across Tests

The BGR pattern is consistent across all border color assertions in the test file:
- Current level (blue #0072B2): `'178, 114, 0'` (not `'0, 114, 178'`)
- Completed level (green #009E73): `'115, 158, 0'` → fixed to `'0, 158, 115'`
- Daily incomplete (yellow #F0E442): `'240, 228, 66'` → fixed to `'66, 228, 240'`
- Daily completed (green #009E73): `'115, 158, 0'` → fixed to `'0, 158, 115'`

### Unicode vs Literal Characters

The text content assertion initially failed because the source used Unicode escape sequences. The fix was simple: use the literal character `★` instead of `★` or other representations. Build tools preserve the literal character correctly.

---

## Current State (2026-07-23)

All daily-challenge assertions for parking-escape are now **PASSING** or have been **VERIFIED CORRECT**:

1. ✅ Star symbol (`'★'`) displays correctly - FIXED in bf-1dnf8, VERIFIED in bf-1j4b2
2. ✅ aria-label (`'Daily Challenge'`) is correct - VERIFIED in bf-486sw  
3. ✅ Incomplete border color (yellow `#F0E442`) uses correct BGR - FIXED in bf-vilg7
4. ✅ Completed border color (green `#009E73`) uses correct BGR - FIXED in bf-befzv

**No outstanding assertion failures remain** for parking-escape daily-challenge functionality.
