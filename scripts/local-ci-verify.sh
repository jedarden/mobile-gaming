#!/usr/bin/env bash
# Fresh-archive local CI verification.
#
# Automates the clean-archive workflow recorded in
# docs/ci/2026-10-11-workflow-verification.md: extract a pristine
# `git archive` of the given ref (default HEAD — never the working tree),
# then run every CI gate stage inside it, mirroring the mobile-gaming-ci
# Argo WorkflowTemplate (lint + scaffold checks, unit + level validation,
# build + both bundle budgets, Chromium E2E smoke).
#
# Behaviour:
#   * stops at the first stage that exits nonzero;
#   * prints a per-stage summary table at the end (pass or fail);
#   * removes the extraction directory on success;
#   * deliberately retains it on failure for diagnosis, printing its path
#     together with the per-stage logs under <extraction>/logs/.
#
# Usage: scripts/local-ci-verify.sh [git-ref]
set -uo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REF="${1:-HEAD}"

if ! COMMIT="$(git -C "$SOURCE_DIR" rev-parse --verify "${REF}^{commit}")"; then
  echo "error: ref does not resolve to a commit: $REF" >&2
  exit 2
fi

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/mobile-gaming-local-ci-verify-XXXXXX")"
LOGDIR="$WORKDIR/logs"
STAGES_TSV="$LOGDIR/stages.tsv"
mkdir -p "$LOGDIR"

PASS_COUNT=0
FAIL_STAGE=""
FAIL_CODE=0

cat > "$WORKDIR/verify-meta.txt" <<META
ref: $REF
commit: $COMMIT
started: $(date -Is)
host: $(hostname)
META

run_stage() {
  local name="$1" display="$2" fn="$3"
  local t0 rc elapsed
  echo "==> [$name] $display"
  t0=$(date +%s)
  rc=0
  ( cd "$WORKDIR" && "$fn" ) >"$LOGDIR/$name.log" 2>&1 || rc=$?
  elapsed=$(( $(date +%s) - t0 ))
  printf '%s\t%s\t%s\t%ss\t%s\n' "$name" "$display" "$rc" "$elapsed" "$LOGDIR/$name.log" >> "$STAGES_TSV"
  if [ "$rc" -ne 0 ]; then
    echo "    FAILED (exit $rc) — log: $LOGDIR/$name.log"
    tail -n 30 "$LOGDIR/$name.log" >&2 || true
    FAIL_STAGE="$name"
    FAIL_CODE="$rc"
    return 1
  fi
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "    ok (${elapsed}s)"
  return 0
}

print_summary() {
  local name display rc elapsed _
  echo
  echo "== local CI verification summary — mobile-gaming @ ${COMMIT:0:12} =="
  printf '%-20s %-50s %5s %8s\n' STAGE COMMAND EXIT TIME
  while IFS=$'\t' read -r name display rc elapsed _; do
    printf '%-20s %-50s %5s %8s\n' "$name" "$display" "$rc" "$elapsed"
  done < "$STAGES_TSV"
}

finish() {
  print_summary
  if [ -z "$FAIL_STAGE" ]; then
    echo "RESULT: PASS ($PASS_COUNT stages) — extraction removed"
    rm -rf "$WORKDIR"
    exit 0
  fi
  echo "RESULT: FAIL — stage '$FAIL_STAGE' exited $FAIL_CODE"
  echo "Extraction retained for diagnosis: $WORKDIR"
  echo "Stage logs: $LOGDIR"
  exit 1
}

trap 'print_summary; echo "interrupted — extraction retained for diagnosis: $WORKDIR"; exit 130' INT TERM

echo "source repo: $SOURCE_DIR"
echo "verifying commit: $COMMIT (ref: $REF)"
echo "extraction: $WORKDIR"

t_all0=$(date +%s)
if ! git -C "$SOURCE_DIR" archive "$COMMIT" | tar -x -C "$WORKDIR"; then
  echo "error: archive extraction failed" >&2
  rm -rf "$WORKDIR"
  exit 2
fi

# E2E preview port. This host is shared and 4173 is regularly held by an
# unrelated preview server; playwright.config.ci.js sets
# reuseExistingServer: false, so a held port fails the run outright. Let the
# kernel hand us a free port unless the caller pinned one.
if [ -z "${PLAYWRIGHT_TEST_PORT:-}" ]; then
  E2E_PORT="$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
  echo "e2e preview port (auto-selected): $E2E_PORT"
else
  E2E_PORT="$PLAYWRIGHT_TEST_PORT"
fi

stage_install() { npm ci; }

stage_lint() { npm run lint; }

# The Argo lint step's shell checks: no console.log in game logic files,
# the 7 required scaffold files per game, >= 3 levels per game.
stage_scaffold_lint() {
  set -e
  if grep -rn "console\.log" src/games/*/state.js src/games/*/renderer.js \
      src/games/*/input.js src/games/*/generator.js 2>/dev/null; then
    echo "ERROR: console.log statements found in game files"
    exit 1
  fi
  local game_dir game_name file level_count count=0
  for game_dir in src/games/*/; do
    game_name=$(basename "$game_dir")
    for file in index.html game.js state.js renderer.js input.js styles.css levels.json; do
      [ -f "$game_dir$file" ] || { echo "ERROR: $game_dir missing $file"; exit 1; }
    done
    level_count=$(jq 'length' "$game_dir/levels.json" 2>/dev/null || echo "0")
    [ "$level_count" -ge 3 ] || { echo "ERROR: $game_name/levels.json has only $level_count levels (need >= 3)"; exit 1; }
    count=$((count + 1))
  done
  echo "scaffold lint: $count games checked (7 files + >= 3 levels each)"
}

stage_unit() { npm test; }

stage_levels() { npm run test:levels -- --count 5; }

stage_build() { npm run build; }

stage_bundle_size() { npm run test:bundle-size; }

# The Argo build step's raw-byte guard: total generated JS <= 3000KB,
# CSS <= 150KB (apparent bytes, dist/assets).
stage_bundle_raw_budget() {
  set -e
  local js_size css_size
  js_size=$(du -sb dist/assets/*.js 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
  css_size=$(du -sb dist/assets/*.css 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
  echo "JS: $((js_size / 1024))KB (budget 3000KB)  CSS: $((css_size / 1024))KB (budget 150KB)"
  [ "$js_size" -le $((3000 * 1024)) ] || { echo "ERROR: JS bundle exceeds 3000KB"; exit 1; }
  [ "$css_size" -le $((150 * 1024)) ] || { echo "ERROR: CSS bundle exceeds 150KB"; exit 1; }
}

stage_playwright_install() { npx playwright install chromium; }

stage_e2e() { PLAYWRIGHT_TEST_PORT="$E2E_PORT" npm run test:e2e; }

run_stage install            "npm ci"                                                stage_install             || finish
run_stage lint               "npm run lint"                                          stage_lint                || finish
run_stage scaffold-lint      "argo scaffold lint checks"                             stage_scaffold_lint       || finish
run_stage unit               "npm test"                                              stage_unit                || finish
run_stage levels             "npm run test:levels -- --count 5"                      stage_levels              || finish
run_stage build              "npm run build"                                         stage_build               || finish
run_stage bundle-size        "npm run test:bundle-size"                              stage_bundle_size         || finish
run_stage bundle-raw-budget  "argo raw-byte bundle guard"                            stage_bundle_raw_budget   || finish
run_stage playwright-install "npx playwright install chromium"                       stage_playwright_install  || finish
run_stage e2e                "PLAYWRIGHT_TEST_PORT=$E2E_PORT npm run test:e2e"       stage_e2e                 || finish

echo "total wall time: $(( $(date +%s) - t_all0 ))s"
finish
