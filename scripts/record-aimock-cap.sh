#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# Generic aimock fixture recorder for a single cockpit cap.
# Reads cap metadata from apps/cockpit/scripts/capability-registry.ts via tsx,
# drives one or more prompts through aimock --record mode, merges captured
# fixtures into the cap's e2e/fixtures/<id>.json.
#
# Usage:
#   OPENAI_API_KEY=sk-... bash scripts/record-aimock-cap.sh <cap-id> "<prompt1>" ["<prompt2>" ...]
#
# Example:
#   OPENAI_API_KEY=sk-... bash scripts/record-aimock-cap.sh persistence "Hello"
#
# Throwaway tool. Delete after the langgraph batch lands.
set -euo pipefail

CAP_ID="${1:?cap id required as first arg}"
shift
if [[ $# -eq 0 ]]; then
  echo "Error: at least one prompt required" >&2
  exit 1
fi
PROMPTS=("$@")

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Look up cap metadata via the registry.
read -r CAP_PRODUCT CAP_TOPIC CAP_GRAPH CAP_PORT CAP_PYPORT CAP_PYDIR < <(npx tsx -e "
import { capabilities } from './apps/cockpit/scripts/capability-registry';
const c = capabilities.find(x => x.id === '$CAP_ID');
if (!c) { console.error('cap not found: $CAP_ID'); process.exit(1); }
if (!c.pythonDir || c.pythonPort === undefined) { console.error('cap missing pythonDir/pythonPort'); process.exit(1); }
console.log(c.product, c.topic, c.graphName, c.port, c.pythonPort, c.pythonDir);
")

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  for env_path in examples/chat/python/.env "$CAP_PYDIR/.env"; do
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

AIMOCK_PORT=$((19000 + RANDOM % 900))
LANGGRAPH_PORT="$CAP_PYPORT"
FIXTURE_OUT="cockpit/$CAP_PRODUCT/$CAP_TOPIC/angular/e2e/fixtures/${CAP_ID}.json"
RECORD_DIR="$(pwd)/cockpit/$CAP_PRODUCT/$CAP_TOPIC/angular/e2e/fixtures/.staging"
rm -rf "$RECORD_DIR"
mkdir -p "$RECORD_DIR" "$(dirname "$FIXTURE_OUT")"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -f "examples/chat/python/.env" && ! -f "$CAP_PYDIR/.env" ]]; then
  cp examples/chat/python/.env "$CAP_PYDIR/.env"
fi

# Free the ports if anything still listens (prior aborted record).
for p in "$AIMOCK_PORT" "$LANGGRAPH_PORT"; do
  pid=$(lsof -ti:$p 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    kill -9 $pid 2>/dev/null || true
    sleep 0.5
  fi
done

echo "[record] starting aimock --record on :$AIMOCK_PORT for $CAP_ID"
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
  if curl -sf "http://127.0.0.1:$AIMOCK_PORT/health" > /dev/null 2>&1 \
    || curl -sf "http://127.0.0.1:$AIMOCK_PORT/" > /dev/null 2>&1; then break; fi
  sleep 1
done
echo "[record] aimock ready"

echo "[record] starting langgraph dev on :$LANGGRAPH_PORT"
RUN_PREFIX=""
if command -v setsid >/dev/null 2>&1; then RUN_PREFIX="setsid"; fi
(
  cd "$CAP_PYDIR"
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
echo "[record] langgraph ready (graph_id=$CAP_GRAPH)"

drive_prompt() {
  local prompt="$1"
  echo "[record][$prompt] thread + run"
  local thread run
  thread=$(curl -sf -X POST "http://127.0.0.1:$LANGGRAPH_PORT/threads" \
    -H 'content-type: application/json' -d '{}' \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["thread_id"])')
  run=$(curl -sf -X POST "http://127.0.0.1:$LANGGRAPH_PORT/threads/$thread/runs" \
    -H 'content-type: application/json' \
    -d "{\"assistant_id\": \"$CAP_GRAPH\", \"input\": {\"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}]}}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["run_id"])')
  local status=""
  for _ in {1..120}; do
    status=$(curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/threads/$thread/runs/$run" \
      | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
    case "$status" in
      success|error|timeout|interrupted) break ;;
    esac
    sleep 2
  done
  if [[ "$status" != "success" && "$status" != "interrupted" ]]; then
    echo "[record][$prompt] run reached unexpected status=$status" >&2
    tail -40 "$TMP_DIR/langgraph.log" >&2
    exit 3
  fi
  echo "[record][$prompt] status=$status"
}

for p in "${PROMPTS[@]}"; do
  drive_prompt "$p"
done

sleep 2

RECORDED_DIR="$RECORD_DIR/recorded"
if [[ ! -d "$RECORDED_DIR" ]]; then
  echo "[record] no recorded fixtures dir at $RECORDED_DIR" >&2
  tail -40 "$TMP_DIR/aimock.log" >&2
  exit 5
fi
N=$(find "$RECORDED_DIR" -name "*.json" | wc -l | tr -d ' ')
echo "[record] $N recorded files in $RECORDED_DIR"

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
echo "[record] done: $FIXTURE_OUT ($(wc -c < "$FIXTURE_OUT") bytes)"
