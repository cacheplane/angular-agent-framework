# examples/chat/python dead-code audit — report

> **Design:** `docs/superpowers/specs/2026-05-18-examples-chat-python-dead-code-audit-design.md`

## Result

Zero symbols were found suitable for removal. All 28 in-scope top-level symbols carry at least one static reference outside their own definition line. Two LLM-exported tools — `search_documents` and `generate_json_render_spec` — are classified "keep-with-note" because no recorded fixture invokes them; this reflects a fixture-coverage gap, not dead code. Three plain-text fixtures (hi, markdown, streaming) invoke no tools at all, which is correct for their intent but means tool-side regressions in graph.py would not be caught by them. No follow-up removal PRs are needed; the recommended next steps are fixture-coverage additions (separate task, not this audit's deliverable).

## Methodology

**Task 2 — Static reference pass:** For each in-scope top-level symbol, a word-boundary grep was run across `examples/chat/python/src/` plus the project's test tree. The raw grep count minus 1 (for the definition line itself) is the `static_refs` value. All 28 symbols returned `static_refs ≥ 1`, so zero symbols were statically dead.

**Task 3 — Path-A skipped:** Because Task 2 showed every symbol referenced at least once, statement-level coverage instrumentation via `coverage.py` + `langgraph dev` was skipped. Statement-level data would not produce symbol-level remove candidates within this audit's scope; the ROI was zero.

**Task 4B — Trace pass (path-B static fixture analysis):** The seven recorded aimock fixtures (`a2ui-surface`, `contact-form`, `hi`, `interrupt-approval`, `markdown`, `research-subagent`, `streaming`) were parsed to extract tool-call names. That set was compared against the LLM-exported tools in `graph.py` to identify which tools are exercised by fixtures and which are not.

Artifacts:
- `audit-artifacts/symbols.tsv` — 28 symbols extracted
- `audit-artifacts/static-refs.tsv` — refs per symbol
- `audit-artifacts/fixture-tool-calls.tsv` — per-fixture tool calls
- `audit-artifacts/trace-coverage.json` — path-B fallback shape
- `audit-artifacts/findings.tsv` — merged findings (source for the table below)
- `audit-artifacts/methodology.log` — timestamped step log

## Scope

| File | LOC | Top-level symbols audited |
|---|---|---|
| `src/graph.py` | 689 | 20 |
| `src/streaming/a2ui_partial_handler.py` | 153 | 1 |
| `src/streaming/envelope_normalizer.py` | 36 | 1 |
| `src/streaming/envelope_tool.py` | 78 | 5 |
| `src/schemas/json_render.py` | 89 | 1 |
| `src/schemas/a2ui_v1.py` | 828 | 0 (excluded per design non-goals) |
| **Total in-scope symbols** | | **28** |

All paths are relative to `examples/chat/python/`.

## Findings

| file:line | kind | name | static refs | recommendation | note |
|---|---|---|---|---|---|
| `src/graph.py:55` | def | `_slice_title` | 8 | keep | |
| `src/graph.py:84` | def | `_maybe_write_thread_title` | 1 | keep | |
| `src/graph.py:133` | const | `SYSTEM_PROMPT` | 2 | keep | |
| `src/graph.py:185` | const | `REASONING_PREFIXES` | 1 | keep | |
| `src/graph.py:188` | def | `_is_reasoning_model` | 1 | keep | |
| `src/graph.py:195` | const | `DOCUMENTS` | 2 | keep | |
| `src/graph.py:230` | def | `search_documents` | 11 | **keep-with-note** | LLM-exported tool not exercised by any of 7 fixtures |
| `src/graph.py:250` | def | `request_approval` | 6 | keep | LLM-exported tool, reached by fixtures |
| `src/graph.py:265` | class | `ResearchState` | 2 | keep | |
| `src/graph.py:270` | def | `research_node` | 4 | keep | |
| `src/graph.py:296` | def | `research` | 17 | keep | LLM-exported tool, reached by fixtures |
| `src/graph.py:331` | const | `A2UI_PREFIX` | 2 | keep | |
| `src/graph.py:335` | def | `generate_json_render_spec` | 8 | **keep-with-note** | LLM-exported tool not exercised by any of 7 fixtures |
| `src/graph.py:349` | def | `_as_text` | 1 | keep | |
| `src/graph.py:364` | class | `State` | 19 | keep | |
| `src/graph.py:371` | def | `generate` | 15 | keep | |
| `src/graph.py:432` | def | `should_continue` | 1 | keep | |
| `src/graph.py:442` | def | `after_tools` | 1 | keep | |
| `src/graph.py:463` | def | `emit_generated_surface` | 17 | keep | |
| `src/graph.py:596` | def | `attach_citations` | 13 | keep | |
| `src/schemas/json_render.py:6` | const | `JSON_RENDER_SCHEMA_PROMPT` | 2 | keep | |
| `src/streaming/a2ui_partial_handler.py:43` | class | `A2uiPartialHandler` | 16 | keep | |
| `src/streaming/envelope_normalizer.py:17` | def | `normalize_envelope_args` | 9 | keep | |
| `src/streaming/envelope_tool.py:19` | class | `SurfaceUpdate` | 3 | keep | |
| `src/streaming/envelope_tool.py:27` | class | `BeginRendering` | 3 | keep | |
| `src/streaming/envelope_tool.py:34` | class | `DataModelUpdate` | 3 | keep | |
| `src/streaming/envelope_tool.py:43` | class | `A2uiEnvelope` | 7 | keep | |
| `src/streaming/envelope_tool.py:66` | def | `render_a2ui_surface` | 49 | keep | LLM-exported tool, reached by fixtures |

## Keep-with-note items

### `search_documents` (graph.py:230)

LLM-exported tool bound to the model in non-research modes. No recorded fixture (`a2ui-surface`, `contact-form`, `hi`, `interrupt-approval`, `markdown`, `research-subagent`, `streaming`) injects a `search_documents` tool call. The tool has 11 static references — it is wired into the graph — and its absence from fixtures reflects a coverage gap, not dead code. **Recommendation:** keep; flag for a separate "expand fixture coverage" task if recorded retrieval flows would be valuable.

### `generate_json_render_spec` (graph.py:335)

LLM-exported tool registered in `ToolNode` only when the graph runs in `gen_ui_mode='json-render'`. No fixture exercises json-render mode; only a2ui and plain-text modes are recorded. The tool has 8 static references. **Recommendation:** keep; flag for a separate "decide whether json-render mode is still a supported demo path" task. If yes, add a fixture; if no, consider removing the tool and the json-render mode branch together (out of this audit's scope).

## Cluster proposal

**No removal clusters proposed.** The audit found zero remove candidates. No follow-up removal PRs are needed at this time.

## Acceptance status

- [x] Audit report exists and is committed.
- [x] Every in-scope symbol classified (28/28).
- [x] Cluster proposal present (zero clusters — documented).
- [x] No code modifications to `examples/chat/python/src/`.

## Follow-up suggestions (out of scope for this audit)

1. Expand aimock fixture coverage so `search_documents` is exercised by at least one recorded conversation.
2. Decide whether json-render mode is a supported demo path. If yes, add a fixture; if no, propose removal of `generate_json_render_spec` and the json-render mode branch in a separate PR.
3. The 3 plain-text fixtures (hi, markdown, streaming) exercise zero tools. This is correct for their intent but means tool-side regressions in graph.py would not be caught by them — informational only.
