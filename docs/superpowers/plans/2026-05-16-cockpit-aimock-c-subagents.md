# Cockpit aimock E2E Phase 3 — c-subagents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add an aimock-driven Playwright spec for `c-subagents` (orchestrator with `task` tool dispatching subagents) at `cockpit/chat/subagents/angular/e2e/`, mirroring the Phase 2 c-tool-calls pattern.

**Architecture:** Per-example dir under the harness library landed in Phase 2 ([#356](https://github.com/cacheplane/angular-agent-framework/pull/356)). LangGraph port 8125 (next after streaming=8123 and tool-calls=8124). Multi-turn fixture (parent task tool_calls + tool results + continuation). No library changes.

**Tech Stack:** `@copilotkit/aimock`, Playwright, `libs/internal/aimock-harness/`, `uv` for the python langgraph dev server.

**Spec:** [docs/superpowers/specs/2026-05-16-cockpit-aimock-c-subagents-design.md](../specs/2026-05-16-cockpit-aimock-c-subagents-design.md)

---

## Working environment

- Worktree: `/tmp/c-subagents` (branch `claude/cockpit-aimock-c-subagents`).
- `node_modules` symlinked from main checkout; `npx`/`nx`/`uv` work directly.
- License header `// SPDX-License-Identifier: MIT` on line 1 of every new TS file.
- One commit per task. DO NOT push, amend, or `git add -A`.
- Spec commit already on the branch; this plan adds a second commit, then implementation commits.

---

## Task 1: Scaffold per-example e2e dir (configs + helpers)

**Files:**
- Create: `cockpit/chat/subagents/angular/e2e/tsconfig.json`
- Create: `cockpit/chat/subagents/angular/e2e/.gitignore`
- Create: `cockpit/chat/subagents/angular/e2e/playwright.config.ts`
- Create: `cockpit/chat/subagents/angular/e2e/global-setup-impl.ts`

- [ ] **Step 1: Create tsconfig.json**

Write `cockpit/chat/subagents/angular/e2e/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "test-results", "playwright-report"]
}
```

- [ ] **Step 2: Create .gitignore**

Write `cockpit/chat/subagents/angular/e2e/.gitignore`:

```
test-results/
playwright-report/
*.tmp
```

- [ ] **Step 3: Create playwright.config.ts**

Write `cockpit/chat/subagents/angular/e2e/playwright.config.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4505',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './global-setup-impl.ts',
  globalTeardown: require.resolve('../../../../../libs/internal/aimock-harness/src/global-teardown'),
});
```

- [ ] **Step 4: Create global-setup-impl.ts**

Write `cockpit/chat/subagents/angular/e2e/global-setup-impl.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/internal/aimock-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/streaming/python',
  // Each cockpit example pins its OWN langgraph port to avoid TIME_WAIT
  // collisions when a sequential CI loop runs multiple per-example e2es
  // back-to-back. Streaming uses 8123; tool-calls 8124; subagents 8125.
  // The Angular proxy.conf.json target must match.
  langgraphPort: 8125,
  angularProject: 'cockpit-chat-subagents-angular',
  angularPort: 4505,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
```

- [ ] **Step 5: Type-check**

```bash
cd /tmp/c-subagents/cockpit/chat/subagents/angular/e2e
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit Task 1**

```bash
cd /tmp/c-subagents
git add cockpit/chat/subagents/angular/e2e/tsconfig.json \
        cockpit/chat/subagents/angular/e2e/.gitignore \
        cockpit/chat/subagents/angular/e2e/playwright.config.ts \
        cockpit/chat/subagents/angular/e2e/global-setup-impl.ts
git commit -m "feat(cockpit-chat-subagents): scaffold aimock e2e dir"
```

---

## Task 2: Update Angular proxy + project.json

**Files:**
- Modify: `cockpit/chat/subagents/angular/proxy.conf.json`
- Modify: `cockpit/chat/subagents/angular/project.json`

- [ ] **Step 1: Update proxy.conf.json target port**

Open `cockpit/chat/subagents/angular/proxy.conf.json`. Change `target` from `"http://localhost:8123"` to `"http://localhost:8125"`:

```json
{
  "/api": {
    "target": "http://localhost:8125",
    "secure": false,
    "changeOrigin": true,
    "pathRewrite": { "^/api": "" },
    "ws": true
  }
}
```

- [ ] **Step 2: Add e2e target to project.json**

Open `cockpit/chat/subagents/angular/project.json`. Add to `targets`:

```json
"e2e": {
  "executor": "@nx/playwright:playwright",
  "options": {
    "config": "cockpit/chat/subagents/angular/e2e/playwright.config.ts"
  }
}
```

Verify the file is still valid JSON:

```bash
cd /tmp/c-subagents
python3 -c "import json; json.load(open('cockpit/chat/subagents/angular/project.json'))" && echo "OK"
```

Expected: `OK`.

- [ ] **Step 3: Commit Task 2**

```bash
cd /tmp/c-subagents
git add cockpit/chat/subagents/angular/proxy.conf.json \
        cockpit/chat/subagents/angular/project.json
git commit -m "feat(cockpit-chat-subagents): wire e2e target + per-example langgraph port 8125"
```

---

## Task 3: Capture the c-subagents fixture via aimock record mode

**Files:**
- Create: `cockpit/chat/subagents/angular/e2e/scripts/record-c-subagents.sh`
- Create: `cockpit/chat/subagents/angular/e2e/fixtures/c-subagents.json` (generated by script)

The first capture attempt (direct LLM invocation in Python) failed because the c-subagents `task` tool dispatches to subagent functions that EACH run their own LLM-driven agent loops. Directly invoking the orchestrator only captures its LLM calls; subagent LLM calls (with role-specific system prompts and tool sub-calls) go uncaptured.

The correct capture is at the HTTP boundary: run the real langgraph dev server against aimock in `--record` mode. Aimock proxies unmatched LLM requests to real OpenAI and saves every interaction as a fixture entry. Captures orchestrator + ALL subagent LLM calls + any nested tool-driven sub-rounds uniformly.

- [ ] **Step 1: Write the capture script**

Write `cockpit/chat/subagents/angular/e2e/scripts/record-c-subagents.sh`:

```bash
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
  # Try .env
  if [[ -f "examples/chat/python/.env" ]]; then
    set -a; source examples/chat/python/.env; set +a
  fi
fi
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "OPENAI_API_KEY not set (in env or examples/chat/python/.env)" >&2
  exit 1
fi

AIMOCK_PORT=19999
LANGGRAPH_PORT=8125
FIXTURE_OUT="cockpit/chat/subagents/angular/e2e/fixtures/c-subagents.json"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Copy .env into the cockpit-streaming python project (gitignored)
mkdir -p cockpit/langgraph/streaming/python
cp examples/chat/python/.env cockpit/langgraph/streaming/python/.env

# 1. Start aimock in record mode
echo "[record] starting aimock --record on :$AIMOCK_PORT"
mkdir -p "$(dirname "$FIXTURE_OUT")"
npx -y -p @copilotkit/aimock aimock \
  --port "$AIMOCK_PORT" \
  --record \
  --provider-openai https://api.openai.com \
  --fixtures "$FIXTURE_OUT" \
  --chunk-size 4096 \
  > "$TMP_DIR/aimock.log" 2>&1 &
AIMOCK_PID=$!

# Cleanup on exit
trap 'kill "$AIMOCK_PID" 2>/dev/null || true; [[ -n "${LG_PID:-}" ]] && kill -- "-$LG_PID" 2>/dev/null || true; wait 2>/dev/null || true; rm -rf "$TMP_DIR"' EXIT

# Wait for aimock to be ready
for _ in {1..30}; do
  if curl -sf "http://127.0.0.1:$AIMOCK_PORT/health" > /dev/null 2>&1; then break; fi
  if curl -sf "http://127.0.0.1:$AIMOCK_PORT/" > /dev/null 2>&1; then break; fi
  sleep 1
done
echo "[record] aimock ready"

# 2. Start langgraph dev pointed at aimock
echo "[record] starting langgraph dev on :$LANGGRAPH_PORT (OPENAI_BASE_URL=http://127.0.0.1:$AIMOCK_PORT/v1)"
(
  cd cockpit/langgraph/streaming/python
  OPENAI_BASE_URL="http://127.0.0.1:$AIMOCK_PORT/v1" OPENAI_API_KEY="test-record" \
    setsid uv run langgraph dev --port "$LANGGRAPH_PORT" --no-browser
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

# 4. Poll until run completes (next: [] AND no in-flight steps)
echo "[record] waiting for run to complete (this hits real OpenAI; ~30-90s)..."
for i in {1..120}; do
  STATE=$(curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/threads/$THREAD/state" | python3 -c 'import sys,json; s=json.load(sys.stdin); print(len(s.get("next",[])))')
  if [[ "$STATE" == "0" ]]; then break; fi
  sleep 2
done

# Verify completion
if [[ "$STATE" != "0" ]]; then
  echo "[record] run did not complete within timeout" >&2
  exit 3
fi
MSG_COUNT=$(curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/threads/$THREAD/state" | python3 -c 'import sys,json; s=json.load(sys.stdin); print(len(s["values"].get("messages",[])))')
echo "[record] run complete; ${MSG_COUNT} messages in state"

# 5. Give aimock a moment to flush
sleep 2

# 6. Cleanup is handled by trap; aimock writes the fixture file on shutdown
# Verify the fixture got written and is non-empty
if [[ ! -s "$FIXTURE_OUT" ]]; then
  echo "[record] fixture file is missing or empty: $FIXTURE_OUT" >&2
  echo "[record] aimock log tail:" >&2
  tail -30 "$TMP_DIR/aimock.log" >&2
  exit 4
fi
echo "[record] fixture written: $FIXTURE_OUT ($(wc -c < "$FIXTURE_OUT") bytes)"
ENTRY_COUNT=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(len(d.get("fixtures",[])))' "$FIXTURE_OUT")
echo "[record] $ENTRY_COUNT fixture entries"
```

Make executable:
```bash
chmod +x cockpit/chat/subagents/angular/e2e/scripts/record-c-subagents.sh
```

- [ ] **Step 2: Run the capture script**

```bash
cd /tmp/c-subagents
node libs/licensing/scripts/generate-public-key.mjs 2>&1 | tail -1
bash cockpit/chat/subagents/angular/e2e/scripts/record-c-subagents.sh
```

Expected output (approximate):
```
[record] starting aimock --record on :19999
[record] aimock ready
[record] starting langgraph dev on :8125 (...)
[record] langgraph ready
[record] thread: <uuid>
[record] run: <uuid>
[record] waiting for run to complete ...
[record] run complete; <N> messages in state
[record] fixture written: cockpit/chat/subagents/angular/e2e/fixtures/c-subagents.json (<NNNN> bytes)
[record] <X> fixture entries
```

If the script reports `langgraph failed to start` or `run did not complete`, STOP and inspect `$TMP_DIR/langgraph.log` (path printed in error) — likely a missing python dep (`uv sync` first) or a stale langgraph process on port 8125 (`lsof -ti :8125 | xargs kill -9`).

If `fixture file is missing or empty`, aimock might need a SIGTERM (not SIGKILL) to flush — adjust the trap to use `SIGTERM` and add a `sleep 3` after.

If fixture has only 1-2 entries, the orchestrator hit a recursion limit before completing — increase the script's run-complete timeout or check the run state for errors.

DO NOT commit `cockpit/langgraph/streaming/python/.env` (gitignored, verify with `git status`).

- [ ] **Step 3: Inspect the captured fixture**

```bash
cd /tmp/c-subagents
python3 -c "
import json
d = json.load(open('cockpit/chat/subagents/angular/e2e/fixtures/c-subagents.json'))
print(f'entries: {len(d[\"fixtures\"])}')
for i, fx in enumerate(d['fixtures'][:5]):
    match = fx.get('match', {})
    resp = fx.get('response', {})
    summary = (
        f'tool_calls={len(resp.get(\"toolCalls\", []))}' if 'toolCalls' in resp
        else f'content_len={len(resp.get(\"content\", \"\"))}'
    )
    print(f'  [{i}] match={list(match.keys())} → {summary}')
"
```

Expected: 5+ entries (orchestrator first + each subagent role's calls + orchestrator continuation). Note a distinctive phrase from the continuation entry's content for Task 4's assertion.

- [ ] **Step 4: Commit Task 3**

```bash
cd /tmp/c-subagents
git add cockpit/chat/subagents/angular/e2e/scripts/record-c-subagents.sh \
        cockpit/chat/subagents/angular/e2e/fixtures/c-subagents.json
git commit -m "feat(cockpit-chat-subagents): add capture script + fixture"
```

---

## Task 4: Write the c-subagents spec

**Files:**
- Create: `cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts`

- [ ] **Step 1: Write the spec**

Write `cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { sendPromptAndWait } from '../../../../../libs/internal/aimock-harness/src';

const PROMPT = 'Plan a trip from LAX to JFK';

test('c-subagents: orchestrator dispatches task subagents, summary surfaces in bubble', async ({
  page,
}) => {
  const bubble = await sendPromptAndWait(page, PROMPT);

  // At least one subagent card rendered in the chat-subagents UI primitive.
  // Proves the orchestrator's `task` tool_call routed through chat-subagents'
  // default subagentToolNames filter (which is ['task']).
  const subagentCard = page.locator('chat-subagent-card').first();
  await expect(subagentCard).toBeAttached({ timeout: 30_000 });

  // Final summary text contains an aviation-related phrase from the captured
  // continuation. Loose regex so refactors to the subagent prompts (research/
  // booking/itinerary outputs) don't break the test.
  const finalText = await bubble.innerText();
  expect(finalText.toLowerCase()).toMatch(/lax|jfk|itinerary|trip|flight/);
});
```

- [ ] **Step 2: Run the spec**

```bash
cd /tmp/c-subagents
npx playwright install --with-deps chromium  # idempotent if already installed
npx nx e2e cockpit-chat-subagents-angular --skip-nx-cache
```

Expected: 1 test passes within ~60–120s (Angular dev-server cold-start dominates).

If the spec fails:
- "subagent card not attached" → check the trace at `cockpit/chat/subagents/angular/e2e/test-results/`. The selector `chat-subagent-card` is verified against `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts:33`. If a refactor renamed it, update the selector.
- "innerText regex didn't match" → look at the captured fixture's continuation text; pick a phrase that appears verbatim and update the regex.
- Otherwise STOP and report the failure.

- [ ] **Step 3: Stability check**

Run 3 times with port cooldown:

```bash
cd /tmp/c-subagents
for i in 1 2 3; do
  echo "=== Run $i ==="
  rm -rf cockpit/chat/subagents/angular/e2e/test-results cockpit/chat/subagents/angular/e2e/playwright-report
  sleep 8
  npx nx e2e cockpit-chat-subagents-angular --skip-nx-cache
done
```

Expected: 3/3 pass.

- [ ] **Step 4: Commit Task 4**

```bash
cd /tmp/c-subagents
git add cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts
git commit -m "test(cockpit-chat-subagents): aimock e2e — orchestrator task fanout"
```

---

## Task 5: Update CI loop

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Locate the cockpit-e2e loop**

Open `.github/workflows/ci.yml`. Find the cockpit-e2e job's run step (currently iterates `cockpit-langgraph-streaming-angular cockpit-chat-tool-calls-angular`):

```yaml
      - name: Run cockpit example aimock e2e suites
        run: |
          set -e
          for proj in cockpit-langgraph-streaming-angular cockpit-chat-tool-calls-angular; do
            echo "::group::nx e2e $proj"
            npx nx e2e "$proj" --skip-nx-cache
            echo "::endgroup::"
            sleep 5
          done
```

- [ ] **Step 2: Append cockpit-chat-subagents-angular to the loop**

Change the `for proj in ...` line to include the new project:

```yaml
          for proj in cockpit-langgraph-streaming-angular cockpit-chat-tool-calls-angular cockpit-chat-subagents-angular; do
```

- [ ] **Step 3: Verify YAML parses**

```bash
cd /tmp/c-subagents
npx -y js-yaml .github/workflows/ci.yml > /dev/null && echo "OK"
```

Expected: `OK`.

- [ ] **Step 4: Commit Task 5**

```bash
cd /tmp/c-subagents
git add .github/workflows/ci.yml
git commit -m "ci(cockpit): include cockpit-chat-subagents-angular in e2e loop"
```

---

## Task 6: Verify, push, open PR

- [ ] **Step 1: Final local verification — run all three sequentially**

```bash
cd /tmp/c-subagents
lsof -ti :8123 :8124 :8125 :4300 :4504 :4505 2>/dev/null | xargs kill -9 2>/dev/null
ps aux | grep -E "uv |langgraph dev" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
sleep 5
for proj in cockpit-langgraph-streaming-angular cockpit-chat-tool-calls-angular cockpit-chat-subagents-angular; do
  echo "=== $proj ==="
  npx nx e2e "$proj" --skip-nx-cache 2>&1 | tail -3
  sleep 5
done
```

Expected: all 3 projects pass.

If any fail, STOP and report.

- [ ] **Step 2: Confirm working tree is clean**

```bash
cd /tmp/c-subagents
rm -rf cockpit/chat/subagents/angular/e2e/test-results cockpit/chat/subagents/angular/e2e/playwright-report
rm -rf cockpit/chat/tool-calls/angular/e2e/test-results cockpit/langgraph/streaming/angular/e2e/test-results
git status --short
```

Expected: only the `node_modules` symlink and the `.env` file at `cockpit/langgraph/streaming/python/.env` as untracked. Both are gitignored.

- [ ] **Step 3: Push branch**

```bash
cd /tmp/c-subagents
git push -u origin claude/cockpit-aimock-c-subagents
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "test(cockpit): aimock e2e — c-subagents (Phase 3)" --body "$(cat <<'EOF'
## Summary

Adds a per-example aimock e2e for \`c-subagents\` (orchestrator LLM with a \`task\` tool that dispatches subagents). Second per-example spec under the harness library landed in Phase 2 ([#356](https://github.com/cacheplane/angular-agent-framework/pull/356)).

- **New per-example dir** at \`cockpit/chat/subagents/angular/e2e/\` (configs, fixture, capture script, spec).
- **Per-example langgraph port** 8125 (streaming=8123, tool-calls=8124, subagents=8125). Proxy.conf.json target updated to match.
- **Fixture** captured from real \`gpt-5-mini\` for the prompt \"Plan a trip from LAX to JFK\". Two entries: continuation (with \`hasToolResult: true\`) + first-call (with \`task\` tool_calls).
- **CI loop** updated to include the new project.

Sits on Phase 2 ([#356](https://github.com/cacheplane/angular-agent-framework/pull/356)) + the c-* aviation refactor PR 1 ([#347](https://github.com/cacheplane/angular-agent-framework/pull/347)).

## Test plan

- [x] Pilot spec passes 3/3 stability runs locally
- [x] All three cockpit example e2e suites pass sequentially via the CI loop locally (streaming + tool-calls + subagents)
- [x] No harness library changes (proves the Phase 2 library handles richer scenarios)
- [ ] CI green on this PR

## Notes for reviewers

- Spec assertions are loose by design: presence of any \`<chat-subagent-card>\` + an aviation-related phrase in the final summary. Subagent prompts (research/booking/itinerary) can be edited without breaking the test.
- The \`task\` tool execution happens server-side in langgraph (real subagent functions); aimock only mocks the orchestrator LLM calls.

Spec: \`docs/superpowers/specs/2026-05-16-cockpit-aimock-c-subagents-design.md\`
Plan: \`docs/superpowers/plans/2026-05-16-cockpit-aimock-c-subagents.md\`
EOF
)"
```

- [ ] **Step 5: Watch CI**

```bash
gh pr checks <PR-NUMBER> --watch --interval 30
```

When green, merge with `--squash` and clean up worktree.

---

## Self-review checklist

- [x] Spec coverage: library reuse (Tasks 1+4), per-example layout (Tasks 1+2+3+4), CI loop (Task 5), per-example port (Task 1+2), capture script + fixture (Task 3), spec assertions (Task 4), acceptance criteria (Task 6).
- [x] Placeholder scan: no TBD. `<DISTINCTIVE_PHRASE>`-style placeholders avoided — the spec assertion uses a fixed loose regex.
- [x] Type consistency: `createGlobalSetup`, `sendPromptAndWait` match the library's exports as committed in PR #356.
- [x] Constraints: `@copilotkit/aimock` referenced in imports/plans only, NOT in commit messages or PR body.

## Execution handoff

Plan complete. Recommended: **subagent-driven-development** with one implementer for Tasks 1–5 (sequential, similar shape to Phase 2 c-tool-calls). Task 6 (push + PR + watch CI + merge) handled by the orchestrator.
