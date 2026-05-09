# Canonical `examples/chat` Demo — Phase 4: Generative UI / A2UI Surfaces

**Date:** 2026-05-09
**Status:** Approved
**Phase:** 4 of the canonical demo roadmap
**Builds on:** Phase 1 (#213) + Phase 2A (#216) + Phase 2B (#220) + smoke fixes (#217 #218 #219 #221) + Phase 3A (#222 #223) + Phase 3B (#224 #225)

## Goal

Layer Generative UI / A2UI surfaces onto the canonical demo by adding a `render_demo_form` tool the parent LLM can dispatch. The tool routes through a deterministic post-process node that synthesizes an `AIMessage` whose content carries the A2UI wire-format prefix and a hardcoded JSONL surface spec. The existing `<chat>` composition's content classifier auto-detects the prefix and renders the surface via `<a2ui-surface>` (already mounted by the composition). Submitting the form's button round-trips through the existing `agent.submit` path with no extra plumbing.

## Why hardcoded JSONL

The cockpit's existing A2UI graph (`cockpit/chat/a2ui/python/src/graph.py`) documents the constraint directly:

> The graph does NOT use an LLM for UI generation — A2UI JSONL requires exact format adherence that LLMs cannot reliably provide.

A2UI envelopes nest DynamicValue path refs (`{"path": "/name"}`), CheckRule predicates, and tightly-named fields (`surfaceId`, `catalogId`, `componentId`). A single swapped field name or dropped comma breaks the parser. Schema-exact streaming JSON is not a reliable LLM capability today. Phase 4 keeps the AI involved in deciding *when* to render but keeps it out of the schema-correctness critical path.

## Approaches considered

- **Pure prefix-from-LLM** — instruct the LLM in `SYSTEM_PROMPT` to emit `---a2ui_JSON---\n` followed by JSONL. Rejected per the cockpit constraint: unreliable across models, fragile under streaming, silent failures with no good fallback.
- **Separate `/forms` route running the cockpit graph** — clean isolation but breaks the unified canonical demo (Phase 1's "everything lives in three composition modes against one graph"). Rejected.
- **Tool + deterministic post-process node (chosen)** — AI calls `render_demo_form`; routing diverts to a new `emit_a2ui_surface` node that synthesizes the satisfying `ToolMessage` plus a new `AIMessage` carrying the prefix + hardcoded JSONL. Mirrors the existing `attach_citations` post-process pattern from Phase 2B and the `request_approval` tool-driven dispatch from Phase 3A. Selected because it keeps the unified graph, lets the AI decide intent, and pins the schema correctness in Python.

## Python graph

### `render_demo_form` tool

```python
@tool
def render_demo_form(form_type: str = "feedback") -> str:
    """Render an interactive A2UI surface in the chat. Use this when the
    user asks to see a form, render UI, or display an interactive card.
    `form_type` is a hint; the demo currently supports "feedback".
    Returns a marker the graph reads to inject the surface."""
    # Body returns a stable marker; the actual rendering happens in the
    # `emit_a2ui_surface` post-process node, which detects the tool_call
    # and synthesizes the A2UI AIMessage.
    return f"a2ui:render:{form_type}"
```

The tool is bound to the parent LLM via `bind_tools` and exposed in the `tools` ToolNode. Routing decides whether to use the regular `tools → generate` loop or to divert to `emit_a2ui_surface`.

### Routing change in `should_continue`

```python
def should_continue(state: State) -> Literal["tools", "emit_a2ui_surface", "attach_citations"]:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        for tc in last.tool_calls:
            if tc["name"] == "render_demo_form":
                return "emit_a2ui_surface"
        return "tools"
    return "attach_citations"
```

A `render_demo_form` tool_call short-circuits to the new node; any other tool_call falls through to the existing `tools → generate` loop. No edge added/removed at the existing `tools` node.

### `emit_a2ui_surface` node

```python
A2UI_PREFIX = "---a2ui_JSON---"

FEEDBACK_FORM_JSONL = "\n".join([
    json.dumps({"createSurface": {"surfaceId": "feedback", "catalogId": "basic", "sendDataModel": True}}),
    json.dumps({"updateDataModel": {"surfaceId": "feedback", "value": {"name": "", "rating": "5"}}}),
    json.dumps({"updateComponents": {"surfaceId": "feedback", "components": [
        {"id": "root", "component": "Column", "children": ["card"]},
        {"id": "card", "component": "Card", "title": "Quick feedback",
         "children": ["name_field", "rating_picker", "submit_btn"]},
        {"id": "name_field", "component": "TextField",
         "label": "Your name", "value": {"path": "/name"},
         "checks": [{"condition": {"call": "required", "args": {"value": {"path": "/name"}}},
                     "message": "Name is required"}]},
        {"id": "rating_picker", "component": "ChoicePicker",
         "label": "Rating", "options": ["1", "2", "3", "4", "5"],
         "selected": {"path": "/rating"}},
        {"id": "submit_btn", "component": "Button",
         "label": "Submit feedback",
         "action": {"event": {"name": "feedbackSubmit",
                              "context": {"surface": "feedback"}}}},
    ]}}),
]) + "\n"


async def emit_a2ui_surface(state: State) -> dict:
    last = state["messages"][-1]
    tc = next(t for t in (last.tool_calls or []) if t["name"] == "render_demo_form")
    return {"messages": [
        ToolMessage(content="rendered", tool_call_id=tc["id"]),
        AIMessage(content=A2UI_PREFIX + "\n" + FEEDBACK_FORM_JSONL),
    ]}
```

### Wiring

Three edits to `examples/chat/python/src/graph.py`:

1. Add `render_demo_form` tool, `A2UI_PREFIX`, `FEEDBACK_FORM_JSONL`, and `emit_a2ui_surface` async function.
2. Update `should_continue` return type and body to include `"emit_a2ui_surface"` branch.
3. Add the new node and edge:
   ```python
   _builder.add_node("emit_a2ui_surface", emit_a2ui_surface)
   _builder.add_edge("emit_a2ui_surface", "attach_citations")
   ```
   Update the `add_conditional_edges` map to include `"emit_a2ui_surface": "emit_a2ui_surface"`.
4. Add `render_demo_form` to `bind_tools([...])` and `ToolNode([...])`.
5. Extend `SYSTEM_PROMPT` with one paragraph: when the user asks to see a form / render UI / show a card, call `render_demo_form` rather than describing the UI in prose.

The terminal `attach_citations` no-ops on the synthesized AIMessage (the preceding ToolMessage contains "rendered", which `json.loads` rejects; the existing JSONDecodeError handler returns `{}`). No change needed there.

## Angular wiring

**Zero changes** to `examples/chat/angular/`. The `<chat>` composition already imports `A2uiSurfaceComponent` and routes form-action messages through `onA2uiAction → agent.submit(JSON.stringify(action))`. The content classifier (in `libs/chat/src/lib/streaming/content-classifier.ts`) detects the `---a2ui_JSON---` prefix and switches the message into A2UI rendering. The demo just needs:

- One welcome suggestion entry that triggers the AI to call `render_demo_form`:

```ts
{
  label: 'Demo: render an interactive A2UI surface',
  value:
    'Use the render_demo_form tool to show me a feedback card with name and rating fields.',
}
```

When the user later submits the form's Button, `<a2ui-surface>` emits an `A2uiActionMessage`; `<chat>` serializes it and calls `agent.submit(jsonString)` against the same graph; the existing `generate` LLM sees the JSON-shaped user message and responds conversationally. The reply becomes a normal markdown AIMessage — no special handling.

## TDD

`examples/chat/python/tests/test_graph_smoke.py` adds three tests:

```python
@pytest.mark.smoke
def test_render_demo_form_tool_exists():
    from src.graph import render_demo_form
    assert render_demo_form.name == "render_demo_form"


@pytest.mark.smoke
def test_state_graph_includes_emit_a2ui_surface_node():
    from src.graph import graph
    nodes = set(graph.get_graph().nodes.keys())
    assert "emit_a2ui_surface" in nodes
    assert "attach_citations" in nodes
    assert "tools" in nodes


@pytest.mark.smoke
def test_a2ui_jsonl_starts_with_prefix_and_parses():
    import json
    from src.graph import A2UI_PREFIX, FEEDBACK_FORM_JSONL
    full = A2UI_PREFIX + "\n" + FEEDBACK_FORM_JSONL
    lines = [ln for ln in full.split("\n") if ln.strip() and ln != A2UI_PREFIX]
    parsed = [json.loads(ln) for ln in lines]
    assert any("createSurface" in m for m in parsed)
    assert any("updateComponents" in m for m in parsed)
```

## Verification

### Server-side probe

`POST /threads/{tid}/runs/wait` with the welcome prompt; expect:
- AI message with `tool_calls=[{"name": "render_demo_form", ...}]`
- ToolMessage with content `"rendered"` and matching `tool_call_id`
- New AIMessage whose content begins with `---a2ui_JSON---\n` and includes `createSurface` / `updateComponents` envelopes
- Final state with `next: []`

### Live smoke

Reload the demo in Chrome; click the new welcome suggestion; expect:
- The chat-message bubble that arrives renders an A2UI surface (Card titled "Quick feedback") instead of plain markdown
- The Card has a TextField (Name), a ChoicePicker (Rating 1-5), and a Submit button
- Required-name validation: Submit disabled when name is empty; enabled when filled
- Click Submit → `<a2ui-surface>` emits the action; `<chat>` calls `agent.submit` with the JSON; the AI responds conversationally referencing the submitted name and rating

## Out of scope (deferred)

- **Multi-form catalog** — only `feedback` form. Other shapes (login, contact, settings) are Phase 4+ extensions.
- **Server-side action handling** — submission is handled by the existing `generate` LLM treating the JSON as a user message. No dedicated action-routing node.
- **Surface-level interrupts** — the A2UI surface does not call `interrupt()`. Composing 3A + 4 (a form that requests approval before submission) is out of scope for this PR.
- **Streaming JSONL emission** — Phase 4 emits the entire JSONL in one AIMessage. Token-by-token streaming of a surface (which `<a2ui-surface>` supports via the parser's `\n`-buffered apply) is not exercised.

## Files touched

| File | Change |
|---|---|
| `examples/chat/python/src/graph.py` | Add `A2UI_PREFIX`, `FEEDBACK_FORM_JSONL`, `render_demo_form` tool, `emit_a2ui_surface` node, routing branch, bind in 2 places, SYSTEM_PROMPT paragraph. |
| `examples/chat/python/tests/test_graph_smoke.py` | Three new tests. |
| `examples/chat/angular/src/app/modes/welcome-suggestions.ts` | One new entry. |
| `examples/chat/smoke/CHECKLIST.md` | Populate the Generative UI / A2UI surfaces section. |

Total ≈ 100 LOC.

## Phasing for the implementation plan

- Phase 0 — Branch creation
- Phase 1 — Python graph: TDD (failing render_demo_form + emit_a2ui_surface topology + JSONL prefix tests) → implement tool + JSONL constant + node + routing + bind + system prompt → tests pass
- Phase 2 — Welcome suggestion entry
- Phase 3 — CHECKLIST.md (Generative UI / A2UI surfaces section)
- Phase 4 — Verification (server-side probe confirming render_demo_form dispatches and synthesized AIMessage has the prefix) + PR
