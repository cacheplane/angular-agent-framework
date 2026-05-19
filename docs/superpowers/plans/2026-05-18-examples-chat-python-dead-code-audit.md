# examples/chat/python dead-code audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an audit report at `docs/superpowers/specs/2026-05-18-examples-chat-python-dead-code-audit-report.md` enumerating dead code in `examples/chat/python/src/` with static-reference + trace-coverage evidence, plus a clustered removal proposal. This plan ships only the report — code removal happens in follow-up PRs.

**Architecture:** Two evidence passes (static grep + coverage.py instrumentation driven by the 7 aimock fixtures), merged into a findings table. The instrumentation runs once and produces a committed `coverage.json` artifact the report cites. If `coverage.py` can't be wrapped around `langgraph dev` cleanly, fall back to a direct-invocation harness that replays each fixture's injected tool_calls against the graph — documented in the report.

**Tech Stack:** Python 3.12 + uv + coverage.py for the trace pass; bash + ripgrep for the static pass; Playwright + `@copilotkit/aimock` for fixture replay (existing infra at `examples/chat/angular/e2e/aimock-runner.ts`).

---

## File Structure

This plan produces ONE new file in the repo:

- **Create:** `docs/superpowers/specs/2026-05-18-examples-chat-python-dead-code-audit-report.md` — the audit report.

Working artifacts (not committed to the repo; kept under `/tmp/chat-py-dead-audit/audit-artifacts/`):

- `static-refs.tsv` — one row per top-level symbol: `file<TAB>line<TAB>kind<TAB>name<TAB>ref_count`.
- `trace-coverage.json` — coverage.py JSON output (per-line hit data).
- `findings.tsv` — merged: `file<TAB>line<TAB>kind<TAB>name<TAB>refs<TAB>hits<TAB>recommendation`.

Working directory is `/tmp/chat-py-dead-audit` throughout. All paths below are relative to that worktree root unless absolute.

---

### Task 1: Verify scope inventory matches the spec

**Files:**
- Read-only: `examples/chat/python/src/graph.py`, `examples/chat/python/src/streaming/*.py`, `examples/chat/python/src/schemas/*.py`.

- [ ] **Step 1: List in-scope files with line counts**

Run:
```bash
cd /tmp/chat-py-dead-audit && wc -l \
  examples/chat/python/src/graph.py \
  examples/chat/python/src/streaming/a2ui_partial_handler.py \
  examples/chat/python/src/streaming/envelope_normalizer.py \
  examples/chat/python/src/streaming/envelope_tool.py \
  examples/chat/python/src/schemas/a2ui_v1.py \
  examples/chat/python/src/schemas/json_render.py
```

Expected: each file listed; totals near the spec's stated LOC (graph 689, a2ui_partial 153, envelope_normalizer 36, envelope_tool 78, a2ui_v1 828, json_render 89; ~1900 total). Drift of ±10 LOC per file is fine; >50 LOC drift means the file changed since the spec was written — STOP and re-read the changed file before proceeding.

- [ ] **Step 2: Create artifacts directory**

Run: `mkdir -p /tmp/chat-py-dead-audit/audit-artifacts`

Expected: directory exists; `ls /tmp/chat-py-dead-audit/audit-artifacts` returns empty.

---

### Task 2: Build the static reference table

**Files:**
- Create: `/tmp/chat-py-dead-audit/audit-artifacts/static-refs.tsv`
- Helper: `/tmp/chat-py-dead-audit/audit-artifacts/extract-symbols.sh` (throwaway script — do not commit)

- [ ] **Step 1: Write the symbol extractor**

Create `/tmp/chat-py-dead-audit/audit-artifacts/extract-symbols.sh`:

```bash
#!/usr/bin/env bash
# Emits TSV: file<TAB>line<TAB>kind<TAB>name
# kind ∈ {def, class, const}. Top-level only (no leading whitespace).
set -euo pipefail
for f in "$@"; do
  awk -v file="$f" '
    /^def [A-Za-z_]/    { match($0, /^def ([A-Za-z_][A-Za-z0-9_]*)/, m); printf "%s\t%d\tdef\t%s\n",   file, NR, m[1]; next }
    /^async def [A-Za-z_]/ { match($0, /^async def ([A-Za-z_][A-Za-z0-9_]*)/, m); printf "%s\t%d\tdef\t%s\n", file, NR, m[1]; next }
    /^class [A-Za-z_]/  { match($0, /^class ([A-Za-z_][A-Za-z0-9_]*)/, m); printf "%s\t%d\tclass\t%s\n", file, NR, m[1]; next }
    /^[A-Z][A-Z0-9_]+ ?=/ { match($0, /^([A-Z][A-Z0-9_]+)/, m); printf "%s\t%d\tconst\t%s\n", file, NR, m[1]; next }
  ' "$f"
done
```

Make it executable: `chmod +x /tmp/chat-py-dead-audit/audit-artifacts/extract-symbols.sh`

- [ ] **Step 2: Run the extractor and verify output**

Run:
```bash
cd /tmp/chat-py-dead-audit && audit-artifacts/extract-symbols.sh \
  examples/chat/python/src/graph.py \
  examples/chat/python/src/streaming/a2ui_partial_handler.py \
  examples/chat/python/src/streaming/envelope_normalizer.py \
  examples/chat/python/src/streaming/envelope_tool.py \
  examples/chat/python/src/schemas/json_render.py \
  > audit-artifacts/symbols.tsv
wc -l audit-artifacts/symbols.tsv
head -5 audit-artifacts/symbols.tsv
```

Expected: at least 20 symbols extracted (graph.py alone has ~10 defs/classes). Top entries should include `_slice_title`, `search_documents`, `request_approval`, `ResearchState`, `State`, `should_continue`, `after_tools`, etc.

Note: `schemas/a2ui_v1.py` is excluded per the spec's non-goals (it's almost entirely one prompt blob).

- [ ] **Step 3: Write the reference counter**

Create `/tmp/chat-py-dead-audit/audit-artifacts/count-refs.sh`:

```bash
#!/usr/bin/env bash
# Reads symbols.tsv on stdin (file<TAB>line<TAB>kind<TAB>name), emits
# static-refs.tsv (file<TAB>line<TAB>kind<TAB>name<TAB>refs).
# Counts grep hits in src/ and tests/ EXCLUDING the file where the symbol
# was defined. Word-boundary match.
set -euo pipefail
ROOT=/tmp/chat-py-dead-audit/examples/chat/python
while IFS=$'\t' read -r file line kind name; do
  # rg returns lines like path:lineno:text. Count lines NOT in $file.
  count=$(rg --no-heading --line-number -w "$name" "$ROOT/src" "$ROOT/tests" 2>/dev/null \
    | awk -F: -v skip="$file" '$1 !~ skip' \
    | wc -l \
    | tr -d ' ')
  printf "%s\t%s\t%s\t%s\t%s\n" "$file" "$line" "$kind" "$name" "$count"
done
```

Make executable: `chmod +x /tmp/chat-py-dead-audit/audit-artifacts/count-refs.sh`

- [ ] **Step 4: Generate static-refs.tsv**

Run:
```bash
cd /tmp/chat-py-dead-audit && \
  audit-artifacts/count-refs.sh < audit-artifacts/symbols.tsv \
  > audit-artifacts/static-refs.tsv
sort -t$'\t' -k5,5n audit-artifacts/static-refs.tsv | head -20
```

Expected: file is non-empty; sorted-ascending top shows symbols with the lowest ref counts (likely 0 or 1). Note any symbol with `refs=0` — those are candidates for "remove" on the static pass alone.

- [ ] **Step 5: Sanity-spot-check one zero-ref candidate**

Pick the first symbol with `refs=0` from the sorted output. Manually grep to confirm:

```bash
# Replace <NAME> with the actual symbol name from the previous step.
cd /tmp/chat-py-dead-audit && rg -w '<NAME>' examples/chat/python/
```

Expected: only the definition site appears (and maybe a `__pycache__` hit, which is fine). If anything else shows up, the counter has a bug — fix it before proceeding (likely a path-skip issue).

- [ ] **Step 6: Commit a checkpoint note (no source code change yet)**

This is bookkeeping only. Append a one-line audit log so reviewers can see the methodology was followed:

Run:
```bash
cd /tmp/chat-py-dead-audit && \
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) static-refs.tsv generated ($(wc -l < audit-artifacts/static-refs.tsv) symbols)" \
  >> audit-artifacts/methodology.log
```

No git commit yet — `audit-artifacts/` is not committed; the report references this log when it's eventually written in Task 6.

---

### Task 3: Attempt coverage instrumentation of `langgraph dev`

**Files:**
- Modify (temporary, reverted at end of task): `examples/chat/python/pyproject.toml` (add `coverage` to dev-dependencies).
- Create (throwaway): `/tmp/chat-py-dead-audit/audit-artifacts/run-with-coverage.sh`

- [ ] **Step 1: Add coverage to the dev env**

Edit `examples/chat/python/pyproject.toml`, in the `[tool.uv]` `dev-dependencies` list, append `"coverage>=7.0"`:

```toml
[tool.uv]
dev-dependencies = [
    "langgraph-cli[inmem]>=0.1",
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "coverage>=7.0",
]
```

Then sync:

```bash
cd /tmp/chat-py-dead-audit/examples/chat/python && uv sync
```

Expected: `coverage` resolves and installs. Note: this edit is local to the worktree and will be reverted in Task 5 — it is NOT part of the committed audit-report PR.

- [ ] **Step 2: Verify coverage can wrap a trivial Python invocation**

Run:
```bash
cd /tmp/chat-py-dead-audit/examples/chat/python && \
  uv run coverage run --source=src -m pytest tests/test_graph_smoke.py -q && \
  uv run coverage report --include='src/*'
```

Expected: pytest passes; `coverage report` prints a table with at least `src/graph.py` and one or two `Miss` percentages. Capture the percentages — they confirm the static reachability the smoke tests exercise.

- [ ] **Step 3: Determine whether `coverage` can wrap `langgraph dev`**

Run a 10-second smoke:

```bash
cd /tmp/chat-py-dead-audit/examples/chat/python && \
  rm -f .coverage && \
  timeout 10 uv run coverage run --branch --source=src --parallel-mode \
    -m langgraph_cli dev --port 8123 --no-browser 2>&1 | tail -20
```

Expected outcomes — pick the matching branch:

  - **(A) Process boots, serves requests, exits on SIGTERM, leaves `.coverage.*` files**: instrumentation works. Proceed to Task 4 path A.
  - **(B) Process boots but `.coverage*` files are missing or empty after exit**: subprocess fanout not captured. Try `COVERAGE_PROCESS_START=$(pwd)/.coveragerc` with a `.coveragerc` containing `[run]\nbranch=True\nsource=src\nparallel=True`, plus a `sitecustomize.py` enabling `coverage.process_startup()`. Document the workaround attempt; if still empty, take Task 4 path B (fallback).
  - **(C) Process fails to boot under coverage** (errors before serving): take Task 4 path B (fallback).

Write the outcome to the log:

```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) coverage-wrap outcome: <A|B|C — short reason>" \
  >> /tmp/chat-py-dead-audit/audit-artifacts/methodology.log
```

---

### Task 4A: Trace pass via `coverage run` + fixture replay (path A only — skip if Task 3 gave B/C)

**Files:**
- Modify (temporary): `examples/chat/python/.coveragerc` if Task 3 needed the subprocess workaround.
- Create: `/tmp/chat-py-dead-audit/audit-artifacts/trace-coverage.json`

- [ ] **Step 1: Start instrumented langgraph dev**

In a background terminal (run with `run_in_background: true` if using the orchestrator's Bash tool):

```bash
cd /tmp/chat-py-dead-audit/examples/chat/python && \
  rm -f .coverage .coverage.* && \
  uv run coverage run --branch --source=src --parallel-mode \
    -m langgraph_cli dev --port 8123 --no-browser
```

Wait until stdout reports a listening port. Expected within ~15s.

- [ ] **Step 2: Run the angular e2e suite against it**

In a foreground shell:

```bash
cd /tmp/chat-py-dead-audit && \
  LANGGRAPH_API_URL=http://localhost:8123 \
  npx nx e2e examples-chat-angular --skip-nx-cache 2>&1 | tail -30
```

Expected: all aimock-driven e2es pass (or at least the 7 fixture-driven ones — `a2ui-single-bubble`, `interrupt-approval`, `markdown-surfaces`, `research-subagent`, `send-receive`, `stop-streaming`, plus any other that uses one of the 7 fixtures). If a fixture-unrelated spec fails for environmental reasons, that's noise — note it in the log but don't block.

- [ ] **Step 3: Stop the instrumented server and combine coverage data**

Send SIGTERM to the background process, then:

```bash
cd /tmp/chat-py-dead-audit/examples/chat/python && \
  uv run coverage combine && \
  uv run coverage json -o /tmp/chat-py-dead-audit/audit-artifacts/trace-coverage.json && \
  uv run coverage report --include='src/*'
```

Expected: `trace-coverage.json` written; `coverage report` shows non-zero coverage across `src/graph.py` and at least one streaming file. If `src/schemas/json_render.py` shows 0%, that's a real signal — record it.

- [ ] **Step 4: Log the outcome**

```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) trace-coverage.json generated (path A; coverage.py wrap)" \
  >> /tmp/chat-py-dead-audit/audit-artifacts/methodology.log
```

Skip Task 4B; proceed to Task 5.

---

### Task 4B: Trace pass via static analysis of fixtures (fallback — only if Task 3 gave B/C)

**Files:**
- Create: `/tmp/chat-py-dead-audit/audit-artifacts/fixture-tool-calls.tsv`
- Create: `/tmp/chat-py-dead-audit/audit-artifacts/trace-coverage.json` (hand-built, simplified shape)

- [ ] **Step 1: Extract tool names from each fixture**

Run:
```bash
cd /tmp/chat-py-dead-audit && \
  for f in examples/chat/angular/e2e/fixtures/*.json; do
    name=$(basename "$f" .json)
    rg -o '"name":\s*"[a-z_]+"' "$f" \
      | rg -o '"[a-z_]+"$' \
      | tr -d '"' \
      | sort -u \
      | while read -r tool; do printf "%s\t%s\n" "$name" "$tool"; done
  done | tee audit-artifacts/fixture-tool-calls.tsv
```

Expected: rows like `interrupt-approval<TAB>book_flight`, `research-subagent<TAB>research`, `a2ui-surface<TAB>render_a2ui_surface`, etc. Unique tool names form the "reachable" set.

- [ ] **Step 2: Build the reachable-symbol set**

For each unique tool name in `fixture-tool-calls.tsv`, the tool function in `graph.py` is reachable. Their helpers are reachable transitively. Build a reachable set by hand:

```bash
cd /tmp/chat-py-dead-audit && \
  cut -f2 audit-artifacts/fixture-tool-calls.tsv | sort -u > audit-artifacts/reachable-tools.txt
cat audit-artifacts/reachable-tools.txt
```

Then for each tool, grep the def body to find which helpers it calls and add them to the reachable set. This is a multi-step manual derivation — list each helper added to the set in `methodology.log` so reviewers can audit the chain.

- [ ] **Step 3: Synthesize a trace-coverage.json compatible with Task 5's merger**

Create a minimal JSON shape that Task 5 can read. Shape (one entry per in-scope file):

```json
{
  "files": {
    "src/graph.py": {
      "executed_lines": [<list of line numbers reachable from the tool set>],
      "missing_lines": [<all other line numbers in the file>]
    }
  }
}
```

Write `/tmp/chat-py-dead-audit/audit-artifacts/trace-coverage.json` with this shape, using the reachable-symbol set's line ranges (look up each reachable symbol's start line from `audit-artifacts/symbols.tsv` and approximate the def's range by reading until the next top-level `def`/`class`).

- [ ] **Step 4: Log the fallback decision**

```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) trace-coverage.json generated (path B; static fixture analysis fallback)" \
  >> /tmp/chat-py-dead-audit/audit-artifacts/methodology.log
```

---

### Task 5: Merge into findings table and revert temporary edits

**Files:**
- Modify (revert): `examples/chat/python/pyproject.toml` — remove the `coverage` line added in Task 3.
- Create: `/tmp/chat-py-dead-audit/audit-artifacts/findings.tsv`

- [ ] **Step 1: Write the merger**

Create `/tmp/chat-py-dead-audit/audit-artifacts/merge.py`:

```python
#!/usr/bin/env python3
"""Merge static-refs.tsv + trace-coverage.json into findings.tsv."""
import json
import csv
import sys
from pathlib import Path

ART = Path("/tmp/chat-py-dead-audit/audit-artifacts")
ROOT = Path("/tmp/chat-py-dead-audit")

# LLM-exported tool names — never auto-remove these; flag as "keep-with-note"
# when trace-dead. Pulled from graph.py's tool list.
LLM_TOOLS = {
    "search_documents",
    "request_approval",
    "research",
    "render_a2ui_surface",
    "generate_json_render_spec",
    # If graph.py registers more tools, add them here. Cross-check by grepping
    # for @tool decorators in graph.py.
}

with open(ART / "trace-coverage.json") as f:
    cov = json.load(f)


def hits_for_line(file_rel: str, line: int) -> int:
    entry = cov["files"].get(file_rel)
    if not entry:
        return 0
    return 1 if line in entry.get("executed_lines", []) else 0


def classify(refs: int, hits: int, kind: str, name: str) -> str:
    if name in LLM_TOOLS and hits == 0:
        return "keep-with-note"
    if refs == 0:
        return "remove"
    if hits == 0 and kind in {"def", "class"}:
        return "remove"
    return "keep"


rows_out = []
with open(ART / "static-refs.tsv") as f:
    reader = csv.reader(f, delimiter="\t")
    for file_abs, line, kind, name, refs in reader:
        file_rel = str(Path(file_abs).relative_to(ROOT))
        # coverage.json uses paths relative to where coverage ran; normalize
        # both formats by trying both.
        cov_key_1 = file_rel  # e.g. examples/chat/python/src/graph.py
        cov_key_2 = file_rel.split("examples/chat/python/")[-1]  # src/graph.py
        hits = hits_for_line(cov_key_1, int(line)) or hits_for_line(cov_key_2, int(line))
        rec = classify(int(refs), hits, kind, name)
        rows_out.append([file_rel, line, kind, name, refs, hits, rec])

with open(ART / "findings.tsv", "w") as f:
    w = csv.writer(f, delimiter="\t")
    w.writerow(["file", "line", "kind", "name", "static_refs", "trace_hits", "recommendation"])
    w.writerows(rows_out)

# Print summary to stdout for the operator.
from collections import Counter
counts = Counter(r[6] for r in rows_out)
print(f"Total symbols: {len(rows_out)}")
for rec, n in sorted(counts.items()):
    print(f"  {rec}: {n}")
```

- [ ] **Step 2: Run the merger**

```bash
cd /tmp/chat-py-dead-audit && python3 audit-artifacts/merge.py
```

Expected: prints summary like `Total symbols: N`, `keep: X`, `remove: Y`, `keep-with-note: Z`. Verify `findings.tsv` exists and has a header row plus one row per symbol from `static-refs.tsv`.

- [ ] **Step 3: Spot-check three findings**

Pick the first `remove` row, the first `keep-with-note` row (if any), and the first `keep` row with low hits. For each, manually grep the symbol name to confirm the classification is sane:

```bash
cd /tmp/chat-py-dead-audit && rg -w '<NAME>' examples/chat/python/
```

If a `remove` row shows real callers the merger missed, the static counter has a bug — fix and re-run from Task 2 Step 4.

- [ ] **Step 4: Revert the temporary pyproject.toml edit**

```bash
cd /tmp/chat-py-dead-audit && git checkout examples/chat/python/pyproject.toml
```

Verify:
```bash
cd /tmp/chat-py-dead-audit && git diff examples/chat/python/pyproject.toml
```

Expected: no diff. The audit-report PR must not touch `pyproject.toml`.

- [ ] **Step 5: Verify the umbrella still passes its smoke tests post-revert**

```bash
cd /tmp/chat-py-dead-audit/examples/chat/python && uv sync && uv run pytest -q
```

Expected: all tests pass. If `coverage` is now missing and a test imports it, that's a bug introduced by Task 3 that wasn't reverted — investigate before proceeding.

---

### Task 6: Write the audit report

**Files:**
- Create: `docs/superpowers/specs/2026-05-18-examples-chat-python-dead-code-audit-report.md`

- [ ] **Step 1: Draft the report skeleton**

Create `/tmp/chat-py-dead-audit/docs/superpowers/specs/2026-05-18-examples-chat-python-dead-code-audit-report.md` with this structure (fill in concrete content from artifacts):

```markdown
# examples/chat/python dead-code audit — report

> **Design:** `docs/superpowers/specs/2026-05-18-examples-chat-python-dead-code-audit-design.md`

## Methodology

[Two-pass: static reference grep (Task 2) + trace coverage via {path A: coverage.py wrapping langgraph dev / path B: static fixture analysis fallback} (Task 4{A|B}). Cite which path was used and why.]

Coverage artifact: see `audit-artifacts/trace-coverage.json` in the audit working directory (not committed; reproducible via the plan).

## Scope

| File | LOC | Symbols in scope |
|---|---|---|
| [from Task 1 Step 1 output + symbol counts from symbols.tsv] |

## Findings

[Render findings.tsv as a markdown table, sorted by file then line. Columns:
file:line | kind | name | static refs | trace hits | recommendation | notes]

[For each `keep-with-note` row, add a "notes" sentence explaining why
(LLM-exported tool not exercised by any fixture).]

## Removal clusters

[Group all `remove` findings into 2-4 clusters by file locality. For each cluster:
- **Cluster N: <name>** — N items, all in <file>. Suggested PR title: "...".
- List the items.]

## Acceptance status

- [x] Audit report exists and is committed.
- [x] Every in-scope symbol classified.
- [x] Cluster proposal lists 2-4 clusters.
- [ ] Cluster 1 removed (deferred to follow-up PR).
- [ ] Cluster 2 removed (deferred to follow-up PR).
- [...one checkbox per cluster, all unchecked]
```

- [ ] **Step 2: Fill in the findings table**

Convert `audit-artifacts/findings.tsv` into a markdown table inside the `## Findings` section. Sort by `file` then `line`. Keep the column order from the TSV plus a "notes" column for `keep-with-note` entries.

You can use:

```bash
cd /tmp/chat-py-dead-audit && \
  awk -F'\t' 'NR==1 { print "| "$1" | "$2" | "$3" | "$4" | "$5" | "$6" | "$7" | notes |"; \
                      print "|---|---|---|---|---|---|---|---|"; next } \
              { print "| "$1" | "$2" | "$3" | "$4" | "$5" | "$6" | "$7" | |" }' \
  audit-artifacts/findings.tsv
```

Paste the output into the report's `## Findings` section.

- [ ] **Step 3: Fill in cluster proposals**

For each `remove` row in `findings.tsv`, assign it to a cluster based on its file path:
- Items in `src/streaming/` → Cluster "streaming/ unused helpers".
- Items in `src/schemas/json_render.py` → Cluster "json_render unused exports".
- Items in `src/graph.py` with names starting `_` → Cluster "graph.py private helpers".
- Items in `src/graph.py` not starting `_` (rare — non-LLM-tool, non-helper, but unreferenced) → Cluster "graph.py misc".

Skip empty clusters. Final cluster count should be 1-4.

- [ ] **Step 4: Add the acceptance checklist**

One unchecked checkbox per cluster from Step 3. Check the boxes for "Audit report exists", "Every symbol classified", and "Cluster proposal lists 2-4 clusters" — these are true as of this PR.

- [ ] **Step 5: Spot-review the rendered report**

```bash
cd /tmp/chat-py-dead-audit && \
  wc -l docs/superpowers/specs/2026-05-18-examples-chat-python-dead-code-audit-report.md && \
  head -20 docs/superpowers/specs/2026-05-18-examples-chat-python-dead-code-audit-report.md
```

Expected: report is non-empty (likely 100-300 lines depending on symbol count). Header looks right. Open the file in an editor and visually confirm the table renders cleanly (no broken pipes, no rows with missing columns).

- [ ] **Step 6: Commit the report**

```bash
cd /tmp/chat-py-dead-audit && \
  git add docs/superpowers/specs/2026-05-18-examples-chat-python-dead-code-audit-report.md && \
  git diff --cached --stat
```

Expected stat: one new file added; no other changes (audit-artifacts/ is outside the repo tree; pyproject.toml was reverted in Task 5 Step 4).

Then commit:
```bash
cd /tmp/chat-py-dead-audit && git commit -m "$(cat <<'EOF'
docs: audit report for examples/chat/python dead code

Static-reference + trace-coverage analysis of examples/chat/python/src/.
Identifies N candidates for removal, grouped into M clusters for
follow-up PRs. See design doc for methodology.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Open the PR

**Files:** none changed; PR creation only.

- [ ] **Step 1: Push the branch**

```bash
cd /tmp/chat-py-dead-audit && git push -u origin claude/chat-py-dead-audit
```

- [ ] **Step 2: Open the PR**

```bash
cd /tmp/chat-py-dead-audit && gh pr create \
  --title "docs: examples/chat/python dead-code audit (Task #3)" \
  --body "$(cat <<'EOF'
## Summary
- Adds dead-code audit report for `examples/chat/python/src/` per design spec `docs/superpowers/specs/2026-05-18-examples-chat-python-dead-code-audit-design.md`.
- Methodology: static reference grep + trace coverage via aimock fixture replay.
- Identifies N candidates grouped into M clusters; removal deferred to follow-up PRs.
- No code in `examples/chat/python/src/` modified by this PR.

## Test plan
- [ ] CI: docs-only change; expect Cockpit/Examples gates to skip or no-op.
- [ ] Reviewer: spot-check 2-3 findings against the codebase.
- [ ] Reviewer: confirm cluster proposal makes sense for follow-up PRs.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Save it; the orchestrator will track CI from there.

---

## Self-Review

**Spec coverage:**
- Scope inventory → Task 1.
- Static methodology → Task 2.
- Trace methodology (primary + fallback) → Task 3 + Task 4A/4B.
- Findings classification rules (remove/keep-with-note/defer) → Task 5 Step 1 (`classify()` function encodes the spec's rules).
- Removal clusters → Task 6 Step 3.
- Deliverable (audit report file path + structure) → Task 6.
- Verification (smoke tests post-revert) → Task 5 Step 5.
- Acceptance criteria (single new file in diff, no src/ changes) → Task 6 Step 6 + Task 5 Step 4.

**Placeholder scan:** Searched plan for "TBD", "TODO", "implement later", "similar to" — none found. Each step has either a concrete code block or a concrete command.

**Type consistency:** Path conventions are consistent (`/tmp/chat-py-dead-audit/...` absolute; relative paths under it where unambiguous). Artifact filenames match across tasks: `symbols.tsv` → `static-refs.tsv` → `findings.tsv` → markdown table. The `classify()` function's input columns match `static-refs.tsv`'s column order from Task 2 Step 3.

One ambiguity surfaced + resolved: the `LLM_TOOLS` set in Task 5 Step 1 lists 5 known tools; Task 5 Step 1 instructs the implementer to cross-check by grepping for `@tool` decorators in graph.py and add any missing names. That's explicit, not a placeholder.
