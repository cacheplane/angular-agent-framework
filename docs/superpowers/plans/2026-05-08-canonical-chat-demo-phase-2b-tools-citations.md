# Canonical `examples/chat` Demo — Phase 2B: Tool Calls + Citations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer tool calls and citations onto the canonical demo by extending the python graph from a single-node `__start__ → generate → __end__` into a ReAct-style loop with a `tools` node and a terminal `attach_citations` post-process. Add one welcome suggestion that exercises both surfaces.

**Architecture:** Python-side change only — the chat composition's `<chat-tool-calls>` and `<chat-citations>` primitives already auto-render. Hardcoded 5-document corpus + a `search_documents` tool + conditional edge from `generate` to either `tools` (loop) or `attach_citations` (terminal). The post-process walks back from the final AI message to find the most recent `ToolMessage`, parses its JSON content, and replaces the AI message with one carrying `additional_kwargs.citations` populated (RemoveMessage + AIMessage with same id).

**Tech Stack:** Python 3.12 (uv, langgraph, langgraph.prebuilt.ToolNode, langchain-openai, langchain-core), pytest. No new dependencies — `ToolNode` ships in `langgraph` already.

**Spec:** `docs/superpowers/specs/2026-05-08-canonical-chat-demo-phase-2b-tools-citations-design.md`

**Branch:** `claude/examples-chat-phase-2b-tools-citations`, branched from `origin/main` (currently `72cf2391`).

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, comments, commit messages, or PR titles/bodies. Mentions in markdown spec/plan docs are OK as third-party library names; do not propagate.

---

## File Structure

```
examples/chat/
├── python/
│   ├── src/graph.py                                        # +1 corpus, +1 tool, +should_continue, +attach_citations, topology change, system-prompt extension (~80 LOC)
│   └── tests/test_graph_smoke.py                           # +2 smoke tests
├── angular/src/app/modes/welcome-suggestions.ts            # +1 entry
└── smoke/CHECKLIST.md                                      # populate Tool calls + Citations sections
```

Total ≈ 120 LOC.

---

## Phase 0 — Branch creation

### Task 0.1: Create implementation branch

- [ ] **Step 1: Branch from origin/main**

```bash
cd /Users/blove/repos/angular-agent-framework
git fetch origin main
git checkout -b claude/examples-chat-phase-2b-tools-citations origin/main
git rev-parse --abbrev-ref HEAD   # must echo claude/examples-chat-phase-2b-tools-citations
git log --oneline -1              # must be 72cf2391 or later (Finding D fix)
```

---

## Phase 1 — Python graph (TDD: failing topology + tool tests, then implement)

### Task 1.1: Add the failing smoke tests

**File:** `examples/chat/python/tests/test_graph_smoke.py`

The current file has 2 tests (`test_graph_imports`, `test_state_shape_includes_required_channels`). Append two new test functions at the end:

```python


@pytest.mark.smoke
def test_state_graph_has_tools_and_attach_citations_nodes():
    from src.graph import graph
    nodes = set(graph.get_graph().nodes.keys())
    assert "generate" in nodes, "State graph must keep the generate node"
    assert "tools" in nodes, "State graph must add a tools node (Phase 2B)"
    assert "attach_citations" in nodes, \
        "State graph must add an attach_citations terminal node (Phase 2B)"


@pytest.mark.smoke
def test_search_documents_tool_returns_json():
    import json
    from src.graph import search_documents
    result = search_documents.invoke({"query": "signals"})
    assert isinstance(result, str), \
        "search_documents must return a JSON string for ToolMessage compatibility"
    parsed = json.loads(result)
    assert isinstance(parsed, list)
    assert len(parsed) > 0, \
        "Hits list must be non-empty (fallback to first 3 docs when no match)"
    assert "title" in parsed[0]
    assert "url" in parsed[0]
    assert "snippet" in parsed[0]
    assert "id" in parsed[0]
```

- [ ] **Step 2: Run tests — both new tests must FAIL**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run pytest -q -m smoke
```

Expected: 2 existing pass, 2 new FAIL.

- `test_state_graph_has_tools_and_attach_citations_nodes` fails with `AssertionError: State graph must add a tools node (Phase 2B)`
- `test_search_documents_tool_returns_json` fails with `ImportError: cannot import name 'search_documents' from 'src.graph'`

If both new tests pass, the implementation already exists somewhere — STOP and report DONE_WITH_CONCERNS.

Do NOT commit yet — Task 1.2 commits the test + implementation together.

### Task 1.2: Implement the graph topology + tool + post-process

**File:** `examples/chat/python/src/graph.py`

Replace the entire current contents with:

```python
"""Single-node-plus-tools streaming chat graph.

State the client may send via the LangGraph ``submit``'s ``state`` field:

  - ``model`` — OpenAI model name. Default: ``gpt-5-mini``.
  - ``reasoning_effort`` — 'minimal' | 'low' | 'medium' | 'high'.
                           Default: 'minimal' so first-token latency
                           stays low. Demos surface this as a palette
                           dropdown so users can dial in visible reasoning.

Topology:

  __start__ → generate ─┬─ [has tool_calls] ─→ tools ─→ generate (loop)
                        └─ [no tool_calls]  ─→ attach_citations ─→ __end__

The terminal ``attach_citations`` node walks back from the final AI
message to the most recent ToolMessage, parses its JSON content, and
replaces the AI message with one carrying ``additional_kwargs.citations``
populated. Uses RemoveMessage + AIMessage with the same id (standard
LangGraph in-place edit pattern), keeping the chat composition's
track-by-id stable.
"""
import json
from typing import Annotated, Literal, Optional
from typing_extensions import TypedDict

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.messages import (
    AIMessage,
    RemoveMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import tool


SYSTEM_PROMPT = (
    "You are a helpful, concise assistant. "
    "Format responses with markdown when useful (headings, lists, code blocks, tables). "
    "When the user asks about specific Angular topics or technical questions, "
    "use the `search_documents` tool to find authoritative information before answering, "
    "and cite the sources inline using [1], [2], etc."
)

# Reasoning-capable model prefixes. We only attach the ``reasoning``
# parameter when the model name suggests reasoning support; setting it
# on a non-reasoning model would be ignored anyway.
REASONING_PREFIXES = ("gpt-5", "o1", "o3", "o4")


def _is_reasoning_model(name: str) -> bool:
    return any(name.startswith(p) for p in REASONING_PREFIXES)


# Hardcoded corpus for the search_documents tool. Five Angular topics
# that align with the demo's existing welcome suggestions. Deterministic;
# no external API calls; no API keys required.
DOCUMENTS = [
    {
        "id": "ng-signals-overview",
        "title": "Signals — Angular guide",
        "url": "https://angular.dev/guide/signals",
        "snippet": "Signals are a reactivity primitive that lets you describe values that change over time without manual subscriptions.",
    },
    {
        "id": "ng-signals-rxjs",
        "title": "RxJS interop with signals",
        "url": "https://angular.dev/guide/signals/rxjs-interop",
        "snippet": "toSignal() and toObservable() bridge between RxJS Observables and signals.",
    },
    {
        "id": "ng-control-flow",
        "title": "Built-in control flow — @if, @for, @switch",
        "url": "https://angular.dev/guide/templates/control-flow",
        "snippet": "Native template control flow replaces structural directives like *ngIf and *ngFor with built-in syntax.",
    },
    {
        "id": "ng-standalone",
        "title": "Standalone components",
        "url": "https://angular.dev/guide/components/importing",
        "snippet": "Standalone components, directives, and pipes import their dependencies directly without NgModules.",
    },
    {
        "id": "ng-zoneless",
        "title": "Zoneless change detection",
        "url": "https://angular.dev/guide/experimental/zoneless",
        "snippet": "provideExperimentalZonelessChangeDetection lets Angular run without zone.js by tracking signals and async state directly.",
    },
]


@tool
def search_documents(query: str) -> str:
    """Search the corpus for documents relevant to the query.

    Returns a JSON list of hits, each with id, title, url, snippet.
    Up to 4 hits are returned. If the query has no matches, returns
    the first 3 documents as a fallback so the demo always has
    something to cite.
    """
    q = (query or "").lower()
    hits = [
        d
        for d in DOCUMENTS
        if q in (d["title"] + " " + d["snippet"]).lower()
    ]
    if not hits:
        hits = DOCUMENTS[:3]
    return json.dumps(hits[:4])


class State(TypedDict):
    messages: Annotated[list, add_messages]
    model: Optional[str]
    reasoning_effort: Optional[str]


async def generate(state: State) -> dict:
    model_name = state.get("model") or "gpt-5-mini"
    kwargs = {"model": model_name, "streaming": True}
    if _is_reasoning_model(model_name):
        # Honor the client's effort selection when present; default to
        # 'minimal' so first-token latency stays low for unconfigured callers.
        effort = state.get("reasoning_effort") or "minimal"
        # `summary='auto'` instructs the OpenAI Responses API to emit
        # summary text inside the reasoning block (otherwise the block
        # arrives with an empty `summary: []` and the chat UI has nothing
        # to render). The adapter's `extractReasoning` reads either the
        # legacy `block.text` field or the modern `block.summary[].text`.
        kwargs["reasoning"] = {"effort": effort, "summary": "auto"}
    llm = ChatOpenAI(**kwargs).bind_tools([search_documents])
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    response = await llm.ainvoke(messages)
    return {"messages": [response]}


def should_continue(state: State) -> Literal["tools", "attach_citations"]:
    """Conditional edge: route from generate to either the tools node
    (when the AI emitted tool_calls) or the terminal attach_citations
    post-process."""
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return "attach_citations"


async def attach_citations(state: State) -> dict:
    """Terminal post-process: walk back from the final AI message to
    the most recent ToolMessage, parse its JSON content, and replace
    the AI message with one carrying additional_kwargs.citations.

    Returns an empty dict (no state update) when there is no preceding
    ToolMessage to draw citations from. The AI message is left as-is
    in that case — citations are an opt-in surface, not required.
    """
    msgs = state["messages"]
    last = msgs[-1]
    if not isinstance(last, AIMessage) or last.tool_calls:
        return {}

    citations = []
    for m in reversed(msgs[:-1]):
        if isinstance(m, ToolMessage):
            try:
                hits = json.loads(m.content) if isinstance(m.content, str) else []
            except json.JSONDecodeError:
                continue
            if isinstance(hits, list):
                for i, h in enumerate(hits):
                    if not isinstance(h, dict):
                        continue
                    citations.append(
                        {
                            "id": h.get("id") or f"c{i+1}",
                            "index": i + 1,
                            "title": h.get("title"),
                            "url": h.get("url"),
                            "snippet": h.get("snippet"),
                        }
                    )
            break  # only the most recent ToolMessage batch
        elif isinstance(m, AIMessage):
            break

    if not citations:
        return {}

    new_kwargs = dict(getattr(last, "additional_kwargs", {}) or {})
    new_kwargs["citations"] = citations
    return {
        "messages": [
            RemoveMessage(id=last.id),
            AIMessage(
                id=last.id,
                content=last.content,
                additional_kwargs=new_kwargs,
                tool_calls=getattr(last, "tool_calls", []) or [],
                response_metadata=getattr(last, "response_metadata", {}) or {},
            ),
        ]
    }


_builder = StateGraph(State)
_builder.add_node("generate", generate)
_builder.add_node("tools", ToolNode([search_documents]))
_builder.add_node("attach_citations", attach_citations)
_builder.set_entry_point("generate")
_builder.add_conditional_edges(
    "generate",
    should_continue,
    {"tools": "tools", "attach_citations": "attach_citations"},
)
_builder.add_edge("tools", "generate")
_builder.add_edge("attach_citations", END)

# LangGraph API manages persistence for the deployed graph; keep the
# exported graph free of a custom checkpointer.
graph = _builder.compile()
```

- [ ] **Step 3: Run smoke tests — all 4 must pass**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run pytest -q -m smoke
```

Expected: `4 passed`.

If `test_search_documents_tool_returns_json` fails because `search_documents.invoke` errors with "missing required argument", the test calls `search_documents.invoke({"query": "signals"})` which is the canonical LangChain @tool invocation. If the test still fails, double-check the @tool decorator is present.

- [ ] **Step 4: Run through Nx**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run examples-chat-python:smoke --skip-nx-cache 2>&1 | tail -3
```

Expected: pytest `4 passed`; Nx reports `Successfully ran target smoke for project examples-chat-python`.

- [ ] **Step 5: Commit (test + implementation together)**

```bash
git add examples/chat/python/src/graph.py \
        examples/chat/python/tests/test_graph_smoke.py
git commit -m "feat(examples-chat-python): tool calls + citations (search_documents + attach_citations)"
```

---

## Phase 2 — Welcome suggestion entry

### Task 2.1: Append the new welcome suggestion

**File:** `examples/chat/angular/src/app/modes/welcome-suggestions.ts`

The current file has 6 entries (5 from Phase 1 + the puzzle entry from Phase 2A). Locate the closing `];` of the array. Insert one more entry directly before the `];`:

```ts
  {
    label: 'What are Angular signals? (search + cite sources)',
    value:
      'Use the search tool to find authoritative information about Angular signals, then explain what they are and when to use them. Cite your sources inline using [1], [2] etc.',
  },
```

The full array now has 7 entries.

- [ ] **Step 1: Build to confirm no syntax error**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run examples-chat-angular:build --skip-nx-cache --configuration=development 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 2: Test (no test changes; just confirm no regression)**

```bash
npx nx run examples-chat-angular:test --skip-nx-cache 2>&1 | tail -5
```

Expected: 9 tests pass (unchanged from main).

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/modes/welcome-suggestions.ts
git commit -m "feat(examples-chat-angular): welcome suggestion exercising tool calls + citations"
```

---

## Phase 3 — CHECKLIST.md additions

### Task 3.1: Populate Tool calls + Citations sections

**File:** `examples/chat/smoke/CHECKLIST.md`

Scroll to the bottom. Find the empty `## Tool calls` and `## Citations` headings. They currently look like:

```markdown
## Tool calls

## Citations
```

(possibly with `## Interrupts / human-in-the-loop` and other empty Phase 2+ sections after.)

- [ ] **Step 1: Replace the empty `## Tool calls` heading + body**

Replace just the `## Tool calls` line with:

```markdown
## Tool calls

- [ ] Click "What are Angular signals? (search + cite sources)" welcome suggestion
- [ ] During streaming: a tool-call card appears for `search_documents` with a running pill
- [ ] After tool completes: card collapses to "complete" pill
- [ ] Click the card — args + result panels expand
- [ ] AI response references documents inline (e.g. "Signals are... [1]")
```

- [ ] **Step 2: Replace the empty `## Citations` heading + body**

Replace just the `## Citations` line with:

```markdown
## Citations

- [ ] Sources panel ("Sources") renders below the assistant message
- [ ] 3-5 citations listed with title, url, snippet preview
- [ ] Inline `[1]`, `[2]` markers in the message body link to the corresponding source
- [ ] Click a source title — opens the URL in a new tab
- [ ] Server-side: `curl localhost:2024/threads/<id>/state` shows the AI message has `additional_kwargs.citations` with the list
```

Leave other empty Phase 2+ sections (`## Interrupts / human-in-the-loop`, `## Generative UI / A2UI surfaces`, `## Subagents`, `## Time travel / timeline`, `## Multi-thread`) UNTOUCHED — those are populated by their own future phases.

- [ ] **Step 3: Verify diff**

```bash
git diff examples/chat/smoke/CHECKLIST.md | head -40
```

Expected: only the Tool calls + Citations sections gain content; nothing else changes.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/smoke/CHECKLIST.md
git commit -m "docs(examples-chat-smoke): populate Tool calls + Citations checklists"
```

---

## Phase 4 — Verification + PR

### Task 4.1: Full local sweep

- [ ] **Step 1: Python smoke**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run examples-chat-python:smoke --skip-nx-cache 2>&1 | tail -5
```

Expected: 4 passed.

- [ ] **Step 2: Angular tests**

```bash
npx nx run examples-chat-angular:test --skip-nx-cache 2>&1 | tail -5
```

Expected: 9 tests pass.

- [ ] **Step 3: Angular lint**

```bash
npx nx run examples-chat-angular:lint --skip-nx-cache 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 4: Angular build**

```bash
npx nx run examples-chat-angular:build --skip-nx-cache --configuration=development 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 5: Confirm commit count**

```bash
git rev-list --count origin/main..HEAD
```

Expected: 3 commits.

- [ ] **Step 6: Server-side end-to-end probe**

Confirm `OPENAI_API_KEY` is in `examples/chat/python/.env`:

```bash
ls examples/chat/python/.env 2>/dev/null || grep "OPENAI_API_KEY" .env > examples/chat/python/.env
head -1 examples/chat/python/.env | cut -c1-30
```

Start the backend in the background:

```bash
nohup uv run --directory examples/chat/python langgraph dev --port 2024 --no-browser > /tmp/exchat-py-2b.log 2>&1 &
sleep 4
curl -sf http://localhost:2024/ok && echo " backend OK"
```

Send the Angular-signals prompt that exercises the tool flow:

```bash
tid=$(curl -sf -X POST -H 'Content-Type: application/json' http://localhost:2024/threads -d '{}' | python3 -c "import sys,json;print(json.load(sys.stdin)['thread_id'])")
echo "thread=$tid"
curl -sf -X POST -H 'Content-Type: application/json' "http://localhost:2024/threads/$tid/runs/wait" \
  -d "{\"assistant_id\":\"chat\",\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"Use the search tool to find authoritative information about Angular signals, then explain what they are and when to use them. Cite your sources inline using [1], [2] etc.\"}],\"model\":\"gpt-5-mini\"}}" \
  > /tmp/2b-run.json
```

Inspect the response. We want to see:
1. A `ToolMessage` in the message history (search_documents result)
2. A subsequent AI message with `additional_kwargs.citations` populated

```bash
python3 -c "
import json
d = json.load(open('/tmp/2b-run.json'))
msgs = d.get('messages', [])
print('msgs:', len(msgs))
for m in msgs:
    t = m.get('type')
    if t == 'tool':
        print('  tool:', (m.get('content') or '')[:60])
    elif t == 'ai':
        kwargs = m.get('additional_kwargs', {}) or {}
        cites = kwargs.get('citations') or []
        print('  ai (tool_calls=', bool(m.get('tool_calls')), 'citations=', len(cites), ')')
        for c in cites[:2]:
            print('     -', c.get('title'), c.get('url'))
"
```

Expected output (something like):
```
msgs: 4
  ai (tool_calls= True citations= 0 )
  tool: [{"id": "ng-signals-overview", ...
  ai (tool_calls= False citations= 4 )
     - Signals — Angular guide https://angular.dev/guide/signals
     - RxJS interop with signals https://angular.dev/guide/signals/rxjs-interop
```

The final AI message has `citations` populated; the intermediate AI message (with tool_calls) does not. That's the expected shape.

If `citations: 0` on the final AI message, debug:
- Is `attach_citations` even being called? Check the graph's edge wiring.
- Is the ToolMessage parseable as JSON? Print the raw content.
- Is the final message actually `ai` and not still `tool`?

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
git push -u origin claude/examples-chat-phase-2b-tools-citations 2>&1 | tail -3
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(examples-chat): Phase 2B — tool calls + citations" --body "$(cat <<'EOF'
## Summary

Layers tool calls and citations onto the canonical demo by extending the python graph from a single-node generate to a ReAct-style loop with a dedicated tools node and a terminal attach_citations post-process.

- **Python graph**: `__start__ → generate → [tool_calls?] → tools → generate (loop)` or `→ attach_citations → __end__`. Hardcoded 5-document Angular corpus + a `search_documents` tool. The `attach_citations` node walks back to the most recent ToolMessage, parses its JSON content, and replaces the final AI message with one carrying `additional_kwargs.citations` populated (RemoveMessage + AIMessage with same id — standard LangGraph in-place edit pattern).
- **Welcome suggestion**: 7th entry "What are Angular signals? (search + cite sources)" exercises both surfaces.
- **CHECKLIST.md**: Tool calls + Citations sections populated.

The chat composition's `<chat-tool-calls>` and `<chat-citations>` primitives already auto-render — no Angular UI changes needed. The `@ngaf/langgraph` adapter already populates `Message.toolCalls` from `tool_calls`/ToolMessage pairs and `Message.citations` from `additional_kwargs.citations`.

System prompt extended to encourage tool use on Angular topics with inline `[1]`, `[2]` citations.

Spec: `docs/superpowers/specs/2026-05-08-canonical-chat-demo-phase-2b-tools-citations-design.md`
Plan: `docs/superpowers/plans/2026-05-08-canonical-chat-demo-phase-2b-tools-citations.md`

Phase 3+ (interrupts, subagents, generative UI, time travel, multi-thread) are separate spec/plan/PR cycles.

## Test plan

### Verified locally
- [x] `nx run examples-chat-python:smoke` — 4 passed (2 existing + 2 new)
- [x] `nx run examples-chat-angular:test` — 9 passed
- [x] `nx run examples-chat-angular:lint` — 0 errors
- [x] `nx run examples-chat-angular:build` — succeeds (development)
- [x] **Server-side probe**: submit the Angular-signals welcome prompt with model=gpt-5-mini. Response shows: an AI message with tool_calls, a ToolMessage with the JSON hits, a final AI message with `additional_kwargs.citations` populated (3-5 entries with title/url/snippet).

### Pending visual verification
- [ ] After merge: live smoke against the workspace `examples/chat` demo. Tool-call card renders during streaming, collapses to complete; sources panel renders under the response with citations; inline `[1]`, `[2]` markers in message body.

(Visual sweep continues against issue #214.)
EOF
)"
```

- [ ] **Step 3: Note the PR URL.**

- [ ] **Step 4: Wait for CI; address failures.**

- [ ] **Step 5: Merge once green.**

---

## Definition of done

1. PR merged.
2. CI green: `nx run examples-chat-python:smoke` (4 pytest), `nx run examples-chat-angular:test/lint/build`.
3. Server-side probe confirms: AI message → ToolMessage → final AI message with `additional_kwargs.citations` populated.
4. Welcome list now has 7 entries; the 7th references "search + cite sources".
5. CHECKLIST `## Tool calls` and `## Citations` sections populated; other Phase 2+ sections remain empty.
