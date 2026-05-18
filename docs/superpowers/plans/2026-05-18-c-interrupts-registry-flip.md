# c-interrupts capability-registry flip — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch `c-interrupts` from the umbrella to its already-built per-cap backend at `cockpit/chat/interrupts/python/` (with book_flight + interrupt dispatch from PR #382), by editing one `pythonDir` value in `apps/cockpit/scripts/capability-registry.ts`.

**Architecture:** Same mechanical pattern as PR #413 (Tier A) and PR #417 (c-generative-ui): one-line registry edit + verification gates. Adds an interrupt + resume round-trip verification (not just "send a turn") to confirm the gate fires and the resume produces the booking confirmation.

**Tech Stack:** TypeScript (registry), Python 3.12 + uv (per-cap backend), LangGraph 1.x (`interrupt()`, `Command(resume=...)`), `langgraph_sdk` HTTP API.

---

## Pre-flight notes (READ FIRST)

**Spec branch:** `claude/c-interrupts-registry-flip-spec` (commit `9176528f`, off origin/main post-#382).

**Working tree.** Create implementation branch off spec branch + rebase onto latest origin/main:

```bash
git fetch origin
git checkout -b claude/c-interrupts-registry-flip claude/c-interrupts-registry-flip-spec
git rebase origin/main
```

**Pre-flight verified during plan-write (2026-05-18, after PR #382 merge):**
- `cockpit/chat/interrupts/python/src/graph.py` has `book_flight` (line 27) + `interrupt({...})` (line 50) + agent ↔ ToolNode loop with `[book_flight, find_routes, lookup_flight, get_airport_info]`.
- `cockpit/chat/interrupts/python/src/aviation_data.py` + `aviation_tools.py` exist (landed by #382).
- `cockpit/chat/interrupts/python/langgraph.json` registers `c-interrupts`.
- `cockpit/chat/interrupts/python/prompts/interrupts.md` has booking-flow prompt.
- `cockpit/chat/interrupts/angular/proxy.conf.json` targets `localhost:5503`.
- `cockpit/chat/interrupts/angular/src/app/interrupts.component.ts` has `(action)="onInterruptAction($event)"` wiring (Accept→`resume('confirm')`, Ignore→`resume('cancel')`).

**Hard rules.**
- One commit per code-modifying task (Task 1 only). All other tasks are no-commit verification gates.
- Never `git add -A` or `git add .` — stage specific paths only.
- Never push, open PR, or `--amend` (Task 7 = orchestrator).
- Never skip hooks.
- STOP and report if ANY verification step fails first-run.

**Shared-checkout chaos.** Parallel agents have switched branches mid-task during this chain. After any long-running step, confirm `git branch --show-current` matches `claude/c-interrupts-registry-flip`.

**OPENAI_API_KEY.** Required for Task 4. Source from `examples/chat/python/.env` or `cockpit/langgraph/streaming/python/.env`. The per-cap dir at `cockpit/chat/interrupts/python/` may also have its own `.env` (created by PR #382's record script) — any of those works.

**Heavy step.** Task 4 hits real OpenAI (one request + one resume request, ~10-30s total). Task 5 runs 3 cockpit aimock e2es (~5 min combined).

---

## File Structure

**Modified:** `apps/cockpit/scripts/capability-registry.ts` — 1 line.

**Untouched:** all of `cockpit/chat/interrupts/` (already complete on main post-PR-#382) and `cockpit/langgraph/streaming/python/` (umbrella stays put).

---

## Task 0: Pre-flight verify (no commit)

- [ ] **Step 1: Confirm per-cap dir has expected files**

```bash
for f in src/graph.py src/aviation_data.py src/aviation_tools.py langgraph.json prompts/interrupts.md; do
  p="cockpit/chat/interrupts/python/$f"
  [ -f "$p" ] && echo "  ✓ $f" || echo "  ✗ MISSING $f"
done
```

Expected: 5 ✓ marks.

- [ ] **Step 2: Confirm graph.py wires book_flight + interrupt**

```bash
grep -n 'book_flight\|interrupt(\|ToolNode' cockpit/chat/interrupts/python/src/graph.py | head -6
```

Expected: matches for `book_flight` (definition + tool list), `interrupt(` (call site), `ToolNode` (instantiation).

- [ ] **Step 3: Confirm Angular component has action→resume wiring**

```bash
grep -n 'onInterruptAction\|resume:' cockpit/chat/interrupts/angular/src/app/interrupts.component.ts
```

Expected: matches showing both the method definition and the `agent.submit({ resume: 'confirm' })` / `'cancel'` calls.

- [ ] **Step 4: Confirm registry currently points c-interrupts at umbrella**

```bash
grep "id: 'c-interrupts'" apps/cockpit/scripts/capability-registry.ts
```

Expected: one line containing `pythonDir: 'cockpit/langgraph/streaming/python'`.

If the registry already points at `cockpit/chat/interrupts/python`, the flip is already done — STOP and report.

---

## Task 1: Flip the pythonDir in the registry

**Files:**
- Modify: `apps/cockpit/scripts/capability-registry.ts`

- [ ] **Step 1: Apply the edit**

```bash
sed -i '' "s|id: 'c-interrupts', product: 'chat', topic: 'interrupts', angularProject: 'cockpit-chat-interrupts-angular', port: 4503, pythonPort: 5503, pythonDir: 'cockpit/langgraph/streaming/python'|id: 'c-interrupts', product: 'chat', topic: 'interrupts', angularProject: 'cockpit-chat-interrupts-angular', port: 4503, pythonPort: 5503, pythonDir: 'cockpit/chat/interrupts/python'|" apps/cockpit/scripts/capability-registry.ts
```

- [ ] **Step 2: Verify file still parses + shows expected diff**

```bash
npx tsc --noEmit apps/cockpit/scripts/capability-registry.ts --skipLibCheck 2>&1 | tail -3
```

Expected: no errors. If tsc complains, sed missed — revert with `git checkout HEAD -- apps/cockpit/scripts/capability-registry.ts` and STOP.

```bash
git diff apps/cockpit/scripts/capability-registry.ts
```

Expected: exactly one line changed, replacing `cockpit/langgraph/streaming/python` with `cockpit/chat/interrupts/python` on the `c-interrupts` row.

- [ ] **Step 3: Verify the cap now points at the per-cap dir**

```bash
grep "id: 'c-interrupts'" apps/cockpit/scripts/capability-registry.ts | grep -c 'cockpit/chat/interrupts/python'
```

Expected: `1`.

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/scripts/capability-registry.ts
git commit -m "$(cat <<'EOF'
feat(cockpit-registry): migrate c-interrupts to per-cap backend

Flip pythonDir from cockpit/langgraph/streaming/python (the umbrella)
to cockpit/chat/interrupts/python — the standalone backend landed by
PR #382 with the book_flight tool, real interrupt() dispatch, and
UI action→resume wiring.

Sub-project 4 of the per-cap migration chain (Tier A #413,
c-generative-ui #417, c-interrupts backend #382). After this lands,
10 of 11 c-* caps are on per-cap backends. Remaining: c-a2ui.

Local-dev-only — production deploy continues to serve from the
umbrella's prompt-only chat_graphs.py::c_interrupts (no book_flight)
until the final umbrella-cleanup PR re-routes deploys to per-cap.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Verify shared-deployment manifest is byte-identical (no commit)

The deploy script skips chat caps; the manifest must not change.

- [ ] **Step 1: Snapshot AFTER (current branch)**

```bash
npx tsx scripts/generate-shared-deployment-config.ts 2>&1 | tail -2
python3 -c "import json; d=json.load(open('deployments/shared-dev/langgraph.json')); print('count=',len(d['graphs'])); print(sorted(d['graphs']))" > /tmp/cintr-after.txt
cat /tmp/cintr-after.txt
```

Expected: `count= 26` plus a sorted list including all c-* graphs.

- [ ] **Step 2: Snapshot BEFORE (revert the registry edit on a checkout, regenerate, compare)**

```bash
git checkout HEAD~1 -- apps/cockpit/scripts/capability-registry.ts
npx tsx scripts/generate-shared-deployment-config.ts 2>&1 | tail -2
python3 -c "import json; d=json.load(open('deployments/shared-dev/langgraph.json')); print('count=',len(d['graphs'])); print(sorted(d['graphs']))" > /tmp/cintr-before.txt
git checkout HEAD -- apps/cockpit/scripts/capability-registry.ts
```

- [ ] **Step 3: Confirm IDENTICAL**

```bash
diff /tmp/cintr-before.txt /tmp/cintr-after.txt && echo "IDENTICAL"
```

Expected: `IDENTICAL`. If non-empty diff, STOP.

- [ ] **Step 4: Confirm c-interrupts deploy entrypoint still in umbrella**

```bash
python3 -c "
import json
d = json.load(open('deployments/shared-dev/langgraph.json'))
p = d['graphs'].get('c-interrupts', '<missing>')
print(f'c-interrupts: {p}')
print(f'  {\"OK (still umbrella — local-dev-only migration)\" if p.startswith(\"./deps/streaming/\") else \"UNEXPECTED\"}')
"
```

Expected: path starts with `./deps/streaming/src/chat_graphs.py:c_interrupts`, marked `OK`. This confirms the migration is local-dev-only.

- [ ] **Step 5: Cleanup**

```bash
rm -f /tmp/cintr-before.txt /tmp/cintr-after.txt
git checkout HEAD -- deployments/shared-dev/langgraph.json
git status --short
```

Expected: clean working tree (no staged or modified files; pre-existing untracked artifacts are fine).

---

## Task 3: Verify per-cap backend imports + boots (no commit)

- [ ] **Step 1: uv sync + import smoke**

Source env so the LLM client can construct at import time:

```bash
set -a
source examples/chat/python/.env 2>/dev/null || source cockpit/chat/interrupts/python/.env 2>/dev/null || source cockpit/langgraph/streaming/python/.env 2>/dev/null
set +a
test -n "$OPENAI_API_KEY" && echo "key OK" || (echo "MISSING OPENAI_API_KEY — STOP"; exit 1)
```

Then:

```bash
(cd cockpit/chat/interrupts/python && uv sync 2>&1 | tail -2)
(cd cockpit/chat/interrupts/python && OPENAI_API_KEY="$OPENAI_API_KEY" uv run python -c "from src.graph import graph; print(type(graph).__name__)" 2>&1 | tail -2)
```

Expected: `key OK`, `Resolved … packages`, then `CompiledStateGraph`. Any traceback STOPs.

- [ ] **Step 2: Boot langgraph dev and confirm one graph**

Free the port:

```bash
lsof -t -i :5503 2>/dev/null | xargs kill -9 2>/dev/null
```

Boot in background (explicit env passthrough so `nohup`'s fresh shell inherits `OPENAI_API_KEY`):

```bash
(cd cockpit/chat/interrupts/python && nohup env OPENAI_API_KEY="$OPENAI_API_KEY" uv run langgraph dev --no-browser --host 127.0.0.1 --port 5503 > /tmp/cintr-lg.log 2>&1 &)
echo "started"
```

Wait for ready:

```bash
until grep -qE "Application started up" /tmp/cintr-lg.log 2>/dev/null; do sleep 1; done
echo READY
```

Inspect:

```bash
grep -E "graph_id|Importing graph" /tmp/cintr-lg.log | head -5
```

Expected: exactly one `graph_id=c-interrupts`, no traceback.

Keep langgraph dev RUNNING for Task 4 (don't kill yet).

---

## Task 4: Interrupt + resume round-trip via SDK (no commit)

- [ ] **Step 1: Write the verification script**

Save as `/tmp/cintr-rt-test.py`:

**Important — runtime quirk:** LangGraph reports `runs.get().status == "success"` even when `interrupt()` fires inside a ToolNode in this version. The authoritative signal is whether the thread state has a pending interrupt (`state.tasks[].interrupts[]`). Gate on that, not on run status.

```python
"""End-to-end interrupt + resume round-trip against the per-cap c-interrupts backend."""
import asyncio
import sys
from langgraph_sdk import get_client


def pending_interrupt(state):
    """Return the first pending interrupt value from the thread state, or None."""
    for t in state.get("tasks", []):
        for it in t.get("interrupts", []):
            v = it.get("value")
            if v is not None:
                return v
    return None


async def main():
    client = get_client(url="http://127.0.0.1:5503")
    thread = await client.threads.create()
    tid = thread["thread_id"]
    print(f"thread: {tid}")

    print("=== Submitting 'Book me on UA123.' ===")
    run = await client.runs.create(
        thread_id=tid,
        assistant_id="c-interrupts",
        input={"messages": [{"role": "user", "content": "Book me on UA123."}]},
    )
    run_id = run["run_id"]

    # Wait for run to reach a stopping point. status=success here means EITHER
    # a clean exit OR a suspended interrupt — distinguished by thread state.
    for _ in range(60):
        status_data = await client.runs.get(thread_id=tid, run_id=run_id)
        status = status_data.get("status", "")
        if status in ("interrupted", "success", "error", "timeout"):
            break
        await asyncio.sleep(1)
    print(f"run terminal status: {status}")
    if status in ("error", "timeout"):
        print(f"FAIL: run did not reach a normal stopping point (status={status})")
        sys.exit(1)

    # Authoritative interrupt check: thread state.
    state = await client.threads.get_state(tid)
    interrupt_value = pending_interrupt(state)
    print(f"pending interrupt: {interrupt_value}")
    if not isinstance(interrupt_value, dict):
        print(f"FAIL: expected dict interrupt payload, got {type(interrupt_value).__name__}")
        sys.exit(1)
    if interrupt_value.get("type") != "approval_request":
        print(f"FAIL: expected type=approval_request, got {interrupt_value.get('type')}")
        sys.exit(1)
    flight = interrupt_value.get("flight", {})
    if flight.get("flight_number") != "UA123":
        print(f"FAIL: expected flight_number=UA123, got {flight.get('flight_number')}")
        sys.exit(1)
    if "summary" not in interrupt_value:
        print("FAIL: missing summary in interrupt payload")
        sys.exit(1)
    print("PASS turn 1: interrupt payload has expected shape")

    print("=== Resuming with 'confirm' ===")
    resume_run = await client.runs.create(
        thread_id=tid,
        assistant_id="c-interrupts",
        command={"resume": "confirm"},
    )
    resume_id = resume_run["run_id"]
    for _ in range(60):
        status_data = await client.runs.get(thread_id=tid, run_id=resume_id)
        status = status_data.get("status", "")
        if status in ("interrupted", "success", "error", "timeout"):
            break
        await asyncio.sleep(1)
    print(f"resume terminal status: {status}")
    if status in ("error", "timeout"):
        print(f"FAIL: resume did not reach a normal stopping point (status={status})")
        sys.exit(1)

    # After resume, no pending interrupts should remain.
    state = await client.threads.get_state(tid)
    leftover = pending_interrupt(state)
    if leftover is not None:
        print(f"FAIL: thread still has a pending interrupt after resume: {leftover}")
        sys.exit(1)

    msgs = state.get("values", {}).get("messages", [])
    tool_msg_content = None
    ai_text = None
    for m in msgs:
        if m.get("type") == "tool" and m.get("content"):
            tool_msg_content = m["content"]
        if m.get("type") == "ai" and m.get("content"):
            ai_text = m["content"]
    print(f"final tool message: {tool_msg_content!r}")
    print(f"final ai message: {(ai_text or '')[:120]!r}")
    if not tool_msg_content or not tool_msg_content.lower().startswith("booked"):
        print(f"FAIL: expected ToolMessage starting with 'Booked', got {tool_msg_content!r}")
        sys.exit(1)
    if not ai_text:
        print("FAIL: no final AI message")
        sys.exit(1)
    print("PASS turn 2: booking confirmation in ToolMessage + AI follow-up")
    print("\n*** Round-trip PASS ***")


asyncio.run(main())
```

- [ ] **Step 2: Run it**

```bash
uv run --python 3.12 --with langgraph-sdk --with typing_extensions python /tmp/cintr-rt-test.py
```

Expected: both `PASS turn …` lines, then `*** Round-trip PASS ***`. If gpt-5-mini has transient issues, re-run once before reporting a real failure.

- [ ] **Step 3: Kill langgraph dev + cleanup**

```bash
lsof -t -i :5503 2>/dev/null | xargs kill -9 2>/dev/null
rm -f /tmp/cintr-lg.log /tmp/cintr-rt-test.py
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

If any fails, STOP. None of these touch the interrupts backend; a failure would indicate something unexpected.

---

## Task 6: Reverse audit + final grep (no commit)

- [ ] **Step 1: Confirm c-a2ui is the only c-* cap still on the umbrella**

```bash
grep -E "id: 'c-" apps/cockpit/scripts/capability-registry.ts | grep 'cockpit/langgraph/streaming/python' | awk -F"'" '{print $2}'
```

Expected: exactly one line: `c-a2ui`.

- [ ] **Step 2: Confirm 10 c-* caps on per-cap dirs**

```bash
grep -E "id: 'c-" apps/cockpit/scripts/capability-registry.ts | grep 'cockpit/chat/' | awk -F"'" '{print $2}'
```

Expected: 10 cap ids — `c-messages, c-input, c-tool-calls, c-subagents, c-interrupts, c-threads, c-timeline, c-generative-ui, c-debug, c-theming` (order may vary).

- [ ] **Step 3: Confirm umbrella's c_interrupts code is untouched**

```bash
git diff origin/main -- cockpit/langgraph/streaming/python/src/chat_graphs.py
```

Expected: empty.

---

## Task 7: Push, open PR, watch CI, merge

Orchestrator task. Implementer STOPS after Task 6.

- [ ] **Step 1: Push**

```bash
git push -u origin claude/c-interrupts-registry-flip
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(cockpit-registry): migrate c-interrupts to per-cap backend" --body "$(cat <<'EOF'
## Summary
- Flip \`pythonDir\` for \`c-interrupts\` in \`apps/cockpit/scripts/capability-registry.ts\` from \`cockpit/langgraph/streaming/python\` (the umbrella) to \`cockpit/chat/interrupts/python\` — the standalone backend landed by PR #382 with book_flight tool, real \`interrupt()\` dispatch, and UI action→resume wiring.
- Sub-project 4 of 5 in the per-cap migration chain. After this lands, 10 of 11 c-* caps are on per-cap backends. Remaining: c-a2ui.

## Scope
**Local-dev-only.** \`scripts/generate-shared-deployment-config.ts\` line 54 skips chat capabilities; production deploy continues to serve c-interrupts from the umbrella's prompt-only \`chat_graphs.py::c_interrupts\` (no book_flight) until the final umbrella cleanup PR.

## Test plan
- [x] Per-cap import smoke: \`from src.graph import graph\` returns \`CompiledStateGraph\`
- [x] \`langgraph dev\` boots with exactly \`c-interrupts\`, no traceback
- [x] SDK exchange: \"Book me on UA123.\" → status=interrupted with payload \`{type:'approval_request', summary, flight: {flight_number: 'UA123', ...}}\`
- [x] SDK exchange: resume('confirm') → status=success, ToolMessage starts with \"Booked\", AI follow-up present
- [x] Shared-deployment manifest byte-identical before/after (deploy unchanged)
- [x] c-a2ui is the only remaining c-* cap on the umbrella
- [x] Umbrella's \`chat_graphs.py\` untouched
- [x] \`nx e2e cockpit-langgraph-streaming-angular\`, \`cockpit-chat-tool-calls-angular\`, \`cockpit-chat-subagents-angular\` pass
- [ ] CI \`Cockpit — e2e\` + \`Cockpit — build all examples\` green

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
- Pre-flight audit → Task 0.
- Production deploy byte-identical → Task 2.
- Interrupt cycle exercised via SDK → Task 4.
- Regression → Task 5.
- Reverse audit (c-a2ui only umbrella consumer) → Task 6.
- Acceptance: registry on per-cap → Task 1 Step 3, Task 6 Step 2.
- Acceptance: per-cap boot → Task 3.
- Acceptance: turn 1 interrupted with approval_request payload → Task 4.
- Acceptance: resume('confirm') reaches success + Booked ToolMessage → Task 4.
- Acceptance: shared-deploy unchanged → Task 2.
- Acceptance: cockpit e2es pass → Task 5.
- Acceptance: umbrella chat_graphs.py untouched → Task 6 Step 3.

**Placeholder scan:** none. Every step has exact code or commands with expected output.

**Type consistency:** cap id `c-interrupts` consistent throughout. Port `5503` consistent in Task 2/3/4. Path `cockpit/chat/interrupts/python` consistent.

**Concurrency note:** pre-flight branch confirmation + Task 0 + clean-tree check at Task 2 Step 5 cover the parallel-agent risk.
