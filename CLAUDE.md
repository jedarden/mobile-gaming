# mobile-gaming — worker context

Mobile-browser HTML5 games collection. Each game lives in `src/games/<name>/` with a fixed scaffold.

## Project Structure

Every game directory must have exactly these files:
- `index.html`, `game.js`, `state.js`, `renderer.js`, `input.js`, `styles.css`, `levels.json`
- `levels.json` must contain at least 3 levels

Both structural rules are enforced locally by `npm run test:scaffold`
(`scripts/validate-scaffold.js`), which runs as part of `npm test` (pretest).

No `console.log` in `state.js`, `renderer.js`, `input.js`, or `generator.js` — the CI lint check fails on these.

## Build & Test

```bash
npm ci
npm test                  # vitest unit tests
npm run build             # Vite build → dist/
npm run test:e2e          # Playwright E2E (chromium)
```

Bundle size budget enforced by CI: 3,000KB total generated JavaScript
(including Phaser and Three.js vendor chunks), with a 500KB gzipped initial
JavaScript budget per game. CSS remains limited to 100KB.

## CI — Argo Workflows on iad-ci only. GitHub Actions are disabled.

**GitHub Actions are disabled across all repos in this environment. Never re-enable them, never add new workflows, never propose them.**

At the start of every work iteration, delete any `.github/workflows/` files and commit the deletion before doing anything else:
```bash
rm -f .github/workflows/*.yml .github/workflows/*.yaml
git add -A && git commit -m "ci: remove GitHub Actions (Argo Workflows on iad-ci only)"
```

There is a legacy `ci.yml` workflow file that is inert but must not be revived or used as a template.

All CI runs on Argo Workflows in the `iad-ci` cluster:

- **WorkflowTemplate:** `mobile-gaming-ci` — lives in `jedarden/declarative-config → k8s/iad-ci/argo-workflows/mobile-gaming-ci-workflowtemplate.yml`
- Steps: lint (console.log + scaffold validation) → unit tests + build (parallel) → E2E

To trigger a CI run manually:
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

ArgoCD on ardenone-manager syncs declarative-config automatically on push. Never `kubectl apply` directly against any cluster.
