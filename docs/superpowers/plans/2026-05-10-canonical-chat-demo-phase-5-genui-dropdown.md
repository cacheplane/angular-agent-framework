# Canonical `examples/chat` Demo — Phase 5: GenUI Dropdown + Dynamic Schema Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Phase 4's hardcoded `FEEDBACK_FORM_JSONL` path with dynamic schema generation. Add a palette `GenUI` dropdown (`a2ui` / `json-render`); welcome suggestions are now generic intents that work against either rendering protocol via a sub-LLM that has the protocol's full canonical schema in its system prompt.

**Architecture:** Two new sub-LLM tools (`generate_a2ui_schema`, `generate_json_render_spec`) each invoke a nested `ChatOpenAI(temperature=0)` with the protocol's full JSON schema in its system prompt. The parent LLM dispatches the tool matching `state.gen_ui_mode`. Routing diverts these tool calls to a new `emit_generated_surface` post-process node that wraps the sub-LLM output with the chat composition's content-classifier sentinels (`---a2ui_JSON---\n` for a2ui; raw `{` for json-render). Existing Phase 2B/3A/3B paths (search, approval, research) continue unchanged.

**Tech Stack:** Python 3.12 (uv, langgraph.graph.StateGraph, langchain-openai, langchain-core), pytest. Angular 21 (signals, OnPush, standalone components).

**Spec:** `docs/superpowers/specs/2026-05-10-canonical-chat-demo-phase-5-genui-dropdown-design.md` (committed at c474fe43)

**Branch:** `claude/examples-chat-phase-5-genui`, branched from `origin/main` (currently `57a0d721` — tip after PR #228 a2ui v1 migration).

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, comments, commit messages, or PR titles/bodies. Mentions in markdown spec/plan docs are OK as third-party library names; do not propagate.

---

## File Structure

```
examples/chat/python/
├── src/
│   ├── graph.py                                      # Heavy edits: remove Phase 4 + add Phase 5 paths (~120 LOC delta)
│   └── schemas/
│       ├── __init__.py                               # NEW — empty package init
│       ├── a2ui_v1.py                                # NEW — A2UI_V1_SCHEMA_PROMPT constant (~770 LOC, copied from L4 reference)
│       └── json_render.py                            # NEW — JSON_RENDER_SCHEMA_PROMPT constant (~80 LOC, hand-written)
└── tests/
    └── test_graph_smoke.py                           # Drop 3 Phase 4 tests, add 4 Phase 5 tests

examples/chat/angular/src/app/
├── shell/
│   ├── demo-shell.component.ts                       # +genUiMode signal, +genUiOptions, +handler, +state injection (~15 LOC)
│   ├── demo-shell.component.html                     # Wire palette inputs/output (~3 LOC)
│   ├── control-palette.component.ts                  # +genUiMode input, +genUiOptions input, +genUiModeChange output, +pickGenUi handler (~10 LOC)
│   └── control-palette.component.html                # +<select> dropdown next to Effort (~8 LOC)
└── modes/welcome-suggestions.ts                      # Remove Phase 4 entry; +4 generic intents

examples/chat/smoke/CHECKLIST.md                      # Update Generative UI / A2UI surfaces section
```

Total ≈ 200 LOC of code + 850 LOC of pasted schema-doc constants.

---

## Phase 0 — Branch creation

### Task 0.1: Create implementation branch

- [ ] **Step 1: Branch from origin/main**

```bash
cd /Users/blove/repos/angular-agent-framework
git fetch origin main
git checkout -b claude/examples-chat-phase-5-genui origin/main
git rev-parse --abbrev-ref HEAD   # must echo claude/examples-chat-phase-5-genui
git log --oneline -1              # must be 57a0d721 or later (PR #228 a2ui v1 migration)
```

---

## Phase 1 — Schema-prompt modules

### Task 1.1: Create `schemas/__init__.py`

**File:** `examples/chat/python/src/schemas/__init__.py`

- [ ] **Step 1: Create empty package init**

```python
# SPDX-License-Identifier: MIT
"""Schema-prompt modules for the GenUI sub-LLM tools."""
```

### Task 1.2: Create `schemas/a2ui_v1.py` — A2UI v1 schema prompt

**File:** `examples/chat/python/src/schemas/a2ui_v1.py`

The A2UI v1 schema documentation is ~770 lines of structured prompt + JSON schema. Copy it verbatim from the L4 reference at `/Users/blove/repos/SC-CopilotKit-C1/L4/backend-dynamic/schema.py` (the `SCHEMA_PROMPT` triple-quoted string spanning lines 9-887). The reference's text already targets the canonical Google A2UI v1 protocol, which matches our v1 parser exactly after PR #228.

- [ ] **Step 1: Read the source**

```bash
sed -n '9,887p' /Users/blove/repos/SC-CopilotKit-C1/L4/backend-dynamic/schema.py | head -40
```

This shows the start of the `SCHEMA_PROMPT = """..."""` block. The full constant ends at line 887 (the `""".strip()` closure).

- [ ] **Step 2: Create the module**

Create `examples/chat/python/src/schemas/a2ui_v1.py` with the following structure. The triple-quoted string body is the exact content of the L4 reference's `SCHEMA_PROMPT` with NO modifications — the protocol description and JSON schema match our v1 parser as-shipped in PR #228.

```python
# SPDX-License-Identifier: MIT
"""A2UI v1 protocol schema documentation, used as the system prompt for
the `generate_a2ui_schema` sub-LLM tool. Sourced verbatim from the
L4 production reference (canonical Google A2UI v1 schema)."""

A2UI_V1_SCHEMA_PROMPT = """
Generate A2UI JSON.

## A2UI Protocol Instructions

A2UI (Agent to UI) is a protocol for rendering rich UI surfaces from agent responses.

To render a surface, you MUST send ALL messages in a SINGLE tool call, in this order:
1. **surfaceUpdate** - Define all UI components (REQUIRED)
2. **dataModelUpdate** - Set any data values (OPTIONAL)
3. **beginRendering** - Signal the client to start rendering (REQUIRED)

### Minimal Working Example

Here is the simplest possible A2UI surface - a button:

```json
[
  {
    "surfaceUpdate": {
      "surfaceId": "my-surface",
      "components": [
        {
          "id": "root",
          "component": {
            "Button": {
              "child": "btn-text",
              "action": { "name": "button_clicked" }
            }
          }
        },
        {
          "id": "btn-text",
          "component": {
            "Text": { "text": { "literalString": "Click Me" } }
          }
        }
      ]
    }
  },
  {
    "beginRendering": {
      "surfaceId": "my-surface",
      "root": "root"
    }
  }
]
```

## JSON Schema Reference
[... copy the full JSON schema body from L4 reference lines 58-829 here verbatim ...]
""".strip()
```

The `[... copy the full JSON schema body ...]` placeholder must be replaced with the literal content from L4 reference lines 58-829. The simplest mechanical path:

```bash
# After creating the module file with everything BEFORE the JSON schema section:
sed -n '58,829p' /Users/blove/repos/SC-CopilotKit-C1/L4/backend-dynamic/schema.py >> /tmp/a2ui_schema_body.txt
# Then manually paste the contents into the module file inside the triple-quoted string,
# replacing the placeholder line.
```

Or simpler — just use Bash + Python to copy the entire SCHEMA_PROMPT constant from line 9 to line 887:

```bash
python3 -c "
import re
src = open('/Users/blove/repos/SC-CopilotKit-C1/L4/backend-dynamic/schema.py').read()
m = re.search(r'SCHEMA_PROMPT = \"\"\"(.+?)\"\"\"\\.strip\\(\\)', src, re.DOTALL)
prompt_body = m.group(1)
out = '''# SPDX-License-Identifier: MIT
\"\"\"A2UI v1 protocol schema documentation, used as the system prompt for
the \`generate_a2ui_schema\` sub-LLM tool. Sourced verbatim from the
L4 production reference (canonical Google A2UI v1 schema).\"\"\"

A2UI_V1_SCHEMA_PROMPT = \"\"\"''' + prompt_body + '''\"\"\".strip()
'
open('/Users/blove/repos/angular-agent-framework/examples/chat/python/src/schemas/a2ui_v1.py', 'w').write(out)
"
```

After running, verify:

```bash
wc -l /Users/blove/repos/angular-agent-framework/examples/chat/python/src/schemas/a2ui_v1.py
grep -c "surfaceUpdate\|dataModelUpdate\|beginRendering\|literalString\|literalNumber" /Users/blove/repos/angular-agent-framework/examples/chat/python/src/schemas/a2ui_v1.py
```

Expected: ~880 lines; multi-digit count for v1 envelope keys (confirms the schema is fully present).

- [ ] **Step 3: Smoke test the import**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run python -c "from src.schemas.a2ui_v1 import A2UI_V1_SCHEMA_PROMPT; print(len(A2UI_V1_SCHEMA_PROMPT), 'chars')"
```

Expected: prints the character count (should be ~30000+ for the full v1 schema doc).

### Task 1.3: Create `schemas/json_render.py` — json-render schema prompt

**File:** `examples/chat/python/src/schemas/json_render.py`

- [ ] **Step 1: Create the module**

```python
# SPDX-License-Identifier: MIT
"""json-render protocol schema documentation, used as the system prompt
for the `generate_json_render_spec` sub-LLM tool. Targets the
@json-render/core Spec shape: { root, elements, state }."""

JSON_RENDER_SCHEMA_PROMPT = """
Generate a json-render Spec.

## json-render Protocol Instructions

json-render renders a UI from a single JSON object describing a flat
component tree. Output ONE JSON object, no array, no prefix, no
markdown fences. The chat client detects the leading `{` and routes
the message to `<chat-generative-ui>`.

The Spec shape is:

```json
{
  "root": "<id of the root element>",
  "elements": {
    "<id1>": { "type": "<ComponentName>", "props": { ... }, "children": ["<childId>", ...], "on": { "click": { "action": "<name>", "params": {...} } } },
    "<id2>": { ... }
  },
  "state": {
    "<key>": "<initial value>"
  }
}
```

Rules:
- `root` is the id of the entry-point element. The renderer mounts it first.
- `elements` is a flat map of element id → element definition. Children are referenced by id, not nested.
- `props` carries plain literal values (strings, numbers, booleans, arrays, objects). Components whose props bind to state use a special `statePath` field: `props: { value: { statePath: "/name" } }`.
- `children` is an array of element ids (in render order).
- `on` maps DOM event names to action descriptors. Most components only emit `click`. The `action` string is a free-form intent name; `params` is a flat object passed to the handler.
- `state` is the initial state model. Keys are paths (e.g. `name`, `email`); values are initial values.

## Component Catalog (matches @ngaf/chat's a2uiBasicCatalog)

The renderer consumes the same component catalog as A2UI, so component
names match: `Card`, `Column`, `Row`, `List`, `Tabs`, `Modal`,
`Divider`, `Button`, `CheckBox`, `TextField`, `DateTimeInput`,
`MultipleChoice`, `Slider`, `Text`, `Image`, `Icon`, `Video`,
`AudioPlayer`.

Common props per component:
- `Card`: no props (children is single id wrapped in array)
- `Column` / `Row`: `{ gap?: 'small'|'medium'|'large', alignment?: 'start'|'center'|'end'|'stretch' }`
- `Text`: `{ text: string, usageHint?: 'h1'|'h2'|'h3'|'h4'|'h5'|'caption'|'body' }`
- `TextField`: `{ label: string, text: string | { statePath: '/path' }, placeholder?: string, textFieldType?: 'shortText'|'longText'|'number'|'date'|'obscured', validationRegexp?: string }`
- `MultipleChoice`: `{ label: string, options: [{ label: string, value: string }, ...], selections: string[] | { statePath: '/path' }, maxAllowedSelections?: number }`
- `CheckBox`: `{ label: string, value: boolean | { statePath: '/path' } }`
- `Slider`: `{ label: string, value: number | { statePath: '/path' }, minValue: number, maxValue: number }`
- `Button`: `{ label: string, primary?: boolean }` plus `on.click.action` for the action name
- `DateTimeInput`: `{ label: string, value: string | { statePath: '/path' }, enableDate?: boolean, enableTime?: boolean }`
- `Image` / `Video` / `AudioPlayer`: `{ url: string }` plus `Image.fit?: 'contain'|'cover'|'fill'|'none'|'scale-down'`, `Image.usageHint?: 'icon'|'avatar'|'smallFeature'|'mediumFeature'|'largeFeature'|'header'`
- `Icon`: `{ icon: string, size?: number }`
- `Divider`: `{ direction?: 'horizontal'|'vertical' }`
- `Tabs`: special — uses `tabTitles: string[]` and one child id per tab in `children`
- `Modal`: special — `children: [triggerId, contentId]` (entry point + content)

## Minimal Working Example

A "Quick feedback" form:

```json
{
  "root": "card",
  "elements": {
    "card": { "type": "Card", "children": ["body"] },
    "body": { "type": "Column", "props": { "gap": "medium" }, "children": ["title", "name", "rating", "submit"] },
    "title": { "type": "Text", "props": { "text": "Quick feedback", "usageHint": "h3" } },
    "name": { "type": "TextField", "props": { "label": "Your name", "text": { "statePath": "/name" }, "textFieldType": "shortText" } },
    "rating": { "type": "MultipleChoice", "props": { "label": "Rating", "options": [
      { "label": "1", "value": "1" }, { "label": "2", "value": "2" }, { "label": "3", "value": "3" }, { "label": "4", "value": "4" }, { "label": "5", "value": "5" }
    ], "selections": { "statePath": "/rating" }, "maxAllowedSelections": 1 } },
    "submit": { "type": "Button", "props": { "label": "Submit feedback", "primary": true }, "on": { "click": { "action": "feedbackSubmit", "params": { "surface": "feedback" } } } }
  },
  "state": { "name": "", "rating": "5" }
}
```

## Output Requirements

Return ONLY the JSON object. No prose. No markdown code fence. The first
character of your response MUST be `{`. The chat client's content
classifier detects this and routes the message to render.
""".strip()
```

- [ ] **Step 2: Smoke test**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run python -c "from src.schemas.json_render import JSON_RENDER_SCHEMA_PROMPT; print(len(JSON_RENDER_SCHEMA_PROMPT), 'chars')"
```

Expected: prints character count (~3500-4000).

- [ ] **Step 3: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add examples/chat/python/src/schemas/
git commit -m "feat(examples-chat-python): schema-prompt modules for GenUI sub-LLM tools"
```

---

## Phase 2 — Python graph: remove Phase 4 artifacts + add Phase 5 paths (TDD)

### Task 2.1: Failing tests for Phase 5 + removed Phase 4

**File:** `examples/chat/python/tests/test_graph_smoke.py`

Phase 4 added 3 tests (`test_render_demo_form_tool_exists`, `test_state_graph_includes_emit_a2ui_surface_node`, `test_a2ui_jsonl_starts_with_prefix_and_parses`); the v1 migration kept them. Phase 5 removes those + adds 4 new tests.

- [ ] **Step 1: Edit the test file**

Open `examples/chat/python/tests/test_graph_smoke.py`. Locate and **delete** these three test functions:
- `test_render_demo_form_tool_exists`
- `test_state_graph_includes_emit_a2ui_surface_node`
- `test_a2ui_jsonl_starts_with_prefix_and_parses`

Then append at the END of the file:

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
    assert "gen_ui_mode" in annotations, \
        "State must have a gen_ui_mode channel (Phase 5)"


@pytest.mark.smoke
def test_phase4_artifacts_removed():
    """Phase 5 removes Phase 4's hardcoded path entirely."""
    import importlib
    mod = importlib.import_module("src.graph")
    assert not hasattr(mod, "render_demo_form"), \
        "render_demo_form tool should be removed in Phase 5"
    assert not hasattr(mod, "FEEDBACK_FORM_JSONL"), \
        "FEEDBACK_FORM_JSONL constant should be removed in Phase 5"
    assert not hasattr(mod, "emit_a2ui_surface"), \
        "emit_a2ui_surface node should be replaced by emit_generated_surface"
```

- [ ] **Step 2: Run — must FAIL**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run pytest -q -m smoke
```

Expected: 4 new tests fail (the symbols don't exist yet). The 3 deleted tests are gone; remaining 8 (Phase 1+2A+2B+3A+3B) pass. Total expected pass count after Task 2.1 implementation: 8 + 4 = **12 tests**.

Do NOT commit yet — Task 2.2 commits the test changes + implementation together.

### Task 2.2: Edit `examples/chat/python/src/graph.py` — remove Phase 4 artifacts + add Phase 5 paths

**File:** `examples/chat/python/src/graph.py`

This task makes ~10 edits to the existing file. Do NOT replace the whole file — keep `search_documents`, `request_approval`, `research`, `attach_citations`, the existing `State`, `generate`, `should_continue` skeleton, and the builder topology.

- [ ] **Step 1: Add `HumanMessage` to existing langchain_core import (already there from Phase 3B; confirm)**

Locate the existing import block:

```python
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    RemoveMessage,
    SystemMessage,
    ToolMessage,
)
```

Confirm `HumanMessage` is present. If not, add it.

- [ ] **Step 2: REMOVE Phase 4 artifacts**

Delete these blocks from `graph.py`:

1. The `A2UI_PREFIX = "---a2ui_JSON---"` constant declaration block (just before the `# Research subagent` comment).
2. The entire `FEEDBACK_FORM_JSONL = "\n".join([...]) + "\n"` block (the multi-line constant).
3. The entire `@tool def render_demo_form(form_type: str = "feedback", subagent_type: str = "feedback")` function.
4. The entire `async def emit_a2ui_surface(state: State) -> dict:` function.
5. From `generate`'s `bind_tools([...])` call: REMOVE `render_demo_form`.
6. From the `_builder.add_node("tools", ToolNode([...]))` call: REMOVE `render_demo_form`.
7. From the builder: REMOVE the `_builder.add_node("emit_a2ui_surface", emit_a2ui_surface)` line.
8. From `_builder.add_conditional_edges`'s map: REMOVE the `"emit_a2ui_surface": "emit_a2ui_surface"` entry.
9. From the builder: REMOVE the `_builder.add_edge("emit_a2ui_surface", "attach_citations")` edge.

- [ ] **Step 3: ADD `gen_ui_mode` to State**

Locate:

```python
class State(TypedDict):
    messages: Annotated[list, add_messages]
    model: Optional[str]
    reasoning_effort: Optional[str]
```

Replace with:

```python
class State(TypedDict):
    messages: Annotated[list, add_messages]
    model: Optional[str]
    reasoning_effort: Optional[str]
    gen_ui_mode: Optional[str]
```

- [ ] **Step 4: ADD module-level `A2UI_PREFIX` constant (re-introduce, used only inside the new emit node)**

After the `request_approval` `@tool` block, before the `# Research subagent` comment, insert:

```python


# Used by emit_generated_surface to prepend the chat composition's
# content-classifier sentinel for A2UI mode. The classifier triggers
# rendering when an AI message content begins with this prefix.
A2UI_PREFIX = "---a2ui_JSON---"
```

- [ ] **Step 5: ADD the two GenUI sub-LLM tools**

After the `research` `@tool` block (which ends `return "(no research returned)"`), insert:

```python


@tool
async def generate_a2ui_schema(request: str) -> str:
    """Dispatch the A2UI schema sub-agent to render a UI surface in A2UI
    v1 wire format. Use this when the user asks for UI/forms/cards and
    state.gen_ui_mode is 'a2ui'. Pass the user's request verbatim as the
    `request` argument. The sub-agent returns a JSON array of v1
    envelopes (surfaceUpdate, optional dataModelUpdate, beginRendering)
    that the post-process node wraps for the chat composition."""
    from src.schemas.a2ui_v1 import A2UI_V1_SCHEMA_PROMPT
    llm = ChatOpenAI(model="gpt-5-mini", temperature=0)
    response = await llm.ainvoke([
        SystemMessage(content=A2UI_V1_SCHEMA_PROMPT),
        HumanMessage(content=request),
    ])
    return _as_text(response.content).strip()


@tool
async def generate_json_render_spec(request: str) -> str:
    """Dispatch the json-render schema sub-agent to render a UI surface
    as a json-render Spec ({root, elements, state}). Use this when the
    user asks for UI/forms/cards and state.gen_ui_mode is 'json-render'.
    Pass the user's request verbatim as the `request` argument."""
    from src.schemas.json_render import JSON_RENDER_SCHEMA_PROMPT
    llm = ChatOpenAI(model="gpt-5-mini", temperature=0)
    response = await llm.ainvoke([
        SystemMessage(content=JSON_RENDER_SCHEMA_PROMPT),
        HumanMessage(content=request),
    ])
    return _as_text(response.content).strip()


def _as_text(content) -> str:
    """Normalize a langchain message content to a plain string. ChatOpenAI
    may return content as either str or a list of typed blocks; this
    pulls the text out of either."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(
            b.get("text", "")
            for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        )
    return ""
```

- [ ] **Step 6: UPDATE `should_continue` routing**

Replace the existing `should_continue` with:

```python
def should_continue(state: State) -> Literal["tools", "emit_generated_surface", "attach_citations"]:
    """Conditional edge: route from generate to:
    - `emit_generated_surface` if any tool_call is generate_a2ui_schema or generate_json_render_spec
    - `tools` for any other tool_call (search_documents, request_approval, research)
    - `attach_citations` (terminal) when there are no tool_calls
    """
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        for tc in last.tool_calls:
            if tc["name"] in ("generate_a2ui_schema", "generate_json_render_spec"):
                return "emit_generated_surface"
        return "tools"
    return "attach_citations"
```

- [ ] **Step 7: ADD `emit_generated_surface` node**

After the new `_as_text` helper, before the existing `attach_citations` async function, insert:

```python


async def emit_generated_surface(state: State) -> dict:
    """Post-process for GenUI tool dispatches. Reads the most recent
    ToolMessage carrying the sub-LLM's wire-format payload, identifies
    which protocol the AI dispatched (by tool_call name), wraps the
    payload with the chat composition's content-classifier sentinel,
    and emits a fresh AIMessage. The original AI tool-call message and
    ToolMessage stay in history (visible in chat-debug)."""
    msgs = state["messages"]

    # Find the most recent ToolMessage and the originating tool_call name
    tool_msg = None
    tool_name = None
    for m in reversed(msgs):
        if isinstance(m, ToolMessage):
            tool_msg = m
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
        # Sub-LLM returns a JSON array of v1 envelopes. Convert to JSONL
        # (one envelope per line) and prepend the classifier sentinel.
        try:
            arr = json.loads(payload)
            if isinstance(arr, list):
                jsonl = "\n".join(json.dumps(env) for env in arr)
            else:
                jsonl = payload
        except json.JSONDecodeError:
            # Sub-LLM may have leading/trailing whitespace or markdown
            # fencing despite the prompt instructions. Try to strip.
            stripped = payload.strip()
            if stripped.startswith("```"):
                lines = stripped.split("\n")
                stripped = "\n".join(line for line in lines if not line.startswith("```"))
            try:
                arr = json.loads(stripped)
                jsonl = "\n".join(json.dumps(env) for env in arr) if isinstance(arr, list) else stripped
            except json.JSONDecodeError:
                jsonl = payload  # let the parser deal with malformed lines
        wrapped = A2UI_PREFIX + "\n" + jsonl + "\n"
    elif tool_name == "generate_json_render_spec":
        # json-render: classifier detects content starting with `{`, no
        # prefix needed. Strip whitespace and any markdown fencing the
        # sub-LLM may have included.
        stripped = payload.strip()
        if stripped.startswith("```"):
            lines = stripped.split("\n")
            stripped = "\n".join(line for line in lines if not line.startswith("```"))
            stripped = stripped.strip()
        wrapped = stripped
    else:
        return {}

    return {"messages": [AIMessage(content=wrapped)]}
```

- [ ] **Step 8: UPDATE `bind_tools` and `ToolNode` lists**

In `generate`, locate:

```python
    llm = ChatOpenAI(**kwargs).bind_tools([search_documents, request_approval, research])
```

Replace with (Phase 5 ADDS the two new tools; Phase 4's `render_demo_form` is REMOVED per Step 2.5):

```python
    llm = ChatOpenAI(**kwargs).bind_tools([
        search_documents, request_approval, research,
        generate_a2ui_schema, generate_json_render_spec,
    ])
```

In the builder, locate:

```python
_builder.add_node("tools", ToolNode([search_documents, request_approval, research]))
```

Replace with:

```python
_builder.add_node("tools", ToolNode([
    search_documents, request_approval, research,
    generate_a2ui_schema, generate_json_render_spec,
]))
```

- [ ] **Step 9: UPDATE the builder topology — add `emit_generated_surface` node + edges**

Replace the builder's node-add + edge block (which was modified by Phase 4 with `emit_a2ui_surface` references; Step 2 already removed those) with:

```python
_builder.add_node("generate", generate)
_builder.add_node("tools", ToolNode([
    search_documents, request_approval, research,
    generate_a2ui_schema, generate_json_render_spec,
]))
_builder.add_node("emit_generated_surface", emit_generated_surface)
_builder.add_node("attach_citations", attach_citations)
_builder.set_entry_point("generate")
_builder.add_conditional_edges(
    "generate",
    should_continue,
    {
        "tools": "tools",
        "emit_generated_surface": "emit_generated_surface",
        "attach_citations": "attach_citations",
    },
)
_builder.add_edge("tools", "generate")
_builder.add_edge("emit_generated_surface", "attach_citations")
_builder.add_edge("attach_citations", END)
```

- [ ] **Step 10: UPDATE SYSTEM_PROMPT — replace Phase 4's render_demo_form paragraph**

Locate the existing render_demo_form paragraph in `SYSTEM_PROMPT` (Phase 4 added it; ends `"... — keep the prose short — the user will see the form directly."`). Replace that entire paragraph with:

```python
    " "
    "When the user asks to see, build, or render a UI / form / card / "
    "interactive component, dispatch one of the schema-generation tools "
    "based on the conversation's `gen_ui_mode` (visible in state if you "
    "received it; default is 'a2ui'): "
    "  - 'a2ui'        -> call `generate_a2ui_schema(request)` "
    "  - 'json-render' -> call `generate_json_render_spec(request)` "
    "Pass the user's request verbatim as the `request` argument. The "
    "tool returns a wire-format payload that the chat composition "
    "renders directly. Do NOT describe the UI in prose — the tool "
    "dispatches the actual rendering. Briefly acknowledge the dispatch "
    "in your conversational reply, but keep the prose short — the user "
    "sees the rendered surface."
```

- [ ] **Step 11: Run pytest — all 12 tests pass**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run pytest -q -m smoke
```

Expected: **12 passed** (8 existing + 4 new).

- [ ] **Step 12: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add examples/chat/python/src/graph.py examples/chat/python/tests/test_graph_smoke.py
git commit -m "feat(examples-chat-python): GenUI dropdown + dynamic schema generation"
```

---

## Phase 3 — Angular palette: GenUI dropdown

### Task 3.1: Update `control-palette.component.ts` — add `genUiMode` input/output

**File:** `examples/chat/angular/src/app/shell/control-palette.component.ts`

- [ ] **Step 1: Add inputs/outputs**

Locate the existing inputs block:

```typescript
  readonly mode = input.required<DemoMode>();
  readonly model = input.required<string>();
  readonly modelOptions = input.required<readonly { value: string; label: string }[]>();
  readonly effort = input.required<string>();
  readonly effortOptions = input.required<readonly { value: string; label: string }[]>();
  readonly debugOpen = input.required<boolean>();
```

Add directly after `effortOptions` line:

```typescript
  readonly genUiMode = input.required<string>();
  readonly genUiOptions = input.required<readonly { value: string; label: string }[]>();
```

Locate the existing outputs block:

```typescript
  readonly modeChange = output<DemoMode>();
  readonly modelChange = output<string>();
  readonly effortChange = output<string>();
  readonly debugOpenChange = output<boolean>();
  readonly newConversation = output<void>();
```

Add directly after `effortChange` line:

```typescript
  readonly genUiModeChange = output<string>();
```

Locate the existing handlers (after `pickEffort`):

```typescript
  protected pickEffort(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.effortChange.emit(value);
  }
```

Add directly after:

```typescript
  protected pickGenUi(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.genUiModeChange.emit(value);
  }
```

### Task 3.2: Update `control-palette.component.html` — add dropdown

**File:** `examples/chat/angular/src/app/shell/control-palette.component.html`

- [ ] **Step 1: Insert dropdown after the Effort group**

Locate the existing Effort group (around line 45):

```html
    <label class="palette__group palette__group--model">
      <span class="palette__label">Effort</span>
      <select [value]="effort()" (change)="pickEffort($event)">
        @for (opt of effortOptions(); track opt.value) {
          <option [value]="opt.value" [selected]="opt.value === effort()">{{ opt.label }}</option>
        }
      </select>
    </label>
```

Insert directly AFTER the closing `</label>`:

```html
    <label class="palette__group palette__group--model">
      <span class="palette__label">GenUI</span>
      <select [value]="genUiMode()" (change)="pickGenUi($event)">
        @for (opt of genUiOptions(); track opt.value) {
          <option [value]="opt.value" [selected]="opt.value === genUiMode()">{{ opt.label }}</option>
        }
      </select>
    </label>
```

### Task 3.3: Update `demo-shell.component.ts` — add `genUiMode` signal + handler + state injection

**File:** `examples/chat/angular/src/app/shell/demo-shell.component.ts`

- [ ] **Step 1: Add the `genUiMode` signal**

Locate the existing `effort` signal block:

```typescript
  /** Reasoning effort for the next submit. Persisted across reloads. */
  readonly effort = signal<string>(this.persistence.read('effort') ?? 'minimal');
```

Add directly after:

```typescript
  /** GenUI rendering protocol for the next submit. Persisted across
   * reloads. 'a2ui' (default) routes form-render dispatches to
   * generate_a2ui_schema; 'json-render' routes to generate_json_render_spec. */
  readonly genUiMode = signal<string>(this.persistence.read('genUiMode') ?? 'a2ui');
```

- [ ] **Step 2: Add `genUiOptions`**

Locate the existing `effortOptions` block:

```typescript
  protected readonly effortOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'minimal', label: 'minimal (fast)' },
    { value: 'low',     label: 'low' },
    { value: 'medium',  label: 'medium' },
    { value: 'high',    label: 'high (visible reasoning)' },
  ]);
```

Add directly after:

```typescript
  protected readonly genUiOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'a2ui',        label: 'A2UI' },
    { value: 'json-render', label: 'json-render' },
  ]);
```

- [ ] **Step 3: Add `onGenUiModeChange` handler**

Locate the existing `onEffortChange` handler (or `onModelChange` — pattern is consistent):

```typescript
  protected onEffortChange(value: string): void {
    this.effort.set(value);
    this.persistence.write('effort', value);
  }
```

Add directly after:

```typescript
  protected onGenUiModeChange(value: string): void {
    this.genUiMode.set(value);
    this.persistence.write('genUiMode', value);
  }
```

- [ ] **Step 4: Inject `gen_ui_mode` into patched submit**

Locate the patched submit (around line 94, after the `agent({...})` factory call):

```typescript
    const orig = a.submit.bind(a);
    (a as { submit: typeof a.submit }).submit = ((
      input: Parameters<typeof a.submit>[0],
      opts?: Parameters<typeof a.submit>[1],
    ) =>
      orig(
        {
          ...(input ?? {}),
          state: {
            ...((input as { state?: Record<string, unknown> })?.state ?? {}),
            model: this.model(),
            reasoning_effort: this.effort(),
          },
        },
        opts,
      )) as typeof a.submit;
```

Add a `gen_ui_mode` line to the state object:

```typescript
    const orig = a.submit.bind(a);
    (a as { submit: typeof a.submit }).submit = ((
      input: Parameters<typeof a.submit>[0],
      opts?: Parameters<typeof a.submit>[1],
    ) =>
      orig(
        {
          ...(input ?? {}),
          state: {
            ...((input as { state?: Record<string, unknown> })?.state ?? {}),
            model: this.model(),
            reasoning_effort: this.effort(),
            gen_ui_mode: this.genUiMode(),
          },
        },
        opts,
      )) as typeof a.submit;
```

### Task 3.4: Update `demo-shell.component.html` — wire palette I/O

**File:** `examples/chat/angular/src/app/shell/demo-shell.component.html`

- [ ] **Step 1: Wire the new inputs/output**

Locate the existing `<app-control-palette>` block:

```html
  <app-control-palette
    [mode]="mode()"
    [model]="model()"
    [modelOptions]="modelOptions()"
    [effort]="effort()"
    [effortOptions]="effortOptions()"
    [debugOpen]="debugOpen()"
    (modeChange)="onModeChange($event)"
    (modelChange)="onModelChange($event)"
    (effortChange)="onEffortChange($event)"
    (debugOpenChange)="onDebugChange($event)"
    (newConversation)="onNewConversation()"
  />
```

Replace with:

```html
  <app-control-palette
    [mode]="mode()"
    [model]="model()"
    [modelOptions]="modelOptions()"
    [effort]="effort()"
    [effortOptions]="effortOptions()"
    [genUiMode]="genUiMode()"
    [genUiOptions]="genUiOptions()"
    [debugOpen]="debugOpen()"
    (modeChange)="onModeChange($event)"
    (modelChange)="onModelChange($event)"
    (effortChange)="onEffortChange($event)"
    (genUiModeChange)="onGenUiModeChange($event)"
    (debugOpenChange)="onDebugChange($event)"
    (newConversation)="onNewConversation()"
  />
```

### Task 3.5: Build + lint

- [ ] **Step 1: Run**

```bash
cd /Users/blove/repos/angular-agent-framework
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
npx nx run examples-chat-angular:lint --skip-nx-cache 2>&1 | tail -3
npx nx run examples-chat-angular:build --skip-nx-cache --configuration=development 2>&1 | tail -3
```

Expected: 0 lint errors; build succeeds.

- [ ] **Step 2: Commit**

```bash
git add examples/chat/angular/src/app/shell/
git commit -m "feat(examples-chat-angular): GenUI palette dropdown + state injection"
```

---

## Phase 4 — Welcome suggestions

### Task 4.1: Replace Phase 4 entry with 4 generic intents

**File:** `examples/chat/angular/src/app/modes/welcome-suggestions.ts`

The current file has 10 entries (Phase 1–4). Phase 5 removes the 10th entry ("Demo: render an interactive A2UI surface" — references the now-removed `render_demo_form` tool) and adds 4 new generic intents.

- [ ] **Step 1: Edit the array**

Locate the existing 10th entry (Phase 4):

```typescript
  {
    label: 'Demo: render an interactive A2UI surface',
    value:
      'Use the render_demo_form tool to show me a feedback card with name and rating fields.',
  },
];
```

Replace that entry (remove it; the closing `];` stays) with these 4 new entries — also leaving the closing `];`:

```typescript
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
];
```

Final entry count: 9 - 1 + 4 = **12 entries**.

- [ ] **Step 2: Confirm build**

```bash
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
npx nx run examples-chat-angular:build --skip-nx-cache --configuration=development 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/modes/welcome-suggestions.ts
git commit -m "feat(examples-chat-angular): generic intent welcome suggestions for GenUI dropdown"
```

---

## Phase 5 — CHECKLIST.md update

### Task 5.1: Update Generative UI / A2UI surfaces section

**File:** `examples/chat/smoke/CHECKLIST.md`

- [ ] **Step 1: Replace the Phase 4 section content**

Locate the populated `## Generative UI / A2UI surfaces` section (Phase 4 + v1 migration). Replace the entire section (everything between this heading and the next `##` heading) with:

```markdown
## Generative UI / A2UI surfaces

- [ ] Palette has a "GenUI" dropdown with options "A2UI" and "json-render"; default "A2UI"; persists across reload
- [ ] (GenUI=A2UI) Click "Build a quick feedback form" welcome suggestion
- [ ] AI emits a tool_call to `generate_a2ui_schema`; the sub-LLM returns v1 JSONL
- [ ] `<a2ui-surface>` mounts a Card containing TextField + MultipleChoice + Button (LLM-generated, varies per request — not hardcoded)
- [ ] Final AI message content starts with `---a2ui_JSON---\n` and contains v1 envelopes (`surfaceUpdate` / `dataModelUpdate` / `beginRendering`)
- [ ] (GenUI=json-render) New conversation, click the same suggestion
- [ ] AI emits a tool_call to `generate_json_render_spec`; the sub-LLM returns a single JSON Spec object
- [ ] `<chat-generative-ui>` mounts the spec (different rendering path from A2UI; same logical form)
- [ ] Verify cross-protocol: same prompt produces different render via dropdown toggle
- [ ] Other welcome suggestions (search citations, request_approval, research subagent) still work — GenUI dropdown does not affect them
- [ ] Server-side: `curl localhost:2024/threads/<id>/state` shows the matching tool_call for the chosen mode; no `render_demo_form` or `FEEDBACK_FORM_JSONL` references anywhere
```

DO NOT touch other Phase 2+ sections.

- [ ] **Step 2: Verify the diff**

```bash
git diff examples/chat/smoke/CHECKLIST.md | head -50
```

Expected: only the Generative UI section changes.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/smoke/CHECKLIST.md
git commit -m "docs(examples-chat-smoke): update Generative UI checklist for Phase 5 dynamic dispatch"
```

---

## Phase 6 — Verification + PR (controller-driven)

### Task 6.1: Full local sweep

- [ ] **Step 1: Python smoke**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run examples-chat-python:smoke --skip-nx-cache 2>&1 | tail -3
```

Expected: 12 passed.

- [ ] **Step 2: Angular tests + lint + build**

```bash
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
npx nx run-many -t test,lint,build -p examples-chat-angular --skip-nx-cache 2>&1 | tail -10
```

Expected: all green.

- [ ] **Step 3: Confirm commit count**

```bash
git rev-list --count origin/main..HEAD
```

Expected: 5 commits.

### Task 6.2: Server-side end-to-end probes (BOTH modes)

Confirm `OPENAI_API_KEY` in `examples/chat/python/.env`. Start backend:

```bash
nohup uv run --directory /Users/blove/repos/angular-agent-framework/examples/chat/python langgraph dev --port 2024 --no-browser > /tmp/exchat-py-5.log 2>&1 &
```

Wait for ready.

- [ ] **Step 1: A2UI mode probe**

```bash
tid=$(curl -sf -X POST -H 'Content-Type: application/json' http://localhost:2024/threads -d '{}' | python3 -c "import sys,json;print(json.load(sys.stdin)['thread_id'])")
echo "thread=$tid"
curl -sf -X POST -H 'Content-Type: application/json' "http://localhost:2024/threads/$tid/runs/wait" \
  -d '{"assistant_id":"chat","input":{"messages":[{"role":"user","content":"Build me a quick feedback form with a name field and a 1-5 rating picker."}],"model":"gpt-5-mini","gen_ui_mode":"a2ui"}}' \
  > /tmp/p5-a2ui.json
python3 << 'EOF'
import json
d = json.load(open('/tmp/p5-a2ui.json'))
msgs = d.get('messages', []) if isinstance(d, dict) else []
ai_with_tc = [m for m in msgs if m.get('type') == 'ai' and m.get('tool_calls')]
genui_calls = []
for ai in ai_with_tc:
    for tc in ai.get('tool_calls', []):
        if tc.get('name') in ('generate_a2ui_schema', 'generate_json_render_spec'):
            genui_calls.append(tc)
print('total msgs:', len(msgs))
print('GenUI tool_calls:', len(genui_calls))
for tc in genui_calls[:1]:
    print('  name:', tc.get('name'))
    print('  args:', json.dumps(tc.get('args', {}))[:120])
final_ai = [m for m in msgs if m.get('type') == 'ai' and not m.get('tool_calls')]
print('final AI (no tool_calls):', len(final_ai))
for ai in final_ai[-1:]:
    c = ai.get('content', '')
    text = c if isinstance(c, str) else next((b.get('text','') for b in c if isinstance(b, dict) and b.get('type')=='text'), '')
    print('starts with prefix:', text.startswith('---a2ui_JSON---'))
    has_v1 = 'surfaceUpdate' in text and 'beginRendering' in text
    print('contains v1 envelopes:', has_v1)
    print('first 240 chars:', repr(text[:240]))
EOF
```

Expected:
- `GenUI tool_calls: 1` with `name: generate_a2ui_schema`
- `final AI (no tool_calls): 1` with `starts with prefix: True` and `contains v1 envelopes: True`

- [ ] **Step 2: json-render mode probe**

```bash
tid2=$(curl -sf -X POST -H 'Content-Type: application/json' http://localhost:2024/threads -d '{}' | python3 -c "import sys,json;print(json.load(sys.stdin)['thread_id'])")
echo "thread2=$tid2"
curl -sf -X POST -H 'Content-Type: application/json' "http://localhost:2024/threads/$tid2/runs/wait" \
  -d '{"assistant_id":"chat","input":{"messages":[{"role":"user","content":"Build me a quick feedback form with a name field and a 1-5 rating picker."}],"model":"gpt-5-mini","gen_ui_mode":"json-render"}}' \
  > /tmp/p5-json.json
python3 << 'EOF'
import json
d = json.load(open('/tmp/p5-json.json'))
msgs = d.get('messages', []) if isinstance(d, dict) else []
ai_with_tc = [m for m in msgs if m.get('type') == 'ai' and m.get('tool_calls')]
genui_calls = [tc for ai in ai_with_tc for tc in ai.get('tool_calls', [])
               if tc.get('name') in ('generate_a2ui_schema', 'generate_json_render_spec')]
print('total msgs:', len(msgs))
print('GenUI tool_calls:', len(genui_calls))
for tc in genui_calls[:1]:
    print('  name:', tc.get('name'))
final_ai = [m for m in msgs if m.get('type') == 'ai' and not m.get('tool_calls')]
print('final AI (no tool_calls):', len(final_ai))
for ai in final_ai[-1:]:
    c = ai.get('content', '')
    text = c if isinstance(c, str) else next((b.get('text','') for b in c if isinstance(b, dict) and b.get('type')=='text'), '')
    starts_with_brace = text.lstrip().startswith('{')
    has_root = '"root"' in text and '"elements"' in text
    print('starts with {:', starts_with_brace)
    print('contains root + elements:', has_root)
    print('contains a2ui prefix (must be False):', text.startswith('---a2ui_JSON---'))
    print('first 240 chars:', repr(text[:240]))
EOF
```

Expected:
- `GenUI tool_calls: 1` with `name: generate_json_render_spec`
- `starts with {: True`, `contains root + elements: True`, `contains a2ui prefix: False`

- [ ] **Step 3: Stop backend**

```bash
pkill -f "langgraph dev" 2>/dev/null
sleep 1
lsof -nP -iTCP:2024 -sTCP:LISTEN 2>&1 | head -2
```

Expected: nothing listening on :2024.

### Task 6.3: LIVE Chrome MCP smoke (BOTH modes)

Per the v1 migration's pattern.

- [ ] **Step 1: Restart backend + Angular dev server**

```bash
nohup uv run --directory /Users/blove/repos/angular-agent-framework/examples/chat/python langgraph dev --port 2024 --no-browser > /tmp/exchat-py-5-smoke.log 2>&1 &
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
nohup npx nx serve examples-chat-angular > /tmp/exchat-ng-5-smoke.log 2>&1 &
```

Wait for both ready (`:2024/ok` + `:4200/`).

- [ ] **Step 2: Open `/embed`, verify palette dropdown**

```js
(()=>{
  const labels = Array.from(document.querySelectorAll('app-control-palette .palette__label')).map(e=>e.innerText);
  const selects = Array.from(document.querySelectorAll('app-control-palette select')).map(s=>({
    label: s.previousElementSibling?.innerText,
    value: s.value,
    options: Array.from(s.options).map(o=>o.value),
  }));
  return { labels, selects };
})()
```

Expected: `labels` includes `'GenUI'`; `selects` contains `{ label: 'GenUI', value: 'a2ui', options: ['a2ui', 'json-render'] }`.

- [ ] **Step 3: A2UI mode — click "Build a quick feedback form"**

Default GenUI is `'a2ui'`. Reset conversation, click the suggestion:

```js
(async()=>{
  const reset = Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('New conversation'));
  reset?.click();
  await new Promise(r=>setTimeout(r,800));
  const t = Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('quick feedback form'));
  t.click();
  return 'kicked-a2ui';
})()
```

Wait ~25 seconds (the sub-LLM call adds ~3-5s on top of the parent), then verify:

```js
(()=>{
  const sf = document.querySelector('a2ui-surface');
  const subtree = [...new Set(Array.from(document.querySelectorAll('a2ui-surface *')).map(e=>e.tagName.toLowerCase()).filter(t=>t.includes('-')))];
  const shell = document.querySelector('demo-shell');
  const agent = ng.getComponent(shell)?.agent;
  const last = agent?.messages?.()?.at?.(-1);
  const lastContent = typeof last?.content==='string'?last.content:JSON.stringify(last?.content||'');
  return {
    surface: !!sf,
    subtree,
    msgs: document.querySelectorAll('chat-message').length,
    contentStartsWithPrefix: lastContent.startsWith('---a2ui_JSON---'),
    containsSurfaceUpdate: lastContent.includes('"surfaceUpdate"'),
    containsBeginRendering: lastContent.includes('"beginRendering"'),
  };
})()
```

Expected: `surface: true`, `subtree` includes `a2ui-card`/`a2ui-text-field`/`a2ui-button`, `contentStartsWithPrefix: true`, `containsSurfaceUpdate: true`, `containsBeginRendering: true`.

- [ ] **Step 4: Switch GenUI to json-render, click same suggestion**

```js
(async()=>{
  // Click the GenUI select and choose json-render
  const select = Array.from(document.querySelectorAll('app-control-palette select')).find(s=>s.previousElementSibling?.innerText==='GenUI');
  select.value = 'json-render';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r=>setTimeout(r,500));
  // Reset conversation
  const reset = Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('New conversation'));
  reset.click();
  await new Promise(r=>setTimeout(r,800));
  // Click the same suggestion
  const t = Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('quick feedback form'));
  t.click();
  return 'kicked-jsonrender';
})()
```

Wait ~25 seconds, then verify:

```js
(()=>{
  const genUi = document.querySelector('chat-generative-ui');
  const a2ui = document.querySelector('a2ui-surface');
  const shell = document.querySelector('demo-shell');
  const agent = ng.getComponent(shell)?.agent;
  const last = agent?.messages?.()?.at?.(-1);
  const lastContent = typeof last?.content==='string'?last.content:JSON.stringify(last?.content||'');
  return {
    genUiMounted: !!genUi,
    a2uiMounted: !!a2ui,
    msgs: document.querySelectorAll('chat-message').length,
    startsWithBrace: lastContent.trimStart().startsWith('{'),
    containsRoot: lastContent.includes('"root"') && lastContent.includes('"elements"'),
    containsA2uiPrefix: lastContent.startsWith('---a2ui_JSON---'),
  };
})()
```

Expected: `genUiMounted: true`, `a2uiMounted: false`, `startsWithBrace: true`, `containsRoot: true`, `containsA2uiPrefix: false`.

- [ ] **Step 5: Verify other tools still work**

Switch back to A2UI mode (or any). Click "What are Angular signals? (search + cite sources)" — verify it dispatches `search_documents`, NOT GenUI tools, and renders normal markdown with citations.

Click "Demo: ask for approval before a sensitive action" — verify the interrupt panel appears (Phase 3A still wired).

- [ ] **Step 6: Stop services**

```bash
pkill -f "langgraph dev" 2>/dev/null
pkill -f "nx serve" 2>/dev/null
sleep 1
```

### Task 6.4: Push + open PR

- [ ] **Step 1: Push**

```bash
cd /Users/blove/repos/angular-agent-framework
git push -u origin claude/examples-chat-phase-5-genui 2>&1 | tail -3
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(examples-chat): Phase 5 — GenUI dropdown + dynamic schema generation" --body "$(cat <<'EOF'
## Summary

Replaces Phase 4's hardcoded \`FEEDBACK_FORM_JSONL\` path with **dynamic schema generation** via a sub-LLM pattern. The palette gains a 5th dropdown (\`GenUI: a2ui | json-render\`); welcome suggestions become generic intents that work against either rendering protocol.

- **Python graph**: Two new sub-LLM tools (\`generate_a2ui_schema\`, \`generate_json_render_spec\`) each invoke a nested \`ChatOpenAI(temperature=0)\` with the protocol's full canonical JSON schema in its system prompt. New routing branch in \`should_continue\` diverts these tool calls to a new \`emit_generated_surface\` post-process node that wraps the sub-LLM output with the chat composition's content-classifier sentinels (\`---a2ui_JSON---\\n\` for a2ui; raw \`{\` for json-render).
- **Phase 4 artifacts removed**: \`render_demo_form\` tool, \`FEEDBACK_FORM_JSONL\` constant, \`emit_a2ui_surface\` node — all gone.
- **State channel**: \`gen_ui_mode\` added (default \`'a2ui'\`); patched submit on Angular side propagates via \`state.gen_ui_mode\`.
- **Schema-prompt modules**: \`src/schemas/a2ui_v1.py\` (full canonical v1 schema, ~770 LOC verbatim from the L4 production reference) + \`src/schemas/json_render.py\` (~80 LOC describing \`@json-render/core\`'s \`{root, elements, state}\` Spec shape).
- **Angular palette**: New \`GenUI\` dropdown with options A2UI / json-render, default A2UI, persisted across reload via the existing palette-persistence service.
- **Welcome suggestions**: 4 generic intents replace Phase 4's single hardcoded entry — "Build a quick feedback form", "Render a flight booking card", "Show a settings panel", "Build a login form".

Spec: \`docs/superpowers/specs/2026-05-10-canonical-chat-demo-phase-5-genui-dropdown-design.md\`
Plan: \`docs/superpowers/plans/2026-05-10-canonical-chat-demo-phase-5-genui-dropdown.md\`

## Test plan

### Verified locally
- [x] \`nx run examples-chat-python:smoke\` — 12 passed (8 carried + 4 new; Phase 4's 3 a2ui tests removed)
- [x] \`nx run examples-chat-angular:test/lint/build\` — all green
- [x] **Server-side A2UI probe**: GenUI tool_call to \`generate_a2ui_schema\`; final AIMessage starts with \`---a2ui_JSON---\\n\` containing v1 envelopes (\`surfaceUpdate\` + \`beginRendering\`).
- [x] **Server-side json-render probe**: GenUI tool_call to \`generate_json_render_spec\`; final AIMessage starts with \`{\` containing \`root\` + \`elements\` keys; no a2ui prefix.
- [x] **Live Chrome MCP smoke (A2UI mode)**: Click "Build a quick feedback form" → \`<a2ui-surface>\` mounts dynamic Card with TextField + MultipleChoice + Button (LLM-generated, varies per request).
- [x] **Live Chrome MCP smoke (json-render mode)**: Same prompt → \`<chat-generative-ui>\` mounts the json-render Spec instead. Different rendering path, same logical form.
- [x] **Other tools unaffected**: search_documents, request_approval, research still dispatch via normal \`tools\` loop.

### Pending visual verification
- [ ] After merge: live smoke against \`/embed\`, \`/popup\`, \`/sidebar\` confirming dropdown persists across modes.

### Open follow-ups
- Finding K (Phase 4): A2UI text-field datamodel back-prop — orthogonal lib gap, separate PR.
- A2UI Material theming track (3-pass: surface coverage → token contract → Material preset) — independent of Phase 5.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

- [ ] **Step 3: Note the PR URL**

- [ ] **Step 4: Wait for CI; address failures**

- [ ] **Step 5: Merge once green**

---

## Definition of done

1. PR merged.
2. CI green: \`nx run examples-chat-python:smoke\` (12 pytest), \`nx run examples-chat-angular:test/lint/build\`.
3. Server-side probes confirm: A2UI mode dispatches \`generate_a2ui_schema\`, final AIMessage with v1 envelopes; json-render mode dispatches \`generate_json_render_spec\`, final AIMessage as JSON Spec object.
4. Live Chrome MCP smoke confirms: palette dropdown present + persists; A2UI mode mounts \`<a2ui-surface>\`; json-render mode mounts \`<chat-generative-ui>\`; same prompt, different protocols, both rendering correctly.
5. Welcome suggestions count = 12 (Phase 4's removed entry replaced by 4 new generic intents).
6. CHECKLIST `## Generative UI / A2UI surfaces` section updated for dynamic dispatch + dropdown.
7. Phase 4 artifacts (`render_demo_form`, `FEEDBACK_FORM_JSONL`, `emit_a2ui_surface`) verifiably gone — `test_phase4_artifacts_removed` enforces this.
