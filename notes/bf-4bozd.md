# Trigger parking-escape daily-challenge CI workflow

Submitted `mobile-gaming-ci` workflow to iad-ci cluster for parking-escape daily-challenge tests.

## Submission Details

- **Workflow ID:** mobile-gaming-ci-manual-wjwn6
- **Submitted:** 2026-07-23T17:56:45Z
- **Status:** Running
- **Cluster:** iad-ci
- **Namespace:** argo-workflows

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

## Verification

- ✅ Workflow submitted successfully via kubectl
- ✅ Workflow assigned unique name/ID (mobile-gaming-ci-manual-wjwn6)
- ✅ Workflow appears in workflow list
- ✅ Initial status is 'Running'

## Monitoring

Monitor workflow execution:

```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig get workflow mobile-gaming-ci-manual-wjwn6 -n argo-workflows -o jsonpath='{.status.phase}'
```

Argo UI: https://argo-ci.ardenone.com (VPN only)
