# examples/chat/python dead-code audit — design

> **Place in the larger plan.** Task #3 in the post-PR-#432 cleanup arc. After the umbrella → per-cap migration moved cockpit chat backends out of `examples/chat/python`, the umbrella remains live (still the backend for the canonical `examples/chat/angular` demo and deployed to LangSmith as the `examples-chat` alias) — but likely accumulated dead helpers, branches, and tools the migration left behind. This task identifies them with high confidence before any removal.

## Goal

Enumerate dead code inside `examples/chat/python/src/` (graph.py + streaming/ + schemas/) using both static reference analysis and recorded-trace coverage. Produce an audit report; defer removal to follow-up PRs (one per cluster).

## Non-goals

- Touching `cockpit/chat/*/python/` or any per-cap code (out of scope; per-cap caps audited separately if needed).
- Refactoring `graph.py` for clarity or splitting it (689 LOC; structural cleanup is a separate task).
- Editing `schemas/a2ui_v1.py` (828 LOC; almost entirely a single prompt blob — surgical dead-code removal within it is not worth the risk).
- Removing LLM-exported tools without explicit user approval — see "Keep with note" recommendation below.
- Modifying the canonical demo's behavior, deployment surface, or shared LangSmith manifest entries.

## Scope inventory

In-scope files (~1900 LOC total):

| File | LOC | Notes |
|---|---|---|
| `examples/chat/python/src/graph.py` | 689 | Main StateGraph; LLM-exported tools, routing, helpers |
| `examples/chat/python/src/streaming/a2ui_partial_handler.py` | 153 | Partial-JSON envelope handling |
| `examples/chat/python/src/streaming/envelope_normalizer.py` | 36 | Tool-call arg normalization |
| `examples/chat/python/src/streaming/envelope_tool.py` | 78 | `render_a2ui_surface` tool definition |
| `examples/chat/python/src/schemas/a2ui_v1.py` | 828 | Schema prompt blob — out of scope per non-goals |
| `examples/chat/python/src/schemas/json_render.py` | 89 | Schema prompt for `generate_json_render_spec` |

Test directory (`examples/chat/python/tests/`) counts as a consumer for static reference analysis but is not itself audited.

## Methodology — static pass

For each top-level `def`, `class`, and module-level constant in scope:

1. `grep -rn '\b<name>\b' examples/chat/python/{src,tests}` excluding the definition file's self-references.
2. Record reference count.
3. Zero non-self references → **statically dead**.

Imports are handled separately: a `from src.foo import bar` line in the consuming file counts as one reference to `bar`. Re-exports through `__init__.py` are checked but neither file has interesting `__all__`.

## Methodology — trace pass

Recorded fixtures define the demo's intended behavior. If a tool or branch is unreached by every fixture, it's not part of demo behavior even if statically reachable.

**Fixtures** (in `examples/chat/angular/e2e/fixtures/`):
`a2ui-surface.json`, `contact-form.json`, `hi.json`, `interrupt-approval.json`, `markdown.json`, `research-subagent.json`, `streaming.json`.

**Mechanics:**

1. Install `coverage.py` in the umbrella's `uv` env (dev-only — not added to runtime deps).
2. Boot `langgraph dev` from `examples/chat/python` under `coverage run --source=src --branch -m langgraph_cli dev …` (or equivalent — implementer determines exact incantation; if `langgraph dev` resists coverage instrumentation, fall back to driving the graph via `tests/test_graph_smoke.py`-style direct invocation, replaying recordings as scripted inputs).
3. For each fixture, drive the angular app via its existing aimock runner (`examples/chat/angular/e2e/aimock-runner.ts`).
4. After all fixtures run, `coverage report --include='src/*'` to get per-file coverage and `coverage json` for machine-readable per-line hits.
5. Map covered lines back to enclosing `def`/`class` to derive per-symbol hit counts and per-branch hit counts.

**Fallback if coverage instrumentation is impractical:** use static analysis of recordings — extract injected `tool_calls` names from each fixture's JSON, build a call graph from `graph.py`'s routing (`should_continue`, `after_tools`, tool registration list), conclude which tools and branches are reachable. Document the fallback in the report if used; flag as lower-confidence.

## Findings classification

Per item, the report records:

| Field | Values |
|---|---|
| Location | `file:lineno` |
| Kind | tool / helper / branch / constant / import / class |
| Static refs | count (excluding self-file) |
| Trace hits | count (across 7 fixtures) |
| Recommendation | remove / keep-with-note / defer |

**Recommendation rules:**

- **Remove** — 0 static refs OR (0 trace hits AND not an LLM-exported tool definition).
- **Keep with note** — LLM-exported tool with 0 trace hits. These define the demo's exported surface area; flag for a separate "do we still want this in the demo?" decision. Do not auto-remove.
- **Defer** — anything inside `schemas/a2ui_v1.py` (out of scope); anything where evidence is ambiguous (e.g., dynamic dispatch via string lookup that the trace pass can't resolve). Document the ambiguity.

## Removal clusters

Findings are grouped into clusters by file locality. Expected clusters (exact list depends on findings):

1. `streaming/` unused helpers and exports.
2. `graph.py` unused private helpers (functions starting with `_` that nothing calls).
3. `graph.py` unused conditional-edge branches (e.g., a `should_continue` return label nothing routes to).
4. `schemas/json_render.py` unused exports (if any).

Each cluster becomes one follow-up PR after the audit lands.

## Deliverables

### Phase 1 (this design's plan)

`docs/superpowers/specs/2026-05-18-examples-chat-python-dead-code-audit-report.md` — the audit report. Contains:

- Methodology recap (~1 paragraph linking to this design).
- Inventory of scope files with LOC.
- Findings table (all items, sorted by file then line).
- Cluster proposals (which findings go in which removal PR).
- Coverage artifact reference (committed `coverage.json` or summary).

Committed standalone; no code removals in this PR.

### Phase 2 (follow-up PRs, out of scope for this design)

One PR per cluster. Each:

- Removes only that cluster's items.
- Updates tests if any reference removed symbols.
- Verifies `uv run pytest examples/chat/python` passes.
- Verifies `nx e2e examples-chat-angular` passes (full aimock suite).
- Verifies `npx tsx scripts/generate-shared-deployment-config.ts` succeeds and manifest unchanged.
- Updates the audit report to check off the cluster.

## Verification (for Phase 1 — the audit itself)

- `coverage.py` instrumentation installed in `examples/chat/python`'s uv env; `coverage run` produces a `.coverage` file after fixture replay.
- All 7 fixtures successfully drive the graph; no fixtures error out under instrumentation.
- `coverage report` shows per-line hit data for every in-scope file.
- Findings table cross-checked: every static-dead item also shows 0 coverage; every trace-dead item is verified-reachable in static reference graph (sanity check).
- Audit report renders cleanly in GitHub markdown preview.
- No code in `examples/chat/python/src/` is modified by Phase 1.

## Risk surface

- **coverage.py compatibility with `langgraph dev`.** The langgraph CLI spawns subprocesses; coverage instrumentation may not capture them cleanly. Fallback path documented above (direct invocation via test-style harness, or static-only trace inference) keeps Phase 1 unblocked.
- **Aimock fixtures may not exercise rare branches** (error paths, edge-case routing). The combined static+trace view handles this: static pass catches genuinely unreferenced items even when trace coverage is thin.
- **False positives on dynamic dispatch.** `graph.py` registers tools as a list and looks up by name. The trace pass handles this correctly (coverage sees the actual execution); the static pass treats tool-name strings as references — implementer must check string literals when grepping for tool names.
- **`schemas/a2ui_v1.py` exclusion is opinionated.** If meaningful dead code lives inside its 828 LOC, this audit misses it. Documented as a known limit.

## Acceptance criteria

- Audit report exists at `docs/superpowers/specs/2026-05-18-examples-chat-python-dead-code-audit-report.md` and is committed.
- Report's findings table lists every top-level symbol in scope with its classification.
- Each "remove" recommendation has both 0 static refs documented AND (where coverage instrumentation succeeded) 0 trace hits, with the source command output cited.
- Each "keep-with-note" item is clearly flagged with its LLM-tool name and the rationale for the note.
- Cluster proposal section names 2-4 clusters and lists which findings belong to each.
- No code in `examples/chat/python/src/` is modified.
- `git diff main` for the audit PR shows only the report file added.
