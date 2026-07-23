# bf-3yq30: Second CI Workflow Submission

**Date:** 2026-07-23

## Task
Submit second CI workflow to iad-ci for mobile-gaming project.

## Execution

Submitted workflow using mobile-gaming-ci WorkflowTemplate:

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

## Results

- **Workflow ID:** `mobile-gaming-ci-manual-sgmzw`
- **Status at submission:** Running
- **Cluster:** iad-ci
- **Namespace:** argo-workflows

This is the second manual CI run for consistency verification.
