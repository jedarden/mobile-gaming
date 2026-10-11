# CI workflow verification — 2026-10-11

## Result

The repository's CI commands passed from a fresh `git archive` extraction of
current `HEAD` (`16cfc68`). The Chromium production smoke stage covers
the hub, all 13 game routes and their level data, and daily-challenge entry and
seeded-mode behavior.

This is a fresh local clean-archive workflow, not a reported Argo Workflow run.
The configured `iad-ci` kubeconfig was rejected as unauthenticated when queried,
so no live workflow could be submitted or observed from this host.

## Stage evidence

| Stage | Command | Result |
| --- | --- | --- |
| Install | `npm ci` | Exit 0 |
| Lint | `npm run lint` | Exit 0; 83 existing warnings, no errors |
| Unit | `npm test` | Exit 0; 123 files and 5,391 tests passed. `pretest` runs ESLint. |
| Level validation | `npm run test:levels -- --count 5` | Exit 0; 330 schemas and 31 generator tiers passed |
| Build | `npm run build` | Exit 0 |
| Bundle budgets | `npm run test:bundle-size` and the Argo raw-byte budget guard | Both exit 0; 2,468,204 / 3,072,000 JS bytes and 48,838 / 153,600 CSS bytes |
| Chromium install | `npx playwright install chromium` | Exit 0 |
| E2E | `PLAYWRIGHT_TEST_PORT=49190 npm run test:e2e` | Exit 0; 16 Chromium production-preview tests passed |

The Argo lint shell checks also passed: no prohibited `console.log` statements,
all seven required scaffold files were present for every game, and each game
had at least three levels. The build emitted all 13 `levels.json` files beside
their production game pages.

## Daily challenge coverage

The browser tests check that the hub's daily banner links to the selected game
with `?daily=true` and that navigation returns HTTP 200. Parking Escape is also
loaded directly in daily mode; the test verifies the “Daily Challenge” label,
`isDailyMode === true`, one generated level, and a date-and-game-specific seed.
The unit stage additionally runs the repository's seeded daily-generation and
completion tests.

## CI E2E scope

`npm run test:e2e` is the Chromium gate used after the production build. It runs
16 targeted tests: one hub test, 13 per-game route/data checks, and two daily
challenge tests. The broader historical Playwright matrix remains available
through `npm run test:e2e:all` and is not represented by this verification.

A diagnostic attempt to run all 619 historical E2E cases exposed many stale
selectors and fixture assumptions; that run was interrupted at 460 cases with
exit 130. Those cases are not part of the current CI gate, so this report does
not claim the full historical matrix passes.
