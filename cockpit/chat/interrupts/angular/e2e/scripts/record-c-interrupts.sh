#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# Capture aimock fixtures for the c-interrupts graph by running the standalone
# langgraph dev server against aimock in --record mode. Drives TWO booking
# flows in sequence so the recorded fixture covers both confirm and cancel
# resume paths.
#
# Run from repo root:
#   OPENAI_API_KEY=sk-... bash cockpit/chat/interrupts/angular/e2e/scripts/record-c-interrupts.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../../../.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  for env_path in examples/chat/python/.env cockpit/chat/interrupts/python/.env; do
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

AIMOCK_PORT=19999
LANGGRAPH_PORT=5503
FIXTURE_OUT="cockpit/chat/interrupts/angular/e2e/fixtures/c-interrupts.json"
RECORD_DIR="$(pwd)/cockpit/chat/interrupts/angular/e2e/fixtures/.staging"
rm -rf "$RECORD_DIR"
mkdir -p "$RECORD_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -f "examples/chat/python/.env" ]]; then
  cp examples/chat/python/.env cockpit/chat/interrupts/python/.env
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
  cd cockpit/chat/interrupts/python
  OPENAI_BASE_URL="http://127.0.0.1:$AIMOCK_PORT/v1" OPENAI_API_KEY="test-record" \
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

# Helper: drive one full booking flow (prompt → interrupt → resume → final).
drive_flow() {
  local prompt="$1"
  local resume_value="$2"
  local label="$3"

  echo "[record][$label] thread + run with prompt: $prompt"
  local thread
  thread=$(curl -sf -X POST "http://127.0.0.1:$LANGGRAPH_PORT/threads" \
    -H 'content-type: application/json' -d '{}' \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["thread_id"])')
  local run
  run=$(curl -sf -X POST "http://127.0.0.1:$LANGGRAPH_PORT/threads/$thread/runs" \
    -H 'content-type: application/json' \
    -d "{\"assistant_id\": \"c-interrupts\", \"input\": {\"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}]}}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["run_id"])')
  echo "[record][$label] thread=$thread run=$run; polling for interrupt"

  local status=""
  for _ in {1..120}; do
    status=$(curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/threads/$thread/runs/$run" \
      | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
    case "$status" in
      interrupted|success|error|timeout) break ;;
    esac
    sleep 2
  done
  if [[ "$status" != "interrupted" ]]; then
    echo "[record][$label] expected interrupted, got: $status" >&2
    tail -40 "$TMP_DIR/langgraph.log" >&2
    exit 3
  fi
  echo "[record][$label] interrupted; posting resume=$resume_value"

  local resume_run
  resume_run=$(curl -sf -X POST "http://127.0.0.1:$LANGGRAPH_PORT/threads/$thread/runs" \
    -H 'content-type: application/json' \
    -d "{\"assistant_id\": \"c-interrupts\", \"command\": {\"resume\": \"$resume_value\"}}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["run_id"])')

  status=""
  for _ in {1..120}; do
    status=$(curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/threads/$thread/runs/$resume_run" \
      | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
    case "$status" in
      success|error|timeout|interrupted) break ;;
    esac
    sleep 2
  done
  if [[ "$status" != "success" ]]; then
    echo "[record][$label] resume run did not succeed (status=$status)" >&2
    tail -40 "$TMP_DIR/langgraph.log" >&2
    exit 4
  fi
  echo "[record][$label] resume run succeeded"
}

drive_flow "Book me on UA123." "confirm" "confirm"
drive_flow "Book me on AA404." "cancel"  "cancel"

# Give aimock a moment to flush per-request fixture files.
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
