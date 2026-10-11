# Retrieving failed CI workflow logs

Both mobile-gaming CI entry points archive pod logs to the iad-ci Garage
artifact store: Forgejo pushes submit `website-build` workflows named
`website-mobile-gaming-*`, and manual verification uses the
`mobile-gaming-ci` WorkflowTemplate. The push Sensor opts its mobile-gaming
Workflow into the same archive repository as the manual template. Pod garbage
collection can still remove completed pods without removing their logs.

## View logs after pod cleanup

1. Connect to the VPN and open [Argo Workflows](https://argo-ci.ardenone.com).
2. Select the `argo-workflows` namespace and open the failed
   `website-mobile-gaming-*` push workflow or `mobile-gaming-ci-*` manual run.
3. Select the failed node in the workflow graph and use that node's **Logs**
   action. It reads the archived artifact after `podGC: OnPodCompletion` has
   removed the pod. The workflow record is kept in Argo's archive for 30 days,
   so use the archived-workflows view if its live Workflow resource has expired.

For live or not-yet-collected pods, the same output is available with
`kubectl logs -n argo-workflows <pod-name> -c main` using the iad-ci cluster
proxy (`--server=http://traefik-iad-ci:8001`). After pod cleanup, use the Argo
UI's node-level archived log action; `kubectl logs` cannot read a deleted pod.

## Retention

Logs are stored in the `ci-release-artifacts` Garage bucket under
`mobile-gaming-ci-logs/v1/<namespace>/<workflow-uid>/<pod-name>/` and expire
after 30 days. The prefix is separate from transient release handoffs. Argo's
workflow archive keeps status metadata separately; the log contents are the
Garage artifacts.

This is short-term CI troubleshooting retention. Argo's log archive is a
convenience for viewing logs in the UI, not an indexed logging service.
