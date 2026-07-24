# CI Workflow Verification Results (bf-52syk)

## Workflow Triggered
- **Workflow**: `mobile-gaming-ci-manual-qqg8v`
- **Cluster**: iad-ci
- **Timestamp**: 2026-07-24T16:33:45Z
- **Status**: Failed at unit step

## Step-by-Step Results

### 1. Lint Step ✅
- **Status**: Passed
- **Duration**: < 60s
- **Verification**:
  - No `console.log` statements found in game source files
  - All game directories have required scaffold files (index.html, game.js, state.js, renderer.js, input.js, styles.css, levels.json)
  - All levels.json files have ≥ 3 levels

### 2. Unit Step ❌
- **Status**: Failed
- **npm test**: ✅ Passed (duration: 27.57s, well under 300s timeout)
  - 111 test files passed
  - 5262 tests passed
- **npm run test:levels**: ❌ Failed with schema validation errors
  - 305 levels passed schema validation
  - 25 levels failed schema validation:
    - 15 merge-games levels (mg-001 through mg-015): `difficulty` is not a string enum
    - 10 satisfying-asmr levels (asmr-001 through asmr-010): `difficulty` is not a string enum
  - Expected: `difficulty` should be one of "easy", "medium", "hard" (string)
  - Actual: These levels likely have `difficulty` as a number (0, 1, 2)

### 3. Build Step ❌
- **Status**: Failed in CI (exit code 1)
- **Local build results**:
  - Total JS: 2410 KB (budget: 3000 KB) ✅
  - Total CSS: 47 KB (budget: 150 KB) ✅
  - Build completed successfully in 4.65s
- **Note**: The CI build budget is 3000KB JS / 150KB CSS (not 500KB / 100KB as initially stated)

### 4. E2E Step
- **Status**: Not reached (workflow failed at unit step)

## Issues Identified

1. **Schema Validation Errors**: 25 committed levels have invalid `difficulty` values
   - These need to be fixed to pass CI
   - Likely just need to convert number values to string enums

2. **Build Step Failure**: Despite passing locally, the build failed in CI
   - Possible causes: environment differences or timing issues
   - Bundle sizes are well within budget

## Workflow Progress
The workflow successfully reached and completed the lint step, then failed at the unit step due to level schema validation errors. The E2E step was never reached.

## Recommendation
Fix the 25 level files with invalid `difficulty` values by converting them from numbers to string enums ("easy", "medium", "hard") before re-running CI.
