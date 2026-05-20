#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# Re-record every aimock fixture in the cockpit suite.
#
# Walks cockpit/*/*/angular/e2e/fixtures/<cap>.json, looks up the cap's
# expected prompts (defaulting to "Hello"), and runs the appropriate
# recorder per cap:
#
#   - c-interrupts: delegates to its special-case interrupt-resume script.
#   - All others:   uses the generic scripts/record-aimock-cap.sh.
#
# Use when a backend system prompt or tool definition changes and you
# need to refresh every cap's recorded fixture to match.
#
# Run from repo root:
#   OPENAI_API_KEY=sk-... bash scripts/rerecord-all-aimock.sh
#
# Review diffs after with:
#   git diff cockpit/*/*/angular/e2e/fixtures/
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  for env_path in examples/chat/python/.env; do
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

# Per-cap prompts. Caps not listed here default to "Hello". Multi-prompt
# caps separate prompts with '|' (recorded as separate fixture entries).
declare -A CAP_PROMPTS=(
  ["c-tool-calls"]="What's the status of UA123?"
  ["c-subagents"]="Plan a trip from LAX to JFK"
  ["c-generative-ui"]="Show me a dashboard of airline operations.|Filter to only the cancelled flights."
  ["c-a2ui"]="I want to fly LAX to JFK|I want to fly SFO to SEA"
  ["streaming"]="Tell me one quick fact about Angular signals in two sentences."
)

# Discover aimock-eligible caps by walking fixture files. Excludes
# documented-N/A caps (render, ag-ui, c-debug) which have no fixtures.
CAPS=()
while IFS= read -r f; do
  cap_id=$(basename "$f" .json)
  # Skip staging artifacts left by interrupted runs.
  [[ "$f" == *".staging"* ]] && continue
  CAPS+=("$cap_id")
done < <(find cockpit -path "*/angular/e2e/fixtures/*.json" -not -path "*.staging*" | sort)

echo "Re-recording ${#CAPS[@]} caps..."
echo
FAILED=()
for cap in "${CAPS[@]}"; do
  if [[ "$cap" == "c-interrupts" ]]; then
    echo "=== $cap (special: delegating to interrupt-resume recorder) ==="
    if ! bash cockpit/chat/interrupts/angular/e2e/scripts/record-c-interrupts.sh; then
      FAILED+=("$cap")
    fi
    echo
    continue
  fi

  prompt="${CAP_PROMPTS[$cap]:-Hello}"
  IFS='|' read -ra PROMPTS <<< "$prompt"
  echo "=== $cap (prompts: ${#PROMPTS[@]}) ==="
  if ! bash scripts/record-aimock-cap.sh "$cap" "${PROMPTS[@]}"; then
    FAILED+=("$cap")
  fi
  echo
done

if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "FAILED caps (${#FAILED[@]}): ${FAILED[*]}" >&2
  exit 1
fi

echo "Done. Review fixture diffs with: git diff cockpit/*/*/angular/e2e/fixtures/"
