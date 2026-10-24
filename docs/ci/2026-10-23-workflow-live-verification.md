# CI workflow verification — 2026-10-23 (live Argo run restored)

## Result

Live Argo Workflows submission from this host is working again. Workflow
`mobile-gaming-ci-manual-5hl76` (uid `d50e396f-033d-47cc-bc47-2dcc6b1e7da5`)
was submitted manually against `workflowTemplateRef: mobile-gaming-ci` at
Forgejo `main` = `5af635d`, created `2026-10-24T00:22:56Z`.

This resolves the blocker recorded in
[2026-10-11-workflow-verification.md](2026-10-11-workflow-verification.md):
the configured `iad-ci` kubeconfig is no longer rejected as unauthenticated.

## Workflow outcome

| Stage | Phase | Notes |
| --- | --- | --- |
| lint | Succeeded | console.log scan + scaffold/levels validation |
| unit | **Failed** | 1 test failed, 993 passed: `tests/unit/share.test.js:95` |
| build | Succeeded | bundle budgets held at HEAD |
| e2e | skipped | step group aborted when unit failed |

Workflow phase: **Failed** (`child 'mobile-gaming-ci-manual-5hl76-1230683341'
failed`). The failure is a pre-existing defect on committed `main`, not an
infrastructure fault: `tests/unit/share.test.js:95` asserts the stubbed
`navigator` property descriptor is an accessor (`get`/`set`), but the CI image
(`node:20-bookworm`) has no global `navigator` accessor to capture — Node
added `navigator` to `globalThis` in v21, and this box's Node 24 passes the
same suite. Recorded on bead `mobgame-adc92828`; fixing it is outside this
bead's scope (share tests are under active work by another strand).

## How access was restored

- The dead kubeconfig (`~/.kube/iad-ci.kubeconfig`, static Rackspace Spot
  ngpc token, `exp` 2026-10-22) was replaced using the credential an operator
  provisioned on 2026-10-12 in OpenBao at
  `secret/rs-manager/iad-ci/cluster` (fields `server`, `caData`, `token`) —
  a long-lived `kube-system/argocd-manager` service-account token for the
  same `https://hcp-de5bec10-….spot.rackspace.com` cluster. The value moved
  from OpenBao straight into the kubeconfig file through a pipe; it was never
  printed or placed on a command line.
- The previous kubeconfig is preserved at
  `~/.kube/iad-ci.kubeconfig.bak-20261023-dead-static-token`.
- The replacement token carries no `exp` claim, so the
  `kubeconfig-expiry-sweep` stop paging it for expiry; its live probe still
  catches reachability/auth breakage.
- Caveat: this is a static token of a service account, not an exec-plugin
  mint. It cannot silently expire, but if the SA is deleted the kubeconfig
  breaks loudly; the `rs-manager-credential.py` Spot-refresh exec pattern
  (`~/.kube/rs-manager-credential.py`) is the durable long-term shape if the
  iad-ci cloudspace ever needs agent-org tokens.

## Pre-flight evidence

```
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig auth whoami
  → Username: system:serviceaccount:kube-system:argocd-manager
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig \
  auth can-i create workflows.argoproj.io -n argo-workflows   → yes
kubectl --kubeconfig=/home/coding/.kube/iad-ci.kubeconfig \
  auth can-i get workflows.argoproj.io -n argo-workflows      → yes
```

## Archived Garage logs

The template's `artifactRepositoryRef`
(`configMap/ci-release-artifact-repositories`, key `mobile-gaming-ci-logs-v1`)
keeps pod logs in the `needle-ci-artifacts-iad` Garage despite
`podGC: OnPodCompletion`. Verified live:

- bucket `ci-release-artifacts`, endpoint
  `needle-ci-artifacts-iad.argo-workflows.svc.cluster.local:3900` (reached
  from this host via `kubectl port-forward`, credentials from the
  `ci-release-artifact-access` secret, path-style addressing)
- key format
  `mobile-gaming-ci-logs/v1/argo-workflows/<workflow.uid>/<pod.name>/main.log`
- both steps of this run are archived:
  `…/mobile-gaming-ci-manual-5hl76-lint-550019469/main.log` and
  `…/mobile-gaming-ci-manual-5hl76-unit-1230683341/main.log` (139,903 bytes;
  retrieved and inspected to diagnose the unit failure above)

## Local clean-archive verification

`scripts/definition-of-done.sh` (shipped in this change) runs the repo's
definition of done; `--fast` skips the browser stage. In a `git archive HEAD`
extraction of `50317fe` on this host:

```
scripts/definition-of-done.sh --fast  → exit 0
```

install / lint / unit / level validation (330 schemas, 31 generator tiers) /
build / bundle budgets all passed locally on Node 24 — again showing the unit
suite is green on modern Node and red only under the CI image's Node 20.

## 2026-10-24 addendum — verifier gate resolved at current HEAD

The NEEDLE fallback gate re-ran this verifier *without* `--fast` and it
failed: the e2e stage pinned preview port 4173, which an orphaned preview
server held on this shared host (`reuseExistingServer: false` fails such a
run outright). `mobgame-119a31db` fixed the verifier on `main` (`ee5b82c`)
by auto-selecting an ephemeral port when `PLAYWRIGHT_TEST_PORT` is unset,
so the collision can no longer occur.

Re-verified at current `HEAD` (`f8ccd79`) in a fresh `git archive`
extraction, full verifier (no `--fast`):

```
scripts/definition-of-done.sh  → exit 0
```

Every stage ran: install, lint, unit, level validation, build, bundle
budgets, and e2e — 16/16 Chromium tests passed.

Product code is unchanged between `5af635d` (the live run above) and
`f8ccd79` — only this document and the verifier itself differ — so the
recorded live outcome still describes current `HEAD`. The CI unit red
(`share.test.js` navigator descriptor under the CI image's Node 20) remains
tracked on `mobgame-aeaece0e` / `mobgame-293f51d2`, not here.

The Argo `Workflow` object is no longer retrievable (`NotFound` on
2026-10-24 ~01:50Z, about 90 minutes after the run — expected Argo TTL
behavior). The Garage archive is the durable record, and retrieval was
re-verified post-reaping (`kubectl port-forward` to
`svc/needle-ci-artifacts-iad`, SigV4 list against bucket
`ci-release-artifacts`):

```
 20352  …/mobile-gaming-ci-manual-5hl76-lint-550019469/main.log
139903  …/mobile-gaming-ci-manual-5hl76-unit-1230683341/main.log
  8110  …/mobile-gaming-ci-manual-5hl76-build-3911617637/main.log
```

The build step's log is archived alongside lint and unit; all three sizes
match the run as recorded above.
