# bf-4se8v — Wire shared/sync.js into the Settings drawer

## Problem

The Settings drawer's "Sync Progress (Export/Import)" buttons were silent
no-ops: `src/hub/hub.js` called `createSettings()` without passing
`onSyncExport` / `onSyncImport` callbacks, so the handlers in
`src/shared/settings.js` (`if (onSyncExport) onSyncExport()` etc.) did
nothing. `src/shared/sync.js` (`exportProgress` / `importProgress`) was fully
implemented and unit-tested but imported by zero production code paths — the
"DEAD CODE - Complete but unused" gap flagged in `notes/bf-3pru8.md`.

## Change

### `src/hub/hub.js`
- Import `exportProgress` / `importProgress` from `../shared/sync.js`.
- `initSettings()` now passes real callbacks into `createSettings()`:
  - `onSyncExport()` → `exportProgress()` → opens a modal dialog showing the
    generated `SYNC-…` code with a **Copy** button
    (`navigator.clipboard.writeText`, with a select-the-text fallback) and a
    **Close** button.
  - `onSyncImport(code)` → `importProgress(code)` → surfaces the result to the
    user via a transient toast (green success / red failure with the error).
- New self-contained UI helpers `showSyncExportDialog()` and `showSyncToast()`
  plus their injected styles. `settings.js` is unchanged (its import still uses
  `prompt()` and its existing unit tests keep passing).

### `tests/e2e/sync.spec.js` (rewritten)
Per the acceptance criteria, the e2e now drives the **actual hub Settings UI**
(gear → Data → Sync Progress) instead of calling the module directly:
- export dialog shows a valid `SYNC-` code and Copy surfaces a toast
- full export→import round-trip across a cleared "device B" restores stats,
  settings, best-scores, and daily data
- import merges and keeps the higher score
- rich multi-game code stays compact (asserts effective compression vs the raw
  payload + a generous absolute ceiling)
- invalid code surfaces a failure toast

### Removed `tests/e2e/fixtures/sync-harness.html`
The old harness-based `Sync E2E` tests imported `../../src/shared/sync.js`,
which resolves to `tests/src/shared/sync.js` (one `../` short) — so under the
vite dev server those tests errored at import and never actually ran, and the
`< 1600` size assertion was never validated (the true compressed size of that
fixture is ~2.6k). The fixture is now unused and was deleted.

## Verification
- `vitest run tests/unit/settings.test.js tests/unit/sync.test.js
  tests/unit/sync-invalid-payload.test.js` → 97 passed.
- `playwright test tests/e2e/sync.spec.js --project=mobile-chrome` → 5 passed,
  run against a real `vite build` + `vite preview` (production path, sync UI
  confirmed bundled into `dist/assets/hub-*.js`).
- Pre-existing unrelated failures (solvers, level-coverage, share,
  game-retry-wiring unit tests; a hub preload e2e that reads localStorage
  before `goto`) were confirmed present without this change and are out of
  scope.

Environment note: this sandbox runs Playwright's downloaded Chromium via the
Nix system chromium binary; CI uses the standard bundled browsers.
