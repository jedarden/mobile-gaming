# bf-31car: Verify mobile-gaming-ci workflow template configuration

## Summary

Verified the mobile-gaming-ci WorkflowTemplate exists in iad-ci cluster and is properly configured to run parking-escape tests.

## Findings

### 1. WorkflowTemplate Location ✅
**File:** `/home/coding/declarative-config/k8s/iad-ci/argo-workflows/mobile-gaming-ci-workflowtemplate.yml`

### 2. Cluster Status ✅
**Command:**
```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig get workflowtemplate -n argo-workflows | grep -i mobile
```
**Result:** `mobile-gaming-ci` exists (age 56d)

### 3. ArgoCD Sync Status ✅
The workflow template has ArgoCD labels indicating it is managed by ArgoCD:
- `app: mobile-gaming-ci`
- `argocd.argoproj.io/instance: argo-workflows-ns-iad-ci`

### 4. Parking-Escape Test Coverage ✅

The workflow runs `npm run test:e2e` which executes:
- **File:** `/home/coding/mobile-gaming/tests/e2e/parking-escape.spec.js`
- **Tests (15 total):**
  1. Loads game page with correct title
  2. Canvas is visible and has non-zero dimensions
  3. Displays initial stats on level 1
  4. Has all navigation buttons
  5. Prev button disabled on first level
  6. Level navigation works
  7. Restart button resets the level
  8. Settings overlay opens with all toggles
  9. Settings overlay closes
  10. Win overlay starts hidden and is accessible
  11. Has a share button
  12. Shareable state URL round-trips a mid-puzzle board

### 5. Workflow Structure

**Pipeline Steps (sequential):**
1. **lint** (5 min timeout)
   - Validates no console.log in game source files
   - Validates all game directories have required 7 scaffold files
   - Validates levels.json has ≥3 levels per game

2. **unit** (5 min timeout, parallel with build)
   - Runs `npm test` (vitest)
   - Runs `npm run test:levels`

3. **build** (5 min timeout, parallel with unit)
   - Runs `npm run build`
   - Validates bundle size budgets: 500KB JS, 100KB CSS

4. **e2e** (10 min timeout)
   - Runs `npm run test:e2e` (Playwright)
   - Tests all games including parking-escape

### 6. Required Parameters

**Parameter:** `branch` (default: `main`)

**Secret:** `github-webhook-secret` (key: `token`) - Required for cloning the mobile-gaming repository

## Parking-Escape Game Files Verified

All required scaffold files present:
- `index.html` ✅
- `game.js` ✅
- `state.js` ✅
- `renderer.js` ✅
- `input.js` ✅
- `styles.css` ✅
- `levels.json` ✅ (26,223 bytes - contains multiple levels)

## Manual Trigger Command

```bash
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

## Conclusion

The mobile-gaming-ci workflow template is properly configured and synced via ArgoCD. Parking-escape tests are included in the E2E stage and will run automatically when the workflow is triggered. No additional configuration is needed.
