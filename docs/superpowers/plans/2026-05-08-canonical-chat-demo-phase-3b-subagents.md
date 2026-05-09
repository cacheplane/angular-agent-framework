# Canonical `examples/chat` Demo — Phase 3B: Subagents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer subagents onto the canonical demo by adding a compiled child graph (`research`) the parent LLM can dispatch as a tool. Surface running subagents in the demo shell via the existing `<chat-subagents>` composition. Add one welcome suggestion that exercises the flow.

**Architecture:** Tool-driven dispatch — the parent AI calls a `research(topic)` tool whose body invokes a small compiled child `StateGraph` via `await research_subgraph.ainvoke(...)`. LangGraph emits stream events for the child run with namespace prefix `tools:<id>`; the `@ngaf/langgraph` adapter's `SubagentTracker` keys on that prefix and on tool calls whose name appears in `subagentToolNames` (`['research']` here), so `agent.subagents()` populates automatically. Frontend mounts `<chat-subagents>` (read-only display) above the chat input; the existing Phase 2B `tools` ToolNode handles dispatch with zero new graph edges.

**Tech Stack:** Python 3.12 (uv, `langgraph.graph.StateGraph`, `langchain-openai`, `langchain-core`), pytest. Angular 21 (signals, OnPush). No new dependencies — `<chat-subagents>` and `SubagentTracker` already ship in `@ngaf/chat` / `@ngaf/langgraph`.

**Spec:** `docs/superpowers/specs/2026-05-08-canonical-chat-demo-phase-3b-subagents-design.md`

**Branch:** `claude/examples-chat-phase-3b-subagents`, branched from `origin/main` (currently `d42f54b7` — tip after PR #223 merged).

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, comments, commit messages, or PR titles/bodies. Mentions in markdown spec/plan docs are OK as third-party library names; do not propagate.

---

## File Structure

```
examples/chat/
├── python/
│   ├── src/graph.py                                       # +1 import, +ResearchState/research_node/research_subgraph (~25 LOC), +research @tool (~10 LOC), bind in 2 places, +1 paragraph in SYSTEM_PROMPT (~5 LOC)
│   └── tests/test_graph_smoke.py                          # +2 smoke tests
├── angular/src/app/
│   ├── shell/
│   │   ├── demo-shell.component.ts                        # +ChatSubagentsComponent import + imports[], +subagentToolNames option (~3 LOC)
│   │   ├── demo-shell.component.html                      # +@if(agent.subagents()) block (~5 LOC)
│   │   └── demo-shell.component.css                       # +.demo-shell__subagents (~10 LOC)
│   └── modes/welcome-suggestions.ts                       # +1 entry
└── smoke/CHECKLIST.md                                     # populate Subagents section
```

Total ≈ 90 LOC.

---

## Phase 0 — Branch creation

### Task 0.1: Create implementation branch

- [ ] **Step 1: Branch from origin/main**

```bash
cd /Users/blove/repos/angular-agent-framework
git fetch origin main
git checkout -b claude/examples-chat-phase-3b-subagents origin/main
git rev-parse --abbrev-ref HEAD   # must echo claude/examples-chat-phase-3b-subagents
git log --oneline -1              # must be d42f54b7 or later (PR #223 merged)
```

---

## Phase 1 — Python graph (TDD)

### Task 1.1: Failing tests

**File:** `examples/chat/python/tests/test_graph_smoke.py`

The current file (post Phase 3A) has 6 tests. Append two new test functions at the END of the file:

- [ ] **Step 1: Append the two new tests**

```python


@pytest.mark.smoke
def test_research_tool_exists():
    from src.graph import research, research_subgraph
    assert research is not None
    # @tool decorator gives the resulting object a `.name` attribute
    assert research.name == "research"
    # research_subgraph is the compiled child StateGraph
    assert research_subgraph is not None
    # A compiled LangGraph exposes get_graph() with at least one node
    nodes = set(research_subgraph.get_graph().nodes.keys())
    assert "research_node" in nodes


@pytest.mark.smoke
def test_state_graph_topology_unchanged_after_research():
    # Regression check: Phase 3B must not break Phase 2B / 3A topology.
    from src.graph import graph
    nodes = set(graph.get_graph().nodes.keys())
    assert "generate" in nodes
    assert "tools" in nodes
    assert "attach_citations" in nodes
```

- [ ] **Step 2: Run smoke — both new tests must FAIL**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run pytest -q -m smoke
```

Expected: 6 existing pass, 2 new FAIL. The first new test fails with `ImportError: cannot import name 'research' from 'src.graph'`. The second new test passes (Phase 2B already added `tools`/`attach_citations`, Phase 3A kept them) — it's a regression check, intentional that it stays green throughout.

If `test_research_tool_exists` somehow passes, an earlier change already added the tool — STOP and report DONE_WITH_CONCERNS.

Do NOT commit yet — Task 1.2 commits the test + implementation together.

### Task 1.2: Implement the research subagent + tool + graph wiring + system prompt

**File:** `examples/chat/python/src/graph.py`

Make five edits to the existing file (do NOT replace the whole file — Phase 2B's tool, ToolNode, attach_citations, Phase 3A's interrupt + request_approval must all remain).

- [ ] **Step 1: Add `HumanMessage` to existing langchain_core import**

Locate the existing import block:

```python
from langchain_core.messages import (
    AIMessage,
    RemoveMessage,
    SystemMessage,
    ToolMessage,
)
```

Add `HumanMessage` (sorted alphabetically) so the block becomes:

```python
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    RemoveMessage,
    SystemMessage,
    ToolMessage,
)
```

- [ ] **Step 2: Append the research subagent + tool, after `request_approval`**

Locate the existing `request_approval` `@tool` block (ends with `return f"Human response: {response}"`). Insert the following directly AFTER that function and BEFORE the existing `class State(TypedDict):` line.

```python


# Research subagent — a small compiled child graph the parent dispatches
# via the `research` @tool. Running it as an actual subgraph (vs. inline
# logic) is what causes LangGraph to emit stream events under namespace
# prefix `tools:<id>` for the child run, which is what the @ngaf/langgraph
# SubagentTracker keys on to populate `agent.subagents()`.
class ResearchState(TypedDict):
    messages: Annotated[list, add_messages]
    topic: Optional[str]


async def research_node(state: ResearchState) -> dict:
    """Single-node child graph: focus on the topic, return a short brief.

    Uses gpt-5-mini directly (the parent's model selection does not
    propagate into the subagent — the subagent is a focused contractor).
    """
    topic = state.get("topic") or ""
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)
    system = SystemMessage(content=(
        "You are a focused research subagent. Given a topic, return a "
        "concise factual summary (3-6 bullets). Do not ask the user "
        "questions; the parent agent already gathered the topic."
    ))
    user = HumanMessage(content=f"Topic: {topic}")
    response = await llm.ainvoke([system, user])
    return {"messages": [response]}


_research_builder = StateGraph(ResearchState)
_research_builder.add_node("research_node", research_node)
_research_builder.set_entry_point("research_node")
_research_builder.add_edge("research_node", END)
research_subgraph = _research_builder.compile()


@tool
async def research(topic: str) -> str:
    """Dispatch a research subagent to gather facts on a focused topic.
    The subagent returns a concise summary; pass that summary back to
    the user, citing it with the inline citation syntax if appropriate.
    """
    result = await research_subgraph.ainvoke({"topic": topic, "messages": []})
    msgs = result.get("messages") if isinstance(result, dict) else None
    if not msgs:
        return "(no research returned)"
    last = msgs[-1]
    content = getattr(last, "content", None) if not isinstance(last, dict) else last.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        # ChatOpenAI may return content as list of blocks; collect text.
        parts = []
        for b in content:
            if isinstance(b, dict) and b.get("type") == "text":
                parts.append(b.get("text", ""))
        return "\n".join(parts) if parts else "(no research returned)"
    return "(no research returned)"
```

- [ ] **Step 3: Bind `research` to the parent LLM**

Locate the existing `bind_tools` call inside `generate`:

```python
    llm = ChatOpenAI(**kwargs).bind_tools([search_documents, request_approval])
```

Add `research` to the list:

```python
    llm = ChatOpenAI(**kwargs).bind_tools([search_documents, request_approval, research])
```

- [ ] **Step 4: Add `research` to the parent ToolNode**

Locate the existing builder:

```python
_builder.add_node("tools", ToolNode([search_documents, request_approval]))
```

Add `research`:

```python
_builder.add_node("tools", ToolNode([search_documents, request_approval, research]))
```

- [ ] **Step 5: Extend SYSTEM_PROMPT with one paragraph**

Locate the closing `)` of the existing `SYSTEM_PROMPT` string concatenation (after the request_approval paragraph). Insert one more concatenated string literal directly before the closing `)`:

```python
    "When the user asks for in-depth research on a focused topic (history, "
    "motivation, comparison, deep-dive on something they want explained), "
    "call the `research` tool to dispatch a subagent that focuses on that "
    "topic. Pass the topic verbatim or as a concise rephrasing. Use the "
    "subagent's returned summary to compose your final answer. Do not "
    "call `research` for trivial chit-chat or simple lookups — those are "
    "handled by `search_documents`."
```

So the final SYSTEM_PROMPT now ends with the existing request_approval paragraph followed by this new research paragraph, all inside one parenthesized string concatenation.

- [ ] **Step 6: Run pytest — all 8 must pass**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run pytest -q -m smoke
```

Expected: 8 passed (6 existing + 2 new).

- [ ] **Step 7: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add examples/chat/python/src/graph.py examples/chat/python/tests/test_graph_smoke.py
git commit -m "feat(examples-chat-python): research subagent + tool"
```

---

## Phase 2 — Angular adapter config

### Task 2.1: Pass `subagentToolNames: ['research']` to the agent factory

**File:** `examples/chat/angular/src/app/shell/demo-shell.component.ts`

The `agent({...})` factory call lives at line 84 (currently passes `apiUrl`, `assistantId`, `threadId`, `onThreadId`). Add `subagentToolNames: ['research']` to that options object.

- [ ] **Step 1: Edit the factory call**

Locate:

```typescript
    const a = agent({
      apiUrl: 'http://localhost:2024',
      assistantId: 'chat',
      threadId: this.threadIdSignal,
      onThreadId: (id: string) => {
        this.threadIdSignal.set(id);
        this.persistence.write('threadId', id);
      },
    });
```

Change to:

```typescript
    const a = agent({
      apiUrl: 'http://localhost:2024',
      assistantId: 'chat',
      threadId: this.threadIdSignal,
      onThreadId: (id: string) => {
        this.threadIdSignal.set(id);
        this.persistence.write('threadId', id);
      },
      // Phase 3B: tells SubagentTracker to treat `research` tool calls as
      // subagent dispatches and to materialize agent.subagents() from the
      // resulting tools:<id>-namespaced stream events.
      subagentToolNames: ['research'],
    });
```

- [ ] **Step 2: Confirm build**

```bash
cd /Users/blove/repos/angular-agent-framework
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
npx nx run examples-chat-angular:lint --skip-nx-cache 2>&1 | tail -3
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts
git commit -m "feat(examples-chat-angular): register research as a subagent tool"
```

---

## Phase 3 — Angular shell wiring

### Task 3.1: Mount `<chat-subagents>` in the demo shell

**Files:**
- `examples/chat/angular/src/app/shell/demo-shell.component.ts` — add `ChatSubagentsComponent` to imports.
- `examples/chat/angular/src/app/shell/demo-shell.component.html` — add `@if` block.
- `examples/chat/angular/src/app/shell/demo-shell.component.css` — add `.demo-shell__subagents` rule.

- [ ] **Step 1: Add `ChatSubagentsComponent` to the demo-shell imports**

In `demo-shell.component.ts`, locate the existing `@ngaf/chat` import:

```typescript
import { ChatDebugComponent, ChatInterruptPanelComponent, type InterruptAction } from '@ngaf/chat';
```

Replace with:

```typescript
import { ChatDebugComponent, ChatInterruptPanelComponent, ChatSubagentsComponent, type InterruptAction } from '@ngaf/chat';
```

And locate the component decorator's `imports` array:

```typescript
  imports: [RouterOutlet, ControlPalette, ChatDebugComponent, ChatInterruptPanelComponent],
```

Replace with:

```typescript
  imports: [RouterOutlet, ControlPalette, ChatDebugComponent, ChatInterruptPanelComponent, ChatSubagentsComponent],
```

- [ ] **Step 2: Add the `@if` block to the template**

In `demo-shell.component.html`, locate the existing interrupt-panel block:

```html
  @if (agent.interrupt && agent.interrupt()) {
    <div class="demo-shell__interrupt-panel" role="region" aria-label="Approval required">
      <chat-interrupt-panel [agent]="agent" (action)="onInterruptAction($event)" />
    </div>
  }
```

Insert the following `@if` block directly AFTER the interrupt-panel block (and BEFORE the `@if (debugOpen())` block):

```html

  @if (agent.subagents && agent.subagents().size > 0) {
    <div class="demo-shell__subagents" role="region" aria-label="Active subagents">
      <chat-subagents [agent]="agent" />
    </div>
  }
```

`<chat-subagents>` filters to active (non-complete, non-error) subagents internally, so the wrapper appears whenever the agent has any subagent (active or done) — the inner `@for` will render zero cards once all subagents finish, which is fine; the wrapper collapses visually because there are no children.

- [ ] **Step 3: Add the CSS rule**

In `demo-shell.component.css`, append a new rule directly after the existing `.demo-shell__interrupt-panel` rule:

```css

.demo-shell__subagents {
  position: fixed;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  z-index: 997;
  width: min(640px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

Z-index 997 sits just below the interrupt panel (998) and the debug overlay (999). The two never coexist in practice (an interrupt fires only mid-tool-call after the AI emits a tool_call but before tool result; subagents render once a tool_call dispatches), but stacking is defined.

- [ ] **Step 4: Build + lint**

```bash
cd /Users/blove/repos/angular-agent-framework
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
npx nx run examples-chat-angular:lint --skip-nx-cache 2>&1 | tail -3
npx nx run examples-chat-angular:build --skip-nx-cache --configuration=development 2>&1 | tail -3
```

Expected: 0 lint errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts examples/chat/angular/src/app/shell/demo-shell.component.html examples/chat/angular/src/app/shell/demo-shell.component.css
git commit -m "feat(examples-chat-angular): mount chat-subagents in demo shell"
```

---

## Phase 4 — Welcome suggestion entry

### Task 4.1: Add the "dispatch research subagent" suggestion

**File:** `examples/chat/angular/src/app/modes/welcome-suggestions.ts`

The current file has 8 entries (post Phase 3A). Append a 9th entry to the `WELCOME_SUGGESTIONS` array.

- [ ] **Step 1: Append entry**

Locate the closing `];` of the array. Insert this entry as the last element (before the closing `]`):

```typescript
  {
    label: 'Demo: dispatch a research subagent',
    value:
      'Use the research subagent to investigate the history and motivation behind Angular standalone components, then report back with a concise summary.',
  },
```

The full new last two entries should look like:

```typescript
  {
    label: 'Demo: ask for approval before a sensitive action',
    value:
      'I want to clean up old database backups older than 90 days. Walk me through what you would delete, and call request_approval before doing anything destructive so I can review your plan.',
  },
  {
    label: 'Demo: dispatch a research subagent',
    value:
      'Use the research subagent to investigate the history and motivation behind Angular standalone components, then report back with a concise summary.',
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
git commit -m "feat(examples-chat-angular): welcome suggestion exercising subagents"
```

---

## Phase 5 — CHECKLIST.md

### Task 5.1: Populate Subagents section

**File:** `examples/chat/smoke/CHECKLIST.md`

Locate the empty `## Subagents` heading. It currently looks like:

```markdown
## Subagents

```

(possibly with `## Time travel / timeline` and other empty sections after.)

- [ ] **Step 1: Replace just the empty heading with the populated section**

```markdown
## Subagents

- [ ] Click "Demo: dispatch a research subagent" welcome suggestion
- [ ] Parent AI begins planning, then emits a tool_call to `research` — graph dispatches the subagent
- [ ] `<chat-subagents>` panel appears above the chat input with one running subagent card
- [ ] Card surfaces the subagent's status (running) and the tool-call args (topic) while the child runs
- [ ] Once the subagent completes, the active filter hides its card; parent AI emits its final summary message in the chat
- [ ] Server-side: `curl localhost:2024/threads/<id>/state` shows tool_calls included `{ "name": "research", ... }` and the subgraph's messages were emitted under a `tools:<id>` namespace
- [ ] No console errors during the subagent run; no flicker of the subagents panel during streaming
```

DO NOT touch other empty Phase 2+ sections (`## Generative UI / A2UI surfaces`, `## Time travel / timeline`, `## Multi-thread`).

- [ ] **Step 2: Verify the diff**

```bash
git diff examples/chat/smoke/CHECKLIST.md | head -30
```

Expected: only the Subagents section gains content; nothing else changes.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/smoke/CHECKLIST.md
git commit -m "docs(examples-chat-smoke): populate Subagents checklist"
```

---

## Phase 6 — Verification + PR

### Task 6.1: Full local sweep

- [ ] **Step 1: Python smoke**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run examples-chat-python:smoke --skip-nx-cache 2>&1 | tail -3
```

Expected: 8 passed.

- [ ] **Step 2: Angular tests**

```bash
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
npx nx run examples-chat-angular:test --skip-nx-cache 2>&1 | tail -3
```

Expected: 9 tests pass (no test count change — Phase 3B touches no Angular test files).

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

Expected: 5 commits.

- [ ] **Step 6: Server-side end-to-end probe (subagent dispatch + return)**

Confirm `OPENAI_API_KEY` is in `examples/chat/python/.env`:

```bash
ls examples/chat/python/.env 2>/dev/null && head -1 examples/chat/python/.env | cut -c1-30
```

Start the backend in the background:

```bash
nohup uv run --directory examples/chat/python langgraph dev --port 2024 --no-browser > /tmp/exchat-py-3b.log 2>&1 &
sleep 4
curl -sf http://localhost:2024/ok && echo " backend OK"
```

Submit the standalone-components research prompt that triggers the `research` tool. Use `runs/wait` (final state):

```bash
tid=$(curl -sf -X POST -H 'Content-Type: application/json' http://localhost:2024/threads -d '{}' | python3 -c "import sys,json;print(json.load(sys.stdin)['thread_id'])")
echo "thread=$tid"
curl -sf -X POST -H 'Content-Type: application/json' "http://localhost:2024/threads/$tid/runs/wait" \
  -d "{\"assistant_id\":\"chat\",\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"Use the research subagent to investigate the history and motivation behind Angular standalone components, then report back with a concise summary.\"}],\"model\":\"gpt-5-mini\"}}" \
  > /tmp/3b-final.json
```

Inspect the response — the run should complete (no pause) with a tool_call + tool result + final AI message:

```bash
python3 << 'EOF'
import json
d = json.load(open('/tmp/3b-final.json'))
msgs = d.get('messages', []) if isinstance(d, dict) else []
ai_with_tool_calls = [m for m in msgs if m.get('type') == 'ai' and m.get('tool_calls')]
research_calls = []
for ai in ai_with_tool_calls:
    for tc in ai.get('tool_calls', []):
        if tc.get('name') == 'research':
            research_calls.append(tc)
final_ai = [m for m in msgs if m.get('type') == 'ai' and not m.get('tool_calls')]
print('total msgs:', len(msgs))
print('research tool_calls:', len(research_calls))
for tc in research_calls[:1]:
    print('  args:', json.dumps(tc.get('args', {}))[:120])
print('final AI (no tool_calls):', len(final_ai))
if final_ai:
    c = final_ai[-1].get('content', '')
    text = c if isinstance(c, str) else next((b.get('text', '') for b in c if isinstance(b, dict) and b.get('type') == 'text'), '')
    print('final answer preview:', text[:240].replace('\n', ' '))
EOF
```

Expected: at least one AI message has a tool_call with `name: 'research'` and `args` containing the topic; a final AI message exists (no tool_calls) with a substantive summary referencing standalone components.

Confirm the subgraph emitted `tools:`-namespaced events by streaming a fresh run and grepping the SSE event stream:

```bash
tid2=$(curl -sf -X POST -H 'Content-Type: application/json' http://localhost:2024/threads -d '{}' | python3 -c "import sys,json;print(json.load(sys.stdin)['thread_id'])")
curl -sN -X POST -H 'Content-Type: application/json' "http://localhost:2024/threads/$tid2/runs/stream" \
  -d "{\"assistant_id\":\"chat\",\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"Use the research subagent to investigate Angular signals.\"}],\"model\":\"gpt-5-mini\"},\"stream_mode\":[\"messages-tuple\",\"updates\",\"values\"],\"stream_subgraphs\":true}" \
  > /tmp/3b-stream.sse 2>&1 &
sleep 25
pkill -f "runs/stream" 2>/dev/null || true
grep -c "research_node" /tmp/3b-stream.sse || true
grep -E "namespace.*research_node|tools:[a-z0-9_-]+" /tmp/3b-stream.sse | head -3 || true
```

Expected: at least one match for `research_node` (the subgraph node name) appears in the stream events. (`stream_subgraphs: true` is what causes the SDK to surface child events with their namespace; the @ngaf/langgraph adapter passes this on by default.)

- [ ] **Step 7: Stop backend**

```bash
pkill -f "langgraph dev" 2>/dev/null
sleep 1
lsof -nP -iTCP:2024 -sTCP:LISTEN 2>&1 | head -2
```

Expected: nothing listening on :2024.

### Task 6.2: Push + open PR

- [ ] **Step 1: Push**

```bash
git push -u origin claude/examples-chat-phase-3b-subagents 2>&1 | tail -3
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(examples-chat): Phase 3B — subagents" --body "$(cat <<'EOF'
## Summary

Layers subagents onto the canonical demo by adding a compiled child graph (`research`) the parent dispatches as a tool. Surfaces `<chat-subagents>` in the demo shell. Adds one welcome suggestion.

- **Python graph**: `ResearchState` TypedDict + `research_node` async function + compiled `research_subgraph` (single-node child graph) + `research` `@tool` whose body awaits `research_subgraph.ainvoke(...)`. Bound on the parent in 2 places (`bind_tools`, `ToolNode`); zero new graph edges. SYSTEM_PROMPT extended by one paragraph instructing the parent to dispatch `research` for in-depth topic questions.
- **Angular adapter config**: `subagentToolNames: ['research']` passed to the `agent({...})` factory in `demo-shell.component.ts`. This populates `agent.subagents()` from `tools:<id>`-namespaced child stream events that the SubagentTracker keys on.
- **Demo shell**: import `ChatSubagentsComponent` from `@ngaf/chat`; add to `imports` array; mount `<chat-subagents [agent]="agent" />` in a fixed-position panel above the chat input via `@if (agent.subagents && agent.subagents().size > 0)`.
- **Welcome suggestion**: 9th entry "Demo: dispatch a research subagent".
- **CHECKLIST.md**: Subagents section populated.

`<chat-subagents>` filters to active (non-complete) subagents internally, so the card flashes during the child run and disappears once the parent has the summary back. Persisting the card after completion is a Phase 4+ concern.

Spec: `docs/superpowers/specs/2026-05-08-canonical-chat-demo-phase-3b-subagents-design.md`
Plan: `docs/superpowers/plans/2026-05-08-canonical-chat-demo-phase-3b-subagents.md`

Phase 4+ (generative UI, time travel, multi-thread) is later.

## Test plan

### Verified locally
- [x] `nx run examples-chat-python:smoke` — 8 passed (6 existing + 2 new)
- [x] `nx run examples-chat-angular:test` — 9 passed
- [x] `nx run examples-chat-angular:lint` — 0 errors
- [x] `nx run examples-chat-angular:build` — succeeds (development)
- [x] **Server-side end-to-end probe**: submit the standalone-components welcome prompt with model=gpt-5-mini. Final messages: AI tool_call with `name: 'research'` and the topic in `args`; ToolMessage with the subagent's summary; final AI message (no tool_calls) referencing standalone components. SSE stream with `stream_subgraphs: true` includes events from the `research_node` subgraph, confirming child events flow with the namespace prefix the SubagentTracker keys on.

### Pending visual verification
- [ ] After merge: live smoke against the workspace `examples/chat` demo. `<chat-subagents>` panel appears above the chat input while the research subagent runs; disappears once the parent emits its final summary.

(Visual sweep continues against issue #214; rolls together with the next iteration.)
EOF
)"
```

- [ ] **Step 3: Note the PR URL.**

- [ ] **Step 4: Wait for CI; address failures.**

- [ ] **Step 5: Merge once green.**

---

## Definition of done

1. PR merged.
2. CI green: `nx run examples-chat-python:smoke` (8 pytest), `nx run examples-chat-angular:test/lint/build`.
3. Server-side probe confirms: AI message with `research` tool call → subgraph executes → ToolMessage with summary → final AI message with substantive answer.
4. Welcome list now has 9 entries; the 9th references "dispatch a research subagent".
5. CHECKLIST `## Subagents` section populated; other Phase 2+ sections remain empty.
