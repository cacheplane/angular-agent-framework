# Tier A capability-registry migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch six Tier A capabilities (`c-messages, c-input, c-debug, c-theming, c-threads, c-timeline`) from consuming the umbrella `cockpit/langgraph/streaming/python/` to their already-scaffolded per-cap standalone backends, by editing six `pythonDir` values in `apps/cockpit/scripts/capability-registry.ts`.

**Architecture:** Six-line registry edit + verification. The per-cap dirs already exist with working `graph.py` + `langgraph.json` + `prompts/<cap>.md`. The umbrella's `chat_graphs.py` keeps its symbols (still consumed by c-interrupts, c-generative-ui, c-a2ui — out of scope here). The shared-deployment manifest must end up with the same 26 graph names; only the six migrated caps' entrypoint paths change.

**Tech Stack:** TypeScript (registry), Python 3.12 + uv (per-cap backends), Nx (`@nx/playwright:playwright` + `@angular/build:dev-server`), `scripts/generate-shared-deployment-config.ts`.

---

## Pre-flight notes (READ FIRST)

**Working tree.** Spec is on branch `claude/cap-registry-tier-a-spec` (commit `cae8fa20`). Create the implementation branch off origin/main and cherry-pick the spec commit, or just create the implementation branch off the spec branch. Either works — the spec is the only commit between them.

```bash
git fetch origin
git checkout -b claude/cap-registry-tier-a claude/cap-registry-tier-a-spec
```

**Pre-flight verified during plan-write (2026-05-18):**
- All 6 per-cap `graph.py` files exist and import `_build_prompt_graph`-equivalent factories.
- All 6 per-cap `langgraph.json` files register exactly the expected graph id.
- All 6 per-cap `prompts/<cap>.md` files are **byte-identical** to the umbrella copies — no drift, no reconciliation needed.
- All 6 per-cap `proxy.conf.json` targets match the registry's `pythonPort` values (5501, 5502, 5509, 5510, 5506, 5507).

**Hard rules.**
- One commit per code-modifying task (Task 1 is the only such task). All verification tasks (0, 2–7) are no-commit.
- Never `git add -A` or `git add .` — stage specific paths only.
- Never push, open PR, or `--amend` (Task 8 = orchestrator).
- Never skip hooks.
- STOP and report if ANY verification step fails first-run.

**Shared-checkout chaos.** This repo's working tree gets switched by parallel agents. After any long-running step, re-confirm `git branch --show-current` is `claude/cap-registry-tier-a` before continuing.

**Heavy step.** Task 4 boots each of 6 per-cap dev servers to verify a turn exchange (~3 min total). Task 6 runs 3 existing cockpit e2e suites (~5 min).

---

## File Structure

**Modified:** `apps/cockpit/scripts/capability-registry.ts` — 6 lines changed (one per cap).

**Untouched** (all already correct):
- `cockpit/chat/<cap>/python/src/graph.py` × 6
- `cockpit/chat/<cap>/python/langgraph.json` × 6
- `cockpit/chat/<cap>/python/prompts/<cap>.md` × 6
- `cockpit/chat/<cap>/angular/proxy.conf.json` × 6
- `cockpit/chat/<cap>/angular/src/environments/environment.development.ts` × 6
- `cockpit/langgraph/streaming/python/...` (the umbrella stays put)

---

## Task 0: Pre-flight verify (no commit)

Confirm the audit findings from the spec are still true on the branch.

- [ ] **Step 1: Confirm each per-cap dir has its expected files**

```bash
for cap in messages input debug theming threads timeline; do
  echo "=== c-$cap ==="
  for f in src/graph.py langgraph.json prompts/$cap.md; do
    p="cockpit/chat/$cap/python/$f"
    [ -f "$p" ] && echo "  ✓ $f" || echo "  ✗ MISSING $f"
  done
done
```

Expected: 18 ✓ marks (6 caps × 3 files), zero ✗.

- [ ] **Step 2: Confirm prompts are still byte-identical to the umbrella**

```bash
for cap in messages input debug theming threads timeline; do
  diff cockpit/langgraph/streaming/python/prompts/$cap.md cockpit/chat/$cap/python/prompts/$cap.md \
    && echo "c-$cap: identical" \
    || echo "c-$cap: DRIFT"
done
```

Expected: 6 lines, each `c-<cap>: identical`. If any DRIFT appears, STOP — the spec assumes no drift; investigate before continuing.

- [ ] **Step 3: Confirm the registry currently points all 6 at the umbrella**

```bash
grep -E "id: 'c-(messages|input|debug|theming|threads|timeline)'" apps/cockpit/scripts/capability-registry.ts | grep -c 'cockpit/langgraph/streaming/python'
```

Expected: `6`. If less than 6, some migration is already partially done — STOP and investigate.

---

## Task 1: Flip 6 `pythonDir` values in the registry

**Files:**
- Modify: `apps/cockpit/scripts/capability-registry.ts`

- [ ] **Step 1: Apply the six edits**

Use the following sed commands (run each individually so any failure is caught immediately):

```bash
sed -i '' "s|id: 'c-messages', product: 'chat', topic: 'messages', angularProject: 'cockpit-chat-messages-angular', port: 4501, pythonPort: 5501, pythonDir: 'cockpit/langgraph/streaming/python'|id: 'c-messages', product: 'chat', topic: 'messages', angularProject: 'cockpit-chat-messages-angular', port: 4501, pythonPort: 5501, pythonDir: 'cockpit/chat/messages/python'|" apps/cockpit/scripts/capability-registry.ts

sed -i '' "s|id: 'c-input', product: 'chat', topic: 'input', angularProject: 'cockpit-chat-input-angular', port: 4502, pythonPort: 5502, pythonDir: 'cockpit/langgraph/streaming/python'|id: 'c-input', product: 'chat', topic: 'input', angularProject: 'cockpit-chat-input-angular', port: 4502, pythonPort: 5502, pythonDir: 'cockpit/chat/input/python'|" apps/cockpit/scripts/capability-registry.ts

sed -i '' "s|id: 'c-debug', product: 'chat', topic: 'debug', angularProject: 'cockpit-chat-debug-angular', port: 4509, pythonPort: 5509, pythonDir: 'cockpit/langgraph/streaming/python'|id: 'c-debug', product: 'chat', topic: 'debug', angularProject: 'cockpit-chat-debug-angular', port: 4509, pythonPort: 5509, pythonDir: 'cockpit/chat/debug/python'|" apps/cockpit/scripts/capability-registry.ts

sed -i '' "s|id: 'c-theming', product: 'chat', topic: 'theming', angularProject: 'cockpit-chat-theming-angular', port: 4510, pythonPort: 5510, pythonDir: 'cockpit/langgraph/streaming/python'|id: 'c-theming', product: 'chat', topic: 'theming', angularProject: 'cockpit-chat-theming-angular', port: 4510, pythonPort: 5510, pythonDir: 'cockpit/chat/theming/python'|" apps/cockpit/scripts/capability-registry.ts

sed -i '' "s|id: 'c-threads', product: 'chat', topic: 'threads', angularProject: 'cockpit-chat-threads-angular', port: 4506, pythonPort: 5506, pythonDir: 'cockpit/langgraph/streaming/python'|id: 'c-threads', product: 'chat', topic: 'threads', angularProject: 'cockpit-chat-threads-angular', port: 4506, pythonPort: 5506, pythonDir: 'cockpit/chat/threads/python'|" apps/cockpit/scripts/capability-registry.ts

sed -i '' "s|id: 'c-timeline', product: 'chat', topic: 'timeline', angularProject: 'cockpit-chat-timeline-angular', port: 4507, pythonPort: 5507, pythonDir: 'cockpit/langgraph/streaming/python'|id: 'c-timeline', product: 'chat', topic: 'timeline', angularProject: 'cockpit-chat-timeline-angular', port: 4507, pythonPort: 5507, pythonDir: 'cockpit/chat/timeline/python'|" apps/cockpit/scripts/capability-registry.ts
```

- [ ] **Step 2: Verify the file still parses + shows expected diff**

```bash
npx tsc --noEmit apps/cockpit/scripts/capability-registry.ts 2>&1 | tail -5
```

Expected: no errors. If tsc complains, the sed likely missed a line — revert with `git checkout HEAD -- apps/cockpit/scripts/capability-registry.ts` and STOP.

```bash
git diff apps/cockpit/scripts/capability-registry.ts | head -30
```

Expected: 6 changed lines, each replacing `cockpit/langgraph/streaming/python` with `cockpit/chat/<cap>/python`. No other changes.

- [ ] **Step 3: Verify all six caps now point at their per-cap dirs**

```bash
grep -E "id: 'c-(messages|input|debug|theming|threads|timeline)'" apps/cockpit/scripts/capability-registry.ts | grep -c 'cockpit/chat/'
```

Expected: `6`.

```bash
grep -E "id: 'c-(messages|input|debug|theming|threads|timeline)'" apps/cockpit/scripts/capability-registry.ts | grep -c 'cockpit/langgraph/streaming/python'
```

Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/scripts/capability-registry.ts
git commit -m "$(cat <<'EOF'
feat(cockpit-registry): tier A — migrate 6 caps to per-cap backends

Flip pythonDir for c-messages, c-input, c-debug, c-theming, c-threads,
c-timeline from cockpit/langgraph/streaming/python (the umbrella) to
their per-cap standalone backends (cockpit/chat/<cap>/python).

Per-cap dirs were scaffolded by PR #396 with working graph.py +
langgraph.json + prompts (byte-identical to umbrella copies); the
capability registry just hadn't switched to them yet.

After this, only c-interrupts, c-generative-ui, and c-a2ui still
consume the umbrella — each has its own follow-on migration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Verify shared-deployment manifest preserves graph count (no commit)

This is the critical check. Production deploy must end up with the same graphs, just sourced from per-cap paths.

- [ ] **Step 1: Snapshot AFTER (current branch)**

```bash
npx tsx scripts/generate-shared-deployment-config.ts 2>&1 | tail -2
python3 -c "import json; d=json.load(open('deployments/shared-dev/langgraph.json')); print('count=',len(d['graphs'])); print(sorted(d['graphs']))" > /tmp/cap-tier-a-after.txt
cat /tmp/cap-tier-a-after.txt
```

Expected: `count= 26` and the sorted list includes all c-* graphs (c-a2ui, c-debug, c-generative-ui, c-input, c-interrupts, c-messages, c-subagents, c-theming, c-threads, c-timeline, c-tool-calls), all langgraph caps, all deep-agents caps, `chat`, `streaming`.

- [ ] **Step 2: Snapshot BEFORE (origin/main without the registry edit)**

```bash
git stash push -m "tier-a-temp" apps/cockpit/scripts/capability-registry.ts
npx tsx scripts/generate-shared-deployment-config.ts 2>&1 | tail -2
python3 -c "import json; d=json.load(open('deployments/shared-dev/langgraph.json')); print('count=',len(d['graphs'])); print(sorted(d['graphs']))" > /tmp/cap-tier-a-before.txt
cat /tmp/cap-tier-a-before.txt
git stash pop
```

- [ ] **Step 3: Confirm graph names + count IDENTICAL**

```bash
diff /tmp/cap-tier-a-before.txt /tmp/cap-tier-a-after.txt && echo "IDENTICAL"
```

Expected: `IDENTICAL`. If the diff is non-empty, the per-cap manifests are registering a different graph id than the umbrella did — STOP and investigate which cap's `langgraph.json` differs.

- [ ] **Step 4: Confirm the 6 caps' entrypoint paths DID NOT change** (revised — see note below)

```bash
python3 -c "
import json
d = json.load(open('deployments/shared-dev/langgraph.json'))
for cap in ['c-messages','c-input','c-debug','c-theming','c-threads','c-timeline']:
    path = d['graphs'].get(cap, '<missing>')
    in_umbrella = path.startswith('./deps/streaming/src/chat_graphs.py')
    print(f'{cap}: {path}  {\"OK (still umbrella — local-dev-only migration)\" if in_umbrella else \"UNEXPECTED\"}')
"
```

Expected: 6 lines, each ending `OK (still umbrella — local-dev-only migration)`.

**Why this is the correct expectation:** `scripts/generate-shared-deployment-config.ts` line 54 skips chat capabilities (`if (capability.product !== 'langgraph' && capability.product !== 'deep-agents') continue;`). The c-* graphs reach the shared-deployment manifest via the umbrella's `langgraph.json` (which registers all 12 graphs and is staged as the `streaming` langgraph capability's dep). This PR's registry edit only affects local-dev tooling that reads chat caps' `pythonDir`; production deploy is unchanged.

**Follow-up needed:** a separate PR must (a) extend the generator to iterate chat capabilities and (b) drop c-* entries from the umbrella's `langgraph.json`. Until then, the per-cap `graph.py` files and the umbrella's `chat_graphs.py` are TWO COPIES of the same graphs — kept in sync manually. Acceptable tech debt for this PR; tracked as part of the umbrella-cleanup chain.

- [ ] **Step 5: Cleanup**

```bash
rm -f /tmp/cap-tier-a-before.txt /tmp/cap-tier-a-after.txt
# Reset the script's mutated output (it'll be regenerated by CI deploy on merge)
git checkout HEAD -- deployments/shared-dev/langgraph.json
```

Verify nothing accidentally got staged:

```bash
git status --short
```

Expected: clean working tree (no staged or modified files).

---

## Task 3: Verify each per-cap backend boots standalone (no commit)

Verifies each per-cap graph imports and registers without error. Does NOT need an LLM call — just confirms the dev server can start.

- [ ] **Step 1: For each cap, sync + smoke-import**

```bash
for cap in messages input debug theming threads timeline; do
  echo "=== c-$cap ==="
  (cd cockpit/chat/$cap/python && uv sync 2>&1 | tail -2)
  (cd cockpit/chat/$cap/python && uv run python -c "from src.graph import graph; print(type(graph).__name__)" 2>&1 | tail -2)
done
```

Expected per cap: `Resolved … packages` / `Audited …` (uv sync OK), then `CompiledStateGraph`. Any traceback means the per-cap backend has a bug — STOP and report which cap.

- [ ] **Step 2: Boot one cap's `langgraph dev` end-to-end (spot-check)**

Pick c-messages as the canary. Free its port:

```bash
lsof -t -i :5501 2>/dev/null | xargs kill -9 2>/dev/null
```

Boot in background:

```bash
cd cockpit/chat/messages/python && nohup uv run langgraph dev --no-browser --host 127.0.0.1 --port 5501 > /tmp/tier-a-messages-lg.log 2>&1 &
echo "PID=$!"
```

Wait for ready:

```bash
until grep -qE "Application started up" /tmp/tier-a-messages-lg.log 2>/dev/null; do sleep 1; done
echo READY
```

Inspect:

```bash
grep -E "graph_id|Importing graph" /tmp/tier-a-messages-lg.log | head -5
```

Expected: exactly one `graph_id=c-messages` line, no tracebacks.

Kill + cleanup:

```bash
lsof -t -i :5501 2>/dev/null | xargs kill -9 2>/dev/null
rm -f /tmp/tier-a-messages-lg.log
```

---

## Task 4: Verify each cap's angular dev exchanges a turn (no commit)

End-to-end manual smoke. Per-cap backend ↔ Angular dev ↔ proxy ↔ langgraph dev.

This task spans 6 caps × ~30 seconds each. The implementer-subagent can NOT do the manual UI interaction. Either:
- (a) The orchestrator runs it manually (open browser, send "Hello" prompt, expect a response), OR
- (b) Use the `langgraph_sdk` HTTP API to exchange a turn programmatically (no UI needed; faster).

This plan uses option (b) since it's automatable. UI-level verification happens implicitly in Task 6 (existing cockpit e2es).

- [ ] **Step 1: Write a verification script**

Save as `/tmp/tier-a-turn-test.py`:

```python
"""Boot each Tier A per-cap backend and exchange one turn via langgraph SDK HTTP."""
import asyncio, os, signal, subprocess, sys, time
from langgraph_sdk import get_client

CAPS = [
    ("messages", 5501),
    ("input",    5502),
    ("debug",    5509),
    ("theming",  5510),
    ("threads",  5506),
    ("timeline", 5507),
]

async def exchange_one(cap: str, port: int) -> bool:
    client = get_client(url=f"http://localhost:{port}")
    try:
        thread = await client.threads.create()
        got_text = False
        async for chunk in client.runs.stream(
            thread_id=thread["thread_id"],
            assistant_id=f"c-{cap}",
            input={"messages": [{"role": "user", "content": "Hello in one short sentence."}]},
            stream_mode=["values"],
        ):
            pass
        state = await client.threads.get_state(thread["thread_id"])
        msgs = state["values"].get("messages", [])
        for m in msgs:
            if m.get("type") == "ai" and m.get("content"):
                print(f"  ai: {m['content'][:80]!r}")
                got_text = True
                break
        return got_text
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

async def main():
    for cap, port in CAPS:
        print(f"=== c-{cap} on :{port} ===")
        # Boot langgraph dev
        proc = subprocess.Popen(
            ["uv", "run", "langgraph", "dev", "--no-browser", "--host", "127.0.0.1", "--port", str(port)],
            cwd=f"cockpit/chat/{cap}/python",
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            preexec_fn=os.setsid,
        )
        # Wait for ready
        ready = False
        for _ in range(60):
            try:
                import httpx
                if httpx.get(f"http://127.0.0.1:{port}/ok", timeout=1).status_code == 200:
                    ready = True
                    break
            except Exception:
                pass
            time.sleep(1)
        if not ready:
            print("  FAIL: langgraph never came up")
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            sys.exit(1)
        # Exchange turn
        ok = await exchange_one(cap, port)
        # Kill
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        proc.wait(timeout=5)
        if not ok:
            print(f"  FAIL: c-{cap}")
            sys.exit(1)
        print(f"  PASS: c-{cap}")

asyncio.run(main())
```

- [ ] **Step 2: Run it (with .env loaded so OPENAI_API_KEY is set)**

```bash
set -a
source examples/chat/python/.env 2>/dev/null || source cockpit/langgraph/streaming/python/.env 2>/dev/null
set +a
test -n "$OPENAI_API_KEY" && echo "key OK" || echo "MISSING OPENAI_API_KEY — STOP"
uv run --with langgraph-sdk --with httpx python /tmp/tier-a-turn-test.py
```

Expected: 6 `=== c-<cap> ===` blocks, each ending with `PASS: c-<cap>`. Any `FAIL` line means STOP.

This task hits real OpenAI 6 times. ~1-3 minute runtime. ~6 small API calls = trivial cost.

- [ ] **Step 3: Cleanup**

```bash
rm /tmp/tier-a-turn-test.py
lsof -t -i :5501 -i :5502 -i :5506 -i :5507 -i :5509 -i :5510 2>/dev/null | xargs kill -9 2>/dev/null
```

---

## Task 5: Verify the umbrella still has its consumers (no commit)

Confirm we didn't accidentally migrate too much.

- [ ] **Step 1: Confirm umbrella still serves c-interrupts, c-generative-ui, c-a2ui**

```bash
grep -E "id: 'c-(interrupts|generative-ui|a2ui)'" apps/cockpit/scripts/capability-registry.ts | grep -c 'cockpit/langgraph/streaming/python'
```

Expected: `3`. If less, some other cap got migrated by accident — STOP.

- [ ] **Step 2: Confirm c-tool-calls + c-subagents still on their per-cap dirs**

```bash
grep -E "id: 'c-(tool-calls|subagents)'" apps/cockpit/scripts/capability-registry.ts | grep -c 'cockpit/chat/'
```

Expected: `2`.

- [ ] **Step 3: Confirm umbrella's `chat_graphs.py` is unchanged**

```bash
git diff origin/main -- cockpit/langgraph/streaming/python/
```

Expected: empty. The umbrella is untouched in this PR.

---

## Task 6: Regression — existing cockpit aimock e2e suites still pass (no commit)

The three aimock-driven cockpit e2es each spin up their OWN backend via `createGlobalSetup({ langgraphCwd: ... })` — none reference the registry's `pythonDir`. They must continue to pass.

- [ ] **Step 1: Run sequentially**

```bash
npx nx e2e cockpit-langgraph-streaming-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-tool-calls-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-subagents-angular --skip-nx-cache
```

Expected: all three pass. Combined runtime ~5 minutes.

If any fails, STOP. The most likely cause would be a stray import that I missed.

---

## Task 7: Final reference grep (no commit)

- [ ] **Step 1: Confirm grep output matches the expected end state**

```bash
echo "=== caps on per-cap dirs ==="
grep -E "id: 'c-" apps/cockpit/scripts/capability-registry.ts | grep -E "cockpit/chat/" | awk -F"'" '{print "  " $2}'
echo
echo "=== caps still on umbrella ==="
grep -E "id: 'c-" apps/cockpit/scripts/capability-registry.ts | grep "cockpit/langgraph/streaming/python" | awk -F"'" '{print "  " $2}'
```

Expected:
```
=== caps on per-cap dirs ===
  c-messages
  c-input
  c-debug
  c-theming
  c-threads
  c-timeline
  c-tool-calls
  c-subagents

=== caps still on umbrella ===
  c-interrupts
  c-generative-ui
  c-a2ui
```

(Order may vary — visually verify the two groups are correct.)

---

## Task 8: Push, open PR, watch CI, merge

Orchestrator task. Implementer STOPS after Task 7.

- [ ] **Step 1: Push branch**

```bash
git push -u origin claude/cap-registry-tier-a
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(cockpit-registry): tier A — migrate 6 caps to per-cap backends" --body "$(cat <<'EOF'
## Summary
- Flip `pythonDir` for `c-messages, c-input, c-debug, c-theming, c-threads, c-timeline` in `apps/cockpit/scripts/capability-registry.ts` from `cockpit/langgraph/streaming/python` (the umbrella) to `cockpit/chat/<cap>/python` (per-cap standalone backends).
- Per-cap dirs were scaffolded by PR #396 with working `graph.py` + `langgraph.json` + `prompts/<cap>.md` (byte-identical to umbrella copies). This PR just connects them.
- Sub-project 1 of 5 in the per-cap migration chain. After this lands, 8 of 11 c-* caps are on per-cap backends (c-tool-calls and c-subagents were already migrated; this PR adds 6 more). Remaining: c-interrupts (in flight via PR #382), c-generative-ui, c-a2ui.

## Why
Audit during umbrella-cleanup brainstorm found that 9 of 11 c-* caps still consumed the umbrella's `chat_graphs.py`, blocking the umbrella cleanup. This PR is the high-yield batch migration; the umbrella cleanup follows after all c-* caps migrate.

## Test plan
- [x] Per-cap import smoke: `from src.graph import graph` returns `CompiledStateGraph` for all 6
- [x] Spot-check `langgraph dev` boots one cap with exactly its graph
- [x] All 6 caps complete a turn exchange via langgraph SDK
- [x] Shared-deployment manifest unchanged in graph count + names (26 graphs)
- [x] 6 migrated caps' entrypoint paths now point at `./deps/c-<cap>/src/graph.py:graph`
- [x] Umbrella's c-interrupts/c-generative-ui/c-a2ui still on umbrella
- [x] Umbrella's `chat_graphs.py` untouched
- [x] `nx e2e cockpit-langgraph-streaming-angular`, `cockpit-chat-tool-calls-angular`, `cockpit-chat-subagents-angular` pass
- [ ] CI `Cockpit — e2e` green
- [ ] CI `Deploy LangGraph` (post-merge): shared-dev still publishes all 26 graphs

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

- [ ] **Step 5: Post-merge — verify Deploy LangGraph workflow succeeds**

The `.github/workflows/deploy-langgraph.yml` triggers on merge to main (paths-filtered to `cockpit/langgraph/**/python/**` + the registry script). Watch it:

```bash
gh run list --workflow=deploy-langgraph.yml --limit 1 --json status,conclusion,url
```

If conclusion is `failure`, inspect — likely transient LangSmith issue; re-run. If it's a real per-cap backend issue, the rollback is small (revert this PR's one commit).

---

## Self-review notes

**Spec coverage:**
- "Single code edit" (6 lines in registry) → Task 1.
- "Production deploy preserved" → Task 2 (before/after diff of manifest).
- "Local dev for each cap" → Tasks 3 + 4 (import smoke + SDK turn exchange).
- "Per-cap prompt content drift" → Task 0 Step 2 (byte-identical check; resolved at plan-write time, double-checked at exec time).
- "Reverse audit — umbrella still has its consumers" → Task 5.
- Acceptance: registry shows 6 caps on per-cap → Task 1 Step 3, Task 7.
- Acceptance: `generate-shared-deployment-config.ts` produces same 26 names → Task 2.
- Acceptance: per-cap boot + turn exchange → Tasks 3 + 4.
- Acceptance: prompts diffed, drift reconciled → Task 0 Step 2 (no drift exists).
- Acceptance: no regression in existing e2es → Task 6.
- Acceptance: umbrella `chat_graphs.py` untouched → Task 5 Step 3.

**Placeholder scan:** none. Every step has exact code or commands with expected output.

**Type consistency:**
- Cap list `[messages, input, debug, theming, threads, timeline]` consistent across Tasks 0, 1, 3, 4, 7.
- Port mapping (5501, 5502, 5509, 5510, 5506, 5507) consistent in the verification script (Task 4) and the regex grep (Task 5).
- `pythonDir` source/target paths consistent throughout.

**Concurrency note:** the pre-flight warning + Task 0 + the `git status --short` check at Task 2 Step 5 cover the parallel-agent risk.
