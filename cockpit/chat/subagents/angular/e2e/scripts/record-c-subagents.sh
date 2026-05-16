#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# Capture a complete aimock fixture for the c-subagents graph by running the
# real langgraph dev server against aimock in --record mode. Captures every
# LLM call (orchestrator + each subagent's nested calls + tool-driven
# sub-rounds) at the HTTP layer.
#
# Why this shape (vs. direct Python LLM invocation): the c-subagents graph's
# `task` tool dispatches to subagent functions that run their own LLM-driven
# agent loops. Direct invocation only captures the orchestrator's calls;
# proxying through aimock captures every LLM call in the full graph.
#
# Run from repo root:
#   OPENAI_API_KEY=sk-... bash cockpit/chat/subagents/angular/e2e/scripts/record-c-subagents.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../../../.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  # Try .env (examples first, then streaming as fallback for worktrees)
  for env_path in examples/chat/python/.env cockpit/langgraph/streaming/python/.env; do
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
LANGGRAPH_PORT=8125
FIXTURE_OUT="cockpit/chat/subagents/angular/e2e/fixtures/c-subagents.json"
# Aimock --record writes per-request files into <fixtures-base>/recorded/.
# We hand it a dedicated staging dir, then merge all recorded entries into the
# single multi-turn fixture file consumed by the e2e harness.
RECORD_DIR="$(pwd)/cockpit/chat/subagents/angular/e2e/fixtures/.staging"
rm -rf "$RECORD_DIR"
mkdir -p "$RECORD_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Copy .env into the cockpit-streaming python project (gitignored).
# Use examples/.env when present; otherwise the streaming/.env already exists
# (worktree case where examples/.env hasn't been propagated).
mkdir -p cockpit/langgraph/streaming/python
if [[ -f "examples/chat/python/.env" ]]; then
  cp examples/chat/python/.env cockpit/langgraph/streaming/python/.env
fi

# 1. Start aimock in record mode
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

# Cleanup on exit
cleanup() {
  if [[ -n "${LG_PID:-}" ]]; then
    # Kill descendants first (uv → python → langgraph workers), then the parent
    pkill -P "$LG_PID" 2>/dev/null || true
    kill "$LG_PID" 2>/dev/null || true
  fi
  kill "$AIMOCK_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# Wait for aimock to be ready
for _ in {1..30}; do
  if curl -sf "http://127.0.0.1:$AIMOCK_PORT/health" > /dev/null 2>&1; then break; fi
  if curl -sf "http://127.0.0.1:$AIMOCK_PORT/" > /dev/null 2>&1; then break; fi
  sleep 1
done
echo "[record] aimock ready"

# 2. Start langgraph dev pointed at aimock
echo "[record] starting langgraph dev on :$LANGGRAPH_PORT (OPENAI_BASE_URL=http://127.0.0.1:$AIMOCK_PORT/v1)"
# setsid on Linux gives us a new process group for clean teardown; on macOS
# fall back to plain background — `pkill -P` later handles descendants.
if command -v setsid >/dev/null 2>&1; then
  RUN_PREFIX="setsid"
else
  RUN_PREFIX=""
fi
(
  cd cockpit/langgraph/streaming/python
  OPENAI_BASE_URL="http://127.0.0.1:$AIMOCK_PORT/v1" OPENAI_API_KEY="test-record" \
    exec $RUN_PREFIX uv run langgraph dev --port "$LANGGRAPH_PORT" --no-browser
) > "$TMP_DIR/langgraph.log" 2>&1 &
LG_PID=$!

# Wait for langgraph
for i in {1..60}; do
  if curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/ok" > /dev/null; then break; fi
  sleep 1
done
if ! curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/ok" > /dev/null; then
  echo "[record] langgraph failed to start; tail of log:" >&2
  tail -30 "$TMP_DIR/langgraph.log" >&2
  exit 2
fi
echo "[record] langgraph ready"

# 3. Submit a run via the LangGraph SDK HTTP API
THREAD=$(curl -sf -X POST "http://127.0.0.1:$LANGGRAPH_PORT/threads" -H 'content-type: application/json' -d '{}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["thread_id"])')
echo "[record] thread: $THREAD"
RUN=$(curl -sf -X POST "http://127.0.0.1:$LANGGRAPH_PORT/threads/$THREAD/runs" \
  -H 'content-type: application/json' \
  -d '{
    "assistant_id": "c-subagents",
    "input": {"messages": [{"role": "user", "content": "Plan a trip from LAX to JFK"}]}
  }' | python3 -c 'import sys,json; print(json.load(sys.stdin)["run_id"])')
echo "[record] run: $RUN"

# 4. Poll the run status (pending → running → success/error/timeout/interrupted)
echo "[record] waiting for run to complete (this hits real OpenAI; ~30-180s)..."
RUN_STATUS=""
for i in {1..180}; do
  RUN_STATUS=$(curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/threads/$THREAD/runs/$RUN" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
  case "$RUN_STATUS" in
    success|error|timeout|interrupted) break ;;
  esac
  sleep 2
done
echo "[record] final run status: $RUN_STATUS"
if [[ "$RUN_STATUS" != "success" ]]; then
  echo "[record] run did not succeed (status=$RUN_STATUS)" >&2
  echo "--- langgraph.log tail ---" >&2
  tail -80 "$TMP_DIR/langgraph.log" >&2
  echo "--- aimock.log tail ---" >&2
  tail -40 "$TMP_DIR/aimock.log" >&2
  exit 3
fi
MSG_COUNT=$(curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/threads/$THREAD/state" | python3 -c 'import sys,json; s=json.load(sys.stdin); print(len(s["values"].get("messages",[])))')
echo "[record] run complete; ${MSG_COUNT} messages in state"
if [[ "$MSG_COUNT" == "0" ]]; then
  echo "[record] run produced 0 messages — surfacing logs for debugging" >&2
  echo "--- langgraph.log tail ---" >&2
  tail -60 "$TMP_DIR/langgraph.log" >&2
  echo "--- aimock.log tail ---" >&2
  tail -60 "$TMP_DIR/aimock.log" >&2
  echo "--- run status ---" >&2
  curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/threads/$THREAD/runs/$RUN" >&2
  exit 5
fi

# 5. Give aimock a moment to flush per-request fixture files
sleep 2

# 6. Merge all recorded-* files in $RECORD_DIR/recorded/ into one fixtures.json
RECORDED_DIR="$RECORD_DIR/recorded"
if [[ ! -d "$RECORDED_DIR" ]]; then
  echo "[record] no recorded fixtures dir at $RECORDED_DIR" >&2
  echo "[record] aimock log tail:" >&2
  tail -40 "$TMP_DIR/aimock.log" >&2
  exit 4
fi
RECORDED_FILES=$(find "$RECORDED_DIR" -name "*.json" | wc -l | tr -d ' ')
echo "[record] $RECORDED_FILES recorded fixture files in $RECORDED_DIR"
python3 - <<PYEOF
import json, os, glob, sys
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

# Cleanup staging dir
rm -rf "$RECORD_DIR"

if [[ ! -s "$FIXTURE_OUT" ]]; then
  echo "[record] fixture file is missing or empty: $FIXTURE_OUT" >&2
  exit 4
fi
echo "[record] fixture written: $FIXTURE_OUT ($(wc -c < "$FIXTURE_OUT") bytes)"
ENTRY_COUNT=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(len(d.get("fixtures",[])))' "$FIXTURE_OUT")
echo "[record] $ENTRY_COUNT fixture entries"
