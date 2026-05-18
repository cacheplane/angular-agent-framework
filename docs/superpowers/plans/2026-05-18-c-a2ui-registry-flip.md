# c-a2ui capability-registry flip — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch `c-a2ui` from the umbrella to its already-built per-cap LLM-driven backend at `cockpit/chat/a2ui/python/`, by editing one `pythonDir` value in `apps/cockpit/scripts/capability-registry.ts`. Completes the per-cap migration phase — after this, all 11 c-* caps are on per-cap backends for local dev.

**Architecture:** Same mechanical pattern as PR #413 (Tier A), PR #417 (c-generative-ui), and PR #421 (c-interrupts registry flip). One-line registry edit + verification gates. SDK turn exchange stays at "graph runs cleanly" level — full A2UI surface-event validation is out of scope (separate aimock spec later).

**Tech Stack:** TypeScript (registry), Python 3.12 + uv (per-cap backend), LangGraph 1.x (multi-node graph with `Command` routing + structured-output via gpt-5), Pydantic (schema validation + retry), `langgraph_sdk` HTTP API.

---

## Pre-flight notes (READ FIRST)

**Spec branch:** `claude/c-a2ui-registry-flip-spec` (commit `977b0039`, off origin/main).

**Working tree.** Create the implementation branch off the spec branch + rebase onto latest origin/main:

```bash
git fetch origin
git checkout -b claude/c-a2ui-registry-flip claude/c-a2ui-registry-flip-spec
git rebase origin/main
```

**Pre-flight verified during plan-write (2026-05-18):**
- `cockpit/chat/a2ui/python/src/graph.py` (673 lines) — multi-node LLM-driven graph: build_form → search_flights → confirm_booking. Uses gpt-5 + Pydantic for structured output, with retry on `ValidationError`. Inlines a 5-flight `_FLIGHTS` subset + `_AsyncFn` shim.
- `cockpit/chat/a2ui/python/langgraph.json` — registers exactly `c-a2ui`.
- `cockpit/chat/a2ui/python/prompts/a2ui.md` — present.
- `cockpit/chat/a2ui/angular/proxy.conf.json` — targets `localhost:5511`.
- `diff cockpit/langgraph/streaming/python/src/a2ui_graph.py cockpit/chat/a2ui/python/src/graph.py` shows only 45 lines of intentional drift (data plumbing).

**Hard rules.**
- Only Task 1 produces a commit. All other tasks are no-commit verification gates.
- Never `git add -A` or `git add .` — stage specific paths only.
- Never push, open PR, or `--amend` (Task 7 = orchestrator).
- Never skip hooks.
- STOP and report if ANY verification step fails first-run.

**Shared-checkout chaos.** Parallel agents may switch the working tree mid-task. After any long-running step, confirm `git branch --show-current` matches `claude/c-a2ui-registry-flip`.

**OPENAI_API_KEY.** Required for Tasks 3 + 4 (graph constructs an LLM client at import time, plus the SDK turn hits real OpenAI). Source from `examples/chat/python/.env`, `cockpit/chat/a2ui/python/.env`, or `cockpit/langgraph/streaming/python/.env`.

**Heavy step.** Task 4 may hit gpt-5 once (~10-30s; structured-output call for build_form). Task 5 runs 3 cockpit aimock e2es (~5 min combined).

---

## File Structure

**Modified:** `apps/cockpit/scripts/capability-registry.ts` — 1 line.

**Untouched:** all of `cockpit/chat/a2ui/` (already complete) and `cockpit/langgraph/streaming/python/` (umbrella stays put).

---

## Task 0: Pre-flight verify (no commit)

- [ ] **Step 1: Confirm per-cap dir has expected files**

```bash
for f in src/graph.py langgraph.json prompts/a2ui.md; do
  p="cockpit/chat/a2ui/python/$f"
  [ -f "$p" ] && echo "  ✓ $f" || echo "  ✗ MISSING $f"
done
```

Expected: 3 ✓ marks.

- [ ] **Step 2: Confirm graph.py has the LLM-driven design**

```bash
grep -nE 'def build_form|def search_flights|def confirm_booking|StateGraph\(MessagesState\)' cockpit/chat/a2ui/python/src/graph.py | head -8
```

Expected: at least 4 matches — the three node functions + the StateGraph construction.

- [ ] **Step 3: Confirm drift vs umbrella is small + bounded**

```bash
diff cockpit/langgraph/streaming/python/src/a2ui_graph.py cockpit/chat/a2ui/python/src/graph.py | wc -l
```

Expected: `45` (or a number close to it, within ~10). If it's significantly larger (say >100), STOP — the per-cap may have diverged from the umbrella in ways the spec didn't anticipate.

- [ ] **Step 4: Confirm registry currently points c-a2ui at umbrella**

```bash
grep "id: 'c-a2ui'" apps/cockpit/scripts/capability-registry.ts
```

Expected: one line containing `pythonDir: 'cockpit/langgraph/streaming/python'`. If it already points at `cockpit/chat/a2ui/python`, the flip is already done — STOP.

---

## Task 1: Flip the pythonDir in the registry

**Files:**
- Modify: `apps/cockpit/scripts/capability-registry.ts`

- [ ] **Step 1: Apply the edit**

```bash
sed -i '' "s|id: 'c-a2ui', product: 'chat', topic: 'a2ui', angularProject: 'cockpit-chat-a2ui-angular', port: 4511, pythonPort: 5511, pythonDir: 'cockpit/langgraph/streaming/python'|id: 'c-a2ui', product: 'chat', topic: 'a2ui', angularProject: 'cockpit-chat-a2ui-angular', port: 4511, pythonPort: 5511, pythonDir: 'cockpit/chat/a2ui/python'|" apps/cockpit/scripts/capability-registry.ts
```

- [ ] **Step 2: Verify file still parses + shows expected diff**

```bash
npx tsc --noEmit apps/cockpit/scripts/capability-registry.ts --skipLibCheck 2>&1 | tail -3
```

Expected: no errors. If tsc complains, the sed missed — revert with `git checkout HEAD -- apps/cockpit/scripts/capability-registry.ts` and STOP.

```bash
git diff apps/cockpit/scripts/capability-registry.ts
```

Expected: exactly one line changed, replacing `cockpit/langgraph/streaming/python` with `cockpit/chat/a2ui/python` on the `c-a2ui` row.

- [ ] **Step 3: Verify the cap now points at the per-cap dir**

```bash
grep "id: 'c-a2ui'" apps/cockpit/scripts/capability-registry.ts | grep -c 'cockpit/chat/a2ui/python'
```

Expected: `1`.

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/scripts/capability-registry.ts
git commit -m "$(cat <<'EOF'
feat(cockpit-registry): migrate c-a2ui to per-cap backend

Flip pythonDir from cockpit/langgraph/streaming/python (the umbrella)
to cockpit/chat/a2ui/python — the standalone backend with the
LLM-driven build_form → search_flights → confirm_booking graph.

Sub-project 5 of the per-cap migration chain (final cap migration).
After this lands, ALL 11 c-* caps are on per-cap backends for local
dev. Next: the final umbrella cleanup PR.

Local-dev-only — production deploy continues to serve from the
umbrella's a2ui_graph.py until the deploy-script extension PR.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Verify shared-deployment manifest is byte-identical (no commit)

- [ ] **Step 1: Snapshot AFTER (current branch)**

```bash
npx tsx scripts/generate-shared-deployment-config.ts 2>&1 | tail -2
python3 -c "import json; d=json.load(open('deployments/shared-dev/langgraph.json')); print('count=',len(d['graphs'])); print(sorted(d['graphs']))" > /tmp/ca2ui-after.txt
cat /tmp/ca2ui-after.txt
```

Expected: `count= 26` plus a sorted list including all c-* graphs.

- [ ] **Step 2: Snapshot BEFORE (revert the registry edit, regenerate, compare)**

```bash
git checkout HEAD~1 -- apps/cockpit/scripts/capability-registry.ts
npx tsx scripts/generate-shared-deployment-config.ts 2>&1 | tail -2
python3 -c "import json; d=json.load(open('deployments/shared-dev/langgraph.json')); print('count=',len(d['graphs'])); print(sorted(d['graphs']))" > /tmp/ca2ui-before.txt
git checkout HEAD -- apps/cockpit/scripts/capability-registry.ts
```

- [ ] **Step 3: Confirm IDENTICAL**

```bash
diff /tmp/ca2ui-before.txt /tmp/ca2ui-after.txt && echo "IDENTICAL"
```

Expected: `IDENTICAL`. If non-empty diff, STOP.

- [ ] **Step 4: Confirm c-a2ui deploy entrypoint still in umbrella**

```bash
python3 -c "
import json
d = json.load(open('deployments/shared-dev/langgraph.json'))
p = d['graphs'].get('c-a2ui', '<missing>')
print(f'c-a2ui: {p}')
print(f'  {\"OK (still umbrella — local-dev-only migration)\" if p.startswith(\"./deps/streaming/\") else \"UNEXPECTED\"}')
"
```

Expected: path starts with `./deps/streaming/src/a2ui_graph.py:graph`, marked `OK`.

- [ ] **Step 5: Cleanup**

```bash
rm -f /tmp/ca2ui-before.txt /tmp/ca2ui-after.txt
git checkout HEAD -- deployments/shared-dev/langgraph.json
git status --short
```

Expected: clean working tree (pre-existing untracked artifacts are fine).

---

## Task 3: Verify per-cap backend imports + boots (no commit)

- [ ] **Step 1: Source env + uv sync + import smoke**

```bash
set -a
source examples/chat/python/.env 2>/dev/null || source cockpit/chat/a2ui/python/.env 2>/dev/null || source cockpit/langgraph/streaming/python/.env 2>/dev/null
set +a
test -n "$OPENAI_API_KEY" && echo "key OK" || (echo "MISSING OPENAI_API_KEY — STOP"; exit 1)
```

```bash
(cd cockpit/chat/a2ui/python && uv sync 2>&1 | tail -2)
(cd cockpit/chat/a2ui/python && OPENAI_API_KEY="$OPENAI_API_KEY" uv run python -c "from src.graph import graph; print(type(graph).__name__)" 2>&1 | tail -2)
```

Expected: `key OK`, `Resolved … packages`, then `CompiledStateGraph`. Any traceback STOPs.

- [ ] **Step 2: Boot langgraph dev**

Free the port:

```bash
lsof -t -i :5511 2>/dev/null | xargs kill -9 2>/dev/null
```

Boot in background with explicit env passthrough (so `nohup`'s fresh shell inherits `OPENAI_API_KEY`):

```bash
(cd cockpit/chat/a2ui/python && nohup env OPENAI_API_KEY="$OPENAI_API_KEY" uv run langgraph dev --no-browser --host 127.0.0.1 --port 5511 > /tmp/ca2ui-lg.log 2>&1 &)
echo "started"
```

Wait for ready:

```bash
until grep -qE "Application started up" /tmp/ca2ui-lg.log 2>/dev/null; do sleep 1; done
echo READY
```

Inspect:

```bash
grep -E "graph_id|Importing graph" /tmp/ca2ui-lg.log | head -5
```

Expected: exactly one `graph_id=c-a2ui`, no traceback.

Keep langgraph dev RUNNING for Task 4.

---

## Task 4: SDK turn exchange (no commit)

Verifies the graph runs cleanly end-to-end. We don't assert on A2UI surface events here — that's out of scope (would belong in a future c-a2ui aimock spec).

- [ ] **Step 1: Write the verification script**

Save as `/tmp/ca2ui-turn-test.py`:

```python
"""Single-turn SDK exchange against the per-cap c-a2ui backend."""
import asyncio
import sys
from langgraph_sdk import get_client


async def main():
    client = get_client(url="http://127.0.0.1:5511")
    thread = await client.threads.create()
    tid = thread["thread_id"]
    print(f"thread: {tid}")

    print("=== Submitting 'Help me book a flight.' ===")
    run = await client.runs.create(
        thread_id=tid,
        assistant_id="c-a2ui",
        input={"messages": [{"role": "user", "content": "Help me book a flight."}]},
    )
    run_id = run["run_id"]

    # Poll for terminal status. A2UI surfaces may pause for user input, so
    # treat 'interrupted' as a valid stopping point too.
    status = ""
    for _ in range(120):
        status_data = await client.runs.get(thread_id=tid, run_id=run_id)
        status = status_data.get("status", "")
        if status in ("interrupted", "success", "error", "timeout"):
            break
        await asyncio.sleep(1)
    print(f"run terminal status: {status}")
    if status in ("error", "timeout"):
        print(f"FAIL: run did not reach a normal stopping point (status={status})")
        sys.exit(1)

    # Verify state has at least one message (graph advanced).
    state = await client.threads.get_state(tid)
    msgs = state.get("values", {}).get("messages", [])
    print(f"message count in state: {len(msgs)}")
    if len(msgs) == 0:
        print("FAIL: no messages in state — graph didn't advance")
        sys.exit(1)

    # Surface the message types for visibility (no assertion — A2UI emits
    # custom envelope events that aren't in messages[]).
    type_counts = {}
    for m in msgs:
        t = m.get("type", "?")
        type_counts[t] = type_counts.get(t, 0) + 1
    print(f"message types: {type_counts}")

    print("PASS: c-a2ui graph runs cleanly")


asyncio.run(main())
```

- [ ] **Step 2: Run it**

```bash
uv run --python 3.12 --with langgraph-sdk --with typing_extensions python /tmp/ca2ui-turn-test.py
```

Expected: `PASS: c-a2ui graph runs cleanly`, with terminal status `success` or `interrupted`, at least 1 message in state. If gpt-5 has transient issues, re-run once before reporting a real failure.

- [ ] **Step 3: Kill langgraph dev + cleanup**

```bash
lsof -t -i :5511 2>/dev/null | xargs kill -9 2>/dev/null
rm -f /tmp/ca2ui-lg.log /tmp/ca2ui-turn-test.py
```

---

## Task 5: Regression — existing cockpit e2es still pass (no commit)

- [ ] **Step 1: Run sequentially**

```bash
npx nx e2e cockpit-langgraph-streaming-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-tool-calls-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-subagents-angular --skip-nx-cache
```

Expected: all three pass. Combined runtime ~5 minutes.

If any fails, STOP. None touch a2ui; a failure would indicate an unrelated regression.

---

## Task 6: Final reverse audit (no commit)

- [ ] **Step 1: Confirm zero c-* caps still on umbrella**

```bash
grep -E "id: 'c-" apps/cockpit/scripts/capability-registry.ts | grep 'cockpit/langgraph/streaming/python' | awk -F"'" '{print $2}'
```

Expected: empty output (no lines).

- [ ] **Step 2: Confirm all 11 c-* caps on per-cap dirs**

```bash
grep -E "id: 'c-" apps/cockpit/scripts/capability-registry.ts | grep 'cockpit/chat/' | awk -F"'" '{print $2}' | sort
```

Expected: 11 lines — `c-a2ui, c-debug, c-generative-ui, c-input, c-interrupts, c-messages, c-subagents, c-theming, c-threads, c-timeline, c-tool-calls`.

- [ ] **Step 3: Confirm umbrella's a2ui_graph.py is untouched**

```bash
git diff origin/main -- cockpit/langgraph/streaming/python/src/a2ui_graph.py
```

Expected: empty.

---

## Task 7: Push, open PR, watch CI, merge

Orchestrator task. Implementer STOPS after Task 6.

- [ ] **Step 1: Push**

```bash
git push -u origin claude/c-a2ui-registry-flip
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(cockpit-registry): migrate c-a2ui to per-cap backend (last cap migration)" --body "$(cat <<'EOF'
## Summary
- Flip \`pythonDir\` for \`c-a2ui\` in \`apps/cockpit/scripts/capability-registry.ts\` from \`cockpit/langgraph/streaming/python\` (the umbrella) to \`cockpit/chat/a2ui/python\` — the standalone backend with the LLM-driven \`build_form → search_flights → confirm_booking\` graph.
- **Sub-project 5 of 6 in the per-cap migration chain — final cap migration.** After this lands, **all 11 c-* caps are on per-cap backends for local dev.** Next: the final umbrella cleanup PR.

## Scope
**Local-dev-only.** \`scripts/generate-shared-deployment-config.ts\` line 54 skips chat capabilities; production deploy continues to serve c-a2ui from the umbrella's \`a2ui_graph.py\` until the final umbrella cleanup re-routes deploys to per-cap.

## Test plan
- [x] Per-cap import smoke: \`from src.graph import graph\` returns \`CompiledStateGraph\`
- [x] \`langgraph dev\` boots with exactly \`c-a2ui\`, no traceback
- [x] SDK exchange: \"Help me book a flight.\" → terminal status (not error/timeout); state has \≥1 message
- [x] Shared-deployment manifest byte-identical before/after (deploy unchanged)
- [x] Zero c-* caps left on umbrella; all 11 on per-cap dirs
- [x] Umbrella's \`a2ui_graph.py\` untouched
- [x] \`nx e2e cockpit-langgraph-streaming-angular\`, \`cockpit-chat-tool-calls-angular\`, \`cockpit-chat-subagents-angular\` pass
- [ ] CI \`Cockpit — e2e\` + \`Cockpit — build all examples\` green

## Notes
A2UI surface-event validation (\`surfaceUpdate\` / \`dataModelUpdate\` / \`beginRendering\` envelope events) is out of scope for the migration. A future aimock spec for c-a2ui will cover that — separate sub-project after the umbrella cleanup completes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

```bash
gh pr checks <PR#>
```

- [ ] **Step 4: Merge on green**

```bash
gh pr merge <PR#> --squash --delete-branch
```

---

## Self-review notes

**Spec coverage:**
- Single code edit → Task 1.
- Pre-flight + drift audit → Task 0.
- Shared-deploy manifest byte-identical → Task 2.
- Per-cap backend imports + boots → Task 3.
- SDK turn exchange → Task 4.
- Regression → Task 5.
- Reverse audit (zero on umbrella) → Task 6.
- Acceptance: registry on per-cap → Task 1 Step 3, Task 6 Step 2.
- Acceptance: shared-deploy unchanged → Task 2.
- Acceptance: SDK turn exchange → Task 4.
- Acceptance: existing e2es pass → Task 5.
- Acceptance: umbrella untouched → Task 6 Step 3.

**Placeholder scan:** none. Every step has exact code or commands with expected output.

**Type consistency:** cap id `c-a2ui` consistent throughout. Port `5511` consistent in Tasks 2/3/4. Path `cockpit/chat/a2ui/python` consistent.

**Concurrency note:** pre-flight branch confirmation + Task 0 + clean-tree check at Task 2 Step 5 cover the parallel-agent risk.
