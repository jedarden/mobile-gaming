# Manual CI Workflow Trigger - bf-3mkde

**Task:** Trigger manual CI workflow on iad-ci cluster

## Execution

### 1. Workflow Submission
Submitted the `mobile-gaming-ci` WorkflowTemplate via kubectl against iad-ci cluster:

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

### 2. Result
- **Workflow created:** `mobile-gaming-ci-manual-l2chv`
- **Status:** Running
- **Namespace:** argo-workflows
- **Cluster:** iad-ci (Rackspace Spot, us-east-iad-1)

### 3. Verification
```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig get workflow mobile-gaming-ci-manual-l2chv -n argo-workflows
```

Output showed:
```
NAME                            STATUS    AGE   MESSAGE
mobile-gaming-ci-manual-l2chv   Running   7s
```

## Acceptance Criteria Met
✅ Workflow submitted successfully via kubectl
✅ Workflow name/ID captured (mobile-gaming-ci-manual-l2chv)
✅ Workflow appears in list with status 'Running'

## Notes
- The workflow will run through: lint → unit tests + build (parallel) → E2E
- Can monitor progress via: `kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig get workflows -n argo-workflows --sort-by=.metadata.creationTimestamp`
- Argo UI available at: https://argo-ci.ardenone.com (Google SSO, VPN only)
