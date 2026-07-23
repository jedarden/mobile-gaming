# parking-escape CI Workflow Results

## Workflow Run: mobile-gaming-ci-manual-xqgfl

**Date**: 2026-07-23  
**Status**: FAILED  
**Duration**: 6m 5s (18:19:36Z - 18:25:41Z)  
**Branch**: main

## Test Results Summary

| Step | Status | Duration | Notes |
|------|--------|----------|-------|
| lint | ✅ PASSED | 45s | No console.log found; all scaffold files present |
| unit | ❌ FAILED | 5m | Timed out at 300s deadline (exit code 143) |
| build | ❌ FAILED | 1m 6s | JS bundle size exceeds 500KB budget |
| e2e | ⏭️ SKIPPED | - | Blocked by build/unit failures |

## Failure Details

### 1. Unit Test Timeout
- **Pod**: mobile-gaming-ci-manual-xqgfl-2991155085
- **Error**: "Pod was active on the node longer than the specified deadline"
- **Exit Code**: 143 (SIGTERM - killed after 300s deadline)
- **Started**: 18:20:31Z
- **Finished**: 18:25:31Z (exactly 5 minutes)

The unit tests (`npm test && npm run test:levels`) are exceeding the 5-minute activeDeadlineSeconds.

### 2. Build Failure - Bundle Size Exceeded
- **Pod**: mobile-gaming-ci-manual-xqgfl-1066495269
- **Error**: "main: Error (exit code 1)"
- **Exit Code**: 1
- **Started**: 18:20:31Z
- **Finished**: 18:21:37Z

**Root Cause**: JS bundle size exceeds 500KB budget

| Bundle Type | Actual Size | Budget | Status |
|-------------|-------------|--------|--------|
| JS Total | 2,451 KB | 500 KB | ❌ 4.9x over budget |
| CSS Total | 47 KB | 100 KB | ✅ within budget |

**Large JS chunks** (from local build):
- `phaser-B61OQUcB.js`: 1,481.79 kB (~1.5MB)
- `three-setup-ByYrO6bh.js`: 515.23 kB
- `pull-the-pin-AaKJNQpC.js`: 81.54 kB

The Phaser and Three.js libraries are included in the JS bundle total, causing the budget check to fail.

## Actionable Next Steps

### Immediate (Fix CI Green)
1. **Increase bundle size budget** - The current 500KB JS budget is unrealistic for a project bundling Phaser/Three.js libraries. Options:
   - Increase budget to ~3MB for JS
   - OR exclude vendor chunks from budget check (only count app code)

2. **Increase unit test timeout** - Current 300s (5min) deadline is too short:
   - Increase to 600s (10min) or 900s (15min)
   - OR investigate why unit tests are slow (14 games × test suite)

### Longer Term (Performance)
1. **Code splitting** - Use dynamic import() to lazy-load game-specific code
2. **Vendor chunking** - Separate Phaser/Three.js into shared vendor bundles
3. **Test optimization** - Run tests in parallel or optimize slow test suites

## Verification Steps

After fixing the budget/timeout:
```bash
# Submit new CI run
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig create -f - <<YAML
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: mobile-gaming-ci-manual-
  namespace: argo-workflows
spec:
  workflowTemplateRef:
    name: mobile-gaming-ci
YAML
```

## Related
- WorkflowTemplate: `mobile-gaming-ci` in `jedarden/declarative-config → k8s/iad-ci/argo-workflows/`
- Bead: bf-35fku
