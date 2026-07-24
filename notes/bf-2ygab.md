# ArgoCD Sync Verification - mobile-gaming-ci WorkflowTemplate

## Status: SYNC FAILED - Drift Detected

### Issue Summary
The mobile-gaming-ci WorkflowTemplate on the iad-ci cluster is **out of sync** with declarative-config.

### Drift Details

| Field | declarative-config | Deployed (iad-ci) | Status |
|-------|-------------------|-------------------|--------|
| unit template `activeDeadlineSeconds` | 600 | 300 | **DRIFT** |

### ArgoCD Application Status
- **Application:** `argo-workflows-resources-iad-ci`
- **Sync Status:** Unknown
- **Health Status:** Unknown
- **Revision:** N/A (sync not occurring)

### Root Cause
ArgoCD cluster registration failure for iad-ci:
```
error getting cluster by server "https://hcp-de5bec10-ce14-4eed-a6f4-750f3fd3a89a.spot.rackspace.com": 
rpc error: code = NotFound desc = cluster not found
```

The cluster endpoint is not registered in ArgoCD, preventing automatic sync.

### Evidence
- **WorkflowTemplate exists on cluster:** Created 2026-05-28T11:14:15Z
- **Last declarative-config change:** 2026-06-25 13:22:29 (commit 99139f8)
- **File changed after deployment:** Yes (7+ days later)

### Verification Commands
```bash
# Check deployed WorkflowTemplate
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig \
  get workflowtemplate mobile-gaming-ci -n argo-workflows \
  -o jsonpath='{.spec.templates[?(@.name=="unit")].activeDeadlineSeconds}'

# Check declarative-config source
grep -A 1 "name: unit" ~/declarative-config/k8s/iad-ci/argo-workflows/mobile-gaming-ci-workflowtemplate.yml

# Check ArgoCD app status
kubectl --server=http://traefik-ardenone-manager:8001 \
  get applications.argoproj.io argo-workflows-resources-iad-ci -n argocd
```

### Resolution Required
1. Re-register iad-ci cluster in ArgoCD with correct endpoint
2. Verify cluster connectivity from ArgoCD
3. Trigger manual sync once cluster is accessible
4. Verify WorkflowTemplate updates post-sync

### Current State
- ✅ WorkflowTemplate exists on iad-ci cluster
- ✅ WorkflowTemplate has correct structure and labels
- ❌ ArgoCD automatic sync is not working
- ❌ Deployed version is outdated (300s vs 600s timeout)
