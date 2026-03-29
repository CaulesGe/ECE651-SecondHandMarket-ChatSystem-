#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
RESULT_DIR="$ROOT_DIR/test-results/$TIMESTAMP"
PLAYWRIGHT_CACHE_DIR="$ROOT_DIR/.cache/ms-playwright"
mkdir -p "$RESULT_DIR"
mkdir -p "$PLAYWRIGHT_CACHE_DIR"

export PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_CACHE_DIR"

PASS_COUNT=0
FAIL_COUNT=0

run_step() {
  local name="$1"
  local command="$2"
  local log_file="$RESULT_DIR/${name}.log"

  echo ""
  echo "========== $name =========="
  echo "Command: $command"
  echo "Log: $log_file"

  if (cd "$ROOT_DIR" && bash -lc "$command") >"$log_file" 2>&1; then
    echo "Result: PASS"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "Result: FAIL"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo "Project root: $ROOT_DIR"
echo "Result directory: $RESULT_DIR"
echo "Playwright cache: $PLAYWRIGHT_BROWSERS_PATH"

run_step "install_backend" "cd backend && npm install"
run_step "install_client" "cd client && npm install"
run_step "install_playwright_chromium" "cd client && npx playwright install chromium"
run_step "frontend_unit_tests" "npm run test:frontend"
run_step "backend_tests" "npm run test:backend"
run_step "frontend_e2e_tests" "npm run test:e2e"

SUMMARY_FILE="$RESULT_DIR/summary.txt"
{
  echo "Test run timestamp: $TIMESTAMP"
  echo "Pass: $PASS_COUNT"
  echo "Fail: $FAIL_COUNT"
  echo "Logs:"
  ls -1 "$RESULT_DIR" | sed 's/^/  - /'
} >"$SUMMARY_FILE"

echo ""
echo "========== SUMMARY =========="
cat "$SUMMARY_FILE"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi

exit 0
