#!/usr/bin/env bash
# Repository definition of done — the same stages the mobile-gaming-ci Argo
# workflow gates on (install, lint, unit, level validation, build, bundle
# budgets), plus the Chromium e2e smoke unless --fast is passed.
# Usage: scripts/definition-of-done.sh [--fast]
set -euo pipefail
cd "$(dirname "$0")/.."

FAST=0
if [ "${1:-}" = "--fast" ]; then
  FAST=1
elif [ $# -gt 0 ]; then
  echo "usage: $0 [--fast]" >&2
  exit 2
fi

echo "== install =="
npm ci

echo "== lint =="
npm run lint

echo "== unit =="
npm test

echo "== level validation =="
npm run test:levels -- --count 5

echo "== build =="
npm run build

echo "== bundle budgets =="
npm run test:bundle-size

if [ "$FAST" -eq 0 ]; then
  echo "== e2e =="
  npx playwright install chromium
  if [ -z "${PLAYWRIGHT_TEST_PORT:-}" ]; then
    # This host is shared and port 4173 is regularly held by an unrelated
    # preview server; playwright.config.ci.js sets reuseExistingServer: false,
    # so a held port fails the run outright. Let the kernel hand us a free
    # port instead — CI pins the port explicitly through the env var.
    PLAYWRIGHT_TEST_PORT="$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
    echo "e2e preview port (auto-selected): ${PLAYWRIGHT_TEST_PORT}"
  fi
  PLAYWRIGHT_TEST_PORT="$PLAYWRIGHT_TEST_PORT" npm run test:e2e
fi

echo "definition of done: PASS"
