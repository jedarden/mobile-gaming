# Manually Triggered mobile-gaming-ci Workflow

**Date:** 2026-07-23
**Workflow ID:** mobile-gaming-ci-manual-5q8d6
**Cluster:** iad-ci
**Namespace:** argo-workflows

## Actions Taken

1. Created workflow manifest referencing the `mobile-gaming-ci` WorkflowTemplate
2. Submitted workflow to argo-workflows namespace using kubectl
3. Verified workflow entered Running phase within 5 seconds

## Workflow Details

- **Template:** mobile-gaming-ci
- **Generated Name:** mobile-gaming-ci-manual-5q8d6
- **Status:** Running
- **Age:** 5 seconds (at time of verification)

## Command Used

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

## Acceptance Criteria Met

- ✅ Created workflow manifest with mobile-gaming-ci template reference
- ✅ Successfully submitted workflow to argo-workflows namespace
- ✅ Captured and documented the generated workflow name/ID
- ✅ Confirmed workflow is in Running phase

The CI run has been successfully triggered and is executing the lint → unit tests + build (parallel) → E2E pipeline.
