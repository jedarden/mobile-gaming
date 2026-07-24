# CI Workflow Run: bf-3qv1l

## Workflow Details
- **Workflow ID:** `mobile-gaming-ci-manual-jk92f`
- **Submitted:** 2026-07-24T14:59:33Z
- **Completed:** 2026-07-24T15:02:27Z
- **Duration:** ~3 minutes
- **Final Phase:** Failed

## Stage Execution

| Stage | Status | Notes |
|-------|--------|-------|
| lint | ✅ Succeeded | Console.log and scaffold validation passed |
| unit | ❌ Failed | Exit code 1 |
| build | ❌ Failed | Exit code 1 |
| e2e | ⏭️ Skipped | Blocked by build/unit failures |

## Observations

1. **Workflow transitioned successfully** from Pending → Running
2. **Lint stage passed** - no console.log violations or scaffold issues detected
3. **Build and unit stages failed** - pods were deleted before logs could be captured (podGC: OnPodCompletion)
4. **E2E stage never ran** due to dependency on successful build/unit

## Next Steps

To investigate the failures:
1. Re-submit workflow with `podGC: OnWorkflowCompletion` to preserve pods
2. Or check Argo UI at https://argo-ci.ardenone.com for cached logs (available for 2h after failure)
3. Run unit tests locally: `npm test`
4. Run build locally: `npm run build`

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
