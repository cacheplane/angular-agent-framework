#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# Capture aimock fixtures for the c-generative-ui graph by running the
# standalone langgraph dev server against aimock in --record mode. Drives
# two prompts (one per welcome chip) so the recorded fixture covers the
# dashboard + filter flows.
#
# Run from repo root:
#   OPENAI_API_KEY=sk-... bash cockpit/chat/generative-ui/angular/e2e/scripts/record-c-generative-ui.sh
#
# Adapted from cockpit/chat/interrupts/angular/e2e/scripts/record-c-interrupts.sh
# without the interrupt-resume logic — generative-ui flows are normal
# tool_call → tool_result → text continuation runs.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../../../.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  for env_path in examples/chat/python/.env cockpit/chat/generative-ui/python/.env; do
    if [[ -f "$env_path" ]]; then
      set -a; source "$env_path"; set +a
      break
    fi
  done
fi
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "OPENAI_API_KEY not set (in env or examples/chat/python/.env)" >&2
  exit 1
fi

AIMOCK_PORT=19998
LANGGRAPH_PORT=5511
FIXTURE_OUT="cockpit/chat/generative-ui/angular/e2e/fixtures/c-generative-ui.json"
RECORD_DIR="$(pwd)/cockpit/chat/generative-ui/angular/e2e/fixtures/.staging"
rm -rf "$RECORD_DIR"
mkdir -p "$RECORD_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -f "examples/chat/python/.env" ]]; then
  cp examples/chat/python/.env cockpit/chat/generative-ui/python/.env
fi

echo "[record] starting aimock --record on :$AIMOCK_PORT"
mkdir -p "$(dirname "$FIXTURE_OUT")"
npx -y -p @copilotkit/aimock llmock \
  --port "$AIMOCK_PORT" \
  --record \
  --provider-openai https://api.openai.com \
  --fixtures "$RECORD_DIR" \
  --chunk-size 4096 \
  > "$TMP_DIR/aimock.log" 2>&1 &
AIMOCK_PID=$!

cleanup() {
  if [[ -n "${LG_PID:-}" ]]; then
    pkill -P "$LG_PID" 2>/dev/null || true
    kill "$LG_PID" 2>/dev/null || true
  fi
  kill "$AIMOCK_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

for _ in {1..30}; do
  if curl -sf "http://127.0.0.1:$AIMOCK_PORT/health" > /dev/null 2>&1; then break; fi
  if curl -sf "http://127.0.0.1:$AIMOCK_PORT/" > /dev/null 2>&1; then break; fi
  sleep 1
done
echo "[record] aimock ready"

echo "[record] starting langgraph dev on :$LANGGRAPH_PORT (OPENAI_BASE_URL=http://127.0.0.1:$AIMOCK_PORT/v1)"
if command -v setsid >/dev/null 2>&1; then
  RUN_PREFIX="setsid"
else
  RUN_PREFIX=""
fi
(
  cd cockpit/chat/generative-ui/python
  OPENAI_BASE_URL="http://127.0.0.1:$AIMOCK_PORT/v1" OPENAI_API_KEY="$OPENAI_API_KEY" \
    exec $RUN_PREFIX uv run langgraph dev --port "$LANGGRAPH_PORT" --no-browser
) > "$TMP_DIR/langgraph.log" 2>&1 &
LG_PID=$!

for _ in {1..60}; do
  if curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/ok" > /dev/null; then break; fi
  sleep 1
done
if ! curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/ok" > /dev/null; then
  echo "[record] langgraph failed to start; tail of log:" >&2
  tail -30 "$TMP_DIR/langgraph.log" >&2
  exit 2
fi
echo "[record] langgraph ready"

# Helper: drive one prompt to completion (no interrupt; normal tool_call/
# continuation cycle handled within the run).
drive_prompt() {
  local prompt="$1"
  local label="$2"

  echo "[record][$label] thread + run with prompt: $prompt"
  local thread
  thread=$(curl -sf -X POST "http://127.0.0.1:$LANGGRAPH_PORT/threads" \
    -H 'content-type: application/json' -d '{}' \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["thread_id"])')
  local run
  run=$(curl -sf -X POST "http://127.0.0.1:$LANGGRAPH_PORT/threads/$thread/runs" \
    -H 'content-type: application/json' \
    -d "{\"assistant_id\": \"c-generative-ui\", \"input\": {\"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}]}}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["run_id"])')
  echo "[record][$label] thread=$thread run=$run; polling for completion"

  local status=""
  for _ in {1..120}; do
    status=$(curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/threads/$thread/runs/$run" \
      | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
    case "$status" in
      success|error|timeout|interrupted) break ;;
    esac
    sleep 2
  done
  if [[ "$status" != "success" ]]; then
    echo "[record][$label] run did not reach success (status=$status)" >&2
    tail -40 "$TMP_DIR/langgraph.log" >&2
    exit 3
  fi
  echo "[record][$label] run succeeded"
}

# Welcome-chip prompts from generative-ui.component.ts.
drive_prompt "Show me a dashboard of airline operations." "dashboard"
drive_prompt "Filter to only the cancelled flights." "filter"

sleep 2

RECORDED_DIR="$RECORD_DIR/recorded"
if [[ ! -d "$RECORDED_DIR" ]]; then
  echo "[record] no recorded fixtures dir at $RECORDED_DIR" >&2
  tail -40 "$TMP_DIR/aimock.log" >&2
  exit 5
fi
RECORDED_FILES=$(find "$RECORDED_DIR" -name "*.json" | wc -l | tr -d ' ')
echo "[record] $RECORDED_FILES recorded fixture files in $RECORDED_DIR"

python3 - <<PYEOF
import json, os, glob
recorded = sorted(glob.glob(os.path.join(r"$RECORDED_DIR", "*.json")))
merged = {"fixtures": []}
for f in recorded:
    with open(f) as fh:
        data = json.load(fh)
    merged["fixtures"].extend(data.get("fixtures", []))
with open(r"$FIXTURE_OUT", "w") as fh:
    json.dump(merged, fh, indent=2)
print(f"[record] merged {len(merged['fixtures'])} entries into $FIXTURE_OUT")
PYEOF

rm -rf "$RECORD_DIR"

if [[ ! -s "$FIXTURE_OUT" ]]; then
  echo "[record] fixture file is missing or empty: $FIXTURE_OUT" >&2
  exit 6
fi
echo "[record] fixture written: $FIXTURE_OUT ($(wc -c < "$FIXTURE_OUT") bytes)"
ENTRY_COUNT=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(len(d.get("fixtures",[])))' "$FIXTURE_OUT")
echo "[record] $ENTRY_COUNT fixture entries"
