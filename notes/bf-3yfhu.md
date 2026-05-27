# Argo Events CI for mobile-gaming - Status

## Date: 2026-05-26

## Finding: Argo Events Configuration Already Complete

The declarative-config repository already has the complete Argo Events configuration for mobile-gaming:

### 1. github-eventsource.yml (/home/coding/declarative-config/k8s/iad-ci/argo-events/github-eventsource.yml)
- Lines 400-420: `mobile-gaming` webhook entry configured
- Endpoint: `/mobile-gaming`
- Events: `push`

### 2. website-build-sensor.yml (/home/coding/declarative-config/k8s/iad-ci/argo-events/website-build-sensor.yml)
- Lines 48-60: `mobile-gaming-push` dependency configured
- Lines 159-183: `mobile-gaming-deploy` trigger configured
- Build command (line 181): `"npm ci && npm test && npm run test:levels && npm run build"` ✓ CORRECT

### 3. WorkflowTemplate
- Uses the parameterized `website-build` template (not a game-specific one)
- The `website-build-workflowtemplate.yml` accepts a `build-command` parameter
- The sensor passes the correct build command as a parameter

## Changes Made

### Fixed .workflow/mobile-gaming-build.yaml
The local WorkflowTemplate file had an incorrect build command:
- Before: `npm ci && npm run build && npm test` (wrong order, missing test:levels)
- After: `npm ci && npm test && npm run test:levels && npm run build`

Note: This file appears to be unused by the actual CI/CD pipeline (the sensor uses `website-build`), but it's now consistent with the correct build order.

## Git History

- **Initial setup**: Commit 7ae2dda (April 4, 2026) - Added mobile-gaming to both EventSource and Sensor
- **Build command fix**: Commit 7402f29 (May 5, 2026) - "fix(ci): gate mobile-gaming deploys on tests and level validation"
- The configuration has been in place for nearly 2 months

## Verification

No changes needed to declarative-config - the Argo Events configuration is already complete and correct.

To verify CI is working:
1. Push to mobile-gaming main branch
2. Check the workflow runs at: https://argo-ci.ardenone.com
3. Verify the build command includes all test steps

## Architecture

The setup uses a shared `website-build` WorkflowTemplate that is parameterized:
- `repo`: jedarden/mobile-gaming
- `build-command`: npm ci && npm test && npm run test:levels && npm run build
- `cf-project`: mobile-gaming
- `output-dir`: dist

This is the same pattern used by other website repos (jedarden.com, morejoyfulyou.com, etc.).
