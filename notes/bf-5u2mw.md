# mobile-gaming-ci Manual Trigger - bf-5u2mw

**Date:** 2026-07-23

## Action
Manually triggered the mobile-gaming-ci workflow in the iad-ci cluster using kubectl.

## Workflow Details
- **Workflow Name:** mobile-gaming-ci-manual-tr72q
- **Namespace:** argo-workflows
- **Phase:** Running
- **Started At:** 2026-07-23T08:25:03Z

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

## Monitoring
To monitor this workflow:
```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig get workflow mobile-gaming-ci-manual-tr72q -n argo-workflows
```

Argo UI: https://argo-ci.ardenone.com

