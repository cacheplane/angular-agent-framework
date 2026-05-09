# Canonical `examples/chat` Demo — Phase 4: Generative UI / A2UI Surfaces — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer Generative UI / A2UI surfaces onto the canonical demo by adding a `render_demo_form` tool the parent LLM dispatches; routing diverts to a deterministic `emit_a2ui_surface` post-process node that synthesizes the satisfying ToolMessage + an AIMessage carrying the `---a2ui_JSON---` wire-format prefix and a hardcoded feedback-form JSONL surface spec.

**Architecture:** Tool-driven dispatch + deterministic post-process. The AI decides *when* to render (calls the tool); Python builds the schema-exact JSONL (avoiding the unreliable LLM-generated A2UI JSON path the cockpit author warned against). The existing `<chat>` composition's content classifier auto-detects the prefix and renders `<a2ui-surface>`; submit round-trips through `agent.submit` with no extra plumbing. Existing Phase 2B `tools → generate` loop unaffected for other tool calls.

**Tech Stack:** Python 3.12 (uv, `langgraph.graph.StateGraph`, `langgraph.prebuilt.ToolNode`, `langchain-openai`, `langchain-core`), pytest. Angular 21 (zero shell changes — `<chat>` composition already mounts `<a2ui-surface>` and routes form-action messages through `agent.submit`).

**Spec:** `docs/superpowers/specs/2026-05-09-canonical-chat-demo-phase-4-generative-ui-design.md`

**Branch:** `claude/examples-chat-phase-4-generative-ui`, branched from `origin/main` (currently `8fb2ca57` — tip after PR #225 merged).

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, comments, commit messages, or PR titles/bodies. Mentions in markdown spec/plan docs are OK as third-party library names; do not propagate.

---

## File Structure

```
examples/chat/
├── python/
│   ├── src/graph.py                                       # +A2UI_PREFIX const, +FEEDBACK_FORM_JSONL const, +render_demo_form @tool, +emit_a2ui_surface async fn, update should_continue + add_conditional_edges, +node + edge, bind in 2 places, +1 paragraph in SYSTEM_PROMPT (~85 LOC)
│   └── tests/test_graph_smoke.py                          # +3 smoke tests (~25 LOC)
├── angular/src/app/modes/welcome-suggestions.ts           # +1 entry (~5 LOC)
└── smoke/CHECKLIST.md                                     # populate Generative UI / A2UI surfaces section
```

Total ≈ 100 LOC. **No Angular shell wiring needed** — `<chat>` already imports/mounts `A2uiSurfaceComponent` and the content classifier (`libs/chat/src/lib/streaming/content-classifier.ts`) auto-detects `---a2ui_JSON---`.

---

## Phase 0 — Branch creation

### Task 0.1: Create implementation branch

- [ ] **Step 1: Branch from origin/main**

```bash
cd /Users/blove/repos/angular-agent-framework
git fetch origin main
git checkout -b claude/examples-chat-phase-4-generative-ui origin/main
git rev-parse --abbrev-ref HEAD   # must echo claude/examples-chat-phase-4-generative-ui
git log --oneline -1              # must be 8fb2ca57 or later (PR #225 merged)
```

---

## Phase 1 — Python graph (TDD)

### Task 1.1: Failing tests

**File:** `examples/chat/python/tests/test_graph_smoke.py`

The current file (post Phase 3B) has 8 tests. Append three new test functions at the END of the file:

- [ ] **Step 1: Append the three new tests**

```python


@pytest.mark.smoke
def test_render_demo_form_tool_exists():
    from src.graph import render_demo_form
    assert render_demo_form is not None
    # @tool decorator gives the resulting object a `.name` attribute
    assert render_demo_form.name == "render_demo_form"


@pytest.mark.smoke
def test_state_graph_includes_emit_a2ui_surface_node():
    from src.graph import graph
    nodes = set(graph.get_graph().nodes.keys())
    assert "emit_a2ui_surface" in nodes
    assert "attach_citations" in nodes
    assert "tools" in nodes
    assert "generate" in nodes


@pytest.mark.smoke
def test_a2ui_jsonl_starts_with_prefix_and_parses():
    import json
    from src.graph import A2UI_PREFIX, FEEDBACK_FORM_JSONL
    assert A2UI_PREFIX == "---a2ui_JSON---", \
        "Prefix must match the chat content-classifier sentinel"
    full = A2UI_PREFIX + "\n" + FEEDBACK_FORM_JSONL
    lines = [ln for ln in full.split("\n") if ln.strip() and ln != A2UI_PREFIX]
    parsed = [json.loads(ln) for ln in lines]
    assert any("createSurface" in m for m in parsed), \
        "JSONL must include a createSurface envelope"
    assert any("updateComponents" in m for m in parsed), \
        "JSONL must include an updateComponents envelope"
```

- [ ] **Step 2: Run smoke — three new tests must FAIL**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run pytest -q -m smoke
```

Expected: 8 existing pass, 3 new FAIL. The first two new tests fail with `ImportError: cannot import name 'render_demo_form'/'A2UI_PREFIX'/'FEEDBACK_FORM_JSONL' from 'src.graph'`. The topology test fails because `emit_a2ui_surface` is not yet a node.

If any new test passes, an earlier change already added the symbol — STOP and report DONE_WITH_CONCERNS.

Do NOT commit yet — Task 1.2 commits the test + implementation together.

### Task 1.2: Implement `render_demo_form` tool + JSONL constants + `emit_a2ui_surface` node + routing

**File:** `examples/chat/python/src/graph.py`

Make six edits to the existing file. Do NOT replace the whole file — Phase 2B's tool, ToolNode, attach_citations, Phase 3A's interrupt + request_approval, and Phase 3B's research subagent must all remain.

- [ ] **Step 1: Add module-level `A2UI_PREFIX` and `FEEDBACK_FORM_JSONL` constants**

Locate the end of the existing `request_approval` `@tool` block (ends with `return f"Human response: {response}"`).

Insert the following block AFTER `request_approval` but BEFORE the existing `# Research subagent` block:

```python


# A2UI wire-format prefix recognized by the chat composition's content
# classifier (libs/chat/src/lib/streaming/content-classifier.ts). When an
# AI message content begins with this exact sentinel, the classifier
# routes the message to <a2ui-surface> rendering instead of plain markdown.
A2UI_PREFIX = "---a2ui_JSON---"

# Hardcoded A2UI v0.9 surface spec for the feedback-card demo. Each line
# is one envelope ({"<type>": {...}}) consumed by the parser at \n
# boundaries. The surface defines: a Card titled "Quick feedback"
# containing a TextField (Name) with a required check, a ChoicePicker
# (Rating 1-5), and a Submit Button whose action emits a "feedbackSubmit"
# event. Hardcoded because A2UI's schema-exact format is not a reliable
# LLM capability today (see cockpit/chat/a2ui/python/src/graph.py).
FEEDBACK_FORM_JSONL = "\n".join([
    json.dumps({"createSurface": {
        "surfaceId": "feedback",
        "catalogId": "basic",
        "sendDataModel": True,
    }}),
    json.dumps({"updateDataModel": {
        "surfaceId": "feedback",
        "value": {"name": "", "rating": "5"},
    }}),
    json.dumps({"updateComponents": {
        "surfaceId": "feedback",
        "components": [
            {"id": "root", "component": "Column", "children": ["card"]},
            {"id": "card", "component": "Card", "title": "Quick feedback",
             "children": ["name_field", "rating_picker", "submit_btn"]},
            {"id": "name_field", "component": "TextField",
             "label": "Your name", "value": {"path": "/name"},
             "placeholder": "Type your name",
             "checks": [
                 {"condition": {"call": "required",
                                "args": {"value": {"path": "/name"}}},
                  "message": "Name is required"},
             ]},
            {"id": "rating_picker", "component": "ChoicePicker",
             "label": "Rating", "options": ["1", "2", "3", "4", "5"],
             "selected": {"path": "/rating"}},
            {"id": "submit_btn", "component": "Button",
             "label": "Submit feedback",
             "checks": [
                 {"condition": {"call": "required",
                                "args": {"value": {"path": "/name"}}},
                  "message": "Enter your name before submitting"},
             ],
             "action": {"event": {"name": "feedbackSubmit",
                                  "context": {"surface": "feedback"}}}},
        ],
    }}),
]) + "\n"  # Trailing newline required — parser processes at \n boundaries
```

- [ ] **Step 2: Add the `render_demo_form` `@tool`**

Directly after the `FEEDBACK_FORM_JSONL` constant block, insert:

```python


@tool
def render_demo_form(form_type: str = "feedback") -> str:
    """Render an interactive A2UI surface in the chat. Use this when the
    user asks to see a form, render UI, or display an interactive card.
    `form_type` is a hint; the demo currently supports "feedback".

    The tool body returns a stable marker; the actual surface rendering
    happens in the `emit_a2ui_surface` post-process node, which detects
    the tool_call and synthesizes the AIMessage carrying the A2UI prefix
    and JSONL.
    """
    return f"a2ui:render:{form_type}"
```

- [ ] **Step 3: Update `should_continue` to include the new branch**

Locate the existing `should_continue` (currently returns `Literal["tools", "attach_citations"]`):

```python
def should_continue(state: State) -> Literal["tools", "attach_citations"]:
    """Conditional edge: route from generate to either the tools node
    (when the AI emitted tool_calls) or the terminal attach_citations
    post-process."""
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return "attach_citations"
```

Replace with:

```python
def should_continue(state: State) -> Literal["tools", "emit_a2ui_surface", "attach_citations"]:
    """Conditional edge: route from generate to:
    - `emit_a2ui_surface` if any tool_call is `render_demo_form` (A2UI demo)
    - `tools` for any other tool_call (search_documents, request_approval, research)
    - `attach_citations` (terminal post-process) when there are no tool_calls
    """
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        for tc in last.tool_calls:
            if tc["name"] == "render_demo_form":
                return "emit_a2ui_surface"
        return "tools"
    return "attach_citations"
```

- [ ] **Step 4: Add the `emit_a2ui_surface` node body**

Locate the existing `attach_citations` async function (begins with `async def attach_citations(state: State) -> dict:`).

Insert the following block directly BEFORE `attach_citations`:

```python


async def emit_a2ui_surface(state: State) -> dict:
    """Deterministic post-process for `render_demo_form` tool calls.

    Synthesizes (a) a ToolMessage satisfying the tool_call so the
    conversation history is well-formed, and (b) a fresh AIMessage whose
    content begins with `A2UI_PREFIX` followed by the hardcoded JSONL
    surface spec. The chat composition's content classifier detects the
    prefix and renders `<a2ui-surface>` instead of plain markdown.

    Hardcoded JSONL because A2UI's schema-exact format is not a reliable
    LLM capability today.
    """
    last = state["messages"][-1]
    tool_calls = getattr(last, "tool_calls", []) or []
    tc = next(
        (t for t in tool_calls if t["name"] == "render_demo_form"),
        None,
    )
    if tc is None:
        # Defensive: should_continue routes here only when render_demo_form
        # is in tool_calls. Returning {} keeps the graph well-formed if
        # routing somehow misfires.
        return {}
    return {"messages": [
        ToolMessage(content="rendered", tool_call_id=tc["id"]),
        AIMessage(content=A2UI_PREFIX + "\n" + FEEDBACK_FORM_JSONL),
    ]}
```

- [ ] **Step 5: Add the new tool to `bind_tools` and `ToolNode`**

Locate the existing `bind_tools` call inside `generate`:

```python
    llm = ChatOpenAI(**kwargs).bind_tools([search_documents, request_approval, research])
```

Replace with:

```python
    llm = ChatOpenAI(**kwargs).bind_tools([search_documents, request_approval, research, render_demo_form])
```

Locate the existing builder `add_node("tools", ...)`:

```python
_builder.add_node("tools", ToolNode([search_documents, request_approval, research]))
```

Replace with:

```python
_builder.add_node("tools", ToolNode([search_documents, request_approval, research, render_demo_form]))
```

- [ ] **Step 6: Add the new node and edge to the builder**

Locate the existing builder section:

```python
_builder.add_node("generate", generate)
_builder.add_node("tools", ToolNode([search_documents, request_approval, research, render_demo_form]))
_builder.add_node("attach_citations", attach_citations)
_builder.set_entry_point("generate")
_builder.add_conditional_edges(
    "generate",
    should_continue,
    {"tools": "tools", "attach_citations": "attach_citations"},
)
_builder.add_edge("tools", "generate")
_builder.add_edge("attach_citations", END)
```

Make two changes:

1. Add the new `emit_a2ui_surface` node definition between the `tools` add_node and the `attach_citations` add_node.
2. Update the conditional edges map and add the new edge from `emit_a2ui_surface` to `attach_citations`.

The block becomes:

```python
_builder.add_node("generate", generate)
_builder.add_node("tools", ToolNode([search_documents, request_approval, research, render_demo_form]))
_builder.add_node("emit_a2ui_surface", emit_a2ui_surface)
_builder.add_node("attach_citations", attach_citations)
_builder.set_entry_point("generate")
_builder.add_conditional_edges(
    "generate",
    should_continue,
    {
        "tools": "tools",
        "emit_a2ui_surface": "emit_a2ui_surface",
        "attach_citations": "attach_citations",
    },
)
_builder.add_edge("tools", "generate")
_builder.add_edge("emit_a2ui_surface", "attach_citations")
_builder.add_edge("attach_citations", END)
```

- [ ] **Step 7: Extend SYSTEM_PROMPT with one paragraph**

Locate the closing `)` of the existing `SYSTEM_PROMPT` (after the research paragraph that ends with `"handled by `search_documents`."`).

Append one more concatenated string literal directly before the closing `)`:

```python
    " "
    "When the user asks to see a form, render UI, or display an "
    "interactive card (anything visually interactive — a feedback "
    "form, a settings card, a poll), call the `render_demo_form` "
    "tool with `form_type=\"feedback\"`. Do not describe the UI in "
    "prose; the tool dispatches the actual rendering. Briefly "
    "acknowledge in your conversational reply that you have rendered "
    "the form, but keep the prose short — the user will see the form "
    "directly."
```

So the full `SYSTEM_PROMPT` now ends with the existing research paragraph followed by this new render_demo_form paragraph, all inside one parenthesized string concatenation.

- [ ] **Step 8: Run pytest — all 11 tests must pass**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run pytest -q -m smoke
```

Expected: 11 passed (8 existing + 3 new).

- [ ] **Step 9: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add examples/chat/python/src/graph.py examples/chat/python/tests/test_graph_smoke.py
git commit -m "feat(examples-chat-python): A2UI render_demo_form tool + emit_a2ui_surface node"
```

---

## Phase 2 — Welcome suggestion entry

### Task 2.1: Add the "render an A2UI surface" suggestion

**File:** `examples/chat/angular/src/app/modes/welcome-suggestions.ts`

The current file has 9 entries (post Phase 3B). Append a 10th entry to the `WELCOME_SUGGESTIONS` array.

- [ ] **Step 1: Append entry**

Locate the closing `];` of the array. Insert this entry as the last element (before the closing `]`):

```typescript
  {
    label: 'Demo: render an interactive A2UI surface',
    value:
      'Use the render_demo_form tool to show me a feedback card with name and rating fields.',
  },
```

The full new last two entries should look like:

```typescript
  {
    label: 'Demo: dispatch a research subagent',
    value:
      'Use the research subagent to investigate the history and motivation behind Angular standalone components, then report back with a concise summary.',
  },
  {
    label: 'Demo: render an interactive A2UI surface',
    value:
      'Use the render_demo_form tool to show me a feedback card with name and rating fields.',
  },
];
```

- [ ] **Step 2: Confirm build**

```bash
cd /Users/blove/repos/angular-agent-framework
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
npx nx run examples-chat-angular:build --skip-nx-cache --configuration=development 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/modes/welcome-suggestions.ts
git commit -m "feat(examples-chat-angular): welcome suggestion exercising A2UI surfaces"
```

---

## Phase 3 — CHECKLIST.md

### Task 3.1: Populate Generative UI / A2UI surfaces section

**File:** `examples/chat/smoke/CHECKLIST.md`

Locate the empty `## Generative UI / A2UI surfaces` heading. It currently looks like:

```markdown
## Generative UI / A2UI surfaces

```

(possibly with `## Subagents` / `## Time travel / timeline` and other empty/populated sections after.)

- [ ] **Step 1: Replace just the empty heading with the populated section**

```markdown
## Generative UI / A2UI surfaces

- [ ] Click "Demo: render an interactive A2UI surface" welcome suggestion
- [ ] Parent AI emits a tool_call to `render_demo_form` (no plain markdown reply yet)
- [ ] Final assistant bubble renders an `<a2ui-surface>` (a Card titled "Quick feedback") instead of plain markdown
- [ ] Card contains: TextField labeled "Your name", ChoicePicker labeled "Rating" with options 1-5, Submit button labeled "Submit feedback"
- [ ] Required-name validation: Submit button shows the inline error "Name is required" / "Enter your name before submitting" while the name field is empty
- [ ] Type a name → validation error clears
- [ ] Pick a rating → ChoicePicker updates the data model
- [ ] Click Submit → `<a2ui-surface>` emits an `A2uiActionMessage` (event name `feedbackSubmit`); chat round-trips it as a new user submit
- [ ] AI replies conversationally referencing the submitted form (acknowledges receipt; may quote the name/rating)
- [ ] Server-side: `curl localhost:2024/threads/<id>/state` shows: AI message with `tool_calls=[{ "name": "render_demo_form", ... }]`, ToolMessage with `content="rendered"`, AI message whose `content` starts with `---a2ui_JSON---\n`
- [ ] No console errors during the surface render or submit cycle
```

DO NOT touch other Phase 2+ sections that are already populated (`## Reasoning blocks`, `## Tool calls`, `## Interrupts / human-in-the-loop`, `## Citations`, `## Subagents`) or empty (`## Time travel / timeline`, `## Multi-thread`).

- [ ] **Step 2: Verify the diff**

```bash
git diff examples/chat/smoke/CHECKLIST.md | head -40
```

Expected: only the Generative UI / A2UI surfaces section gains content; nothing else changes.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/smoke/CHECKLIST.md
git commit -m "docs(examples-chat-smoke): populate Generative UI / A2UI surfaces checklist"
```

---

## Phase 4 — Verification + PR

### Task 4.1: Full local sweep

- [ ] **Step 1: Python smoke**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run examples-chat-python:smoke --skip-nx-cache 2>&1 | tail -3
```

Expected: 11 passed.

- [ ] **Step 2: Angular tests**

```bash
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
npx nx run examples-chat-angular:test --skip-nx-cache 2>&1 | tail -3
```

Expected: 9 tests pass (no test count change — Phase 4 touches no Angular test files).

- [ ] **Step 3: Angular lint**

```bash
npx nx run examples-chat-angular:lint --skip-nx-cache 2>&1 | tail -3
```

Expected: 0 errors.

- [ ] **Step 4: Angular build**

```bash
npx nx run examples-chat-angular:build --skip-nx-cache --configuration=development 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 5: Confirm commit count**

```bash
git rev-list --count origin/main..HEAD
```

Expected: 3 commits.

- [ ] **Step 6: Server-side end-to-end probe (render_demo_form dispatch + A2UI prefix in final AI message)**

Confirm `OPENAI_API_KEY` is in `examples/chat/python/.env`:

```bash
ls examples/chat/python/.env 2>/dev/null && head -1 examples/chat/python/.env | cut -c1-30
```

Start the backend in the background:

```bash
nohup uv run --directory examples/chat/python langgraph dev --port 2024 --no-browser > /tmp/exchat-py-4.log 2>&1 &
sleep 4
curl -sf http://localhost:2024/ok && echo " backend OK"
```

Submit the welcome prompt that triggers the `render_demo_form` tool call. Use `runs/wait` (final state):

```bash
tid=$(curl -sf -X POST -H 'Content-Type: application/json' http://localhost:2024/threads -d '{}' | python3 -c "import sys,json;print(json.load(sys.stdin)['thread_id'])")
echo "thread=$tid"
curl -sf -X POST -H 'Content-Type: application/json' "http://localhost:2024/threads/$tid/runs/wait" \
  -d '{"assistant_id":"chat","input":{"messages":[{"role":"user","content":"Use the render_demo_form tool to show me a feedback card with name and rating fields."}],"model":"gpt-5-mini"}}' \
  > /tmp/4-final.json
```

Inspect the response — expect a `render_demo_form` tool call, a ToolMessage with content "rendered", and a final AI message whose content starts with `---a2ui_JSON---`:

```bash
python3 << 'EOF'
import json
d = json.load(open('/tmp/4-final.json'))
msgs = d.get('messages', []) if isinstance(d, dict) else []
print('total msgs:', len(msgs))
ai_with_tool_calls = [m for m in msgs if m.get('type') == 'ai' and m.get('tool_calls')]
render_calls = []
for ai in ai_with_tool_calls:
    for tc in ai.get('tool_calls', []):
        if tc.get('name') == 'render_demo_form':
            render_calls.append(tc)
print('render_demo_form tool_calls:', len(render_calls))
for tc in render_calls[:1]:
    print('  args:', json.dumps(tc.get('args', {}))[:120])
tool_msgs = [m for m in msgs if m.get('type') == 'tool']
print('tool messages:', len(tool_msgs))
for tm in tool_msgs[:1]:
    print('  content:', repr(tm.get('content'))[:80])
final_ai = [m for m in msgs if m.get('type') == 'ai' and not m.get('tool_calls')]
print('final AI (no tool_calls):', len(final_ai))
for ai in final_ai[-1:]:
    c = ai.get('content', '')
    text = c if isinstance(c, str) else next((b.get('text','') for b in c if isinstance(b, dict) and b.get('type')=='text'), '')
    print('starts with prefix:', text.startswith('---a2ui_JSON---'))
    print('first 80 chars:', repr(text[:80]))
EOF
```

Expected:
- `render_demo_form tool_calls: 1` (or more)
- `args: {"form_type": "feedback"}` (or similar)
- `tool messages: >= 1` with content containing `"rendered"`
- `final AI (no tool_calls): 1` with `starts with prefix: True` and `first 80 chars: "'---a2ui_JSON---\\n{...createSurface...'"`

If `starts with prefix: False`, the routing did not divert correctly — re-check `should_continue` (Step 3 of Task 1.2) and the conditional edges map (Step 6).

- [ ] **Step 7: Stop backend**

```bash
pkill -f "langgraph dev" 2>/dev/null
sleep 1
lsof -nP -iTCP:2024 -sTCP:LISTEN 2>&1 | head -2
```

Expected: nothing listening on :2024.

### Task 4.2: Push + open PR

- [ ] **Step 1: Push**

```bash
git push -u origin claude/examples-chat-phase-4-generative-ui 2>&1 | tail -3
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(examples-chat): Phase 4 — generative UI / A2UI surfaces" --body "$(cat <<'EOF'
## Summary

Layers Generative UI / A2UI surfaces onto the canonical demo by adding a tool-driven, deterministic-post-process render path. The parent AI dispatches a new `render_demo_form` tool; routing diverts to a new `emit_a2ui_surface` node that synthesizes the satisfying ToolMessage plus an AIMessage carrying the `---a2ui_JSON---` wire-format prefix and a hardcoded feedback-form JSONL surface spec. The existing `<chat>` composition's content classifier auto-detects the prefix and renders `<a2ui-surface>` (already mounted by the composition); submitting the form's button round-trips through `agent.submit` with no extra plumbing.

- **Python graph**: `A2UI_PREFIX` + `FEEDBACK_FORM_JSONL` constants, `render_demo_form` `@tool`, `emit_a2ui_surface` async node, `should_continue` extended with the new branch, conditional-edges map updated, new `emit_a2ui_surface → attach_citations` edge, bound on the parent in 2 places (`bind_tools`, `ToolNode`). Existing `tools → generate` loop unaffected for other tool calls. SYSTEM_PROMPT extended by one paragraph.
- **Welcome suggestion**: 10th entry "Demo: render an interactive A2UI surface".
- **CHECKLIST.md**: Generative UI / A2UI surfaces section populated.
- **Zero Angular shell wiring**: `<chat>` already imports `A2uiSurfaceComponent` and routes form-action messages through `agent.submit`.

Hardcoded JSONL because A2UI's schema-exact format is not a reliable LLM capability today (cockpit author's documented constraint at `cockpit/chat/a2ui/python/src/graph.py`). The AI decides *when* to render; Python pins the schema correctness.

Spec: `docs/superpowers/specs/2026-05-09-canonical-chat-demo-phase-4-generative-ui-design.md`
Plan: `docs/superpowers/plans/2026-05-09-canonical-chat-demo-phase-4-generative-ui.md`

## Test plan

### Verified locally
- [x] `nx run examples-chat-python:smoke` — 11 passed (8 existing + 3 new)
- [x] `nx run examples-chat-angular:test` — 9 passed
- [x] `nx run examples-chat-angular:lint` — 0 errors
- [x] `nx run examples-chat-angular:build` — succeeds (development)
- [x] **Server-side end-to-end probe**: submit the welcome prompt with model=gpt-5-mini. Final messages: AI tool_call with `name: 'render_demo_form'` and `args.form_type: 'feedback'`, ToolMessage with `content: 'rendered'`, final AI message whose content starts with `---a2ui_JSON---\n{...createSurface...}`.

### Pending visual verification
- [ ] After merge: live smoke against the workspace `examples/chat` demo. The assistant bubble renders an `<a2ui-surface>` Card titled "Quick feedback" with a TextField, a ChoicePicker, and a Submit button. Required-name validation works. Click Submit → AI replies conversationally referencing the form.

(Visual sweep continues against issue #214; rolls together with the next iteration.)
EOF
)" 2>&1 | tail -3
```

- [ ] **Step 3: Note the PR URL.**

- [ ] **Step 4: Wait for CI; address failures.**

- [ ] **Step 5: Merge once green.**

---

## Definition of done

1. PR merged.
2. CI green: `nx run examples-chat-python:smoke` (11 pytest), `nx run examples-chat-angular:test/lint/build`.
3. Server-side probe confirms: AI tool_call → ToolMessage("rendered") → final AIMessage starts with `---a2ui_JSON---\n` and contains `createSurface` / `updateComponents` envelopes.
4. Welcome list now has 10 entries; the 10th references "render an interactive A2UI surface".
5. CHECKLIST `## Generative UI / A2UI surfaces` section populated; other empty Phase 4+ sections (`## Time travel / timeline`, `## Multi-thread`) remain empty.
