# Retrieving failed CI workflow logs

The `mobile-gaming-ci` WorkflowTemplate archives each step's container logs to
the iad-ci Garage artifact store. Pod garbage collection still removes completed
pods, but the logs remain available from the Argo UI for up to 30 days.

## View logs after pod cleanup

1. Connect to the VPN and open [Argo Workflows](https://argo-ci.ardenone.com).
2. Select the `argo-workflows` namespace and open the failed
   `mobile-gaming-ci` workflow.
3. Select the failed step in the workflow graph and open its **Logs** view. The
   Argo server reads the archived log even after `podGC: OnPodCompletion` has
   removed the pod.

For live or not-yet-collected pods, the same output is available with
`kubectl logs -n argo-workflows <pod-name> -c main` using the iad-ci cluster
proxy (`--server=http://traefik-iad-ci:8001`). After pod cleanup, use the Argo
UI's archived log view; `kubectl logs` cannot read a deleted pod.

## Retention

Logs are stored in the `ci-release-artifacts` Garage bucket under
`mobile-gaming-ci-logs/v1/` and expire after 30 days. The prefix is separate
from transient release handoffs. Workflow status is archived separately and
does not contain pod logs.

This is short-term CI troubleshooting retention. Argo's log archive is a
convenience for viewing logs in the UI, not an indexed logging service.
