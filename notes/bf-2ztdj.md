# bf-2ztdj — Gameplay video recording + social sharing wired into games (Phase 6.5)

Status: **complete**. Implementation landed in commit `8e28885`
(`feat(share): wire gameplay recording + social sharing into 2 games (bf-2ztdj)`),
which was committed and pushed to `origin/main` by the prior dispatch. The bead
was left open only because that run ended before closing it. This note records
verification that the acceptance criteria are met.

## What was delivered (commit 8e28885)

- **`src/shared/gameplay-share.js`** — new glue module (`createSolveRecorder`)
  binding the three previously-dead modules together:
  - `recorder.js` — passive 30s circular-buffer capture (`maxDuration: 0`,
    `passive: true`).
  - `video-overlay.js` — a 9:16 compositor canvas fed by `renderFrame` every
    frame so the `mobile-gaming.pages.dev` watermark and the "Solved!" outro
    stats card are genuinely burned into the clip.
  - `share.js` — `showShareOverlay` (Web Share API primary path + per-platform
    deep-link picker) receives the finalized MP4 blob.
  - `shareSolve()` plays the outro card, `stopRecording()` → `convertToMP4()`,
    then opens the picker. Entirely best-effort: if `MediaRecorder` /
    `canvas.captureStream` are unavailable, gameplay is unaffected and Share
    falls back to text-only.

- **Wired into 2 games** (one puzzle, one runner):
  - `src/games/water-sort/game.js` — `initSolveRecorder()` starts passive
    capture; the win/retry overlay's `onShare` routes through
    `solveRecorder.shareSolve({ stats, url })`.
  - `src/games/crowd-runner/game.js` — same wiring for the runner.

- **WebGL/Phaser frame capture** — `preserveDrawingBuffer: true` added in
  `three-setup.js` (now configurable) and both renderers so frames can be
  copied into the 2D compositor.

- **E2E test** — `tests/e2e/gameplay-share.spec.js`: asserts wired games start a
  live passive `SolveRecorder`, and that the record → convert → share-picker
  flow runs without throwing and produces a video-backed share overlay
  (`.share-download-btn` present).

## Verification (this dispatch)

- `git log`/`git status`: commit `8e28885` present and `main` is level with
  `origin/main` (already pushed).
- Wiring confirmed by grep: `createSolveRecorder`/`shareSolve`/`initSolveRecorder`
  present in both games; `retry.js` renders the Share button (`data-action="share"`)
  and invokes `onShare(stats)`.
- `recorder.test.js` and `video-overlay.test.js` unit suites pass.
- `share.test.js` failures are pre-existing and environmental (Node 22 makes
  `global.navigator` getter-only; the test does `global.navigator = ...`); that
  file was **not** touched by this bead.
