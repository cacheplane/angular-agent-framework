# c-generative-ui per-cap migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch `c-generative-ui` from consuming the umbrella `cockpit/langgraph/streaming/python/` to its already-built per-cap standalone backend at `cockpit/chat/generative-ui/python/`, by editing one `pythonDir` value in `apps/cockpit/scripts/capability-registry.ts`.

**Architecture:** Identical to Tier A migration (PR #413): one-line registry edit + heavier verification because the graph is multi-node (router → generate_shell / plan_tools → call_tools → emit_state → respond) and dispatches custom events via `get_stream_writer`. Local-dev-only — production deploy stays on umbrella until the deploy-script extension PR lands.

**Tech Stack:** TypeScript (registry), Python 3.12 + uv (per-cap backend), LangGraph 1.x (`get_stream_writer`, `ToolNode`, `Command`), `langgraph_sdk` HTTP API.

---

## Pre-flight notes (READ FIRST)

**Spec branch:** `claude/c-generative-ui-migration-spec` (commit `75b2fd36`, off origin/main).

**Working tree.** Create the implementation branch off the spec branch:

```bash
git fetch origin
git checkout -b claude/c-generative-ui-migration claude/c-generative-ui-migration-spec
git rebase origin/main
```

**Pre-flight verified during plan-write (2026-05-18):**
- `cockpit/chat/generative-ui/python/src/graph.py` uses `get_stream_writer` (lines 107, 136).
- Fixture constants (`KPI_SNAPSHOT`, `ON_TIME_TREND`, `FLIGHTS_BY_AIRLINE`, `RECENT_DISRUPTIONS`) are byte-identical between per-cap `dashboard_tools.py` and umbrella `aviation_data.py`.
- Per-cap `langgraph.json` registers exactly `c-generative-ui`.
- Per-cap `proxy.conf.json` targets `localhost:5508` (matches registry `pythonPort`).

**Hard rules.**
- One commit per code-modifying task (Task 1 only). All verification tasks (0, 2–7) are no-commit.
- Never `git add -A` or `git add .` — stage specific paths only.
- Never push, open PR, or `--amend` (Task 8 = orchestrator).
- Never skip hooks.
- STOP and report if ANY verification step fails first-run.

**Shared-checkout chaos.** Parallel agents switch branches on this checkout. After any long-running step, confirm `git branch --show-current` = `claude/c-generative-ui-migration` before continuing.

**Heavy steps.** Task 4 hits real OpenAI for two turns (~30–90s; uses gpt-5 + gpt-5-mini). Task 6 runs 3 existing cockpit e2e suites (~5 min).

---

## File Structure

**Modified:** `apps/cockpit/scripts/capability-registry.ts` — 1 line changed.

**Untouched** (all already correct):
- `cockpit/chat/generative-ui/python/src/graph.py` (176 lines, multi-node)
- `cockpit/chat/generative-ui/python/src/dashboard_tools.py` (117 lines, 4 `@tool` functions, inlined fixtures)
- `cockpit/chat/generative-ui/python/langgraph.json`
- `cockpit/chat/generative-ui/python/prompts/dashboard.md`
- `cockpit/chat/generative-ui/angular/proxy.conf.json` (targets 5508)
- `cockpit/chat/generative-ui/angular/src/environments/environment.development.ts`
- `cockpit/langgraph/streaming/python/...` (umbrella stays put)

---

## Task 0: Pre-flight verify (no commit)

Confirm the spec's pre-flight audits are still true on the branch.

- [ ] **Step 1: Confirm per-cap dir has expected files**

```bash
for f in src/graph.py src/dashboard_tools.py langgraph.json prompts/dashboard.md; do
  p="cockpit/chat/generative-ui/python/$f"
  [ -f "$p" ] && echo "  ✓ $f" || echo "  ✗ MISSING $f"
done
```

Expected: 4 ✓ marks.

- [ ] **Step 2: Confirm per-cap graph uses `get_stream_writer`**

```bash
grep -n 'get_stream_writer' cockpit/chat/generative-ui/python/src/graph.py
```

Expected: at least two matches (import + call site).

- [ ] **Step 3: Confirm fixture values match umbrella's `aviation_data.py`**

```bash
python3 -c "
import re
um = open('cockpit/langgraph/streaming/python/src/aviation_data.py').read()
pc = open('cockpit/chat/generative-ui/python/src/dashboard_tools.py').read()
ok = True
for sym in ['KPI_SNAPSHOT', 'ON_TIME_TREND', 'FLIGHTS_BY_AIRLINE', 'RECENT_DISRUPTIONS']:
    um_block = re.search(rf'{sym}\s*=\s*([\[\{{].*?[\]\}}])\s*(?:\n\n|\Z)', um, re.S)
    pc_block = re.search(rf'{sym}\s*=\s*([\[\{{].*?[\]\}}])\s*(?:\n\n|\Z)', pc, re.S)
    if not um_block or not pc_block:
        print(f'{sym}: missing in one side'); ok = False; continue
    same = um_block.group(1).strip() == pc_block.group(1).strip()
    print(f'{sym}: {\"identical\" if same else \"DIFFERS\"}'); ok = ok and same
import sys; sys.exit(0 if ok else 1)
"
```

Expected: 4 lines each `identical`, exit 0. If anything differs, STOP — the spec assumes byte-identical values.

- [ ] **Step 4: Confirm registry currently points c-generative-ui at the umbrella**

```bash
grep "id: 'c-generative-ui'" apps/cockpit/scripts/capability-registry.ts
```

Expected: one line containing `pythonDir: 'cockpit/langgraph/streaming/python'`.

---

## Task 1: Flip the `pythonDir` in the registry

**Files:**
- Modify: `apps/cockpit/scripts/capability-registry.ts`

- [ ] **Step 1: Apply the edit**

```bash
sed -i '' "s|id: 'c-generative-ui', product: 'chat', topic: 'generative-ui', angularProject: 'cockpit-chat-generative-ui-angular', port: 4508, pythonPort: 5508, pythonDir: 'cockpit/langgraph/streaming/python'|id: 'c-generative-ui', product: 'chat', topic: 'generative-ui', angularProject: 'cockpit-chat-generative-ui-angular', port: 4508, pythonPort: 5508, pythonDir: 'cockpit/chat/generative-ui/python'|" apps/cockpit/scripts/capability-registry.ts
```

- [ ] **Step 2: Verify the file still parses + shows expected diff**

```bash
npx tsc --noEmit apps/cockpit/scripts/capability-registry.ts 2>&1 | tail -5
```

Expected: no errors. If tsc complains, sed missed — revert with `git checkout HEAD -- apps/cockpit/scripts/capability-registry.ts` and STOP.

```bash
git diff apps/cockpit/scripts/capability-registry.ts
```

Expected: exactly one line changed, replacing `cockpit/langgraph/streaming/python` with `cockpit/chat/generative-ui/python` on the `c-generative-ui` row. No other changes.

- [ ] **Step 3: Verify the cap now points at the per-cap dir**

```bash
grep "id: 'c-generative-ui'" apps/cockpit/scripts/capability-registry.ts | grep -c 'cockpit/chat/generative-ui/python'
```

Expected: `1`.

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/scripts/capability-registry.ts
git commit -m "$(cat <<'EOF'
feat(cockpit-registry): migrate c-generative-ui to per-cap backend

Flip pythonDir from cockpit/langgraph/streaming/python (the umbrella)
to cockpit/chat/generative-ui/python. Per-cap backend was scaffolded
by PR #396 with the full multi-node graph (router → plan_tools →
call_tools → emit_state → respond), 4 KPI tools with inlined fixtures
(byte-identical to umbrella's aviation_data.py), and get_stream_writer
state emission (LangGraph 1.x).

Sub-project 3 of the per-cap migration chain (Tier A batch was #413,
c-interrupts in flight via #382). After this, 9 of 11 c-* caps are
on per-cap backends. Remaining: c-interrupts, c-a2ui.

Local-dev-only — production deploy continues to serve from the
umbrella's dashboard_graph.py until the deploy-script extension PR.

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
python3 -c "import json; d=json.load(open('deployments/shared-dev/langgraph.json')); print('count=',len(d['graphs'])); print(sorted(d['graphs']))" > /tmp/cgenui-after.txt
cat /tmp/cgenui-after.txt
```

Expected: `count= 26` with the same graph list as PR #413's post-merge state.

- [ ] **Step 2: Snapshot BEFORE (revert the registry edit, regenerate, compare)**

```bash
git stash push -m "cgenui-rebase-temp" -- apps/cockpit/scripts/capability-registry.ts 2>&1 | tail -3
# After stash, working tree has Task 1's commit reverted to working-dir state
# Actually stash doesn't revert commits; we need to checkout from prior commit
git checkout HEAD~1 -- apps/cockpit/scripts/capability-registry.ts
npx tsx scripts/generate-shared-deployment-config.ts 2>&1 | tail -2
python3 -c "import json; d=json.load(open('deployments/shared-dev/langgraph.json')); print('count=',len(d['graphs'])); print(sorted(d['graphs']))" > /tmp/cgenui-before.txt
# Restore the post-Task-1 file
git checkout HEAD -- apps/cockpit/scripts/capability-registry.ts
git stash drop 2>/dev/null || true
```

- [ ] **Step 3: Confirm graph names + count IDENTICAL**

```bash
diff /tmp/cgenui-before.txt /tmp/cgenui-after.txt && echo "IDENTICAL"
```

Expected: `IDENTICAL`. If non-empty diff, STOP and investigate.

- [ ] **Step 4: Confirm c-generative-ui's deploy entrypoint still points at umbrella**

```bash
python3 -c "
import json
d = json.load(open('deployments/shared-dev/langgraph.json'))
p = d['graphs'].get('c-generative-ui', '<missing>')
print(f'c-generative-ui: {p}')
print(f'  {\"OK (still umbrella — local-dev-only migration)\" if p.startswith(\"./deps/streaming/\") else \"UNEXPECTED\"}')
"
```

Expected: path starts with `./deps/streaming/src/dashboard_graph.py:graph`, marked `OK`. This proves the migration is local-dev-only, matching the spec's intent.

- [ ] **Step 5: Cleanup**

```bash
rm -f /tmp/cgenui-before.txt /tmp/cgenui-after.txt
git checkout HEAD -- deployments/shared-dev/langgraph.json
git status --short
```

Expected: clean working tree (no staged or modified files).

---

## Task 3: Verify per-cap backend imports + boots (no commit)

- [ ] **Step 1: uv sync + import smoke**

```bash
(cd cockpit/chat/generative-ui/python && uv sync 2>&1 | tail -2)
```

Expected: `Resolved … packages`, no errors.

```bash
set -a; source examples/chat/python/.env 2>/dev/null || source cockpit/langgraph/streaming/python/.env 2>/dev/null; set +a
test -n "$OPENAI_API_KEY" && echo "key OK" || (echo "MISSING OPENAI_API_KEY — STOP"; exit 1)
(cd cockpit/chat/generative-ui/python && uv run python -c "from src.graph import graph; print(type(graph).__name__)" 2>&1 | tail -2)
```

Expected: `key OK`, then `CompiledStateGraph`. Any traceback STOPs.

- [ ] **Step 2: Boot `langgraph dev` and confirm one graph**

Free the port:

```bash
lsof -t -i :5508 2>/dev/null | xargs kill -9 2>/dev/null
```

Boot:

```bash
cd cockpit/chat/generative-ui/python && nohup uv run langgraph dev --no-browser --host 127.0.0.1 --port 5508 > /tmp/cgenui-lg.log 2>&1 &
echo "PID=$!"
cd -
```

Wait for ready:

```bash
until grep -qE "Application started up" /tmp/cgenui-lg.log 2>/dev/null; do sleep 1; done
echo READY
```

Inspect:

```bash
grep -E "graph_id|Importing graph" /tmp/cgenui-lg.log | head -5
```

Expected: exactly one `graph_id=c-generative-ui`, no traceback.

Keep this langgraph dev RUNNING for Task 4 (don't kill yet).

---

## Task 4: Two-turn SDK exchange (no commit)

Exercises the multi-node pathway end-to-end against real OpenAI.

- [ ] **Step 1: Write a verification script**

Save as `/tmp/cgenui-turn-test.py`:

```python
"""Two-turn SDK exchange against the per-cap c-generative-ui backend."""
import asyncio, sys
from langgraph_sdk import get_client


async def get_last_ai_and_tools(state):
    msgs = state.get("values", {}).get("messages", [])
    last_ai = None
    tool_names = []
    for m in msgs:
        if m.get("type") == "ai" and m.get("content"):
            last_ai = m["content"]
        if m.get("type") == "tool":
            # ToolMessage doesn't always include the tool name; pull from the
            # preceding ai message's tool_calls if needed
            pass
        if m.get("type") == "ai":
            for tc in (m.get("tool_calls") or []):
                tool_names.append(tc.get("name"))
    return last_ai, tool_names


async def main():
    client = get_client(url="http://127.0.0.1:5508")
    thread = await client.threads.create()
    tid = thread["thread_id"]

    print("=== Turn 1: dashboard request ===")
    async for _ in client.runs.stream(
        thread_id=tid,
        assistant_id="c-generative-ui",
        input={"messages": [{"role": "user", "content": "Show me the airline operations dashboard."}]},
        stream_mode=["values"],
    ):
        pass
    state = await client.threads.get_state(tid)
    text1, tools1 = await get_last_ai_and_tools(state)
    print(f"  tools called: {tools1}")
    print(f"  final ai text: {(text1 or '')[:120]!r}")
    if not tools1:
        print("  FAIL: no tool calls in turn 1")
        sys.exit(1)
    if not text1:
        print("  FAIL: no final assistant text in turn 1")
        sys.exit(1)
    print("  PASS")

    print("=== Turn 2: on-time trend follow-up ===")
    async for _ in client.runs.stream(
        thread_id=tid,
        assistant_id="c-generative-ui",
        input={"messages": [{"role": "user", "content": "What's the on-time trend?"}]},
        stream_mode=["values"],
    ):
        pass
    state = await client.threads.get_state(tid)
    text2, tools2 = await get_last_ai_and_tools(state)
    print(f"  tools called (cumulative): {tools2}")
    print(f"  final ai text: {(text2 or '')[:120]!r}")
    has_trend_call = any('on_time_trend' in (t or '') for t in tools2)
    if not has_trend_call:
        print(f"  FAIL: expected a query_on_time_trend tool call somewhere, got: {tools2}")
        sys.exit(1)
    if not text2:
        print("  FAIL: no final assistant text in turn 2")
        sys.exit(1)
    print("  PASS")

asyncio.run(main())
```

- [ ] **Step 2: Run it**

```bash
uv run --python 3.12 --with langgraph-sdk --with typing_extensions python /tmp/cgenui-turn-test.py
```

Expected: two `PASS` blocks. If gpt-5 has transient issues, the first run may fail with an OpenAI error — re-run once before reporting a true migration issue.

- [ ] **Step 3: Kill langgraph dev + cleanup**

```bash
lsof -t -i :5508 2>/dev/null | xargs kill -9 2>/dev/null
rm -f /tmp/cgenui-lg.log /tmp/cgenui-turn-test.py
```

---

## Task 5: Reverse audit (no commit)

- [ ] **Step 1: Confirm c-interrupts + c-a2ui are still on the umbrella**

```bash
grep -E "id: 'c-(interrupts|a2ui)'" apps/cockpit/scripts/capability-registry.ts | grep -c 'cockpit/langgraph/streaming/python'
```

Expected: `2`. (If less, some other cap got migrated by accident — STOP.)

- [ ] **Step 2: Confirm umbrella's dashboard_graph.py + dashboard_tools.py are untouched**

```bash
git diff origin/main -- cockpit/langgraph/streaming/python/src/dashboard_graph.py cockpit/langgraph/streaming/python/src/dashboard_tools.py
```

Expected: empty. The umbrella's dashboard code is untouched in this PR.

- [ ] **Step 3: Confirm the 9 chat caps on per-cap dirs (Tier A + tool-calls + subagents + this PR)**

```bash
grep -E "id: 'c-" apps/cockpit/scripts/capability-registry.ts | grep -c 'cockpit/chat/'
```

Expected: `9`. (Tier A 6 + tool-calls + subagents + c-generative-ui.)

---

## Task 6: Regression — existing cockpit e2es still pass (no commit)

- [ ] **Step 1: Run sequentially**

```bash
npx nx e2e cockpit-langgraph-streaming-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-tool-calls-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-subagents-angular --skip-nx-cache
```

Expected: all three pass. Combined runtime ~5 minutes.

If any fails, STOP. None of these touch generative-ui's backend; a failure would indicate something unexpected (e.g., shared lib regression from a parallel agent's commit on main).

---

## Task 7: Final reference grep (no commit)

- [ ] **Step 1: Visual confirmation of end state**

```bash
echo "=== caps on per-cap dirs ==="
grep -E "id: 'c-" apps/cockpit/scripts/capability-registry.ts | grep 'cockpit/chat/' | awk -F"'" '{print "  " $2}'
echo
echo "=== caps still on umbrella ==="
grep -E "id: 'c-" apps/cockpit/scripts/capability-registry.ts | grep 'cockpit/langgraph/streaming/python' | awk -F"'" '{print "  " $2}'
```

Expected:
```
=== caps on per-cap dirs ===
  c-messages
  c-input
  c-tool-calls
  c-subagents
  c-threads
  c-timeline
  c-generative-ui
  c-debug
  c-theming

=== caps still on umbrella ===
  c-interrupts
  c-a2ui
```

(Order may vary — visually verify the two groups are correct: 9 + 2 = 11 total.)

---

## Task 8: Push, open PR, watch CI, merge

Orchestrator task. Implementer STOPS after Task 7.

- [ ] **Step 1: Push branch**

```bash
git push -u origin claude/c-generative-ui-migration
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(cockpit-registry): migrate c-generative-ui to per-cap backend" --body "$(cat <<'EOF'
## Summary
- Flip \`pythonDir\` for \`c-generative-ui\` in \`apps/cockpit/scripts/capability-registry.ts\` from \`cockpit/langgraph/streaming/python\` (the umbrella) to \`cockpit/chat/generative-ui/python\` (per-cap standalone backend).
- Per-cap dir built by PR #396 with full multi-node graph (router → plan_tools → call_tools → emit_state → respond), 4 KPI tools with inlined fixtures (byte-identical to umbrella's aviation_data.py), and \`get_stream_writer\` state emission (LangGraph 1.x).
- Sub-project 3 of 5 in the per-cap migration chain. After this lands, 9 of 11 c-* caps are on per-cap backends. Remaining: c-interrupts (in flight via PR #382), c-a2ui.

## Scope
**Local-dev-only.** \`scripts/generate-shared-deployment-config.ts\` line 54 skips chat capabilities; production deploy continues to serve c-generative-ui from the umbrella's \`dashboard_graph.py\`. End state: two byte-identical copies of the graph until the deploy-script extension PR (last in the chain).

## Test plan
- [x] Per-cap import smoke: \`from src.graph import graph\` returns \`CompiledStateGraph\`
- [x] Per-cap graph uses \`get_stream_writer\` (LangGraph 1.x API)
- [x] Fixture constants byte-identical between per-cap \`dashboard_tools.py\` and umbrella \`aviation_data.py\`
- [x] \`langgraph dev\` boots with exactly \`c-generative-ui\`, no traceback
- [x] Turn 1 (\"Show me the airline operations dashboard.\"): tool call(s) present + non-empty assistant text
- [x] Turn 2 (\"What's the on-time trend?\"): \`query_on_time_trend\` tool call + non-empty assistant text
- [x] Shared-deployment manifest byte-identical before/after (deploy unchanged)
- [x] c-interrupts + c-a2ui still on umbrella
- [x] Umbrella's \`dashboard_graph.py\` + \`dashboard_tools.py\` untouched
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
- "Single code edit" → Task 1.
- Pre-flight drift audits → Task 0.
- "Production deploy is byte-identical" → Task 2.
- "Multi-node graph end-to-end via SDK" (two-turn exchange) → Task 4.
- "Regression" → Task 6.
- "Reverse audit" → Task 5.
- "Per-cap graph uses `get_stream_writer`" → Task 0 Step 2.
- Acceptance: registry shows c-generative-ui on per-cap → Task 1 Step 3, Task 7.
- Acceptance: shared-deploy unchanged → Task 2.
- Acceptance: tool calls + assistant text per turn → Task 4.
- Acceptance: existing cockpit e2es pass → Task 6.
- Acceptance: umbrella untouched → Task 5 Step 2.

**Placeholder scan:** none. Every step has either exact code or a complete command with expected output.

**Type consistency:** cap id `c-generative-ui` consistent across all tasks. Port `5508` consistent in Task 2/3/4. Path `cockpit/chat/generative-ui/python` consistent throughout.

**Concurrency note:** pre-flight warning + Task 0 + clean-tree check at Task 2 Step 5 cover the parallel-agent risk.
