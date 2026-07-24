# CI Baseline Expectations

This document defines the baseline expectations for CI stability testing in the mobile-gaming project.

## Overview

The mobile-gaming project uses Argo Workflows on the iad-ci cluster for CI/CD. All CI runs must meet these baseline expectations to be considered stable.

## CI Infrastructure

### Cluster: iad-ci
- **Type:** Rackspace Spot cluster in us-east-iad-1
- **Access:** kubectl with ServiceAccount `argocd-manager` (cluster-admin)
- **Kubeconfig:** `/home/coding/.kube/iad-ci.kubeconfig`
- **Namespace:** `argo-workflows`

### WorkflowTemplate: mobile-gaming-ci
- **Location:** `jedarden/declarative-config → k8s/iad-ci/argo-workflows/mobile-gaming-ci-workflowtemplate.yml`
- **Sync:** ArgoCD on ardenone-manager syncs automatically on push
- **Trigger:** Manual workflow creation or webhook

### CI Steps (in order)
1. **Lint** - Console.log check + scaffold validation
2. **Build + Unit** (parallel) - Vite build + vitest tests
3. **E2E** - Playwright tests (chromium)

## Baseline Success Criteria

### 1. All Workflows Must Complete Successfully
- **Expected outcome:** Every workflow run reaches `Succeeded` phase
- **Failure modes:** `Failed`, `Error`, or any retry exhaustion
- **Time limit:** Full workflow should complete within 15 minutes

### 2. No Timeouts
Each step has a timeout limit that must not be exceeded:
- **Lint step:** 60 seconds
- **Build step:** 300 seconds (5 minutes)
- **Unit step:** 300 seconds (5 minutes)
- **E2E step:** 120 seconds (2 minutes)

**Timeout symptoms:**
- `Pod was active on the node longer than the specified deadline`
- Step marked as `Failed` with timeout message
- Workflow stuck in `Running` phase indefinitely

### 3. No Selector Errors
E2E tests must not fail due to missing or invalid CSS selectors.

**Selector error symptoms:**
- `Error: strict mode violation: locator.strict() expected exactly 1 element`
- `Timeout exceeded while waiting for selector`
- `Target closed` or `Element not found` errors

**Common causes:**
- DOM structure changes not reflected in tests
- Timing issues (element not yet rendered)
- Incorrect selectors in test code
- Test environment rendering issues

### 4. No Assertion Failures
All unit and E2E tests must pass without assertion failures.

**Assertion failure symptoms:**
- `Error: expected X to be Y`
- Test suite exit code 1
- Failing test counts in output
- Snapshot mismatches

**Common causes:**
- Code bugs
- Test logic errors
- Environment-specific failures
- Data issues in test fixtures

### 5. Consistent Results Across Runs
Multiple runs of the same workflow must produce identical results.

**Consistency requirements:**
- All runs must pass (or all must fail identically)
- No intermittent successes or failures
- Same test counts across runs
- Same bundle sizes across runs
- Same performance characteristics

**Inconsistency symptoms:**
- Run #1 passes, Run #2 fails
- Different tests failing in different runs
- Different bundle sizes in different runs
- Timing-dependent failures

### 6. No Flaky Behavior
Tests must be deterministic and not affected by timing or randomness.

**Flakiness symptoms:**
- Random failures on retry
- Different results in different runs
- Race conditions
- Time-dependent failures
- Non-deterministic test ordering issues

**Common flaky test causes:**
- Missing `await` statements
- Insufficient wait times
- Shared state between tests
- Date/time-dependent tests
- Random data generation without seeding

## Bundle Size Budgets

The CI enforces bundle size limits to prevent code bloat:

| Bundle Type | Budget | Status |
|-------------|--------|--------|
| JavaScript | ≤ 500KB | Enforced |
| CSS | ≤ 100KB | Enforced |

**Budget enforcement:**
- Build step fails if bundle exceeds budget
- Percentage over budget is reported in error
- Must reduce bundle size to proceed

**Current status:**
- Verify current bundle sizes with `npm run build`
- Check dist/ directory for generated file sizes
- Review build output for budget warnings

## Scaffold Validation

Every game directory must contain exactly these files:
- `index.html`
- `game.js`
- `state.js`
- `renderer.js`
- `input.js`
- `styles.css`
- `levels.json` (must contain at least 3 levels)

**Validation failure symptoms:**
- `Missing required file` errors
- `levels.json must contain at least 3 levels` errors
- Scaffold check exit code 1

## Console.log Restrictions

No `console.log` statements are allowed in core game files:
- Forbidden in: `state.js`, `renderer.js`, `input.js`, `generator.js`
- Allowed in: `index.html`, test files, build scripts
- CI lint check fails on violations

## Acceptance Criteria for Stability Testing

A stability test run is considered **PASSED** when:

1. ✅ All 3 workflow runs completed successfully
2. ✅ No timeouts occurred in any step
3. ✅ No selector errors occurred in E2E tests
4. ✅ No assertion failures occurred in unit/E2E tests
5. ✅ Consistent results across all 3 runs
6. ✅ No flaky behavior observed
7. ✅ All workflow run IDs documented

A stability test run is considered **FAILED** when ANY of:
- ❌ Any workflow run fails at any step
- ❌ Any timeout occurs
- ❌ Any selector error occurs
- ❌ Any assertion fails
- ❌ Results are inconsistent across runs
- ❌ Flaky behavior is observed

## Common CI Issues and Solutions

### Issue: Unit tests pass locally but fail in CI
**Possible causes:**
- Node version differences
- Dependency versions mismatch
- Environment variables not set
- File path issues (case sensitivity)
- Timing differences (faster/slower CI environment)

**Solutions:**
- Check CI Node version vs local
- Run `npm ci` to replicate CI dependency install
- Check for environment-specific code
- Verify file paths are case-consistent
- Add waits/assertions for async operations

### Issue: E2E tests timeout
**Possible causes:**
- App not starting in time
- Selector not finding elements
- Network delays loading resources
- Browser startup issues

**Solutions:**
- Increase wait timeouts
- Check selectors are correct
- Ensure app is fully loaded before tests
- Check for network failures

### Issue: Bundle size exceeded
**Possible causes:**
- Large dependencies added
- Duplicate dependencies
- Development code not tree-shaken
- Assets bundled incorrectly

**Solutions:**
- Analyze bundle with `npm run build -- --report`
- Remove unused dependencies
- Code-split large modules
- Move large assets to separate loading

### Issue: Scaffold validation fails
**Possible causes:**
- Missing required files
- Incorrect file names
- Empty levels.json
- Incorrect directory structure

**Solutions:**
- Verify all required files exist
- Check file naming matches exactly
- Ensure levels.json has at least 3 level objects
- Check directory structure matches scaffold

## Verification Commands

### Quick CI Health Check
```bash
# List recent workflows
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig \
  get workflows -n argo-workflows \
  --sort-by=.metadata.creationTimestamp | tail -10

# Check for mobile-gaming workflows
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig \
  get workflows -n argo-workflows \
  -l workflows.argoproj.io/workflow-template=mobile-gaming-ci
```

### Detailed Workflow Status
```bash
# Get workflow phase and message
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig \
  get workflow <workflow-id> -n argo-workflows \
  -o jsonpath='{.status.phase} - {.status.message}'

# Get all node statuses
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig \
  get workflow <workflow-id> -n argo-workflows -o json | \
  python3 -c "
import json,sys
w = json.load(sys.stdin)
for node in w['status'].get('nodes',{}).values():
    print(f\"{node['displayName']}: {node.get('phase', 'Unknown')} - {node.get('message', '')}\")
"
```

### Manual CI Trigger
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

## Documentation Standards

All stability test runs should be documented with:
1. Test date and purpose
2. All workflow run IDs
3. Per-run results (build, unit, E2E)
4. Consistency analysis
5. Acceptance criteria verification
6. Final conclusion (PASSED/FAILED)
7. Any recommendations or follow-up needed

Use the template in `docs/ci-stability-template.md` for documentation.

---

*Baseline expectations defined: 2026-07-24*  
*Last updated: 2026-07-24*
