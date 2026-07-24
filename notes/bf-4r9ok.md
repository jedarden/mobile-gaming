# Bead bf-4r9ok: Trigger CI workflow on iad-ci cluster

## Task Completed

Successfully submitted a manual CI workflow run for mobile-gaming on the iad-ci cluster.

## Workflow Details

- **Workflow Name:** `mobile-gaming-ci-manual-k55gg`
- **Status:** Running
- **Submitted:** 2026-07-24
- **Namespace:** argo-workflows
- **WorkflowTemplate:** mobile-gaming-ci

## Verification

The workflow was created via kubectl and verified to be in `Running` phase within 14 seconds of submission.

## Monitoring

Monitor the workflow progress via:

```bash
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig get workflow mobile-gaming-ci-manual-k55gg -n argo-workflows
```

Or via the Argo UI at `https://argo-ci.ardenone.com`

## Acceptance Criteria Met

- ✅ Workflow created successfully on iad-ci cluster
- ✅ Workflow status shows 'Running' phase
- ✅ Workflow name/ID captured for subsequent steps
