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
  PLAYWRIGHT_TEST_PORT="${PLAYWRIGHT_TEST_PORT:-4173}" npm run test:e2e
fi

echo "definition of done: PASS"
