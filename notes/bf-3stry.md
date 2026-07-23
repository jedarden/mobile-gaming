# bf-3stry: Verify parking-escape CI workflow configuration

## Task
Check that the mobile-gaming-ci workflow template exists in iad-ci and is properly configured to run parking-escape daily-challenge tests.

## Acceptance Criteria - ALL MET ✓

### 1. Workflow template exists in declarative-config ✓
**Location:** `~/declarative-config/k8s/iad-ci/argo-workflows/mobile-gaming-ci-workflowtemplate.yml`

### 2. Template includes parking-escape daily-challenge test step ✓
The workflow's `unit` step runs `npm test`, which includes:
- `tests/unit/daily-challenge-behavioral.test.js` - Explicitly tests parking-escape:
  - Line 26: `'parking-escape'` is in the GAMES test array
  - Verifies: completeDailyChallenge import, guarded call with GAME_ID, daily seed generation, URL param detection, isDailyMode gating
  - Tests generator games use getGameDailySeed/getGameDailyNumericSeed
  - Tests fallback games use seed % levels.length pattern

### 3. ArgoCD has synced the template to iad-ci cluster ✓
**kubectl query results:**
- Label: `argocd.argoproj.io/instance: argo-workflows-ns-iad-ci`
- ResourceVersion: `36802473` (active)
- Created: `2026-05-28T11:14:15Z`

### 4. Workflow can be queried via kubectl ✓
```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig \
  get workflowtemplate mobile-gaming-ci -n argo-workflows -o json
```
Successfully retrieved full template spec.

## Workflow Structure
- **entrypoint:** ci
- **steps:** lint → unit+build (parallel) → e2e
- **unit step:** Runs `npm test` + `npm run test:levels` (includes parking-escape daily-challenge tests)
- **e2e step:** Runs `npm run test:e2e` (includes daily-challenge indicator tests in level-nav.spec.js)

## Test Coverage for parking-escape daily-challenge
- **Unit tests:** Behavioral completion tests in daily-challenge-behavioral.test.js
- **E2E tests:** Daily challenge indicator verification in tests/e2e/level-nav.spec.js

## Conclusion
The mobile-gaming-ci workflow is properly configured and synced to the iad-ci cluster. Parking-escape daily-challenge tests are included in the test suite and run as part of the CI pipeline.
