# CI Stability Test Tracking

This file tracks all CI stability test runs for the mobile-gaming project. Each entry documents a complete stability verification with all associated workflow runs.

## Test Runs Summary

| Test ID | Date | Purpose | Runs | Success Rate | Result | Notes |
|---------|------|---------|------|--------------|--------|-------|
| TBD | YYYY-MM-DD | [Description] | 3 | [X%] | [PASSED/FAILED] | [Brief notes] |

---

## Baseline Expectations

The following baseline expectations must be met for a CI stability test to be considered **PASSED**:

### Required Outcomes
1. **All workflow runs must complete successfully** - No failures at any step
2. **No timeouts** - All steps must complete within their time limits
3. **No selector errors** - No CSS selector failures in E2E tests
4. **No assertion failures** - All unit and E2E assertions must pass
5. **Consistent results** - All runs must produce identical results (all pass or all fail identically)
6. **No flaky behavior** - No intermittent or random failures

### CI Budget Limits
- **JavaScript bundle:** ≤ 500KB
- **CSS bundle:** ≤ 100KB
- **Unit test timeout:** 300 seconds
- **E2E test timeout:** 120 seconds

### Success Criteria
A stability test is **PASSED** when:
- All runs complete successfully (no failures)
- All acceptance criteria are met
- Results are consistent across all runs
- No flaky behavior is observed

A stability test is **FAILED** when:
- Any run fails at any step
- Any acceptance criterion is not met
- Results are inconsistent across runs
- Flaky behavior is observed

---

## Individual Test Runs

### Test ID: [TBD]

**Date:** YYYY-MM-DD  
**Purpose:** [Description]  
**Bead:** [Bead ID if applicable]

**Results:**
- **Total Runs:** 3
- **Successful Runs:** [X]
- **Failed Runs:** [X]
- **Success Rate:** [X%]
- **Result:** [✅ PASSED | ❌ FAILED]

**Workflow IDs:**
- Run #1: `workflow-id-here`
- Run #2: `workflow-id-here`
- Run #3: `workflow-id-here`

**Acceptance Criteria:**
- [✅/❌] All workflows completed successfully
- [✅/❌] No timeouts occurred
- [✅/❌] No selector errors occurred
- [✅/❌] No assertion failures occurred
- [✅/❌] Consistent results across runs
- [✅/❌] No flaky behavior observed

**Notes:**
- [Any relevant observations, issues found, or recommendations]

**Detailed Report:** [Link to detailed report file or notes/bf-XXXXX.md]

---

## Historical Pattern Analysis

### Overall Statistics
- **Total Tests Run:** [X]
- **Passed:** [X]
- **Failed:** [X]
- **Pass Rate:** [X%]

### Common Failure Patterns
- **Build failures:** [Count and description]
- **Unit test failures:** [Count and description]
- **E2E test failures:** [Count and description]
- **Timeout issues:** [Count and description]
- **Selector errors:** [Count and description]

### Trends
- **Most Recent Test:** [Date]
- **Last Successful Test:** [Date (if any)]
- **Longest Failure Streak:** [X tests] [Date range]
- **Current Streak:** [X consecutive passes/failures]

---

## Cluster Access Verification

### iad-ci Cluster Access
**Status:** ✅ VERIFIED

**Verification Command:**
```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig get workflows -n argo-workflows
```

**Last Verified:** 2026-07-24

### WorkflowTemplate Status
**Template:** `mobile-gaming-ci`
**Status:** ✅ EXISTS

**Verification Command:**
```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig get workflowtemplate -n argo-workflows mobile-gaming-ci
```

**Last Verified:** 2026-07-24

---

## Manual CI Trigger

To manually trigger a CI workflow:

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

---

## Monitoring Commands

### List recent workflow runs
```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig \
  get workflows -n argo-workflows \
  --sort-by=.metadata.creationTimestamp \
  -l workflows.argoproj.io/workflow-template=mobile-gaming-ci
```

### Get workflow status
```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig \
  get workflow <workflow-id> -n argo-workflows \
  -o jsonpath='{.status.phase} - {.status.message}'
```

### Get workflow failure details
```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig \
  get workflow <workflow-id> -n argo-workflows -o json
```

### Stream logs from running workflow
```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig \
  logs -n argo-workflows <pod-name> -c main -f
```

---

## Argo UI Access

**URL:** `https://argo-ci.ardenone.com`  
**Auth:** Google SSO  
**Availability:** VPN only

---

*Tracking file created: 2026-07-24*  
*Last updated: 2026-07-24*
