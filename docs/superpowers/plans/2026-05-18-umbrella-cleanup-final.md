# Umbrella cleanup (final) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-route the shared-deployment manifest to source c-* graphs from per-cap dirs (PR 1), then delete 1382 lines of now-dead duplicate code from the umbrella (PR 2). Completes the per-cap migration chain.

**Architecture:** Two PRs. PR 1 changes deployment behavior atomically (deploy script extension + umbrella manifest trim in one commit, to avoid `addGraph` collisions). PR 2 deletes dead source files after PR 1's post-merge Deploy LangGraph run goes green — gating deletion on production validation.

**Tech Stack:** TypeScript (`scripts/generate-shared-deployment-config.ts`), Python 3.12 + uv (umbrella + per-cap backends), LangSmith Cloud deploy via `langgraph deploy`, GitHub Actions (`.github/workflows/deploy-langgraph.yml`).

---

## Pre-flight notes (READ FIRST)

**Spec branch:** `claude/umbrella-cleanup-final-spec` (commit `e148f3da`, off origin/main post-PR-#424).

**This plan covers TWO PRs.** Tasks 1-9 are PR 1; Tasks 10-15 are PR 2. PR 2 should not begin until PR 1's `Deploy LangGraph` post-merge workflow has run green.

**Working tree.** PR 1's branch should be created off the spec branch + rebased onto latest origin/main:

```bash
git fetch origin
git checkout -b claude/umbrella-cleanup-pr1 claude/umbrella-cleanup-final-spec
git rebase origin/main
```

PR 2's branch should be created off `origin/main` AFTER PR 1 has merged + Deploy LangGraph is green:

```bash
git fetch origin
git checkout -b claude/umbrella-cleanup-pr2 origin/main
```

**Pre-flight verified during plan-write (2026-05-18):**
- Umbrella manifest registers 12 graphs (`streaming` + 11 c-*).
- Umbrella's `src/` has 7 .py files (1435 lines total); only `graph.py` (53 lines) is consumed by anything that will survive.
- Deploy script line 54 skips both `chat` and `render` capabilities.
- All 11 c-* caps' `pythonDir` in the registry now points at `cockpit/chat/<cap>/python/` (verified by inspecting `apps/cockpit/scripts/capability-registry.ts`).
- Each per-cap `langgraph.json` registers exactly the expected graph id (verified during prior migration PRs).
- Generated `deployments/shared-dev/langgraph.json` currently has 26 graphs.

**Hard rules.**
- PR 1 produces ONE code commit (Task 2). PR 2 produces ONE code commit (Task 11). All other tasks are no-commit verification.
- Never `git add -A` or `git add .` — stage specific paths.
- Never push, open PR, or `--amend` except where the plan explicitly says so (Tasks 8/9 + 14/15 = orchestrator).
- Never skip hooks.
- STOP and report if ANY verification step fails first-run.

**Shared-checkout chaos.** Parallel agents have caused branch swaps mid-task during prior PRs. After any long-running step, confirm `git branch --show-current`. If swap detected, STOP — do not try to recover.

**Heavy steps.** Task 6 + Task 13 each run 3 cockpit aimock e2es (~5 min combined each). Post-merge Deploy LangGraph workflow run is the gate between PRs (~3-5 min real-network deploy to LangSmith).

---

## File Structure (PR 1)

**Modified:**
- `scripts/generate-shared-deployment-config.ts` — 1 line changed in the chat-skip filter.
- `cockpit/langgraph/streaming/python/langgraph.json` — trim from 12 graph entries to 1.

**Untouched in PR 1:**
- `cockpit/langgraph/streaming/python/src/*.py` — dead files stay until PR 2 (safety net).
- `apps/cockpit/scripts/capability-registry.ts` — unchanged (per-cap dirs already wired).
- Per-cap dirs — unchanged (no migration here; they've been correct since the chain landed).

## File Structure (PR 2)

**Deleted (all under `cockpit/langgraph/streaming/python/src/`):**
- `chat_graphs.py` (198 lines)
- `a2ui_graph.py` (632 lines)
- `dashboard_graph.py` (177 lines)
- `dashboard_tools.py` (78 lines)
- `aviation_data.py` (207 lines)
- `aviation_tools.py` (90 lines)

**Untouched in PR 2:** everything else. The umbrella's `src/graph.py` and `index.ts` survive. `pyproject.toml` stays as-is (deps still needed by `graph.py`).

---

# PR 1: Re-route deploy + trim umbrella manifest

## Task 1 (PR 1): Pre-flight verify (no commit)

- [ ] **Step 1: Confirm umbrella manifest is in starting state (12 graphs)**

```bash
python3 -c "import json; d=json.load(open('cockpit/langgraph/streaming/python/langgraph.json')); print(len(d['graphs']),'graphs:',sorted(d['graphs']))"
```

Expected: `12 graphs: ['c-a2ui', 'c-debug', 'c-generative-ui', 'c-input', 'c-interrupts', 'c-messages', 'c-subagents', 'c-theming', 'c-threads', 'c-timeline', 'c-tool-calls', 'streaming']`.

- [ ] **Step 2: Confirm deploy script's chat-skip is in starting state**

```bash
sed -n '54,56p' scripts/generate-shared-deployment-config.ts
```

Expected: `  if (capability.product !== 'langgraph' && capability.product !== 'deep-agents') {` followed by `    continue;` and `  }`.

- [ ] **Step 3: Confirm all 11 c-* caps point at per-cap dirs in the registry**

```bash
grep -E "id: 'c-" apps/cockpit/scripts/capability-registry.ts | grep -c 'cockpit/chat/'
```

Expected: `11`.

```bash
grep -E "id: 'c-" apps/cockpit/scripts/capability-registry.ts | grep -c 'cockpit/langgraph/streaming/python'
```

Expected: `0`.

- [ ] **Step 4: Confirm each c-* per-cap langgraph.json exists and registers the expected graph id**

```bash
for cap in messages input debug theming threads timeline tool-calls subagents interrupts generative-ui a2ui; do
  manifest="cockpit/chat/$cap/python/langgraph.json"
  if [ -f "$manifest" ]; then
    name=$(python3 -c "import json; print(list(json.load(open('$manifest'))['graphs'])[0])" 2>/dev/null)
    expected="c-$cap"
    if [ "$name" = "$expected" ]; then
      echo "  ✓ c-$cap registers '$name'"
    else
      echo "  ✗ c-$cap registers '$name' (expected '$expected')"
    fi
  else
    echo "  ✗ c-$cap MISSING manifest"
  fi
done
```

Expected: 11 ✓ marks, zero ✗.

If anything fails, STOP — the per-cap chain migration may be incomplete.

- [ ] **Step 5: Snapshot the current shared-deploy manifest (BEFORE PR 1)**

```bash
npx tsx scripts/generate-shared-deployment-config.ts 2>&1 | tail -2
python3 -c "
import json
d = json.load(open('deployments/shared-dev/langgraph.json'))
print(f'count={len(d[\"graphs\"])}')
for k in sorted(d['graphs']):
    print(f'  {k}: {d[\"graphs\"][k]}')
" > /tmp/umbrella-cleanup-pr1-before.txt
head -15 /tmp/umbrella-cleanup-pr1-before.txt
```

Expected: `count=26`, and the 11 c-* graphs' paths all start with `./deps/streaming/src/` (umbrella-sourced).

Restore the generated manifest to the committed state (the generator mutated it; we want clean diff):

```bash
git checkout HEAD -- deployments/shared-dev/langgraph.json
```

---

## Task 2 (PR 1): Apply the deploy-script extension + umbrella manifest trim (atomic commit)

**Files:**
- Modify: `scripts/generate-shared-deployment-config.ts` (one line)
- Modify: `cockpit/langgraph/streaming/python/langgraph.json` (rewrite)

- [ ] **Step 1: Update the deploy script's filter**

Edit `scripts/generate-shared-deployment-config.ts`. Find this block (currently at line 54-56):

```typescript
  if (capability.product !== 'langgraph' && capability.product !== 'deep-agents') {
    continue;
  }
```

Replace with:

```typescript
  if (capability.product === 'render') {
    continue;
  }
```

Verify with diff:

```bash
git diff scripts/generate-shared-deployment-config.ts
```

Expected: exactly the filter change shown above. No other lines modified.

- [ ] **Step 2: Trim the umbrella's langgraph.json**

Overwrite `cockpit/langgraph/streaming/python/langgraph.json` with this exact content:

```json
{
  "graphs": {
    "streaming": "./src/graph.py:graph"
  },
  "dependencies": [
    "."
  ],
  "python_version": "3.12",
  "env": ".env"
}
```

Verify JSON parses:

```bash
python3 -c "import json; d=json.load(open('cockpit/langgraph/streaming/python/langgraph.json')); assert sorted(d['graphs']) == ['streaming'], d['graphs']; print('OK — 1 graph:', list(d['graphs']))"
```

Expected: `OK — 1 graph: ['streaming']`.

- [ ] **Step 3: Verify TypeScript still compiles**

```bash
npx tsc --noEmit scripts/generate-shared-deployment-config.ts --skipLibCheck 2>&1 | tail -3
```

Expected: no errors.

- [ ] **Step 4: Commit (both files in one atomic commit)**

```bash
git add scripts/generate-shared-deployment-config.ts cockpit/langgraph/streaming/python/langgraph.json
git commit -m "$(cat <<'EOF'
feat(deploy): route shared-dev manifest through per-cap chat backends

Two coupled changes that must land together (else addGraph throws on
duplicate c-* registrations):

1. scripts/generate-shared-deployment-config.ts: change line 54's
   filter from "skip chat + render" to "skip render only". Chat caps
   now iterate; their per-cap langgraph.json files supply the graphs.

2. cockpit/langgraph/streaming/python/langgraph.json: trim from 12
   graph entries to 1 (just `streaming`). The c-* entries are now
   redundant — duplicate registrations would collide.

Net effect on shared-dev manifest: same 26 graph names, but the 11
c-* graphs' entrypoint paths re-route from
  ./deps/streaming/src/<file>.py:<symbol>
to
  ./deps/c-<cap>/src/graph.py:graph

Production deploy continues to publish the same set of graphs; just
sources each c-* from its per-cap dir (matching what local dev has
been doing since the migration chain landed in PRs #413/#417/#382/#421/#424).

Sub-project 6/6, PR 1/2 of the per-cap migration chain. PR 2 (delete
umbrella's now-dead duplicate source files) lands after this PR's
Deploy LangGraph post-merge workflow is green.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 (PR 1): Verify the generated shared-deploy manifest re-routes correctly (no commit)

- [ ] **Step 1: Snapshot AFTER (post-commit)**

```bash
npx tsx scripts/generate-shared-deployment-config.ts 2>&1 | tail -2
python3 -c "
import json
d = json.load(open('deployments/shared-dev/langgraph.json'))
print(f'count={len(d[\"graphs\"])}')
for k in sorted(d['graphs']):
    print(f'  {k}: {d[\"graphs\"][k]}')
" > /tmp/umbrella-cleanup-pr1-after.txt
head -15 /tmp/umbrella-cleanup-pr1-after.txt
```

Expected: `count=26`, same as the BEFORE snapshot.

- [ ] **Step 2: Confirm graph NAMES + COUNT unchanged**

```bash
diff <(grep -E '^count|^  [a-z-]+:' /tmp/umbrella-cleanup-pr1-before.txt | awk -F: '{print $1}') \
     <(grep -E '^count|^  [a-z-]+:' /tmp/umbrella-cleanup-pr1-after.txt | awk -F: '{print $1}') \
  && echo "NAMES + COUNT IDENTICAL"
```

Expected: `NAMES + COUNT IDENTICAL`. If diff non-empty, STOP — the migration accidentally added/removed graphs.

- [ ] **Step 3: Confirm the 11 c-* paths re-routed**

```bash
python3 -c "
import json
d = json.load(open('deployments/shared-dev/langgraph.json'))
ok = True
for cap in ['c-messages','c-input','c-debug','c-theming','c-threads','c-timeline','c-tool-calls','c-subagents','c-interrupts','c-generative-ui','c-a2ui']:
    path = d['graphs'].get(cap, '<missing>')
    expected_prefix = f'./deps/{cap}/'
    if path.startswith(expected_prefix):
        print(f'  ✓ {cap}: {path}')
    else:
        print(f'  ✗ {cap}: {path} (expected prefix {expected_prefix})')
        ok = False
import sys; sys.exit(0 if ok else 1)
"
```

Expected: 11 ✓ marks, exit 0. If any ✗, STOP.

- [ ] **Step 4: Confirm all other graphs' paths are unchanged**

```bash
python3 -c "
import json
before = json.load(open('/tmp/umbrella-cleanup-pr1-before-full.json')) if False else None
# Compare directly from snapshot files
before_paths = {}
with open('/tmp/umbrella-cleanup-pr1-before.txt') as f:
    for line in f:
        s = line.strip()
        if ':' in s and not s.startswith('count'):
            k, v = s.split(': ', 1)
            before_paths[k.strip()] = v.strip()
after_paths = {}
with open('/tmp/umbrella-cleanup-pr1-after.txt') as f:
    for line in f:
        s = line.strip()
        if ':' in s and not s.startswith('count'):
            k, v = s.split(': ', 1)
            after_paths[k.strip()] = v.strip()
c_caps = {'c-messages','c-input','c-debug','c-theming','c-threads','c-timeline','c-tool-calls','c-subagents','c-interrupts','c-generative-ui','c-a2ui'}
unchanged = sorted(set(before_paths) - c_caps)
for k in unchanged:
    if before_paths.get(k) != after_paths.get(k):
        print(f'  ✗ {k}: PATH CHANGED unexpectedly')
        print(f'      before: {before_paths.get(k)}')
        print(f'      after:  {after_paths.get(k)}')
    else:
        pass
print(f'verified {len(unchanged)} non-chat graph paths unchanged')
"
```

Expected: `verified 15 non-chat graph paths unchanged` (or similar; should print exactly 15 — the 26 total minus the 11 c-* caps). If any line says PATH CHANGED, STOP.

- [ ] **Step 5: Restore the generated manifest + cleanup**

```bash
git checkout HEAD -- deployments/shared-dev/langgraph.json
rm -f /tmp/umbrella-cleanup-pr1-before.txt /tmp/umbrella-cleanup-pr1-after.txt
git status --short
```

Expected: clean working tree.

---

## Task 4 (PR 1): Verify per-cap backends still boot from per-cap dirs (no commit)

Sanity check that the per-cap dirs the new deploy will source are intact.

- [ ] **Step 1: Source env**

```bash
set -a
source examples/chat/python/.env 2>/dev/null || source cockpit/langgraph/streaming/python/.env 2>/dev/null
set +a
test -n "$OPENAI_API_KEY" && echo "key OK" || (echo "MISSING OPENAI_API_KEY — STOP"; exit 1)
```

- [ ] **Step 2: For 3 representative c-* caps, confirm per-cap import works**

```bash
for cap in messages tool-calls a2ui; do
  echo "=== c-$cap ==="
  (cd cockpit/chat/$cap/python && uv sync 2>&1 | tail -1)
  (cd cockpit/chat/$cap/python && OPENAI_API_KEY="$OPENAI_API_KEY" uv run python -c "from src.graph import graph; print(type(graph).__name__)" 2>&1 | tail -1)
done
```

Expected per cap: `Resolved … packages` (or `Audited …`), then `CompiledStateGraph`. Any traceback STOPs.

We don't need to boot all 11 — the prior 5 migration PRs each exercised these dirs. Smoke-checking 3 is enough.

---

## Task 5 (PR 1): Verify umbrella's streaming graph still boots (no commit)

The umbrella now registers only `streaming`. Confirm it works post-trim.

- [ ] **Step 1: Sync + import**

```bash
(cd cockpit/langgraph/streaming/python && uv sync 2>&1 | tail -1)
(cd cockpit/langgraph/streaming/python && OPENAI_API_KEY="$OPENAI_API_KEY" uv run python -c "from src.graph import graph; print(type(graph).__name__)" 2>&1 | tail -1)
```

Expected: `CompiledStateGraph`.

- [ ] **Step 2: Boot langgraph dev**

Free port:

```bash
lsof -t -i :5500 2>/dev/null | xargs kill -9 2>/dev/null
```

Boot:

```bash
(cd cockpit/langgraph/streaming/python && nohup env OPENAI_API_KEY="$OPENAI_API_KEY" uv run langgraph dev --no-browser --host 127.0.0.1 --port 5500 > /tmp/umbrella-cleanup-pr1-lg.log 2>&1 &)
until grep -qE "Application started up" /tmp/umbrella-cleanup-pr1-lg.log 2>/dev/null; do sleep 1; done
echo READY
```

Inspect:

```bash
grep -E "graph_id|Importing graph" /tmp/umbrella-cleanup-pr1-lg.log | head -5
```

Expected: exactly one `graph_id=streaming`, no traceback. (The 11 c-* graphs are no longer registered in this manifest, so they should NOT appear.)

Cleanup:

```bash
lsof -t -i :5500 2>/dev/null | xargs kill -9 2>/dev/null
rm -f /tmp/umbrella-cleanup-pr1-lg.log
```

---

## Task 6 (PR 1): Regression — existing cockpit e2es still pass (no commit)

- [ ] **Step 1: Run sequentially**

```bash
npx nx e2e cockpit-langgraph-streaming-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-tool-calls-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-subagents-angular --skip-nx-cache
```

Expected: all three pass. Combined runtime ~5 minutes.

If any fails, STOP. None of these touch the deploy script; a failure indicates an unrelated regression on main.

---

## Task 7 (PR 1): Final state grep (no commit)

- [ ] **Step 1: Confirm end-state of the two modified files**

```bash
echo "=== umbrella manifest ==="
cat cockpit/langgraph/streaming/python/langgraph.json
echo
echo "=== deploy script filter ==="
sed -n '54,56p' scripts/generate-shared-deployment-config.ts
```

Expected: umbrella manifest has only `streaming`; deploy script filter is `if (capability.product === 'render') {`.

- [ ] **Step 2: Confirm umbrella src files are still present (PR 2 will delete them)**

```bash
ls cockpit/langgraph/streaming/python/src/*.py
```

Expected: 7 files including `chat_graphs.py`, `a2ui_graph.py`, `dashboard_graph.py`, `dashboard_tools.py`, `aviation_data.py`, `aviation_tools.py`, `graph.py`. They're now dead but stay until PR 2.

---

## Task 8 (PR 1): Push, open PR, watch CI, merge

Orchestrator task. Implementer STOPS after Task 7.

- [ ] **Step 1: Push**

```bash
git push -u origin claude/umbrella-cleanup-pr1
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(deploy): route shared-dev manifest through per-cap chat backends (umbrella cleanup PR 1/2)" --body "$(cat <<'EOF'
## Summary
Two coupled edits that must land together (else \`addGraph\` throws on duplicate c-* registrations):

1. \`scripts/generate-shared-deployment-config.ts\`: filter changes from \"skip chat + render\" to \"skip render only\". Chat caps now iterate.
2. \`cockpit/langgraph/streaming/python/langgraph.json\`: trim from 12 graph entries to 1 (\`streaming\` only). The c-* entries are now redundant.

Net effect on shared-dev manifest: same 26 graph names, but the 11 c-* graphs' entrypoint paths re-route from \`./deps/streaming/src/<file>.py:<symbol>\` to \`./deps/c-<cap>/src/graph.py:graph\`. Production deploy continues to publish the same set of graphs; just sources each c-* from its per-cap dir.

This is PR 1 of 2 in the final umbrella cleanup (sub-project 6/6 of the per-cap migration chain). PR 2 (deletes the umbrella's now-dead duplicate source files) lands after this PR's Deploy LangGraph post-merge workflow is green.

## Test plan
- [x] Pre-flight: all 11 per-cap manifests register expected graph ids
- [x] Generated shared-deploy manifest has 26 graphs (same as before)
- [x] 11 c-* paths now \`./deps/c-<cap>/src/graph.py:graph\`
- [x] 15 non-chat graph paths unchanged
- [x] Per-cap representative import smoke (3 caps): \`CompiledStateGraph\`
- [x] Umbrella streaming graph imports + boots with only \`streaming\` registered
- [x] \`nx e2e cockpit-langgraph-streaming-angular\` passes
- [x] \`nx e2e cockpit-chat-tool-calls-angular\` passes
- [x] \`nx e2e cockpit-chat-subagents-angular\` passes
- [ ] CI \`Cockpit — e2e\` + \`Cockpit — build all examples\` green
- [ ] **Post-merge:** Deploy LangGraph workflow green (gates PR 2)

## Rollback
If post-merge Deploy LangGraph fails, revert this PR. The umbrella's c-* source files still exist on the prior commit, so reverting restores the original deploy path.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

```bash
gh pr checks <PR#>
```

Required to pass: Cockpit — e2e, Cockpit — build all examples, Cockpit — build / test, Cockpit — deploy smoke dry-run.

- [ ] **Step 4: Merge on green**

```bash
gh pr merge <PR#> --squash --delete-branch
```

---

## Task 9 (PR 1): Post-merge — watch Deploy LangGraph (orchestrator gates PR 2)

- [ ] **Step 1: Watch the post-merge Deploy LangGraph run**

```bash
gh run list --workflow=deploy-langgraph.yml --limit 1 --json status,conclusion,url,createdAt --jq '.[0]'
```

The workflow triggers automatically on merge to main (paths-filtered to `cockpit/**/python/**`). Wait ~3-5 minutes for it to run.

```bash
# Poll
while true; do
  status=$(gh run list --workflow=deploy-langgraph.yml --limit 1 --json status,conclusion --jq '.[0]')
  echo "$status"
  echo "$status" | grep -q '"status":"completed"' && break
  sleep 30
done
```

- [ ] **Step 2: Determine outcome**

If `conclusion=success`: PR 2 may proceed.

If `conclusion=failure`: fetch the failing job's log:

```bash
gh run view --log-failed $(gh run list --workflow=deploy-langgraph.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

Report the failure. Do NOT proceed to PR 2. Revert PR 1:

```bash
gh pr create --title "Revert: umbrella cleanup PR 1" --body "Reverting PR <#> — Deploy LangGraph failed post-merge. See run for details." --base main
# OR use gh pr revert if available
```

---

# PR 2: Delete dead umbrella source files

## Task 10 (PR 2): Pre-flight verify (no commit)

Run AFTER PR 1 has merged + Deploy LangGraph is green.

- [ ] **Step 1: Fresh branch off origin/main (which includes PR 1)**

```bash
git fetch origin
git checkout -b claude/umbrella-cleanup-pr2 origin/main
git log --oneline -3
```

Expected: top commit is the squash-merged PR 1.

- [ ] **Step 2: Confirm umbrella manifest is the trimmed version (from PR 1)**

```bash
python3 -c "import json; d=json.load(open('cockpit/langgraph/streaming/python/langgraph.json')); assert sorted(d['graphs']) == ['streaming'], d['graphs']; print('OK — 1 graph')"
```

Expected: `OK — 1 graph`. If this fails, PR 1 didn't merge as expected — STOP.

- [ ] **Step 3: Confirm umbrella src still has the 6 dead files (about to delete)**

```bash
wc -l cockpit/langgraph/streaming/python/src/chat_graphs.py \
       cockpit/langgraph/streaming/python/src/a2ui_graph.py \
       cockpit/langgraph/streaming/python/src/dashboard_graph.py \
       cockpit/langgraph/streaming/python/src/dashboard_tools.py \
       cockpit/langgraph/streaming/python/src/aviation_data.py \
       cockpit/langgraph/streaming/python/src/aviation_tools.py
```

Expected: each file present, total in the 1300–1400 line range.

- [ ] **Step 4: Repo-wide grep for external consumers of deleted symbols (live code only)**

```bash
grep -rln "cockpit/langgraph/streaming/python/src/\(chat_graphs\|a2ui_graph\|dashboard_graph\|dashboard_tools\|aviation_data\|aviation_tools\)\|streaming\.python\.src\.\(chat_graphs\|a2ui_graph\|dashboard_graph\|dashboard_tools\|aviation_data\|aviation_tools\)" \
  --include='*.py' --include='*.ts' --include='*.tsx' --include='*.json' --include='*.yml' \
  . 2>/dev/null \
  | grep -v node_modules | grep -v __pycache__ | grep -v venv | grep -v dist | grep -v test-results \
  | grep -v '\.claude/worktrees/' | grep -v '/docs/superpowers/'
```

Expected: zero matches OUTSIDE the umbrella's own src dir (the dead files import each other; those don't count since we're deleting all of them together).

If matches appear in live code outside the umbrella, STOP and investigate — there's an unexpected consumer.

---

## Task 11 (PR 2): Delete the six dead files

**Files:**
- Delete: `cockpit/langgraph/streaming/python/src/chat_graphs.py`
- Delete: `cockpit/langgraph/streaming/python/src/a2ui_graph.py`
- Delete: `cockpit/langgraph/streaming/python/src/dashboard_graph.py`
- Delete: `cockpit/langgraph/streaming/python/src/dashboard_tools.py`
- Delete: `cockpit/langgraph/streaming/python/src/aviation_data.py`
- Delete: `cockpit/langgraph/streaming/python/src/aviation_tools.py`

- [ ] **Step 1: Remove via `git rm`**

```bash
git rm cockpit/langgraph/streaming/python/src/chat_graphs.py \
       cockpit/langgraph/streaming/python/src/a2ui_graph.py \
       cockpit/langgraph/streaming/python/src/dashboard_graph.py \
       cockpit/langgraph/streaming/python/src/dashboard_tools.py \
       cockpit/langgraph/streaming/python/src/aviation_data.py \
       cockpit/langgraph/streaming/python/src/aviation_tools.py
```

Expected output: 6 `rm '…'` lines.

- [ ] **Step 2: Confirm src dir now has only the survivors**

```bash
ls cockpit/langgraph/streaming/python/src/
```

Expected: `graph.py  index.ts` (plus `__pycache__/` if present — ignore).

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore(cockpit-streaming): delete now-dead duplicate c-* graph source

PR 1 of the umbrella cleanup re-routed the shared-dev deployment to
source c-* graphs from per-cap dirs. With production deploy validated
green post-PR-1, these umbrella copies are truly dead code.

Deleted (1382 lines total):
- chat_graphs.py (198 lines) — c-* prompt-graph factories + re-exports
- a2ui_graph.py (632 lines) — c-a2ui LLM-driven booking graph
- dashboard_graph.py (177 lines) — c-generative-ui dashboard graph
- dashboard_tools.py (78 lines) — query_* tools for dashboard_graph
- aviation_data.py (207 lines) — KPI fixtures + airline/flight data
- aviation_tools.py (90 lines) — @tool wrappers around aviation_data

The umbrella's src/ now contains only graph.py (the streaming graph)
and index.ts (the nx hook). cockpit/langgraph/streaming/ is no longer
an "umbrella" in any sense — it's the streaming capability's own
per-cap backend, matching its 7 langgraph siblings.

Sub-project 6/6 of the per-cap migration chain — final PR.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12 (PR 2): Verify streaming graph still works post-deletion (no commit)

- [ ] **Step 1: Sync + import**

```bash
set -a; source examples/chat/python/.env 2>/dev/null || source cockpit/langgraph/streaming/python/.env 2>/dev/null; set +a
test -n "$OPENAI_API_KEY" && echo "key OK" || (echo "MISSING OPENAI_API_KEY — STOP"; exit 1)
(cd cockpit/langgraph/streaming/python && uv sync 2>&1 | tail -1)
(cd cockpit/langgraph/streaming/python && OPENAI_API_KEY="$OPENAI_API_KEY" uv run python -c "from src.graph import graph; print(type(graph).__name__)" 2>&1 | tail -1)
```

Expected: `CompiledStateGraph`. Any traceback STOPs — likely a residual import of a deleted file.

- [ ] **Step 2: Boot langgraph dev**

```bash
lsof -t -i :5500 2>/dev/null | xargs kill -9 2>/dev/null
(cd cockpit/langgraph/streaming/python && nohup env OPENAI_API_KEY="$OPENAI_API_KEY" uv run langgraph dev --no-browser --host 127.0.0.1 --port 5500 > /tmp/umbrella-cleanup-pr2-lg.log 2>&1 &)
until grep -qE "Application started up" /tmp/umbrella-cleanup-pr2-lg.log 2>/dev/null; do sleep 1; done
echo READY
grep -E "graph_id|Importing graph" /tmp/umbrella-cleanup-pr2-lg.log | head -5
lsof -t -i :5500 2>/dev/null | xargs kill -9 2>/dev/null
rm -f /tmp/umbrella-cleanup-pr2-lg.log
```

Expected: one `graph_id=streaming`, no traceback.

---

## Task 13 (PR 2): Verify shared-deploy manifest still works + regression e2es (no commit)

- [ ] **Step 1: Regenerate + check manifest**

```bash
npx tsx scripts/generate-shared-deployment-config.ts 2>&1 | tail -2
python3 -c "import json; d=json.load(open('deployments/shared-dev/langgraph.json')); print(len(d['graphs']),'graphs')"
git checkout HEAD -- deployments/shared-dev/langgraph.json
```

Expected: `26 graphs`. If different, STOP.

- [ ] **Step 2: Run the 3 cockpit aimock e2es**

```bash
npx nx e2e cockpit-langgraph-streaming-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-tool-calls-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-subagents-angular --skip-nx-cache
```

Expected: all three pass.

---

## Task 14 (PR 2): Final state grep (no commit)

- [ ] **Step 1: Confirm src dir contents**

```bash
ls cockpit/langgraph/streaming/python/src/
```

Expected: `graph.py  index.ts` (plus `__pycache__/`).

- [ ] **Step 2: Confirm no orphan references to deleted symbols inside the umbrella**

```bash
grep -rn 'chat_graphs\|dashboard_graph\|dashboard_tools\|a2ui_graph\|aviation_data\|aviation_tools' \
  cockpit/langgraph/streaming/ 2>/dev/null | grep -v __pycache__
```

Expected: zero matches.

- [ ] **Step 3: Confirm the deleted symbol names don't appear in any other live code**

```bash
grep -rn 'def c_messages\|def c_input\|def c_debug\|def c_interrupts\|def c_theming\|def c_threads\|def c_timeline\|def c_tool_calls\|def c_subagents' \
  --include='*.py' . 2>/dev/null \
  | grep -v node_modules | grep -v venv | grep -v __pycache__ | grep -v '\.claude/worktrees/'
```

Expected: zero matches. (These symbols only lived in the deleted `chat_graphs.py`.)

---

## Task 15 (PR 2): Push, open PR, watch CI, merge

Orchestrator task. Implementer STOPS after Task 14.

- [ ] **Step 1: Push**

```bash
git push -u origin claude/umbrella-cleanup-pr2
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "chore(cockpit-streaming): delete now-dead duplicate c-* graph source (umbrella cleanup PR 2/2)" --body "$(cat <<'EOF'
## Summary
Delete 1382 lines of dead duplicate c-* graph code from \`cockpit/langgraph/streaming/python/src/\`.

PR 1 (#<PR1>) re-routed the shared-dev deployment to source c-* graphs from per-cap dirs, and its post-merge Deploy LangGraph run was green. These umbrella copies are now truly dead — no consumer reads from them.

Deleted:
- \`chat_graphs.py\` (198 lines) — c-* prompt-graph factories + re-exports
- \`a2ui_graph.py\` (632 lines) — c-a2ui LLM-driven booking graph
- \`dashboard_graph.py\` (177 lines) — c-generative-ui dashboard graph
- \`dashboard_tools.py\` (78 lines) — query_* tools for dashboard_graph
- \`aviation_data.py\` (207 lines) — KPI fixtures + airline/flight data
- \`aviation_tools.py\` (90 lines) — @tool wrappers around aviation_data

The umbrella's \`src/\` now contains only \`graph.py\` (the streaming graph) + \`index.ts\`. \`cockpit/langgraph/streaming/\` is no longer an "umbrella" in any sense — it's the streaming capability's own per-cap backend, matching its 7 langgraph siblings.

**Final PR in the per-cap migration chain (sub-project 6/6).**

## Test plan
- [x] Pre-flight grep: no live-code consumers of deleted files
- [x] Umbrella streaming graph imports + boots clean
- [x] Generated shared-deploy manifest still has 26 graphs
- [x] \`nx e2e cockpit-langgraph-streaming-angular\` passes
- [x] \`nx e2e cockpit-chat-tool-calls-angular\` passes
- [x] \`nx e2e cockpit-chat-subagents-angular\` passes
- [x] Final grep: zero orphan references to deleted symbols
- [ ] CI \`Cockpit — e2e\` + \`Cockpit — build all examples\` green
- [ ] Post-merge: Deploy LangGraph still green (just to double-check)

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

- [ ] **Step 5: Post-merge — verify Deploy LangGraph still works**

```bash
gh run list --workflow=deploy-langgraph.yml --limit 1 --json status,conclusion,url
```

If it fails post-PR-2, revert PR 2. The streaming graph alone has no dependency on the deleted files, so a deploy failure here would indicate a transient issue rather than a real bug.

---

## Self-review notes

**Spec coverage:**
- PR 1 single-commit-atomic constraint → Task 2 Step 4.
- Deploy script filter change → Task 2 Step 1.
- Umbrella manifest trim → Task 2 Step 2.
- Manifest re-route verification (same 26 graphs, 11 paths change, 15 unchanged) → Task 3.
- Per-cap backends still boot → Task 4.
- Streaming graph still boots → Task 5.
- Regression e2es → Task 6 and Task 13.
- Post-merge Deploy LangGraph gate → Task 9.
- Six file deletions → Task 11.
- Pre-flight grep for hidden consumers → Task 10 Step 4.
- Final grep for orphans → Task 14.

**Placeholder scan:** none. Every step has exact code or commands with expected output.

**Type consistency:** umbrella path `cockpit/langgraph/streaming/python/...` consistent throughout. Filter pattern `product === 'render'` consistent. Branch names `claude/umbrella-cleanup-pr1` and `claude/umbrella-cleanup-pr2` consistent.

**Concurrency note:** shared-checkout warning + Task 1 pre-flight + Task 10 fresh-branch-off-origin/main cover the parallel-agent risk.
