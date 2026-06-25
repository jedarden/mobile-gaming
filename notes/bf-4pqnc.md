# BF-4PQNC: Fix CI Build Command

## Summary

Fixed the CI workflow to include the missing `npm run test:levels` validation step.

## Work Completed

**Issue**: The CI workflow (`mobile-gaming-ci` WorkflowTemplate in `jedarden/declarative-config`) was missing the `npm run test:levels` step that validates level JSON schemas and verifies generators.

**Fix**: Added `npm run test:levels` to the unit test phase in `/home/coding/declarative-config/k8s/iad-ci/argo-workflows/mobile-gaming-ci-workflowtemplate.yml`.

**Location**: jedarden/declarative-config, commit `99139f8`

**Note**: The local `.workflow/mobile-gaming-build.yaml` file was already correct (it included `test:levels` and had the proper order), but the CI workflow that runs on every PR/commit needed the fix.

## CI Flow After Fix

1. **lint** - Scaffold validation (console.log check, required files, level counts)
2. **unit** - `npm ci` → `npm test` → `npm run test:levels` ← **ADDED**
3. **build** - `npm ci` → `npm run build` → bundle size check
4. **e2e** - Playwright end-to-end tests

## Verification

The CI now properly validates level schemas and runs generator verification in the unit test phase, ensuring broken levels or generator issues are caught early in the pipeline.
