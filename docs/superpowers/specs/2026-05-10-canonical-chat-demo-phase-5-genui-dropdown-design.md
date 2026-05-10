# Canonical `examples/chat` Demo — Phase 5: GenUI Dropdown + Dynamic Schema Generation

**Date:** 2026-05-10
**Status:** Approved
**Phase:** 5 of the canonical demo roadmap
**Builds on:** Phase 1 (#213) + Phase 2A (#216) + Phase 2B (#220) + smoke fixes (#217 #218 #219 #221) + Phase 3A (#222 #223) + Phase 3B (#224 #225) + Phase 4 (#226 #227) + a2ui v1 migration (#228)

## Goal

Replace Phase 4's hardcoded `FEEDBACK_FORM_JSONL` path with **dynamic schema generation**. Add a palette `GenUI` dropdown that toggles between two protocols (`a2ui` / `json-render`); welcome suggestions are now generic intents ("build me a feedback form") that the LLM converts to a concrete schema by dispatching a protocol-specific sub-LLM tool. Each sub-LLM has the full canonical schema in its system prompt and runs at `temperature=0` for schema fidelity.

## Why dynamic now

Phase 4's hardcoded JSONL was a stepping stone: it proved the wire-format prefix routes correctly through the chat composition's content classifier and that the catalog renders. With v1 (#228) merged, the canonical Google A2UI v1 schema is now what `@ngaf/a2ui` actually parses — so a sub-LLM with that schema in its system prompt produces output the parser accepts. The pattern is proven in production at `~/repos/SC-CopilotKit-C1/L4/backend-dynamic/schema.py`. We adopt it here.

## Architecture

```
User clicks welcome suggestion ("build me a feedback form")
       ↓
state.gen_ui_mode = 'a2ui' | 'json-render' (palette-driven)
       ↓
generate node — parent LLM sees system prompt instructing it to
                dispatch generate_<mode>_schema(request) when user
                wants UI; passes user message verbatim as request
       ↓
tools node — runs generate_<mode>_schema, which invokes a NESTED
              ChatOpenAI(temperature=0) with that protocol's full
              JSON schema as its system prompt. Returns a JSON
              string in the protocol's wire format.
       ↓
should_continue routes the tool_call to emit_generated_surface
              (NOT back to generate, like other tools)
       ↓
emit_generated_surface — reads the most recent ToolMessage, wraps
              its content with the protocol's classifier sentinel:
                a2ui      → `---a2ui_JSON---\n{...JSONL...}\n`
                json-render → raw `{...Spec JSON...}` (classifier
                              detects content starting with `{`)
              Emits the wrapped content as a fresh AIMessage.
       ↓
attach_citations (no-op for these messages — no preceding ToolMessage
                  with citation JSON)
       ↓
__end__
```

Existing Phase 2B/3A/3B paths (`search_documents`, `request_approval`, `research`) continue to work — only the GenUI tool calls divert through `emit_generated_surface`.

## Sub-LLM pattern

Reference: `~/repos/SC-CopilotKit-C1/L4/backend-dynamic/schema.py` lines 1-887. The `generate_schema` tool there uses langchain's newer `@tool()` decorator with `ToolRuntime[Any]`; ours uses langchain-core's `@tool` (matching Phase 2B/3A/3B) and accesses prior messages via the standard state injection.

Each tool body:
1. Filters preceding messages to drop tool messages and pending tool-call AI turns (the schema sub-LLM should see only conversational context).
2. Invokes `ChatOpenAI(model='gpt-5-mini', temperature=0)` with `[SystemMessage(SCHEMA_PROMPT), *filtered_messages]`.
3. Returns the response content as a string. The string IS the wire-format payload (raw JSONL for a2ui; raw JSON object for json-render).

The sub-LLM never sees the parent's other tool descriptions. It's a focused contractor: input = user intent + chat history; output = schema-correct payload.

## Python graph changes

### State additions

```python
class State(TypedDict):
    messages: Annotated[list, add_messages]
    model: Optional[str]
    reasoning_effort: Optional[str]
    gen_ui_mode: Optional[str]   # NEW: 'a2ui' | 'json-render', default 'a2ui'
```

### Removed (was Phase 4)

- `A2UI_PREFIX` constant — moved to inline use inside `emit_generated_surface`
- `FEEDBACK_FORM_JSONL` constant — removed entirely (schema is now generated, not hardcoded)
- `render_demo_form` tool — removed
- `emit_a2ui_surface` node — replaced by `emit_generated_surface`
- `should_continue` branch for `render_demo_form` — replaced

### Added

Two sub-LLM tools (one per protocol). Schema docs are large (the A2UI one is ~770 lines verbatim from the L4 reference; the json-render one is ~80 lines). Each lives in a dedicated module:

- `examples/chat/python/src/schemas/a2ui_v1.py` — exports `A2UI_V1_SCHEMA_PROMPT: str`
- `examples/chat/python/src/schemas/json_render.py` — exports `JSON_RENDER_SCHEMA_PROMPT: str`

The A2UI prompt is the L4 reference's `SCHEMA_PROMPT` verbatim (no modifications — its protocol description matches our v1 parser exactly). The json-render prompt describes the `{root, elements, state}` Spec shape per `@json-render/core` types.

```python
# In graph.py — tool wrappers
@tool
async def generate_a2ui_schema(request: str) -> str:
    """Dispatch the A2UI schema sub-agent. Use this when the user asks for
    UI/forms/cards and `gen_ui_mode` is 'a2ui'. Pass the user's request
    verbatim as the `request` arg."""
    from src.schemas.a2ui_v1 import A2UI_V1_SCHEMA_PROMPT
    llm = ChatOpenAI(model="gpt-5-mini", temperature=0)
    response = await llm.ainvoke([
        SystemMessage(content=A2UI_V1_SCHEMA_PROMPT),
        HumanMessage(content=request),
    ])
    return _as_text(response.content).strip()


@tool
async def generate_json_render_spec(request: str) -> str:
    """Dispatch the json-render schema sub-agent. Use this when the user
    asks for UI/forms/cards and `gen_ui_mode` is 'json-render'. Pass the
    user's request verbatim as the `request` arg."""
    from src.schemas.json_render import JSON_RENDER_SCHEMA_PROMPT
    llm = ChatOpenAI(model="gpt-5-mini", temperature=0)
    response = await llm.ainvoke([
        SystemMessage(content=JSON_RENDER_SCHEMA_PROMPT),
        HumanMessage(content=request),
    ])
    return _as_text(response.content).strip()


def _as_text(content) -> str:
    if isinstance(content, str): return content
    if isinstance(content, list):
        return "\n".join(b.get("text", "") for b in content
                         if isinstance(b, dict) and b.get("type") == "text")
    return ""
```

### `should_continue` routing

```python
def should_continue(state: State) -> Literal["tools", "emit_generated_surface", "attach_citations"]:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        for tc in last.tool_calls:
            if tc["name"] in ("generate_a2ui_schema", "generate_json_render_spec"):
                return "emit_generated_surface"
        return "tools"
    return "attach_citations"
```

### `emit_generated_surface` node

```python
A2UI_PREFIX = "---a2ui_JSON---"

async def emit_generated_surface(state: State) -> dict:
    """Post-process: read the most recent ToolMessage carrying the
    sub-LLM's wire-format payload, wrap with the appropriate classifier
    sentinel, emit as a fresh AIMessage. Existing Tool-call AI message
    + ToolMessage history is preserved (debug visible in chat-debug)."""
    msgs = state["messages"]
    # Find the most recent ToolMessage and its preceding AIMessage's tool_call name
    tool_msg = None
    tool_name = None
    for m in reversed(msgs):
        if isinstance(m, ToolMessage):
            tool_msg = m
            # Find the AI message that originated this tool_call
            for prior in reversed(msgs):
                if isinstance(prior, AIMessage) and prior.tool_calls:
                    for tc in prior.tool_calls:
                        if tc.get("id") == tool_msg.tool_call_id:
                            tool_name = tc.get("name")
                            break
                if tool_name:
                    break
            break
    if tool_msg is None or tool_name is None:
        return {}

    payload = tool_msg.content if isinstance(tool_msg.content, str) else ""
    if not payload:
        return {}

    if tool_name == "generate_a2ui_schema":
        # Sub-LLM returns a JSON array per the v1 schema prompt;
        # convert to JSONL and prepend the classifier sentinel.
        try:
            arr = json.loads(payload)
            jsonl = "\n".join(json.dumps(env) for env in arr) if isinstance(arr, list) else payload
        except json.JSONDecodeError:
            jsonl = payload  # let the parser deal with it; classifier still triggers on prefix
        wrapped = A2UI_PREFIX + "\n" + jsonl + "\n"
    elif tool_name == "generate_json_render_spec":
        # json-render content is a single JSON object — classifier detects on '{'
        wrapped = payload.strip()
    else:
        return {}

    return {"messages": [AIMessage(content=wrapped)]}
```

### `generate` node — pick up `gen_ui_mode`

The patched submit on the Angular side propagates `gen_ui_mode` through `state.gen_ui_mode`. The parent LLM's SYSTEM_PROMPT references it; the tool descriptions also nudge it.

### SYSTEM_PROMPT update

Append one paragraph (replaces Phase 4's render_demo_form paragraph):

```
"When the user asks to see, build, or render a UI / form / card / "
"interactive component, dispatch one of the schema-generation tools "
"based on `state.gen_ui_mode`: "
"  - 'a2ui'        → call `generate_a2ui_schema(request)` "
"  - 'json-render' → call `generate_json_render_spec(request)` "
"Pass the user's request verbatim as the `request` argument. The tool "
"returns a wire-format payload that the chat composition renders "
"directly. Do NOT describe the UI in prose — the tool dispatches the "
"actual rendering. Briefly acknowledge after the tool completes."
```

### Builder topology

```python
_builder = StateGraph(State)
_builder.add_node("generate", generate)
_builder.add_node("tools", ToolNode([
    search_documents, request_approval, research,
    generate_a2ui_schema, generate_json_render_spec,
]))
_builder.add_node("emit_generated_surface", emit_generated_surface)
_builder.add_node("attach_citations", attach_citations)
_builder.set_entry_point("generate")
_builder.add_conditional_edges("generate", should_continue, {
    "tools": "tools",
    "emit_generated_surface": "emit_generated_surface",
    "attach_citations": "attach_citations",
})
_builder.add_edge("tools", "generate")
_builder.add_edge("emit_generated_surface", "attach_citations")
_builder.add_edge("attach_citations", END)
```

## Angular changes

### Palette: GenUI dropdown

`examples/chat/angular/src/app/shell/control-palette.component.ts` already houses model + effort dropdowns. Add a 5th dropdown `GenUI` with options `[{value: 'a2ui', label: 'A2UI'}, {value: 'json-render', label: 'json-render'}]`. Default `'a2ui'`.

`examples/chat/angular/src/app/shell/demo-shell.component.ts`:
- New signal: `readonly genUiMode = signal<string>(this.persistence.read('genUiMode') ?? 'a2ui');`
- Add to `modelOptions`/`effortOptions` block: `genUiOptions` signal listing the two values.
- Add `onGenUiModeChange(value)` handler — persists via `palette-persistence.service`.
- Patched submit injects `gen_ui_mode: this.genUiMode()` into state alongside `model` and `reasoning_effort`.

`examples/chat/angular/src/app/shell/demo-shell.component.html`:
- Pass `[genUiMode]="genUiMode()"`, `[genUiOptions]="genUiOptions()"`, `(genUiModeChange)="onGenUiModeChange($event)"` to `<app-control-palette>`.

`examples/chat/angular/src/app/shell/control-palette.component.ts`:
- Add `readonly genUiMode = input.required<string>();`, `readonly genUiOptions = input.required<readonly {value, label}[]>();`, `readonly genUiModeChange = output<string>();`
- Template adds a `<select>` next to the model + effort selects.

`examples/chat/angular/src/app/shell/palette-persistence.service.ts`:
- The persistence read/write generic already supports arbitrary string keys, so `read('genUiMode')` / `write('genUiMode', value)` works without service changes.

### Welcome suggestions

`examples/chat/angular/src/app/modes/welcome-suggestions.ts`:

Remove the Phase 4 entry "Demo: render an interactive A2UI surface" (it referenced `render_demo_form` which is gone).

Add four generic intents (replacing entry 10 from Phase 4):

```ts
{
  label: 'Build a quick feedback form',
  value:
    'Build me a quick feedback form with a name field and a 1-5 rating picker.',
},
{
  label: 'Render a flight booking card',
  value:
    'Render a flight booking card from Seattle to Tokyo with origin, destination, departure date, return date, and a Search Flights button.',
},
{
  label: 'Show a settings panel',
  value:
    'Show a settings panel with a theme picker (light/dark/auto), a notifications toggle, and a "Reset to defaults" button.',
},
{
  label: 'Build a login form',
  value:
    'Build a login form with email and password fields and a "Sign in" button.',
},
```

Toggle the GenUI dropdown to see the same prompts render via either protocol.

## Python verification probe

Server-side check the round-trip for each protocol:

```bash
# A2UI mode
tid=$(curl -sf -X POST http://localhost:2024/threads -d '{}' | jq -r .thread_id)
curl -sf -X POST "http://localhost:2024/threads/$tid/runs/wait" \
  -H 'Content-Type: application/json' \
  -d '{"assistant_id":"chat","input":{"messages":[{"role":"user","content":"Build a quick feedback form."}],"model":"gpt-5-mini","gen_ui_mode":"a2ui"}}'
# Expect: tool_call to generate_a2ui_schema → ToolMessage with v1 JSONL
# array → final AIMessage starts with ---a2ui_JSON---\n and contains
# surfaceUpdate + beginRendering envelopes.

# json-render mode
tid=$(curl -sf -X POST http://localhost:2024/threads -d '{}' | jq -r .thread_id)
curl -sf -X POST "http://localhost:2024/threads/$tid/runs/wait" \
  -H 'Content-Type: application/json' \
  -d '{"assistant_id":"chat","input":{"messages":[{"role":"user","content":"Build a quick feedback form."}],"model":"gpt-5-mini","gen_ui_mode":"json-render"}}'
# Expect: tool_call to generate_json_render_spec → ToolMessage with a
# JSON Spec object → final AIMessage starts with `{` (classifier picks
# up json-render type).
```

## Live Chrome MCP smoke

Per established pattern:

1. Reload demo at `/embed`. Confirm 5th palette dropdown "GenUI" with options A2UI / json-render, default A2UI.
2. Click "Build a quick feedback form" welcome suggestion (default a2ui mode):
   - AI emits tool_call to `generate_a2ui_schema`
   - `<a2ui-surface>` mounts the dynamically generated form (Card + TextField + MultipleChoice + Button)
   - Different from Phase 4's hardcoded form — this varies per LLM response
3. New conversation. Switch GenUI dropdown to `json-render`. Click same suggestion:
   - AI emits tool_call to `generate_json_render_spec`
   - `<chat-generative-ui>` mounts (different rendering path)
   - Same logical form, different protocol output
4. Verify other tools still work: click "What are Angular signals?" (search_documents) → no GenUI dispatch, normal markdown answer with citations.
5. Verify interrupts still work: click "Demo: ask for approval" (request_approval) → interrupt panel appears.
6. Verify subagents still work: click "Demo: dispatch a research subagent" (research) → subagent flashes briefly.

## TDD

`examples/chat/python/tests/test_graph_smoke.py` updates:

```python
@pytest.mark.smoke
def test_genui_tools_exist():
    from src.graph import generate_a2ui_schema, generate_json_render_spec
    assert generate_a2ui_schema.name == "generate_a2ui_schema"
    assert generate_json_render_spec.name == "generate_json_render_spec"


@pytest.mark.smoke
def test_state_graph_has_emit_generated_surface_node():
    from src.graph import graph
    nodes = set(graph.get_graph().nodes.keys())
    assert "emit_generated_surface" in nodes
    assert "tools" in nodes
    assert "attach_citations" in nodes


@pytest.mark.smoke
def test_state_includes_gen_ui_mode_channel():
    from src.graph import State
    annotations = State.__annotations__
    assert "gen_ui_mode" in annotations


@pytest.mark.smoke
def test_phase4_artifacts_removed():
    """Phase 5 removes Phase 4's hardcoded path."""
    import importlib
    mod = importlib.import_module("src.graph")
    assert not hasattr(mod, "render_demo_form"), \
        "render_demo_form tool should be removed in Phase 5"
    assert not hasattr(mod, "FEEDBACK_FORM_JSONL"), \
        "FEEDBACK_FORM_JSONL constant should be removed in Phase 5"
    assert not hasattr(mod, "emit_a2ui_surface"), \
        "emit_a2ui_surface node should be replaced by emit_generated_surface"
```

Drop the three Phase 4 a2ui smoke tests (they target removed symbols):
- `test_render_demo_form_tool_exists`
- `test_state_graph_includes_emit_a2ui_surface_node`
- `test_a2ui_jsonl_starts_with_prefix_and_parses`

Final test count: 11 (Phase 4) - 3 + 4 = **12 tests**.

## CHECKLIST.md update

Generative UI / A2UI surfaces section gets a v1 + dynamic-mode update:

```markdown
## Generative UI / A2UI surfaces

- [ ] Palette has a "GenUI" dropdown with options A2UI / json-render; default A2UI; persists across reload
- [ ] (GenUI=A2UI) Click "Build a quick feedback form" welcome suggestion
- [ ] AI emits tool_call to `generate_a2ui_schema`; sub-LLM returns v1 JSONL
- [ ] `<a2ui-surface>` mounts a Card with TextField + MultipleChoice + Button (LLM-generated, not hardcoded)
- [ ] Final AI message content starts with `---a2ui_JSON---\n` and contains v1 envelopes (`surfaceUpdate`/`dataModelUpdate`/`beginRendering`)
- [ ] (GenUI=json-render) New conversation, click same suggestion
- [ ] AI emits tool_call to `generate_json_render_spec`; sub-LLM returns a json-render Spec
- [ ] `<chat-generative-ui>` mounts the spec (different rendering path from A2UI)
- [ ] Verify cross-protocol: same prompt produces different render via dropdown toggle
- [ ] Server-side: thread state shows the matching tool_call for the chosen mode; no hardcoded JSONL anywhere in messages
```

## Files touched

| File | Change |
|---|---|
| `examples/chat/python/src/graph.py` | Remove Phase 4 (`render_demo_form`, `FEEDBACK_FORM_JSONL`, `emit_a2ui_surface`); add `gen_ui_mode` State channel, two sub-LLM tools, `emit_generated_surface` node, routing, SYSTEM_PROMPT update. |
| `examples/chat/python/src/schemas/__init__.py` | NEW — package init |
| `examples/chat/python/src/schemas/a2ui_v1.py` | NEW — exports `A2UI_V1_SCHEMA_PROMPT` (full v1 schema doc, ~770 LOC verbatim from L4 reference) |
| `examples/chat/python/src/schemas/json_render.py` | NEW — exports `JSON_RENDER_SCHEMA_PROMPT` (~80 LOC describing `{root, elements, state}`) |
| `examples/chat/python/tests/test_graph_smoke.py` | Drop 3 Phase 4 tests; add 4 Phase 5 tests. |
| `examples/chat/angular/src/app/shell/demo-shell.component.ts` | `genUiMode` signal + `genUiOptions` + handler + state injection. |
| `examples/chat/angular/src/app/shell/demo-shell.component.html` | Wire palette inputs/output. |
| `examples/chat/angular/src/app/shell/control-palette.component.ts` | New `genUiMode` input + `genUiOptions` input + `genUiModeChange` output + `<select>` in template. |
| `examples/chat/angular/src/app/modes/welcome-suggestions.ts` | Remove Phase 4 entry; add 4 generic intent entries. |
| `examples/chat/smoke/CHECKLIST.md` | Update Generative UI section per above. |

Total ≈ 200 LOC + 770 LOC schema-doc constant + 80 LOC json-render-doc constant ≈ **~1050 LOC** (most of which is pasted schema documentation that doesn't get reviewed line-by-line).

## Phasing for the implementation plan

- Phase 0 — Branch creation (`claude/examples-chat-phase-5-genui`)
- Phase 1 — Schema-prompt modules (`a2ui_v1.py`, `json_render.py`); the A2UI doc is verbatim from L4 reference, the json-render doc is hand-written.
- Phase 2 — Python graph: TDD (failing tests first) → remove Phase 4 artifacts → add `gen_ui_mode` State channel + two sub-LLM tools + `emit_generated_surface` node + routing + SYSTEM_PROMPT.
- Phase 3 — Angular palette: `genUiMode` signal + persistence + new dropdown + state injection in patched submit.
- Phase 4 — Welcome suggestions (remove Phase 4 entry; add 4 new generic intents).
- Phase 5 — CHECKLIST.md update.
- Phase 6 — Verification: full lib + python smoke + lint + build sweep + server-side curl probe (both modes) + LIVE Chrome MCP smoke (both modes) + PR open + merge.

## Out of scope (deferred)

- **Pass-through mode hint to non-GenUI tools.** Other tools (`search_documents`, `request_approval`, `research`) ignore `gen_ui_mode`. The dropdown only affects rendering surfaces.
- **GenUI dropdown propagating to thread checkpoints.** The mode lives on `state` and is persisted client-side via palette-persistence; thread restoration on reload uses last-known palette state, not state-from-history.
- **A2UI surface generation actually delivering a fully working interactive form.** Finding K (datamodel back-prop) is still open lib-level. The form RENDERS; user input doesn't yet propagate to `dataModel`. Out of Phase 5 scope; tracked separately.
- **Material theming and full-catalog surface coverage** — those move to a parallel "theming" track (3 passes outlined in the brainstorm; not gated by Phase 5).
